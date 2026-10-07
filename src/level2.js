// 第二幕 · XVIII 月 —— 雾湖上的遗迹。月下的路是幻影，影子里的才是真的
// 塔罗「月亮」：幻象与真实、双塔之间的小路、犬与狼、水中爬出的小龙虾、落下的露珠
import * as THREE from 'three';
import * as TX from './textures.js';
import { mk } from './sprites.js';
import { LAYER_FX } from './post.js';
import { tex, ntex, toon, reflective, billboard, quadGeo, cliffMesh, wallGeo, instWalls, hashv, shadowAll } from './common.js';
import { lakeMat } from './abyss.js';
import { haloCanvas } from './sprites.js';

export const MW = 64, MH = 15;
const clamp = (v, a, b) => v < a ? a : v > b ? b : v;
const smooth = (a, b, x) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
const easeBack = t => { const c = 1.4; return 1 + (c + 1) * Math.pow(t - 1, 3) + c * Math.pow(t - 1, 2); };
const LIT_R = 9.6;   // 星光能照到的距离
const HUB = [41.5, 7.5], ARM_R = 1.4, ARM_W = .7, ARM_PERIOD = 20;
const LAKE_Y = -.3;

/* ---------- 地图 ----------
  空格=深湖  .月石步道  ,苔岸  ~浅水  #断墙  %影石（只在影子里成形）  M石碑  H塔  D犬像  F狼像  G月洞门
  Q月相石  K水底之牌  A月池  T银柳  X月轮轴心 */
function buildMap() {
  const g = Array.from({ length: MH }, () => Array(MW).fill(' '));
  const set = (x, z, c) => { if (x >= 0 && z >= 0 && x < MW && z < MH) g[z][x] = c; };
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
  fill(13, 7, 17, 7, '%');
  // B：双塔之庭
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
  // C：月轮（湖心的巨大机关）
  fill(34, 6, 38, 8, '.');
  fill(44, 6, 48, 8, '.');
  set(41, 7, 'X');
  // 环形影石路：八边形，四向连通（不需要斜着跨）
  pts([[39, 6], [39, 5], [40, 5], [40, 4], [41, 4], [42, 4], [42, 5], [43, 5], [43, 6],
       [39, 8], [39, 9], [40, 9], [40, 10], [41, 10], [42, 10], [42, 9], [43, 9], [43, 8]], '%');
  set(41, 3, '%'); set(41, 11, '%');
  fill(40, 1, 42, 2, ','); set(41, 1, 'Q');
  fill(40, 12, 42, 13, ','); set(41, 13, 'K');
  // D：月池
  fill(49, 2, 62, 12, ',');
  pts([[49, 2], [49, 3], [50, 2], [62, 2], [62, 3], [61, 2], [49, 12], [49, 11], [50, 12], [62, 12], [62, 11], [61, 12]], ' ');
  fill(49, 7, 55, 7, '.'); fill(54, 4, 60, 10, '.');
  fill(51, 9, 52, 11, '~'); fill(51, 3, 52, 5, '~');
  fill(56, 6, 58, 8, 'A');
  pts([[53, 3], [53, 11], [61, 5], [61, 9], [60, 3], [60, 11]], '#');
  pts([[51, 6], [51, 8]], 'T'); pts([[59, 2], [55, 12]], 'T');
  return g;
}
const SOLID = new Set(['#', 'M', 'H', 'D', 'F', 'G', 'Q', 'K', 'A', 'T', 'X']);

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

