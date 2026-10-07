// 两关共用的搭建工具：贴图、材质（法线 + 平面反射）、地面/崖壁/墙体
import * as THREE from 'three';
import * as TX from './textures.js';
import { LAYER_FX, REFL } from './post.js';

export const tex = (canvas, rep = 1) => {
  const t = new THREE.CanvasTexture(canvas);
  t.magFilter = THREE.NearestFilter; t.minFilter = THREE.NearestFilter; t.generateMipmaps = false;
  t.wrapS = t.wrapT = THREE.RepeatWrapping; t.colorSpace = THREE.SRGBColorSpace; t.repeat.set(rep, rep);
  return t;
};
// 由贴图明度生成法线：缝隙凹下去、凸起处鼓出来
export const ntex = (canvas, k = 2.5, rep = 1) => {
  const t = new THREE.CanvasTexture(TX.heightNormal(canvas, k)); t.magFilter = t.minFilter = THREE.NearestFilter; t.generateMipmaps = false;
  t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(rep, rep); return t;
};
export const toon = (o) => new THREE.MeshStandardMaterial({ roughness: .85, metalness: 0, ...o });

// 给标准材质加平面反射：采样低分辨率反射图，按法线扭曲，粗糙度越低越亮
export function reflective(mat, k = .4, distort = 1) {
  mat.userData.reflK = { value: k };
  mat.onBeforeCompile = (sh) => {
    sh.uniforms.tReflect = REFL.tReflect; sh.uniforms.reflMat = REFL.reflMat; sh.uniforms.reflK = mat.userData.reflK;
    sh.uniforms.reflDist = { value: distort };
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\nuniform mat4 reflMat; varying vec4 vReflPos;')
      .replace('#include <project_vertex>', '#include <project_vertex>\nvReflPos = reflMat * modelMatrix * vec4(transformed, 1.0);');
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', '#include <common>\nuniform sampler2D tReflect; uniform float reflK, reflDist; varying vec4 vReflPos;')
      .replace('#include <opaque_fragment>', `{
        vec2 ruv = vReflPos.xy / vReflPos.w + normal.xy * .045 * reflDist;
        vec3 rc = texture2D(tReflect, ruv).rgb;
        float edge = smoothstep(0., .04, ruv.x) * smoothstep(1., .96, ruv.x) * smoothstep(0., .04, ruv.y) * smoothstep(1., .96, ruv.y);
        outgoingLight += rc * reflK * (1. - roughnessFactor * .85) * edge;
      }
      #include <opaque_fragment>`);
  };
  mat.customProgramCacheKey = () => 'refl';
  return mat;
}

// 朝向相机的面片（光晕、精灵）
export function billboard(t, w, h, additive, camQuat) {
  const mat = new THREE.MeshBasicMaterial({ map: t, transparent: true, depthWrite: false, side: THREE.DoubleSide, blending: additive ? THREE.AdditiveBlending : THREE.NormalBlending });
  const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), mat);
  m.quaternion.copy(camQuat); m.layers.set(LAYER_FX);
  return m;
}

// 合并四边形（世界坐标做 UV，贴图无缝平铺）
export function quadGeo(cells, y = 0, tile = 2) {
  const pos = [], nor = [], uv = [], idx = [];
  cells.forEach(([x, z], i) => {
    const b = i * 4;
    pos.push(x, y, z, x + 1, y, z, x + 1, y, z + 1, x, y, z + 1);
    for (let k = 0; k < 4; k++) nor.push(0, 1, 0);
    uv.push(x / tile, -z / tile, (x + 1) / tile, -z / tile, (x + 1) / tile, -(z + 1) / tile, x / tile, -(z + 1) / tile);
    idx.push(b, b + 2, b + 1, b, b + 3, b + 2);
  });
  const gg = new THREE.BufferGeometry();
  gg.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  gg.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
  gg.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  gg.setIndex(idx); return gg;
}

