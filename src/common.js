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
