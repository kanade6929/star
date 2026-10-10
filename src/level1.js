// 第一幕 · XVII 星 —— 地图、场景、机关与演出
import * as THREE from 'three';
import * as TX from './textures.js';
import { flowerCanvas, starCardCanvas, cardBackCanvas, haloCanvas, mk } from './sprites.js';
import { LAYER_FX } from './post.js';
import { tex, ntex, toon, reflective, billboard, quadGeo, cliffMesh, wallGeo, instWalls, hashv, shadowAll, lightShaft, slabFloor, bevelWallGeo, tileBevel, bevelBox } from './common.js';
import { starVoid } from './abyss.js';
import { voxelBatch, voxMat, place } from './voxel.js';

export const MW = 101, MH = 15;
const WALL_H = 1.7, LOW_H = .45;
const clamp = (v, a, b) => v < a ? a : v > b ? b : v;
const smooth = (a, b, x) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
const easeBack = t => { const c = 1.6; return 1 + (c + 1) * Math.pow(t - 1, 3) + c * Math.pow(t - 1, 2); };

/* ---------- 地图 ----------
  #墙  .石板  ,草地（只留在花坛里）  空格=虚空  *光之桥  L星灯  O石碑  R星纹  G石门  K塔罗牌  A祭坛  W水  J水瓶  T树  C柱  c断柱
  F 七星浮岛：虚空里的锚星与浮岛（见 ANCH）
  G 宝瓶星海：H 双瓶女神像下的承水台；用星光把散落的星鱼引回池里，九尾都回来后化成宝瓶座，降成光桥 */
export const ANCH = [[52, 8], [55, 7], [58, 6], [61, 5], [61, 8], [64, 9], [64, 6]];   // 北斗七星的锚位（3×3 浮岛的左上角）
function buildMap() {
  const g = Array.from({ length: MH }, () => Array(MW).fill(' '));
  const set = (x, z, c) => { if (x >= 0 && z >= 0 && x < MW && z < MH) g[z][x] = c; };
  const fill = (x0, z0, x1, z1, c) => { for (let z = z0; z <= z1; z++) for (let x = x0; x <= x1; x++) set(x, z, c); };
  const room = (x0, z0, x1, z1, fl) => { for (let z = z0; z <= z1; z++) for (let x = x0; x <= x1; x++) set(x, z, (x === x0 || x === x1 || z === z0 || z === z1) ? '#' : fl); };
  // A：星图石庭。地面铺石，草只留在几棵树下的花坛里
  room(0, 1, 12, 13, '.');
  fill(1, 2, 3, 4, ','); fill(9, 2, 11, 3, ','); fill(10, 4, 11, 5, ','); fill(1, 10, 4, 12, ','); fill(8, 10, 11, 12, ',');
  room(24, 1, 36, 13, '.');
  room(36, 1, 49, 13, '.');
  room(70, 1, 88, 13, '.');
  room(88, 1, 100, 13, '.');
  [[12, 6], [12, 7], [12, 8]].forEach(([x, z]) => set(x, z, '.'));
  set(7, 4, 'L');
  [[2, 3], [10, 2], [3, 11], [9, 11], [11, 4]].forEach(([x, z]) => set(x, z, 'T'));
  [[5, 2], [8, 2], [5, 12], [7, 12]].forEach(([x, z]) => set(x, z, 'C'));
  // 虚空中的光之桥
  const br = [[13, 7], [14, 7], [15, 7], [15, 6], [15, 5], [15, 4], [16, 4], [17, 4], [18, 4], [19, 4], [19, 5], [19, 6], [19, 7], [19, 8], [19, 9], [19, 10], [20, 10], [21, 10], [22, 10], [23, 10]];
  br.forEach(([x, z]) => set(x, z, '*'));
  // 长桥中途的两块落脚石：掉下去时从这里复活，不用走回起点
  set(15, 4, '.'); set(19, 7, '.');
  [[16, 9], [17, 9], [16, 10], [17, 10]].forEach(([x, z]) => set(x, z, ','));
  set(17, 9, 'T');
  [[21, 3], [22, 3]].forEach(([x, z]) => set(x, z, '.')); set(22, 3, 'c');
  // C：日晷庭
  [[24, 9], [24, 10], [24, 11]].forEach(([x, z]) => set(x, z, '.'));
  set(30, 7, 'O'); set(32, 4, 'R'); set(26, 3, 'L');
  [[34, 11], [26, 12]].forEach(([x, z]) => set(x, z, 'C')); set(34, 3, 'c');
  [[36, 6], [36, 7], [36, 8]].forEach(([x, z]) => set(x, z, 'G'));
  // D：暗厅（中间一道星渊）
  for (let z = 2; z <= 12; z++) for (let x = 41; x <= 44; x++) set(x, z, ' ');
  [[41, 7], [42, 7], [42, 8], [43, 8], [44, 8]].forEach(([x, z]) => set(x, z, '*'));
  set(39, 10, 'L');
  [[38, 3], [38, 11], [46, 3], [46, 11], [40, 5]].forEach(([x, z]) => set(x, z, 'C'));
  set(48, 12, 'K');
  fill(49, 6, 49, 8, '.');
  // F：七星浮岛。两头是观星台，中间是虚空
  fill(50, 5, 51, 9, '.'); fill(67, 5, 69, 9, '.');
  // G：宝瓶星海。北边是女神像前的长廊，西、南各一条窄道，中间是一片星海；东边的出口只能从星鱼化成的光桥过去
  fill(70, 6, 70, 8, '.');
  fill(72, 5, 86, 11, ' '); fill(85, 12, 86, 12, ' '); fill(86, 2, 87, 4, ' ');
  fill(78, 1, 81, 3, 'H');
  [[71, 2], [71, 12], [84, 12], [77, 2], [82, 2]].forEach(([x, z]) => set(x, z, 'C'));
  fill(88, 6, 88, 8, '.');
  // E：星之泉
  fill(89, 2, 99, 3, ','); fill(89, 11, 99, 12, ','); fill(99, 6, 99, 8, ',');
  for (let x = 90; x <= 93; x++) set(x, 7, '.');
  for (let x = 93; x <= 97; x++) for (let z = 5; z <= 9; z++) set(x, z, 'W');
  set(93, 7, '.'); set(94, 7, '.'); set(95, 7, 'A');
  set(92, 5, 'J'); set(92, 9, 'J');
  [[91, 2], [98, 2], [91, 12], [98, 12], [99, 7], [95, 2], [95, 12]].forEach(([x, z]) => set(x, z, 'T'));
  return g;
}
const SOLID = new Set(['#', 'L', 'O', 'A', 'W', 'J', 'T', 'C', 'c', 'G', 'H']);

// 一簇草：几根像素草叶（挤出厚度后就是立体的草丛）
function tuftCanvas(seed, cols) {
  const c = mk(9, 7), g = c.getContext('2d'), r = TX.rng(seed);
  const n = 3 + (r() * 3 | 0);
  for (let k = 0; k < n; k++) {
    let x = 1 + r() * 7, lean = (r() - .5) * .8; const h = 3 + (r() * 4 | 0);
    for (let y = 0; y < h; y++) { g.fillStyle = cols[Math.min(cols.length - 1, (y / h * cols.length + (k % 2)) | 0)]; g.fillRect(Math.round(x), 6 - y, 1, 1); x += lean * .4; }
  }
  return c;
}