// 地块边缘向下的崖壁
export function cliffMesh(cliffs, mat, D = 1.8) {
  const pos = [], nor = [], uv = [], idx = [];
  cliffs.forEach(([x, z, dx, dz], i) => {
    const b = i * 4; let a, c2;
    if (dz === 1) { a = [x, z + 1]; c2 = [x + 1, z + 1]; } else if (dz === -1) { a = [x + 1, z]; c2 = [x, z]; }
    else if (dx === 1) { a = [x + 1, z + 1]; c2 = [x + 1, z]; } else { a = [x, z]; c2 = [x, z + 1]; }
    pos.push(a[0], 0, a[1], c2[0], 0, c2[1], c2[0], -D, c2[1], a[0], -D, a[1]);
    for (let k = 0; k < 4; k++) nor.push(dx, 0, dz);
    uv.push(0, 1, 1, 1, 1, 1 - D / 2, 0, 1 - D / 2);
    idx.push(b, b + 2, b + 1, b, b + 3, b + 2);
  });
  const gg = new THREE.BufferGeometry();
  gg.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  gg.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
  gg.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); gg.setIndex(idx);
  const m = new THREE.Mesh(gg, mat); m.receiveShadow = true; return m;
}

// 墙体方块（侧面 v 按高度缩放，贴图 2 米高）
export function wallGeo(h, w = 1) {
  const gg = new THREE.BoxGeometry(w, h, w);
  const uv = gg.attributes.uv;
  for (const face of [0, 1, 4, 5]) for (let k = 0; k < 4; k++) { const i = face * 4 + k; uv.setY(i, 1 - (1 - uv.getY(i)) * h / 2); }
  gg.translate(0, h / 2, 0); return gg;
}
export function instWalls(group, list, geo, mats) {
  const m = new THREE.InstancedMesh(geo, mats, list.length);
  const M = new THREE.Matrix4(); list.forEach(([x, z, s = 1, ry = 0], i) => { M.compose(new THREE.Vector3(x + .5, 0, z + .5), new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), ry), new THREE.Vector3(1, s, 1)); m.setMatrixAt(i, M); });
  m.castShadow = m.receiveShadow = true; group.add(m); return m;
}

export const hashv = (a, b) => TX.hash(a * 13 + 5, b * 7 + 3);
export const shadowAll = (o, cast = true, recv = true) => o.traverse(c => { if (c.isMesh) { c.castShadow = cast; c.receiveShadow = recv; } });

// 简单的环境光反射源：金属和抛光面在暗处也有一点高光
export function makeEnv(renderer, top, bottom, spots) {
  const s = new THREE.Scene();
  const sky = new THREE.Mesh(new THREE.SphereGeometry(10, 16, 8), new THREE.ShaderMaterial({
    side: THREE.BackSide, uniforms: { a: { value: new THREE.Color(top) }, b: { value: new THREE.Color(bottom) } },
    vertexShader: `varying vec3 vP; void main(){ vP = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.); }`,
    fragmentShader: `uniform vec3 a, b; varying vec3 vP; void main(){ float t = normalize(vP).y * .5 + .5; gl_FragColor = vec4(mix(b, a, t), 1.); }`
  }));
  s.add(sky);
  spots.forEach(([x, y, z, col, sz]) => { const m = new THREE.Mesh(new THREE.SphereGeometry(sz, 8, 6), new THREE.MeshBasicMaterial({ color: col })); m.position.set(x, y, z); s.add(m); });
  const pm = new THREE.PMREMGenerator(renderer);
  const rt = pm.fromScene(s, .04); pm.dispose();
  return rt.texture;
}

// 释放一个关卡的全部资源
export function disposeGroup(g) {
  g.traverse(o => {
    if (o.geometry) o.geometry.dispose();
    if (o.material) (Array.isArray(o.material) ? o.material : [o.material]).forEach(m => { for (const k in m) { const v = m[k]; if (v && v.isTexture) v.dispose(); } m.dispose(); });
  });
  g.removeFromParent();
}

