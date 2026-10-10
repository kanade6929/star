// 第二幕 · XVIII 月 —— 雾湖上的遗迹。月下的路是幻影，影子里的才是真的
// 塔罗「月亮」：幻象与真实、双塔之间的小路、犬与狼、水中爬出的小龙虾、落下的露珠
import * as THREE from 'three';
import * as TX from './textures.js';
import { mk } from './sprites.js';
import { LAYER_FX } from './post.js';
import { tex, ntex, toon, reflective, billboard, quadGeo, cliffMesh, wallGeo, instWalls, hashv, shadowAll, lightShaft, slabFloor, bevelWallGeo, tileBevel, bevelBox } from './common.js';
import { lakeMat } from './abyss.js';
import { voxelBatch, voxMat, place } from './voxel.js';
import { haloCanvas } from './sprites.js';

export const MW = 99, MH = 15;
const clamp = (v, a, b) => v < a ? a : v > b ? b : v;
const smooth = (a, b, x) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
const easeBack = t => { const c = 1.4; return 1 + (c + 1) * Math.pow(t - 1, 3) + c * Math.pow(t - 1, 2); };
const LIT_R = 9.6;   // 星光能照到的距离
// 月轮：湖心一根高大的月柱，顶上的转臂吊着一只「月钩」绕柱转圈。
// 光点挂上月钩，就像月亮绕着湖心走；月柱的影子永远落在光的对面，跟着一起转
const HUB = [41.5 + 21, 7.5], HOOK_R = 1.3, PILLAR_R = .5, ARM_PERIOD = 20;
const LAKE_Y = -.3;
const MIR = [76.5, 5.5];     // 月镜（镜湖湖心小岛北侧）

/* ---------- 地图 ----------
  空格=深湖  .月石步道  ,苔岸  ~浅水  #断墙  %影石（只在影子里成形）  M石碑  H塔  D犬像  F狼像  G月洞门
  Q月相石  K水底之牌  A月池  T银柳  X月轮轴心
  I 回廊石柱（挡光）  & 幻墙（星光照到就溶解）  k 潮汐石堤（退潮才露出）  r 浮台（涨潮才浮起）  Y 引潮镜 */
// 各区段在旧地图上整体东移：B 双塔庭 +7，C 月轮 +21，D 月池 +35（中间插进了加长的影桥、幻墙回廊和潮汐池）
export const OB = 7, OC = 21, OD = 35;
function buildMap() {
  const g = Array.from({ length: MH }, () => Array(MW).fill(' '));
  let ox = 0;
  const set = (x, z, c) => { x += ox; if (x >= 0 && z >= 0 && x < MW && z < MH) g[z][x] = c; };
  const fill = (x0, z0, x1, z1, c) => { for (let z = z0; z <= z1; z++) for (let x = x0; x <= x1; x++) set(x, z, c); };
  const pts = (list, c) => list.forEach(([x, z]) => set(x, z, c));
  // A：月岸（醒来的地方）
  fill(1, 2, 11, 12, ',');
  pts([[1, 2], [2, 2], [1, 3], [11, 2], [11, 3], [10, 2], [1, 12], [2, 12], [1, 11], [11, 12], [10, 12], [11, 11]], ' ');
  fill(2, 7, 10, 7, '.'); fill(3, 6, 5, 8, '.'); fill(5, 3, 7, 5, '.');
  fill(2, 9, 4, 11, '~'); fill(8, 10, 9, 11, '~');
  pts([[4, 2], [5, 2], [8, 2], [1, 5], [1, 6]], '#');
  set(6, 3, 'Q'); set(6, 5, 'M');
  pts([[9, 4], [3, 4], [10, 10], [6, 11]], 'T');
  fill(11, 6, 12, 8, '.'); set(11, 7, 'M');
  // 加长的影桥：前半段靠岸边石碑的影子，中间一块真的垫脚石，后半段要靠对岸石碑的影子
  fill(13, 7, 17, 7, '%'); fill(18, 6, 19, 8, '.'); fill(20, 7, 24, 7, '%');
  // B：双塔之庭（+7）
  ox = OB;
  fill(18, 2, 32, 12, '.');
  pts([[18, 2], [18, 3], [18, 11], [18, 12], [19, 2], [19, 12]], ' ');
  fill(20, 3, 22, 5, ','); fill(26, 9, 28, 10, ','); fill(28, 4, 29, 6, ',');
  fill(20, 10, 22, 11, '~');
  set(19, 7, 'M');
  for (let x = 20; x <= 32; x++) if (x !== 24 && x !== 25) set(x, 1, '#');
  for (let x = 20; x <= 32; x++) if (x !== 23) set(x, 13, '#');
  for (let z = 1; z <= 13; z++) set(33, z, '#');
  fill(33, 6, 33, 8, 'G');
  fill(30, 2, 32, 4, 'H'); fill(30, 10, 32, 12, 'H');
  set(24, 3, 'D'); set(28, 11, 'F'); set(25, 7, 'M');
  pts([[21, 3], [21, 12]], 'T');
  ox = 0;
  // R：幻墙回廊。湖上一条影石小径通向回廊，回廊西面整排是幻墙
  fill(41, 3, 44, 11, '.'); pts([[42, 4], [42, 10]], 'I');
  fill(45, 7, 47, 7, '%'); pts([[46, 5], [46, 9]], 'I');
  fill(48, 2, 54, 12, '#'); fill(49, 3, 53, 11, '.'); fill(48, 3, 48, 11, '&'); fill(54, 6, 54, 8, '.');
  pts([[51, 3], [51, 4], [53, 5]], '#'); set(52, 5, '&'); set(53, 3, 'Q'); pts([[50, 9], [50, 5]], 'I');
  // C：月轮（+21）
  ox = OC;
  fill(34, 6, 38, 8, '.');
  fill(44, 6, 48, 8, '.');
  set(41, 7, 'X');
  // 环形影石路：八边形，四向连通（不需要斜着跨）
  pts([[39, 6], [39, 5], [40, 5], [40, 4], [41, 4], [42, 4], [42, 5], [43, 5], [43, 6],
       [39, 8], [39, 9], [40, 9], [40, 10], [41, 10], [42, 10], [42, 9], [43, 9], [43, 8]], '%');
  set(41, 3, '%'); set(41, 11, '%');
  fill(40, 1, 42, 2, ','); set(41, 1, 'Q');
  fill(40, 12, 42, 13, ','); set(41, 13, 'K');
  ox = 0;
  // T：镜中月。湖心小岛上立着一面能转的月镜，镜线另一侧映出一轮「镜中月」；u 镜月石只在镜中月的光里浮现，被真的星光照到就沉下去
  fill(70, 7, 74, 7, 'u');
  fill(75, 5, 77, 9, '.'); set(76, 5, 'Y');
  fill(78, 7, 83, 7, 'u'); fill(79, 4, 79, 6, 'u');
  fill(78, 2, 81, 3, ','); set(80, 2, 'Q'); set(78, 2, 'I');
  // D：月池（+35）
  ox = OD;
  fill(49, 2, 62, 12, ',');
  pts([[49, 2], [49, 3], [50, 2], [62, 2], [62, 3], [61, 2], [49, 12], [49, 11], [50, 12], [62, 12], [62, 11], [61, 12]], ' ');
  fill(49, 7, 55, 7, '.'); fill(54, 4, 60, 10, '.');
  fill(51, 9, 52, 11, '~'); fill(51, 3, 52, 5, '~');
  fill(56, 6, 58, 8, 'A');
  pts([[53, 3], [53, 11], [61, 5], [61, 9], [60, 3], [60, 11]], '#');
  pts([[51, 6], [51, 8]], 'T'); pts([[59, 2], [55, 12]], 'T');
  ox = 0;
  return g;
}
const SOLID = new Set(['#', 'M', 'H', 'D', 'F', 'G', 'Q', 'K', 'A', 'T', 'X', 'I', 'Y']);

/* ---------- 2D 遮挡：光点 → 目标的连线是否被高大的东西挡住 ---------- */
function segAABB(ax, az, bx, bz, cx, cz, h) {
  let t0 = 0, t1 = 1; const d = [bx - ax, bz - az], p = [ax, az], lo = [cx - h, cz - h], hi = [cx + h, cz + h];
  for (let i = 0; i < 2; i++) {
    if (Math.abs(d[i]) < 1e-9) { if (p[i] < lo[i] || p[i] > hi[i]) return false; continue; }
    let ta = (lo[i] - p[i]) / d[i], tb = (hi[i] - p[i]) / d[i]; if (ta > tb) [ta, tb] = [tb, ta];
    t0 = Math.max(t0, ta); t1 = Math.min(t1, tb); if (t0 > t1) return false;
  }
  return true;
}
function segCircle(ax, az, bx, bz, cx, cz, r) {
  const dx = bx - ax, dz = bz - az, L2 = dx * dx + dz * dz || 1e-9;
  const t = clamp(((cx - ax) * dx + (cz - az) * dz) / L2, 0, 1);
  return Math.hypot(ax + dx * t - cx, az + dz * t - cz) < r;
}
function segSeg(a, b, c, d) {
  const o = (p, q, r) => (q[0] - p[0]) * (r[1] - p[1]) - (q[1] - p[1]) * (r[0] - p[0]);
  return o(a, b, c) * o(a, b, d) < 0 && o(c, d, a) * o(c, d, b) < 0;
}

function tuftCanvasM(seed) {
  const c = mk(9, 7), g = c.getContext('2d'), r = TX.rng(seed), cols = ['#18283a', '#1f3546', '#2a4552', '#3a5a64', '#5a7c80'];
  const n = 3 + (r() * 3 | 0);
  for (let k = 0; k < n; k++) { let x = 1 + r() * 7; const lean = (r() - .5) * .8, h = 2 + (r() * 4 | 0); for (let y = 0; y < h; y++) { g.fillStyle = cols[Math.min(4, (y / h * 5 + (k % 2)) | 0)]; g.fillRect(Math.round(x), 6 - y, 1, 1); x += lean * .4; } }
  return c;
}

