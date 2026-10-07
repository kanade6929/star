// 第一幕 · XVII 星 —— 地图、场景、机关与演出
import * as THREE from 'three';
import * as TX from './textures.js';
import { flowerCanvas, starCardCanvas, cardBackCanvas, haloCanvas, mk } from './sprites.js';
import { LAYER_FX } from './post.js';
import { tex, ntex, toon, reflective, billboard, quadGeo, cliffMesh, wallGeo, instWalls, hashv, shadowAll, lightShaft } from './common.js';
import { starVoid } from './abyss.js';

export const MW = 61, MH = 15;
const WALL_H = 1.7, LOW_H = .45;
const clamp = (v, a, b) => v < a ? a : v > b ? b : v;
const smooth = (a, b, x) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
const easeBack = t => { const c = 1.6; return 1 + (c + 1) * Math.pow(t - 1, 3) + c * Math.pow(t - 1, 2); };

/* ---------- 地图 ----------
  #墙  .石板  ,草地  空格=虚空  *光之桥  L星灯  O石碑  R星纹  G石门  K塔罗牌  A祭坛  W水  J水瓶  T树  C柱  c断柱 */
function buildMap() {
  const g = Array.from({ length: MH }, () => Array(MW).fill(' '));
  const set = (x, z, c) => { if (x >= 0 && z >= 0 && x < MW && z < MH) g[z][x] = c; };
  const room = (x0, z0, x1, z1, fl) => { for (let z = z0; z <= z1; z++) for (let x = x0; x <= x1; x++) set(x, z, (x === x0 || x === x1 || z === z0 || z === z1) ? '#' : fl); };
  room(0, 1, 12, 13, ',');
  room(24, 1, 36, 13, '.');
  room(36, 1, 49, 13, '.');
  room(49, 1, 60, 13, ',');
  // A：石径与小广场
  for (let x = 2; x <= 11; x++) for (let z = 6; z <= 8; z++) set(x, z, '.');
  for (let x = 5; x <= 9; x++) for (let z = 3; z <= 5; z++) set(x, z, '.');
  [[12, 6], [12, 7], [12, 8]].forEach(([x, z]) => set(x, z, '.'));
  set(7, 4, 'L');
  [[2, 3], [10, 2], [3, 11], [9, 11], [11, 4]].forEach(([x, z]) => set(x, z, 'T'));
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
  [[49, 6], [49, 7], [49, 8]].forEach(([x, z]) => set(x, z, '.'));
  // E：星之泉
  for (let x = 50; x <= 53; x++) set(x, 7, '.');
  for (let x = 53; x <= 57; x++) for (let z = 5; z <= 9; z++) set(x, z, 'W');
  set(53, 7, '.'); set(54, 7, '.'); set(55, 7, 'A');
  set(52, 5, 'J'); set(52, 9, 'J');
  [[51, 2], [58, 2], [51, 12], [58, 12], [59, 7], [55, 2], [55, 12]].forEach(([x, z]) => set(x, z, 'T'));
  return g;
}
const SOLID = new Set(['#', 'L', 'O', 'A', 'W', 'J', 'T', 'C', 'c', 'G']);