/* ---------- 体积光柱：天上斜照下来的一束光 + 地上柔边光池 + 光里飘的灰尘 ---------- */
// 所有光柱共用一个时间 uniform（主循环每帧更新）
export const SHAFT_T = { value: 0 };
// x,z：光池中心；opts: color, r（光池半径）, h（光柱可见高度）, lean（向相机方向倾斜的 [dx,dz]/米）, I（灯光强度）, k（光柱浓度）
export function lightShaft(root, x, z, opts = {}) {
  const o = { color: 0xdfe6ff, r: 1.6, h: 7, lean: [-.25, -.45], I: 4, k: .5, dust: 26, ...opts }; o.k *= .55;
  const g = new THREE.Group(); g.position.set(x, 0, z); root.add(g);
  const col = new THREE.Color(o.color);
  // 光柱：上细下粗的开口圆台，沿 lean 方向倾斜；朝向相机的中段最浓，两侧边缘柔和淡出
  const top = [o.lean[0] * o.h, o.h, o.lean[1] * o.h];
  const geo = new THREE.CylinderGeometry(o.r * .6, o.r * 1.05, o.h, 32, 6, true);
  geo.translate(0, o.h / 2, 0);
  const pos = geo.attributes.position;
  for (let i = 0; i < pos.count; i++) { const y = pos.getY(i) / o.h; pos.setX(i, pos.getX(i) + top[0] * y); pos.setZ(i, pos.getZ(i) + top[2] * y); }
  geo.computeVertexNormals();
  const k = { value: 0 };
  const mat = new THREE.ShaderMaterial({
    uniforms: { col: { value: col }, k, time: SHAFT_T, seed: { value: Math.random() * 10 } },
    transparent: true, depthWrite: false, side: THREE.DoubleSide, blending: THREE.AdditiveBlending,
    vertexShader: `varying float vY; varying float vF; varying float vA;
      void main(){ vY = uv.y; vA = uv.x;
        vec3 n = normalize(normalMatrix * normal); vF = abs(n.z);
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.); }`,
    fragmentShader: `uniform vec3 col; uniform float k, time, seed; varying float vY; varying float vF; varying float vA;
      void main(){
        float edge = pow(vF, 4.);
        float along = smoothstep(0., .18, vY) * (1. - smoothstep(.55, 1., vY)) * (.55 + .45 * (1. - vY));
        float streak = .55 + .45 * sin(vA * 37. + seed + time * .35) * sin(vA * 13. - time * .21 + seed * 2.);
        float a = edge * along * streak * k;
        gl_FragColor = vec4(col * a, 1.);
      }`
  });
  const shaft = new THREE.Mesh(geo, mat); shaft.layers.set(LAYER_FX); shaft.renderOrder = 5; g.add(shaft);
  // 光里的灰尘：在光柱内部缓慢上下漂，一闪一闪
  const N = o.dust, dp = new Float32Array(N * 3), dr = new Float32Array(N);
  for (let i = 0; i < N; i++) { const a = Math.random() * 6.283, rr = Math.sqrt(Math.random()) * o.r * .7; dp[i * 3] = Math.cos(a) * rr; dp[i * 3 + 1] = Math.random(); dp[i * 3 + 2] = Math.sin(a) * rr; dr[i] = Math.random(); }
  const dg = new THREE.BufferGeometry(); dg.setAttribute('position', new THREE.BufferAttribute(dp, 3)); dg.setAttribute('rnd', new THREE.BufferAttribute(dr, 1));
  const dm = new THREE.ShaderMaterial({
    uniforms: { col: { value: col }, k, time: SHAFT_T, H: { value: o.h * .55 }, lean: { value: new THREE.Vector2(...o.lean) } },
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    vertexShader: `attribute float rnd; uniform float time, H; uniform vec2 lean; varying float vA;
      void main(){ float y = fract(position.y + time * (.012 + rnd * .02) * (rnd > .5 ? 1. : -1.)) * H + .15;
        vec3 p = vec3(position.x + lean.x * y + sin(time * .4 + rnd * 20.) * .12, y, position.z + lean.y * y + cos(time * .3 + rnd * 9.) * .12);
        vA = (.35 + .65 * (.5 + .5 * sin(time * (1.2 + rnd * 2.) + rnd * 40.))) * smoothstep(0., .3, y / H) * (1. - smoothstep(.7, 1., y / H));
        gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.); gl_PointSize = rnd > .8 ? 2. : 1.; }`,
    fragmentShader: `uniform vec3 col; uniform float k; varying float vA; void main(){ gl_FragColor = vec4(col * vA * k * 1.6, 1.); }`
  });
  const dust = new THREE.Points(dg, dm); dust.layers.set(LAYER_FX); dust.frustumCulled = false; g.add(dust);
  // 地上的光池：带柔边的聚光灯，从光柱顶上照下来
  const light = new THREE.SpotLight(col, 0, 0, Math.atan(o.r * 1.15 / o.h), .85, 1.2);
  light.position.set(top[0], o.h, top[2]); light.target.position.set(0, 0, 0); g.add(light, light.target);
  const S = { g, light, shaft, k: 0, set(v) { this.k = v; k.value = v * o.k; light.intensity = v * o.I; shaft.visible = dust.visible = v > .005; } };
  S.set(opts.on === false ? 0 : 1);
  return S;
}
