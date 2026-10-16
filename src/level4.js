// 第四幕 · XX 审判 —— 用 Hug Studio 底图搭出来的关卡：回声石、过去的影子、回响之钟、号角
// 底图在 src/maps/ch4.js，编辑器「地图」页可以直接改；这里只认格子里的字母，机关按字母自动摆好。
//   E 回声石：星光在上面停一会儿，石头记住这束光；之后钟声扫过时，记下的光会在原处重放
//   S 过去的影子：同时被够多的光照着一秒，就会醒来，跟在她身后（姿势和需要几束光见底图的 shadows）
//   B 回响之钟：按 E 敲响，声波一圈圈荡开，扫过的 ~ 声之石浮起成桥，扫过的回声石重放记下的光
//   G 石门：从西到东第 n 组，在第 n 个影子醒来时沉下去
//   K 审判之牌  A 祭坛  H 号角
import * as THREE from 'three';
import * as TX from './textures.js';
import { haloCanvas, cardBackCanvas, mk } from './sprites.js';
import { LAYER_FX, LAYER_SH_ORB, LAYER_SH_MOON } from './post.js';
import { tex, ntex, toon, reflective, billboard, quadGeo, cliffMesh, instWalls, hashv, shadowAll, slabFloor, bevelWallGeo } from './common.js';
import { starVoid } from './abyss.js';
import { VoxChar } from './voxchar.js';
import { normalizeMap } from './levelmap.js';

const WALL_H = 1.7, LOW_H = .45;
export const LIGHT_R = 3.6;          // 一束光能照到影子的距离
export const REC_T = .8;             // 星光要在回声石上停多久才会被记住
const TAIL = 1.2, REPLAY = 6;        // 星光离开后石头还亮多久；钟声唤回的光亮多久
const WAVE_V = 6, WAVE_R = 16;       // 声波的速度与最远半径
const HOLD = 4.4;                    // 声之石浮起后停留多久
const SOLID = new Set(['#', '=', 'T', 'C', 'c', 'O', 'E', 'B', 'A', 'H']);
const clamp = (v, a, b) => v < a ? a : v > b ? b : v;
const smooth = (a, b, x) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
const easeBack = t => { const c = 1.4; return 1 + (c + 1) * Math.pow(t - 1, 3) + c * Math.pow(t - 1, 2); };
const PALE = [.86, .9, 1], GOLD = [1, .86, .55];

// 雪地：大片柔和的白，带一点蓝灰的起伏和零星的亮晶
function snowTex() {
  const N = 64, c = mk(N, N), g = c.getContext('2d'), im = g.createImageData(N, N), d = im.data;
  const R = ['#8d98b8', '#a6b0ca', '#bec6da', '#d4d9e6', '#e6e9f1', '#f4f5f9'].map(h => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)]);
  for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
    let v = .62 + (TX.fbm(x / 16, y / 16, 4) - .5) * .7;
    if (TX.hash(x * 3, y * 5) > .985) v = 1;
    const f = clamp(v, 0, 1) * (R.length - 1) + (TX.BAYER[(y & 3) * 4 + (x & 3)] / 16 - .5) * .9;
    const col = R[clamp(Math.round(f), 0, R.length - 1)], i = (y * N + x) * 4;
    d[i] = col[0]; d[i + 1] = col[1]; d[i + 2] = col[2]; d[i + 3] = 255;
  }
  g.putImageData(im, 0, 0);
  return c;
}

// XX 审判 塔罗牌（像素画）：破晓的天上，天使吹响号角；地上的人张开手臂坐起来
export function judgementCardCanvas() {
  const W = 24, H = 40, c = mk(W, H), g = c.getContext('2d');
  const px = (x, y, col) => { g.fillStyle = col; g.fillRect(x, y, 1, 1); };
  const rect = (x, y, w, h, col) => { g.fillStyle = col; g.fillRect(x, y, w, h); };
  rect(0, 0, W, H, '#efe6d2'); rect(1, 1, W - 2, H - 2, '#c99a52'); rect(2, 2, W - 4, H - 4, '#2a3050');
  const sky = ['#2a3050', '#3a4266', '#565c82', '#7d7c9c', '#b39aa8', '#e8c0b8'];
  for (let y = 2; y < 30; y++) rect(2, y, W - 4, 1, sky[Math.min(5, (y - 2) / 5 | 0)]);
  // 云
  [[3, 14, 7], [14, 15, 7], [6, 16, 12]].forEach(([x, y, w]) => rect(x, y, w, 2, '#d8dde8'));
  // 天使：翅膀、身体、号角
  rect(9, 6, 6, 6, '#f2f3f7'); rect(4, 5, 5, 3, '#d8dde8'); rect(15, 5, 5, 3, '#d8dde8'); rect(5, 8, 3, 2, '#b4bdd2'); rect(16, 8, 3, 2, '#b4bdd2');
  rect(11, 4, 2, 2, '#f8e0d0'); px(11, 3, '#f2d8a0'); px(12, 3, '#f2d8a0');
  for (let k = 0; k < 6; k++) px(13 + k, 8 + (k >> 1), '#f2d8a0');
  rect(19, 10, 2, 2, '#c99a52');
  // 号角的声波
  [[21, 13], [20, 14], [17, 13]].forEach(([x, y]) => px(x, y, '#fff1c4'));
  // 雪地与坐起来的人
  rect(2, 30, W - 4, 6, '#d8dde8'); rect(2, 34, W - 4, 2, '#b4bdd2');
  rect(10, 26, 4, 5, '#4c5578'); rect(11, 24, 2, 2, '#f8e0d0');
  px(9, 25, '#4c5578'); px(8, 24, '#4c5578'); px(14, 25, '#4c5578'); px(15, 24, '#4c5578');
  rect(4, 29, 3, 2, '#6b7598'); rect(17, 29, 3, 2, '#6b7598'); px(5, 28, '#f8e0d0'); px(18, 28, '#f8e0d0');
  // XX
  rect(2, 36, W - 4, 2, '#c99a52');
  [[9, 36], [10, 37], [10, 36], [9, 37], [13, 36], [14, 37], [14, 36], [13, 37]].forEach(([x, y]) => px(x, y, '#5a4630'));
  return c;
}