export function buildStar(ctx) {
  const { group: root, camQuat, fx, AU, toast, cine, shake, flash, P, orb } = ctx;
  const grid = buildMap();
  const cell = (x, z) => (x < 0 || z < 0 || x >= MW || z >= MH) ? ' ' : grid[z][x];
  const isVoid = c => c === ' ' || c === '*';
  const L = { lamps: [], bridges: [], sway: [], shards: [], jugs: [], hide: [] };

  /* ================= 材质 ================= */
  const cFloor = TX.floorTex(), cGrass = TX.grassTex(), cWallS = TX.wallSideTex(), cWallT = TX.wallTopTex(), cCliff = TX.cliffTex();
  // 抛光大理石：缝隙凹陷明显，能倒映灯光和人
  const matStone = reflective(toon({ map: tex(cFloor), normalMap: ntex(cFloor, 6), normalScale: new THREE.Vector2(1.5, 1.5), roughness: .3 }), .42);
  const matGrass = toon({ map: tex(cGrass), normalMap: ntex(cGrass, 3.4), roughness: .95 });
  const ws = toon({ map: tex(cWallS), normalMap: ntex(cWallS, 5.5), normalScale: new THREE.Vector2(1.4, 1.4), roughness: .7 });
  const wt = toon({ map: tex(cWallT), normalMap: ntex(cWallT, 3), roughness: .45, color: 0x9896b8 });
  const stoneM = toon({ color: 0x9c96bf, roughness: .42, metalness: .05 });
  const goldM = toon({ color: 0xd1b072, roughness: .28, metalness: .85 });

  /* ================= 地面 / 崖壁 / 墙 ================= */
  const floors = { '.': [], ',': [] }, cliffs = [];
  for (let z = 0; z < MH; z++) for (let x = 0; x < MW; x++) {
    const c = grid[z][x]; if (isVoid(c)) continue;
    const kind = (c === ',' || c === 'T' && (x < 13 || x > 48 || (x > 15 && x < 18))) ? ',' : '.';
    if (c !== 'W') floors[kind].push([x, z]);
    [[0, 1], [0, -1], [1, 0], [-1, 0]].forEach(([dx, dz]) => { if (isVoid(cell(x + dx, z + dz))) cliffs.push([x, z, dx, dz]); });
  }
  const fs = new THREE.Mesh(quadGeo(floors['.']), matStone); fs.receiveShadow = true; root.add(fs);
  const fg = new THREE.Mesh(quadGeo(floors[',']), matGrass); fg.receiveShadow = true; root.add(fg);
  root.add(cliffMesh(cliffs, toon({ map: tex(cCliff), normalMap: ntex(cCliff, 4), side: THREE.DoubleSide })));
  const tall = [], low = [];
  for (let z = 0; z < MH; z++) for (let x = 0; x < MW; x++) if (grid[z][x] === '#') (z === 13 ? low : tall).push([x, z]);
  const wallMats = [ws, ws, wt, wt, ws, ws];
  instWalls(root, tall, wallGeo(WALL_H), wallMats); instWalls(root, low, wallGeo(LOW_H), wallMats);
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
  const bGeo = new THREE.BoxGeometry(.94, .12, .94); bGeo.translate(0, -.06, 0);
  for (let z = 0; z < MH; z++) for (let x = 0; x < MW; x++) if (grid[z][x] === '*') {
    const mat = reflective(toon({ map: bridgeT, emissive: 0x6f8fe0, emissiveIntensity: 0, transparent: true, opacity: .1, depthWrite: false, roughness: .12 }), .4);
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
  const haloT = tex(haloCanvas(32)); haloT.wrapS = haloT.wrapT = THREE.ClampToEdgeWrapping;
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
    const shaft = lightShaft(root, x + .5, z + .5, { color: 0xffd89a, r: 1.5, h: 6.5, I: 14, k: .55, on: false });
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
    L.gate = { x, z0, z1, m, open: 0, opening: false, gears, glow };
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
    const wm = reflective(toon({ map: wtx, normalMap: wn, transparent: true, opacity: .92, emissive: 0x1a2a66, emissiveIntensity: .3, roughness: .17, metalness: .1 }), .75, 1.6);
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
  const flowerTs = [tex(flowerCanvas('#f4a3b6', '#2f6b5e')), tex(flowerCanvas('#fff3b8', '#2f6b5e')), tex(flowerCanvas('#bfe3ff', '#2f6b5e'))];
  flowerTs.forEach(t => { t.wrapS = t.wrapT = THREE.ClampToEdgeWrapping; });
  const fMats = flowerTs.map(t => toon({ map: t, alphaTest: .5, side: THREE.DoubleSide }));
  const fGeo = new THREE.PlaneGeometry(.5, .5); fGeo.translate(0, .25, 0);
  const r = TX.rng(77);
  for (let z = 0; z < MH; z++) for (let x = 0; x < MW; x++) if (grid[z][x] === ',') {
    const n = r() < .55 ? 1 + (r() * 2 | 0) : 0;
    for (let k = 0; k < n; k++) { const m = new THREE.Mesh(fGeo, fMats[r() * 3 | 0]); m.quaternion.copy(camQuat); m.position.set(x + .15 + r() * .7, 0, z + .15 + r() * .7); m.layers.set(LAYER_FX); root.add(m); }
  }
  const shardM = toon({ color: 0xb7a6d6, emissive: 0x3a3a8a, emissiveIntensity: .4, flatShading: true });
  const sr = TX.rng(9);
  for (let i = 0; i < 46; i++) {
    let x, z, tries = 0; do { x = sr() * MW; z = -2 + sr() * (MH + 4); tries++; } while (!isVoid(cell(x | 0, z | 0)) && tries < 30);
    const geo = sr() < .5 ? new THREE.OctahedronGeometry(.08 + sr() * .16, 0) : new THREE.TetrahedronGeometry(.1 + sr() * .18, 0);
    const m = new THREE.Mesh(geo, shardM); const y = -.6 - sr() * 3;
    m.position.set(x, y, z); m.castShadow = true; root.add(m);
    L.shards.push({ m, y, ph: sr() * 6.28, sp: .3 + sr() * .6 });
  }

  /* ================= 星座连线（结局） ================= */
  const lamps = L.lamps, bridges = L.bridges, rune = L.rune, gate = L.gate, card = L.card, altar = L.altar, ob = L.obelisk;
  const lines = lamps.map(l => {
    const g = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(l.x, 1.28, l.z), new THREE.Vector3(altar.x, 2.4, altar.z)]);
    const m = new THREE.Line(g, new THREE.LineBasicMaterial({ color: 0xffe9b0, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false }));
    m.layers.set(LAYER_FX); root.add(m); return m;
  });

  /* ================= 天光：从星空斜落下来的几束光（体积光柱 + 柔边光池） ================= */
  [[3.4, 7.3, 0xc8d4ff, 1.7], [29, 10.6, 0xb8c4ff, 1.5], [51.6, 7.5, 0xbfe8e8, 1.4]].forEach(([x, z, c, r]) => lightShaft(root, x, z, { color: c, r, I: 12, k: .42 }));

  /* ================= 引导微光 ================= */
  const GOLD = [1, .8, .48], TEAL = [.5, .95, .85], BLUE = [.65, .72, 1];
  const B = {
    lamps: lamps.map(l => fx.beacon(l.x, 1.15, l.z, 0xffb85a, .9)),
    rune: fx.beacon(rune.x, .35, rune.z, 0x6fe0cc, 1.4),
    ob: fx.beacon(ob.x, 3.15, ob.z, 0x6fe0cc, 1.0),
    card: fx.beacon(card.x, .9, card.z, 0x8f9cff, 1.0),
    altar: fx.beacon(altar.x, 1.15, altar.z, 0xffd27a, 1.3)
  };

  /* ================= 状态 ================= */
  const S = { lampsLit: 0, gotCard: false, done: false, inC: 0, hints: {}, trail: 0, spin: 0, ev: 0 };

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
    toast(S.lampsLit === 3 ? '三盏星灯俱明。远处的星仪合上了最后一环，去星之泉吧' : i === 0 ? '第一盏星灯。虚空下，巨大的星仪转动了一环' : `星灯　${S.lampsLit} / 3`, 3.8);
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
    Object.assign(S, { lampsLit: 0, gotCard: false, done: false, inC: 0, hints: {}, trail: 0, spin: 0 });
    lamps.forEach(l => { l.lit = false; l.t = 0; });
    bridges.forEach(b => { b.lit = 0; });
    Object.assign(rune, { hold: 0, solved: false });
    Object.assign(gate, { open: 0, opening: false }); gate.glow.material.opacity = 0;
    Object.assign(card, { vis: 0, taken: false }); card.g.visible = true;
    altar.star.visible = false; altar.cardM.opacity = 0; altar.light.intensity = 0; altar.halo.material.opacity = 0; altar.crown.visible = false; altar.crown.position.y = 11;
    lines.forEach(l => l.material.opacity = 0);
    rings.forEach(R => { R.align = 0; R.aligning = false; });
    B.lamps.forEach(b => b.on = true); B.rune.on = B.ob.on = B.card.on = B.altar.on = true;
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
      const kk = smooth(0, 1, l.t), near = Math.hypot(orb.x - l.x, orb.z - l.z) < 1.7 ? 1 : 0;
      l.cm.emissiveIntensity = kk * 2.2 + near * .5 + .15;
      l.light.intensity = kk * (8 + Math.sin(T * 3 + i) * .4); l.shaft.set(kk);
      l.halo.material.opacity = kk * .55 + near * .12;
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
    L.sway.forEach(s => { s.o.rotation.z = Math.sin(T * .9 + s.ph) * .025; });
    L.shards.forEach(s => { s.m.position.y = s.y + Math.sin(T * s.sp + s.ph) * .25; s.m.rotation.x += dt * s.sp * .5; s.m.rotation.y += dt * s.sp * .7; });
    L.water.tex.offset.set(T * .02, T * .035); L.water.ntex.offset.set(-T * .03, T * .02);
    voidMat.uniforms.time.value = T;
    L.jugs.forEach(j => { if (Math.random() < dt * 40) fx.emit(j.mouth.x, j.mouth.y, j.mouth.z, { vx: .9 + Math.random() * .2, vy: .3, vz: (Math.random() - .5) * .1, g: -6, life: .45, c: [.55, .7, 1], s: 1, a: .9 }); });
    const cf = ctx.pipe ? null : null;
    if (Math.random() < dt * 30) emitDust();
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
    if (!h.void && P.x > 10.5) { h.void = 1; toast('虚空之上，有些路只在星光里显现', 4); }
    if (!h.c && P.x > 25) { h.c = 1; toast('石碑静静立着。地上的星纹，在等它的影子', 4.2); }
    if (!h.d && P.x > 37.2) { h.d = 1; toast('暗厅。只有星光照到的地方，才看得见', 4); }
    if (!h.e && P.x > 49.5) { h.e = 1; toast('星之泉。双瓶倾水，祭坛静候', 3.6); }
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
    lamps.forEach((l, i) => { if (!l.lit) out.push({ type: 'lamp', i, x: l.x, y: 1.9, z: l.z, label: '点燃星灯' }); });
    if (!card.taken && card.vis > .5) out.push({ type: 'card', x: card.x, y: 1.8, z: card.z, label: '拾起塔罗牌' });
    if (!S.done) out.push(S.gotCard && S.lampsLit === 3 ? { type: 'finale', x: altar.x, y: 1.6, z: altar.z, r: 2, label: '放入　XVII 星' } : { type: 'altar', x: altar.x, y: 1.6, z: altar.z, r: 2, label: '查看祭坛' });
    return out;
  }
  function interact(n) {
    if (n.type === 'lamp') {
      const l = lamps[n.i];
      if (Math.hypot(orb.x - l.x, orb.z - l.z) > 1.7) { toast('把星光引到灯碗上，再点燃它', 2.6); AU.wrong(); return; }
      lightLamp(n.i);
    } else if (n.type === 'card') {
      card.taken = true; S.gotCard = true; AU.card();
      fx.bloom(card.x, 1, card.z, 50, BLUE, { w: 3, vr: 2 }); fx.sigil(card.x, .04, card.z, 0xbfd0ff, 'star', 3, 2); fx.ring(card.x, .04, card.z, 0x9fb4ff, 3, 1.1); flash(.2);
      card.g.visible = false; toast('拾得　XVII 星', 3); ctx.updateHud();
    } else if (n.type === 'altar') {
      if (!S.gotCard) { toast('祭坛上空着一个牌槽。牌，也许藏在暗处', 3.2); AU.wrong(); return; }
      toast(`牌槽微微发亮，可还缺 ${3 - S.lampsLit} 盏星灯`, 3.2); AU.wrong();
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
    ctx.hemi.color.lerpColors(new THREE.Color(0x7470b0), new THREE.Color(0xffd9b8), dawn); ctx.hemi.intensity = .13 + dawn * .4;
    return e > 11.5;
  }

  function idle() {
    if (!lamps[0].lit) return ['灯碗在等星光。把光点移到灯上，走近按 E', '左上方的小广场有一盏星灯：先用鼠标把光点放到灯碗上，再走近按 E'];
    if (P.x < 23.5 && !rune.solved) return ['虚空上的路，只在星光照到的地方显现', '让光点走在你前面，照亮脚下的星晶石，再踩上去。掉下去也没关系'];
    if (!rune.solved) return ['石碑的影子，要落在地上的星纹里', '把光点移到石碑的另一侧：光点、石碑、星纹连成一线，并保持一会儿'];
    if (!lamps[1].lit) return ['日晷庭的角落里，还有一盏星灯', '日晷庭左上角的星灯还暗着'];
    if (P.x < 36.5) return ['石门已经打开了，往东走', '穿过右边的石门，进入暗厅'];
    if (!lamps[2].lit) return ['暗厅里也有一盏灯，用星光去找它', '暗厅左下方有一盏星灯'];
    if (!card.taken) return ['遗失的牌藏在暗处，只在星光里现形', '把光点带到暗厅的右下角，牌会显出来'];
    return ['三盏星灯与牌都齐了。去最东边的星之泉', '穿过暗厅，在祭坛前按 E'];
  }

  return {
    id: 1, roman: 'XVII', name: '星', motto: '在无光之处，星辰等待被唤醒', mood: 1,
    spawn: [2.5, 7.5], menuP: [3.6, 7.6], menuOrb: [6.2, 6.5], menuCam: [6.5, 7.6],
    leash: 7.5, mirrorY: 0, hideInReflection: L.hide, voidMat,
    palette: ['#0b0a1f', '#1a1838', '#2a2a5a', '#3d3f7a', '#5a5f9e', '#8a8fc4', '#c3c4e6', '#eef0ff', '#143a44', '#23626a', '#4a9a92', '#4a3a6e', '#7a5f98', '#e3c2b4', '#e8c98e', '#fff1c4'],
    tintLo: [.97, .96, 1.04], tintHi: [1.06, 1.02, .94],
    light: { sky: 0x7470b0, ground: 0x1a1028, hemi: .13, moon: 0x8f9cff, moonK: 1.5, moonDir: [-7, 5], orb: 0xd6e6ff, halo: 0x8fb0ff, mote: [.75, .85, 1],
      env: [0x2a2650, 0x06051a, [[4, 5, 2, 0xffd9a0, .9], [-5, 4, -3, 0x9fb4ff, 1.1], [0, 8, 0, 0x8080c0, 2]]] },
    endCard: { title: '星光归位', line: '第一幕　星　完<br>下一幕　月　已在水边等你' },
    cell,
    solid(x, z) { const c = cell(Math.floor(x), Math.floor(z)); if (c === 'G') return gate.open < .85; return SOLID.has(c); },
    hole(x, z) { const c = cell(Math.floor(x), Math.floor(z)); if (c === ' ') return true; if (c === '*') { const b = bridges.find(b => b.x === Math.floor(x) && b.z === Math.floor(z)); return !b || b.lit < .22; } return false; },
    ground(x, z) { return !'* '.includes(cell(Math.floor(x), Math.floor(z))); },
    onFall() { if (!S.hints.fall) { S.hints.fall = 1; setTimeout(() => toast('星光散了，脚下的路也就没了', 3.4), 900); } },
    ambient(P) { return (P.x > 36.6 && P.x < 49.2) ? .05 : .13; },
    reset, update, logic, nearest, interact, finaleStart, finale, idle,
    finaleCam: () => [altar.x - 1, altar.z],
    finaleOrb: () => [altar.x - 1.2, altar.z + 1],
    progress: () => `${S.lampsLit}${S.gotCard ? 1 : 0}${rune.solved ? 1 : 0}${P.x > 23.5 ? 1 : 0}${P.x > 36.5 ? 1 : 0}`,
    hud: () => ({ label: '星灯', dots: lamps.map(l => l.lit), have: S.gotCard, line: S.done ? '牌已归位' : S.gotCard ? '持有　XVII 星' : '遗失的牌　未寻得' }),
    _: { L, S, lamps, rune, gate, card, altar, ob, bridges, rings }
  };
}