export function buildStar(ctx) {
  const { group: root, camQuat, fx, AU, toast, cine, shake, flash, P, orb } = ctx;
  const grid = buildMap();
  const cell = (x, z) => (x < 0 || z < 0 || x >= MW || z >= MH) ? ' ' : grid[z][x];
  const isVoid = c => c === ' ' || c === '*';
  const L = { lamps: [], bridges: [], sway: [], shards: [], jugs: [], hide: [] };

  /* ================= 材质 ================= */
  const cFloor = TX.floorTexHD(), cGrass = TX.grassTex(), cWallS = TX.wallSideTex(), cWallT = TX.wallTopTex(), cCliff = TX.cliffTex();
  // 抛光大理石：缝隙凹陷明显，能倒映灯光和人
  // 石板不做镜面倒影（倒影跟着光点晃会闪），凹凸也收弱一些
  const matStone = toon({ map: tex(cFloor), normalMap: ntex(cFloor, 3.5), normalScale: new THREE.Vector2(.85, .85), roughness: .5 });
  const matGrass = toon({ map: tex(cGrass), normalMap: ntex(cGrass, 3.4), roughness: .95 });
  const ws = toon({ map: tex(cWallS), normalMap: ntex(cWallS, 5.5), normalScale: new THREE.Vector2(1.4, 1.4), roughness: .7 });
  const wt = toon({ map: tex(cWallT), normalMap: ntex(cWallT, 3), roughness: .45, color: 0x9896b8 });
  const stoneM = toon({ color: 0x9c96bf, roughness: .42, metalness: .05 });
  const goldM = toon({ color: 0xd1b072, roughness: .28, metalness: .85 });

  /* ================= 地面 / 崖壁 / 墙 ================= */
  const floors = { '.': [], ',': [] }, cliffs = [];
  for (let z = 0; z < MH; z++) for (let x = 0; x < MW; x++) {
    const c = grid[z][x]; if (isVoid(c)) continue;
    const kind = (c === ',' || c === 'T' && (x < 13 || x > 88 || (x > 15 && x < 18))) ? ',' : '.';
    if (c !== 'W') floors[kind].push([x, z]);
    [[0, 1], [0, -1], [1, 0], [-1, 0]].forEach(([dx, dz]) => { const n = cell(x + dx, z + dz); if (isVoid(n)) cliffs.push([x, z, dx, dz]); });
  }
  // 大理石地面：一格一块有厚度、倒角的石板，缝里是暗的
  root.add(slabFloor(floors['.'], matStone, { seed: 1, tile: 4 }));
  const fg = new THREE.Mesh(quadGeo(floors[',']), matGrass); fg.receiveShadow = true; root.add(fg);
  const cliffM = toon({ map: tex(cCliff), normalMap: ntex(cCliff, 4), side: THREE.DoubleSide });
  root.add(cliffMesh(cliffs, cliffM));
  const tall = [], low = [];
  for (let z = 0; z < MH; z++) for (let x = 0; x < MW; x++) if (grid[z][x] === '#') (z === 13 ? low : tall).push([x, z]);
  const wallMats = [ws, wt];
  instWalls(root, tall, bevelWallGeo(WALL_H), wallMats); instWalls(root, low, bevelWallGeo(LOW_H), wallMats);
  {
    const trim = new THREE.InstancedMesh(new THREE.BoxGeometry(1.02, .06, 1.02), toon({ color: 0x8a8fc4, metalness: .4, roughness: .35 }), tall.length);
    const M = new THREE.Matrix4(); tall.forEach(([x, z], i) => { M.makeTranslation(x + .5, WALL_H - .12, z + .5); trim.setMatrixAt(i, M); });
    root.add(trim);
  }

  /* ================= 星空深渊 ================= */
  const voidMat = starVoid();
  const voidPlane = new THREE.Mesh(new THREE.PlaneGeometry(400, 400), voidMat);
  voidPlane.rotation.x = -Math.PI / 2; voidPlane.position.set(30, -7, 7); root.add(voidPlane);
  L.hide.push(voidPlane);

  /* ================= 光之桥 ================= */
  const bridgeT = tex(TX.bridgeTex());
  const bGeo = tileBevel(.94, .12); bGeo.translate(0, -.12, 0);
  for (let z = 0; z < MH; z++) for (let x = 0; x < MW; x++) if (grid[z][x] === '*') {
    const mat = reflective(toon({ map: bridgeT, emissive: 0x6f8fe0, emissiveIntensity: 0, transparent: true, opacity: .1, depthWrite: false, roughness: .12 }), .25);
    const m = new THREE.Mesh(bGeo, mat); m.position.set(x + .5, 0, z + .5); m.receiveShadow = true; root.add(m);
    L.bridges.push({ x, z, lit: 0, mesh: m, mat });
  }

  /* ================= 树 ================= */
  const crownA = tex(TX.foliageTex(['#4a2a55', '#7d3f6e', '#b5628a', '#e091ad', '#f6c3cf']));
  const crownB = tex(TX.foliageTex(['#173444', '#22545d', '#348074', '#5bb39a', '#a5e0c4']));
  const trunkM = toon({ color: 0x3a2c52 });
  const addTree = (x, z, v) => {
    const g0 = new THREE.Group(); g0.position.set(x + .5, 0, z + .5);
    const trunk = new THREE.Mesh(new THREE.CylinderGeometry(.05, .09, .9, 5), trunkM); trunk.position.y = .45; g0.add(trunk);
    const mat = toon({ map: v ? crownB : crownA, flatShading: true, roughness: .6 });
    if (hashv(x, z) > .45) {
      [[.55, 1.0, 1.15], [.4, .8, 1.65], [.24, .5, 2.05]].forEach(([r, h, y]) => { const c = new THREE.Mesh(new THREE.ConeGeometry(r, h, 6), mat); c.position.y = y; g0.add(c); });
    } else {
      const s = new THREE.Mesh(new THREE.IcosahedronGeometry(.58, 0), mat); s.position.y = 1.35; g0.add(s);
      const s2 = new THREE.Mesh(new THREE.IcosahedronGeometry(.3, 0), mat); s2.position.set(.3, 1.85, .1); g0.add(s2);
    }
    g0.rotation.y = hashv(z, x) * 6.28; shadowAll(g0);
    root.add(g0); L.sway.push({ o: g0, ph: hashv(x, z) * 6 });
  };

  /* ================= 柱子 ================= */
  const cCol = TX.columnTex();
  const colM = toon({ map: tex(cCol), normalMap: ntex(cCol, 4), normalScale: new THREE.Vector2(1.3, 1.3), roughness: .35 });
  const addColumn = (x, z, broken) => {
    const g0 = new THREE.Group(); g0.position.set(x + .5, 0, z + .5);
    const h = broken ? .9 + hashv(x, z) * .5 : 2.2;
    const base = new THREE.Mesh(new THREE.BoxGeometry(.8, .16, .8), colM); base.position.y = .08; g0.add(base);
    const shaft = new THREE.Mesh(new THREE.CylinderGeometry(.26, .29, h, 8), colM); shaft.position.y = .16 + h / 2; g0.add(shaft);
    if (!broken) { const cap = new THREE.Mesh(new THREE.BoxGeometry(.78, .18, .78), colM); cap.position.y = .16 + h + .09; g0.add(cap); const band = new THREE.Mesh(new THREE.CylinderGeometry(.3, .3, .05, 8), goldM); band.position.y = .16 + h - .2; g0.add(band); }
    else { const chunk = new THREE.Mesh(new THREE.DodecahedronGeometry(.22, 0), colM); chunk.position.set(.45, .15, .35); g0.add(chunk); }
    shadowAll(g0); root.add(g0);
  };

  /* ================= 星灯 ================= */
  const haloT = tex(haloCanvas(64)); haloT.wrapS = haloT.wrapT = THREE.ClampToEdgeWrapping;
  const addLamp = (x, z) => {
    const g0 = new THREE.Group(); g0.position.set(x + .5, 0, z + .5);
    const ped = new THREE.Mesh(new THREE.CylinderGeometry(.2, .3, .8, 8), stoneM); ped.position.y = .4; g0.add(ped);
    const ring = new THREE.Mesh(new THREE.CylinderGeometry(.24, .24, .06, 8), goldM); ring.position.y = .62; g0.add(ring);
    const bowl = new THREE.Mesh(new THREE.CylinderGeometry(.36, .14, .2, 8), stoneM); bowl.position.y = .9; g0.add(bowl);
    const lip = new THREE.Mesh(new THREE.TorusGeometry(.36, .025, 4, 16), goldM); lip.rotation.x = Math.PI / 2; lip.position.y = 1.0; g0.add(lip);
    const cm = new THREE.MeshStandardMaterial({ roughness: .3, color: 0x8f8cc8, emissive: 0xffd89a, emissiveIntensity: 0 });
    const crystal = new THREE.Mesh(new THREE.OctahedronGeometry(.17, 0), cm); crystal.position.y = 1.28; g0.add(crystal);
    shadowAll(g0); crystal.castShadow = false;
    const halo = billboard(haloT, 2.4, 2.4, true, camQuat); halo.position.set(0, 1.28, 0); halo.material.color.set(0xffd89a); halo.material.opacity = 0; g0.add(halo);
    const light = new THREE.PointLight(0xffd29a, 0, 9, 1.4); light.position.y = 1.3; g0.add(light);
    root.add(g0);
    // 点亮后天上落下一束暖金色的星光
    const shaft = lightShaft(root, x + .5, z + .5, { color: 0xffd89a, r: 1.5, h: 6.5, I: 14, k: .55, on: false, hide: L.hide });
    L.lamps.push({ x: x + .5, z: z + .5, lit: false, t: 0, crystal, cm, halo, light, shaft, g: g0 });
  };

  /* ================= 石碑（日晷）与星纹 ================= */
  const cOb = TX.obeliskTex();
  const addObelisk = (x, z) => {
    const g0 = new THREE.Group(); g0.position.set(x + .5, 0, z + .5);
    const base = new THREE.Mesh(new THREE.BoxGeometry(.9, .2, .9), stoneM); base.position.y = .1; g0.add(base);
    const body = new THREE.Mesh(new THREE.CylinderGeometry(.2, .34, 2.6, 4, 1), toon({ map: tex(cOb), normalMap: ntex(cOb, 4), roughness: .35 })); body.rotation.y = Math.PI / 4; body.position.y = .2 + 1.3; g0.add(body);
    const tip = new THREE.Mesh(new THREE.ConeGeometry(.2, .36, 4), goldM); tip.rotation.y = Math.PI / 4; tip.position.y = .2 + 2.6 + .18; g0.add(tip);
    shadowAll(g0); root.add(g0); L.obelisk = { x: x + .5, z: z + .5, g: g0, top: 3 };
  };
  const runeT = tex(mk(1, 1)); runeT.image = TX.runeTex(); runeT.needsUpdate = true; runeT.wrapS = runeT.wrapT = THREE.ClampToEdgeWrapping;
  const addRune = (x, z) => {
    const mat = new THREE.MeshBasicMaterial({ map: runeT, color: 0xe8c98e, transparent: true, opacity: .25, blending: THREE.AdditiveBlending, depthWrite: false });
    const m = new THREE.Mesh(new THREE.PlaneGeometry(1.2, 1.2), mat); m.rotation.x = -Math.PI / 2; m.position.set(x + .5, .01, z + .5); m.layers.set(LAYER_FX); root.add(m);
    const light = new THREE.PointLight(0xffd89a, 0, 4, 1.5); light.position.set(x + .5, .5, z + .5); root.add(light);
    L.rune = { x: x + .5, z: z + .5, mat, light, hold: 0, solved: false };
  };

  /* ================= 石门 + 两侧巨大的齿轮、门框星环（舞台机关） ================= */
  const cGate = TX.gateTex(), gateT = tex(cGate), gateN = ntex(cGate, 4);
  const gearGeo = (r, teeth, th) => {
    const sh = new THREE.Shape();
    for (let i = 0; i <= teeth * 2; i++) { const a = i / (teeth * 2) * Math.PI * 2, rr = i % 2 ? r : r * .86; const a2 = a + Math.PI / teeth * .5; if (i === 0) sh.moveTo(Math.cos(a) * rr, Math.sin(a) * rr); else { sh.lineTo(Math.cos(a) * rr, Math.sin(a) * rr); sh.lineTo(Math.cos(a2) * rr, Math.sin(a2) * rr); } }
    const hole = new THREE.Path(); hole.absarc(0, 0, r * .3, 0, Math.PI * 2, true); sh.holes.push(hole);
    const g = new THREE.ExtrudeGeometry(sh, { depth: th, bevelEnabled: false, curveSegments: 4 }); g.translate(0, 0, -th / 2); return g;
  };
  const addGate = (x, z0, z1) => {
    const len = z1 - z0 + 1;
    const gm = toon({ map: gateT, normalMap: gateN, normalScale: new THREE.Vector2(1.5, 1.5), roughness: .5 });
    const m = new THREE.Mesh(new THREE.BoxGeometry(.5, WALL_H, len), [gm, gm, wt, wt, ws, ws]);
    m.position.set(x + .5, WALL_H / 2, z0 + len / 2); m.castShadow = m.receiveShadow = true; root.add(m);
    const gears = [z0 - 1.4, z1 + 2.4].map((gz, i) => {
      const g = new THREE.Mesh(gearGeo(.8, 10, .16), goldM); g.rotation.y = Math.PI / 2; g.position.set(x - .02, 1.05, gz); g.castShadow = true; root.add(g);
      const hub = new THREE.Mesh(new THREE.CylinderGeometry(.16, .16, .3, 8), stoneM); hub.rotation.z = Math.PI / 2; hub.position.copy(g.position); root.add(hub);
      return g;
    });
    const arch = new THREE.Mesh(new THREE.TorusGeometry(1.75, .07, 6, 40, Math.PI), goldM); arch.rotation.y = Math.PI / 2; arch.position.set(x - .05, 0, z0 + len / 2); root.add(arch);
    const archGlow = new THREE.MeshBasicMaterial({ color: 0xffd89a, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false });
    const glow = new THREE.Mesh(new THREE.TorusGeometry(1.75, .12, 6, 40, Math.PI), archGlow); glow.rotation.y = Math.PI / 2; glow.position.copy(arch.position); glow.layers.set(LAYER_FX); root.add(glow);
    L.gate = { x, z0, z1, m, open: 0, opening: false, gears, glow, arch };
  };

  /* ================= 塔罗牌 ================= */
  const addCard = (x, z) => {
    const front = tex(starCardCanvas()), back = tex(cardBackCanvas());
    front.wrapS = front.wrapT = back.wrapS = back.wrapT = THREE.ClampToEdgeWrapping;
    const g0 = new THREE.Group(); g0.position.set(x + .5, 0, z + .5);
    const fm = toon({ map: front, transparent: true, opacity: 0, emissive: 0xffffff, emissiveMap: front, emissiveIntensity: .7, side: THREE.FrontSide });
    const bm = toon({ map: back, transparent: true, opacity: 0, emissive: 0xffffff, emissiveMap: back, emissiveIntensity: .7 });
    const f = new THREE.Mesh(new THREE.PlaneGeometry(.75, 1.25), fm), b = new THREE.Mesh(new THREE.PlaneGeometry(.75, 1.25), bm);
    b.rotation.y = Math.PI; f.castShadow = b.castShadow = true;
    const holder = new THREE.Group(); holder.add(f, b); holder.position.y = 1.0; g0.add(holder);
    const halo = billboard(haloT, 2.6, 2.6, true, camQuat); halo.material.color.set(0x9fb4ff); halo.material.opacity = 0; halo.position.y = 1; g0.add(halo);
    root.add(g0);
    L.card = { x: x + .5, z: z + .5, g: g0, holder, fm, bm, halo, vis: 0, taken: false };
  };

  /* ================= 祭坛与星泉 ================= */
  const addAltar = (x, z) => {
    const g0 = new THREE.Group(); g0.position.set(x + .5, 0, z + .5);
    const b1 = new THREE.Mesh(new THREE.CylinderGeometry(.62, .7, .3, 8), stoneM); b1.position.y = .15; g0.add(b1);
    const b2 = new THREE.Mesh(new THREE.CylinderGeometry(.42, .5, .5, 8), stoneM); b2.position.y = .55; g0.add(b2);
    const top = new THREE.Mesh(new THREE.CylinderGeometry(.55, .45, .12, 8), goldM); top.position.y = .86; g0.add(top);
    shadowAll(g0);
    const sm = new THREE.MeshStandardMaterial({ roughness: .4, color: 0xfff3b8, emissive: 0xffe2a0, emissiveIntensity: 1.2 });
    const star = new THREE.Mesh(new THREE.OctahedronGeometry(.42, 0), sm); star.scale.set(.6, 1, .6); star.position.y = .3; star.visible = false; g0.add(star);
    const halo = billboard(haloT, 3.4, 3.4, true, camQuat); halo.material.color.set(0xffe9b0); halo.material.opacity = 0; halo.position.y = 1.4; g0.add(halo);
    const light = new THREE.PointLight(0xfff0c8, 0, 18, 1.1); light.position.y = 3; g0.add(light);
    const cardM = toon({ map: tex(starCardCanvas()), transparent: true, opacity: 0, emissive: 0x8888cc, emissiveIntensity: .6 });
    cardM.map.wrapS = cardM.map.wrapT = THREE.ClampToEdgeWrapping;
    const slot = new THREE.Mesh(new THREE.PlaneGeometry(.45, .75), cardM); slot.position.y = 1.35; slot.quaternion.copy(camQuat); g0.add(slot);
    root.add(g0);
    // 星冠：通关时从天而降、在祭坛上空旋转的巨大星环
    const crown = new THREE.Group(); crown.position.set(x + .5, 11, z + .5);
    const r1 = new THREE.Mesh(new THREE.TorusGeometry(2.6, .06, 6, 64), goldM), r2 = new THREE.Mesh(new THREE.TorusGeometry(2.1, .04, 6, 64), goldM);
    r1.rotation.x = r2.rotation.x = Math.PI / 2; crown.add(r1, r2);
    for (let i = 0; i < 8; i++) { const a = i / 8 * Math.PI * 2; const s = new THREE.Mesh(new THREE.OctahedronGeometry(.16, 0), sm); s.position.set(Math.cos(a) * 2.6, 0, Math.sin(a) * 2.6); crown.add(s); }
    crown.visible = false; root.add(crown);
    L.altar = { x: x + .5, z: z + .5, g: g0, star, sm, halo, light, slot, cardM, crown };
    L.hide.push(halo);
  };
  // 水面
  {
    const cells = []; for (let z = 0; z < MH; z++) for (let x = 0; x < MW; x++) if (grid[z][x] === 'W') cells.push([x, z]);
    const cW = TX.waterTex(), wtx = tex(cW), wn = ntex(cW, 2.2);
    const wm = reflective(toon({ map: wtx, normalMap: wn, transparent: true, opacity: .92, emissive: 0x1a2a66, emissiveIntensity: .3, roughness: .26, metalness: .1 }), .45, .5);
    const m = new THREE.Mesh(quadGeo(cells, -.14, 2), wm); m.receiveShadow = true; root.add(m);
    const rim = new THREE.Mesh(quadGeo(cells, -.5, 2), toon({ color: 0x141a3a })); root.add(rim);
    L.water = { tex: wtx, ntex: wn, mat: wm };
  }
  const addJug = (x, z, side) => {
    const pts = []; [[0, 0], [.16, .02], [.22, .14], [.2, .3], [.1, .42], [.08, .5], [.13, .56]].forEach(([r, y]) => pts.push(new THREE.Vector2(r, y)));
    const g0 = new THREE.Group(); g0.position.set(x + .5, 0, z + .5);
    const ped = new THREE.Mesh(new THREE.BoxGeometry(.6, .4, .6), stoneM); ped.position.y = .2; g0.add(ped);
    const jug = new THREE.Mesh(new THREE.LatheGeometry(pts, 7), toon({ color: 0xd1b072, flatShading: true, metalness: .7, roughness: .3 }));
    jug.position.set(0, .4, 0); jug.rotation.z = -.9; jug.rotation.y = side * .5; jug.scale.setScalar(1.3); g0.add(jug);
    shadowAll(g0); root.add(g0);
    L.jugs.push({ x: x + .5, z: z + .5, mouth: new THREE.Vector3(x + .5 + .55, .9, z + .5 + side * .1) });
  };

  for (let z = 0; z < MH; z++) for (let x = 0; x < MW; x++) {
    const c = grid[z][x];
    if (c === 'T') addTree(x, z, (x + z) % 3 === 0 ? 1 : 0);
    else if (c === 'C') addColumn(x, z, false);
    else if (c === 'c') addColumn(x, z, true);
    else if (c === 'L') addLamp(x, z);
    else if (c === 'O') addObelisk(x, z);
    else if (c === 'R') addRune(x, z);
    else if (c === 'K') addCard(x, z);
    else if (c === 'A') addAltar(x, z);
    else if (c === 'J') addJug(x, z, z < 7 ? 1 : -1);
  }
  addGate(36, 6, 8);
  L.lamps.sort((a, b) => a.x - b.x);

  /* ================= 星仪：光之桥下方虚空中的巨大浑天仪（舞台机关） ================= */
  const orrery = new THREE.Group(); orrery.position.set(18.5, -3.4, 7.2); root.add(orrery);
  const ringM = toon({ color: 0xc9a964, roughness: .25, metalness: .9, emissive: 0x3a2a10, emissiveIntensity: .4 });
  const rings = [5.4, 4.4, 3.5].map((r, i) => {
    const pivot = new THREE.Group(); orrery.add(pivot);
    const tor = new THREE.Mesh(new THREE.TorusGeometry(r, .09, 6, 72), ringM); pivot.add(tor);
    // 环上的星珠
    for (let k = 0; k < 4; k++) { const a = k / 4 * Math.PI * 2 + i; const b = new THREE.Mesh(new THREE.OctahedronGeometry(.18, 0), new THREE.MeshStandardMaterial({ color: 0xfff3b8, emissive: 0xffd89a, emissiveIntensity: .3, roughness: .3 })); b.position.set(Math.cos(a) * r, Math.sin(a) * r, 0); tor.add(b); }
    const tilt = [[1.1, .3], [-.8, .9], [.4, -1.2]][i];
    pivot.rotation.set(tilt[0], tilt[1], 0);
    return { pivot, tor, tilt, align: 0, aligning: false, spin: .12 + i * .05, beads: tor.children };
  });
  const hubM = new THREE.MeshStandardMaterial({ color: 0xfff3b8, emissive: 0xffd89a, emissiveIntensity: .5, roughness: .3 });
  const hub = new THREE.Mesh(new THREE.OctahedronGeometry(.7, 0), hubM); orrery.add(hub);
  const axle = new THREE.Mesh(new THREE.CylinderGeometry(.06, .06, 14, 6), ringM); orrery.add(axle);
  // 暗厅星渊里的巨大齿轮组
  const gearM = toon({ color: 0x8a7a58, roughness: .35, metalness: .8 });
  const bigGears = [[42.5, -1.7, 4.6, 1.7, 16, 1], [43.6, -2.2, 8.6, 1.25, 12, -1.35], [41.7, -1.9, 11.3, 1.0, 10, 1.6]].map(([x, y, z, r, t, sp]) => {
    const g = new THREE.Mesh(gearGeo(r, t, .3), gearM); g.rotation.x = -Math.PI / 2; g.position.set(x, y, z); root.add(g); return { g, sp };
  });

  /* ================= 小花、碎片 ================= */
  // 花和草丛都是挤出厚度的像素画（体素），不再是贴在镜头前的纸片
  const flowerCs = [flowerCanvas('#f4a3b6', '#2f6b5e'), flowerCanvas('#fff3b8', '#2f6b5e'), flowerCanvas('#bfe3ff', '#2f6b5e')];
  const tuftCs = [11, 12, 13].map(s => tuftCanvas(s, ['#1d3a48', '#264d55', '#33615f', '#457a6c', '#64987f']));
  const vm = voxMat(), fP = [[], [], []], tP = [[], [], []];
  const r = TX.rng(77);
  for (let z = 0; z < MH; z++) for (let x = 0; x < MW; x++) if (grid[z][x] === ',') {
    const n = r() < .45 ? 1 : 0;
    for (let k = 0; k < n; k++) fP[r() * 3 | 0].push(place(x + .15 + r() * .7, 0, z + .15 + r() * .7, (r() - .5) * .8, .3));
    const nt = r() < .5 ? 1 : 0;
    for (let k = 0; k < nt; k++) tP[r() * 3 | 0].push(place(x + .1 + r() * .8, 0, z + .1 + r() * .8, (r() - .5) * 1.2, .2, .9 + r() * .4));
  }
  flowerCs.forEach((c, i) => root.add(voxelBatch(c, fP[i], vm, { maxT: .07, minT: .045, slope: .02 })));
  tuftCs.forEach((c, i) => root.add(voxelBatch(c, tP[i], vm, { maxT: .06, minT: .05, slope: 0 })));
  const shardM = toon({ color: 0xb7a6d6, emissive: 0x3a3a8a, emissiveIntensity: .4, flatShading: true });
  const sr = TX.rng(9);
  for (let i = 0; i < 46; i++) {
    let x, z, tries = 0; do { x = sr() * MW; z = -2 + sr() * (MH + 4); tries++; } while (!isVoid(cell(x | 0, z | 0)) && tries < 30);
    const geo = sr() < .5 ? new THREE.OctahedronGeometry(.08 + sr() * .16, 0) : new THREE.TetrahedronGeometry(.1 + sr() * .18, 0);
    const m = new THREE.Mesh(geo, shardM); const y = -.6 - sr() * 3;
    m.position.set(x, y, z); m.castShadow = true; root.add(m);
    L.shards.push({ m, y, ph: sr() * 6.28, sp: .3 + sr() * .6 });
  }

  /* ================= F · 七星浮岛 =================
     虚空里有七颗锚星（北斗的形状）和三座浮岛。光点停在一颗空着的锚星上，离它最近的空闲浮岛会被星光牵过去对接。
     站着人的浮岛不会动；浮岛比锚星少，要把身后的岛召到前面，一步步渡过虚空。七颗星都接过一次浮岛，北斗成形 */
  const starInlay = (() => { const c = mk(32, 32), g = c.getContext('2d'); g.fillStyle = '#fff'; g.beginPath();
    for (let i = 0; i < 16; i++) { const a = i / 16 * Math.PI * 2 - Math.PI / 2, r = i % 2 ? 5 : (i % 4 ? 10 : 15); g.lineTo(16 + Math.cos(a) * r, 16 + Math.sin(a) * r); } g.fill();
    g.strokeStyle = '#fff'; g.lineWidth = 1; g.beginPath(); g.arc(16, 16, 15, 0, 7); g.stroke(); return c; })();
  const inlayT = tex(starInlay); inlayT.wrapS = inlayT.wrapT = THREE.ClampToEdgeWrapping;
  const isleTopM = toon({ map: tex(cFloor, .75), normalMap: ntex(cFloor, 3.5, .75), normalScale: new THREE.Vector2(.85, .85), roughness: .5 });
  const isleRockM = toon({ map: tex(cCliff), normalMap: ntex(cCliff, 4), color: 0xa49cc8, flatShading: true });
  const anchors = ANCH.map(([x, z], i) => {
    const cx = x + 1.5, cz = z + 1.5;
    const sm = new THREE.MeshStandardMaterial({ color: 0x9a94d0, roughness: .3, emissive: 0xffe2a0, emissiveIntensity: .25 });
    const star = new THREE.Mesh(new THREE.OctahedronGeometry(.26, 0), sm); star.scale.set(.7, 1.3, .7); star.position.set(cx, -.35, cz); root.add(star);
    const rm = new THREE.MeshBasicMaterial({ color: 0xffd89a, transparent: true, opacity: .12, blending: THREE.AdditiveBlending, depthWrite: false });
    const ring = new THREE.Mesh(new THREE.RingGeometry(.665, .7, 48), rm); ring.rotation.x = -Math.PI / 2; ring.position.set(cx, -.3, cz); ring.layers.set(LAYER_FX); root.add(ring);
    return { i, x, z, cx, cz, sm, star, rm, ring, charge: 0, isle: null, visited: false };
  });
  const isles = [0, 1, 2].map(k => {
    const g0 = new THREE.Group(); root.add(g0);
    const top = new THREE.Mesh(bevelBox(2.96, .34, 2.96, .05), isleTopM); top.position.y = -.34; g0.add(top);
    const band = new THREE.Mesh(new THREE.BoxGeometry(3.04, .1, 3.04), goldM); band.position.y = -.3; g0.add(band);
    const rock = new THREE.Mesh(new THREE.ConeGeometry(2.05, 2.8, 4, 1), isleRockM); rock.rotation.set(Math.PI, Math.PI / 4, 0); rock.position.y = -.36 - 1.4; g0.add(rock);
    const rock2 = new THREE.Mesh(new THREE.ConeGeometry(.7, 1.3, 4, 1), isleRockM); rock2.rotation.set(Math.PI, .3, 0); rock2.position.set(.9, -2.2, -.6); g0.add(rock2);
    const im = new THREE.MeshStandardMaterial({ map: inlayT, transparent: true, alphaTest: .4, color: 0xd8c08a, roughness: .25, metalness: .7, emissive: 0xffd89a, emissiveMap: inlayT, emissiveIntensity: 0 });
    const inlay = new THREE.Mesh(new THREE.PlaneGeometry(1.5, 1.5), im); inlay.rotation.x = -Math.PI / 2; inlay.position.y = .012; g0.add(inlay);
    shadowAll(g0); inlay.castShadow = false;
    return { k, g: g0, im, x: 0, z: 0, y: 0, state: 'free', anchor: null, home: [[57, 13.2], [60.5, 2.2], [53.5, 3.4]][k], ph: k * 2.1, fly: null, glow: 0 };
  });
  // 初始：一座浮岛已经停在第一颗星上（教学），另外两座在虚空里漂
  const dock = (isle, a) => { isle.state = 'dock'; isle.anchor = a; a.isle = isle; isle.x = a.x; isle.z = a.z; isle.y = 0; a.visited = true; };
  // 北斗连线：画在虚空深处，像星图
  const DIPPER = [[0, 1], [1, 2], [2, 3], [3, 4], [4, 5], [5, 6], [6, 3]];
  const DEEP = -2.6;
  const dipLines = DIPPER.map(([a, b]) => {
    const A = anchors[a], Bn = anchors[b];
    const gm = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(A.cx, DEEP, A.cz), new THREE.Vector3(Bn.cx, DEEP, Bn.cz)]);
    const m = new THREE.Line(gm, new THREE.LineBasicMaterial({ color: 0xffe2a8, transparent: true, opacity: .06, blending: THREE.AdditiveBlending, depthWrite: false }));
    m.layers.set(LAYER_FX); root.add(m); return { m, a, b, k: 0 };
  });
  const deepStars = anchors.map(a => { const m = billboard(haloT, 1.1, 1.1, true, camQuat); m.material.color.set(0xffe2a8); m.material.opacity = .08; m.position.set(a.cx, DEEP, a.cz); root.add(m); L.hide.push(m); return m; });
  // 指极星：天枢指向北方的北极星，那里有第四盏星灯
  const POLE = [65, 1];
  const poleSpire = new THREE.Group(); poleSpire.position.set(POLE[0] + .5, 0, POLE[1] + .5); root.add(poleSpire);
  {
    const cap = new THREE.Mesh(new THREE.CylinderGeometry(.62, .5, .3, 8), colM); cap.position.y = -.15; poleSpire.add(cap);
    const sp = new THREE.Mesh(new THREE.ConeGeometry(.55, 5.5, 8, 1), isleRockM); sp.rotation.x = Math.PI; sp.position.y = -.3 - 2.75; poleSpire.add(sp);
    const ring = new THREE.Mesh(new THREE.TorusGeometry(.62, .04, 4, 24), goldM); ring.rotation.x = Math.PI / 2; ring.position.y = -.02; poleSpire.add(ring);
    shadowAll(poleSpire);
  }
  const pointerM = new THREE.LineBasicMaterial({ color: 0xfff0c8, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false });
  const pointer = new THREE.Line(new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(anchors[5].cx, 1.2, anchors[5].cz), new THREE.Vector3(POLE[0] + .5, 1.28, POLE[1] + .5)]), pointerM);
  pointer.layers.set(LAYER_FX); root.add(pointer);
  // 虚空深处的八芒星：一座缓慢转动的巨大星框，北斗每亮一颗星它就亮一分
  const bigStar = new THREE.Group(); bigStar.position.set(59.5, -6.2, 7.5); root.add(bigStar);
  const bigStarM = toon({ color: 0x4e4660, roughness: .55, metalness: .45, emissive: 0xffd89a, emissiveIntensity: .012, transparent: true, opacity: .55 });   // 只是装饰：压暗，让北斗连线做主角
  for (let sq = 0; sq < 2; sq++) for (let e = 0; e < 4; e++) {
    const a = e * Math.PI / 2 + sq * Math.PI / 4, R = 5.6;
    const bar = new THREE.Mesh(new THREE.BoxGeometry(R * Math.SQRT2, .07, .07), bigStarM);
    const mx = Math.cos(a + Math.PI / 4) * R * Math.SQRT1_2, mz = Math.sin(a + Math.PI / 4) * R * Math.SQRT1_2;
    bar.position.set(mx, 0, mz); bar.rotation.y = -(a + Math.PI / 4) + Math.PI / 2; bigStar.add(bar);
  }
  { const r1 = new THREE.Mesh(new THREE.TorusGeometry(3.0, .045, 5, 64), bigStarM); r1.rotation.x = Math.PI / 2; bigStar.add(r1);
    const hubS = new THREE.Mesh(new THREE.OctahedronGeometry(.5, 0), bigStarM); bigStar.add(hubS); }
  // 两头的观星台：一对星塔门柱
  const pylonStarM = new THREE.MeshStandardMaterial({ color: 0xfff3b8, emissive: 0xffd89a, emissiveIntensity: .7, roughness: .3 });
  const addPylons = (x, z0, z1) => [z0, z1].forEach(z => {
    const g0 = new THREE.Group(); g0.position.set(x, 0, z); root.add(g0);
    const base = new THREE.Mesh(bevelBox(.62, .2, .62, .04), colM); g0.add(base);
    const col = new THREE.Mesh(bevelBox(.4, 1.3, .4, .04), colM); col.position.y = .2; g0.add(col);
    const cap = new THREE.Mesh(new THREE.BoxGeometry(.52, .08, .52), goldM); cap.position.y = 1.54; g0.add(cap);
    const st = new THREE.Mesh(new THREE.OctahedronGeometry(.18, 0), pylonStarM); st.scale.y = 1.4; st.position.y = 1.9; g0.add(st);
    shadowAll(g0); st.castShadow = false; L.sway.push({ o: st, ph: x + z, spin: true });
  });
  addPylons(50.5, 5.4, 9.6); addPylons(68.5, 5.4, 9.6);

  /* ================= G · 宝瓶星海 =================
     女神手里的水瓶空了：瓶里的九尾星鱼散落在星海里，被礁石隔成三处。星鱼喜欢光，会追着星光游，
     但游得比光慢，光走太快、离太远就会跟丢；礁石挡住光时它们也看不见。把星鱼引到女神像前，它们会跃回池里。
     九尾都回来后，星鱼升上夜空化成宝瓶座的九颗星，星座降到海面上变成光桥，中心升起第五盏星灯 */
  const waterT = tex(TX.waterTex()), waterN = ntex(TX.waterTex(), 2.2);
  const poolM = toon({ map: waterT, normalMap: waterN, color: 0x7f9ce8, transparent: true, opacity: .8, emissive: 0x2a4a9a, emissiveIntensity: .38, roughness: .15 });
  // 承水台与双瓶像
  const headWater = new THREE.Mesh(new THREE.PlaneGeometry(3.7, 1.7), poolM); headWater.rotation.x = -Math.PI / 2; headWater.position.set(80, .345, 3); root.add(headWater);
  { const rimB = new THREE.Mesh(bevelBox(4, .34, 2, .05), stoneM); rimB.position.set(80, 0, 3); rimB.castShadow = rimB.receiveShadow = true; root.add(rimB);
    [[0, -1, 4.04, .1], [0, 1, 4.04, .1], [-2, 0, .1, 2.04], [2, 0, .1, 2.04]].forEach(([dx, dz, w, d]) => { const e = new THREE.Mesh(new THREE.BoxGeometry(w, .1, d), goldM); e.position.set(80 + dx, .38, 3 + dz); root.add(e); }); }
  let halo8;
  const statue = new THREE.Group(); statue.position.set(80, 0, 1.55); root.add(statue);
  const jugs2 = [];
  {
    const body = new THREE.Mesh(new THREE.CylinderGeometry(.32, .62, 3.2, 8), colM); body.position.y = 1.9; statue.add(body);
    const head = new THREE.Mesh(new THREE.SphereGeometry(.34, 10, 8), colM); head.position.y = 3.75; statue.add(head);
    // 头后巨大的八芒星光环
    halo8 = new THREE.Group(); halo8.position.set(0, 3.75, -.25); statue.add(halo8);
    for (let i = 0; i < 8; i++) { const r = new THREE.Mesh(new THREE.BoxGeometry(.08, i % 2 ? .9 : 1.5, .06), goldM); r.rotation.z = i * Math.PI / 4; r.position.set(Math.sin(-i * Math.PI / 4) * (i % 2 ? .75 : 1.05), Math.cos(i * Math.PI / 4) * (i % 2 ? .75 : 1.05), 0); halo8.add(r); }
    const hr = new THREE.Mesh(new THREE.TorusGeometry(.62, .04, 4, 32), goldM); halo8.add(hr);
    [-1, 1].forEach(s => {
      const arm = new THREE.Group(); arm.position.set(s * .3, 2.9, .1); statue.add(arm);
      const bar = new THREE.Mesh(new THREE.BoxGeometry(1.3, .12, .12), goldM); bar.position.x = s * .65; arm.add(bar);
      const pts = []; [[0, 0], [.2, .02], [.28, .18], [.25, .38], [.13, .52], [.1, .62], [.16, .7]].forEach(([r, y]) => pts.push(new THREE.Vector2(r, y)));
      const jug = new THREE.Mesh(new THREE.LatheGeometry(pts, 8), toon({ color: 0xd1b072, flatShading: true, metalness: .7, roughness: .3 }));
      const holder = new THREE.Group(); holder.position.set(s * 1.3, 0, 0); arm.add(holder);
      jug.position.y = -.35; holder.add(jug);
      jugs2.push({ s, arm, holder, tilt: 0 });
    });
    shadowAll(statue);
  }
  const streamM = new THREE.MeshBasicMaterial({ color: 0xbfe0ff, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false });
  const streams = [-1, 1].map(s => { const m = new THREE.Mesh(new THREE.CylinderGeometry(.05, .09, 1, 6, 1, true), streamM); m.layers.set(LAYER_FX); root.add(m); L.hide.push(m); return m; });
  // 宝瓶座：九颗星、十条线（星鱼归池后才出现）
  const SY = 1.6;
  const CN = { A: [74.5, 9.5], B: [75.6, 6.3], C: [77.4, 11], D: [78.5, 8.5], E: [80, 5.5], F: [82, 11], G: [83, 6.3], H: [84.6, 9.3], I: [87.5, 8.5] };
  const CE = ['AB', 'AC', 'BD', 'CD', 'DE', 'EG', 'DF', 'FH', 'GH', 'HI'];
  const skyG = new THREE.Group(); root.add(skyG);          // 悬在空中的星与星线，连成后整体降到海面
  const plankG = new THREE.Group(); plankG.visible = false; root.add(plankG);   // 光桥与星台
  const threadM = new THREE.MeshBasicMaterial({ color: 0xffd89a, transparent: true, opacity: .14, blending: THREE.AdditiveBlending, depthWrite: false });
  const plankM = toon({ map: bridgeT, color: 0x9a94c0, emissive: 0xffc86a, emissiveIntensity: .12, roughness: .3 });
  const platDM = toon({ color: 0x44427a, roughness: .55 });   // 中心星台放灯，用深色石头，免得被灯照得发白
  const platInM = new THREE.MeshStandardMaterial({ map: inlayT, transparent: true, alphaTest: .4, color: 0xd8c08a, roughness: .25, metalness: .7, emissive: 0xffd89a, emissiveMap: inlayT, emissiveIntensity: .8 });
  const nodes = Object.entries(CN).map(([id, [x, z]], i) => {
    const sm = new THREE.MeshStandardMaterial({ color: 0xb8a878, roughness: .3, emissive: 0xffd89a, emissiveIntensity: 0 });
    const star = new THREE.Mesh(new THREE.OctahedronGeometry(.2, 0), sm); star.scale.set(.75, 1.25, .75); star.position.set(x, SY, z); skyG.add(star);
    const halo = billboard(haloT, 1.6, 1.6, true, camQuat); halo.material.color.set(0xffd89a); halo.material.opacity = 0; halo.position.set(x, SY, z); skyG.add(halo); L.hide.push(halo);
    const thread = new THREE.Mesh(new THREE.CylinderGeometry(.012, .012, SY + .25, 4, 1, true), threadM); thread.position.set(x, (SY - .25) / 2, z); thread.layers.set(LAYER_FX); root.add(thread); L.hide.push(thread);
    const rm = new THREE.MeshBasicMaterial({ color: 0xffd89a, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false });
    const ring = new THREE.Mesh(new THREE.RingGeometry(.5, .58, 32), rm); ring.rotation.x = -Math.PI / 2; ring.position.set(x, -.04, z); ring.layers.set(LAYER_FX); root.add(ring);
    const n = { id, i, x, z, sm, star, halo, thread, rm, ring, wake: 0, hot: 0, pr: id === 'D' ? 1.05 : .68 };
    if (id !== 'I') {   // I 在东边的窄道上，不需要星台
      const g0 = new THREE.Group(); g0.position.set(x, 0, z); plankG.add(g0);
      const top = new THREE.Mesh(new THREE.CylinderGeometry(n.pr, n.pr * .9, .3, 16), id === 'D' ? platDM : stoneM); top.position.y = -.15; g0.add(top);
      const rim = new THREE.Mesh(new THREE.TorusGeometry(n.pr - .02, .035, 4, 24), goldM); rim.rotation.x = Math.PI / 2; rim.position.y = -.005; g0.add(rim);
      const rock = new THREE.Mesh(new THREE.ConeGeometry(n.pr * .8, 1.6, 6, 1), isleRockM); rock.rotation.x = Math.PI; rock.position.y = -1.1; g0.add(rock);
      if (id !== 'D') { const inl = new THREE.Mesh(new THREE.PlaneGeometry(.9, .9), platInM); inl.rotation.x = -Math.PI / 2; inl.position.y = .006; g0.add(inl); }
      shadowAll(g0); g0.children.forEach(m => { if (m.material === platInM) m.castShadow = false; });
    }
    return n;
  });
  const NODE = Object.fromEntries(nodes.map(n => [n.id, n]));
  const Y_AXIS = new THREE.Vector3(0, 1, 0);
  const edges = CE.map(([a, b], i) => {
    const A = NODE[a], Bn = NODE[b], dx = Bn.x - A.x, dz = Bn.z - A.z, len = Math.hypot(dx, dz);
    // 画出来的星线：一束金光
    const bm = new THREE.MeshBasicMaterial({ color: 0xffd27a, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false });
    const beam = new THREE.Mesh(new THREE.CylinderGeometry(.045, .045, 1, 6, 1, true), bm); beam.layers.set(LAYER_FX); beam.visible = false; skyG.add(beam); L.hide.push(beam);
    // 连成后的光桥
    // 通向东岸 I 的那段：光桥只铺到岸边为止，不压到地板上
    const vis = b === 'I' ? len * (86.95 - A.x) / (Bn.x - A.x) : len;
    const pl = new THREE.Mesh(bevelBox(.6, .1, vis, .03), plankM); pl.position.set(A.x + dx / len * vis / 2, -.14, A.z + dz / len * vis / 2); pl.rotation.y = Math.atan2(dx, dz); pl.receiveShadow = pl.castShadow = true; plankG.add(pl);
    return { i, a: A, b: Bn, len, vis, bm, beam, drawn: false, k: 0, from: A };
  });
  const C = { done: false, finT: 0, desc: 0, rise: 0, fly: 0 };
  // 礁石：星鱼游不过去，也挡住星光（星鱼看不见礁石后面的光）
  const REEF = [[73.9, 8.25], [74.8, 8.25], [75.7, 8.25], [76.35, 7.45], [76.35, 6.55], [76.35, 5.65],
    [78.5, 9.4], [79.4, 8.9], [80.4, 8.75], [81.4, 8.9], [82.1, 9.4],
    [83.9, 5.65], [83.9, 6.55], [83.9, 7.45], [83.9, 8.35], [83.9, 9.25]].map(([x, z]) => ({ x, z, r: .48 }));
  REEF.forEach((r, i) => {
    const g0 = new THREE.Group(); g0.position.set(r.x, 0, r.z); g0.rotation.y = hashv(i, 3) * 6.28; root.add(g0);
    const top = new THREE.Mesh(new THREE.DodecahedronGeometry(.5, 0), isleRockM); top.scale.set(1, .55, 1); top.position.y = -.6; g0.add(top);
    const hang = new THREE.Mesh(new THREE.ConeGeometry(.38, 1.3, 5, 1), isleRockM); hang.rotation.x = Math.PI; hang.position.y = -1.3; g0.add(hang);
    const cr = new THREE.Mesh(new THREE.OctahedronGeometry(.1 + hashv(i, 7) * .06, 0), shardM); cr.position.set((hashv(i, 1) - .5) * .4, -.3, (hashv(i, 2) - .5) * .4); cr.rotation.set(.4, i, .3); g0.add(cr);
    shadowAll(g0);
  });
  // 星鱼：三群，每群三尾
  const SEA = [72.35, 86.65, 5.35, 11.65];        // 星鱼能游的范围
  const FISH_Y = -.35;
  // 光点浮在 1.6 高处，画面上看它「正下方」的海面，要往南偏一点（俯视 58°）
  const FOFF = (1.6 - FISH_Y) / Math.tan(58 * Math.PI / 180);
  const INLET = [79.25, 80.75, 5.85];               // 女神像前的跃池口：游到这里的星鱼会跃回池里
  const fishM = new THREE.MeshStandardMaterial({ color: 0xffc070, roughness: .4, emissive: 0xff9a3a, emissiveIntensity: .55 });
  const finM = new THREE.MeshBasicMaterial({ color: 0xffd890, transparent: true, opacity: .8, side: THREE.DoubleSide, blending: THREE.AdditiveBlending, depthWrite: false });
  const FISH_GAP = .52;   // 两条鱼中心的最小距离（鱼身长约 .48）
  const fishGeo = new THREE.SphereGeometry(.15, 8, 6), tailGeo = new THREE.PlaneGeometry(.34, .28); tailGeo.translate(0, -.14, 0);
  const HOMES = [[73.5, 6.3], [74.6, 6.9], [75.3, 5.9], [79.7, 10.6], [80.7, 11.1], [81.4, 10.3], [85.3, 6.4], [86.0, 7.5], [85.1, 7.9]];
  const fishes = HOMES.map(([x, z], i) => {
    const g0 = new THREE.Group(); root.add(g0);
    const body = new THREE.Mesh(fishGeo, fishM); body.scale.set(.68, .5, 1.6); g0.add(body);
    const fins = new THREE.Mesh(new THREE.PlaneGeometry(.42, .1), finM); fins.rotation.x = -Math.PI / 2; fins.position.z = .04; fins.layers.set(LAYER_FX); g0.add(fins);
    const tail = new THREE.Group(); tail.position.z = -.2; g0.add(tail);
    const tf = new THREE.Mesh(tailGeo, finM); tf.rotation.x = -Math.PI / 2; tail.add(tf); tf.layers.set(LAYER_FX);
    const halo = billboard(haloT, .8, .8, true, camQuat); halo.material.color.set(0xffb060); halo.material.opacity = .12; g0.add(halo); L.hide.push(halo);
    return { i, s: i / 3 | 0, g: g0, tail, halo, home: [x, z], x, z, y: FISH_Y, vx: 0, vz: 0, st: 'idle', blind: 0, t: 0, ph: hashv(i, 9) * 6.28 };
  });
  const inletM = new THREE.MeshBasicMaterial({ color: 0xffd89a, transparent: true, opacity: .2, blending: THREE.AdditiveBlending, depthWrite: false });
  const inletRing = new THREE.Mesh(new THREE.RingGeometry(.62, .7, 36), inletM); inletRing.rotation.x = -Math.PI / 2; inletRing.position.set(80, FISH_Y + .03, 5.75); inletRing.layers.set(LAYER_FX); root.add(inletRing);
  const seeLight = (x, z, tx, tz) => !REEF.some(r => { const dx = tx - x, dz = tz - z, L2 = dx * dx + dz * dz || 1e-9, t = clamp(((r.x - x) * dx + (r.z - z) * dz) / L2, 0, 1); return Math.hypot(x + dx * t - r.x, z + dz * t - r.z) < r.r * .9; });
  addLamp(78, 8);
  const polarisLamp = (addLamp(POLE[0], POLE[1]), L.lamps[L.lamps.length - 1]);
  const constLamp = L.lamps[L.lamps.length - 2];
  constLamp.auto = polarisLamp.auto = true; constLamp.dim = .35;   // 站在浅色光桥中央，灯光收一些，免得过曝
  // 第五盏星灯先沉在星海下面，星座连成后才升上来（灯光本身一直在，只藏起灯身，避免灯光数量变化导致着色器重编）
  const showConstLamp = v => constLamp.g.children.forEach(m => { if (!m.isLight) m.visible = v; });
  /* ---------- 浮岛与星座的运行逻辑 ---------- */
  const inIsle = (il, x, z, m = 0) => x > il.x - m && x < il.x + 3 + m && z > il.z - m && z < il.z + 3 + m;
  const occupied = il => inIsle(il, P.x, P.z, .4) || (P.falling && inIsle(il, P.safe[0], P.safe[1], .4));
  const onIsle = (x, z) => isles.some(il => il.state === 'dock' && inIsle(il, x, z));
  const segD = (x, z, e) => { const ax = e.a.x, az = e.a.z, dx = e.b.x - ax, dz = e.b.z - az, t = clamp(((x - ax) * dx + (z - az) * dz) / (e.len * e.len), 0, 1); return Math.hypot(x - ax - dx * t, z - az - dz * t); };
  const onConst = (x, z) => C.desc > .97 && (nodes.some(n => n.id !== 'I' && Math.hypot(x - n.x, z - n.z) < n.pr) || edges.some(e => segD(x, z, e) < .38));
  // 飞行路线：绕开人和别的浮岛，从旁边弧线飞过去（不从头顶穿过）
  function planFlight(il, a) {
    const sx = il.x, sz = il.z, ex = a.x, ez = a.z, dx = ex - sx, dz = ez - sz, L = Math.hypot(dx, dz) || 1, nx = -dz / L, nz = dx / L;
    const obst = [[P.x - 1.5, P.z - 1.5, 2.4], ...isles.filter(o => o !== il).map(o => [o.x, o.z, 3.3])];
    let best = [(sx + ex) / 2, (sz + ez) / 2], bs = -1e9;
    for (const off of [0, 1, -1, 2, -2, 3, -3, 4, -4, 5.5, -5.5, 7, -7]) {
      const cx = (sx + ex) / 2 + nx * off * 2, cz = (sz + ez) / 2 + nz * off * 2;
      let clear = 9;
      for (let i = 1; i < 24; i++) {
        const t = i / 24, u = 1 - t, x = u * u * sx + 2 * u * t * cx + t * t * ex, z = u * u * sz + 2 * u * t * cz + t * t * ez;
        obst.forEach(([ox, oz, r]) => { if (t > .9 && Math.hypot(ox - ex, oz - ez) < r) return; clear = Math.min(clear, Math.hypot(x - ox, z - oz) - r); });
      }
      const sc = Math.min(clear, .4) * 50 - Math.abs(off);   // 够安全就好，尽量走近路，不绕大圈
      if (sc > bs) { bs = sc; best = [cx, cz]; }
    }
    return best;
  }
  function summon(a) {
    let best = null, bd = 1e9;
    isles.forEach(il => { if (il.state === 'fly' || occupied(il)) return; const d = Math.hypot(il.x + 1.5 - a.cx, il.z + 1.5 - a.cz); if (d < bd) { bd = d; best = il; } });
    if (!best) { AU.wrong(); return; }
    if (best.anchor) best.anchor.isle = null;
    best.state = 'fly'; best.anchor = null; a.isle = best;
    best.fly = { t: 0, a, from: [best.x, best.y, best.z], ctrl: planFlight(best, a), dur: 1.4 + Math.min(1.2, bd / 8) };
    AU.ghost(); fx.ring(a.cx, .02, a.cz, 0xffd89a, 2.6, .9);
    if (!S.hints.summon) { S.hints.summon = 1; }
  }
  function newStar(a) {
    S.dipper = anchors.filter(q => q.visited).length;
    fx.sigil(a.cx, .04, a.cz, 0xffd89a, 'star', 2.6, 1.8); AU.lamp(S.dipper % 3);
    if (S.dipper === 7) completeDipper();
    ctx.updateHud();
  }
  function completeDipper() {
    S.dipDone = true;
    const pl = polarisLamp, A = anchors[5];
    cine([
      { dur: 1.4, focus: [anchors[6].cx - 1, anchors[6].cz], start() { flash(.2); anchors.forEach((a, i) => setTimeout(() => { fx.ring(a.cx, .03, a.cz, 0xffd89a, 2.8, 1); AU.ghost(); }, i * 110)); } },
      { dur: 1.8, focus: [pl.x, pl.z + 3], start() { toast('北斗七星连成了。斗口的两颗星，指向北方', 3.6); },
        run(k, dt) { for (let n = 0; n < 2; n++) if (Math.random() < dt * 30) { const t = Math.random() * k; fx.emit(A.cx + (pl.x - A.cx) * t, 1.2, A.cz + (pl.z - A.cz) * t, { vy: .3, life: .9, c: GOLD, tw: 8 }); } },
        end() { lightLamp(lamps.indexOf(pl)); } },
      { dur: 1.4, focus: [pl.x, pl.z + 3] }
    ]);
  }
  function updateIsles(dt, T) {
    anchors.forEach(a => {
      const near = !a.isle && ctx.orbNear(a.cx, a.cz, -.3) < .95;
      const pv = a.charge;
      a.charge = near ? a.charge + dt : Math.max(0, a.charge - dt * 2);
      if (near && Math.random() < dt * 22) fx.emit(a.cx + (Math.random() - .5) * .7, -.25, a.cz + (Math.random() - .5) * .7, { vy: .7, life: .7, c: GOLD, tw: 8 });
      if (pv < .5 && a.charge >= .5) { a.charge = 0; summon(a); }
      const k = Math.min(1, a.charge / .5);
      a.sm.emissiveIntensity = (a.visited ? 1 : .3) + k * 1.6 + Math.sin(T * 2 + a.i) * .1;
      a.star.visible = !a.isle || a.isle.state === 'fly';
      a.star.rotation.y += dt * (.8 + k * 6);
      a.star.position.y = -.35 + Math.sin(T * 1.4 + a.i) * .06;
      a.rm.opacity = a.isle ? 0 : (a.visited ? .14 : .26 + .08 * Math.sin(T * 3 + a.i)) + k * .5;
      a.ring.scale.setScalar(1.25 - k * .3);
    });
    isles.forEach(il => {
      if (il.state === 'free') {
        const [hx, hz] = il.home;
        il.x = hx - 1.5 + Math.cos(T * .13 + il.ph) * 1.1; il.z = hz - 1.5 + Math.sin(T * .11 + il.ph) * .6;
        il.y = -.55 + Math.sin(T * .7 + il.ph) * .1; il.g.rotation.y = Math.sin(T * .2 + il.ph) * .15;
      } else if (il.state === 'fly') {
        const F = il.fly; F.t += dt / F.dur; const t = Math.min(1, F.t), e = t * t * (3 - 2 * t);
        const u = 1 - e, px = il.x, pz = il.z;
        il.x = u * u * F.from[0] + 2 * u * e * F.ctrl[0] + e * e * F.a.x; il.z = u * u * F.from[2] + 2 * u * e * F.ctrl[1] + e * e * F.a.z;
        il.y = F.from[1] * (1 - e) - Math.sin(t * Math.PI) * .12;
        // 顺着飞行方向微微倾斜，落位前摆正
        const vx = (il.x - px) / Math.max(dt, 1e-3), vz = (il.z - pz) / Math.max(dt, 1e-3);
        il.g.rotation.x = clamp(vz * .012, -.05, .05) * (1 - e); il.g.rotation.z = clamp(-vx * .012, -.05, .05) * (1 - e);
        il.g.rotation.y *= 1 - Math.min(1, dt * 4);
        if (Math.random() < dt * 40) fx.emit(il.x + 1.5 + (Math.random() - .5) * 2.6, il.y - .4, il.z + 1.5 + (Math.random() - .5) * 2.6, { vy: -.4, life: .9, c: GOLD, tw: 6 });
        if (t >= 1) {
          const fresh = !F.a.visited; dock(il, F.a); il.fly = null; il.land = 0; il.g.rotation.set(0, 0, 0);
          AU.stone(); shake(.06, .35); fx.ring(F.a.cx, .03, F.a.cz, 0xffd89a, 3.6, 1.1); fx.bloom(F.a.cx, .2, F.a.cz, 26, GOLD, { w: 2, vr: 1.4, up: .5 });
          if (fresh) newStar(F.a);
        }
      } else if (il.land !== undefined && il.land < 1) { il.land = Math.min(1, il.land + dt * 3); il.y = -Math.sin(il.land * Math.PI) * .05; }
      il.g.position.set(il.x + 1.5, il.y, il.z + 1.5);
      il.glow += ((il.state === 'dock' ? 1 : 0) - il.glow) * (1 - Math.exp(-dt * 3));
      il.im.emissiveIntensity = il.glow * (.55 + .2 * Math.sin(T * 2 + il.k));
    });
    dipLines.forEach(l => { const on = anchors[l.a].visited && anchors[l.b].visited ? 1 : 0; l.k += (on - l.k) * (1 - Math.exp(-dt * 2)); l.m.material.opacity = .08 + l.k * (.72 + Math.sin(T * 3 + l.a) * .12); });
    deepStars.forEach((m, i) => { m.material.opacity = anchors[i].visited ? .45 + Math.sin(T * 2 + i) * .1 : .08; });
    bigStar.rotation.y += dt * (.03 + S.dipper * .015 + (S.dipDone ? .12 : 0));
    bigStarM.emissiveIntensity = .012 + S.dipper * .006 + (S.dipDone ? .03 : 0);
    pointerM.opacity = S.dipDone ? .45 + Math.sin(T * 3) * .15 : 0;
  }
  // 走进星海：镜头扫过空着的水瓶和散在海里的星鱼
  function wakeConst() {
    S.waking = true;
    cine([
      { dur: 1.6, focus: [80, 4.5], start() { AU.stone(); fx.sigil(80, .4, 3, 0xffd89a, 'star', 3.4, 2); flash(.08); toast('女神的水瓶空了。瓶里的九尾星鱼，散落在星海里', 4); } },
      { dur: 2.4, focus: [80, 8.5], start() { fishes.forEach((f, i) => setTimeout(() => fx.burst(f.x, FISH_Y + .2, f.z, 8, { c: GOLD, sp: .5, life: .7 }), i * 120)); } },
      { dur: 1.2, focus: [80, 6.5], start() { S.fishOn = true; } }
    ]);
  }
  // 九尾星鱼归池：升上夜空化成宝瓶座 → 星线一条条连上 → 星座降到海面变成光桥 → 中心升起星灯
  function completeConst() {
    C.done = true; S.pour = true;
    const from = fishes.map(f => [f.x, f.y, f.z]);
    cine([
      { dur: 1.6, focus: [80, 4.5], start() { flash(.2); AU.lamp(1); toast('九尾星鱼都回来了。女神倾倒双瓶', 3.6); fishes.forEach(f => { f.st = 'rise'; }); } },
      { dur: 2.4, focus: [80, 7.5], start() { AU.ghost(); },
        run(k) {
          const pv = C.fly; C.fly = k;
          fishes.forEach((f, i) => {
            const n = nodes[i], t = clamp(k * 1.6 - i * .07, 0, 1), e = t * t * (3 - 2 * t), [x0, y0, z0] = from[i];
            f.x = x0 + (n.x - x0) * e; f.z = z0 + (n.z - z0) * e; f.y = y0 + (SY - y0) * e + Math.sin(t * Math.PI) * 1.4;
            if (t >= 1 && f.st !== 'star') { f.st = 'star'; f.g.visible = false; n.wake = 1; AU.hover(i); fx.burst(n.x, SY, n.z, 16, { c: GOLD, sp: 1, life: .9 }); fx.ring(n.x, SY, n.z, 0xffd89a, 1.4, .7); }
          });
        } },
      { dur: 2.2, focus: [80, 8.5], start() { toast('它们在夜空里排成了宝瓶座', 3.2); },
        run(k) { edges.forEach((e, i) => { if (!e.drawn && k >= i / edges.length) { e.drawn = true; e.k = 0; e.beam.visible = true; AU.hover(i); } }); } },
      { dur: 2.6, focus: [80, 8.5], start() { AU.stone(); plankG.visible = true; },
        run(k, dt) { C.desc = k; shake(.04, .15); if (Math.random() < dt * 40) { const n = nodes[Math.random() * nodes.length | 0]; fx.emit(n.x + (Math.random() - .5), SY * (1 - k) + .2, n.z + (Math.random() - .5), { vy: -.5, life: .9, c: GOLD, tw: 8 }); } },
        end() { C.desc = 1; AU.stone(); shake(.1, .5); nodes.forEach(n => { n.star.visible = false; n.halo.visible = false; fx.bloom(n.x, .3, n.z, 14, GOLD, { w: 1.2, vr: 1, up: .4 }); }); fx.ring(78.5, .04, 8.5, 0xffd89a, 6, 1.4); } },
      { dur: 1.9, focus: [78.5, 8.5], start() { showConstLamp(true); AU.stone(); }, run(k) { C.rise = k; }, end() { C.rise = 1; lightLamp(lamps.indexOf(constLamp)); } },
      { dur: 1.2, focus: [80, 8] }
    ]);
  }
  function updateFish(dt, T) {
    // 光点在画面上「正下方」的那片海
    const rx = orb.x, rz = orb.z - FOFF;
    const tx = clamp(rx, SEA[0], SEA[1]), tz = clamp(rz, SEA[2], SEA[3]);
    const over = Math.hypot(rx - tx, rz - tz) < 1.6;   // 光离海太远（在岸上很里面）就不算
    let nFollow = 0;
    // 跟随的鱼按名次排成一圈（多了排第二圈），不再挤到同一个点上
    const fol = fishes.filter(f => f.st === 'follow'), nF = fol.length;
    fishes.forEach((f, i) => {
      if (f.st === 'rise' || f.st === 'star') return;
      if (f.st === 'leap') {
        f.t += dt / .9; const t = Math.min(1, f.t), e = t * t * (3 - 2 * t);
        f.x = f.lx + (f.hx - f.lx) * e; f.z = f.lz + (f.hz - f.lz) * e; f.y = FISH_Y + (.3 - FISH_Y) * e + Math.sin(t * Math.PI) * 1.3;
        f.g.rotation.x = -Math.cos(t * Math.PI) * .9;
        if (t >= 1) { f.st = 'home'; f.g.rotation.x = 0; f.ang = Math.atan2(f.z - 2.8, f.x - 80); fx.ring(f.x, .36, f.z, 0xffd89a, 1.2, .6); fx.burst(f.x, .4, f.z, 10, { c: [.8, .9, 1], sp: .8, up: 1, g: -4, life: .6 }); }
      } else if (f.st === 'home') {
        f.ang += dt * (S.pour ? 2.2 : .7); const ax = 80 + Math.cos(f.ang + i) * 1.15, az = 2.85 + Math.sin(f.ang + i) * .42;
        f.vx = (ax - f.x) / Math.max(dt, 1e-3); f.vz = (az - f.z) / Math.max(dt, 1e-3); f.x = ax; f.z = az; f.y = .3;
      } else {
        const d = Math.hypot(tx - f.x, tz - f.z), sees = S.fishOn && over && seeLight(f.x, f.z, tx, tz);
        if (f.st === 'idle' && sees && d < 3.3) {
          f.st = 'follow'; f.blind = 0; AU.hover(i); fx.burst(f.x, FISH_Y + .2, f.z, 8, { c: GOLD, sp: .6, life: .6 });
          if (!S.hints.fish) { S.hints.fish = 1; }
        } else if (f.st === 'follow') {
          f.blind = sees ? 0 : f.blind + dt;
          if (d > 4.4 || f.blind > .5) {
            f.st = 'idle'; f.home = [f.x, f.z]; fx.burst(f.x, FISH_Y + .2, f.z, 6, { c: [.6, .6, .8], sp: .4, life: .6 });
            if (f.blind > .5 && !S.hints.reef) { S.hints.reef = 1; }
            else if (d > 4.4 && !S.hints.lost) { S.hints.lost = 1; }
          }
        }
        let wx, wz, sp;
        if (f.st === 'follow') {
          nFollow++;
          let k2 = fol.indexOf(f); if (k2 < 0) k2 = nF;
          const ring = k2 < 5 ? 0 : 1, nIn = ring ? Math.max(1, Math.max(nF, k2 + 1) - 5) : Math.min(5, Math.max(nF, k2 + 1));
          const slot = ring ? k2 - 5 : k2, rr = ring ? 1.35 : (nIn < 2 ? .7 : .8);
          const a = T * (ring ? -.7 : 1.1) + slot / nIn * 6.2832 + ring * .6;
          wx = clamp(tx + Math.cos(a) * rr, SEA[0], SEA[1]); wz = clamp(tz + Math.sin(a) * rr * .72, SEA[2], SEA[3]);
          sp = 2.0;
        } else { wx = f.home[0] + Math.cos(T * .45 + f.ph) * .7; wz = f.home[1] + Math.sin(T * .6 + f.ph) * .45; sp = .6; }
        const dx = wx - f.x, dz = wz - f.z, dd = Math.hypot(dx, dz) || 1, v = Math.min(sp, dd * 2.2);
        const k = 1 - Math.exp(-dt * 3.5);
        f.vx += (dx / dd * v - f.vx) * k; f.vz += (dz / dd * v - f.vz) * k;
        f.x += f.vx * dt; f.z += f.vz * dt;
        REEF.forEach(r => { const ex = f.x - r.x, ez = f.z - r.z, e = Math.hypot(ex, ez), m = r.r + .17; if (e < m) { f.x = r.x + ex / (e || 1) * m; f.z = r.z + ez / (e || 1) * m; } });
        f.x = clamp(f.x, SEA[0], SEA[1]); f.z = clamp(f.z, SEA[2], SEA[3]);
        f.y = FISH_Y + Math.sin(T * 2 + f.ph) * .04;
        // 游到池口：跃回女神像下的池子
        if (f.st === 'follow' && f.x > INLET[0] && f.x < INLET[1] && f.z < INLET[2]) {
          f.st = 'leap'; f.t = 0; f.lx = f.x; f.lz = f.z; f.hx = 80 + ((S.fishHome % 3) - 1) * .7; f.hz = 2.8;
          S.fishHome++; AU.lamp(S.fishHome % 3); fx.bloom(f.x, 0, f.z, 18, GOLD, { w: 1, vr: .9, up: .6 }); fx.ring(80, FISH_Y + .03, 5.75, 0xffd89a, 2, .8);
          if (S.fishHome === 9) C.finT = 1.2;
        }
      }
      if (f.st !== 'home' || true) { const sp2 = Math.hypot(f.vx, f.vz); if (sp2 > .05 && f.st !== 'leap') f.g.rotation.y = Math.atan2(f.vx, f.vz); }
      f.g.position.set(f.x, f.y, f.z);
      f.tail.rotation.y = Math.sin(T * (f.st === 'follow' ? 14 : 7) + f.ph) * .55;
      if (f.st === 'follow' && Math.random() < dt * 10) fx.emit(f.x, f.y + .05, f.z, { vy: .15, life: .7, c: GOLD, tw: 6, a: .8 });
    });
    // 鱼有体积：游动中的鱼两两之间保持距离，互相推开，不会叠在一起穿模
    const sw = fishes.filter(f => f.st === 'follow' || f.st === 'idle');
    for (let it = 0; it < 2; it++) for (let a = 0; a < sw.length; a++) for (let b = a + 1; b < sw.length; b++) {
      const A = sw[a], B = sw[b], dx = B.x - A.x, dz = B.z - A.z, d = Math.hypot(dx, dz), m = FISH_GAP;
      if (d < m) {
        const ux = d > 1e-4 ? dx / d : Math.cos(a + b), uz = d > 1e-4 ? dz / d : Math.sin(a + b), push = (m - d) / 2;
        A.x -= ux * push; A.z -= uz * push; B.x += ux * push; B.z += uz * push;
      }
    }
    sw.forEach(f => { REEF.forEach(r => { const ex = f.x - r.x, ez = f.z - r.z, e = Math.hypot(ex, ez), m = r.r + .17; if (e < m) { f.x = r.x + ex / (e || 1) * m; f.z = r.z + ez / (e || 1) * m; } }); f.x = clamp(f.x, SEA[0], SEA[1]); f.z = clamp(f.z, SEA[2], SEA[3]); f.g.position.set(f.x, f.y, f.z); });
    S.nFollow = nFollow;
    inletM.opacity = S.fishOn && S.fishHome < 9 ? .2 + (nFollow ? .25 : 0) + Math.sin(T * 3) * .06 : 0;
    inletRing.scale.setScalar(1 + Math.sin(T * 3) * .05);
  }
  function updateConst(dt, T) {
    jugs2.forEach(j => { j.tilt += ((S.pour ? 1 : 0) - j.tilt) * (1 - Math.exp(-dt * 1.2)); j.holder.rotation.x = j.tilt * 2.0; j.arm.rotation.z = j.s * j.tilt * .15; });
    halo8.rotation.z += dt * (S.pour ? .5 : .05 + S.fishHome * .04);
    const flowing = S.pour && jugs2[0].tilt > .8;
    streamM.opacity = flowing ? .55 + Math.sin(T * 9) * .08 : 0;
    jugs2.forEach((j, i) => {
      const m = streams[i]; m.visible = flowing;
      const mx = 80 + j.s * 1.6, my = 2.72, mz = 1.98, h = my - .35;
      m.position.set(mx, (my + .35) / 2, mz + .1); m.scale.set(1, h, 1);
      if (flowing && Math.random() < dt * 30) fx.emit(mx + (Math.random() - .5) * .3, .4, mz + .25, { vy: .9, vx: (Math.random() - .5) * .6, vz: Math.random() * .5, g: -5, life: .5, c: [1, .9, .7], a: .9 });
    });
    updateFish(dt, T);
    if (C.finT > 0) { C.finT -= dt; if (C.finT <= 0) completeConst(); }
    const D = C.desc, de = D * D * (3 - 2 * D);
    skyG.position.y = -(SY - .03) * de;
    plankG.position.y = -1.8 * (1 - smooth(.25, 1, D));
    threadM.opacity = 0;
    nodes.forEach((n, i) => {
      n.star.visible = n.wake > 0 && D < 1; n.halo.visible = n.star.visible;
      n.sm.emissiveIntensity = n.wake * 1.8;
      n.halo.material.opacity = n.wake * .3 * (1 - D);
      n.star.rotation.y += dt * 1.2;
      n.star.position.y = SY + Math.sin(T * 1.5 + i) * .05;
      n.rm.opacity = n.wake * (.16 + Math.sin(T * 2 + i) * .04) * (1 - D);
    });
    edges.forEach((e, i) => {
      e.k = clamp(e.k + (e.drawn ? dt / .35 : -dt / .5), 0, 1);
      e.beam.visible = e.k > .005;
      if (e.beam.visible) {
        const A = e.a, Bn = e.b, L2 = (e.len + (e.vis - e.len) * de) * e.k;
        const ux = (Bn.x - A.x) / e.len, uz = (Bn.z - A.z) / e.len;
        e.beam.position.set(A.x + ux * L2 / 2, SY, A.z + uz * L2 / 2); e.beam.scale.set(1, Math.max(.001, L2), 1);
        e.beam.quaternion.setFromUnitVectors(Y_AXIS, new THREE.Vector3(ux, 0, uz));
        e.bm.opacity = (.85 + Math.sin(T * 5 + i) * .1) * (1 - D * .4);
      }
    });
    plankM.emissiveIntensity = .12 + (1 - smooth(.6, 1, D)) * .6 * (C.done ? 1 : 0);
    if (C.done) constLamp.g.position.y = -3 * (1 - easeBack(C.rise));
  }

  L.lamps.sort((a, b) => a.x - b.x);

  /* ================= 星座连线（结局） ================= */
  const lamps = L.lamps, bridges = L.bridges, rune = L.rune, gate = L.gate, card = L.card, altar = L.altar, ob = L.obelisk;
  const lines = lamps.map(l => {
    const g = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(l.x, 1.28, l.z), new THREE.Vector3(altar.x, 2.4, altar.z)]);
    const m = new THREE.Line(g, new THREE.LineBasicMaterial({ color: 0xffe9b0, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false }));
    m.layers.set(LAYER_FX); root.add(m); return m;
  });

  /* ================= 天光：从星空斜落下来的几束光（体积光柱 + 柔边光池） ================= */
  [[3.4, 7.3, 0xc8d4ff, 1.7], [29, 10.6, 0xb8c4ff, 1.5], [91.6, 7.5, 0xbfe8e8, 1.4], [80, 3.3, 0xc8e0ff, 1.7]].forEach(([x, z, c, r]) => lightShaft(root, x, z, { color: c, r, I: 12, k: .42, hide: L.hide }));

  /* ================= 引导微光 ================= */
  const GOLD = [1, .8, .48], TEAL = [.5, .95, .85], BLUE = [.65, .72, 1];
  const B = {
    lamps: lamps.map(l => fx.beacon(l.x, 1.15, l.z, 0xffb85a, l.auto ? 0 : .9)),
    rune: fx.beacon(rune.x, .35, rune.z, 0x6fe0cc, 1.4),
    ob: fx.beacon(ob.x, 3.15, ob.z, 0x6fe0cc, 1.0),
    card: fx.beacon(card.x, .9, card.z, 0x8f9cff, 1.0),
    altar: fx.beacon(altar.x, 1.15, altar.z, 0xffd27a, 1.3)
  };

  /* ================= 状态 ================= */
  const S = { lampsLit: 0, gotCard: false, done: false, inC: 0, hints: {}, trail: 0, spin: 0, ev: 0, dipper: 1, dipDone: false, pour: false, waking: false, fishOn: false, fishHome: 0, nFollow: 0 };

  function alignRing(i) {
    const R = rings[i]; if (!R || R.aligning) return;
    R.aligning = true; R.t0 = ctx.T;
    setTimeout(() => { AU.stone(); shake(.09, .7); }, 500);
  }

  function lightLamp(i) {
    const l = lamps[i];
    l.lit = true; S.lampsLit++; AU.lamp(i);
    fx.bloom(l.x, 1.3, l.z, 46, GOLD, { w: 3, vr: 2.2, up: .8 });
    fx.ring(l.x, .04, l.z, 0xffd89a, 3.4, 1.2); setTimeout(() => fx.ring(l.x, .04, l.z, 0xffd89a, 2.2, 1), 180);
    fx.sigil(l.x, .05, l.z, 0xffd89a, 'star', 2.8, 2.2);
    fx.sigil(l.x, 1.3, l.z, 0xfff0c8, 'star', 1.4, 1.6, { flat: false, spin: 4 });
    flash(.25); shake(.05, .3);
    B.lamps[i].on = false;
    alignRing(i);
    // 只在大的节点给一句氛围文字；普通的星灯只有光和声音
    const lampLine = S.lampsLit === 5 ? '五盏星灯俱明' : l === polarisLamp ? '北斗指向北极星' : l === constLamp ? '宝瓶座的中心，升起一盏星灯' : i === 0 ? '虚空下，巨大的星仪转动了一环' : ''; toast(lampLine ? `${lampLine}　${S.lampsLit} / 5` : `星灯　${S.lampsLit} / 5`, lampLine ? 3.6 : 2.4);
    ctx.updateHud();
  }

  // 日晷解开：仪式化的开门演出
  function openGateRitual() {
    rune.solved = true; B.rune.on = false; B.ob.on = false;
    AU.lamp(2);
    const gx = gate.x + .1, gz = (gate.z0 + gate.z1 + 1) / 2;
    cine([
      { dur: 1.3, focus: [rune.x - 1, rune.z + 1.5], start() { fx.bloom(rune.x, .2, rune.z, 50, GOLD, { w: 2.4, vr: 1.6, up: .5 }); fx.sigil(rune.x, .03, rune.z, 0xffd89a, 'star', 3.2, 2); fx.ring(rune.x, .03, rune.z, 0xffd89a, 3, 1.2); flash(.2); },
        run(k, dt) { for (let i = 0; i < 3; i++) if (Math.random() < dt * 30) { const t = Math.random() * k; fx.emit(rune.x + (gx - rune.x) * t, .12, rune.z + (gz - rune.z) * t, { vy: .3, life: .9, c: GOLD, tw: 8 }); } } },
      { dur: 1.1, focus: [gx - 2.4, gz], run(k, dt) { gate.glow.material.opacity = k * .8; if (Math.random() < dt * 40) fx.emit(rune.x + (gx - rune.x) * (.7 + Math.random() * .3), .12, rune.z + (gz - rune.z) * (.7 + Math.random() * .3), { vy: .5, life: .8, c: GOLD, tw: 8 }); },
        end() { AU.stone(); shake(.12, .5); gate.opening = true; } },
      { dur: 2.8, focus: [gx - 2.4, gz], run(k, dt) { if (Math.random() < dt * 4) { AU.stone(); } shake(.07, .2); gate.glow.material.opacity = .8 - k * .5; } },
      { dur: .7, focus: [gx - 2.4, gz], start() { fx.ring(gx - .3, .05, gz, 0xffd89a, 3.5, 1.2); toast('影子落在星纹上。石门沉了下去', 3.6); } }
    ]);
  }

  function reset() {
    Object.assign(S, { lampsLit: 0, gotCard: false, done: false, inC: 0, hints: {}, trail: 0, spin: 0, dipper: 1, dipDone: false, pour: false, waking: false, fishOn: false, fishHome: 0, nFollow: 0 });
    anchors.forEach(a => Object.assign(a, { isle: null, visited: false, charge: 0 }));
    isles.forEach(il => Object.assign(il, { state: 'free', anchor: null, fly: null, land: undefined, glow: 0, x: il.home[0] - 1.5, z: il.home[1] - 1.5, y: -.55 }));
    dock(isles[0], anchors[0]); isles[0].glow = 1;
    Object.assign(C, { done: false, finT: 0, desc: 0, rise: 0, fly: 0 });
    edges.forEach(e => { e.drawn = false; e.k = 0; e.beam.visible = false; });
    nodes.forEach(n => { n.wake = 0; });
    fishes.forEach(f => { Object.assign(f, { x: HOMES[f.i][0], z: HOMES[f.i][1], y: FISH_Y, vx: 0, vz: 0, st: 'idle', blind: 0, t: 0, home: HOMES[f.i].slice() }); f.g.visible = true; f.g.rotation.set(0, 0, 0); });
    plankG.visible = false; showConstLamp(false); constLamp.g.position.y = -3;
    jugs2.forEach(j => { j.tilt = 0; });
    lamps.forEach(l => { l.lit = false; l.t = 0; });
    bridges.forEach(b => { b.lit = 0; });
    Object.assign(rune, { hold: 0, solved: false });
    Object.assign(gate, { open: 0, opening: false }); gate.glow.material.opacity = 0;
    Object.assign(card, { vis: 0, taken: false }); card.g.visible = true;
    altar.star.visible = false; altar.cardM.opacity = 0; altar.light.intensity = 0; altar.halo.material.opacity = 0; altar.crown.visible = false; altar.crown.position.y = 11;
    lines.forEach(l => l.material.opacity = 0);
    rings.forEach(R => { R.align = 0; R.aligning = false; });
    B.lamps.forEach((b, i) => b.on = !lamps[i].auto); B.rune.on = B.ob.on = B.card.on = B.altar.on = true;
    ctx.hemi.color.set(0x7470b0);
    voidMat.uniforms.trail.value = 0; voidMat.uniforms.spin.value = 0;
  }

  function update(dt, T) {
    // 光之桥
    bridges.forEach(b => {
      const d = Math.hypot(orb.x - (b.x + .5), orb.z - (b.z + .5));
      const prev = b.lit;
      b.lit = clamp(b.lit + (d < 2.5 ? dt * 4 : -dt * .75), 0, 1);
      if (prev < .4 && b.lit >= .4) { AU.ghost(); fx.burst(b.x + .5, .05, b.z + .5, 6, { c: [.6, .75, 1], sp: .8, life: .8, g: .3, up: .4 }); }
      const s = smooth(0, 1, b.lit);
      b.mat.opacity = .07 + s * .88; b.mat.emissiveIntensity = s * .9; b.mat.userData.reflK.value = s * .4;
      b.mesh.scale.set(.6 + s * .4, .3 + s * .7, .6 + s * .4);
      b.mesh.position.y = -.25 * (1 - s);
    });
    // 星灯
    lamps.forEach((l, i) => {
      if (l.lit) l.t = Math.min(1, l.t + dt * .7);
      const kk = smooth(0, 1, l.t), near = ctx.orbNear(l.x, l.z, 1.28) < 1.7 ? 1 : 0;
      l.cm.emissiveIntensity = kk * 2.2 + near * .5 + .15;
      l.light.intensity = kk * (8 + Math.sin(T * 3 + i) * .4) * (l.dim || 1); l.shaft.set(kk * (l.dim ? .6 : 1));
      l.halo.material.opacity = kk * .55 * (l.dim ? .55 : 1) + near * .12;
      l.crystal.rotation.y += dt * (.6 + kk * 2.5 * (1 - kk * .6));
      l.crystal.position.y = 1.28 + Math.sin(T * 1.6 + i) * .05;
      if (kk > .5 && Math.random() < dt * 6) fx.emit(l.x + (Math.random() - .5) * .3, 1.3, l.z + (Math.random() - .5) * .3, { vy: .5, life: 1.6, c: [1, .82, .5], tw: 6 });
    });
    // 塔罗牌：只在星光里显形
    if (!card.taken) {
      const d = Math.hypot(orb.x - card.x, orb.z - card.z);
      const pv = card.vis;
      card.vis = clamp(card.vis + (d < 2.6 ? dt * 2.5 : -dt * 1.2), 0, 1);
      if (pv < .5 && card.vis >= .5) { fx.sigil(card.x, .04, card.z, 0x9fb4ff, 'star', 2, 1.4); AU.ghost(); }
      card.fm.opacity = card.bm.opacity = card.vis; card.halo.material.opacity = card.vis * .5;
      card.holder.rotation.y += dt * 1.2; card.holder.position.y = 1 + Math.sin(T * 1.8) * .08;
      card.holder.children.forEach(m => m.castShadow = card.vis > .5);
    }
    // 星纹
    const glow = rune.solved ? 1 : rune.hold / 1.4;
    rune.mat.opacity = .18 + glow * .8 + (rune.solved ? 0 : Math.sin(T * 2) * .06);
    rune.light.intensity = glow * 4;
    // 石门与齿轮
    if (gate.opening && gate.open < 1) {
      const pv = gate.open; gate.open = Math.min(1, gate.open + dt * .4);
      gate.gears.forEach((g, i) => g.rotation.x += (i ? -1 : 1) * dt * 1.6);
      if (Math.random() < dt * 34) fx.emit(gate.x + .5 + (Math.random() - .5) * .8, .1, gate.z0 + Math.random() * 3, { vy: .5, vx: (Math.random() - .5), life: .8, c: [.6, .55, .7], a: .6 });
      if (pv < 1 && gate.open >= 1) { shake(.1, .4); AU.stone(); }
    }
    gate.m.position.y = WALL_H / 2 - easeIn(gate.open) * 1.8;
    // 金色拱框跟着石门一起沉进地里：门开了以后人走过门口，不会被拱框「穿」过身体
    gate.arch.position.y = gate.glow.position.y = -easeIn(gate.open) * 1.95;
    // 星仪：未点亮的环随意倾斜着慢转；点亮后沉重地归位成水平
    rings.forEach((R, i) => {
      if (R.aligning) R.align = Math.min(1, (T - R.t0) / 2.4);
      const e = R.aligning ? easeBack(R.align) : 0;
      R.pivot.rotation.x = R.tilt[0] * (1 - e) + Math.PI / 2 * e;
      R.pivot.rotation.y = R.tilt[1] * (1 - e);
      R.tor.rotation.z += dt * (R.spin * (1 + S.trail * 8) + (R.align >= 1 ? .1 : 0));
      R.beads.forEach(b => b.material.emissiveIntensity = .3 + e * 1.6);
    });
    hub.rotation.y += dt * .3; hubM.emissiveIntensity = .5 + S.lampsLit * .5;
    bigGears.forEach(G => G.g.rotation.z += dt * .12 * G.sp * (lamps[2].lit ? 3 : 1));
    // 场景小动画
    L.sway.forEach(s => { if (s.spin) s.o.rotation.y += dt * .8; else s.o.rotation.z = Math.sin(T * .9 + s.ph) * .025; });
    L.shards.forEach(s => { s.m.position.y = s.y + Math.sin(T * s.sp + s.ph) * .25; s.m.rotation.x += dt * s.sp * .5; s.m.rotation.y += dt * s.sp * .7; });
    L.water.tex.offset.set(T * .02, T * .035); L.water.ntex.offset.set(-T * .03, T * .02);
    voidMat.uniforms.time.value = T;
    L.jugs.forEach(j => { if (Math.random() < dt * 40) fx.emit(j.mouth.x, j.mouth.y, j.mouth.z, { vx: .9 + Math.random() * .2, vy: .3, vz: (Math.random() - .5) * .1, g: -6, life: .45, c: [.55, .7, 1], s: 1, a: .9 }); });
    const cf = ctx.pipe ? null : null;
    if (Math.random() < dt * 30) emitDust();
    updateIsles(dt, T);
    updateConst(dt, T);
    // 引导微光
    B.card.on = !card.taken && card.vis < .5;
    B.altar.on = !S.done;
  }
  const easeIn = t => t * t * (3 - 2 * t);
  function emitDust() {
    const cx = P.x, cz = P.z;
    fx.emit(cx + (Math.random() - .5) * 26, -1 + Math.random() * 3, cz + (Math.random() - .5) * 18, { vy: .12 + Math.random() * .2, vx: (Math.random() - .5) * .1, life: 4 + Math.random() * 3, c: Math.random() < .5 ? [.7, .75, 1] : [1, .9, .7], tw: 3 + Math.random() * 4, a: .7 });
  }

  function logic(dt) {
    const h = S.hints, t = ctx.S.t;
    if (!h.move && t > .8) { h.move = 1; toast('夜色很深。移动鼠标，星光会跟着你', 4.5); }
    if (!h.lamp && Math.hypot(P.x - lamps[0].x, P.z - lamps[0].z) < 3.2 && !lamps[0].lit) { h.lamp = 1; toast('把星光引到灯碗上，走近按 E 点燃', 4); }
    if (!S.waking && P.x > 70.6) wakeConst();
    // 进入区域：只显示地名
    if (!h.d && P.x > 37.2) { h.d = 1; toast('暗厅', 2.6); }
    if (!h.f && P.x > 49.6) { h.f = 1; toast('七星浮岛', 2.6); }
    if (!h.e && P.x > 88.5) { h.e = 1; toast('星之泉', 2.6); }
    // 日晷：光、石碑、星纹三点一线时，影子落在星纹上
    if (!rune.solved) {
      const v1x = rune.x - ob.x, v1z = rune.z - ob.z, v2x = ob.x - orb.x, v2z = ob.z - orb.z;
      const d1 = Math.hypot(v1x, v1z), d2 = Math.hypot(v2x, v2z);
      const cos = (v1x * v2x + v1z * v2z) / (d1 * d2 || 1);
      const aligned = d2 > .6 && d2 < 7 && cos > Math.cos(9 * Math.PI / 180);
      const prev = rune.hold;
      rune.hold = aligned ? rune.hold + dt : Math.max(0, rune.hold - dt * 1.5);
      if (aligned) { AU.shadow(rune.hold / 1.4); if (Math.random() < dt * 20) fx.emit(rune.x + (Math.random() - .5), .1, rune.z + (Math.random() - .5), { vy: .4, life: .8, c: GOLD, tw: 8 }); }
      if (rune.hold >= 1.4 && prev < 1.4) openGateRitual();
    }
  }

  function nearest() {
    const out = [];
    lamps.forEach((l, i) => { if (!l.lit && !l.auto) out.push({ type: 'lamp', i, x: l.x, y: 1.9, z: l.z, label: '点燃星灯' }); });
    if (!card.taken && card.vis > .5) out.push({ type: 'card', x: card.x, y: 1.8, z: card.z, label: '拾起塔罗牌' });
    if (!S.done) out.push(S.gotCard && S.lampsLit === 5 ? { type: 'finale', x: altar.x, y: 1.6, z: altar.z, r: 2, label: '放入　XVII 星' } : { type: 'altar', x: altar.x, y: 1.6, z: altar.z, r: 2, label: '查看祭坛' });
    return out;
  }
  function interact(n) {
    if (n.type === 'lamp') {
      const l = lamps[n.i];
      if (ctx.orbNear(l.x, l.z, 1.28) > 1.7) { if (!S.lampsLit) toast('灯碗里还没有星光', 2.6); AU.wrong(); fx.burst(l.x, 1, l.z, 8, { c: [1, .7, .6], sp: .6, life: .6 }); return; }
      lightLamp(n.i);
    } else if (n.type === 'card') {
      card.taken = true; S.gotCard = true; AU.card();
      fx.bloom(card.x, 1, card.z, 50, BLUE, { w: 3, vr: 2 }); fx.sigil(card.x, .04, card.z, 0xbfd0ff, 'star', 3, 2); fx.ring(card.x, .04, card.z, 0x9fb4ff, 3, 1.1); flash(.2);
      card.g.visible = false; toast('拾得　XVII 星', 3); ctx.updateHud();
    } else if (n.type === 'altar') {
      if (!S.gotCard) { toast('祭坛上空着一个牌槽。牌，也许藏在暗处', 3.2); AU.wrong(); return; }
      toast(`牌槽微微发亮，可还缺 ${5 - S.lampsLit} 盏星灯`, 3.2); AU.wrong();
    }
  }

  function finaleStart() { S.done = true; toast('星辰归位', 4); fx.sigil(altar.x, .04, altar.z, 0xffe9b0, 'star', 5.5, 3.5, { spin: 1.2 }); flash(.3); }
  function finale(dt, e) {
    altar.cardM.opacity = smooth(.2, 1.2, e);
    if (e > 1 && !altar.star.visible) {
      altar.star.visible = true; fx.bloom(altar.x, 1.2, altar.z, 80, [1, .9, .6], { w: 3.2, vr: 2.6, up: 1.2 }); fx.ring(altar.x, .04, altar.z, 0xffe9b0, 6, 1.6); flash(.35); shake(.06, .4);
      altar.crown.visible = true;
    }
    if (e > 1.6 && e < 6 && Math.floor(e * 1.25) !== Math.floor((e - dt) * 1.25)) fx.ring(altar.x, .04, altar.z, 0xffd89a, 5 + Math.random() * 2, 1.6, { a: .6 });
    const rise = smooth(1, 4.2, e);
    altar.star.position.y = .4 + rise * 2.1; altar.star.rotation.y += dt * (1 + rise * 2);
    altar.star.scale.setScalar(.6 + rise * .6);
    altar.light.intensity = rise * 6; altar.halo.material.opacity = rise * .22; altar.halo.position.y = altar.star.position.y;
    // 星冠沉重地降下、旋转
    const cd = smooth(1.2, 4.6, e);
    altar.crown.position.y = 11 - easeBack(Math.min(1, cd)) * 7.6; altar.crown.rotation.y += dt * (.3 + rise * .9);
    if (cd > .99 && !S.crownHit) { S.crownHit = true; AU.stone(); shake(.08, .5); }
    lines.forEach((l, i) => { l.material.opacity = smooth(2.2 + i * .4, 3.6 + i * .4, e) * (.6 + Math.sin(ctx.T * 4 + i) * .2); });
    if (e > 2 && e < 7 && Math.random() < dt * 30) { const a = Math.random() * 6.28, rr = 1 + Math.random() * 5; fx.emit(altar.x + Math.cos(a) * rr, .2, altar.z + Math.sin(a) * rr, { vy: 1.2 + Math.random(), life: 2, c: [1, .9, .7], tw: 8 }); }
    // 星轨：天穹开始旋转，拖出延时摄影般的弧线
    S.trail = smooth(3, 8, e);
    voidMat.uniforms.trail.value = S.trail;
    voidMat.uniforms.spin.value += dt * (.04 + S.trail * .55);
    voidMat.uniforms.pole.value.set(altar.x, altar.z - 4);
    // 天色渐亮：从夜的蓝紫过渡到黎明的淡金
    const dawn = smooth(5, 10, e);
    ctx.hemi.color.lerpColors(new THREE.Color(0x7470b0), new THREE.Color(0xffd9b8), dawn); ctx.hemi.intensity = .24 + dawn * .35;
    return e > 11.5;
  }

  // 停留太久：第一句只给意象，第二句只指方向
  function idle() {
    if (!lamps[0].lit) return ['灯碗在等星光', '左上方的小广场，有一盏暗着的星灯'];
    if (P.x < 23.5 && !rune.solved) return ['虚空上的路，只在星光里显现', '让星光走在你前面。掉下去也没关系'];
    if (!rune.solved) return ['地上的星纹，在等一片影子', '星光、石碑、星纹'];
    if (!lamps[1].lit) return ['日晷庭的角落里，还有一盏星灯', '去左上角看看'];
    if (P.x < 36.5) return ['石门已经打开了', '往东走'];
    if (!lamps[2].lit) return ['暗厅里也有一盏灯', '用星光去找它'];
    if (!card.taken && P.x < 49.5) return ['暗处好像落着什么', '暗厅的角落，还没被星光照过'];
    if (!S.dipDone) {
      if (P.x < 67) return ['浮岛追着星光。站着人的那座，不会动', '前方空着的锚星，在等一座浮岛'];
      return ['北斗还没连全', '回头看看，哪颗星还暗着'];
    }
    if (P.x < 70.5) return ['北斗指向了北极星', '往东，去宝瓶星海'];
    if (!C.done) {
      if (S.nFollow) return ['慢一点，别让礁石挡在星鱼和光之间', '女神像前的池口，在等它们'];
      return [`还有 ${9 - S.fishHome} 尾星鱼没回池`, '西边、南边、东边的礁石里，都还有星鱼'];
    }
    if (!card.taken) return ['牌还落在暗厅里', '暗厅的角落，还没被星光照过'];
    if (P.x < 87.5) return ['光桥已经铺好了', '走过星海，去东边'];
    return ['五盏星灯与牌都齐了', '星之泉的祭坛，在等你'];
  }

  return {
    id: 1, roman: 'XVII', name: '星', motto: '在无光之处，星辰等待被唤醒', mood: 1,
    spawn: [2.5, 7.5], menuP: [3.6, 7.6], menuOrb: [6.2, 6.5], menuCam: [6.5, 7.6],
    leash: 7.5, mirrorY: -.14, hideInReflection: L.hide, voidMat,
    palette: ['#0b0a1f', '#1a1838', '#2a2a5a', '#3d3f7a', '#5a5f9e', '#8a8fc4', '#c3c4e6', '#eef0ff', '#143a44', '#23626a', '#4a9a92', '#4a3a6e', '#7a5f98', '#e3c2b4', '#e8c98e', '#fff1c4'],
    tintLo: [.97, .96, 1.04], tintHi: [1.06, 1.02, .94],
    light: { sky: 0x7470b0, ground: 0x1a1028, hemi: .24, moon: 0x8f9cff, moonK: 1.4, moonDir: [-7, 5], orb: 0xffd88e, halo: 0xffc878, mote: [1, .86, .55],
      env: [0x2a2650, 0x06051a, [[4, 5, 2, 0xffd9a0, .9], [-5, 4, -3, 0x9fb4ff, 1.1], [0, 8, 0, 0x8080c0, 2]]] },
    endCard: { title: '星光归位', line: '第一幕　星　完<br>下一幕　月　已在水边等你' },
    cell,
    solid(x, z) { if (C.rise > .5 && Math.hypot(x - constLamp.x, z - constLamp.z) < .38) return true; const c = cell(Math.floor(x), Math.floor(z)); if (c === 'G') return gate.open < .85; return SOLID.has(c); },
    hole(x, z) {
      const c = cell(Math.floor(x), Math.floor(z));
      if (c === ' ') return !onIsle(x, z) && !onConst(x, z);
      if (c === '*') { const b = bridges.find(b => b.x === Math.floor(x) && b.z === Math.floor(z)); return !b || b.lit < .22; }
      return false;
    },
    ground(x, z) { const c = cell(Math.floor(x), Math.floor(z)); if (c === ' ') return onIsle(x, z) || onConst(x, z); return c !== '*'; },
    onFall() { if (!S.hints.fall) { S.hints.fall = 1; } },
    ambient(P) { return (P.x > 36.6 && P.x < 49.2) ? .1 : .24; },
    reset, update, logic, nearest, interact, finaleStart, finale, idle,
    finaleCam: () => [altar.x - 1, altar.z],
    finaleOrb: () => [altar.x - 1.2, altar.z + 1],
    progress: () => `${S.lampsLit}${S.gotCard ? 1 : 0}${rune.solved ? 1 : 0}${P.x > 23.5 ? 1 : 0}${P.x > 36.5 ? 1 : 0}${S.dipper}${C.done ? 1 : 0}${S.fishHome}${P.x > 49.5 ? 1 : 0}${P.x > 67 ? 1 : 0}${P.x > 88 ? 1 : 0}`,
    MW, MH, mapMarks: () => [...lamps.map(l => ({ x: l.x, z: l.z, kind: 'lamp', done: l.lit })), { x: card.x, z: card.z, kind: 'card', done: card.taken }, { x: altar.x, z: altar.z, kind: 'goal', done: S.done }],
    hud: () => ({ label: '星灯', dots: lamps.map(l => l.lit), have: S.gotCard, line: S.done ? '牌已归位' : S.gotCard ? '持有　XVII 星' : '遗失的牌　未寻得' }),
    _: { L, S, lamps, rune, gate, card, altar, ob, bridges, rings, anchors, isles, nodes, edges, C, summon, fishes, REEF }
  };
}
