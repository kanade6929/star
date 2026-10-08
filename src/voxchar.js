// 3D 体素主角：真正立体的像素小人（像 MagicaVoxel 模型），正面、侧面、背面都是同一个身体。
// 1 个体素 = 1/16 米（和场景贴图的像素一样大）。身体由几块分开的体素部件拼成：
// 腿、手臂、头、后发、两缕鬓发、呆毛、披风，各自绕关节转动；头发和披风用阻尼弹簧甩动。
import * as THREE from 'three';

const U = 1 / 16;
const hex = h => new THREE.Color(h).convertSRGBToLinear();
const C = Object.fromEntries(Object.entries({
  hair: '#ece8fc', hairS: '#cdc6ee', hairD: '#a29ad6', skin: '#fde8dc', skinS: '#f3d0c4', blush: '#f6a8bc',
  lash: '#25194a', iris1: '#2f2f86', iris2: '#5468d0', iris3: '#9cc2ff', white: '#ffffff',
  dress: '#33408f', dressS: '#27306e', dressL: '#5062bc', collar: '#f3efff', ribbon: '#e8c98e',
  cape: '#262d6c', lining: '#7a5cbc', trim: '#e8c98e', sock: '#f1edff', shoe: '#3b2c4c', pin: '#ffe39a'
}).map(([k, v]) => [k, hex(v)]));

/* ---------- 体素部件 ---------- */
class Part {
  constructor() { this.v = new Map(); }
  key(x, y, z) { return x + ',' + y + ',' + z; }
  set(x, y, z, c) { this.v.set(this.key(x, y, z), [x, y, z, c]); return this; }
  del(x, y, z) { this.v.delete(this.key(x, y, z)); return this; }
  has(x, y, z) { return this.v.has(this.key(x, y, z)); }
  get(x, y, z) { const e = this.v.get(this.key(x, y, z)); return e && e[3]; }
  box(x0, y0, z0, x1, y1, z1, c) { for (let x = x0; x < x1; x++) for (let y = y0; y < y1; y++) for (let z = z0; z < z1; z++) this.set(x, y, z, typeof c === 'function' ? c(x, y, z) : c); return this; }
  // 只生成露在外面的面；pivot 为关节位置（体素坐标），网格以关节为原点
  mesh(mat, pivot = [0, 0, 0]) {
    const P = [], N = [], Cc = [];
    const F = [[1, 0, 0], [-1, 0, 0], [0, 1, 0], [0, -1, 0], [0, 0, 1], [0, 0, -1]];
    // 每个面的四个角（单位立方体内）
    const Q = {
      '1,0,0': [[1, 0, 0], [1, 1, 0], [1, 1, 1], [1, 0, 1]], '-1,0,0': [[0, 0, 1], [0, 1, 1], [0, 1, 0], [0, 0, 0]],
      '0,1,0': [[0, 1, 1], [1, 1, 1], [1, 1, 0], [0, 1, 0]], '0,-1,0': [[0, 0, 0], [1, 0, 0], [1, 0, 1], [0, 0, 1]],
      '0,0,1': [[1, 0, 1], [1, 1, 1], [0, 1, 1], [0, 0, 1]], '0,0,-1': [[0, 0, 0], [0, 1, 0], [1, 1, 0], [1, 0, 0]]
    };
    this.v.forEach(([x, y, z, c]) => F.forEach(f => {
      if (this.has(x + f[0], y + f[1], z + f[2])) return;
      const q = Q[f.join(',')];
      [0, 1, 2, 0, 2, 3].forEach(i => { const p = q[i]; P.push((x + p[0] - pivot[0]) * U, (y + p[1] - pivot[1]) * U, (z + p[2] - pivot[2]) * U); N.push(...f); Cc.push(c.r, c.g, c.b); });
    }));
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(P, 3));
    g.setAttribute('normal', new THREE.Float32BufferAttribute(N, 3));
    g.setAttribute('color', new THREE.Float32BufferAttribute(Cc, 3));
    const m = new THREE.Mesh(g, mat); m.castShadow = true; m.receiveShadow = true;
    const grp = new THREE.Group(); grp.position.set(pivot[0] * U, pivot[1] * U, pivot[2] * U); grp.add(m);
    return grp;
  }
}

