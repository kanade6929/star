// 鼠标光点：一颗有厚度的四芒星（前后各隆起成尖顶，切面分明），慢慢自转；
// 周围的光晕不是贴图，而是光在空气里散射的体积光：沿视线对点光源做解析积分，
// 光线碰到地面就截止，所以越靠近地面光晕越被「切」开，和真实的光池接在一起。
import * as THREE from 'three';

function starGeo(R = 1, r = .42, depth = .45) {
  const pts = [];
  for (let i = 0; i < 8; i++) { const a = i * Math.PI / 4 + Math.PI / 2, rr = i % 2 ? r : R; pts.push([Math.cos(a) * rr, Math.sin(a) * rr]); }
  const P = [];
  const F = [0, 0, depth], B = [0, 0, -depth];
  for (let i = 0; i < 8; i++) {
    const a = pts[i], b = pts[(i + 1) % 8];
    P.push(...F, a[0], a[1], 0, b[0], b[1], 0);
    P.push(...B, b[0], b[1], 0, a[0], a[1], 0);
  }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(P, 3));
  g.computeVertexNormals(); // 非索引几何：每个三角形各自的平面法线 → 切面分明
  return g;
}

export function makeOrbStar(layerFx) {
  const g = new THREE.Group();
  const col = { value: new THREE.Color(0xffc45a) }, k = { value: 1 }, time = { value: 0 }, prism = { value: 0 };
  // 星体：自发光，切面按朝向分出明暗（像宝石），中心更亮
  const starM = new THREE.ShaderMaterial({
    uniforms: { col, k, time },
    vertexShader: `varying vec3 vN; varying float vR;
      void main(){ vN = normalize(normalMatrix * normal); vR = length(position.xy);
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.); }`,
    fragmentShader: `uniform vec3 col; uniform float k, time; varying vec3 vN; varying float vR;
      void main(){
        // 切面明暗对比要够大，十几个像素里也看得出是立体的星
        vec3 L = normalize(vec3(-.55, .6, .58));
        float f = .38 + .72 * max(dot(vN, L), 0.);
        float core = 1. - smoothstep(0., .32, vR);
        vec3 tint = mix(col, vec3(1., .9, .62), .25);
        vec3 c = mix(tint * f, vec3(1.15, 1.0, .72), core * .75) * k;
        gl_FragColor = vec4(c, 1.);
      }`
  });
  const star = new THREE.Mesh(starGeo(), starM); star.scale.setScalar(.3); star.layers.set(layerFx);
  g.add(star);
  // 皮肤「星之彩棱」：冷蓝色的棱晶星，切面随角度折出七彩；外层细长四芒 + 内层错开 45° 的小四芒，合成八道棱光
  const prismM = new THREE.ShaderMaterial({
    uniforms: { k, time },
    vertexShader: `varying vec3 vN, vV; varying float vR;
      void main(){ vN = normalize(normalMatrix * normal); vec4 mv = modelViewMatrix * vec4(position, 1.); vV = normalize(-mv.xyz); vR = length(position.xy);
        gl_Position = projectionMatrix * mv; }`,
    fragmentShader: `uniform float k, time; varying vec3 vN, vV; varying float vR;
      vec3 rb(float h){ return clamp(abs(mod(h * 6. + vec3(0., 4., 2.), 6.) - 3.) - 1., 0., 1.); }
      void main(){
        vec3 L = normalize(vec3(-.55, .6, .58));
        float f = .34 + .8 * max(dot(vN, L), 0.);
        // 棱镜色散：切面朝向 + 时间 → 色相，整体压在冰蓝里
        float hue = fract(dot(vN, vec3(.37, .61, .23)) * 1.6 + time * .12);
        vec3 ice = vec3(.55, .78, 1.15);
        vec3 c = mix(ice * f * .55, rb(hue) * (.25 + f * .5), .68);
        float spec = pow(max(dot(reflect(-L, vN), vV), 0.), 14.);
        c += vec3(.7, .85, 1.) * spec * .4;
        float core = 1. - smoothstep(0., .26, vR);
        c = mix(c, vec3(.8, .92, 1.08), core * .35) * k;
        gl_FragColor = vec4(c, 1.);
      }`
  });
  const prismG = new THREE.Group(); prismG.visible = false; g.add(prismG);
  const pA = new THREE.Mesh(starGeo(1.08, .26, .5), prismM); pA.scale.setScalar(.3); pA.layers.set(layerFx); prismG.add(pA);
  const pB = new THREE.Mesh(starGeo(.66, .24, .36), prismM); pB.scale.setScalar(.3); pB.layers.set(layerFx); prismG.add(pB);
  // 体积光：球形范围内的单次散射（1/d² 沿视线积分），地面以下不算
  const glowM = new THREE.ShaderMaterial({
    uniforms: { col, k, time, prism, R: { value: 1.6 }, dens: { value: .018 }, center: { value: new THREE.Vector3() }, camDir: { value: new THREE.Vector3(0, -1, 0) } },
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    vertexShader: `varying vec3 vW; void main(){ vec4 w = modelMatrix * vec4(position, 1.); vW = w.xyz; gl_Position = projectionMatrix * viewMatrix * w; }`,
    fragmentShader: `uniform vec3 col, center, camDir; uniform float k, R, dens, time, prism; varying vec3 vW;
      vec3 rb(float h){ return clamp(abs(mod(h * 6. + vec3(0., 4., 2.), 6.) - 3.) - 1., 0., 1.); }
      // ∫ 1/(h² + t²) dt = atan(t/h)/h
      float seg(float h, float t0, float t1){ return (atan(t1 / h) - atan(t0 / h)) / h; }
      void main(){
        vec3 d = normalize(camDir), o = vW;
        float tc = dot(center - o, d);              // 视线上离光源最近的点
        vec3 cp = o + d * tc; float h = max(length(cp - center), .06);
        float half_ = sqrt(max(R * R - h * h, 0.));
        float t0 = -half_, t1 = half_;
        if (d.y < -.01) { float tg = (o.y - 0.) / -d.y - tc; t1 = min(t1, tg); } // 碰到地面截止
        if (t1 <= t0) discard;
        float I = seg(h, t0, t1) * dens;
        float edge = 1. - smoothstep(R * .55, R, h);
        float a = min(I * edge * k, .55);
        vec3 c = col;
        // 彩棱：光晕外圈按方位角散开一圈淡淡的虹彩，慢慢转
        if (prism > .5) { vec3 rel = cp - center; float ang = atan(rel.z, rel.x) / 6.2832; float rr = smoothstep(.25, 1.1, h / R * 2.);
          c = mix(col, rb(fract(ang + time * .06)) * .9 + col * .25, rr * .5); }
        gl_FragColor = vec4(c * a, 1.);
      }`
  });
  const glow = new THREE.Mesh(new THREE.SphereGeometry(1, 20, 14), glowM); glow.scale.setScalar(1.6); glow.layers.set(layerFx); glow.renderOrder = 6;
  g.add(glow);
  return {
    g, star, glow,
    setColor(c) { col.value.set(c); },
    setSkin(s) { const p = s === 'prism'; prism.value = p ? 1 : 0; star.visible = !p; prismG.visible = p; },
    get prism() { return prism.value > .5; },
    update(dt, T, cam, intensity, glowK) {
      time.value = T; k.value = intensity;
      star.rotation.set(-.8 + Math.sin(T * .7) * .1, Math.sin(T * .9) * .65, Math.sin(T * .5) * .15); // 大致朝向镜头，左右摆着露出切面
      if (prismG.visible) {
        pA.rotation.set(-.8 + Math.sin(T * .7) * .1, Math.sin(T * .8) * .75, T * .35);
        pB.rotation.set(-.8 + Math.cos(T * .6) * .12, -Math.sin(T * 1.1) * .8, -T * .55 + Math.PI / 4);
      }
      g.updateMatrixWorld();
      glow.getWorldPosition(glowM.uniforms.center.value);
      cam.getWorldDirection(glowM.uniforms.camDir.value);
      glowM.uniforms.k.value = glowK;
    }
  };
}
