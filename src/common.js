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
  const t = new THREE.CanvasTexture(TX.heightNormal(canvas, k * 1.5)); // 贴图改成高清后，相邻像素的高差变小，法线强度补回来 t.magFilter = t.minFilter = THREE.NearestFilter; t.generateMipmaps = false;
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
        rc /= 1. + dot(rc, vec3(.3, .5, .2)) * 1.6;   // 压住倒影里的高光（光点），暗处几乎不变
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
  if (o.hide) o.hide.push(shaft, dust); // 光柱不进水面倒影
  // 地上的光池：带柔边的聚光灯，从光柱顶上照下来
  const light = new THREE.SpotLight(col, 0, 0, Math.atan(o.r * 1.15 / o.h), .85, 1.2);
  light.position.set(top[0], o.h, top[2]); light.target.position.set(0, 0, 0); g.add(light, light.target);
  const S = { g, light, shaft, k: 0, set(v) { this.k = v; k.value = v * o.k; light.intensity = v * o.I; shaft.visible = dust.visible = v > .005; } };
  S.set(opts.on === false ? 0 : 1);
  return S;
}

/* ---------- 块面感几何：倒角方块、石板地面 ---------- */
// 倒角方块（顶面和侧面之间切一道斜面，能接住光，像参考视频里的厚块）。顶面在 y = h，底面在 y = 0
export function bevelBox(w, h, d, b = .03) {
  const s = new THREE.Shape(); const hw = w / 2 - b, hd = d / 2 - b;
  s.moveTo(-hw, -hd); s.lineTo(hw, -hd); s.lineTo(hw, hd); s.lineTo(-hw, hd); s.lineTo(-hw, -hd);
  const g = new THREE.ExtrudeGeometry(s, { depth: Math.max(.001, h - 2 * b), bevelEnabled: true, bevelThickness: b, bevelSize: b, bevelSegments: 1, steps: 1 });
  g.rotateX(-Math.PI / 2); g.translate(0, b, 0);
  return g.index ? g.toNonIndexed() : g;
}
// 按世界坐标重算 UV：顶面用 xz，侧面用水平方向 + 高度（贴图无缝衔接）
export function worldUV(g, tile = 2, sideTile = tile) {
  const p = g.attributes.position, n = g.attributes.normal, uv = new Float32Array(p.count * 2);
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i), y = p.getY(i), z = p.getZ(i), nx = Math.abs(n.getX(i)), ny = Math.abs(n.getY(i)), nz = Math.abs(n.getZ(i));
    if (ny > .7) { uv[i * 2] = x / tile; uv[i * 2 + 1] = -z / tile; }
    else if (nx > nz) { uv[i * 2] = z / sideTile; uv[i * 2 + 1] = y / sideTile; }
    else { uv[i * 2] = x / sideTile; uv[i * 2 + 1] = y / sideTile; }
  }
  g.setAttribute('uv', new THREE.BufferAttribute(uv, 2)); return g;
}
// 合并若干个非索引几何（只取 position / normal）
export function mergeFlat(list) {
  let n = 0; list.forEach(g => n += g.attributes.position.count);
  const P = new Float32Array(n * 3), N = new Float32Array(n * 3); let o = 0;
  list.forEach(g => { P.set(g.attributes.position.array, o * 3); N.set(g.attributes.normal.array, o * 3); o += g.attributes.position.count; g.dispose(); });
  const gg = new THREE.BufferGeometry();
  gg.setAttribute('position', new THREE.BufferAttribute(P, 3)); gg.setAttribute('normal', new THREE.BufferAttribute(N, 3));
  return gg;
}
// 一格一块的石板地面：每块有厚度、倒角、轻微的高低和歪斜，缝里是暗的底座
export function slabFloor(cells, mat, { y = 0, gap = .045, h = .12, b = .035, tile = 2, jitter = 1, seed = 1, groutMat } = {}) {
  const base = bevelBox(1 - gap, h, 1 - gap, b), list = [];
  const M = new THREE.Matrix4(), Q = new THREE.Quaternion(), E = new THREE.Euler(), S = new THREE.Vector3(1, 1, 1), T = new THREE.Vector3();
  cells.forEach(([x, z]) => {
    const r1 = hashv(x * 3 + seed, z), r2 = hashv(z * 5 + seed, x * 2), r3 = hashv(x + z * 7, seed);
    E.set((r1 - .5) * .025 * jitter, (r2 - .5) * .03 * jitter, (r3 - .5) * .025 * jitter); Q.setFromEuler(E);
    T.set(x + .5, y - h + (r3 - .5) * .02 * jitter, z + .5);
    M.compose(T, Q, S); list.push(base.clone().applyMatrix4(M));
  });
  base.dispose();
  const gg = worldUV(mergeFlat(list), tile);
  const g = new THREE.Group();
  const m = new THREE.Mesh(gg, mat); m.receiveShadow = true; m.castShadow = true; g.add(m);
  // 缝底：一张暗色平面，从缝里看下去是深的
  const grout = new THREE.Mesh(quadGeo(cells, y - h * .8), groutMat || new THREE.MeshStandardMaterial({ color: 0x0c0a18, roughness: 1 }));
  grout.receiveShadow = true; g.add(grout);
  return g;
}
// 倒角墙块（实例化用）：材质组 0 = 侧面，1 = 顶面
export function bevelWallGeo(h, w = 1, b = .04) {
  const g = bevelBox(w, h, w, b);
  const p = g.attributes.position, n = g.attributes.normal, uv = new Float32Array(p.count * 2);
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i), y = p.getY(i), z = p.getZ(i), nx = Math.abs(n.getX(i)), ny = n.getY(i);
    if (ny > .7) { uv[i * 2] = x + .5; uv[i * 2 + 1] = z + .5; }
    else { uv[i * 2] = (nx > .5 ? z : x) + .5; uv[i * 2 + 1] = 1 - (h - y) / 2; } // 贴图顶端对齐墙顶
  }
  g.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  // 按顶面 / 侧面分组（三角形重排）
  const tris = p.count / 3, top = [], side = [];
  for (let t = 0; t < tris; t++) { let ny = 0; for (let k = 0; k < 3; k++) ny += n.getY(t * 3 + k); (ny / 3 > .7 ? top : side).push(t); }
  const order = [...side, ...top], attrs = ['position', 'normal', 'uv'], out = new THREE.BufferGeometry();
  attrs.forEach(a => { const src = g.attributes[a], sz = src.itemSize, arr = new Float32Array(src.count * sz); order.forEach((t, j) => { for (let k = 0; k < 3 * sz; k++) arr[j * 3 * sz + k] = src.array[t * 3 * sz + k]; }); out.setAttribute(a, new THREE.BufferAttribute(arr, sz)); });
  out.addGroup(0, side.length * 3, 0); out.addGroup(side.length * 3, top.length * 3, 1);
  g.dispose(); return out;
}
// 倒角块的局部 UV：顶面铺满一张贴图（光之桥、影石这类单块的石板）
export function tileBevel(w, h, b = .03) {
  const g = worldUV(bevelBox(w, h, w, b), w), uv = g.attributes.uv;
  for (let i = 0; i < uv.count; i++) { uv.setX(i, uv.getX(i) + .5); uv.setY(i, uv.getY(i) + .5); }
  return g;
}