/* ---------- 造型 ---------- */
function buildParts() {
  const P = {};
  // 腿（髋关节 y = 5）
  P.legs = [-1, 1].map(s => {
    const p = new Part(), x0 = s < 0 ? -3 : 1;
    p.box(x0, 1, -1, x0 + 2, 5, 1, C.sock);
    p.box(x0, 0, -1, x0 + 2, 1, 2, C.shoe);
    return { p, pivot: [x0 + 1, 5, 0] };
  });
  // 裙身 + 上身
  const body = new Part();
  for (let y = 4; y < 10; y++) {
    const w = Math.round(5 - (y - 4) * .45), d = y < 6 ? 3 : 2;
    body.box(-w, y, -d, w, y + 1, d, (x, yy, z) => yy === 4 ? C.dressL : (z < 0 ? C.dressS : C.dress));
  }
  body.box(-3, 10, -2, 3, 12, 2, C.dress);
  body.box(-3, 12, -2, 3, 13, 2, C.collar);
  body.box(-2, 12, 2, 2, 13, 3, C.collar);           // 前襟
  [[-1, 11], [0, 11], [-2, 11], [1, 11], [-1, 10], [0, 10]].forEach(([x, y]) => body.set(x, y, 2, C.ribbon)); // 蝴蝶结
  body.set(-3, 11, 2, C.ribbon); body.set(2, 11, 2, C.ribbon);
  P.body = { p: body, pivot: [0, 5, 0] };
  // 手臂（肩关节）
  P.arms = [-1, 1].map(s => {
    const p = new Part(), x0 = s < 0 ? -5 : 3;
    p.box(x0, 9, -1, x0 + 2, 13, 1, C.dress);
    p.box(x0, 8, -1, x0 + 2, 9, 1, C.collar);
    p.box(x0, 6, -1, x0 + 2, 8, 1, C.skin);
    return { p, pivot: [x0 + 1, 12.5, 0] };
  });
  // 头（颈关节 y = 13）
  const head = new Part();
  head.box(-6, 13, -5, 6, 24, 6, (x, y, z) => {
    const side = x < -5 || x > 4, front = z === 5;
    if (y >= 21) return y === 21 ? C.hair : C.hairS;
    if (z < -1) return y < 16 ? C.hairD : C.hairS;
    if (side && y >= 14) return C.hairS;
    if (front && y >= 19) return C.hair;
    return C.skin;
  });
  // 刘海参差的下沿
  [-5, -3, -1, 0, 2, 4].forEach((x, i) => head.set(x, 18, 5, i % 2 ? C.hairS : C.hair));
  head.set(-4, 17, 5, C.hair); head.set(3, 17, 5, C.hair);
  // 削掉四条竖棱和头顶外圈，头型圆一点；头顶多一层；头发包住脸两侧
  for (let y = 13; y < 24; y++) [[-6, -5], [5, -5], [-6, 5], [5, 5]].forEach(([x, z]) => head.del(x, y, z));
  for (let x = -6; x < 6; x++) for (let z = -5; z < 6; z++) if (x === -6 || x === 5 || z === -5 || z === 5) head.del(x, 23, z);
  head.box(-4, 24, -3, 4, 25, 4, C.hairS);
  for (let y = 14; y < 21; y++) { head.set(-7, y, 1, C.hairS); head.set(6, y, 1, C.hairS); head.set(-7, y, 0, C.hairD); head.set(6, y, 0, C.hairD); }
  // 腮红
  [[-5, 14], [-4, 14], [3, 14], [4, 14]].forEach(([x, y]) => head.set(x, y, 5, C.blush));
  // 眼睛区域留空，由睁眼 / 闭眼两套部件填
  const eyeCells = [];
  [[-4, -3, -2], [1, 2, 3]].forEach(xs => xs.forEach(x => [15, 16, 17].forEach(y => { head.del(x, y, 5); eyeCells.push([x, y]); })));
  head.del(-5, 17, 5); head.del(4, 17, 5); eyeCells.push([-5, 17], [4, 17]);
  // 星形发夹
  head.set(4, 21, 6, C.pin); head.set(5, 22, 6, C.pin); head.set(3, 22, 6, C.pin); head.set(4, 23, 6, C.pin); head.set(4, 22, 6, C.pin);
  P.head = { p: head, pivot: [0, 13, 0] };
  const eyesOpen = new Part(), eyesShut = new Part();
  [[-4, -3, -2, -5], [1, 2, 3, 4]].forEach(([a, b, c2, tail]) => {
    [a, b, c2].forEach(x => eyesOpen.set(x, 17, 5, C.lash));
    eyesOpen.set(tail, 17, 5, C.lash);
    eyesOpen.set(a, 16, 5, C.iris1); eyesOpen.set(b, 16, 5, C.white); eyesOpen.set(c2, 16, 5, C.iris1);
    eyesOpen.set(a, 15, 5, C.iris2); eyesOpen.set(b, 15, 5, C.iris3); eyesOpen.set(c2, 15, 5, C.iris2);
    [a, b, c2].forEach(x => { eyesShut.set(x, 16, 5, C.lash); eyesShut.set(x, 17, 5, C.skin); eyesShut.set(x, 15, 5, C.skin); });
    eyesShut.set(tail, 17, 5, C.skin);
  });
  P.eyesOpen = { p: eyesOpen, pivot: [0, 13, 0] }; P.eyesShut = { p: eyesShut, pivot: [0, 13, 0] };
  // 后发：从后脑垂到腰，下沿参差
  const back = new Part();
  for (let x = -6; x < 6; x++) {
    const bottom = 7 + ((x * 7 + 3) % 3 + 3) % 3 + (Math.abs(x + .5) > 4 ? 2 : 0);
    back.box(x, bottom, -7, x + 1, 22, -5, (xx, y, z) => (y < bottom + 2 ? C.hairD : ((x + 8) % 4 === 1 ? C.hairS : C.hair)));
  }
  P.back = { p: back, pivot: [0, 21, -6] };
  // 两缕鬓发
  P.locks = [-1, 1].map(s => {
    const p = new Part(), x = s < 0 ? -7 : 6;
    p.box(x, 10, 2, x + 1, 20, 4, (xx, y) => y < 12 ? C.hairD : C.hair);
    return { p, pivot: [x + .5, 20, 3] };
  });
  // 呆毛
  const ah = new Part(); ah.set(0, 25, 1, C.hair).set(0, 26, 1, C.hair).set(1, 27, 1, C.hair).set(2, 27, 0, C.hairS);
  P.ahoge = { p: ah, pivot: [0, 25, 1] };
  // 披风：外深蓝、里浅紫、金边
  const cape = new Part();
  for (let y = 4; y < 13; y++) {
    const w = y > 10 ? 4 : 5;
    cape.box(-w, y, -5, w, y + 1, -4, y === 4 ? C.trim : C.cape);
    cape.box(-w, y, -4, w, y + 1, -3, y === 4 ? C.trim : C.lining);
  }
  P.cape = { p: cape, pivot: [0, 12.5, -3.5] };
  return P;
}