export function buildMoon(ctx) {
  const { group: root, camQuat, fx, AU, toast, cine, shake, flash, P, orb } = ctx;
  const grid = buildMap();
  const cell = (x, z) => (x < 0 || z < 0 || x >= MW || z >= MH) ? ' ' : grid[z][x];
  const isLake = c => c === ' ' || c === '%';
  const L = { mist: [], sway: [], hide: [], monos: [], towers: [], q: [], reeds: [] };

  /* ================= 材质（湿润的月石：缝隙深凹、表面反光） ================= */
  const cStone = TX.moonStoneTex(), cMoss = TX.mossTex(), cSand = TX.sandTex(), cRuin = TX.ruinWallTex(), cRuinT = TX.ruinTopTex(), cTower = TX.towerTex();
  const matStone = reflective(toon({ map: tex(cStone), normalMap: ntex(cStone, 7), normalScale: new THREE.Vector2(1.6, 1.6), roughness: .26 }), .38);
  const matMoss = toon({ map: tex(cMoss), normalMap: ntex(cMoss, 3.5), roughness: .9 });
  const matSand = toon({ map: tex(cSand), normalMap: ntex(cSand, 4), roughness: .7 });
  const ruinS = toon({ map: tex(cRuin), normalMap: ntex(cRuin, 6), normalScale: new THREE.Vector2(1.5, 1.5), roughness: .65 });
  const ruinT = toon({ map: tex(cRuinT), normalMap: ntex(cRuinT, 3), roughness: .6 });
  const silverM = toon({ color: 0xc9cde6, roughness: .22, metalness: .85 });
  const paleM = toon({ color: 0x9ea3c8, roughness: .4 });
  const darkM = toon({ color: 0x2a2c4a, roughness: .5, metalness: .3 });

  /* ================= 地面：月石、苔岸、浅水 ================= */
  const fl = { '.': [], ',': [], '~': [] }, cliffs = [];
  for (let z = 0; z < MH; z++) for (let x = 0; x < MW; x++) {
    const c = grid[z][x]; if (isLake(c)) continue;
    let k = c === ',' || c === 'T' ? ',' : c === '~' ? '~' : '.';
    if (c === 'Q' && x > 38 && x < 44) k = ',';
    if (c === 'K') k = ',';
    fl[k].push([x, z]);
    [[0, 1], [0, -1], [1, 0], [-1, 0]].forEach(([dx, dz]) => { if (isLake(cell(x + dx, z + dz))) cliffs.push([x, z, dx, dz]); });
  }
  const mF = (cells, mat, y) => { const m = new THREE.Mesh(quadGeo(cells, y), mat); m.receiveShadow = true; root.add(m); return m; };
  mF(fl['.'], matStone, 0); mF(fl[','], matMoss, 0); mF(fl['~'], matSand, -.16);
  const cW = TX.waterTex(), wN = ntex(cW, 2.4);
  const shallowM = reflective(toon({ color: 0x5a6aa8, normalMap: wN, transparent: true, opacity: .55, roughness: .04, metalness: .2, emissive: 0x141a40, emissiveIntensity: .4 }), .8, 1.4);
  const shallow = mF(fl['~'], shallowM, -.05); shallow.receiveShadow = true;
  // 浅水池边沿：一圈矮石
  root.add(cliffMesh(cliffs, toon({ map: tex(TX.cliffTex()), normalMap: ntex(TX.cliffTex(), 4), color: 0x9aa0c8, side: THREE.DoubleSide }), 1.4));

  /* ================= 夜湖（深渊） ================= */
  const lake = lakeMat();
  const lakeMesh = new THREE.Mesh(new THREE.PlaneGeometry(400, 400), lake);
  lakeMesh.rotation.x = -Math.PI / 2; lakeMesh.position.set(32, LAKE_Y, 7); root.add(lakeMesh);
  L.hide.push(lakeMesh);
  lake.uniforms.moon.value.set(57.5, 13.4, 1.5);

  /* ================= 断墙 ================= */
  const walls = [];
  for (let z = 0; z < MH; z++) for (let x = 0; x < MW; x++) if (grid[z][x] === '#') {
    const near = (x === 33) ? 1 : .55 + hashv(x, z) * .6;
    walls.push([x, z, near]);
  }
  instWalls(root, walls, wallGeo(1.6), [ruinS, ruinS, ruinT, ruinT, ruinS, ruinS]);

  /* ================= 影石（只在影子里成形的路） ================= */
  const mistT = tex(TX.mistTex());
  const mGeo = new THREE.BoxGeometry(.94, .14, .94); mGeo.translate(0, -.07, 0);
  for (let z = 0; z < MH; z++) for (let x = 0; x < MW; x++) if (grid[z][x] === '%') {
    const mat = reflective(toon({ map: mistT, emissive: 0xb8b0ff, emissiveIntensity: .2, transparent: true, opacity: .3, depthWrite: false, roughness: .1 }), .35);
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
    L.towers.push({ x: cx, z: cz, r: 1.3, top, winM });
  };

  /* ================= 犬与狼 ================= */
  const statueM = toon({ color: 0xb4b8d8, roughness: .3, metalness: .1, normalMap: ntex(cRuin, 3) });
  const eyeMat = (c) => new THREE.MeshStandardMaterial({ color: 0x111111, emissive: c, emissiveIntensity: .1 });
  const addBeast = (x, z, wolf) => {
    const g0 = new THREE.Group(); g0.position.set(x + .5, 0, z + .5);
    const ped = new THREE.Mesh(new THREE.BoxGeometry(.9, .35, .9), paleM); ped.position.y = .175; g0.add(ped);
    const body = new THREE.Mesh(new THREE.BoxGeometry(.42, .5, .62), statueM); body.position.set(0, .62, -.05); body.rotation.x = -.35; g0.add(body);
    const head = new THREE.Mesh(new THREE.BoxGeometry(.34, .3, .34), statueM); head.position.set(0, 1.02, .14); g0.add(head);
    const snout = new THREE.Mesh(new THREE.BoxGeometry(.18, .14, wolf ? .3 : .2), statueM); snout.position.set(0, .97 + (wolf ? .08 : 0), .38); snout.rotation.x = wolf ? -.5 : 0; g0.add(snout);
    [-1, 1].forEach(s => { const ear = new THREE.Mesh(new THREE.ConeGeometry(.07, wolf ? .26 : .16, 4), statueM); ear.position.set(s * .11, 1.24, .1); ear.rotation.z = -s * .2; g0.add(ear); });
    const tail = new THREE.Mesh(new THREE.ConeGeometry(.06, .4, 4), statueM); tail.position.set(0, .45, -.42); tail.rotation.x = wolf ? -2.2 : -1.2; g0.add(tail);
    if (wolf) head.rotation.x = -.45;
    const em = eyeMat(wolf ? 0xff8aa0 : 0xffd27a);
    [-1, 1].forEach(s => { const e = new THREE.Mesh(new THREE.BoxGeometry(.05, .05, .02), em); e.position.set(s * .08, 1.06 + (wolf ? .05 : 0), .31); g0.add(e); });
    g0.rotation.y = wolf ? Math.PI : 0; // 犬朝南（看向庭院中心），狼朝北
    g0.scale.setScalar(1.45);
    shadowAll(g0); root.add(g0);
    return { x: x + .5, z: z + .5, g: g0, em, ok: 0 };
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
  const haloT = tex(haloCanvas(32)); haloT.wrapS = haloT.wrapT = THREE.ClampToEdgeWrapping;
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
    const q = { x: x + .5, z: z + .5, name, on: false, t: 0, sm, ring, halo, light, g: g0 };
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
    const water = reflective(toon({ color: 0x3a4a90, roughness: .05, metalness: .2, emissive: 0x202a66, emissiveIntensity: .5, normalMap: wN }), .7, 1.4);
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
    const pm = reflective(toon({ color: 0x2a3a80, roughness: .15, metalness: .2, normalMap: wN, emissive: 0xc8d0ff, emissiveIntensity: 0 }), .85, 1.6);
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
    const ped = new THREE.Mesh(new THREE.CylinderGeometry(.42, .55, 1.3, 10), paleM); ped.position.y = .65; hubG.add(ped);
    const cup = new THREE.Mesh(new THREE.TorusGeometry(.3, .05, 5, 20), silverM); cup.rotation.x = Math.PI / 2; cup.position.y = 1.32; hubG.add(cup);
    const base = new THREE.Mesh(new THREE.CylinderGeometry(.7, .8, .3, 12), darkM); base.position.y = -.1; hubG.add(base);
    shadowAll(hubG);
  }
  const arm = new THREE.Group(); arm.position.set(HUB[0], 0, HUB[1]); root.add(arm);
  {
    const beam = new THREE.Mesh(new THREE.BoxGeometry(ARM_R + .5, .14, .2), silverM); beam.position.set((ARM_R) / 2, 3.15, 0); arm.add(beam);
    const mast = new THREE.Mesh(new THREE.CylinderGeometry(.08, .08, 1.9, 6), silverM); mast.position.y = 2.2 + .1; arm.add(mast);
    const screenM = toon({ map: tex(cTower), normalMap: ntex(cTower, 5), color: 0x8a8fb8, roughness: .35, metalness: .3 });
    const screen = new THREE.Mesh(new THREE.BoxGeometry(.18, 2.9, ARM_W * 2), screenM); screen.position.set(ARM_R, 1.55, 0); arm.add(screen);
    const edge = new THREE.Mesh(new THREE.BoxGeometry(.22, .08, ARM_W * 2 + .06), silverM); edge.position.set(ARM_R, 3.02, 0); arm.add(edge);
    const cw = new THREE.Mesh(new THREE.SphereGeometry(.24, 10, 8), silverM); cw.position.set(-.7, 3.15, 0); arm.add(cw);
    shadowAll(arm);
  }
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
  const reedTs = [1, 2, 3].map(s => { const t = tex(TX.reedCanvas(s * 17)); t.wrapS = t.wrapT = THREE.ClampToEdgeWrapping; return t; });
  const reedMs = reedTs.map(t => toon({ map: t, alphaTest: .5, side: THREE.DoubleSide }));
  const rGeo = new THREE.PlaneGeometry(.62, 1); rGeo.translate(0, .5, 0);
  const lotusTs = [false, true].map(o => { const t = tex(TX.lotusCanvas(o)); t.wrapS = t.wrapT = THREE.ClampToEdgeWrapping; return t; });
  const lotusMs = lotusTs.map(t => toon({ map: t, alphaTest: .5, side: THREE.DoubleSide, roughness: .4 }));
  const lGeo = new THREE.PlaneGeometry(.75, .5); lGeo.rotateX(-Math.PI / 2);
  const rr = TX.rng(31);
  for (let z = 0; z < MH; z++) for (let x = 0; x < MW; x++) {
    const c = grid[z][x];
    // 芦苇长在岸边和浅水边
    if ((c === ',' || c === '~') && [[0, 1], [0, -1], [1, 0], [-1, 0]].some(([dx, dz]) => cell(x + dx, z + dz) === ' ') && rr() < .55) {
      const m = new THREE.Mesh(rGeo, reedMs[rr() * 3 | 0]); m.quaternion.copy(camQuat); m.position.set(x + .2 + rr() * .6, c === '~' ? -.05 : 0, z + .2 + rr() * .6); m.layers.set(LAYER_FX); root.add(m);
      L.reeds.push({ m, ph: rr() * 6 });
    }
    // 睡莲漂在湖面
    if (c === ' ' && rr() < .05 && x > 1 && x < MW - 2) { const ok = [[0, 1], [0, -1], [1, 0], [-1, 0]].some(([dx, dz]) => !' %'.includes(cell(x + dx, z + dz))); if (ok) { const m = new THREE.Mesh(lGeo, lotusMs[rr() < .4 ? 1 : 0]); m.position.set(x + .5, LAYER_Y(), z + .5); m.rotation.y = rr() * 6; root.add(m); } }
    if (c === '~' && rr() < .25) { const m = new THREE.Mesh(lGeo, lotusMs[rr() < .5 ? 1 : 0]); m.position.set(x + .5, -.04, z + .5); m.rotation.y = rr() * 6; root.add(m); }
  }
  function LAYER_Y() { return LAKE_Y + .02; }

  // 小龙虾（月亮牌里从水中爬出的那只）：在月池旁的浅水里来回走
  const crayC = mk(12, 8); { const g = crayC.getContext('2d'); const px = (x, y, k) => { g.fillStyle = k; g.fillRect(x, y, 1, 1); };
    [[2, 2], [3, 3], [8, 3], [9, 2], [3, 4], [8, 4]].forEach(([x, y]) => px(x, y, '#e88a9a'));
    for (let x = 4; x <= 7; x++) for (let y = 3; y <= 6; y++) px(x, y, y === 3 ? '#f6b8bc' : '#c76a80');
    px(5, 7, '#a85a72'); px(6, 7, '#a85a72'); px(4, 2, '#2b2a4a'); px(7, 2, '#2b2a4a'); px(1, 1, '#e88a9a'); px(10, 1, '#e88a9a'); }
  const crayT = tex(crayC); crayT.wrapS = crayT.wrapT = THREE.ClampToEdgeWrapping;
  const cray = new THREE.Mesh(new THREE.PlaneGeometry(.75, .5), toon({ map: crayT, alphaTest: .5, side: THREE.DoubleSide, roughness: .4 }));
  cray.geometry.translate(0, .25, 0); cray.quaternion.copy(camQuat); cray.layers.set(LAYER_FX); root.add(cray);

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
  addTower(31.5, 3.5); addTower(31.5, 11.5);
  addMoonGate(33, 6, 8);
  const qA = addPhase(6, 3, '蛾眉'), qC = addPhase(41, 1, '凸月');
  const qB = { x: 25.5, z: 7.5, name: '上弦', on: false, t: 0, virtual: true };
  addAltar(57.5, 7.5);
  const { gate, card, altar } = L; const dog = beasts.dog, wolf = beasts.wolf;
  const mono = (x, z) => L.monos.find(m => m.x === x + .5 && m.z === z + .5);

  /* ================= 遮挡与光照判定 ================= */
  let armA = Math.PI;
  const armSeg = () => {
    const cx = HUB[0] + Math.cos(armA) * ARM_R, cz = HUB[1] + Math.sin(armA) * ARM_R, tx = -Math.sin(armA) * ARM_W, tz = Math.cos(armA) * ARM_W;
    return [[cx - tx, cz - tz], [cx + tx, cz + tz]];
  };
  function occluded(ax, az, bx, bz) {
    for (const m of L.monos) { if (Math.abs(ax - m.x) < .45 && Math.abs(az - m.z) < .45) continue; if (segAABB(ax, az, bx, bz, m.x, m.z, .4)) return true; }
    for (const t of L.towers) { if (Math.hypot(ax - t.x, az - t.z) < t.r) continue; if (segCircle(ax, az, bx, bz, t.x, t.z, t.r)) return true; }
    const [a, b] = armSeg(); if (segSeg([ax, az], [bx, bz], a, b)) return true;
    return false;
  }
  const inRange = (x, z) => Math.hypot(x - orb.x, z - orb.z) < LIT_R;
  const litAt = (x, z) => inRange(x, z) && !occluded(orb.x, orb.z, x, z);
  const shadowedAt = (x, z) => inRange(x, z) && occluded(orb.x, orb.z, x, z);

  /* ================= 引导微光 ================= */
  const LILAC = [.85, .82, 1], CORALc = [1, .6, .7], SILVER = [.86, .9, 1];
  const B = {
    qA: fx.beacon(qA.x, 1.0, qA.z, 0xc8b8ff, 1.2), qC: fx.beacon(qC.x, 1.0, qC.z, 0xc8b8ff, 1.2),
    dog: fx.beacon(dog.x, 1.3, dog.z, 0xffcf7a, .9), wolf: fx.beacon(wolf.x, 1.3, wolf.z, 0xff8aa0, .9),
    m1: fx.beacon(11.5, 3.3, 7.5, 0x9fe0ff, .8), m3: fx.beacon(25.5, 3.3, 7.5, 0x9fe0ff, .8),
    hub: fx.beacon(HUB[0], 1.45, HUB[1], 0x8ff0e0, 1.3),
    card: fx.beacon(card.x, .5, card.z, 0x9fb4ff, 1),
    altar: fx.beacon(altar.x, 1.0, altar.z, 0xd8dcff, 1.6)
  };

  /* ================= 状态 ================= */
  const S = { phases: 0, gotCard: false, done: false, hints: {}, trail: 0, hubUsed: false, beastHold: 0, solvedB: false, crownHit: false, moonUp: false };

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
      { dur: 1.4, focus: [26.5, 7.5], start() { flash(.2); fx.bloom(dog.x, 1.1, dog.z, 30, [1, .85, .5], { w: 2.4, vr: 1.4 }); fx.bloom(wolf.x, 1.1, wolf.z, 30, CORALc, { w: -2.4, vr: 1.4 }); AU.howl && AU.howl(); },
        run(k, dt) { [dog, wolf].forEach((b, i) => { if (Math.random() < dt * 26) { const t = Math.random() * k; fx.emit(b.x + (gx - b.x) * t, 1 + Math.sin(t * 3) * .5, b.z + (gz - b.z) * t, { vy: .2, life: .9, c: i ? CORALc : [1, .85, .5], tw: 8 }); } }); } },
      { dur: 1.4, focus: [gx - 3, gz], start() { AU.stone(); shake(.1, .5); },
        run(k) { L.towers.forEach((t, i) => { t.top.rotation.y = (i ? -1 : 1) * easeBack(k) * Math.PI * .5; t.winM.emissiveIntensity = .9 + k * 2; }); gate.glow.material.opacity = k * .9; gate.dm.emissiveIntensity = k * .6; } },
      { dur: 3, focus: [gx - 3, gz], start() { gate.opening = true; AU.stone(); },
        run(k, dt) { if (Math.random() < dt * 3) AU.stone(); shake(.07, .2); gate.glow.material.opacity = .9 - k * .5; } },
      { dur: .9, focus: [gx - 3, gz], start() { wakePhase(qB); fx.sigil(25.5, .05, 7.5, 0xe0dcff, 'moon', 4.4, 2.4); fx.ring(gx - .5, .05, gz, 0xd8d4ff, 4, 1.3); toast('上弦。光与影各占一半，月洞门开了', 3.8); } }
    ]);
  }

  function reset() {
    Object.assign(S, { phases: 0, gotCard: false, done: false, hints: {}, trail: 0, hubUsed: false, beastHold: 0, solvedB: false, crownHit: false, moonUp: false });
    L.q.forEach(q => { q.on = false; q.t = 0; }); qB.on = false;
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
    arm.rotation.y = -armA; wheel.rotation.y = -armA * .5;
    // 影石：在影子里（或星光照不到的地方）是实的；被星光照到就成了幻影
    L.mist.forEach(m => {
      // 取格子中心和四个角附近的点：只要有一处在影子里，这块月石就成形（对玩家宽容一点）
      const solid = !litAt(m.cx, m.cz) || !litAt(m.cx - .3, m.cz - .3) || !litAt(m.cx + .3, m.cz - .3) || !litAt(m.cx - .3, m.cz + .3) || !litAt(m.cx + .3, m.cz + .3);
      if (solid) m.last = T;
      if (solid && !m.solid && m.k < .3 && Math.hypot(P.x - m.cx, P.z - m.cz) < 6) { if (Math.random() < .5) AU.ghost(); fx.emit(m.cx, .05, m.cz, { vy: .3, life: .7, c: LILAC, tw: 6, a: .8 }); }
      m.solid = solid;
      m.k += ((solid ? 1 : 0) - m.k) * (1 - Math.exp(-dt * (solid ? 10 : 6)));
      const k = m.k, flick = .5 + .5 * Math.sin(T * 9 + m.ph);
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
      q.sm.emissiveIntensity = .05 + kk * 2.2; q.sm.color.setRGB(.54 + kk * .4, .56 + kk * .4, .72 + kk * .28);
      q.light.intensity = kk * 6; q.halo.material.opacity = kk * .5;
      q.ring.rotation.y += dt * (.4 + kk * 1.5);
      if (kk > .5 && Math.random() < dt * 5) fx.emit(q.x + (Math.random() - .5) * .3, 1, q.z + (Math.random() - .5) * .3, { vy: .45, life: 1.6, c: SILVER, tw: 6 });
    });
    // 犬与狼：眼睛分别亮起
    const dogOk = !S.solvedB && litAt(dog.x, dog.z) && orb.z - dog.z > .35;
    const wolfOk = !S.solvedB && shadowedAt(wolf.x, wolf.z);
    dog.ok += ((dogOk || S.solvedB ? 1 : 0) - dog.ok) * (1 - Math.exp(-dt * 6));
    wolf.ok += ((wolfOk || S.solvedB ? 1 : 0) - wolf.ok) * (1 - Math.exp(-dt * 6));
    dog.em.emissiveIntensity = .1 + dog.ok * 3; wolf.em.emissiveIntensity = .1 + wolf.ok * 3;
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
    // 场景小动画
    L.sway.forEach(s => { s.o.rotation.z = Math.sin(T * .8 + s.ph) * .03; });
    L.monos.forEach((m, i) => { m.cres.rotation.y = Math.sin(T * .5 + i) * .4; });
    shallowM.normalMap.offset.set(T * .02, -T * .015);
    lake.uniforms.time.value = T; lake.uniforms.orb.value.set(orb.x, orb.y, orb.z); lake.uniforms.orbK.value = orb.k;
    cray.position.set(52 + Math.sin(T * .35) * .7, -.04, 10.3 + Math.sin(T * .7) * .15);
    // 露珠：从月亮落下的光点
    if (Math.random() < dt * 14) fx.emit(P.x + (Math.random() - .5) * 24, 5 + Math.random() * 2, P.z + (Math.random() - .5) * 16, { vy: -.9, life: 5, c: Math.random() < .6 ? [.85, .85, 1] : [1, .9, .7], tw: 4, a: .7 });
    if (Math.random() < dt * 10) fx.emit(P.x + (Math.random() - .5) * 26, LAKE_Y + .1, P.z + (Math.random() - .5) * 18, { vy: .05, vx: .1, life: 6, c: [.5, .5, .75], a: .35 });
    // 引导微光
    B.qA.on = !qA.on; B.qC.on = !qC.on;
    B.dog.on = B.wolf.on = B.m3.on = !S.solvedB;
    B.m1.on = P.x < 18.5 && qA.on;
    B.hub.on = !orb.lock && P.x > 33 && P.x < 48;
    B.card.on = !card.taken && card.vis < .5;
    B.altar.on = !S.done;
  }

  function logic(dt) {
    const h = S.hints, t = ctx.S.t;
    if (!h.move && t > .8) { h.move = 1; toast('月光下的东西，未必是真的', 4.2); }
    if (!h.q && Math.hypot(P.x - qA.x, P.z - qA.z) < 3.4) { h.q = 1; toast('月相石怕星光。让它待在影子里，再按 E 唤醒', 4.6); }
    if (!h.mist && P.x > 9.3) { h.mist = 1; toast('湖上的月石只在影子里成形。让石碑的影子替你铺路', 4.6); }
    if (!h.court && P.x > 20) { h.court = 1; toast('犬望着光，狼藏于影', 4); }
    if (!h.beast && P.x > 22 && !S.solvedB && Math.hypot(P.x - 25.5, P.z - 7.5) < 4) { h.beast = 1; toast('犬要看见星光，狼要躲进影子里。两件事，要同时成立', 4.8); }
    // 光点第一次放进轴心之前，这条提示一直留在画面上
    if (!S.hubUsed && P.x > 34.5 && P.x < 49) ctx.holdToast('湖心的月轮会托住星光。把光点放到中间的石台上');
    if (!h.e && P.x > 49) { h.e = 1; toast('月池。三相与牌，缺一不可', 3.8); }
    // 犬与狼：同时成立并保持一会儿
    if (!S.solvedB) {
      const both = S._dogOk && S._wolfOk;
      const pv = S.beastHold;
      S.beastHold = both ? S.beastHold + dt : Math.max(0, S.beastHold - dt * 1.5);
      if (both) { AU.shadow(S.beastHold / 1.5); if (Math.random() < dt * 16) fx.emit(25.5 + (Math.random() - .5) * 2, .1, 7.5 + (Math.random() - .5) * 2, { vy: .4, life: .8, c: LILAC, tw: 8 }); }
      if (S.beastHold >= 1.5 && pv < 1.5) solveBeasts();
    }
  }

  function nearest() {
    const out = [];
    L.q.forEach(q => { if (!q.on) out.push({ type: 'phase', q, x: q.x, y: 1.6, z: q.z, label: '唤醒月相石' }); });
    if (!card.taken && card.vis > .5) out.push({ type: 'card', x: card.x, y: 1.6, z: card.z, label: '从水里拾起牌' });
    if (!S.done) out.push(S.gotCard && S.phases === 3 ? { type: 'finale', x: altar.x, y: 1.6, z: altar.z, r: 2.4, label: '放入　XVIII 月' } : { type: 'altar', x: altar.x, y: 1.6, z: altar.z, r: 2.4, label: '查看月池' });
    return out;
  }
  function interact(n) {
    if (n.type === 'phase') {
      if (litAt(n.q.x, n.q.z)) { toast('星光照着它，它不肯醒。把光藏到高大的东西后面', 3.2); AU.wrong(); fx.burst(n.q.x, 1, n.q.z, 8, { c: CORALc, sp: .6, life: .6 }); return; }
      wakePhase(n.q);
      toast(n.q === qA ? '蛾眉。第一枚月相醒了' : '凸月。月亮快要圆了', 3.4);
    } else if (n.type === 'card') {
      card.taken = true; S.gotCard = true; AU.card();
      fx.bloom(card.x, .8, card.z, 50, [.75, .8, 1], { w: -3, vr: 2 }); fx.sigil(card.x, .22, card.z, 0xc0c8ff, 'moon', 2.6, 2); fx.ring(card.x, .2, card.z, 0x9fb4ff, 2.6, 1.1); flash(.2);
      card.g.children.forEach(c => { if (c === card.holder || c === card.halo) c.visible = false; });
      toast('从水底拾起　XVIII 月', 3); ctx.updateHud();
    } else if (n.type === 'altar') {
      const miss = [];
      if (S.phases < 3) miss.push(`${3 - S.phases} 枚月相`); if (!S.gotCard) miss.push('那张牌');
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
    ctx.hemi.color.lerpColors(new THREE.Color(0x8a90d0), new THREE.Color(0xd8d8ff), dawn); ctx.hemi.intensity = .5 + dawn * .3;
    return e > 11.5;
  }

  function idle() {
    if (!qA.on) return ['月相石只在影子里醒来', '把光点移到石碑的另一边，让石碑挡住光，再站到月相石旁按 E'];
    if (P.x < 18) return ['湖上那条路，只在影子里才是真的', '站到湖边石碑的背后，把光点放在石碑西侧：影子会沿着湖面铺出一条路'];
    if (!S.solvedB) return ['犬要看见光，狼要藏进影子', '把光点放到中间石碑的左上方：狼落进石碑的影子，犬正好被照亮'];
    if (!orb.lock && !qC.on && P.x < 40) return ['湖心的月轮有一个轴心，能托住星光', '把光点移到湖心的石台上，它会被托住；之后晃动鼠标就能取下'];
    if (!qC.on || !card.taken) return ['影子绕着湖心转。踩着影子走，别急', '在岸边等影子扫过来再踏上去，跟着它转。北边小岛有月相石，南边小岛的水里有牌'];
    return ['三相与牌都齐了，去最东边的月池', '从东岸一路往东，在月池前按 E'];
  }

  return {
    id: 2, roman: 'XVIII', name: '月', motto: '光与影，交替托住你', mood: 2,
    spawn: [3.5, 7.5], menuP: [3.5, 7.5], menuOrb: [6, 6.5], menuCam: [6.5, 7.6],
    leash: 7.5, mirrorY: -.12, hideInReflection: L.hide, voidMat: lake,
    palette: ['#0a0a1c', '#15152e', '#22224a', '#33356a', '#4b4f8c', '#6a6fae', '#9a9fcc', '#cfd3ea', '#f2f0ff', '#1b3150', '#2f5684', '#6f9ad0', '#3a5a64', '#e88a9a', '#f6b8bc', '#e6d6a8'],
    tintLo: [.93, .95, 1.12], tintHi: [1.02, 1.0, 1.05],
    light: { sky: 0x8a90d0, ground: 0x141830, hemi: .5, moon: 0xb8c4ff, moonK: 1.15, moonDir: [6, -5], orb: 0xffe6c8, halo: 0xffd9a8, mote: [1, .9, .75],
      env: [0x3a4070, 0x080a18, [[6, 6, -3, 0xdfe6ff, 1.8], [-4, 3, 4, 0xe88a9a, .5], [0, 8, 0, 0x8a90d0, 2]]] },
    endCard: { title: '满月照影', line: '第二幕　月　完<br>下一幕　太阳　尚在远方' },
    sockets: [{ x: HUB[0], z: HUB[1], active: () => true, onLock() { S.hubUsed = true; AU.lamp(0); fx.ring(HUB[0], .05, HUB[1], 0x8ff0e0, 3.2, 1.2); fx.sigil(HUB[0], .06, HUB[1], 0x8ff0e0, 'moon', 3, 1.8); flash(.15); if (!S.hints.lock) { S.hints.lock = 1; toast('星光被月轮托住了。影子在湖面上转动，跟着它走', 4.6); } } }],
    constrainOrb(o) {
      // 光点不能钻进石碑和塔里
      L.monos.forEach(m => { const dx = o.tx - m.x, dz = o.tz - m.z; if (Math.abs(dx) < .55 && Math.abs(dz) < .55) { if (Math.abs(dx) > Math.abs(dz)) o.tx = m.x + Math.sign(dx || 1) * .55; else o.tz = m.z + Math.sign(dz || 1) * .55; } });
      L.towers.forEach(t => { const dx = o.tx - t.x, dz = o.tz - t.z, d = Math.hypot(dx, dz); if (d < t.r + .15) { o.tx = t.x + dx / (d || 1) * (t.r + .15); o.tz = t.z + dz / (d || 1) * (t.r + .15); } });
    },
    cell,
    solid(x, z) { const c = cell(Math.floor(x), Math.floor(z)); if (c === 'G') return gate.open < .85; return SOLID.has(c); },
    hole(x, z) {
      const c = cell(Math.floor(x), Math.floor(z));
      if (c === ' ') return true;
      if (c === '%') { const m = L.mist.find(m => m.x === Math.floor(x) && m.z === Math.floor(z)); return !m || ctx.T - m.last > .35; }
      return false;
    },
    ground(x, z) { return !' %'.includes(cell(Math.floor(x), Math.floor(z))); },
    onFall() { if (!S.hints.fall) { S.hints.fall = 1; setTimeout(() => toast('被星光照到的月石，原来只是幻影', 3.6), 900); } S._splash = false; },
    onFallFrame(P) { if (!S._splash && P.y < LAKE_Y) { S._splash = true; fx.burst(P.x, LAKE_Y + .05, P.z, 22, { c: [.7, .78, 1], sp: 1.4, up: 2.2, g: -6, life: .9 }); fx.ring(P.x, LAKE_Y + .03, P.z, 0xb8c4ff, 1.8, .9); } },
    onStep(P, dt) {
      const c = cell(Math.floor(P.x), Math.floor(P.z));
      if (c === '~') { if (Math.random() < dt * (4 + P.run * 6)) { fx.ring(P.x, -.03, P.z + .1, 0x9fb0e0, .9, .8, { a: .5 }); fx.emit(P.x, 0, P.z + .1, { vy: .8, vx: (Math.random() - .5) * .6, g: -5, life: .4, c: [.7, .8, 1], a: .7 }); } }
      else if (P.run > .6 && Math.random() < dt * 12) fx.emit(P.x + (Math.random() - .5) * .3, .05, P.z + .1, { vy: .4, vx: -P.vx * .1, vz: -P.vz * .1, life: .5, c: [.6, .6, .8], a: .5, drag: 2 });
    },
    ambient(P) { return .5; },
    reset, update, logic, nearest, interact, finaleStart, finale, idle,
    finaleCam: () => [altar.x - .5, altar.z - 1.8],
    finaleOrb: () => [altar.x - 1.6, altar.z + 1.2],
    progress: () => `${S.phases}${S.gotCard ? 1 : 0}${qA.on ? 1 : 0}${S.solvedB ? 1 : 0}${qC.on ? 1 : 0}${orb.lock ? 1 : 0}${P.x > 18 ? 1 : 0}${P.x > 33.5 ? 1 : 0}`,
    hud: () => ({ label: '月相', dots: [qA.on, qB.on, qC.on], have: S.gotCard, line: S.done ? '牌已归位' : S.gotCard ? '持有　XVIII 月' : '水底之牌　未寻得' }),
    _: { L, S, litAt, shadowedAt, occluded, qA, qB, qC, dog, wolf, gate, card, altar, get armA() { return armA; }, set armA(v) { armA = v; } }
  };
}