export function buildMoon(ctx) {
  const { group: root, camQuat, fx, AU, toast, cine, shake, flash, P, orb } = ctx;
  const grid = buildMap();
  const cell = (x, z) => (x < 0 || z < 0 || x >= MW || z >= MH) ? ' ' : grid[z][x];
  const isLake = c => c === ' ' || c === '%' || c === 'u';
  const L = { mist: [], sway: [], hide: [], monos: [], towers: [], q: [], reeds: [] };

  /* ================= 材质（湿润的月石：缝隙深凹、表面反光） ================= */
  const cStone = TX.moonStoneTexHD(), cMoss = TX.mossTex(), cSand = TX.sandTex(), cRuin = TX.ruinWallTex(), cRuinT = TX.ruinTopTex(), cTower = TX.towerTex();
  // 石板不做镜面倒影（倒影跟着光点晃会闪），凹凸也收弱一些
  const matStone = toon({ map: tex(cStone), normalMap: ntex(cStone, 4), normalScale: new THREE.Vector2(.9, .9), roughness: .45 });
  const matMoss = toon({ map: tex(cMoss), normalMap: ntex(cMoss, 3.5), roughness: .9 });
  const matSand = toon({ map: tex(cSand), normalMap: ntex(cSand, 4), roughness: .7 });
  const ruinS = toon({ map: tex(cRuin), normalMap: ntex(cRuin, 6), normalScale: new THREE.Vector2(1.5, 1.5), roughness: .65 });
  const ruinT = toon({ map: tex(cRuinT), normalMap: ntex(cRuinT, 3), roughness: .6, color: 0xa4a4c4 });
  const silverM = toon({ color: 0xc9cde6, roughness: .22, metalness: .85 });
  const paleM = toon({ color: 0x9ea3c8, roughness: .4 });
  const darkM = toon({ color: 0x2a2c4a, roughness: .5, metalness: .3 });

  /* ================= 地面：月石、苔岸、浅水 ================= */
  const fl = { '.': [], ',': [], '~': [] }, cliffs = [];
  for (let z = 0; z < MH; z++) for (let x = 0; x < MW; x++) {
    const c = grid[z][x]; if (isLake(c)) continue;
    let k = c === ',' || c === 'T' ? ',' : c === '~' ? '~' : '.';
    if (c === 'Q' && ((x > 59 && x < 65) || x === 80)) k = ',';
    if (c === 'K') k = ',';
    fl[k].push([x, z]);
    [[0, 1], [0, -1], [1, 0], [-1, 0]].forEach(([dx, dz]) => { if (isLake(cell(x + dx, z + dz))) cliffs.push([x, z, dx, dz]); });
  }
  const mF = (cells, mat, y) => { const m = new THREE.Mesh(quadGeo(cells, y), mat); m.receiveShadow = true; root.add(m); return m; };
  root.add(slabFloor(fl['.'], matStone, { seed: 2, jitter: 1.4, tile: 4 })); mF(fl[','], matMoss, 0); mF(fl['~'], matSand, -.16);
  const cW = TX.waterTex(), wN = ntex(cW, 2.4);
  const shallowM = reflective(toon({ color: 0x5a6aa8, normalMap: wN, transparent: true, opacity: .55, roughness: .2, metalness: .2, emissive: 0x141a40, emissiveIntensity: .4 }), .45, .45);
  const shallow = mF(fl['~'], shallowM, -.05); shallow.receiveShadow = true;
  // 浅水池边沿：一圈矮石
  root.add(cliffMesh(cliffs, toon({ map: tex(TX.cliffTex()), normalMap: ntex(TX.cliffTex(), 4), color: 0x9aa0c8, side: THREE.DoubleSide }), 1.4));

  /* ================= 夜湖（深渊） ================= */
  const lake = lakeMat();
  const lakeMesh = new THREE.Mesh(new THREE.PlaneGeometry(400, 400), lake);
  lakeMesh.rotation.x = -Math.PI / 2; lakeMesh.position.set(32, LAKE_Y, 7); root.add(lakeMesh);
  L.hide.push(lakeMesh);
  lake.uniforms.moon.value.set(57.5 + OD, 13.4, 1.5);

  /* ================= 断墙 ================= */
  const walls = [];
  for (let z = 0; z < MH; z++) for (let x = 0; x < MW; x++) if (grid[z][x] === '#') {
    const near = (x === 33 + OB || (x >= 48 && x <= 54)) ? 1 : .55 + hashv(x, z) * .6;
    walls.push([x, z, near]);
  }
  instWalls(root, walls, bevelWallGeo(1.6, 1, .06), [ruinS, ruinT]);

  /* ================= 影石（只在影子里成形的路） ================= */
  const mistT = tex(TX.mistTex());
  const mGeo = tileBevel(.94, .14); mGeo.translate(0, -.14, 0);
  for (let z = 0; z < MH; z++) for (let x = 0; x < MW; x++) if (grid[z][x] === '%') {
    const mat = reflective(toon({ map: mistT, emissive: 0xb8b0ff, emissiveIntensity: .2, transparent: true, opacity: .3, depthWrite: false, roughness: .1 }), .22);
    const m = new THREE.Mesh(mGeo, mat); m.position.set(x + .5, 0, z + .5); m.receiveShadow = true; root.add(m);
    L.mist.push({ x, z, cx: x + .5, cz: z + .5, solid: false, k: 0, last: -9, mesh: m, mat, ph: hashv(x, z) * 6 });
  }

  /* ================= 石碑（投影用） ================= */
  const monoM = toon({ map: tex(cTower), normalMap: ntex(cTower, 5), normalScale: new THREE.Vector2(1.4, 1.4), roughness: .35, color: 0xd8dcf0 });
  const addMono = (x, z) => {
    const g0 = new THREE.Group(); g0.position.set(x + .5, 0, z + .5);
    const base = new THREE.Mesh(new THREE.BoxGeometry(1, .2, 1), paleM); base.position.y = .1; g0.add(base);
    const body = new THREE.Mesh(new THREE.BoxGeometry(.8, 2.6, .8), monoM); body.position.y = 1.5; g0.add(body);
    const cap = new THREE.Mesh(new THREE.BoxGeometry(.9, .12, .9), silverM); cap.position.y = 2.86; g0.add(cap);
    // 顶上一弯新月
    const cres = new THREE.Mesh(new THREE.TorusGeometry(.26, .05, 4, 16, Math.PI * 1.3), silverM); cres.position.y = 3.2; cres.rotation.z = -Math.PI * .15; g0.add(cres);
    shadowAll(g0); root.add(g0);
    L.monos.push({ x: x + .5, z: z + .5, h: .4, g: g0, cres });
  };

  /* ================= 双塔 ================= */
  const addTower = (cx, cz) => {
    const g0 = new THREE.Group(); g0.position.set(cx, 0, cz);
    const body = new THREE.Mesh(new THREE.CylinderGeometry(1.2, 1.35, 4.4, 14), toon({ map: tex(cTower, 1), normalMap: ntex(cTower, 5), normalScale: new THREE.Vector2(1.4, 1.4), roughness: .4 }));
    body.material.map.repeat.set(3, 1); body.material.normalMap.repeat.set(3, 1);
    body.position.y = 2.2; g0.add(body);
    const ring = new THREE.Mesh(new THREE.TorusGeometry(1.3, .07, 6, 28), silverM); ring.rotation.x = Math.PI / 2; ring.position.y = 4.4; g0.add(ring);
    const roof = new THREE.Mesh(new THREE.ConeGeometry(1.42, 1.5, 10), toon({ color: 0x7c80bc, roughness: .3, metalness: .35, flatShading: true })); roof.position.y = 5.15; g0.add(roof);
    const top = new THREE.Group(); top.position.y = 6.3; g0.add(top);
    const cres = new THREE.Mesh(new THREE.TorusGeometry(.62, .12, 5, 20, Math.PI * 1.3), new THREE.MeshStandardMaterial({ color: 0xe8e6ff, roughness: .2, metalness: .6, emissive: 0xc8c4ff, emissiveIntensity: .35 })); cres.rotation.z = Math.PI * .85; top.add(cres);
    const winM = new THREE.MeshStandardMaterial({ color: 0x221a10, emissive: 0xffc98a, emissiveIntensity: .9 });
    for (let i = 0; i < 4; i++) { const a = i / 4 * Math.PI * 2 + .4; const w = new THREE.Mesh(new THREE.BoxGeometry(.18, .4, .05), winM); w.position.set(Math.cos(a) * 1.24, 2.6 + (i % 2) * .9, Math.sin(a) * 1.24); w.lookAt(Math.cos(a) * 5, w.position.y, Math.sin(a) * 5); g0.add(w); }
    shadowAll(g0); root.add(g0);
    // 塔窗透出的暖光：冷色夜里的一点暖色点缀
    const warm = new THREE.PointLight(0xffb070, 2.2, 5, 1.6); warm.position.set(cx - 1.6, 2.4, cz + (cz < 7.5 ? 1 : -1)); root.add(warm);
    L.towers.push({ x: cx, z: cz, r: 1.3, top, winM, warm });
  };

  /* ================= 犬与狼 ================= */
  const statueM = toon({ color: 0xb4b8d8, roughness: .3, metalness: .1, normalMap: ntex(cRuin, 3) });
  const eyeMat = (c) => new THREE.MeshStandardMaterial({ color: 0x111111, emissive: c, emissiveIntensity: .1 });
  // 犬与狼是玻璃雕像：平时半透明、微微泛色；被光（犬）或影子（狼）罩住时整只亮起来，犬蓝、狼紫
  const glassM = (c, e) => new THREE.MeshStandardMaterial({ color: c, roughness: .06, metalness: .15, transparent: true, opacity: .58, emissive: e, emissiveIntensity: .12, depthWrite: true });
  const addBeast = (x, z, wolf) => {
    const g0 = new THREE.Group(); g0.position.set(x + .5, 0, z + .5);
    const statueM = glassM(wolf ? 0xc9b4ff : 0xb4d4ff, wolf ? 0xa274ff : 0x5aa8ff);
    const ped = new THREE.Mesh(new THREE.BoxGeometry(.9, .35, .9), paleM); ped.position.y = .175; g0.add(ped);
    const body = new THREE.Mesh(new THREE.BoxGeometry(.42, .5, .62), statueM); body.position.set(0, .62, -.05); body.rotation.x = -.35; g0.add(body);
    const head = new THREE.Mesh(new THREE.BoxGeometry(.34, .3, .34), statueM); head.position.set(0, 1.02, .14); g0.add(head);
    const snout = new THREE.Mesh(new THREE.BoxGeometry(.18, .14, wolf ? .3 : .2), statueM); snout.position.set(0, .97 + (wolf ? .08 : 0), .38); snout.rotation.x = wolf ? -.5 : 0; g0.add(snout);
    [-1, 1].forEach(s => { const ear = new THREE.Mesh(new THREE.ConeGeometry(.07, wolf ? .26 : .16, 4), statueM); ear.position.set(s * .11, 1.24, .1); ear.rotation.z = -s * .2; g0.add(ear); });
    const tail = new THREE.Mesh(new THREE.ConeGeometry(.06, .4, 4), statueM); tail.position.set(0, .45, -.42); tail.rotation.x = wolf ? -2.2 : -1.2; g0.add(tail);
    if (wolf) head.rotation.x = -.45;
    const em = eyeMat(wolf ? 0xff8aa0 : 0xffd27a);
    [-1, 1].forEach(s => { const e = new THREE.Mesh(new THREE.BoxGeometry(.05, .05, .02), em); e.position.set(s * .08, 1.06 + (wolf ? .05 : 0), .31); g0.add(e); });
    // 犬朝南（看向庭院中心），狼朝北
    // 玻璃里的一团芯光
    const core = new THREE.Mesh(new THREE.SphereGeometry(.2, 10, 8), new THREE.MeshBasicMaterial({ color: wolf ? 0xb48cff : 0x7cc0ff, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false }));
    core.position.set(0, .78, .02); g0.add(core);
    g0.rotation.y = wolf ? Math.PI : 0;
    g0.scale.setScalar(1.45);
    shadowAll(g0); core.castShadow = false; root.add(g0);
    const glow = new THREE.PointLight(wolf ? 0xa47cff : 0x6ab4ff, 0, 3.2, 1.6); glow.position.set(x + .5, 1.2, z + .5); root.add(glow);
    return { x: x + .5, z: z + .5, g: g0, em, ok: 0, glass: statueM, core, glow };
  };

  /* ================= 月洞门（圆形石门）+ 门柱 ================= */
  const addMoonGate = (x, z0, z1) => {
    const cz = (z0 + z1 + 1) / 2;
    [z0 - 1, z1 + 1].forEach(z => { const p = new THREE.Mesh(wallGeo(3.3), [ruinS, ruinS, ruinT, ruinT, ruinS, ruinS]); p.position.set(x + .5, 0, z + .5); p.castShadow = p.receiveShadow = true; root.add(p); });
    const lintel = new THREE.Mesh(new THREE.BoxGeometry(1, .5, 5), ruinS); lintel.position.set(x + .5, 3.05, cz); lintel.castShadow = true; root.add(lintel);
    const arch = new THREE.Mesh(new THREE.TorusGeometry(1.55, .09, 6, 40), silverM); arch.rotation.y = Math.PI / 2; arch.position.set(x + .5, 1.5, cz); root.add(arch);
    const discT = tex(TX.moonDiscTex()); discT.wrapS = discT.wrapT = THREE.ClampToEdgeWrapping;
    const dm = toon({ map: discT, normalMap: ntex(TX.moonDiscTex(), 5), roughness: .35, emissive: 0xd8d0ff, emissiveMap: discT, emissiveIntensity: 0 });
    const disc = new THREE.Mesh(new THREE.CylinderGeometry(1.45, 1.45, .3, 32), [toon({ color: 0x5a5f88 }), dm, dm]);
    disc.rotation.z = Math.PI / 2; disc.position.set(x + .5, 1.5, cz); disc.castShadow = disc.receiveShadow = true; root.add(disc);
    const glowM = new THREE.MeshBasicMaterial({ color: 0xe0dcff, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false });
    const glow = new THREE.Mesh(new THREE.TorusGeometry(1.55, .16, 6, 40), glowM); glow.rotation.y = Math.PI / 2; glow.position.copy(arch.position); glow.layers.set(LAYER_FX); root.add(glow);
    L.gate = { x, z0, z1, cz, disc, dm, glow, open: 0, opening: false };
  };

  /* ================= 月相石 ================= */
  const haloT = tex(haloCanvas(64)); haloT.wrapS = haloT.wrapT = THREE.ClampToEdgeWrapping;
  const addPhase = (x, z, name) => {
    const g0 = new THREE.Group(); g0.position.set(x + .5, 0, z + .5);
    const ped = new THREE.Mesh(new THREE.CylinderGeometry(.22, .32, .7, 8), paleM); ped.position.y = .35; g0.add(ped);
    const cup = new THREE.Mesh(new THREE.TorusGeometry(.26, .04, 4, 16), silverM); cup.rotation.x = Math.PI / 2; cup.position.y = .72; g0.add(cup);
    const sm = new THREE.MeshStandardMaterial({ color: 0x8a8fb8, roughness: .25, metalness: .1, emissive: 0xe8e6ff, emissiveIntensity: .05 });
    const sphere = new THREE.Mesh(new THREE.SphereGeometry(.22, 12, 8), sm); sphere.position.y = .98; g0.add(sphere);
    const ring = new THREE.Mesh(new THREE.TorusGeometry(.36, .02, 4, 24, Math.PI * 1.2), silverM); ring.position.y = .98; g0.add(ring);
    shadowAll(g0); sphere.castShadow = false;
    const halo = billboard(haloT, 2, 2, true, camQuat); halo.position.y = .98; halo.material.color.set(0xd8d4ff); halo.material.opacity = 0; g0.add(halo);
    const light = new THREE.PointLight(0xd8dcff, 0, 6, 1.5); light.position.y = 1.1; g0.add(light);
    root.add(g0);
    const q = { x: x + .5, z: z + .5, name, on: false, t: 0, sh: 0, shy: 0, sm, sphere, ring, halo, light, g: g0 };
    L.q.push(q); return q;
  };

  /* ================= 水底之牌（XVIII 月） ================= */
  const moonCardCanvas = () => {
    const W = 24, H = 40, c = mk(W, H), g = c.getContext('2d');
    const px = (x, y, k) => { g.fillStyle = k; g.fillRect(x, y, 1, 1); };
    g.fillStyle = '#efe6d2'; g.fillRect(0, 0, W, H); g.fillStyle = '#b9bdd6'; g.fillRect(1, 1, W - 2, H - 2);
    const sky = ['#15152e', '#1d1d40', '#262652', '#303064'];
    for (let y = 2; y < 28; y++) { g.fillStyle = sky[Math.min(3, (y - 2) / 7 | 0)]; g.fillRect(2, y, W - 4, 1); }
    for (let y = 2; y < 28; y++) for (let x = 2; x < W - 2; x++) { const a = Math.hypot(x - 11.5, y - 9.5), b = Math.hypot(x - 14, y - 8); if (a < 5.5 && b > 4.5) px(x, y, a < 4 ? '#f2f0ff' : '#cfd3ea'); }
    [[11, 17], [8, 19], [15, 20], [12, 22]].forEach(([x, y]) => px(x, y, '#e6d6a8'));
    // 双塔
    g.fillStyle = '#4b4f8c'; g.fillRect(3, 16, 3, 12); g.fillRect(W - 6, 16, 3, 12); g.fillStyle = '#6a6fae'; g.fillRect(3, 15, 3, 1); g.fillRect(W - 6, 15, 3, 1);
    // 小路与水
    for (let y = 28; y < 36; y++) { g.fillStyle = y % 2 ? '#2f5684' : '#3a63a0'; g.fillRect(2, y, W - 4, 1); }
    for (let y = 24; y < 30; y++) px(11 + Math.round(Math.sin(y) * 1.5), y, '#e6d6a8');
    px(11, 33, '#e88a9a'); px(12, 33, '#e88a9a'); px(10, 34, '#e88a9a'); px(13, 34, '#e88a9a');
    g.fillStyle = '#b9bdd6'; g.fillRect(2, 36, W - 4, 2);
    [[8, 36], [8, 37], [10, 36], [10, 37], [13, 36], [13, 37], [15, 36], [15, 37]].forEach(([x, y]) => px(x, y, '#2b2a4a'));
    return c;
  };
  const addCard = (x, z) => {
    const g0 = new THREE.Group(); g0.position.set(x + .5, 0, z + .5);
    // 小石池
    const basin = new THREE.Mesh(new THREE.CylinderGeometry(.48, .52, .22, 12), paleM); basin.position.y = .11; g0.add(basin);
    const water = reflective(toon({ color: 0x3a4a90, roughness: .05, metalness: .2, emissive: 0x202a66, emissiveIntensity: .5, normalMap: wN }), .6, .6);
    const wm = new THREE.Mesh(new THREE.CircleGeometry(.42, 16), water); wm.rotation.x = -Math.PI / 2; wm.position.y = .2; g0.add(wm);
    const front = tex(moonCardCanvas()); front.wrapS = front.wrapT = THREE.ClampToEdgeWrapping;
    const fm = toon({ map: front, transparent: true, opacity: 0, emissive: 0xffffff, emissiveMap: front, emissiveIntensity: .7, side: THREE.DoubleSide });
    const cardMesh = new THREE.Mesh(new THREE.PlaneGeometry(.6, 1.0), fm);
    const holder = new THREE.Group(); holder.add(cardMesh); holder.position.y = .9; g0.add(holder);
    const halo = billboard(haloT, 2.2, 2.2, true, camQuat); halo.material.color.set(0xc0c8ff); halo.material.opacity = 0; halo.position.y = .9; g0.add(halo);
    shadowAll(basin); root.add(g0);
    L.card = { x: x + .5, z: z + .5, g: g0, holder, fm, halo, vis: 0, taken: false, front };
  };

  /* ================= 月池（祭坛）+ 从湖里升起的巨月 ================= */
  const addAltar = (cx, cz) => {
    const g0 = new THREE.Group(); g0.position.set(cx, 0, cz);
    const rim = new THREE.Mesh(new THREE.CylinderGeometry(1.45, 1.55, .35, 24, 1, true), paleM); rim.position.y = .17; g0.add(rim);
    const rimTop = new THREE.Mesh(new THREE.TorusGeometry(1.45, .07, 5, 32), silverM); rimTop.rotation.x = Math.PI / 2; rimTop.position.y = .35; g0.add(rimTop);
    const pm = reflective(toon({ color: 0x2a3a80, roughness: .15, metalness: .2, normalMap: wN, emissive: 0xc8d0ff, emissiveIntensity: 0 }), .75, .6);
    const pool = new THREE.Mesh(new THREE.CircleGeometry(1.42, 32), pm); pool.rotation.x = -Math.PI / 2; pool.position.y = .25; g0.add(pool);
    const lotusT = tex(TX.lotusCanvas(true)); lotusT.wrapS = lotusT.wrapT = THREE.ClampToEdgeWrapping;
    const ped = new THREE.Mesh(new THREE.CylinderGeometry(.18, .28, .6, 8), silverM); ped.position.y = .4; g0.add(ped);
    const slotM = toon({ transparent: true, opacity: 0, emissive: 0x9090cc, emissiveIntensity: .6 });
    const slot = new THREE.Mesh(new THREE.PlaneGeometry(.45, .75), slotM); slot.position.y = 1.2; slot.quaternion.copy(camQuat); g0.add(slot);
    // 三枚月相的位置（池边）
    const marks = [0, 1, 2].map(i => { const a = -Math.PI / 2 + (i - 1) * .9; const m = new THREE.Mesh(new THREE.SphereGeometry(.1, 8, 6), new THREE.MeshStandardMaterial({ color: 0x8a8fb8, emissive: 0xe8e6ff, emissiveIntensity: 0 })); m.position.set(Math.cos(a) * 1.45, .45, Math.sin(a) * 1.45); g0.add(m); return m; });
    shadowAll(g0); pool.castShadow = false;
    const halo = billboard(haloT, 3.6, 3.6, true, camQuat); halo.material.color.set(0xd8dcff); halo.material.opacity = 0; halo.position.y = 1.2; g0.add(halo);
    const light = new THREE.PointLight(0xe0e4ff, 0, 16, 1.2); light.position.y = 2; g0.add(light);
    root.add(g0);
    // 巨月：藏在湖面下，通关时被机关吊起来
    const big = new THREE.Group(); big.position.set(cx, -5, .6); root.add(big);
    // 巨月表面：像素月海与环形山，免得通关时只剩一团白
    const bmC = (() => { const N = 64, c = document.createElement('canvas'); c.width = c.height = N; const g = c.getContext('2d');
      g.fillStyle = '#c9cce6'; g.fillRect(0, 0, N, N);
      let sd = 7; const r = () => (sd = (sd * 16807) % 2147483647) / 2147483647;
      [['#9aa0c8', 9, 14], ['#aeb3d6', 14, 8], ['#868cb8', 5, 6]].forEach(([col, n, R]) => { g.fillStyle = col; for (let i = 0; i < n; i++) { const x = r() * N, y = r() * N, rr = R * (.4 + r() * .6); g.beginPath(); g.arc(x | 0, y | 0, rr | 0, 0, 7); g.fill(); } });
      g.fillStyle = '#e4e6f6'; for (let i = 0; i < 14; i++) { const x = r() * N | 0, y = r() * N | 0; g.fillRect(x, y, 2, 1); }
      return c; })();
    const bmT = tex(bmC); bmT.wrapS = bmT.wrapT = THREE.ClampToEdgeWrapping;
    const bmM = new THREE.MeshStandardMaterial({ color: 0xffffff, map: bmT, normalMap: ntex(bmC, 4), roughness: .7, emissive: 0xb8bce0, emissiveMap: bmT, emissiveIntensity: 0 });
    const bm = new THREE.Mesh(new THREE.CircleGeometry(2.4, 40), bmM); bm.quaternion.copy(camQuat); big.add(bm);
    const shutter = new THREE.Mesh(new THREE.CircleGeometry(2.42, 40), new THREE.MeshBasicMaterial({ color: 0x0b0b1e })); shutter.quaternion.copy(camQuat); shutter.position.set(1.6, 0, 0).applyQuaternion(new THREE.Quaternion()); big.add(shutter);
    shutter.position.add(new THREE.Vector3(0, 0, .02).applyQuaternion(camQuat));
    const frame = new THREE.Mesh(new THREE.TorusGeometry(2.7, .1, 6, 48), silverM); frame.quaternion.copy(camQuat); big.add(frame);
    [-1, 1].forEach(s => { const ch = new THREE.Mesh(new THREE.CylinderGeometry(.05, .05, 9, 5), darkM); ch.position.set(s * 2.7, 4.5, 0); big.add(ch); });
    const bigHalo = billboard(haloT, 9, 9, true, camQuat); bigHalo.material.color.set(0xc8d0ff); bigHalo.material.opacity = 0; big.add(bigHalo);
    L.altar = { x: cx, z: cz, g: g0, pm, slotM, slot, marks, halo, light, big, bmM, shutter, bigHalo, shutterX: 1.6 };
    L.hide.push(halo, bigHalo);
  };

  /* ================= 月轮：湖心轴心 + 旋转的蚀屏（会动的影子） ================= */
  const hubG = new THREE.Group(); hubG.position.set(HUB[0], 0, HUB[1]); root.add(hubG);
  {
    // 月柱：高过光点，影子能一直拖到湖心外圈的影石路上
    const pil = new THREE.Mesh(new THREE.CylinderGeometry(PILLAR_R * .86, PILLAR_R, 3.4, 12), toon({ map: tex(cTower), normalMap: ntex(cTower, 5), normalScale: new THREE.Vector2(1.4, 1.4), color: 0xb8bcd8, roughness: .35 })); pil.position.y = 1.7; hubG.add(pil);
    [.35, 1.8, 3.35].forEach(y => { const b = new THREE.Mesh(new THREE.TorusGeometry(PILLAR_R * .9, .05, 5, 20), silverM); b.rotation.x = Math.PI / 2; b.position.y = y; hubG.add(b); });
    const capM = new THREE.MeshStandardMaterial({ color: 0xe8e6ff, roughness: .2, metalness: .6, emissive: 0xc8c4ff, emissiveIntensity: .3 });
    const cap = new THREE.Mesh(new THREE.SphereGeometry(.3, 12, 8), capM); cap.position.y = 3.6; hubG.add(cap);
    const base = new THREE.Mesh(new THREE.CylinderGeometry(.7, .8, .3, 12), darkM); base.position.y = -.1; hubG.add(base);
    shadowAll(hubG);
  }
  const arm = new THREE.Group(); arm.position.set(HUB[0], 0, HUB[1]); root.add(arm);
  const hook = { g: new THREE.Group(), glow: null, ringM: null };
  {
    // 转臂：从月柱顶端伸出去，比光点高得多，不会在地上投影
    const beam = new THREE.Mesh(new THREE.BoxGeometry(HOOK_R + .9, .14, .18), silverM); beam.position.set((HOOK_R - .9) / 2 + .45, 3.55, 0); arm.add(beam);
    const cw = new THREE.Mesh(new THREE.SphereGeometry(.22, 10, 8), silverM); cw.position.set(-.55, 3.55, 0); arm.add(cw);
    const chain = new THREE.Mesh(new THREE.CylinderGeometry(.025, .025, 1.45, 4), silverM); chain.position.set(HOOK_R, 2.85, 0); arm.add(chain);
    // 月钩：一弯新月形的托架，光点挂在它的怀里
    hook.g.position.set(HOOK_R, 1.6, 0); arm.add(hook.g);
    hook.ringM = new THREE.MeshStandardMaterial({ color: 0xd8dcf0, roughness: .2, metalness: .7, emissive: 0x8ff0e0, emissiveIntensity: .25 });
    const cres = new THREE.Mesh(new THREE.TorusGeometry(.38, .045, 5, 22, Math.PI * 1.25), hook.ringM); cres.rotation.set(0, Math.PI / 2, Math.PI * 1.37); hook.g.add(cres);
    hook.glow = billboard(tex(haloCanvas(64)), 1.1, 1.1, true, camQuat); hook.glow.material.color.set(0x8ff0e0); hook.glow.material.opacity = .3; hook.g.add(hook.glow);
    shadowAll(arm, true, false); cres.castShadow = chain.castShadow = false;
  }
  // 月钩走过的轨道：一圈很淡的光环，告诉玩家「把光放在这条线上」
  const trackM = new THREE.MeshBasicMaterial({ color: 0x8ff0e0, transparent: true, opacity: .2, blending: THREE.AdditiveBlending, depthWrite: false });
  const track = new THREE.Mesh(new THREE.TorusGeometry(HOOK_R, .02, 4, 72), trackM); track.rotation.x = Math.PI / 2; track.position.set(HUB[0], 1.6, HUB[1]); track.layers.set(LAYER_FX); root.add(track);
  // 湖面上的巨大月轮（随蚀屏一起转动的舞台装置）
  const wheel = new THREE.Group(); wheel.position.set(HUB[0], LAKE_Y + .04, HUB[1]); root.add(wheel);
  {
    const wr = new THREE.Mesh(new THREE.TorusGeometry(5.6, .1, 5, 80), silverM); wr.rotation.x = Math.PI / 2; wheel.add(wr);
    const wr2 = new THREE.Mesh(new THREE.TorusGeometry(4.6, .05, 4, 80), silverM); wr2.rotation.x = Math.PI / 2; wheel.add(wr2);
    for (let i = 0; i < 8; i++) {
      const a = i / 8 * Math.PI * 2;
      const c = new THREE.Mesh(new THREE.TorusGeometry(.3, .06, 4, 14, Math.PI * (.4 + (i % 4) * .3)), silverM); c.rotation.x = -Math.PI / 2; c.rotation.z = a; c.position.set(Math.cos(a) * 5.1, 0, Math.sin(a) * 5.1); wheel.add(c);
    }
  }

  /* ================= 银柳、芦苇、睡莲 ================= */
  const leafA = tex(TX.foliageTex(['#3a3a6a', '#5a5a90', '#8a88c0', '#b9b6e0', '#e6e4fa']));
  const trunkM = toon({ color: 0xcfd2e8, roughness: .5 });
  const addWillow = (x, z) => {
    const g0 = new THREE.Group(); g0.position.set(x + .5, 0, z + .5);
    const trunk = new THREE.Mesh(new THREE.CylinderGeometry(.05, .11, 1.9, 5), trunkM); trunk.position.y = .95; trunk.rotation.z = .08; g0.add(trunk);
    const mat = toon({ map: leafA, flatShading: true, roughness: .5 });
    const dome = new THREE.Mesh(new THREE.SphereGeometry(.62, 7, 4, 0, Math.PI * 2, 0, Math.PI / 2), mat); dome.position.y = 1.85; dome.scale.y = .75; g0.add(dome);
    const strands = new THREE.Group(); strands.position.y = 1.86; g0.add(strands);
    const sm = [toon({ color: 0xa9a6d8, roughness: .5 }), toon({ color: 0xd8d6f2, roughness: .45 }), toon({ color: 0x7a78b0, roughness: .6 })];
    for (let i = 0; i < 16; i++) {
      const a = i / 16 * Math.PI * 2 + hashv(x, i) * .3, rr = .5 + hashv(i, z) * .14, len = .8 + hashv(z + i, x) * .6;
      const s = new THREE.Mesh(new THREE.BoxGeometry(.06, len, .06), sm[i % 3]); s.position.set(Math.cos(a) * rr, -len / 2, Math.sin(a) * rr); strands.add(s);
    }
    g0.rotation.y = hashv(z, x) * 6.28; shadowAll(g0); root.add(g0);
    L.sway.push({ o: strands, ph: hashv(x, z) * 6 });
  };
  // 芦苇、睡莲、苔草：挤出厚度的像素画（体素），和角色同一种做法
  const vm = voxMat();
  const reedCs = [1, 2, 3].map(s => TX.reedCanvas(s * 17)), lotusCs = [false, true].map(o => TX.lotusCanvas(o));
  const reedP = [[], [], []], lotusP = [[], []], mossP = [[], []];
  const rr = TX.rng(31);
  for (let z = 0; z < MH; z++) for (let x = 0; x < MW; x++) {
    const c = grid[z][x];
    // 芦苇长在岸边和浅水边
    if ((c === ',' || c === '~') && [[0, 1], [0, -1], [1, 0], [-1, 0]].some(([dx, dz]) => cell(x + dx, z + dz) === ' ') && rr() < .55) {
      reedP[rr() * 3 | 0].push(place(x + .2 + rr() * .6, c === '~' ? -.05 : 0, z + .2 + rr() * .6, (rr() - .5) * .9, .25));
    }
    // 睡莲漂在湖面
    if (c === ' ' && rr() < .05 && x > 1 && x < MW - 2) { const ok = [[0, 1], [0, -1], [1, 0], [-1, 0]].some(([dx, dz]) => !' %'.includes(cell(x + dx, z + dz))); if (ok) lotusP[rr() < .4 ? 1 : 0].push(place(x + .5, LAYER_Y(), z + .5 - .25, rr() * 6, Math.PI / 2)); }
    if (c === '~' && rr() < .25) lotusP[rr() < .5 ? 1 : 0].push(place(x + .5, -.04, z + .5 - .25, rr() * 6, Math.PI / 2));
    // 苔岸上的一簇簇矮草
    if (c === ',') { const nt = rr() < .7 ? 1 + (rr() * 2 | 0) : 0; for (let k = 0; k < nt; k++) mossP[rr() * 2 | 0].push(place(x + .1 + rr() * .8, 0, z + .1 + rr() * .8, (rr() - .5) * 1.2, .2, .8 + rr() * .4)); }
  }
  function LAYER_Y() { return LAKE_Y + .02; }
  reedCs.forEach((c, i) => root.add(voxelBatch(c, reedP[i], vm, { maxT: .06, minT: .045, slope: .01 })));
  lotusCs.forEach((c, i) => root.add(voxelBatch(c, lotusP[i], vm, { maxT: .08, minT: .04, slope: .02 })));
  [21, 22].forEach((s, i) => root.add(voxelBatch(tuftCanvasM(s), mossP[i], vm, { maxT: .06, minT: .05, slope: 0 })));

  // 小龙虾（月亮牌里从水中爬出的那只）：在月池旁的浅水里来回走
  const crayC = mk(12, 8); { const g = crayC.getContext('2d'); const px = (x, y, k) => { g.fillStyle = k; g.fillRect(x, y, 1, 1); };
    [[2, 2], [3, 3], [8, 3], [9, 2], [3, 4], [8, 4]].forEach(([x, y]) => px(x, y, '#e88a9a'));
    for (let x = 4; x <= 7; x++) for (let y = 3; y <= 6; y++) px(x, y, y === 3 ? '#f6b8bc' : '#c76a80');
    px(5, 7, '#a85a72'); px(6, 7, '#a85a72'); px(4, 2, '#2b2a4a'); px(7, 2, '#2b2a4a'); px(1, 1, '#e88a9a'); px(10, 1, '#e88a9a'); }
  const crayT = tex(crayC); crayT.wrapS = crayT.wrapT = THREE.ClampToEdgeWrapping;
  const cray = new THREE.Group(); cray.add(voxelBatch(crayC, [place(0, 0, 0, 0, .35)], vm, { maxT: .12, minT: .06, slope: .03 })); root.add(cray);

  /* ================= 月光从云缝里落下的光柱 ================= */
  [[4.6, 7.4, 1.7], [22.4 + OB, 8.6, 1.5], [51.4, 7.5, 1.4], [46.5 + OC, 7.4, 1.3], [54.6 + OD, 7.5, 1.5]].forEach(([x, z, r]) => lightShaft(root, x, z, { color: 0xd8e0ff, r, I: 11, k: .4, lean: [.3, -.42], hide: L.hide }));

  /* ================= R · 幻墙回廊：回廊石柱（挡光）与幻墙（星光照到就溶解） ================= */
  const pillars = [], ill = [];
  const pillarM = toon({ map: tex(cTower), normalMap: ntex(cTower, 5), normalScale: new THREE.Vector2(1.4, 1.4), roughness: .35, color: 0xd0d4ec });
  for (let z = 0; z < MH; z++) for (let x = 0; x < MW; x++) {
    const c = grid[z][x];
    if (c === 'I') {
      const g0 = new THREE.Group(); g0.position.set(x + .5, 0, z + .5); root.add(g0);
      const inLake = isLake(cell(x - 1, z)) && isLake(cell(x + 1, z));
      if (inLake) { const pl = new THREE.Mesh(new THREE.CylinderGeometry(.62, .7, 1.2, 10), paleM); pl.position.y = -.55; g0.add(pl); }
      const base = new THREE.Mesh(new THREE.BoxGeometry(.92, .22, .92), paleM); base.position.y = .11; g0.add(base);
      const sh = new THREE.Mesh(new THREE.CylinderGeometry(.36, .42, 2.5, 12), pillarM); sh.position.y = .22 + 1.25; g0.add(sh);
      const cap = new THREE.Mesh(new THREE.BoxGeometry(.9, .16, .9), silverM); cap.position.y = 2.8; g0.add(cap);
      const cres = new THREE.Mesh(new THREE.TorusGeometry(.24, .045, 4, 14, Math.PI * 1.3), silverM); cres.position.y = 3.15; cres.rotation.z = -Math.PI * .15; g0.add(cres);
      shadowAll(g0); pillars.push({ x: x + .5, z: z + .5, r: .5, g: g0, cres });
    } else if (c === '&') {
      const m0 = ruinS.clone(), m1 = ruinT.clone();
      [m0, m1].forEach(m => { m.transparent = true; m.emissive = new THREE.Color(0xb8a8ff); m.emissiveIntensity = .06; });
      const m = new THREE.Mesh(bevelWallGeo(1.6, 1, .05), [m0, m1]); m.position.set(x + .5, 0, z + .5); m.castShadow = m.receiveShadow = true; root.add(m);
      ill.push({ x, z, cx: x + .5, cz: z + .5, m, mats: [m0, m1], k: 1, last: -9, ph: hashv(x, z) * 6 });
    }
  }
  /* ================= T · 镜中月：月镜、镜线、镜中月与镜月石 =================
     月镜立在湖心小岛北侧，镜面所在的那条线叫镜线。星光在镜线一侧，镜中月就出现在另一侧的对称位置。
     湖上的镜月石只在镜中月的光里浮现，真的星光照上去反而会沉。站在镜旁按 E，月镜转 45°，镜线跟着转 */
  const mirror = new THREE.Group(); mirror.position.set(MIR[0], 0, MIR[1]); root.add(mirror);
  const mirM = new THREE.MeshStandardMaterial({ color: 0xc8ccf0, roughness: .08, metalness: .9, emissive: 0xe0c8ff, emissiveIntensity: .15 });
  {
    [-1, 1].forEach(sx => { const post = new THREE.Mesh(new THREE.CylinderGeometry(.07, .09, 2.4, 6), silverM); post.position.set(sx * 1.0, 1.2, 0); mirror.add(post);
      const fin = new THREE.Mesh(new THREE.SphereGeometry(.12, 8, 6), silverM); fin.position.set(sx * 1.0, 2.46, 0); mirror.add(fin); });
    const base = new THREE.Mesh(new THREE.BoxGeometry(2.3, .2, .6), paleM); base.position.y = .1; mirror.add(base);
    const disc = new THREE.Mesh(new THREE.CylinderGeometry(.9, .9, .08, 32), [silverM, mirM, silverM]); disc.rotation.x = Math.PI / 2; disc.position.set(0, 1.35, .02); mirror.add(disc);
    const frame = new THREE.Mesh(new THREE.TorusGeometry(.92, .06, 5, 40), silverM); frame.position.set(0, 1.35, .02); mirror.add(frame);
    const cres = new THREE.Mesh(new THREE.TorusGeometry(.3, .05, 4, 16, Math.PI * 1.3), silverM); cres.position.set(0, 2.55, 0); cres.rotation.z = Math.PI * .85; mirror.add(cres);
    shadowAll(mirror);
  }
  // 潮池的石沿：低矮的白石边框，让涨起的潮水有清楚的边界
  {
    const curb = (x0, z0, x1, z1) => { const w = x1 - x0 || .22, d = z1 - z0 || .22; const m = new THREE.Mesh(bevelBox(w, .16, d, .04), paleM); m.position.set((x0 + x1) / 2, LAKE_Y + .36, (z0 + z1) / 2); m.receiveShadow = m.castShadow = true; root.add(m); };
    curb(70, 1.5, 84, 1.5); curb(70, 10.8, 84, 10.8);
    curb(70, 1.5, 70, 6); curb(70, 9, 70, 10.8);
    [[70, 1.5], [84, 1.5], [70, 10.8], [84, 10.8], [70, 6], [70, 9]].forEach(([x, z]) => { const m = new THREE.Mesh(new THREE.CylinderGeometry(.16, .2, .5, 8), paleM); m.position.set(x, LAKE_Y + .5, z); m.castShadow = true; root.add(m); });
  }
  // 镜线：从月镜两侧向外延伸的一道柔光，越远越淡、越细，表面有光缓缓向外流（不是虚线）
  // 光束着色器：u 沿长度 0..1，v 横向 -1..1；mode 0 = 镜线（中间亮、两端渐隐），1 = 牵引光（两端亮、中段淡）
  const beamMat = (color, mode) => new THREE.ShaderMaterial({
    uniforms: { uCol: { value: new THREE.Color(color) }, uK: { value: 0 }, uT: { value: 0 }, uLen: { value: 1 } },
    vertexShader: `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.); }`,
    fragmentShader: `uniform vec3 uCol; uniform float uK, uT, uLen; varying vec2 vUv;
      void main(){
        float u = vUv.x, v = abs(vUv.y * 2. - 1.);
        float a;
        if (${mode}. < .5) {
          float d = abs(u * 2. - 1.);                     // 离镜子的距离 0..1
          float near = smoothstep(.07, .16, d);            // 镜子本身那一段留空
          float fall = pow(1. - d, 1.6);                   // 向外渐隐
          float w = mix(.55, .12, d);                      // 越远越细
          float core = smoothstep(w, w * .25, v);
          float flow = .75 + .25 * sin(d * uLen * 2.2 - uT * 2.4);   // 光沿镜线向外流
          a = core * fall * near * flow;
        } else {
          float ends = max(exp(-u * uLen * 1.4), exp(-(1. - u) * uLen * 1.4));
          float pulse = smoothstep(.35, 0., abs(fract(u - uT * .35) - .5) * 2. - .65) * .35;
          float core = smoothstep(.9, .15, v);
          a = core * (ends * .8 + .15 + pulse);
        }
        a *= uK; if (a < .003) discard;
        gl_FragColor = vec4(uCol * a, 1.);
      }`,
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide
  });
  const AXIS_HALF = 6.5;
  const axisM = beamMat(0xd8c8ff, 0); axisM.uniforms.uLen.value = AXIS_HALF;
  const axisG = new THREE.Group(); axisG.position.set(MIR[0], LAKE_Y + .035, MIR[1]); root.add(axisG);
  { const m = new THREE.Mesh(new THREE.PlaneGeometry(AXIS_HALF * 2, .16), axisM); m.rotation.x = -Math.PI / 2; m.layers.set(LAYER_FX); axisG.add(m); }
  L.hide.push(axisG);
  // 镜中月：星光的倒影。偏紫的一团光，带一盏不投影的灯
  const PHC = 0xd0a8ff;
  const ph = { x: 0, z: 0, k: 0, g: new THREE.Group() }; root.add(ph.g);
  ph.sm = new THREE.MeshStandardMaterial({ color: 0xe8dcff, roughness: .3, emissive: PHC, emissiveIntensity: 1.6 });
  ph.core = new THREE.Mesh(new THREE.OctahedronGeometry(.13, 0), ph.sm); ph.core.scale.set(.8, 1.25, .8); ph.g.add(ph.core);
  ph.halo = billboard(haloT, 2.2, 2.2, true, camQuat); ph.halo.material.color.set(PHC); ph.halo.material.opacity = 0; ph.g.add(ph.halo); L.hide.push(ph.halo);
  ph.light = new THREE.PointLight(PHC, 0, 5.5, 1.3); ph.g.add(ph.light);
  ph.poolM = new THREE.MeshBasicMaterial({ map: haloT, color: PHC, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false });
  ph.pool = new THREE.Mesh(new THREE.PlaneGeometry(4.6, 4.6), ph.poolM); ph.pool.rotation.x = -Math.PI / 2; ph.pool.layers.set(LAYER_FX); root.add(ph.pool); L.hide.push(ph.pool);
  // 星光 → 镜中月：一缕细细的牵引光，两端亮、中段淡，有光点从星光流向倒影
  const linkM = beamMat(0xd8c8ff, 1);
  const link = new THREE.Mesh(new THREE.PlaneGeometry(1, .09), linkM); link.layers.set(LAYER_FX); link.frustumCulled = false; root.add(link); L.hide.push(link);
  // 镜月石
  const moonStones = [];
  for (let z = 0; z < MH; z++) for (let x = 0; x < MW; x++) if (grid[z][x] === 'u') {
    const mat = reflective(toon({ map: mistT, color: 0xe8e0ff, emissive: PHC, emissiveIntensity: .2, transparent: true, opacity: .2, depthWrite: false, roughness: .12 }), .25);
    const m = new THREE.Mesh(mGeo, mat); m.position.set(x + .5, 0, z + .5); m.receiveShadow = true; root.add(m);
    moonStones.push({ x, z, cx: x + .5, cz: z + .5, k: 0, last: -9, solid: false, mesh: m, mat, ph: hashv(x, z) * 6 });
  }
  const msAt = (x, z) => moonStones.find(m => m.x === x && m.z === z);

  /* ================= 遍历摆放 ================= */
  const beasts = {};
  for (let z = 0; z < MH; z++) for (let x = 0; x < MW; x++) {
    const c = grid[z][x];
    if (c === 'M') addMono(x, z);
    else if (c === 'T') addWillow(x, z);
    else if (c === 'D') beasts.dog = addBeast(x, z, false);
    else if (c === 'F') beasts.wolf = addBeast(x, z, true);
    else if (c === 'K') addCard(x, z);
  }
  addTower(31.5 + OB, 3.5); addTower(31.5 + OB, 11.5);
  addMoonGate(33 + OB, 6, 8);
  const qA = addPhase(6, 3, '蛾眉'), qC = addPhase(41 + OC, 1, '凸月'), qD = addPhase(53, 3, '盈月'), qE = addPhase(80, 2, '待宵');
  const qB = { x: 25.5 + OB, z: 7.5, name: '上弦', on: false, t: 0, virtual: true };
  addAltar(57.5 + OD, 7.5);
  const { gate, card, altar } = L; const dog = beasts.dog, wolf = beasts.wolf;
  const mono = (x, z) => L.monos.find(m => m.x === x + .5 && m.z === z + .5);

  /* ================= 遮挡与光照判定 ================= */
  let armA = Math.PI;
  // armA 是月柱影子所指的方向；月钩（光）在它的正对面
  const hookX = () => HUB[0] - Math.cos(armA) * HOOK_R, hookZ = () => HUB[1] - Math.sin(armA) * HOOK_R;
  // 会动的「插槽」：光点停在月钩经过的地方，月钩转到时把它挂走
  const sockets = [{ get x() { return hookX(); }, get z() { return hookZ(); }, y: 1.6, r: .55, active: () => !S.done,
    onLock() { S.hubUsed = true; AU.lamp(0); const x = hookX(), z = hookZ(); fx.ring(x, 1.6, z, 0x8ff0e0, 1.6, .9); fx.ring(HUB[0], .05, HUB[1], 0x8ff0e0, 3.2, 1.2); fx.sigil(HUB[0], .06, HUB[1], 0x8ff0e0, 'moon', 3, 1.8); flash(.15); shake(.04, .3);
      if (!S.hints.lock) { S.hints.lock = 1; } } }];
  function occluded(ax, az, bx, bz) {
    for (const m of L.monos) { if (Math.abs(ax - m.x) < .45 && Math.abs(az - m.z) < .45) continue; if (segAABB(ax, az, bx, bz, m.x, m.z, .4)) return true; }
    for (const t of L.towers) { if (Math.hypot(ax - t.x, az - t.z) < t.r) continue; if (segCircle(ax, az, bx, bz, t.x, t.z, t.r)) return true; }
    if (Math.hypot(ax - HUB[0], az - HUB[1]) > PILLAR_R && segCircle(ax, az, bx, bz, HUB[0], HUB[1], PILLAR_R)) return true;
    for (const p of pillars) { if (Math.hypot(ax - p.x, az - p.z) < p.r) continue; if (segCircle(ax, az, bx, bz, p.x, p.z, p.r)) return true; }
    if (Math.hypot(ax - MIR[0], az - MIR[1]) > .7 && segCircle(ax, az, bx, bz, MIR[0], MIR[1], .7)) return true;
    return false;
  }
  const inRange = (x, z) => Math.hypot(x - orb.x, z - orb.z) < LIT_R;
  const litAt = (x, z) => inRange(x, z) && !occluded(orb.x, orb.z, x, z);
  const shadowedAt = (x, z) => inRange(x, z) && occluded(orb.x, orb.z, x, z);
  const phLit = q => ph.k > .5 && Math.hypot(q.x - ph.x, q.z - ph.z) < 2.6;

  /* ================= 引导微光 ================= */
  const LILAC = [.85, .82, 1], CORALc = [1, .6, .7], SILVER = [.86, .9, 1];
  const B = {
    qA: fx.beacon(qA.x, 1.0, qA.z, 0xc8b8ff, 1.2), qC: fx.beacon(qC.x, 1.0, qC.z, 0xc8b8ff, 1.2),
    dog: fx.beacon(dog.x, 1.3, dog.z, 0x8cc4ff, .9), wolf: fx.beacon(wolf.x, 1.3, wolf.z, 0xb898ff, .9),
    m1: fx.beacon(11.5, 3.3, 7.5, 0x9fe0ff, .8), m3: fx.beacon(25.5 + OB, 3.3, 7.5, 0x9fe0ff, .8), m2: fx.beacon(19.5 + OB, 3.3, 7.5, 0x9fe0ff, .8),
    qD: fx.beacon(qD.x, 1.0, qD.z, 0xc8b8ff, 1.2), qE: fx.beacon(qE.x, 1.0, qE.z, 0xc8b8ff, 1.2), tide: fx.beacon(MIR[0], 2.7, MIR[1], 0xd8c8ff, 1.1),
    hub: fx.beacon(HUB[0], 1.6, HUB[1], 0x8ff0e0, 1.3),
    card: fx.beacon(card.x, .5, card.z, 0x9fb4ff, 1),
    altar: fx.beacon(altar.x, 1.0, altar.z, 0xd8dcff, 1.6)
  };

  /* ================= 状态 ================= */
  const S = { phases: 0, gotCard: false, done: false, hints: {}, trail: 0, hubUsed: false, beastHold: 0, solvedB: false, crownHit: false, moonUp: false, mirA: 0, mirT: 0 };
  const illAt = (x, z) => ill.find(w => w.x === x && w.z === z);

  function wakePhase(q) {
    q.on = true; S.phases++; AU.lamp(S.phases - 1);
    if (!q.virtual) {
      fx.bloom(q.x, 1, q.z, 44, SILVER, { w: -2.8, vr: 2, up: .7 });
      fx.ring(q.x, .04, q.z, 0xd8d4ff, 3.2, 1.2); setTimeout(() => fx.ring(q.x, .04, q.z, 0xd8d4ff, 2, 1), 200);
      fx.sigil(q.x, .05, q.z, 0xe0dcff, 'moon', 2.8, 2.2, { spin: -2 });
      fx.sigil(q.x, 1, q.z, 0xffffff, 'moon', 1.3, 1.6, { flat: false, spin: -3 });
    }
    flash(.22); shake(.05, .3);
    ctx.updateHud();
  }

  function solveBeasts() {
    S.solvedB = true; B.dog.on = B.wolf.on = B.m3.on = false;
    AU.lamp(1);
    const gx = gate.x + .1, gz = gate.cz;
    cine([
      { dur: 1.4, focus: [26.5 + OB, 7.5], start() { flash(.2); fx.bloom(dog.x, 1.1, dog.z, 30, [.55, .76, 1], { w: 2.4, vr: 1.4 }); fx.bloom(wolf.x, 1.1, wolf.z, 30, [.74, .56, 1], { w: -2.4, vr: 1.4 }); AU.howl && AU.howl(); },
        run(k, dt) { [dog, wolf].forEach((b, i) => { if (Math.random() < dt * 26) { const t = Math.random() * k; fx.emit(b.x + (gx - b.x) * t, 1 + Math.sin(t * 3) * .5, b.z + (gz - b.z) * t, { vy: .2, life: .9, c: i ? [.74, .56, 1] : [.55, .76, 1], tw: 8 }); } }); } },
      { dur: 1.4, focus: [gx - 3, gz], start() { AU.stone(); shake(.1, .5); },
        run(k) { L.towers.forEach((t, i) => { t.top.rotation.y = (i ? -1 : 1) * easeBack(k) * Math.PI * .5; t.winM.emissiveIntensity = .9 + k * 2; }); gate.glow.material.opacity = k * .9; gate.dm.emissiveIntensity = k * .6; } },
      { dur: 3, focus: [gx - 3, gz], start() { gate.opening = true; AU.stone(); },
        run(k, dt) { if (Math.random() < dt * 3) AU.stone(); shake(.07, .2); gate.glow.material.opacity = .9 - k * .5; } },
      { dur: .9, focus: [gx - 3, gz], start() { wakePhase(qB); fx.sigil(25.5 + OB, .05, 7.5, 0xe0dcff, 'moon', 4.4, 2.4); fx.ring(gx - .5, .05, gz, 0xd8d4ff, 4, 1.3); toast(`上弦。月洞门开了　${S.phases} / 5`, 3.6); } }
    ]);
  }

  function reset() {
    Object.assign(S, { phases: 0, gotCard: false, done: false, hints: {}, trail: 0, hubUsed: false, beastHold: 0, solvedB: false, crownHit: false, moonUp: false, mirA: 0, mirT: 0 });
    moonStones.forEach(m => { m.k = 0; m.last = -9; m.solid = false; }); ph.k = 0;
    ill.forEach(w => { w.k = 1; w.last = -9; w.open = false; });
    L.q.forEach(q => { q.on = false; q.t = 0; q.sh = 0; q.shy = 0; }); qB.on = false;
    L.mist.forEach(m => { m.solid = false; m.k = 0; m.last = -9; });
    Object.assign(gate, { open: 0, opening: false }); gate.glow.material.opacity = 0; gate.dm.emissiveIntensity = 0; gate.disc.position.y = 1.5; gate.disc.rotation.x = 0;
    L.towers.forEach(t => { t.top.rotation.y = 0; t.winM.emissiveIntensity = .9; });
    Object.assign(card, { vis: 0, taken: false }); card.g.visible = true;
    altar.slotM.opacity = 0; altar.light.intensity = 0; altar.halo.material.opacity = 0; altar.pm.emissiveIntensity = 0; altar.marks.forEach(m => m.material.emissiveIntensity = 0);
    altar.big.position.y = -5; altar.bmM.emissiveIntensity = 0; altar.bigHalo.material.opacity = 0; altar.shutter.position.x = altar.shutterX;
    armA = Math.PI;
    Object.values(B).forEach(b => b.on = true);
    lake.uniforms.trail.value = 0; lake.uniforms.spin.value = 0; lake.uniforms.glow.value = 0; lake.uniforms.phase.value = .25;
    ctx.hemi.color.set(0x8a90d0);
  }

  function update(dt, T) {
    // 月轮转动
    armA += dt * Math.PI * 2 / ARM_PERIOD;
    arm.rotation.y = -(armA + Math.PI); wheel.rotation.y = -armA * .5;
    const held = orb.lock === sockets[0];
    hook.ringM.emissiveIntensity = held ? 1.2 : .25 + .15 * Math.sin(T * 2.4);
    hook.glow.material.opacity = held ? 0 : .3 + .12 * Math.sin(T * 2.4);
    trackM.opacity = held || S.done ? Math.max(0, trackM.opacity - dt * .5) : .2 + .06 * Math.sin(T * 1.6);
    // 影石：在影子里（或星光照不到的地方）是实的；被星光照到就成了幻影
    L.mist.forEach(m => {
      // 只有星光投下的影子才是真的：光点离得太远，整片湖面都在月光下，影石也只是幻影
      // 取格子中心和四个角附近的点：只要有一处在影子里，这块月石就成形（对玩家宽容一点）
      const solid = shadowedAt(m.cx, m.cz) || shadowedAt(m.cx - .3, m.cz - .3) || shadowedAt(m.cx + .3, m.cz - .3) || shadowedAt(m.cx - .3, m.cz + .3) || shadowedAt(m.cx + .3, m.cz + .3);
      if (solid) m.last = T;
      if (solid && !m.solid && m.k < .3 && Math.hypot(P.x - m.cx, P.z - m.cz) < 6) { if (Math.random() < .5) AU.ghost(); fx.emit(m.cx, .05, m.cz, { vy: .3, life: .7, c: LILAC, tw: 6, a: .8 }); }
      m.solid = solid;
      m.k += ((solid ? 1 : 0) - m.k) * (1 - Math.exp(-dt * (solid ? 10 : 6)));
      const k = m.k, flick = .5 + .5 * Math.sin(T * 2.2 + m.ph);   // 慢慢呼吸，不要快闪
      m.mat.opacity = .16 + k * .8 + (1 - k) * flick * .08;
      m.mat.emissive.setRGB(.72 + (1 - k) * .28, .7 - (1 - k) * .2, 1 - (1 - k) * .35);
      m.mat.emissiveIntensity = .08 + k * .16 + (1 - k) * flick * .3;
      m.mat.userData.reflK.value = .1 + k * .3;
      m.mesh.position.y = -.18 * (1 - k); m.mesh.scale.set(.75 + k * .25, .4 + k * .6, .75 + k * .25);
    });
    // 月相石
    L.q.forEach((q, i) => {
      if (q.on) q.t = Math.min(1, q.t + dt * .7);
      const kk = smooth(0, 1, q.t);
      // 还没醒的月相石落进影子里，会自己微微发紫光：不用文字，石头自己说「就是这里」
      const ready = !q.on && (q === qE ? phLit(q) && !litAt(q.x, q.z) : shadowedAt(q.x, q.z));
      q.sh += ((ready ? 1 : 0) - q.sh) * (1 - Math.exp(-dt * 3));
      q.shy = Math.max(0, q.shy - dt);
      const s = q.sh * (1 - kk) * (1 + Math.sin(T * 2.4 + i) * .22);
      q.sm.emissive.setRGB(.58 + kk * .33, .3 + kk * .6, 1);
      q.sm.emissiveIntensity = .05 + s * .7 + kk * 2.2; q.sm.color.setRGB(.54 + kk * .4 + s * .04, .56 + kk * .4 - s * .14, .72 + kk * .28 + s * .1);
      q.light.color.setRGB(.6 + kk * .25, .36 + kk * .5, 1);
      q.light.intensity = kk * 6 + s * 1.5; q.halo.material.opacity = kk * .5 + s * .3;
      q.halo.material.color.setRGB(.66 + kk * .19, .4 + kk * .43, 1);
      // 被星光照着时缩一缩、轻轻发抖；唤醒失败时抖得更明显
      const tr = (!q.on && litAt(q.x, q.z) ? .25 : 0) + q.shy * 2;
      q.sphere.position.set(Math.sin(T * 37 + i) * .012 * tr, .98 - tr * .02, Math.cos(T * 31 + i) * .008 * tr);
      q.ring.rotation.y += dt * (.4 + kk * 1.5 + s * .8);
      if (s > .45 && Math.random() < dt * 3) fx.emit(q.x + (Math.random() - .5) * .35, .9, q.z + (Math.random() - .5) * .35, { vy: .3, life: 1.4, c: [.68, .45, 1], tw: 5, a: .8 });
      if (kk > .5 && Math.random() < dt * 5) fx.emit(q.x + (Math.random() - .5) * .3, 1, q.z + (Math.random() - .5) * .3, { vy: .45, life: 1.6, c: SILVER, tw: 6 });
    });
    // 犬与狼：眼睛分别亮起
    // 犬只认近处、面前的星光：光点要在它前方 3 格以内（以前整片都能把它点亮，太容易误触）
    const dogOk = !S.solvedB && litAt(dog.x, dog.z) && orb.z - dog.z > .35 && Math.hypot(orb.x - dog.x, orb.z - dog.z) < 3;
    const wolfOk = !S.solvedB && shadowedAt(wolf.x, wolf.z);
    dog.ok += ((dogOk || S.solvedB ? 1 : 0) - dog.ok) * (1 - Math.exp(-dt * 6));
    wolf.ok += ((wolfOk || S.solvedB ? 1 : 0) - wolf.ok) * (1 - Math.exp(-dt * 6));
    dog.em.emissiveIntensity = .1 + dog.ok * 3; wolf.em.emissiveIntensity = .1 + wolf.ok * 3;
    [dog, wolf].forEach((b, i) => { const k = b.ok, pul = 1 + Math.sin(T * 3 + i) * .08 * k;
      b.glass.emissiveIntensity = (.12 + k * 1.5) * pul; b.glass.opacity = .58 + k * .2;
      b.core.material.opacity = k * .55 * pul; b.glow.intensity = k * 1.4 * pul; });
    S._dogOk = dogOk; S._wolfOk = wolfOk;
    // 月洞门
    if (gate.opening && gate.open < 1) {
      const pv = gate.open; gate.open = Math.min(1, gate.open + dt * .36);
      gate.disc.rotation.x += dt * 1.4;
      if (Math.random() < dt * 34) fx.emit(gate.x + .5 + (Math.random() - .5) * .8, .1, gate.z0 + Math.random() * 3, { vy: .5, vx: (Math.random() - .5), life: .8, c: [.6, .6, .75], a: .6 });
      if (pv < 1 && gate.open >= 1) { shake(.1, .4); AU.stone(); }
    }
    gate.disc.position.y = 1.5 - (gate.open * gate.open * (3 - 2 * gate.open)) * 3.05;
    // 水底之牌：只在影子里浮现
    if (!card.taken) {
      const pv = card.vis, hid = !litAt(card.x, card.z);
      card.vis = clamp(card.vis + (hid ? dt * 2.2 : -dt * 1.6), 0, 1);
      if (pv < .5 && card.vis >= .5) { fx.sigil(card.x, .22, card.z, 0xc0c8ff, 'moon', 1.8, 1.4); AU.ghost(); }
      card.fm.opacity = card.vis; card.halo.material.opacity = card.vis * .5;
      card.holder.rotation.y += dt * 1.1; card.holder.position.y = .55 + card.vis * .4 + Math.sin(T * 1.8) * .06;
    }
    // 幻墙：被星光照到（墙的任意一边）就溶解；离开星光 0.35 秒后重新凝成
    ill.forEach(w => {
      const lit = litAt(w.cx, w.cz) || litAt(w.cx - .42, w.cz) || litAt(w.cx + .42, w.cz) || litAt(w.cx, w.cz - .42) || litAt(w.cx, w.cz + .42);
      if (lit) w.last = T;
      const open = T - w.last < .35, pk = w.k;
      w.k += ((open ? 0 : 1) - w.k) * (1 - Math.exp(-dt * (open ? 9 : 5)));
      if (pk > .6 && w.k <= .6 && Math.hypot(P.x - w.cx, P.z - w.cz) < 9) { AU.ghost(); fx.burst(w.cx, .8, w.cz, 8, { c: LILAC, sp: .7, life: .8, up: .5 }); }
      const flick = .5 + .5 * Math.sin(T * 7 + w.ph);
      w.mats.forEach(m => { m.opacity = .08 + w.k * .92; m.emissiveIntensity = .05 + (1 - w.k) * (.45 + flick * .3) + Math.sin(T * 1.3 + w.ph) * .03; });
      w.m.scale.set(1, .2 + w.k * .8, 1);
      if (open && Math.random() < dt * 5) fx.emit(w.cx + (Math.random() - .5) * .8, Math.random() * 1.2, w.cz + (Math.random() - .5) * .8, { vy: .5, life: .9, c: LILAC, tw: 8, a: .7 });
      w.open = open;
    });
    // 月镜：缓缓转到目标角度；人离开镜湖时自己转回东西向
    if ((P.x < 69.6 || P.x > 84.4) && !S.done) S.mirT = Math.round(S.mirT / Math.PI) * Math.PI;
    const pa = S.mirA; S.mirA += (S.mirT - S.mirA) * (1 - Math.exp(-dt * 4));
    if (Math.abs(S.mirT - S.mirA) < .002) S.mirA = S.mirT;
    mirror.rotation.y = -S.mirA; axisG.rotation.y = -S.mirA;
    if (Math.abs(S.mirA - pa) > dt * .05 && Math.random() < dt * 20) fx.emit(MIR[0] + (Math.random() - .5) * 2, .2, MIR[1] + (Math.random() - .5) * .6, { vy: .3, vx: (Math.random() - .5), life: .7, c: [.6, .58, .75], a: .6 });
    // 镜中月：星光关于镜线的对称点
    const mOn = !S.done && P.x > 68.5 && P.x < 85.5 ? 1 : 0;
    ph.k += (mOn - ph.k) * (1 - Math.exp(-dt * 3));
    { const dx = Math.cos(S.mirA), dz = Math.sin(S.mirA), vx = orb.x - MIR[0], vz = orb.z - MIR[1], d = vx * dx + vz * dz;
      ph.x = MIR[0] + 2 * d * dx - vx; ph.z = MIR[1] + 2 * d * dz - vz; }
    ph.g.position.set(ph.x, orb.y, ph.z); ph.core.visible = ph.halo.visible = ph.k > .02;   // 灯本身一直在（只调亮度），灯数不变就不会重编着色器
    ph.core.rotation.y += dt * 2;
    ph.light.intensity = ph.k * (3.2 + Math.sin(T * 2.3) * .2);
    ph.halo.material.opacity = ph.k * (.42 + Math.sin(T * 2.3) * .05);
    ph.pool.position.set(ph.x, LAKE_Y + .05, ph.z); ph.poolM.opacity = ph.k * .22;
    axisM.uniforms.uK.value = ph.k * (.5 + Math.sin(T * 1.6) * .06); axisM.uniforms.uT.value = T;
    { const dx = ph.x - orb.x, dz = ph.z - orb.z, d = Math.hypot(dx, dz) || .001;
      link.position.set((orb.x + ph.x) / 2, orb.y - .1, (orb.z + ph.z) / 2); link.scale.set(d, 1, 1);
      link.rotation.set(-Math.PI / 2, 0, -Math.atan2(dz, dx));
      linkM.uniforms.uLen.value = d; linkM.uniforms.uT.value = T; linkM.uniforms.uK.value = ph.k * .42; }
    mirM.emissiveIntensity = .15 + ph.k * (.25 + Math.sin(T * 1.6) * .06);
    if (ph.k > .5 && Math.random() < dt * 8) fx.emit(ph.x + (Math.random() - .5) * .4, orb.y, ph.z + (Math.random() - .5) * .4, { vy: -.3, life: .9, c: [.85, .7, 1], tw: 8 });
    // 镜月石：镜中月照着（2.3 以内）、真的星光又没照着（2 以外）才浮上来；离开后留 0.35 秒余地
    moonStones.forEach(m => {
      const want = ph.k > .5 && Math.hypot(m.cx - ph.x, m.cz - ph.z) < 2.3 && Math.hypot(m.cx - orb.x, m.cz - orb.z) > 2.0;
      if (want) m.last = T;
      const solid = T - m.last < .35;
      if (solid && !m.solid && m.k < .3 && Math.hypot(P.x - m.cx, P.z - m.cz) < 7) { if (Math.random() < .5) AU.ghost(); fx.emit(m.cx, .05, m.cz, { vy: .35, life: .7, c: [.85, .7, 1], tw: 6, a: .8 }); }
      m.solid = solid;
      m.k += ((solid ? 1 : 0) - m.k) * (1 - Math.exp(-dt * (solid ? 10 : 5)));
      const k = m.k, flick = .5 + .5 * Math.sin(T * 2 + m.ph);   // 慢慢呼吸，不要快闪
      m.mat.opacity = .12 + k * .84 + (1 - k) * flick * .06;
      m.mat.emissiveIntensity = .1 + k * .3 + (1 - k) * flick * .2;
      m.mat.userData.reflK.value = .1 + k * .3;
      m.mesh.position.y = -.24 * (1 - k); m.mesh.scale.set(.72 + k * .28, .4 + k * .6, .72 + k * .28);
    });
    pillars.forEach((p, i) => { p.cres.rotation.y = Math.sin(T * .5 + i) * .4; });
    // 场景小动画
    L.sway.forEach(s => { s.o.rotation.z = Math.sin(T * .8 + s.ph) * .03; });
    L.monos.forEach((m, i) => { m.cres.rotation.y = Math.sin(T * .5 + i) * .4; });
    shallowM.normalMap.offset.set(T * .02, -T * .015);
    lake.uniforms.time.value = T; lake.uniforms.orb.value.set(orb.x, orb.y, orb.z); lake.uniforms.orbK.value = orb.k;
    cray.position.set(52 + OD + Math.sin(T * .35) * .7, -.04, 10.3 + Math.sin(T * .7) * .15);
    // 露珠：从月亮落下的光点
    if (Math.random() < dt * 14) fx.emit(P.x + (Math.random() - .5) * 24, 5 + Math.random() * 2, P.z + (Math.random() - .5) * 16, { vy: -.9, life: 5, c: Math.random() < .6 ? [.85, .85, 1] : [1, .9, .7], tw: 4, a: .7 });
    if (Math.random() < dt * 10) fx.emit(P.x + (Math.random() - .5) * 26, LAKE_Y + .1, P.z + (Math.random() - .5) * 18, { vy: .05, vx: .1, life: 6, c: [.5, .5, .75], a: .35 });
    // 引导微光
    B.qA.on = !qA.on; B.qC.on = !qC.on;
    B.dog.on = B.wolf.on = B.m3.on = !S.solvedB;
    B.m1.on = P.x < 17.6 && qA.on; B.m2.on = P.x > 17.6 && P.x < 20.2;
    B.qD.on = !qD.on && P.x > 40.6; B.qE.on = !qE.on && P.x > 69; B.tide.on = P.x > 74.6 && P.x < 78 && !S.hints.turned;
    B.hub.on = !orb.lock && P.x > 33 && P.x < 48; B.hub.x = hookX(); B.hub.z = hookZ(); B.hub.m.position.set(B.hub.x, B.hub.y, B.hub.z);
    B.card.on = !card.taken && card.vis < .5;
    B.altar.on = !S.done;
  }

  function logic(dt) {
    const h = S.hints, t = ctx.S.t;
    // 进入区域：只显示地名
    if (!h.r && P.x > 40.6) { h.r = 1; toast('幻墙回廊', 2.6); }
    if (!h.t && P.x > 67.6) { h.t = 1; toast('镜湖', 2.6); }
    if (!h.e && P.x > 84) { h.e = 1; toast('月池', 2.6); }
    // 弱引导：只点出地名和意象，答案交给画面（月相石在影子里发紫光、玻璃犬狼被点亮、月石在影子里成形）
    // 犬与狼：同时成立并保持一会儿
    if (!S.solvedB) {
      const both = S._dogOk && S._wolfOk;
      const pv = S.beastHold;
      S.beastHold = both ? S.beastHold + dt : Math.max(0, S.beastHold - dt * 1.5);
      if (both) { AU.shadow(S.beastHold / 1.5); if (Math.random() < dt * 16) fx.emit(25.5 + OB + (Math.random() - .5) * 2, .1, 7.5 + (Math.random() - .5) * 2, { vy: .4, life: .8, c: LILAC, tw: 8 }); }
      if (S.beastHold >= 1.5 && pv < 1.5) solveBeasts();
    }
  }

  function nearest() {
    const out = [];
    L.q.forEach(q => { if (!q.on) out.push({ type: 'phase', q, x: q.x, y: 1.6, z: q.z, label: '唤醒月相石' }); });
    if (!S.done) out.push({ type: 'mirror', x: MIR[0], y: 2.7, z: MIR[1] + .7, r: 2.1, label: '转动月镜' });
    if (!card.taken && card.vis > .5) out.push({ type: 'card', x: card.x, y: 1.6, z: card.z, label: '从水里拾起牌' });
    if (!S.done) out.push(S.gotCard && S.phases === 5 ? { type: 'finale', x: altar.x, y: 1.6, z: altar.z, r: 2.4, label: '放入　XVIII 月' } : { type: 'altar', x: altar.x, y: 1.6, z: altar.z, r: 2.4, label: '查看月池' });
    return out;
  }
  function interact(n) {
    if (n.type === 'phase') {
      // 时机不对：不弹字，石头缩一下、抖一抖
      if ((n.q === qE && !phLit(qE)) || litAt(n.q.x, n.q.z)) { n.q.shy = .5; AU.wrong(); fx.burst(n.q.x, 1, n.q.z, 8, { c: CORALc, sp: .6, life: .6 }); return; }
      wakePhase(n.q);
      toast(`${n.q.name}　${S.phases} / 5`, 2.6);
    } else if (n.type === 'mirror') {
      S.mirT += Math.PI / 4; S.hints.turned = 1; AU.stone(); shake(.05, .45);
      fx.ring(MIR[0], .05, MIR[1], 0xd8c8ff, 2.6, .9); fx.sigil(MIR[0], .06, MIR[1], 0xd8c8ff, 'moon', 2.4, 1.4);
    } else if (n.type === 'card') {
      card.taken = true; S.gotCard = true; AU.card();
      fx.bloom(card.x, .8, card.z, 50, [.75, .8, 1], { w: -3, vr: 2 }); fx.sigil(card.x, .22, card.z, 0xc0c8ff, 'moon', 2.6, 2); fx.ring(card.x, .2, card.z, 0x9fb4ff, 2.6, 1.1); flash(.2);
      card.g.children.forEach(c => { if (c === card.holder || c === card.halo) c.visible = false; });
      toast('从水底拾起　XVIII 月', 3); ctx.updateHud();
    } else if (n.type === 'altar') {
      const miss = [];
      if (S.phases < 5) miss.push(`${5 - S.phases} 枚月相`); if (!S.gotCard) miss.push('那张牌');
      toast(`池水映着残月。还缺${miss.join('和')}`, 3.4); AU.wrong();
    }
  }

  function finaleStart() {
    S.done = true; orb.lock = null; toast('月满', 4);
    fx.sigil(altar.x, .3, altar.z, 0xe0dcff, 'moon', 5.6, 3.5, { spin: -1.2 }); flash(.3);
  }
  function finale(dt, e) {
    altar.slotM.opacity = smooth(.2, 1.2, e);
    altar.marks.forEach((m, i) => { m.material.emissiveIntensity = smooth(.6 + i * .35, 1 + i * .35, e) * 1.6; });
    altar.pm.emissiveIntensity = smooth(1, 3, e) * .22;
    altar.light.intensity = smooth(1, 3.5, e) * 2.4; altar.halo.material.opacity = smooth(1, 3, e) * .28;
    if (e > 1.4 && e < 6.5 && Math.floor(e * 1.2) !== Math.floor((e - dt) * 1.2)) fx.ring(altar.x, .3, altar.z, 0xd8d4ff, 5 + Math.random() * 2, 1.6, { a: .6 });
    // 巨月被机关吊出湖面：沉重、缓慢
    const up = smooth(1.6, 5.6, e);
    altar.big.position.y = -5 + up * 7.4;
    if (up > 0 && up < 1) { shake(.04, .2); if (Math.random() < dt * 30) fx.emit(altar.x + (Math.random() - .5) * 5, LAKE_Y + .1, .6 + (Math.random() - .5) * .6, { vy: 1 + Math.random(), g: -3, life: 1, c: [.7, .75, 1], a: .8 }); }
    if (up >= 1 && !S.moonUp) { S.moonUp = true; AU.stone(); shake(.1, .5); }
    const full = smooth(5.2, 8, e);
    altar.shutter.position.x = altar.shutterX + full * 3.5; altar.shutter.visible = full < .98;
    altar.bmM.emissiveIntensity = .15 + full * .6; altar.bigHalo.material.opacity = full * .22;
    lake.uniforms.phase.value = .25 + full * .75; lake.uniforms.glow.value = full;
    if (e > 2 && e < 8 && Math.random() < dt * 26) { const a = Math.random() * 6.28, r = 1 + Math.random() * 5; fx.emit(altar.x + Math.cos(a) * r, .2, altar.z + Math.sin(a) * r, { vy: 1 + Math.random(), life: 2, c: [.85, .85, 1], tw: 8 }); }
    // 星轨在湖面上旋开
    S.trail = smooth(3.5, 8.5, e);
    lake.uniforms.trail.value = S.trail;
    lake.uniforms.spin.value += dt * (.04 + S.trail * .5);
    lake.uniforms.pole.value.set(altar.x, altar.z - 6);
    const dawn = smooth(5, 10, e);
    ctx.hemi.color.lerpColors(new THREE.Color(0x8a90d0), new THREE.Color(0xd8d8ff), dawn); ctx.hemi.intensity = .3 + dawn * .35;
    return e > 11.5;
  }

  // 停留太久：第一句只给意象，第二句只指方向；具体怎么摆光，交给发光的物件自己说
  function idle() {
    if (!qA.on) return ['月相石不喜欢太亮', '它醒来的时候，会先泛起一点紫光'];
    if (P.x < 17.8) return ['湖上那条路，只在暗处才是真的', '石碑的影子，能伸得很长'];
    if (P.x < 20.2) return ['身后的影子，够不到前面了', '对岸也立着一块石碑'];
    if (!S.solvedB) return ['犬望着光，狼藏于影', '两尊玻璃像，要一起亮起来'];
    if (P.x < 48.5) return ['脚下要影子，前面要光', '湖里的石柱，也许能两全'];
    if (!qD.on && P.x < 55) return ['回廊里还藏着一枚月相', '有一面幻墙后面，还有路'];
    if (!S.hubUsed && !qC.on && P.x < 61) return ['月钩空空地转着，在等什么', '月柱周围有一圈淡淡的光环'];
    if ((!qC.on || !card.taken) && P.x < 70) return ['影子绕着湖心转。别急', '北边和南边的小岛上，都还有东西'];
    if (P.x < 75 && !qE.on) return ['星光往北，湖里的月就往南', '湖里那轮月，能照到星光照不到的地方'];
    if (P.x < 84 && !qE.on) return ['待宵只认湖里那轮月', '月镜能转。真的星光，也要有东西替它挡住'];
    if (P.x < 84) return ['往东的石路，也要湖里的月来照', '月镜还能再转回去'];
    return ['五相与牌都齐了', '月池在最东边'];
  }

  return {
    id: 2, roman: 'XVIII', name: '月', motto: '光与影，交替托住你', mood: 2,
    spawn: [3.5, 7.5], menuP: [3.5, 7.5], menuOrb: [6, 6.5], menuCam: [6.5, 7.6],
    leash: 7.5, mirrorY: -.05, hideInReflection: L.hide, voidMat: lake,
    palette: ['#0a0a1c', '#15152e', '#22224a', '#33356a', '#4b4f8c', '#6a6fae', '#9a9fcc', '#cfd3ea', '#f2f0ff', '#1b3150', '#2f5684', '#6f9ad0', '#3a5a64', '#e88a9a', '#f6b8bc', '#e6d6a8'],
    tintLo: [.96, .97, 1.05], tintHi: [1.02, 1.0, 1.05],
    light: { sky: 0x8a90d0, ground: 0x141830, hemi: .3, moon: 0xb8c4ff, moonK: 1.35, moonDir: [6, -5], orb: 0xffd88e, halo: 0xffc878, mote: [1, .86, .55],
      env: [0x3a4070, 0x080a18, [[6, 6, -3, 0xdfe6ff, 1.8], [-4, 3, 4, 0xe88a9a, .5], [0, 8, 0, 0x8a90d0, 2]]] },
    endCard: { title: '满月照影', line: '第二幕　月　完<br>下一幕　太阳' },
    sockets,
    constrainOrb(o) {
      // 光点不能钻进石碑和塔里
      L.monos.forEach(m => { const dx = o.tx - m.x, dz = o.tz - m.z; if (Math.abs(dx) < .55 && Math.abs(dz) < .55) { if (Math.abs(dx) > Math.abs(dz)) o.tx = m.x + Math.sign(dx || 1) * .55; else o.tz = m.z + Math.sign(dz || 1) * .55; } });
      L.towers.forEach(t => { const dx = o.tx - t.x, dz = o.tz - t.z, d = Math.hypot(dx, dz); if (d < t.r + .15) { o.tx = t.x + dx / (d || 1) * (t.r + .15); o.tz = t.z + dz / (d || 1) * (t.r + .15); } });
      pillars.concat([{ x: MIR[0], z: MIR[1], r: .7 }]).forEach(t => { const dx = o.tx - t.x, dz = o.tz - t.z, d = Math.hypot(dx, dz); if (d < t.r + .15) { o.tx = t.x + dx / (d || 1) * (t.r + .15); o.tz = t.z + dz / (d || 1) * (t.r + .15); } });
      { const dx = o.tx - HUB[0], dz = o.tz - HUB[1], d = Math.hypot(dx, dz); if (d < PILLAR_R + .2) { o.tx = HUB[0] + dx / (d || 1) * (PILLAR_R + .2); o.tz = HUB[1] + dz / (d || 1) * (PILLAR_R + .2); } }
    },
    cell,
    solid(x, z) {
      const cx = Math.floor(x), cz = Math.floor(z), c = cell(cx, cz);
      if (c === 'G') return gate.open < .85;
      // 幻墙：溶解时能穿过；重新凝成时人若还站在里面，不把人卡住
      if (c === '&') { const w = illAt(cx, cz); if (!w || w.open) return false; return !(Math.abs(P.x - w.cx) < .5 && Math.abs(P.z - w.cz) < .5); }
      return SOLID.has(c);
    },
    hole(x, z) {
      const c = cell(Math.floor(x), Math.floor(z));
      if (c === ' ') return true;
      if (c === 'u') { const m = msAt(Math.floor(x), Math.floor(z)); return !m || !m.solid; }
      if (c === '%') { const m = L.mist.find(m => m.x === Math.floor(x) && m.z === Math.floor(z)); return !m || ctx.T - m.last > .35; }
      return false;
    },
    ground(x, z) { return !' %u'.includes(cell(Math.floor(x), Math.floor(z))); },
    onFall() { if (!S.hints.fall) { S.hints.fall = 1; } S._splash = false; },
    onFallFrame(P) { if (!S._splash && P.y < LAKE_Y) { S._splash = true; fx.burst(P.x, LAKE_Y + .05, P.z, 22, { c: [.7, .78, 1], sp: 1.4, up: 2.2, g: -6, life: .9 }); fx.ring(P.x, LAKE_Y + .03, P.z, 0xb8c4ff, 1.8, .9); } },
    onStep(P, dt) {
      const c = cell(Math.floor(P.x), Math.floor(P.z));
      if (c === '~') { if (Math.random() < dt * (4 + P.run * 6)) { fx.ring(P.x, -.03, P.z + .1, 0x9fb0e0, .9, .8, { a: .5 }); fx.emit(P.x, 0, P.z + .1, { vy: .8, vx: (Math.random() - .5) * .6, g: -5, life: .4, c: [.7, .8, 1], a: .7 }); } }
      else if (P.run > .6 && Math.random() < dt * 12) fx.emit(P.x + (Math.random() - .5) * .3, .05, P.z + .1, { vy: .4, vx: -P.vx * .1, vz: -P.vz * .1, life: .5, c: [.6, .6, .8], a: .5, drag: 2 });
    },
    ambient(P) { return .3; },
    reset, update, logic, nearest, interact, finaleStart, finale, idle,
    finaleCam: () => [altar.x - .5, altar.z - 1.8],
    finaleOrb: () => [altar.x - 1.6, altar.z + 1.2],
    progress: () => `${S.phases}${S.gotCard ? 1 : 0}${qA.on ? 1 : 0}${S.solvedB ? 1 : 0}${qC.on ? 1 : 0}${orb.lock ? 1 : 0}${P.x > 18 ? 1 : 0}${P.x > 25 ? 1 : 0}${P.x > 40.5 ? 1 : 0}${qD.on ? 1 : 0}${P.x > 48.5 ? 1 : 0}${P.x > 55 ? 1 : 0}${qE.on ? 1 : 0}${Math.round(S.mirT / (Math.PI / 4)) % 4}${P.x > 84 ? 1 : 0}`,
    MW, MH, mapMarks: () => [...[qA, qB, qD, qC, qE].map(q => ({ x: q.x, z: q.z, kind: 'lamp', done: q.on })), { x: card.x, z: card.z, kind: 'card', done: card.taken }, { x: altar.x, z: altar.z, kind: 'goal', done: S.done }],
    hud: () => ({ label: '月相', dots: [qA.on, qB.on, qD.on, qC.on, qE.on], have: S.gotCard, line: S.done ? '牌已归位' : S.gotCard ? '持有　XVIII 月' : '水底之牌　未寻得' }),
    _: { L, S, litAt, shadowedAt, occluded, qA, qB, qC, qD, qE, dog, wolf, gate, card, altar, ill, pillars, moonStones, ph, phLit, get armA() { return armA; }, set armA(v) { armA = v; } }
  };
}