// 角色材质：暗处保留一点自身颜色；受光有上限（不会被光点冲白）；明暗对比收一点，融进场景
// 显示时身体以脚为轴往后仰一点、竖向拉长一点（俯视镜头下脸不被压扁）；
// 但深度、光照、影子都按直立的身体算，所以贴着墙站不会插进墙里，影子也和身形一致。
const tiltVS = (sh, U) => {
  Object.assign(sh.uniforms, { cFoot: U.foot, cTilt: U.tilt, cStretch: U.stretch });
  sh.vertexShader = 'uniform vec3 cFoot; uniform float cTilt, cStretch;\n' + sh.vertexShader.replace('#include <project_vertex>', `#include <project_vertex>
{ vec3 d = (modelMatrix * vec4(transformed, 1.)).xyz - cFoot; float dy = d.y * cStretch, c = cos(cTilt), s = sin(cTilt);
  vec4 ct = projectionMatrix * viewMatrix * vec4(cFoot + vec3(d.x, dy * c + d.z * s, d.z * c - dy * s), 1.);
  gl_Position = vec4(ct.xy, gl_Position.z / gl_Position.w * ct.w, ct.w); }`);
};
// 描边用的法线图也要按同样的后仰画，否则地砖缝的描边会穿过身体
function charNormalMat(U) {
  const m = new THREE.MeshNormalMaterial();
  m.onBeforeCompile = sh => tiltVS(sh, U);
  m.customProgramCacheKey = () => 'voxcharN';
  return m;
}
function charMat(U) {
  const m = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: .85, metalness: 0 });
  m.onBeforeCompile = sh => {
    tiltVS(sh, U);
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <emissivemap_fragment>', '#include <emissivemap_fragment>\ntotalEmissiveRadiance += diffuseColor.rgb * .14;')
      .replace('#include <opaque_fragment>', 'outgoingLight = min(outgoingLight, diffuseColor.rgb * .95 + totalEmissiveRadiance);\n#include <opaque_fragment>');
  };
  m.customProgramCacheKey = () => 'voxchar';
  return m;
}

