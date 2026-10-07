// 像素化渲染管线：低分辨率颜色/深度/法线 → 描边 + 高光边 + 景深 + 泛光 → 整数倍放大
// 另有一张平面反射图：抛光地面和水面按屏幕坐标采样它，得到像素化的倒影
import * as THREE from 'three';

export const LAYER_FX = 2; // 不参与法线描边的层（角色精灵、粒子、光晕）
export const LAYER_SH_ORB = 3, LAYER_SH_MOON = 4; // 角色投影替身：分别只给光点 / 月光的阴影相机看
export const PX_WORLD = 1 / 16; // 低分辨率下 1 像素 = 1/16 米（相机平面）

const quadVS = `varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0., 1.); }`;

// 反射共享参数：所有反光材质引用同一组 uniform
export const REFL = { tReflect: { value: null }, reflMat: { value: new THREE.Matrix4() } };

export class PixelPipeline {
  constructor(renderer) {
    this.r = renderer;
    this.w = 0; this.h = 0; this.scale = 1; this.zoom = 1; this.css = null;
    const opts = { minFilter: THREE.NearestFilter, magFilter: THREE.NearestFilter, type: THREE.HalfFloatType };
    this.colorRT = new THREE.WebGLRenderTarget(4, 4, { ...opts, depthTexture: new THREE.DepthTexture(4, 4) });
    this.normalRT = new THREE.WebGLRenderTarget(4, 4, { ...opts, depthBuffer: true });
    this.reflRT = new THREE.WebGLRenderTarget(4, 4, { ...opts, depthBuffer: true });
    REFL.tReflect.value = this.reflRT.texture;
    const lin = { minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter, type: THREE.HalfFloatType, depthBuffer: false };
    this.bloomA = new THREE.WebGLRenderTarget(4, 4, lin);
    this.bloomB = new THREE.WebGLRenderTarget(4, 4, lin);
    this.dofA = new THREE.WebGLRenderTarget(4, 4, lin);
    this.dofB = new THREE.WebGLRenderTarget(4, 4, lin);
    this.normalMat = new THREE.MeshNormalMaterial();
    this.quadCam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
    this.quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2));
    this.quadScene = new THREE.Scene(); this.quadScene.add(this.quad);
    this.mirrorCam = new THREE.OrthographicCamera();
    this.mirrorY = 0; this.hideInReflection = [];
    this.clip = [new THREE.Plane(new THREE.Vector3(0, 1, 0), 0)];

    this.brightMat = new THREE.ShaderMaterial({
      uniforms: { tColor: { value: null }, thresh: { value: .75 }, texel: { value: new THREE.Vector2() } },
      vertexShader: quadVS,
      // 每个泛光像素覆盖 4×4 个画面像素：全部取平均，小光点移动时泛光不会忽亮忽暗
      fragmentShader: `uniform sampler2D tColor; uniform float thresh; uniform vec2 texel; varying vec2 vUv;
        void main(){ vec3 acc = vec3(0.);
          for (int j = 0; j < 4; j++) for (int i = 0; i < 4; i++) {
            vec3 c = texture2D(tColor, vUv + (vec2(float(i), float(j)) - 1.5) * texel).rgb; float l = max(c.r, max(c.g, c.b));
            acc += c * smoothstep(thresh, thresh + .9, l); }
          gl_FragColor = vec4(acc / 16., 1.); }`
    });
    this.blurMat = new THREE.ShaderMaterial({
      uniforms: { tSrc: { value: null }, dir: { value: new THREE.Vector2() } },
      vertexShader: quadVS,
      fragmentShader: `uniform sampler2D tSrc; uniform vec2 dir; varying vec2 vUv;
        void main(){ vec3 s = texture2D(tSrc, vUv).rgb * .227;
          s += (texture2D(tSrc, vUv + dir * 1.38).rgb + texture2D(tSrc, vUv - dir * 1.38).rgb) * .316;
          s += (texture2D(tSrc, vUv + dir * 3.23).rgb + texture2D(tSrc, vUv - dir * 3.23).rgb) * .07;
          gl_FragColor = vec4(s, 1.); }`
    });
    const pal = Array.from({ length: 16 }, () => new THREE.Vector3());
    this.compMat = new THREE.ShaderMaterial({
      uniforms: {
        tColor: { value: null }, tDepth: { value: null }, tNormal: { value: null }, tBloom: { value: null }, tDof: { value: null },
        focus: { value: new THREE.Vector2(.5, .5) }, dofK: { value: 1 }, palK: { value: .18 }, pal: { value: pal },
        res: { value: new THREE.Vector2() }, inner: { value: new THREE.Vector2() }, shift: { value: new THREE.Vector2() },
        time: { value: 0 }, bloomK: { value: 1.0 }, fade: { value: 0 }, fadeCol: { value: new THREE.Color(0x05040f) },
        grade: { value: 0 }, flash: { value: 0 }, vig: { value: .55 },
        tintLo: { value: new THREE.Vector3(.95, .93, 1.08) }, tintHi: { value: new THREE.Vector3(1.06, 1.02, .94) }
      },
      vertexShader: quadVS,
      fragmentShader: `
        uniform sampler2D tColor, tDepth, tNormal, tBloom, tDof; uniform vec2 focus; uniform float dofK, palK; uniform vec3 pal[16];
        uniform vec2 res, inner, shift; uniform float time, bloomK, fade, grade, flash, vig; uniform vec3 fadeCol, tintLo, tintHi;
        varying vec2 vUv;
        float D(vec2 p){ return texture2D(tDepth, (p + .5) / res).r; }
        vec3 N(vec2 p){ return texture2D(tNormal, (p + .5) / res).rgb * 2. - 1.; }
        float bayer(vec2 p){ ivec2 q = ivec2(mod(p, 4.)); int i = q.x + q.y * 4;
          float m[16]; m[0]=0.;m[1]=8.;m[2]=2.;m[3]=10.;m[4]=12.;m[5]=4.;m[6]=14.;m[7]=6.;m[8]=3.;m[9]=11.;m[10]=1.;m[11]=9.;m[12]=15.;m[13]=7.;m[14]=13.;m[15]=5.;
          for (int k = 0; k < 16; k++) if (k == i) return m[k] / 16.; return 0.; }
        // 本关调色板（每关 16 色，由关卡传入）
        vec3 palPull(vec3 c){ vec3 best = pal[0]; float bd = 1e9;
          for (int i = 0; i < 16; i++) { vec3 d = c - pal[i]; float e = dot(d, d * vec3(.8, 1., .7)); if (e < bd) { bd = e; best = pal[i]; } }
          return best; }
        vec3 aces(vec3 x){ return clamp((x * (2.51 * x + .03)) / (x * (2.43 * x + .59) + .14), 0., 1.); }
        vec3 toSRGB(vec3 c){ c = max(c, 0.); return mix(c * 12.92, 1.055 * pow(c, vec3(1. / 2.4)) - .055, step(.0031308, c)); }
        void main(){
          vec2 p = floor(vUv * inner + 1. + shift);
          vec3 c = texture2D(tColor, (p + .5) / res).rgb;
          float d = D(p); vec3 n = N(p);
          // 深度描边：邻居明显更远 → 我在前景物体的边缘
          float dd = 0.;
          dd += max(D(p + vec2(1, 0)) - d, 0.); dd += max(D(p - vec2(1, 0)) - d, 0.);
          dd += max(D(p + vec2(0, 1)) - d, 0.); dd += max(D(p - vec2(0, 1)) - d, 0.);
          float depthEdge = step(.0035, dd);
          // 法线高光边：同一深度但朝向改变（凸棱）
          float ne = 0.;
          vec2 offs[4]; offs[0] = vec2(1, 0); offs[1] = vec2(-1, 0); offs[2] = vec2(0, 1); offs[3] = vec2(0, -1);
          for (int k = 0; k < 4; k++) {
            vec3 nn = N(p + offs[k]); float dn = D(p + offs[k]) - d;
            float nd = dot(n - nn, vec3(-.3, .6, .3));
            ne += step(.25, nd) * step(abs(dn), .002);
          }
          float normalEdge = step(.5, ne);
          if (d < .9999) {
            if (depthEdge > 0.) c *= .42;
            else if (normalEdge > 0.) c = c * 1.45 + .012;
          }
          vec2 fuv = (vUv * inner + 1. + shift) / res;
          // 景深（移轴）：椭圆形的清晰区，往外缓慢过渡，最多只糊到六成
          vec2 fd = vec2((vUv.x - focus.x) * .62, (vUv.y - focus.y) * 1.05);
          float blurK = smoothstep(.2, .78, length(fd)) * .62 * dofK;
          vec3 cb = texture2D(tDof, fuv).rgb;
          c = mix(c, cb, clamp(blurK, 0., 1.));
          // 泛光（平滑采样，像截图里那种溢出的光）
          c += texture2D(tBloom, fuv).rgb * bloomK;
          vec3 s = toSRGB(aces(c * 1.55 * (1. + flash))); // 色调映射：重叠的光不会直接冲白
          float l = dot(s, vec3(.299, .587, .114));
          s = mix(s, s * tintLo, (1. - l) * .4);
          s = mix(s, s * tintHi, smoothstep(.6, 1., l) * .4);
          s = mix(s, vec3(l) * vec3(1.05, 1., .95) * 1.1, grade);
          // 向调色板靠拢（不完全吸附，保留光圈的柔和渐变）
          s = mix(s, palPull(s), palK * smoothstep(.1, .3, l));
          // 轻量化 + 抖动，只去掉渐变色带，不做硬分层
          float lv = 64.;
          s = floor(s * lv + bayer(p)) / lv;
          // 暗角
          vec2 q = vUv - .5; s *= 1. - dot(q, q) * vig;
          s = mix(s, fadeCol, fade);
          gl_FragColor = vec4(s, 1.);
        }`
    });
  }
  setPalette(hexes, tintLo, tintHi) {
    const P = this.compMat.uniforms.pal.value;
    hexes.forEach((h, i) => { const c = new THREE.Color(h); P[i].set(c.r, c.g, c.b); });
    if (tintLo) this.compMat.uniforms.tintLo.value.set(...tintLo);
    if (tintHi) this.compMat.uniforms.tintHi.value.set(...tintHi);
  }
  // 镜头拉近：整数倍放大像素（主界面用）
  setZoom(z) { if (z === this.zoom) return; this.zoom = z; if (this.css) this.resize(...this.css); }
  resize(cssW, cssH, dpr) {
    this.css = [cssW, cssH, dpr];
    const devW = Math.round(cssW * dpr), devH = Math.round(cssH * dpr);
    // 按画面面积定像素大小：横屏、竖屏、宽屏看到的范围都差不多
    this.scale = Math.max(1, Math.round(Math.sqrt(devW * devH) / (288 / this.zoom)));
    this.w = Math.ceil(devW / this.scale); this.h = Math.ceil(devH / this.scale);
    const W = this.w + 2, H = this.h + 2;
    this.colorRT.setSize(W, H); this.normalRT.setSize(W, H); this.reflRT.setSize(W, H);
    this.bloomA.setSize(Math.ceil(W / 4), Math.ceil(H / 4)); this.bloomB.setSize(Math.ceil(W / 4), Math.ceil(H / 4));
    this.dofA.setSize(Math.ceil(W / 2), Math.ceil(H / 2)); this.dofB.setSize(Math.ceil(W / 2), Math.ceil(H / 2));
    this.compMat.uniforms.res.value.set(W, H);
    this.compMat.uniforms.inner.value.set(this.w, this.h);
    this.r.setPixelRatio(1);
    this.r.setSize(devW, devH, false);
    this.devW = devW; this.devH = devH;
  }
  // 相机：正交俯视，世界单位按像素对齐
  setupCamera(cam) {
    const W = this.w + 2, H = this.h + 2, k = PX_WORLD;
    cam.left = -W * k / 2; cam.right = W * k / 2; cam.top = H * k / 2; cam.bottom = -H * k / 2;
    cam.updateProjectionMatrix();
  }
  // 把相机目标吸附到像素网格，返回亚像素偏移（用于平滑滚动）
  snap(cam, target, dir, dist) {
    const fwd = dir.clone().normalize();
    const right = new THREE.Vector3(1, 0, 0);
    const up = new THREE.Vector3().crossVectors(right, fwd).normalize();
    const k = PX_WORLD;
    const tx = target.dot(right), ty = target.dot(up), tf = target.dot(fwd);
    const sx = Math.round(tx / k) * k, sy = Math.round(ty / k) * k;
    const snapped = right.clone().multiplyScalar(sx).add(up.clone().multiplyScalar(sy)).add(fwd.clone().multiplyScalar(tf));
    cam.position.copy(snapped).addScaledVector(fwd, -dist);
    cam.lookAt(snapped);
    this.compMat.uniforms.shift.value.set((tx - sx) / k, (ty - sy) / k);
    return snapped;
  }
  // 平面反射：把相机按 y = mirrorY 翻到水面下方，从下往上看
  renderReflection(scene, cam) {
    const r = this.r, m = this.mirrorY, mc = this.mirrorCam;
    cam.updateMatrixWorld();
    const p = cam.position, f = new THREE.Vector3(0, 0, -1).applyQuaternion(cam.quaternion), u = new THREE.Vector3(0, 1, 0).applyQuaternion(cam.quaternion);
    mc.position.set(p.x, 2 * m - p.y, p.z);
    mc.up.set(u.x, -u.y, u.z);
    mc.lookAt(p.x + f.x, 2 * m - (p.y + f.y), p.z + f.z);
    mc.left = cam.left; mc.right = cam.right; mc.top = cam.top; mc.bottom = cam.bottom; mc.near = cam.near; mc.far = cam.far;
    mc.updateProjectionMatrix(); mc.updateMatrixWorld();
    const bias = new THREE.Matrix4().set(.5, 0, 0, .5, 0, .5, 0, .5, 0, 0, .5, .5, 0, 0, 0, 1);
    REFL.reflMat.value.copy(bias).multiply(mc.projectionMatrix).multiply(mc.matrixWorldInverse);
    // 只渲染水面以上的东西
    this.clip[0].constant = -(m + .03);
    const hidden = this.hideInReflection.filter(o => o.visible); hidden.forEach(o => o.visible = false);
    r.clippingPlanes = this.clip;
    mc.layers.enableAll();
    REFL.tReflect.value = null; // 渲染反射图时不能同时采样它
    r.setRenderTarget(this.reflRT); r.setClearColor(0x05040f, 1); r.clear(); r.render(scene, mc);
    r.clippingPlanes = [];
    REFL.tReflect.value = this.reflRT.texture;
    hidden.forEach(o => o.visible = true);
  }
  render(scene, cam, opt = {}) {
    const r = this.r, U = this.compMat.uniforms;
    r.shadowMap.needsUpdate = true;
    if (opt.reflect !== false) this.renderReflection(scene, cam);
    // 1) 颜色 + 深度
    cam.layers.enableAll();
    r.setRenderTarget(this.colorRT); r.setClearColor(0x05040f, 1); r.clear(); r.render(scene, cam);
    // 2) 法线（只画普通层：排除精灵、粒子和投影替身）
    cam.layers.set(0);
    const bg = scene.background; scene.background = null;
    scene.overrideMaterial = this.normalMat;
    r.setRenderTarget(this.normalRT); r.setClearColor(0x8080ff, 1); r.clear(); r.render(scene, cam);
    scene.overrideMaterial = null; scene.background = bg;
    cam.layers.enableAll();
    // 3) 泛光
    this.quad.material = this.brightMat; this.brightMat.uniforms.tColor.value = this.colorRT.texture;
    this.brightMat.uniforms.texel.value.set(1 / this.colorRT.width, 1 / this.colorRT.height);
    r.setRenderTarget(this.bloomA); r.render(this.quadScene, this.quadCam);
    const bw = this.bloomA.width, bh = this.bloomA.height;
    for (let i = 0; i < 3; i++) {
      this.quad.material = this.blurMat;
      this.blurMat.uniforms.tSrc.value = this.bloomA.texture; this.blurMat.uniforms.dir.value.set(1 / bw, 0);
      r.setRenderTarget(this.bloomB); r.render(this.quadScene, this.quadCam);
      this.blurMat.uniforms.tSrc.value = this.bloomB.texture; this.blurMat.uniforms.dir.value.set(0, 1 / bh);
      r.setRenderTarget(this.bloomA); r.render(this.quadScene, this.quadCam);
    }
    // 3b) 景深模糊图
    this.quad.material = this.blurMat;
    const dw = this.dofA.width, dh = this.dofA.height;
    let src = this.colorRT.texture;
    for (let i = 0; i < 3; i++) {
      const rad = 1 + i;
      this.blurMat.uniforms.tSrc.value = src; this.blurMat.uniforms.dir.value.set(rad / dw, 0);
      r.setRenderTarget(this.dofB); r.render(this.quadScene, this.quadCam);
      this.blurMat.uniforms.tSrc.value = this.dofB.texture; this.blurMat.uniforms.dir.value.set(0, rad / dh);
      r.setRenderTarget(this.dofA); r.render(this.quadScene, this.quadCam);
      src = this.dofA.texture;
    }
    // 4) 合成到屏幕
    U.tColor.value = this.colorRT.texture; U.tDepth.value = this.colorRT.depthTexture; U.tNormal.value = this.normalRT.texture; U.tBloom.value = this.bloomA.texture; U.tDof.value = this.dofA.texture;
    if (opt.focus) U.focus.value.copy(opt.focus); if (opt.dofK !== undefined) U.dofK.value = opt.dofK;
    U.time.value = opt.time || 0; U.fade.value = opt.fade || 0; U.grade.value = opt.grade || 0; U.flash.value = opt.flash || 0;
    if (opt.vig !== undefined) U.vig.value = opt.vig;
    if (opt.bloomK !== undefined) U.bloomK.value = opt.bloomK;
    this.quad.material = this.compMat;
    r.setRenderTarget(null); r.render(this.quadScene, this.quadCam);
  }
}