export function buildJudgement(ctx, data) {
  const { group: root, camQuat, fx, AU, toast, cine, shake, flash, P, orb } = ctx;
  const D = normalizeMap(data);
  const MW = D.w, MH = D.h, grid = D.rows.map(r => r.split(''));
  const cell = (x, z) => (x < 0 || z < 0 || x >= MW || z >= MH) ? ' ' : grid[z][x];
  const isVoid = c => c === ' ' || c === '~';
  const each = (ch, f) => { for (let z = 0; z < MH; z++) for (let x = 0; x < MW; x++) if (grid[z][x] === ch) f(x, z); };
  const L = { sway: [], hide: [] };

  /* ================= 材质：雪白、灰蓝、旧铜金 ================= */
  const cFloor = TX.moonStoneTexHD(), cWallS = TX.ruinWallTex(), cCliff = TX.cliffTex(), cSnow = snowTex();
  const matStone = toon({ map: tex(cFloor), normalMap: ntex(cFloor, 3.5), normalScale: new THREE.Vector2(.8, .8), roughness: .5, color: 0xe4e8f6 });
  const matSnow = toon({ map: tex(cSnow), normalMap: ntex(cSnow, 2.2), normalScale: new THREE.Vector2(.6, .6), roughness: .92 });
  const ws = toon({ map: tex(cWallS), normalMap: ntex(cWallS, 5.5), normalScale: new THREE.Vector2(1.4, 1.4), roughness: .7, color: 0xc6cde4 });
  const wt = toon({ map: tex(cSnow), normalMap: ntex(cSnow, 2.2), roughness: .9 });   // 墙顶积着雪
  const stoneM = toon({ color: 0xa9b1cb, roughness: .5, metalness: .04 });
  const darkM = toon({ color: 0x4c5578, roughness: .6 });
  const brassM = toon({ color: 0xc99a52, roughness: .3, metalness: .85 });
  const haloT = tex(haloCanvas(64)); haloT.wrapS = haloT.wrapT = THREE.ClampToEdgeWrapping;

  /* ================= 地面 / 崖壁 / 墙 ================= */
  const floors = { '.': [], ',': [] }, cliffs = [], tall = [], low = [], ice = [];
  for (let z = 0; z < MH; z++) for (let x = 0; x < MW; x++) {
    const c = grid[z][x]; if (isVoid(c)) continue;
    if (c === '#') tall.push([x, z]); else if (c === '=') low.push([x, z]);
    if (c === 'W') ice.push([x, z]);
    else floors[(c === ',' || c === 'T') ? ',' : '.'].push([x, z]);
    [[0, 1], [0, -1], [1, 0], [-1, 0]].forEach(([dx, dz]) => { if (isVoid(cell(x + dx, z + dz))) cliffs.push([x, z, dx, dz]); });
  }
  if (floors['.'].length) root.add(slabFloor(floors['.'], matStone, { seed: 20, tile: 4 }));
  if (floors[','].length) { const fg = new THREE.Mesh(quadGeo(floors[',']), matSnow); fg.receiveShadow = true; root.add(fg); }
  if (cliffs.length) root.add(cliffMesh(cliffs, toon({ map: tex(cCliff), normalMap: ntex(cCliff, 4), side: THREE.DoubleSide, color: 0xb8c0da })));
  if (tall.length) instWalls(root, tall, bevelWallGeo(WALL_H), [ws, wt]);
  if (low.length) instWalls(root, low, bevelWallGeo(LOW_H), [ws, wt]);
  if (ice.length) {   // 结霜的冰面：能走，淡淡地倒映
    const cW = TX.waterTex();
    const im = reflective(toon({ map: tex(cW), normalMap: ntex(cW, 1.4), color: 0xd8e2f4, roughness: .2, metalness: .1, emissive: 0x2a3a5a, emissiveIntensity: .2 }), .35, .3);
    const m = new THREE.Mesh(quadGeo(ice, .005, 2), im); m.receiveShadow = true; root.add(m);
  }

  /* ================= 虚空：黎明前的星空 ================= */
  const voidMat = starVoid();
  const voidPlane = new THREE.Mesh(new THREE.PlaneGeometry(400, 400), voidMat);
  voidPlane.rotation.x = -Math.PI / 2; voidPlane.position.set(MW / 2, -7, MH / 2); root.add(voidPlane);
  L.hide.push(voidPlane);

  /* ================= 摆件 ================= */
  const crown = tex(TX.foliageTex(['#22304a', '#34466a', '#55698c', '#a9b6cc', '#eef1f7']));
  const trunkM = toon({ color: 0x3a3450 }), crownM = toon({ map: crown, flatShading: true, roughness: .7 });
  const cCol = TX.columnTex(), colM = toon({ map: tex(cCol), normalMap: ntex(cCol, 4), normalScale: new THREE.Vector2(1.3, 1.3), roughness: .4, color: 0xdde2f2 });
  const add = (x, z, f) => { const g0 = new THREE.Group(); g0.position.set(x + .5, 0, z + .5); f(g0); shadowAll(g0); root.add(g0); return g0; };
  each('T', (x, z) => {
    const g0 = add(x, z, g0 => {   // 雪松：三层尖顶，顶上积雪
      const t = new THREE.Mesh(new THREE.CylinderGeometry(.05, .09, .8, 5), trunkM); t.position.y = .4; g0.add(t);
      const k = .85 + hashv(x, z) * .35;
      [[.62, 1.0, 1.0], [.46, .85, 1.55], [.28, .6, 2.02]].forEach(([r, h, y]) => { const m = new THREE.Mesh(new THREE.ConeGeometry(r * k, h * k, 7), crownM); m.position.y = y * k; g0.add(m); });
      g0.rotation.y = hashv(z, x) * 6.28;
    });
    L.sway.push({ o: g0, ph: hashv(x, z) * 6 });
  });
  const column = (x, z, broken) => add(x, z, g0 => {
    const h = broken ? .9 + hashv(x, z) * .5 : 2.3;
    const base = new THREE.Mesh(new THREE.BoxGeometry(.8, .16, .8), colM); base.position.y = .08; g0.add(base);
    const shaft = new THREE.Mesh(new THREE.CylinderGeometry(.26, .29, h, 8), colM); shaft.position.y = .16 + h / 2; g0.add(shaft);
    if (!broken) {
      const cap = new THREE.Mesh(new THREE.BoxGeometry(.78, .18, .78), colM); cap.position.y = .16 + h + .09; g0.add(cap);
      const snow = new THREE.Mesh(new THREE.BoxGeometry(.7, .07, .7), wt); snow.position.y = .16 + h + .21; g0.add(snow);
      const band = new THREE.Mesh(new THREE.CylinderGeometry(.3, .3, .05, 8), brassM); band.position.y = .16 + h - .2; g0.add(band);
    } else { const chunk = new THREE.Mesh(new THREE.DodecahedronGeometry(.22, 0), colM); chunk.position.set(.45, .15, .35); g0.add(chunk); }
  });
  each('C', (x, z) => column(x, z, false));
  each('c', (x, z) => column(x, z, true));
  each('O', (x, z) => add(x, z, g0 => {
    const base = new THREE.Mesh(new THREE.BoxGeometry(.9, .2, .9), stoneM); base.position.y = .1; g0.add(base);
    const cOb = TX.obeliskTex();
    const body = new THREE.Mesh(new THREE.CylinderGeometry(.2, .34, 2.6, 4, 1), toon({ map: tex(cOb), normalMap: ntex(cOb, 4), roughness: .35, color: 0xdde2f2 })); body.rotation.y = Math.PI / 4; body.position.y = 1.5; g0.add(body);
    const tip = new THREE.Mesh(new THREE.ConeGeometry(.2, .36, 4), brassM); tip.rotation.y = Math.PI / 4; tip.position.y = 2.98; g0.add(tip);
  }));

  /* ================= 回声石 ================= */
  const echoes = [];
  each('E', (x, z) => {
    const g0 = add(x, z, g0 => {
      const b = new THREE.Mesh(new THREE.CylinderGeometry(.4, .5, .34, 7), stoneM); b.position.y = .17; g0.add(b);
      const t = new THREE.Mesh(new THREE.CylinderGeometry(.34, .4, .1, 7), darkM); t.position.y = .39; g0.add(t);
    });
    const rm = new THREE.MeshStandardMaterial({ color: 0x6b7598, roughness: .4, emissive: 0xcfdcff, emissiveIntensity: 0 });
    const rune = new THREE.Mesh(new THREE.TorusGeometry(.25, .035, 4, 28), rm); rune.rotation.x = Math.PI / 2; rune.position.y = .45; g0.add(rune);
    const cm = new THREE.MeshStandardMaterial({ color: 0xb4bdd2, roughness: .3, emissive: 0xdfe8ff, emissiveIntensity: 0 });
    const crys = new THREE.Mesh(new THREE.OctahedronGeometry(.12, 0), cm); crys.scale.y = 1.6; crys.position.y = .78; g0.add(crys);
    const halo = billboard(haloT, 2.2, 2.2, true, camQuat); halo.position.y = .8; halo.material.color.set(0xdfe8ff); halo.material.opacity = 0; g0.add(halo); L.hide.push(halo);
    const light = new THREE.PointLight(0xd6e2ff, 0, 5.5, 1.6); light.position.y = 1; g0.add(light);
    echoes.push({ i: echoes.length, x: x + .5, z: z + .5, rm, cm, crys, halo, light, rec: false, hold: 0, tail: 0, replay: 0, lit: 0, glow: 0 });
  });
  const echoOn = e => e.rec && (e.resting || e.tail > 0 || e.replay > 0);

  /* ================= 回响之钟 ================= */
  const bells = [];
  const bellPts = [[.04, 0], [.2, -.03], [.27, -.18], [.29, -.42], [.34, -.62], [.43, -.76], [.45, -.8]].map(([r, y]) => new THREE.Vector2(r, y));
  const bellGeo = new THREE.LatheGeometry(bellPts, 14);
  each('B', (x, z) => {
    const g0 = add(x, z, g0 => {
      const base = new THREE.Mesh(new THREE.BoxGeometry(1, .14, .7), stoneM); base.position.y = .07; g0.add(base);
      [-.42, .42].forEach(px => { const p = new THREE.Mesh(new THREE.BoxGeometry(.13, 2.2, .13), darkM); p.position.set(px, 1.1, 0); g0.add(p); });
      const beam = new THREE.Mesh(new THREE.BoxGeometry(1.12, .14, .2), darkM); beam.position.y = 2.22; g0.add(beam);
      const snow = new THREE.Mesh(new THREE.BoxGeometry(1.1, .06, .22), wt); snow.position.y = 2.32; g0.add(snow);
    });
    const pivot = new THREE.Group(); pivot.position.y = 2.12; g0.add(pivot);
    const bell = new THREE.Mesh(bellGeo, toon({ color: 0xc99a52, roughness: .3, metalness: .85, side: THREE.DoubleSide })); bell.castShadow = true; pivot.add(bell);
    const clap = new THREE.Mesh(new THREE.SphereGeometry(.07, 6, 4), darkM); clap.position.y = -.7; pivot.add(clap);
    bells.push({ x: x + .5, z: z + .5, pivot, t: 9, cool: 0 });
  });
  // 声波：贴地的一圈淡光，越走越淡
  const ringGeo = new THREE.RingGeometry(.93, 1, 80);
  const waves = [];
  const wavePool = Array.from({ length: 6 }, () => {
    const m = new THREE.Mesh(ringGeo, new THREE.MeshBasicMaterial({ color: 0xe6ecff, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false }));
    m.rotation.x = -Math.PI / 2; m.layers.set(LAYER_FX); m.visible = false; root.add(m); return m;
  });

  /* ================= 声之石：钟声扫过时浮起 ================= */
  const stones = [], stoneAt = new Map();
  each('~', (x, z) => { stoneAt.set(x + ',' + z, stones.length); stones.push({ x: x + .5, z: z + .5, k: 0, hold: 0, ph: hashv(x, z) * 6 }); });
  const stoneMesh = stones.length ? new THREE.InstancedMesh(new THREE.BoxGeometry(.92, .32, .92), toon({ color: 0xffffff, roughness: .5 }), stones.length) : null;
  if (stoneMesh) { stoneMesh.castShadow = stoneMesh.receiveShadow = true; stoneMesh.frustumCulled = false; root.add(stoneMesh); }
  const _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), _s = new THREE.Vector3(1, 1, 1), _p = new THREE.Vector3(), _c = new THREE.Color(), UP = new THREE.Vector3(0, 1, 0);
  const cLow = new THREE.Color(0x4c5578), cHigh = new THREE.Color(0xdfe4f0);

  /* ================= 石门 ================= */
  const cGate = TX.gateTex(), gateT = tex(cGate), gateN = ntex(cGate, 4);
  const gm = toon({ map: gateT, normalMap: gateN, normalScale: new THREE.Vector2(1.5, 1.5), roughness: .5, color: 0xd6dcef });
  const gates = [];
  {
    const seen = new Set();
    each('G', (x, z) => {
      if (seen.has(x + ',' + z)) return;
      const cells = [], q = [[x, z]]; seen.add(x + ',' + z);
      while (q.length) { const [a, b] = q.pop(); cells.push([a, b]); [[1, 0], [-1, 0], [0, 1], [0, -1]].forEach(([dx, dz]) => { const k = (a + dx) + ',' + (b + dz); if (!seen.has(k) && cell(a + dx, b + dz) === 'G') { seen.add(k); q.push([a + dx, b + dz]); } }); }
      gates.push({ cells, x: Math.min(...cells.map(c => c[0])), open: 0, opening: false, meshes: [] });
    });
    gates.sort((a, b) => a.x - b.x);
    gates.forEach(G => G.cells.forEach(([x, z]) => {
      const m = new THREE.Mesh(new THREE.BoxGeometry(.94, WALL_H, .94), [gm, gm, wt, wt, gm, gm]);
      m.position.set(x + .5, WALL_H / 2, z + .5); m.castShadow = m.receiveShadow = true; root.add(m);
      const band = new THREE.Mesh(new THREE.BoxGeometry(.98, .08, .98), brassM); band.position.y = WALL_H / 2 - .3; m.add(band);
      G.meshes.push(m);
    }));
  }
  const gateAt = new Map(); gates.forEach((G, i) => G.cells.forEach(([x, z]) => gateAt.set(x + ',' + z, i)));

  /* ================= 过去的影子 ================= */
  const shadows = [];
  const meta = D.shadows || [];
  const sCells = []; each('S', (x, z) => sCells.push([x, z])); sCells.sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  const pipTex = haloT;
  sCells.forEach(([x, z], i) => {
    const m = meta[i] || {}, pose = m.pose || ['curl', 'cry', 'look', 'reach'][i % 4], need = clamp(m.need | 0 || 2, 1, 6);
    const vc = new VoxChar();
    vc.mat.transparent = true; vc.mat.opacity = .78; vc.mat.color.set(0x3a4266);
    vc.group.traverse(o => { if (o.isMesh) { o.layers.set(LAYER_FX); o.layers.enable(LAYER_SH_ORB); o.layers.enable(LAYER_SH_MOON); o.castShadow = true; o.receiveShadow = false; } });
    const g0 = new THREE.Group(); g0.add(vc.group); root.add(g0);
    const pips = [];
    for (let k = 0; k < need; k++) {
      const pm = new THREE.Mesh(new THREE.PlaneGeometry(.26, .26), new THREE.MeshBasicMaterial({ map: pipTex, color: 0x6b7598, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false }));
      pm.quaternion.copy(camQuat); pm.layers.set(LAYER_FX); root.add(pm); pips.push(pm); L.hide.push(pm);
    }
    const halo = billboard(haloT, 2.6, 2.6, true, camQuat); halo.material.color.set(0xdfe6ff); halo.material.opacity = 0; root.add(halo); L.hide.push(halo);
    const dir = { curl: 'up', cry: 'down', look: 'left', reach: 'left' }[pose] || 'down';
    shadows.push({ i, pose, need, vc, g: g0, pips, halo, hx: x + .5, hz: z + .5, x: x + .5, z: z + .5, dir, cnt: 0, hold: 0, awake: false, wake: 0, order: -1, vx: 0, vz: 0, fade: 1, merged: false });
  });
  const shadowCell = (x, z) => shadows.find(s => !s.awake && Math.floor(s.hx) === x && Math.floor(s.hz) === z);
  const cDark = new THREE.Color(0x3a4266), cPale = new THREE.Color(0xe8ecff), cEm = new THREE.Color(0x56628f);

  /* ================= 塔罗牌 ================= */
  let card = null;
  each('K', (x, z) => {
    if (card) return;
    const front = tex(judgementCardCanvas()), back = tex(cardBackCanvas());
    front.wrapS = front.wrapT = back.wrapS = back.wrapT = THREE.ClampToEdgeWrapping;
    const g0 = new THREE.Group(); g0.position.set(x + .5, 0, z + .5);
    const fm = toon({ map: front, emissive: 0xffffff, emissiveMap: front, emissiveIntensity: .7 });
    const bm = toon({ map: back, emissive: 0xffffff, emissiveMap: back, emissiveIntensity: .7 });
    const f = new THREE.Mesh(new THREE.PlaneGeometry(.75, 1.25), fm), b = new THREE.Mesh(new THREE.PlaneGeometry(.75, 1.25), bm);
    b.rotation.y = Math.PI; f.castShadow = b.castShadow = true;
    const holder = new THREE.Group(); holder.add(f, b); holder.position.y = 1.0; g0.add(holder);
    const halo = billboard(haloT, 2.6, 2.6, true, camQuat); halo.material.color.set(0xf2d8a0); halo.material.opacity = .4; halo.position.y = 1; g0.add(halo);
    root.add(g0);
    card = { x: x + .5, z: z + .5, g: g0, holder, taken: false };
  });

  /* ================= 祭坛 ================= */
  let altar = null;
  each('A', (x, z) => {
    if (altar) return;
    const g0 = add(x, z, g0 => {
      const b1 = new THREE.Mesh(new THREE.CylinderGeometry(.62, .7, .3, 8), stoneM); b1.position.y = .15; g0.add(b1);
      const b2 = new THREE.Mesh(new THREE.CylinderGeometry(.42, .5, .5, 8), stoneM); b2.position.y = .55; g0.add(b2);
      const top = new THREE.Mesh(new THREE.CylinderGeometry(.55, .45, .12, 8), brassM); top.position.y = .86; g0.add(top);
    });
    const cardM = toon({ map: tex(judgementCardCanvas()), transparent: true, opacity: 0, emissive: 0xc8b8a0, emissiveIntensity: .6 });
    cardM.map.wrapS = cardM.map.wrapT = THREE.ClampToEdgeWrapping;
    const slot = new THREE.Mesh(new THREE.PlaneGeometry(.45, .75), cardM); slot.position.y = 1.35; slot.quaternion.copy(camQuat); g0.add(slot);
    const halo = billboard(haloT, 3.4, 3.4, true, camQuat); halo.material.color.set(0xffe2b0); halo.material.opacity = 0; halo.position.y = 1.4; g0.add(halo); L.hide.push(halo);
    const light = new THREE.PointLight(0xffe6c0, 0, 16, 1.2); light.position.y = 3; g0.add(light);
    altar = { x: x + .5, z: z + .5, g: g0, cardM, halo, light };
  });

  /* ================= 号角 ================= */
  let horn = null;
  {
    const hc = []; each('H', (x, z) => hc.push([x, z]));
    if (hc.length) {
      const cx = hc.reduce((s, c) => s + c[0], 0) / hc.length + .5, cz = hc.reduce((s, c) => s + c[1], 0) / hc.length + .5;
      const g0 = new THREE.Group(); g0.position.set(cx, 0, cz); root.add(g0);
      const ped = new THREE.Mesh(new THREE.CylinderGeometry(.9, 1.05, .5, 8), stoneM); ped.position.y = .25; g0.add(ped);
      const pts = [[.07, 0], [.09, .4], [.1, 1.2], [.13, 1.9], [.2, 2.4], [.34, 2.75], [.6, 3.0], [.95, 3.12], [1.05, 3.14]].map(([r, y]) => new THREE.Vector2(r, y));
      const body = new THREE.Mesh(new THREE.LatheGeometry(pts, 18), toon({ color: 0xc99a52, roughness: .32, metalness: .85, side: THREE.DoubleSide }));
      const arm = new THREE.Group(); arm.position.set(.25, .5, .2); arm.rotation.set(-.38, 0, .42); arm.add(body); g0.add(arm);   // 立在台上，喇叭口朝西北的天空
      [.9, 1.7].forEach(y => { const r = new THREE.Mesh(new THREE.TorusGeometry(y < 1 ? .13 : .16, .035, 4, 16), brassM); r.rotation.x = Math.PI / 2; r.position.y = y; body.add(r); });
      shadowAll(g0);
      const mouth = new THREE.Vector3(); arm.updateMatrixWorld(true); body.localToWorld(mouth.set(0, 3.1, 0));
      const halo = billboard(haloT, 4, 4, true, camQuat); halo.material.color.set(0xfff1c4); halo.material.opacity = 0; halo.position.copy(mouth).sub(g0.position); g0.add(halo); L.hide.push(halo);
      horn = { x: cx, z: cz, g: g0, mouth, halo };
    }
  }

  // 牌被哪道门挡着：离牌最近的那组石门开了，牌才拿得到
  let cardGate = -1;
  if (card) { let bd = 2.5; gates.forEach((G, i) => G.cells.forEach(([x, z]) => { const d = Math.hypot(x + .5 - card.x, z + .5 - card.z); if (d < bd) { bd = d; cardGate = i; } })); }
  const gateOpenFor = () => cardGate < 0 || gates[cardGate].open > .5;

  /* ================= 引导微光 ================= */
  const BC = {
    echo: echoes.map(e => fx.beacon(e.x, .8, e.z, 0xcfdcff, .9)),
    bell: bells.map(b => fx.beacon(b.x, 1.5, b.z, 0xf2d8a0, .9)),
    card: card ? fx.beacon(card.x, .9, card.z, 0xf2d8a0, 1.0) : null,
    altar: altar ? fx.beacon(altar.x, 1.15, altar.z, 0xffd27a, 1.3) : null
  };

  /* ================= 状态 ================= */
  const S = { hints: {}, woke: 0, gotCard: false, done: false, trail: [], rang: 0, merged: 0, fin: {} };

  function reset() {
    Object.assign(S, { hints: {}, woke: 0, gotCard: false, done: false, trail: [], rang: 0, merged: 0, fin: {} });
    echoes.forEach(e => Object.assign(e, { rec: false, hold: 0, tail: 0, replay: 0, lit: 0, glow: 0, resting: false }));
    bells.forEach(b => { b.t = 9; b.cool = 0; b.pivot.rotation.set(0, 0, 0); });
    waves.length = 0; wavePool.forEach(m => m.visible = false);
    stones.forEach(s => { s.k = 0; s.hold = 0; });
    gates.forEach(G => { G.open = 0; G.opening = false; G.meshes.forEach(m => m.position.y = WALL_H / 2); });
    shadows.forEach(s => {
      Object.assign(s, { x: s.hx, z: s.hz, cnt: 0, hold: 0, awake: false, wake: 0, order: -1, vx: 0, vz: 0, fade: 1, merged: false, merging: false });
      s.g.visible = true; s.vc.mat.color.copy(cDark); s.vc.mat.emissive.set(0); s.vc.mat.opacity = .78;
    });
    if (card) { card.taken = false; card.g.visible = true; }
    if (altar) { altar.cardM.opacity = 0; altar.light.intensity = 0; altar.halo.material.opacity = 0; }
    if (horn) horn.halo.material.opacity = 0;
    ctx.hemi.color.set(0xb8c4e0);
    voidMat.uniforms.trail.value = 0; voidMat.uniforms.spin.value = 0;
  }

  /* ---------- 钟声 ---------- */
  function ring(b, quiet) {
    b.t = 0; b.cool = 1.2; S.rang++;
    if (!quiet) { AU.lamp(2); setTimeout(() => AU.lamp(4), 140); shake(.05, .4); }
    fx.ring(b.x, .05, b.z, 0xf2d8a0, 2.6, .9);
    fx.burst(b.x, 1.6, b.z, 10, { c: GOLD, sp: .9, life: .9, up: .5 });
    const m = wavePool.find(m => !m.visible) || wavePool[0];
    m.visible = true; m.position.set(b.x, .06, b.z);
    waves.push({ x: b.x, z: b.z, r: .3, m, hitS: new Set(), hitE: new Set() });
  }
  function updateWaves(dt) {
    for (let i = waves.length - 1; i >= 0; i--) {
      const w = waves[i];
      w.r += WAVE_V * dt;
      w.m.scale.setScalar(w.r); w.m.material.opacity = .38 * (1 - w.r / WAVE_R) * Math.min(1, w.r);
      stones.forEach((s, k) => {
        if (w.hitS.has(k)) return;
        if (Math.hypot(s.x - w.x, s.z - w.z) <= w.r) { w.hitS.add(k); s.hold = HOLD; if (s.k < .1) fx.burst(s.x, -.3, s.z, 4, { c: PALE, sp: .5, life: .7, up: .8 }); }
      });
      echoes.forEach(e => {
        if (!e.rec || w.hitE.has(e.i)) return;
        if (Math.hypot(e.x - w.x, e.z - w.z) <= w.r) { w.hitE.add(e.i); if (e.replay <= 0) { AU.lamp(e.i % 5); fx.ring(e.x, .05, e.z, 0xdfe8ff, 2.4, 1); fx.burst(e.x, .8, e.z, 10, { c: PALE, sp: .7, life: 1, up: .6 }); } e.replay = REPLAY; }
      });
      if (w.r >= WAVE_R) { w.m.visible = false; waves.splice(i, 1); }
    }
  }

  /* ---------- 影子苏醒 ---------- */
  function wakeShadow(s) {
    s.awake = true; s.order = S.woke++;
    AU.lamp(s.i % 5); setTimeout(() => AU.rise(), 300);
    const G = gates[s.i];
    const lines = ['这个声音……好像是我自己的。', '', '', '原来你一直在这里等我。'];
    const line = s.i === shadows.length - 1 ? lines[3] : lines[s.i] || '';
    const steps = [
      { dur: 1.8, focus: [s.hx, s.hz], start() { fx.bloom(s.hx, 1, s.hz, 50, PALE, { w: 2.6, vr: 1.8, up: .8 }); fx.ring(s.hx, .04, s.hz, 0xdfe6ff, 3.2, 1.3); fx.sigil(s.hx, .05, s.hz, 0xe8ecff, 'star', 2.6, 2); flash(.18); },
        end() { if (line) toast(line, 4.2); } }
    ];
    if (G) {
      const gx = G.cells.reduce((a, c) => a + c[0], 0) / G.cells.length + .5, gz = G.cells.reduce((a, c) => a + c[1], 0) / G.cells.length + .5;
      steps.push({ dur: 2.6, focus: [gx - 1, gz], start() { G.opening = true; AU.stone(); shake(.08, .5); }, run(k, dt) { if (Math.random() < dt * 3) AU.stone(); shake(.05, .15); } });
    }
    cine(steps);
    ctx.updateHud();
  }
  function lightsOn(s) {
    let n = ctx.orbNear(s.x, s.z, 1.0) < LIGHT_R ? 1 : 0;
    echoes.forEach(e => { if (echoOn(e) && Math.hypot(e.x - s.x, e.z - s.z) < LIGHT_R) n++; });
    return n;
  }

  /* ---------- 每帧 ---------- */
  function update(dt, T) {
    voidMat.uniforms.time.value = T;
    L.sway.forEach(s => { s.o.rotation.z = Math.sin(T * .9 + s.ph) * .018; });
    // 回声石
    echoes.forEach(e => {
      e.resting = ctx.orbNear(e.x, e.z, .8) < .95;
      if (e.resting) {
        const pv = e.hold; e.hold = Math.min(REC_T, e.hold + dt);
        if (!e.rec && e.hold >= REC_T && pv < REC_T) {
          e.rec = true; AU.ghost(); AU.lamp(e.i % 5);
          fx.ring(e.x, .05, e.z, 0xdfe8ff, 2, 1); fx.sigil(e.x, .05, e.z, 0xdfe8ff, 'star', 1.6, 1.4); fx.burst(e.x, .8, e.z, 12, { c: PALE, sp: .6, life: 1 });
          if (!S.hints.rec) { S.hints.rec = 1; toast('石头记住了这束光', 3); }
        }
        if (e.rec) e.tail = TAIL;
      } else { e.hold = Math.max(0, e.hold - dt * 2); e.tail = Math.max(0, e.tail - dt); }
      e.replay = Math.max(0, e.replay - dt);
      const on = echoOn(e) ? 1 : 0;
      e.lit += (on - e.lit) * (1 - Math.exp(-dt * 6));
      const mem = e.rec ? .35 : e.hold / REC_T * .5;
      e.rm.emissiveIntensity = mem + e.lit * 1.8;
      e.cm.emissiveIntensity = e.lit * 2.2 + mem * .6;
      e.light.intensity = e.lit * (3.2 + Math.sin(T * 3 + e.i) * .2);
      e.halo.material.opacity = e.lit * .4 + mem * .08;
      e.crys.rotation.y += dt * (.5 + e.lit * 2); e.crys.position.y = .78 + Math.sin(T * 1.7 + e.i) * .04 + e.lit * .12;
      if (e.replay > 0 && e.replay < 1.2 && Math.random() < dt * 8) fx.emit(e.x, .8, e.z, { vy: .4, life: .8, c: PALE, a: .6 });
      if (e.lit > .5 && Math.random() < dt * 5) fx.emit(e.x + (Math.random() - .5) * .4, .9, e.z + (Math.random() - .5) * .4, { vy: .5, life: 1.4, c: PALE, tw: 6 });
    });
    // 钟
    bells.forEach(b => {
      b.t += dt; b.cool = Math.max(0, b.cool - dt);
      b.pivot.rotation.z = Math.sin(b.t * 9) * .32 * Math.exp(-b.t * 1.3);
    });
    updateWaves(dt);
    // 声之石
    if (stoneMesh) {
      stones.forEach((s, k) => {
        if (s.hold > 0) { s.hold -= dt; s.k = Math.min(1, s.k + dt / .35); } else s.k = Math.max(0, s.k - dt / .7);
        const e = s.hold > 0 ? easeBack(s.k) : s.k * s.k * (3 - 2 * s.k);
        let y = -1.6 * (1 - e) - .16;
        if (s.hold > 0 && s.hold < .9) y += Math.sin(T * 38 + s.ph) * .025;       // 快沉下去前轻轻发抖
        else y += Math.sin(T * 1.3 + s.ph) * .03 * (1 - s.k);
        _p.set(s.x, y, s.z); _q.setFromAxisAngle(UP, (1 - s.k) * (s.ph - 3) * .1); _m.compose(_p, _q, _s);
        stoneMesh.setMatrixAt(k, _m);
        stoneMesh.setColorAt(k, _c.copy(cLow).lerp(cHigh, s.k));
      });
      stoneMesh.instanceMatrix.needsUpdate = true; if (stoneMesh.instanceColor) stoneMesh.instanceColor.needsUpdate = true;
    }
    // 石门
    gates.forEach(G => {
      if (G.opening && G.open < 1) {
        const pv = G.open; G.open = Math.min(1, G.open + dt / 2.2);
        if (Math.random() < dt * 30) { const [x, z] = G.cells[Math.random() * G.cells.length | 0]; fx.emit(x + Math.random(), .1, z + Math.random(), { vy: .5, vx: (Math.random() - .5), life: .8, c: [.8, .82, .9], a: .6 }); }
        if (pv < 1 && G.open >= 1) { shake(.08, .3); AU.stone(); }
      }
      const e = G.open * G.open * (3 - 2 * G.open);
      G.meshes.forEach(m => { m.position.y = WALL_H / 2 - e * (WALL_H + .05); m.visible = G.open < .999; });
    });
    // 影子
    updateShadows(dt, T);
    // 牌
    if (card && !card.taken) { card.holder.rotation.y += dt * 1.2; card.holder.position.y = 1 + Math.sin(T * 1.8) * .08; }
    // 雪
    if (Math.random() < dt * 26) fx.emit(P.x + (Math.random() - .5) * 28, 3 + Math.random() * 3, P.z + (Math.random() - .5) * 18, { vy: -.32 - Math.random() * .15, vx: .1 + Math.random() * .08, life: 6 + Math.random() * 3, c: [.93, .95, 1], a: .75, tw: 1.5 });
    // 引导微光
    BC.echo.forEach((b, i) => b.on = !echoes[i].rec);
    BC.bell.forEach((b, i) => b.on = bells[i].cool <= 0 && S.woke < shadows.length);
    if (BC.card) BC.card.on = !!card && !card.taken && gateOpenFor(card);
    if (BC.altar) BC.altar.on = !S.done;
  }

  function updateShadows(dt, T) {
    const cut = ctx.S.mode === 'cut';
    // 她走过的路：醒来的影子一个接一个地踩着走
    const tr = S.trail, last = tr[tr.length - 1];
    if (!last || Math.hypot(P.x - last[0], P.z - last[1]) > .15) { tr.push([P.x, P.z]); if (tr.length > 240) tr.shift(); }
    shadows.forEach(s => {
      let moving = false, crouch = 0, act = null, actT = 0, reach = null, dir = s.dir, vx = 0, vz = 0;
      if (!s.awake) {
        const n = lightsOn(s), pv = s.cnt; s.cnt = n;
        if (n > pv && n < s.need) AU.ghost();
        if (n >= s.need) { s.hold += dt; if (Math.random() < dt * 20) fx.emit(s.x + (Math.random() - .5) * .6, .2, s.z + (Math.random() - .5) * .6, { vy: .8, life: 1, c: PALE, tw: 8 }); }
        else s.hold = Math.max(0, s.hold - dt * .6);
        if (s.hold >= 1 && !ctx.S.cine) wakeShadow(s);
        const lift = Math.min(n, s.need) / s.need;
        if (s.pose === 'curl') { crouch = 7 - lift * 2; }
        else if (s.pose === 'cry') { crouch = 7; act = 'rub'; actT = T % 1.3; }
        else if (s.pose === 'look') { act = 'look'; actT = T % 3.4; }
        else if (s.pose === 'reach') { reach = { k: .7 + lift * .3, tap: 0, yaw: -Math.PI / 2 }; }
        s.halo.material.opacity = lift * .25 + Math.sin(T * 2 + s.i) * .02 + .03;
      } else {
        s.wake = Math.min(1, s.wake + dt / 1.6);
        if (s.wake < 1) { crouch = s.pose === 'curl' || s.pose === 'cry' ? 7 * (1 - smooth(.2, .9, s.wake)) : 0; dir = 'down'; }
        else if (!cut) {
          const k = Math.max(0, tr.length - 1 - (s.order + 1) * 6), t = tr[k] || [P.x, P.z];
          const dx = t[0] - s.x, dz = t[1] - s.z, d = Math.hypot(dx, dz), dP = Math.hypot(P.x - s.x, P.z - s.z);
          if (dP < .9 + s.order * .55 && d < 2.5) { /* 已经跟在她身后了：别挤进她身体里 */ }
          else if (d > 9) { s.x = t[0]; s.z = t[1]; fx.swirl(s.x, .4, s.z, .5, PALE); }
          else if (d > .05) {
            const sp = Math.min(d * 3.2, 5.6), st = Math.min(d, sp * dt);
            vx = dx / d * sp; vz = dz / d * sp; s.x += dx / d * st; s.z += dz / d * st; moving = sp > .4;
          }
        } else if (S.fin.gather) {
          // 终章：围到她身边，再一个个融进她身体里
          const a = s.order / Math.max(1, shadows.length) * Math.PI * 2 + .6, R = s.merging ? 0 : 1.5;
          const tx = P.x + Math.cos(a) * R, tz = P.z + Math.sin(a) * R * .8, dx = tx - s.x, dz = tz - s.z, d = Math.hypot(dx, dz);
          if (d > .05) { const sp = Math.min(d * 2.4, 3), st = Math.min(d, sp * dt); vx = dx / d * sp; vz = dz / d * sp; s.x += dx / d * st; s.z += dz / d * st; moving = sp > .4; }
          else { vx = P.x - s.x; vz = P.z - s.z; }
        }
        const w = smooth(0, 1, s.wake);
        s.vc.mat.color.copy(cDark).lerp(cPale, w); s.vc.mat.emissive.copy(cEm).multiplyScalar(w * .55);
        s.vc.mat.opacity = (.78 - w * .18) * s.fade;
        s.halo.material.opacity = (.3 * (1 - w) + .12) * s.fade;
        if (!S.done && Math.random() < dt * 3) fx.emit(s.x + (Math.random() - .5) * .4, .9, s.z + (Math.random() - .5) * .3, { vy: .3, life: 1.2, c: PALE, a: .6, tw: 5 });
      }
      s.g.position.set(s.x, 0, s.z); s.vc.U.foot.value.copy(s.g.position);
      s.halo.position.set(s.x, 1, s.z);
      s.vc.update({ dir, moving, run: 0, vx, vz, dt, lie: false, crouch, act, actT, reach, wave: null });
      // 头顶的小光点：要几束光、现在照到了几束
      s.pips.forEach((pm, k) => {
        pm.position.set(s.x + (k - (s.need - 1) / 2) * .3, 2.35, s.z);
        const on = k < s.cnt, vis = s.awake ? 0 : Math.hypot(P.x - s.x, P.z - s.z) < 7 || s.cnt > 0 ? 1 : 0;
        pm.material.color.set(on ? 0xffe6a8 : 0x8d98b8);
        pm.material.opacity += ((vis * (on ? .95 : .45)) - pm.material.opacity) * (1 - Math.exp(-dt * 6));
        pm.visible = pm.material.opacity > .01;
      });
      s.g.visible = s.fade > .01;
    });
  }

  function onStep(p, dt) {
    if (Math.random() < dt * (p.run > .6 ? 16 : 6) && cell(Math.floor(p.x), Math.floor(p.z)) === ',') fx.emit(p.x + (Math.random() - .5) * .3, .05, p.z + .1, { vy: .45, vx: -p.vx * .08, vz: -p.vz * .08, life: .6, c: [.92, .94, 1], a: .7, drag: 2 });
  }

  /* ---------- 判定与提示 ---------- */
  const AREAS = [[4, '静默之谷。雪落下来，没有声音'], [43.6, '回声钟楼。这里的每个声音，都会回来'], [79.6, '号角之巅。有人在很高的地方，等你回应']];
  function logic() {
    const h = S.hints;
    AREAS.forEach(([x, line], i) => { if (!h['a' + i] && P.x > x && x < MW) { h['a' + i] = 1; toast(line, 3.8); } });
    if (!h.bell && bells.some(b => Math.hypot(P.x - b.x, P.z - b.z) < 2.6) && !S.rang) { h.bell = 1; toast('钟声扫过的石头，会浮起来一会儿', 3.6); }
  }

  function nearest() {
    const out = [];
    bells.forEach((b, i) => out.push({ type: 'bell', i, x: b.x, y: 2.4, z: b.z, r: 1.7, label: '敲钟' }));
    if (card && !card.taken && gateOpenFor(card)) out.push({ type: 'card', x: card.x, y: 1.8, z: card.z, label: '拾起塔罗牌' });
    if (altar && !S.done) out.push(S.gotCard && S.woke >= shadows.length ? { type: 'finale', x: altar.x, y: 1.6, z: altar.z, r: 2, label: '放入　XX 审判' } : { type: 'altar', x: altar.x, y: 1.6, z: altar.z, r: 2, label: '查看祭坛' });
    return out;
  }
  function interact(n) {
    if (n.type === 'bell') { const b = bells[n.i]; if (b.cool > 0) return; ring(b); }
    else if (n.type === 'card') {
      card.taken = true; S.gotCard = true; AU.card();
      fx.bloom(card.x, 1, card.z, 50, GOLD, { w: 3, vr: 2 }); fx.sigil(card.x, .04, card.z, 0xf2d8a0, 'sun', 3, 2); fx.ring(card.x, .04, card.z, 0xf2d8a0, 3, 1.1); flash(.2);
      card.g.visible = false; toast('拾得　XX 审判', 3); ctx.updateHud();
    } else if (n.type === 'altar') {
      AU.wrong();
      if (!S.gotCard) toast('祭坛上空着一个牌槽', 3);
      else toast(`号角还很安静。还有 ${shadows.length - S.woke} 个影子没有醒来`, 3.4);
    }
  }

  /* ---------- 终章：号角吹响，影子们回到她身体里，天亮了 ---------- */
  const easeIn = t => t * t * (3 - 2 * t);
  function finaleStart() {
    S.done = true; S.fin = {};
    fx.sigil(altar.x, .04, altar.z, 0xffe2b0, 'sun', 5.5, 3.5, { spin: 1.2 }); flash(.25);
    Object.values(BC).flat().forEach(b => b && (b.on = false));
    // 落在远处的影子先回到她身边
    shadows.forEach((s, k) => { if (s.awake && Math.hypot(s.x - P.x, s.z - P.z) > 5) { s.x = P.x - 1.2 - k * .5; s.z = P.z + (k % 2 ? .8 : -.8); fx.swirl(s.x, .4, s.z, .5, PALE); } });
  }
  function finale(dt, e) {
    const F = S.fin, hx = horn ? horn.mouth.x : altar.x + 2, hz = horn ? horn.mouth.z : altar.z;
    altar.cardM.opacity = smooth(.2, 1.2, e);
    altar.light.intensity = smooth(.6, 2.5, e) * 4; altar.halo.material.opacity = smooth(.6, 2.5, e) * .25;
    if (e > 1.4 && !F.blow) {
      F.blow = 1; AU.rise(); AU.lamp(0); flash(.35); shake(.14, 1.6);
      fx.bloom(hx, horn ? horn.mouth.y : 3, hz, 90, GOLD, { w: 3.6, vr: 3, up: 1.2 });
      toast('号角吹响了', 3.4);
    }
    if (horn) horn.halo.material.opacity = smooth(1.2, 1.8, e) * (1 - smooth(6, 9, e)) * .6;
    // 号声一圈圈荡开：每一块回声石都把记下的光放出来
    if (e > 1.4 && e < 6 && Math.floor(e / .8) !== Math.floor((e - dt) / .8)) {
      fx.ring(horn ? horn.x : hx, .05, horn ? horn.z : hz, 0xf2d8a0, 14, 2.2, { a: .7 });
      const m = wavePool.find(m => !m.visible); if (m) { m.visible = true; m.position.set(horn ? horn.x : hx, .06, horn ? horn.z : hz); waves.push({ x: horn ? horn.x : hx, z: horn ? horn.z : hz, r: .3, m, hitS: new Set(), hitE: new Set(echoes.map(x => x.i)) }); }
    }
    if (e > 2 && !F.echo) { F.echo = 1; echoes.forEach((x, i) => { x.rec = true; setTimeout(() => { x.replay = 9; fx.ring(x.x, .05, x.z, 0xdfe8ff, 2.4, 1); AU.lamp(i % 5); }, i * 160); }); }
    if (e > 2.6) F.gather = 1;
    // 影子们一个个融进她身体里
    const order = shadows.filter(s => s.awake).sort((a, b) => a.order - b.order);
    order.forEach((s, k) => {
      const t0 = 5.6 + k * .9;
      if (e > t0 && !s.merging) { s.merging = true; }
      if (s.merging && !s.merged && Math.hypot(s.x - P.x, s.z - P.z) < .35) {
        s.merged = true; AU.lamp(k % 5); fx.bloom(P.x, 1, P.z, 40, PALE, { w: 2.4, vr: 1.6, up: .8 }); fx.ring(P.x, .04, P.z, 0xe8ecff, 2.6 + k * .4, 1.2); flash(.12);
      }
      if (s.merged) s.fade = Math.max(0, s.fade - dt * 2.5);
    });
    if (e > 5.6 + order.length * .9 + .8 && !F.hug) { F.hug = 1; fx.sigil(P.x, .05, P.z, 0xfff1c4, 'sun', 4, 3, { spin: .8 }); fx.bloom(P.x, 1.2, P.z, 70, GOLD, { w: 3, vr: 2.4, up: 1 }); shake(.06, .5); AU.rise(); }
    if (e > 10 && !F.line) { F.line = 1; toast('走吧，这次我不会再丢下你了。', 4.8); }
    // 星轨与破晓
    const trail = smooth(3, 8, e);
    voidMat.uniforms.trail.value = trail;
    voidMat.uniforms.spin.value += dt * (.04 + trail * .55);
    voidMat.uniforms.pole.value.set(altar.x, altar.z - 4);
    const dawn = smooth(5, 10.5, e);
    ctx.hemi.color.lerpColors(new THREE.Color(0xb8c4e0), new THREE.Color(0xffdcc0), dawn); ctx.hemi.intensity = .3 + dawn * .14;
    if (e > 2 && e < 9 && Math.random() < dt * 26) { const a = Math.random() * 6.28, rr = 1 + Math.random() * 6; fx.emit(altar.x + Math.cos(a) * rr, .2, altar.z + Math.sin(a) * rr, { vy: 1 + Math.random(), life: 2, c: Math.random() < .5 ? GOLD : PALE, tw: 8 }); }
    return e > 14;
  }

  // 停留太久：第一句只给意象，第二句只指方向
  const sh = i => shadows[i] || { awake: true };
  const firstUnrec = () => echoes.find(e => !e.rec);
  function idle() {
    if (echoes[0] && !echoes[0].rec) return ['雪地里的石头，会记住光', '让星光在那块石头上停一会儿'];
    if (!sh(0).awake) return ['她蜷在雪里。一束光还不够', '石头记住的光，加上你自己的星光'];
    if (P.x < 31.5 && !S.rang) return ['钟声能让沉下去的石头浮起来', '走近钟，敲响它'];
    if (P.x < 42.5) return ['声波扫过的石头，只浮起一会儿', '敲完钟就跑过去。掉下去也会从桥头再来'];
    if (!sh(1).awake) return ['回声很快就散了。钟声能把它们一起唤回来', '先让两块石头都记住光，把星光留在她身边，再去敲钟'];
    if (card && !card.taken) return ['墙角的小门开了', '钟楼北边的角落'];
    if (!sh(2).awake) return ['还有一个影子，在回头张望', '钟楼的东南角'];
    if (P.x < 78.5) return ['山脊上也有一口钟', '往东，去号角之巅'];
    if (!sh(3).awake) return ['她伸着手，在等四束光', firstUnrec() ? '让三块石头都记住光，再敲响身边的钟' : '把星光留在她身边，再敲响身边的钟'];
    return ['号角在等你', '把牌放上祭坛'];
  }

  // 机关的判定圈，给 Hug Studio 的判定页画出来
  function zones() {
    const out = [];
    echoes.forEach(e => out.push({ kind: 'orb', x: e.x, z: e.z, y: .8, r: .95, label: '回声石' }));
    shadows.forEach(s => { if (!s.awake) out.push({ kind: 'orb', x: s.x, z: s.z, y: 1, r: LIGHT_R, label: `影子 ${s.need} 束光` }); });
    bells.forEach(b => out.push({ kind: 'world', x: b.x, z: b.z, r: WAVE_R, label: '钟声', dim: true }));
    return out;
  }

  const spawn = D.spawn;
  return {
    id: 4, roman: D.roman || 'XX', name: D.name || '审判', motto: D.motto || '', mood: 2,
    spawn, menuP: spawn, menuOrb: [spawn[0] + 2, spawn[1]], menuCam: spawn,
    leash: 7.5, mirrorY: -.14, hideInReflection: L.hide, voidMat,
    palette: ['#14162a', '#22263f', '#343a58', '#4c5578', '#6b7598', '#8d98b8', '#b4bdd2', '#d8dde8', '#f2f3f7', '#2a3a4a', '#4a6070', '#7f9aa8', '#c99a52', '#f2d8a0', '#b7a6c9', '#e8c0b8'],
    tintLo: [.97, .98, 1.04], tintHi: [1.03, 1.01, .98],
    light: { sky: 0xb8c4e0, ground: 0x2a2c40, hemi: .3, moon: 0xdfe6ff, moonK: 1.2, moonDir: [-6, 6], orb: 0xffd88e, halo: 0xffc878, mote: [1, .88, .62],
      env: [0x4a5274, 0x0c0e1c, [[6, 6, -3, 0xdfe6ff, 1.6], [-4, 3, 4, 0xe8c0b8, .5], [0, 8, 0, 0xb8c4e0, 2]]] },
    endCard: { title: '号角之后', line: '第四幕　审判　完<br>她把过去的自己，都带回来了' },
    cell,
    solid(x, z) {
      const X = Math.floor(x), Z = Math.floor(z), c = cell(X, Z);
      if (c === 'G') { const G = gates[gateAt.get(X + ',' + Z)]; return !G || G.open < .85; }
      if (c === 'S') return !!shadowCell(X, Z);
      return SOLID.has(c);
    },
    hole(x, z) {
      const X = Math.floor(x), Z = Math.floor(z), c = cell(X, Z);
      if (c === '~') { const s = stones[stoneAt.get(X + ',' + Z)]; return !s || s.k < .6; }
      return c === ' ';
    },
    ground(x, z) { return !isVoid(cell(Math.floor(x), Math.floor(z))); },
    ambient(p) { return p.x > 43 && p.x < 63 ? .26 : .3; },
    onStep,
    reset, update, logic, nearest, interact, finaleStart, finale, idle,
    finaleCam: () => [altar ? (P.x + altar.x) / 2 : P.x, P.z],
    finaleOrb: () => [P.x + 1.2, P.z - 1.2],
    progress: () => echoes.map(e => e.rec ? 1 : 0).join('') + shadows.map(s => s.awake ? 1 : 0).join('') + (S.gotCard ? 1 : 0) + (P.x > 31.5 ? 1 : 0) + (P.x > 42.5 ? 1 : 0) + (P.x > 62.5 ? 1 : 0) + (P.x > 78.5 ? 1 : 0) + (S.rang ? 1 : 0),
    MW, MH, nodes: [23.5, 43, 62.5, 79],
    mapMarks: () => [...shadows.map(s => ({ x: s.hx, z: s.hz, kind: 'lamp', done: s.awake })), ...(card ? [{ x: card.x, z: card.z, kind: 'card', done: card.taken }] : []), ...(altar ? [{ x: altar.x, z: altar.z, kind: 'goal', done: S.done }] : [])],
    hud: () => ({ label: '影子', dots: shadows.map(s => s.awake), have: S.gotCard, line: S.done ? '牌已归位' : S.gotCard ? '持有　XX 审判' : '审判之牌　未寻得' }),
    zones,
    _: { L, S, echoes, bells, stones, gates, shadows, card, altar, horn, ring, wakeShadow, data: D }
  };
}