// 阻尼弹簧（角度）
class Spring { constructor(k = 60, d = 8) { this.a = 0; this.v = 0; this.k = k; this.d = d; } step(dt, target) { this.v += ((target - this.a) * this.k - this.v * this.d) * dt; this.a += this.v * dt; return this.a; } }

export class VoxChar {
  constructor() {
    this.U = { foot: { value: new THREE.Vector3() }, tilt: { value: 30 * Math.PI / 180 }, stretch: { value: 1.05 } };
    const mat = this.mat = charMat(this.U), P = buildParts();
    this.normMat = charNormalMat(this.U);
    const root = this.group = new THREE.Group();
    this.pose = new THREE.Group(); root.add(this.pose);
    this.yaw = new THREE.Group(); this.pose.add(this.yaw);
    this.bob = new THREE.Group(); this.yaw.add(this.bob);
    const mk = (d, parent) => { const g = d.p.mesh(mat, d.pivot); parent.add(g); return g; };
    this.legs = P.legs.map(d => mk(d, this.bob));
    // 身体：以髋部为原点，前倾时整个上身一起倾
    this.body = mk(P.body, this.bob);
    const rel = (g, parent) => { parent.attach(g); return g; };
    this.arms = P.arms.map(d => rel(mk(d, this.bob), this.body));
    this.head = rel(mk(P.head, this.bob), this.body);
    this.eyesOpen = rel(mk(P.eyesOpen, this.bob), this.head); this.eyesShut = rel(mk(P.eyesShut, this.bob), this.head);
    this.back = rel(mk(P.back, this.bob), this.head);
    this.locks = P.locks.map(d => rel(mk(d, this.bob), this.head));
    this.ahoge = rel(mk(P.ahoge, this.bob), this.head);
    this.cape = rel(mk(P.cape, this.bob), this.body);
    this.sp = { backX: new Spring(40, 7), backZ: new Spring(40, 7), capeX: new Spring(35, 6), capeZ: new Spring(35, 6), lockX: new Spring(55, 6), lockZ: new Spring(55, 6), ah: new Spring(80, 5) };
    this.t = 0; this.phase = 0; this.blinkT = 2.5; this.yawA = 0; this.lean = 0; this.lieK = 0; this.sitK = 0; this.lv = [0, 0]; this.lookA = 0;
  }
  // 在描边法线图里补画角色
  renderNormals(r, cam) {
    const ms = []; this.group.traverse(o => { if (o.isMesh && o.visible) ms.push(o); });
    ms.forEach(o => o.material = this.normMat);
    const ac = r.autoClear, lm = cam.layers.mask; r.autoClear = false; cam.layers.enableAll();
    r.render(this.group, cam);
    r.autoClear = ac; cam.layers.mask = lm;
    ms.forEach(o => o.material = this.mat);
  }
  // st: { dir, moving, run, vx, vz, dt, lie, crouch(像素), act, actT }
  update(st) {
    const dt = Math.min(st.dt, .05); this.t += dt;
    const sp = Math.hypot(st.vx, st.vz);
    let target = this.yawA;
    if (sp > .2) target = Math.atan2(st.vx, st.vz);
    else if (st.reach && st.reach.yaw != null) target = st.reach.yaw;
    else target = { down: 0, up: Math.PI, left: -Math.PI / 2, right: Math.PI / 2 }[st.dir] ?? this.yawA;
    let d = target - this.yawA; d = Math.atan2(Math.sin(d), Math.cos(d));
    const prevYaw = this.yawA;
    this.yawA += d * (1 - Math.exp(-dt * 14));
    this.yaw.rotation.y = this.yawA;
    const turn = (this.yawA - prevYaw) / Math.max(dt, 1e-3);
    // 躺 / 坐
    this.lieK = st.lie ? 1 : this.lieK + (0 - this.lieK) * (1 - Math.exp(-dt * 10));
    const sit = Math.min(1, (st.crouch || 0) / 7);
    this.sitK += (sit - this.sitK) * (1 - Math.exp(-dt * 12));
    const L = this.lieK, K = this.sitK * (1 - L);
    // 躺下：仰面朝上、头朝西，镜头能看到她的脸
    this.pose.rotation.set(-Math.PI / 2 * L, Math.PI / 2 * L, 0, 'YXZ'); this.pose.position.set(.75 * L, .45 * L, 0);
    // 步态
    const moving = st.moving && sp > .2, run = st.run || 0;
    this.phase += dt * (moving ? 7 + run * 4 : 0);
    const amp = moving ? .6 + run * .3 : 0, s = Math.sin(this.phase);
    const breathe = Math.sin(this.t * 2.2) * .006;
    this.bob.position.y = (moving ? Math.abs(Math.cos(this.phase)) * (.035 + run * .03) : 0) - K * 5 * U;
    this.lean += ((moving ? .06 + run * .12 : 0) - this.lean) * (1 - Math.exp(-dt * 8));
    this.body.rotation.x = this.lean + K * .05; this.body.scale.y = 1 + breathe;
    this.legs[0].rotation.x = s * amp - K * 1.5; this.legs[1].rotation.x = -s * amp - K * 1.5;
    this.arms[0].rotation.set(-s * amp * .9 - K * .3, 0, -.08 - run * .25);
    this.arms[1].rotation.set(s * amp * .9 - K * .3, 0, .08 + run * .25);
    let look = 0, headX = 0;
    // 互动：抬右手向前上方伸出、指尖轻触机关，再放下
    const rk = st.reach ? st.reach.k : 0;
    if (rk > 0) {
      const tap = st.reach.tap || 0, mix = (a, b) => a + (b - a) * rk;
      const r = this.arms[1].rotation, l = this.arms[0].rotation;
      r.set(mix(r.x, -1.3 - tap * .25), 0, mix(r.z, 1.15));
      l.set(mix(l.x, .18), 0, mix(l.z, -.16));
      this.body.rotation.x += .1 * rk + tap * .04;
      this.bob.position.y -= .025 * rk;
      headX = .14 * rk;
    }
    if (st.act === 'rub') { const side = (st.actT || 0) % 1.3 < .65 ? 0 : 1; this.arms[side].rotation.set(-2.5, 0, (side ? -1 : 1) * .45); }
    if (st.act === 'look') { const t = st.actT || 0; look = t < .8 ? -1 : t < 1.7 ? 1 : 0; }
    this.lookA += (look * .6 - this.lookA) * (1 - Math.exp(-dt * 6));
    this.head.rotation.set(st.act === 'rub' ? .12 : headX, this.lookA, 0);
    // 眨眼 / 睡着
    this.blinkT -= dt; if (this.blinkT < -.12) this.blinkT = 2 + Math.random() * 3;
    const shut = st.lie || this.blinkT < 0 || (st.act === 'rub' && Math.sin(this.t * 9) > 0);
    this.eyesOpen.visible = !shut; this.eyesShut.visible = shut;
    // 头发、披风：身体加速度和转身带动，弹簧回弹
    const c = Math.cos(this.yawA), sn = Math.sin(this.yawA);
    const fwd = st.vx * sn + st.vz * c, side = st.vx * c - st.vz * sn;   // 身体坐标系里的速度
    const af = (fwd - this.lv[0]) / Math.max(dt, 1e-3), as = (side - this.lv[1]) / Math.max(dt, 1e-3); this.lv = [fwd, side];
    const idle = Math.sin(this.t * 1.7) * .03;
    // 绕 x 轴转正角 = 下摆往后甩
    const bx = this.sp.backX.step(dt, Math.min(.7, Math.abs(fwd) * .12) + af * .015 + idle), bz = this.sp.backZ.step(dt, -turn * .05 + as * .01);
    this.back.rotation.set(Math.max(-.1, Math.min(.8, bx)), 0, bz);
    const cx = this.sp.capeX.step(dt, Math.min(.4, Math.abs(fwd) * .08) + af * .02 + idle * .7 + K * .15), cz = this.sp.capeZ.step(dt, -turn * .06);
    this.cape.rotation.set(Math.max(-.05, cx), 0, cz);
    const lx = this.sp.lockX.step(dt, Math.abs(fwd) * .06 + af * .01), lz = this.sp.lockZ.step(dt, turn * .04 - as * .01);
    this.locks.forEach((g, i) => g.rotation.set(Math.max(-.1, lx), 0, lz + (i ? .04 : -.04)));
    this.ahoge.rotation.z = this.sp.ah.step(dt, -turn * .08 + Math.sin(this.t * 3) * .05 + af * .01);
  }
}
