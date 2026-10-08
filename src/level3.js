// 第三幕 · XIX 太阳 —— 黎明的云上花园。把光折射出去，光走过的路会凝成金色的桥
// 塔罗「太阳」：白墙、向日葵、白马与旗帜、孩子般的喜悦。光不再只是照亮，而是可以被「送到远方」
import * as THREE from 'three';
import * as TX from './textures.js';
import { mk } from './sprites.js';
import { LAYER_FX } from './post.js';
import { tex, ntex, toon, quadGeo, cliffMesh, instWalls, hashv, shadowAll, lightShaft, slabFloor, bevelWallGeo, billboard } from './common.js';
import { cloudSea } from './abyss.js';
import { voxelBatch, voxMat, place } from './voxel.js';
import { haloCanvas } from './sprites.js';

export const MW = 64, MH = 15;
const clamp = (v, a, b) => v < a ? a : v > b ? b : v;
const smooth = (a, b, x) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
const easeBack = t => { const c = 1.6; return 1 + (c + 1) * Math.pow(t - 1, 3) + c * Math.pow(t - 1, 2); };
const BY = 1.1;              // 光束的高度（镜心、棱镜、花盘都在这个高度）
const ORB_REACH = 6.5;       // 光点能照进透镜的距离
const QDIR = Math.PI / 4;    // 透镜射出的方向按 45° 取整：光点在透镜的哪一侧，光就往对面射
const SNAP = 1.5 * Math.PI / 180; // 只容忍浮点误差：光路必须真的对准
const STEP = Math.PI / 8;    // 镜子每次转 22.5°
const CRYST = .8;            // 光束跨过云海持续这么久，就凝成金桥
const BRIDGE_W = .56;        // 金桥的半宽
const CLOUD_Y = -1.2;

/* ---------- 地图 ----------
  空格=云海  .砂岩步道  ,晨光草甸  #白砖墙  G花园门  M可转的镜子  m固定的金镜  R向日葵（受光的花）  P棱镜
  Y向日葵（装饰）  h向日葵篱笆（光点靠近时让开）  W白马像  C太阳之牌  b吊桥  A日台 */
function buildMap() {
  const g = Array.from({ length: MH }, () => Array(MW).fill(' '));
  const set = (x, z, c) => { if (x >= 0 && z >= 0 && x < MW && z < MH) g[z][x] = c; };
  const fill = (x0, z0, x1, z1, c) => { for (let z = z0; z <= z1; z++) for (let x = x0; x <= x1; x++) set(x, z, c); };
  const pts = (list, c) => list.forEach(([x, z]) => set(x, z, c));
  // A：黎明花园。一块透镜、两面镜子，正中立着日晷挡住捷径；向日葵只朝东开
  fill(1, 2, 11, 12, ',');
  for (let x = 0; x <= 12; x++) { set(x, 1, '#'); set(x, 13, '#'); }
  for (let z = 1; z <= 13; z++) { set(0, z, '#'); set(12, z, '#'); }
  fill(12, 6, 12, 8, 'G');
  fill(1, 7, 11, 7, '.'); fill(5, 6, 7, 8, '.'); fill(2, 3, 4, 5, '.'); fill(8, 3, 10, 5, '.'); fill(8, 9, 10, 11, '.'); fill(2, 9, 4, 11, '.');
  set(3, 4, 'L'); set(9, 4, 'M'); set(9, 10, 'M'); set(3, 10, 'R'); set(6, 7, 'S');
  pts([[1, 2], [6, 2], [11, 2], [1, 12], [6, 12], [11, 12], [11, 9]], 'Y');
  // B：断岸、北岛、南岛。一道光要先往北叫醒花，再收回来往东送
  fill(13, 4, 16, 10, '.'); set(15, 7, 'L'); pts([[13, 4], [13, 10]], 'Y');
  fill(18, 2, 20, 4, ','); set(19, 3, 'R'); pts([[18, 2], [20, 2]], 'Y');
  fill(18, 10, 20, 12, ','); set(19, 11, 'M'); set(18, 12, 'Y');
  // C 西：白墙庭院，西墙只在南边留一道门（第二朵花开了才打开）
  fill(26, 10, 27, 12, '.');
  fill(29, 2, 32, 12, '.'); fill(29, 2, 30, 4, ',');
  for (let z = 1; z <= 9; z++) set(28, z, '#'); set(28, 13, '#'); fill(28, 10, 28, 12, 'g');
  for (let x = 28; x <= 33; x++) set(x, 1, '#');
  set(31, 11, 'M'); set(31, 7, 'M');
  pts([[29, 12], [32, 2], [29, 9]], 'Y');
  // C 东：棱镜、两面镜子、双生向日葵；西南角是向日葵篱笆围起的小花园
  fill(36, 1, 46, 13, '.'); fill(42, 4, 46, 6, ','); fill(36, 10, 38, 13, ','); fill(43, 12, 46, 13, ',');
  set(40, 7, 'P'); set(44, 3, 'M'); set(40, 3, 'M'); set(44, 11, 'R'); set(36, 11, 'R');
  set(45, 6, 'W');
  for (let x = 36; x <= 39; x++) set(x, 9, 'h');
  for (let z = 10; z <= 13; z++) set(39, z, 'h');
  set(37, 12, 'C');
  pts([[36, 1], [46, 1], [46, 13], [42, 13], [36, 5]], 'Y');
  // 吊桥 → D：日台
  fill(47, 7, 50, 7, 'b');
  fill(51, 2, 62, 12, ','); fill(51, 7, 58, 7, '.'); fill(54, 4, 60, 10, '.');
  pts([[51, 2], [52, 2], [51, 3], [62, 2], [62, 3], [61, 2], [51, 12], [52, 12], [51, 11], [62, 12], [61, 12], [62, 11]], ' ');
  fill(56, 6, 58, 8, 'A');
  pts([[53, 4], [53, 10], [61, 5], [61, 9], [55, 3], [59, 3], [55, 11], [59, 11]], 'Y');
  return g;
}
const SOLID = new Set(['#', 'M', 'L', 'R', 'P', 'Y', 'W', 'C', 'A', 'S']);

/* ---------- 像素画：向日葵、太阳 ---------- */
function sunflowerCanvas(N, open, seed) {
  const c = mk(N, N), g = c.getContext('2d'), r = TX.rng(seed), cx = N / 2 - .5;
  const px = (x, y, k) => { g.fillStyle = k; g.fillRect(x, y, 1, 1); };
  const R = N / 2 - .5, disc = R * .46;
  for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
    const dx = x - cx, dy = y - cx, d = Math.hypot(dx, dy), a = Math.atan2(dy, dx);
    if (open) {
      const petal = d < R * (.78 + .22 * Math.pow(Math.abs(Math.cos(a * 7)), .6)) && d > disc - .5;
      if (d < disc) { const ring = Math.sin(d * 2.2 + a * 3) > .3; px(x, y, d < disc * .45 ? '#4a2416' : ring ? '#7a3c1e' : '#5c2c1a'); if (r() < .06) px(x, y, '#b06a2a'); }
      else if (petal) { const t = (d - disc) / (R - disc); px(x, y, t < .25 ? '#d87a1e' : t < .6 ? (Math.cos(a * 7) > 0 ? '#f6b02e' : '#eea022') : '#ffd65a'); }
    } else {
      // 花苞：绿色萼片包着一点橘色
      const bud = d < R * .62 * (.85 + .15 * Math.abs(Math.cos(a * 5)));
      if (bud) px(x, y, d < R * .2 ? '#e08a2a' : Math.cos(a * 5) > .2 ? '#5a8a3a' : '#40702e');
    }
  }
  return c;
}
function stemCanvas(seed, h) {
  const W = 9, c = mk(W, h), g = c.getContext('2d'), r = TX.rng(seed);
  const cols = ['#2e5a2a', '#3e7432', '#5a9440', '#80b450'];
  let x = 4;
  for (let y = h - 1; y >= 0; y--) { g.fillStyle = cols[1 + (y % 3 === 0 ? 1 : 0)]; g.fillRect(Math.round(x), y, 1, 1); g.fillStyle = cols[0]; g.fillRect(Math.round(x) + 1, y, 1, 1); x += (r() - .5) * .3; x = clamp(x, 3, 5); }
  // 两片叶子
  [[h * .55, -1], [h * .32, 1]].forEach(([yy, s]) => { for (let i = 0; i < 4; i++) for (let j = 0; j <= Math.min(i, 3 - i) + 1; j++) { g.fillStyle = cols[j === 0 ? 3 : 2]; g.fillRect(4 + s * (i + 1), Math.round(yy) - j + (i > 1 ? 1 : 0), 1, 1); } });
  return c;
}
function sunFaceCanvas() {
  const N = 64, c = mk(N, N), g = c.getContext('2d'), cx = N / 2 - .5;
  const px = (x, y, k) => { g.fillStyle = k; g.fillRect(x, y, 1, 1); };
  for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
    const d = Math.hypot(x - cx, y - cx); if (d > 31) continue;
    const ring = Math.abs(d - 27) < 1.2, ring2 = Math.abs(d - 22) < .6;
    px(x, y, ring ? '#ffe9a8' : ring2 ? '#ffd270' : d < 18 ? '#ffc84a' : '#f6a832');
  }
  // 安详闭着的眼睛与微笑：几何化的「太阳的脸」
  for (let i = -5; i <= 5; i++) { const y = Math.round(28 - Math.sqrt(30 - i * i * .9) * .5 + 2); px(22 + i, y, '#a8501e'); px(41 + i, y, '#a8501e'); }
  for (let i = -8; i <= 8; i++) px(31 + i, Math.round(40 + Math.sqrt(Math.max(0, 70 - i * i)) * .45), '#a8501e');
  [[18, 36], [19, 36], [44, 36], [45, 36]].forEach(([x, y]) => px(x, y, '#ff9a6a'));
  return c;
}
function sunCardCanvas() {
  const W = 24, H = 40, c = mk(W, H), g = c.getContext('2d');
  const px = (x, y, k) => { g.fillStyle = k; g.fillRect(x, y, 1, 1); };
  g.fillStyle = '#efe6d2'; g.fillRect(0, 0, W, H); g.fillStyle = '#d6b88a'; g.fillRect(1, 1, W - 2, H - 2);
  for (let y = 2; y < 30; y++) { g.fillStyle = y < 10 ? '#7fb0e0' : y < 18 ? '#9cc4e8' : '#bcd8ee'; g.fillRect(2, y, W - 4, 1); }
  for (let y = 2; y < 18; y++) for (let x = 2; x < W - 2; x++) { const d = Math.hypot(x - 11.5, y - 9); const a = Math.atan2(y - 9, x - 11.5); if (d < 4.5) px(x, y, d < 3 ? '#ffd65a' : '#f6b02e'); else if (d < 8 && Math.abs(Math.sin(a * 6)) > .9) px(x, y, '#ffe08a'); }
  g.fillStyle = '#f4ead8'; g.fillRect(2, 22, W - 4, 4); g.fillStyle = '#d8c8b0'; for (let x = 2; x < W - 2; x += 3) g.fillRect(x, 22, 1, 4);
  [[4, 21], [8, 20], [16, 21], [19, 20]].forEach(([x, y]) => { px(x, y, '#f6b02e'); px(x, y - 1, '#ffd65a'); px(x, y + 1, '#3e7432'); });
  g.fillStyle = '#fbf6ee'; g.fillRect(7, 27, 10, 3); g.fillRect(15, 25, 3, 3); px(8, 30, '#fbf6ee'); px(15, 30, '#fbf6ee');
  px(11, 24, '#ffd0a0'); px(11, 25, '#ffd0a0'); px(12, 25, '#e86a4a'); px(13, 23, '#e86a4a'); px(14, 22, '#e86a4a');
  g.fillStyle = '#d6b88a'; g.fillRect(2, 33, W - 4, 2);
  [[9, 36], [10, 36], [11, 36], [13, 36], [14, 36]].forEach(([x, y]) => px(x, y, '#6a3a22'));
  return c;
}

export function buildSun(ctx) {
  const { group: root, camQuat, fx, AU, toast, cine, shake, flash, P, orb } = ctx;
  const grid = buildMap();
  const cell = (x, z) => (x < 0 || z < 0 || x >= MW || z >= MH) ? ' ' : grid[z][x];
  const isVoid = c => c === ' ' || c === 'b';
  const L = { mirrors: [], recv: [], deco: [], hedge: [], hide: [] };

  /* ================= 材质 ================= */
  const cStone = TX.sunStoneTexHD(), cMead = TX.meadowTex(), cBrick = TX.brickWallTex(), cBrickT = TX.brickTopTex();
  const matStone = toon({ map: tex(cStone), normalMap: ntex(cStone, 4), normalScale: new THREE.Vector2(.8, .8), roughness: .55 });
  const matMead = toon({ map: tex(cMead), normalMap: ntex(cMead, 3.5), roughness: .9 });
  const brickS = toon({ map: tex(cBrick), normalMap: ntex(cBrick, 5), normalScale: new THREE.Vector2(1.3, 1.3), roughness: .7 });
  const brickT = toon({ map: tex(cBrickT), normalMap: ntex(cBrickT, 3), roughness: .65 });
  const brassM = toon({ color: 0xe0a850, roughness: .25, metalness: .85, emissive: 0x3a1a08, emissiveIntensity: .3 });
  const creamM = toon({ color: 0xf2e2c8, roughness: .45 });
  const darkM = toon({ color: 0x5a3040, roughness: .5, metalness: .3 });
  const vm = voxMat();

  /* ================= 地面 ================= */
  const fl = { '.': [], ',': [] }, cliffs = [];
  for (let z = 0; z < MH; z++) for (let x = 0; x < MW; x++) {
    const c = grid[z][x]; if (isVoid(c)) continue;
    fl[c === ',' || c === 'Y' || c === 'h' || c === 'R' ? ',' : '.'].push([x, z]);
    [[0, 1], [0, -1], [1, 0], [-1, 0]].forEach(([dx, dz]) => { if (isVoid(cell(x + dx, z + dz))) cliffs.push([x, z, dx, dz]); });
  }
  root.add(slabFloor(fl['.'], matStone, { seed: 5, jitter: 1.2, tile: 4 }));
  { const m = new THREE.Mesh(quadGeo(fl[','], 0), matMead); m.receiveShadow = true; root.add(m); }
  const cliffC = TX.cliffTex();
  root.add(cliffMesh(cliffs, toon({ map: tex(cliffC), normalMap: ntex(cliffC, 4), color: 0xe8b090, emissive: 0x6a3a34, emissiveIntensity: .7, side: THREE.DoubleSide }), 2.2));

  /* ================= 云海 ================= */
  const sea = cloudSea();
  const seaMesh = new THREE.Mesh(new THREE.PlaneGeometry(400, 400), sea);
  seaMesh.rotation.x = -Math.PI / 2; seaMesh.position.set(32, CLOUD_Y, 7); root.add(seaMesh);
  sea.uniforms.sun.value.set(57.5, -2, 2);

  /* ================= 白砖墙 ================= */
  const walls = [];
  for (let z = 0; z < MH; z++) for (let x = 0; x < MW; x++) if (grid[z][x] === '#') walls.push([x, z, (x === 0 || z === 1) ? 1 : .62 + hashv(x, z) * .1]);
  instWalls(root, walls, bevelWallGeo(1.6, 1, .05), [brickS, brickT]);
  // 墙头一排小小的金色日轮
  walls.forEach(([x, z, s], i) => { if (i % 3) return; const d = new THREE.Mesh(new THREE.CylinderGeometry(.12, .12, .04, 10), brassM); d.position.set(x + .5, 1.6 * s + .04, z + .5); root.add(d); });

  /* ================= 花园门 ================= */
  const makeGate = (x, zc) => {
    const gt = { x, zc, open: 0, opening: false, leaves: [] };
    [zc - 2, zc + 2].forEach(z => { const p = new THREE.Mesh(new THREE.BoxGeometry(1, 2.6, 1), brickS); p.position.set(x + .5, 1.3, z + .5); shadowAll(p); root.add(p); });
    const arch = new THREE.Mesh(new THREE.TorusGeometry(1.5, .1, 6, 32, Math.PI), brassM); arch.rotation.y = Math.PI / 2; arch.position.set(x + .5, 2.4, zc + .5); root.add(arch);
    const sun = new THREE.Mesh(new THREE.CircleGeometry(.36, 16), gateSunM);
    sun.rotation.y = -Math.PI / 2; sun.position.set(x - .1, 3.2, zc + .5); root.add(sun);
    // 两扇金色格栅门，向两侧转开
    [-1, 1].forEach(s => {
      const pivot = new THREE.Group(); pivot.position.set(x + .5, 0, zc + .5 + s * 1.5); root.add(pivot);
      for (let i = 0; i < 4; i++) { const bar = new THREE.Mesh(new THREE.BoxGeometry(.08, 2.2, .08), brassM); bar.position.set(0, 1.1, -s * (.2 + i * .38)); pivot.add(bar); }
      const rail = new THREE.Mesh(new THREE.BoxGeometry(.1, .08, 1.5), brassM); rail.position.set(0, 1.9, -s * .75); pivot.add(rail);
      const rail2 = rail.clone(); rail2.position.y = .4; pivot.add(rail2);
      shadowAll(pivot); gt.leaves.push({ pivot, s });
    });
    return gt;
  };
  const gateSunM = new THREE.MeshStandardMaterial({ color: 0xffd270, emissive: 0xffa040, emissiveIntensity: .4, metalness: .6, roughness: .3 });
  const gate = makeGate(12, 7), gate2 = makeGate(28, 11);
  const gateAt = x => x < 20 ? gate : gate2;

  /* ================= 日晷（花园正中，挡住斜着的捷径） ================= */
  {
    const g0 = new THREE.Group(); g0.position.set(6.5, 0, 7.5); root.add(g0);
    const base = new THREE.Mesh(new THREE.CylinderGeometry(.46, .52, .7, 12), creamM); base.position.y = .35; g0.add(base);
    const face = new THREE.Mesh(new THREE.CylinderGeometry(.5, .5, .06, 24), brassM); face.position.y = .73; g0.add(face);
    const gn = new THREE.Mesh(new THREE.ConeGeometry(.08, .9, 4), brassM); gn.position.set(0, 1.1, 0); gn.rotation.x = .5; g0.add(gn);
    shadowAll(g0);
  }

  /* ================= 向日葵 ================= */
  const stemCs = [1, 2, 3].map(s => stemCanvas(s * 11, 30));
  const stemP = [[], [], []];
  const headOpen = [sunflowerCanvas(14, true, 3), sunflowerCanvas(13, true, 7)];
  // 花盘朝向：偏向目标，但始终带着朝镜头的仰角，俯视时看得到整张花脸
  const _hp = new THREE.Vector3();
  const faceToward = (head, tx, tz, k = .9) => {
    head.getWorldPosition(_hp); const dx = tx - _hp.x, dz = tz - _hp.z, l = Math.hypot(dx, dz) || 1;
    head.lookAt(_hp.x + dx / l * k, _hp.y + .7, _hp.z + 1.3 + dz / l * k);
  };
  const bushGeo = new THREE.DodecahedronGeometry(.48, 0), bushM = toon({ color: 0x6a8a3a, roughness: .8, emissive: 0x1a2a08, emissiveIntensity: .4, flatShading: true });
  const addDeco = (x, z, hedge) => {
    const h = 1.5 + hashv(x, z) * .5, k = (x * 7 + z) % 3;
    stemP[k].push(place(x + .5, 0, z + .5 + .05, hashv(z, x) * .6 - .3, .15, h / (30 / 16)));
    const head = new THREE.Group(); head.position.set(x + .5, h - .05, z + .5); root.add(head);
    const inner = new THREE.Group(); head.add(inner);
    const c = headOpen[(x + z) % 2]; const vb = voxelBatch(c, [place(0, -c.height / 32, 0, 0, 0)], vm, { maxT: .1, minT: .05, slope: .02 });
    inner.add(vb);
    let bush = null;
    if (hedge) { bush = new THREE.Mesh(bushGeo, bushM); bush.position.set(x + .5, .32, z + .5); bush.rotation.y = hashv(x, z) * .5; bush.castShadow = bush.receiveShadow = true; root.add(bush); }
    const f = { x: x + .5, z: z + .5, head, inner, hedge, bush, q: new THREE.Quaternion(), open: 1, ph: hashv(x, z) * 6 };
    L.deco.push(f); if (hedge) L.hedge.push(f);
    return f;
  };
  // 受光的大向日葵：花苞 → 盛开
  const recvLights = [];
  const faceMarkM = new THREE.MeshBasicMaterial({ color: 0xffd890, transparent: true, opacity: .55, depthWrite: false, side: THREE.DoubleSide });
  const addRecv = (x, z, id, face) => {
    const g0 = new THREE.Group(); g0.position.set(x + .5, 0, z + .5); root.add(g0);
    const stem = voxelBatch(stemCanvas(40 + id, 22), [place(0, 0, .05, 0, .1, .9)], vm, { maxT: .1, minT: .06, slope: .02 }); g0.add(stem);
    const head = new THREE.Group(); head.position.y = BY; g0.add(head);
    const mat = voxMat({ emissive: 0xffa040, emissiveIntensity: 0 });
    const bud = voxelBatch(sunflowerCanvas(12, false, id), [place(0, -12 / 32, 0, 0, 0)], mat, { maxT: .14, minT: .06, slope: .03 });
    const openC = sunflowerCanvas(24, true, id + 9);
    const bloom = voxelBatch(openC, [place(0, -24 / 32, 0, 0, 0)], mat, { maxT: .14, minT: .06, slope: .025 });
    bloom.scale.setScalar(.01); head.add(bud, bloom);
    const light = new THREE.PointLight(0xffb060, 0, 5, 1.6); light.position.y = BY + .3; g0.add(light); recvLights.push(light);
    // 地上一道金色的弧：花只收从这一侧照来的光
    const fl = Math.hypot(face[0], face[1]); face = [face[0] / fl, face[1] / fl];
    const mark = new THREE.Mesh(new THREE.RingGeometry(.5, .66, 16, 1, -Math.PI / 2, Math.PI), faceMarkM); mark.rotation.set(-Math.PI / 2, 0, Math.atan2(-face[1], face[0])); mark.position.y = .03; g0.add(mark);
    const r = { id, x, z, cx: x + .5, cz: z + .5, g: g0, head, bud, bloom, mat, light, on: false, k: 0, hitT: 0, lit: false, wrong: 0, q: new THREE.Quaternion(), face };
    L.recv.push(r); return r;
  };

  /* ================= 镜子 ================= */
  const discM = () => new THREE.MeshStandardMaterial({ color: 0xfff4e0, roughness: .08, metalness: 1, emissive: 0xffc070, emissiveIntensity: .12 });
  const dialPlateM = toon({ color: 0xd8a868, roughness: .3, metalness: .7, emissive: 0x4a2010, emissiveIntensity: .3 });
  const dialArrowM = new THREE.MeshBasicMaterial({ color: 0xffe2a0, side: THREE.DoubleSide }), dialFixedM = new THREE.MeshBasicMaterial({ color: 0xffb070, side: THREE.DoubleSide });
  const arrowGeo = (() => { const sh = new THREE.Shape(); sh.moveTo(.4, -.13); sh.lineTo(.74, 0); sh.lineTo(.4, .13); sh.lineTo(.46, 0); sh.closePath(); return new THREE.ShapeGeometry(sh); })();
  const lensM = () => new THREE.MeshStandardMaterial({ color: 0xfff6e0, roughness: .05, metalness: .1, emissive: 0xffd080, emissiveIntensity: .3, transparent: true, opacity: .78 });
  const addMirror = (x, z, a0, turn, id, lens = false) => {
    const g0 = new THREE.Group(); g0.position.set(x + .5, 0, z + .5); root.add(g0);
    const ped = new THREE.Mesh(new THREE.CylinderGeometry(.24, .34, .5, 10), creamM); ped.position.y = .25; g0.add(ped);
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(.05, .05, BY - .5, 6), brassM); pole.position.y = .5 + (BY - .5) / 2; g0.add(pole);
    const yaw = new THREE.Group(); yaw.position.y = BY; g0.add(yaw);
    const fork = new THREE.Mesh(new THREE.TorusGeometry(.5, .04, 5, 20, Math.PI), brassM); fork.rotation.set(0, Math.PI / 2, Math.PI); fork.position.y = 0; yaw.add(fork);
    const dm = lens ? lensM() : discM();
    const disc = new THREE.Mesh(new THREE.CylinderGeometry(.5, .5, .05, 22), [brassM, dm, dm]); disc.rotation.z = Math.PI / 2; yaw.add(disc);
    const rim = new THREE.Mesh(new THREE.TorusGeometry(.51, lens ? .08 : .04, 5, 24), brassM); rim.rotation.y = Math.PI / 2; yaw.add(rim);
    if (lens) { for (let i = 0; i < 8; i++) { const a = i / 8 * Math.PI * 2; const t = new THREE.Mesh(new THREE.ConeGeometry(.05, .18, 4), brassM); t.position.set(0, Math.sin(a) * .66, Math.cos(a) * .66); t.rotation.x = -a; yaw.add(t); } fork.visible = false; }
    // 指向箭头：告诉玩家镜面朝哪
    const tick = new THREE.Mesh(new THREE.ConeGeometry(.06, .16, 4), brassM); tick.rotation.z = -Math.PI / 2; tick.position.set(.12, .52, 0); yaw.add(tick);
    // 地上的转盘：发光的箭头指着镜面朝向，俯视时一眼看得出镜子朝哪
    const dial = new THREE.Group(); dial.position.y = .03; g0.add(dial);
    const plate = new THREE.Mesh(new THREE.RingGeometry(.4, .66, 24), dialPlateM); plate.rotation.x = -Math.PI / 2; dial.add(plate);
    const arrow = new THREE.Mesh(arrowGeo, turn ? dialArrowM : dialFixedM); arrow.rotation.x = -Math.PI / 2; arrow.position.y = .005; dial.add(arrow);
    if (!turn) { const base = new THREE.Mesh(new THREE.CylinderGeometry(.7, .9, .3, 12), darkM); base.position.y = -.05; g0.add(base); }
    shadowAll(g0); disc.castShadow = true;
    const m = { id, x, z, cx: x + .5, cz: z + .5, a: a0, a0, shown: a0, turn, lens, locked: null, g: g0, yaw, dial, arrow, dm, lit: 0, spin: 0 };
    L.mirrors.push(m); return m;
  };

  /* ================= 棱镜 ================= */
  const prism = { id: 'P', cx: 40.5, cz: 7.5, lit: 0 };
  {
    const g0 = new THREE.Group(); g0.position.set(prism.cx, 0, prism.cz); root.add(g0);
    const ped = new THREE.Mesh(new THREE.CylinderGeometry(.34, .5, .6, 6), creamM); ped.position.y = .3; g0.add(ped);
    const ring = new THREE.Mesh(new THREE.TorusGeometry(.5, .04, 5, 24), brassM); ring.rotation.x = Math.PI / 2; ring.position.y = .62; g0.add(ring);
    const pm = new THREE.MeshStandardMaterial({ color: 0xfff0d8, roughness: .05, metalness: .1, emissive: 0xffb070, emissiveIntensity: .2, transparent: true, opacity: .88, flatShading: true });
    const cry = new THREE.Mesh(new THREE.OctahedronGeometry(.36, 0), pm); cry.scale.set(1, 1.5, 1); cry.position.y = BY; g0.add(cry);
    shadowAll(g0); cry.castShadow = false;
    Object.assign(prism, { g: g0, cry, pm });
  }

  /* ================= 白马像（塔罗里孩子骑着的白马）+ 旗帜 ================= */
  const horse = {};
  {
    const g0 = new THREE.Group(); g0.position.set(45.5, 0, 6.5); root.add(g0);
    const wM = toon({ color: 0xfaf2e6, roughness: .4 });
    const ped = new THREE.Mesh(new THREE.BoxGeometry(1, .4, 1), creamM); ped.position.y = .2; g0.add(ped);
    const body = new THREE.Mesh(new THREE.BoxGeometry(.36, .36, .8), wM); body.position.y = .95; g0.add(body);
    const neck = new THREE.Mesh(new THREE.BoxGeometry(.22, .5, .24), wM); neck.position.set(0, 1.28, .34); neck.rotation.x = .45; g0.add(neck);
    const head = new THREE.Mesh(new THREE.BoxGeometry(.2, .2, .38), wM); head.position.set(0, 1.5, .55); head.rotation.x = .3; g0.add(head);
    [[-.12, .3], [.12, .3], [-.12, -.3], [.12, -.3]].forEach(([x, z]) => { const l = new THREE.Mesh(new THREE.BoxGeometry(.09, .55, .09), wM); l.position.set(x, .55, z); g0.add(l); });
    const mane = new THREE.Mesh(new THREE.BoxGeometry(.06, .4, .2), toon({ color: 0xf6b02e })); mane.position.set(0, 1.38, .26); mane.rotation.x = .45; g0.add(mane);
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(.025, .025, 2, 5), brassM); pole.position.set(.32, 1.6, -.1); g0.add(pole);
    const flagG = new THREE.Group(); flagG.position.set(.32, 2.4, -.1); g0.add(flagG);
    const flag = new THREE.Mesh(new THREE.PlaneGeometry(.8, .5, 6, 1), toon({ color: 0xe86a4a, side: THREE.DoubleSide, emissive: 0x401008, emissiveIntensity: .3 })); flag.position.x = .4; flagG.add(flag);
    g0.rotation.y = -.5; shadowAll(g0);
    Object.assign(horse, { g: g0, flag, base: flag.geometry.attributes.position.array.slice() });
  }

  /* ================= 太阳之牌（藏在篱笆后） ================= */
  const haloT = tex(haloCanvas(64)); haloT.wrapS = haloT.wrapT = THREE.ClampToEdgeWrapping;
  const card = { x: 37.5, z: 12.5, taken: false };
  {
    const g0 = new THREE.Group(); g0.position.set(card.x, 0, card.z); root.add(g0);
    const ped = new THREE.Mesh(new THREE.CylinderGeometry(.2, .3, .7, 8), creamM); ped.position.y = .35; g0.add(ped);
    const front = tex(sunCardCanvas()); front.wrapS = front.wrapT = THREE.ClampToEdgeWrapping;
    const fm = toon({ map: front, emissive: 0xffffff, emissiveMap: front, emissiveIntensity: .55, side: THREE.DoubleSide });
    const holder = new THREE.Group(); holder.position.y = 1.15; g0.add(holder);
    holder.add(new THREE.Mesh(new THREE.PlaneGeometry(.6, 1.0), fm));
    const halo = billboard(haloT, 2.2, 2.2, true, camQuat); halo.material.color.set(0xffd08a); halo.material.opacity = .4; halo.position.y = 1.15; g0.add(halo);
    shadowAll(ped);
    Object.assign(card, { g: g0, holder, halo });
  }

  /* ================= 日轮机关 + 吊桥 ================= */
  const machine = {};
  {
    // 一只立在庭院东北角的巨大黄铜日轮，用链条吊着吊桥
    const MX = 48.8, MZ = 3.6;
    const g0 = new THREE.Group(); g0.position.set(MX, 0, MZ); root.add(g0);
    const legs = [-1, 1].map(s => { const l = new THREE.Mesh(new THREE.BoxGeometry(.3, 6.6, .3), creamM); l.position.set(s * 1.4, .3, 0); g0.add(l); return l; });
    const wheel = new THREE.Group(); wheel.position.y = 3.2; g0.add(wheel);
    const rim = new THREE.Mesh(new THREE.TorusGeometry(1.6, .12, 6, 40), brassM); wheel.add(rim);
    const rim2 = new THREE.Mesh(new THREE.TorusGeometry(1.05, .06, 5, 32), brassM); wheel.add(rim2);
    for (let i = 0; i < 12; i++) { const a = i / 12 * Math.PI * 2; const sp = new THREE.Mesh(new THREE.BoxGeometry(.06, 1.6, .06), brassM); sp.position.set(Math.cos(a) * .8, Math.sin(a) * .8, 0); sp.rotation.z = a + Math.PI / 2; wheel.add(sp);
      const ray = new THREE.Mesh(new THREE.ConeGeometry(.12, .5, 4), brassM); ray.position.set(Math.cos(a) * 1.95, Math.sin(a) * 1.95, 0); ray.rotation.z = a - Math.PI / 2; wheel.add(ray); }
    const coreM = new THREE.MeshStandardMaterial({ color: 0xffd270, emissive: 0xffa040, emissiveIntensity: .15, metalness: .6, roughness: .3 });
    const core = new THREE.Mesh(new THREE.SphereGeometry(.42, 14, 10), coreM); wheel.add(core);
    shadowAll(g0);
    // 吊桥：铰在东岸，竖着收起，放下时横跨云海
    const hinge = new THREE.Group(); hinge.position.set(47, 0, 7.5); root.add(hinge);
    const deck = new THREE.Mesh(new THREE.BoxGeometry(4, .16, 1.3), toon({ map: tex(TX.bridgeTex()), color: 0xf0c8a0, roughness: .6 })); deck.position.set(2, -.08, 0); hinge.add(deck);
    [-1, 1].forEach(s => { const r = new THREE.Mesh(new THREE.BoxGeometry(4, .06, .06), brassM); r.position.set(2, .45, s * .62); hinge.add(r); for (let i = 0; i <= 4; i++) { const p = new THREE.Mesh(new THREE.BoxGeometry(.06, .5, .06), brassM); p.position.set(i, .2, s * .62); hinge.add(p); } });
    shadowAll(hinge); hinge.rotation.z = Math.PI / 2 * .96;
    const chainM = new THREE.MeshStandardMaterial({ color: 0x8a6a4a, metalness: .8, roughness: .4 });
    const chain = new THREE.Mesh(new THREE.CylinderGeometry(.03, .03, 1, 4), chainM); root.add(chain);
    Object.assign(machine, { g: g0, wheel, coreM, hinge, chain, k: 0 });
  }

  /* ================= 日台 + 从云海里升起的太阳 ================= */
  const altar = {};
  {
    const cx = 57.5, cz = 7.5;
    const g0 = new THREE.Group(); g0.position.set(cx, 0, cz); root.add(g0);
    const base = new THREE.Mesh(new THREE.CylinderGeometry(1.5, 1.65, .3, 24), creamM); base.position.y = .15; g0.add(base);
    const ring = new THREE.Mesh(new THREE.TorusGeometry(1.5, .07, 5, 32), brassM); ring.rotation.x = Math.PI / 2; ring.position.y = .3; g0.add(ring);
    const dialM = new THREE.MeshStandardMaterial({ map: (() => { const t = tex(sunFaceCanvas()); t.wrapS = t.wrapT = THREE.ClampToEdgeWrapping; return t; })(), color: 0xc8a070, roughness: .4, metalness: .5, emissive: 0xffa040, emissiveIntensity: 0 });
    const dial = new THREE.Mesh(new THREE.CircleGeometry(1.35, 32), dialM); dial.rotation.x = -Math.PI / 2; dial.position.y = .31; g0.add(dial);
    const marks = [0, 1, 2].map(i => { const a = -Math.PI / 2 + (i - 1) * .9; const m = new THREE.Mesh(new THREE.SphereGeometry(.11, 8, 6), new THREE.MeshStandardMaterial({ color: 0xc8a070, emissive: 0xffc060, emissiveIntensity: 0 })); m.position.set(Math.cos(a) * 1.5, .45, Math.sin(a) * 1.5); g0.add(m); return m; });
    const slotM = toon({ transparent: true, opacity: 0, emissive: 0xffc080, emissiveIntensity: .6 });
    const slot = new THREE.Mesh(new THREE.PlaneGeometry(.45, .75), slotM); slot.position.y = 1.1; slot.quaternion.copy(camQuat); g0.add(slot);
    shadowAll(g0); dial.castShadow = false;
    const halo = billboard(haloT, 3.6, 3.6, true, camQuat); halo.material.color.set(0xffd08a); halo.material.opacity = 0; halo.position.y = 1.2; g0.add(halo);
    const light = new THREE.PointLight(0xffd0a0, 0, 14, 1.2); light.position.y = 2; g0.add(light);
    // 巨大的机械太阳：藏在云海下，通关时被两根巨臂托起来
    const big = new THREE.Group(); big.position.set(cx, -8, .6); root.add(big);
    const faceT = tex(sunFaceCanvas()); faceT.wrapS = faceT.wrapT = THREE.ClampToEdgeWrapping;
    const faceM = new THREE.MeshStandardMaterial({ map: faceT, emissive: 0xffb050, emissiveMap: faceT, emissiveIntensity: .2, roughness: .5 });
    const face = new THREE.Mesh(new THREE.CircleGeometry(2.5, 40), faceM); face.quaternion.copy(camQuat); big.add(face);
    const rays = new THREE.Group(); rays.quaternion.copy(camQuat); big.add(rays);
    const rayM = new THREE.MeshStandardMaterial({ color: 0xffd270, emissive: 0xffa040, emissiveIntensity: .3, metalness: .7, roughness: .3 });
    for (let i = 0; i < 16; i++) { const a = i / 16 * Math.PI * 2, len = i % 2 ? 1 : 1.6; const r = new THREE.Mesh(new THREE.ConeGeometry(.28, len, 4), rayM); r.position.set(Math.cos(a) * (2.75 + len / 2), Math.sin(a) * (2.75 + len / 2), -.05); r.rotation.z = a - Math.PI / 2; rays.add(r); }
    const frame = new THREE.Mesh(new THREE.TorusGeometry(2.62, .12, 6, 48), brassM); frame.quaternion.copy(camQuat); big.add(frame);
    [-1, 1].forEach(s => { const arm = new THREE.Mesh(new THREE.BoxGeometry(.32, 9, .32), darkM); arm.position.set(s * 2.9, -4.5, -.3); arm.rotation.z = s * .12; big.add(arm); });
    const bigHalo = billboard(haloT, 11, 11, true, camQuat); bigHalo.material.color.set(0xffc070); bigHalo.material.opacity = 0; big.add(bigHalo);
    rays.scale.setScalar(.2);
    Object.assign(altar, { x: cx, z: cz, g: g0, dialM, marks, slotM, slot, halo, light, big, faceM, rays, rayM, bigHalo });
    L.hide.push(halo, bigHalo);
  }

  /* ================= 光束、金桥、光斑（预先建好，运行中只改位置，避免临时编译） ================= */
  const beamGeo = new THREE.BoxGeometry(1, 1, 1);
  const beams = Array.from({ length: 28 }, () => {
    const core = new THREE.Mesh(beamGeo, new THREE.MeshBasicMaterial({ color: 0xfff0c0, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));
    const glow = new THREE.Mesh(beamGeo, new THREE.MeshBasicMaterial({ color: 0xff9a40, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));
    [core, glow].forEach(m => { m.layers.set(LAYER_FX); m.visible = false; root.add(m); });
    return { core, glow };
  });
  const bridgeM = new THREE.MeshStandardMaterial({ color: 0xffd890, emissive: 0xffa040, emissiveIntensity: .45, roughness: .15, metalness: .4, transparent: true, opacity: .9 });
  const bridgeEdge = new THREE.MeshBasicMaterial({ color: 0xffe0a0, transparent: true, opacity: .5, depthWrite: false, blending: THREE.AdditiveBlending });
  const bridges = Array.from({ length: 8 }, () => {
    const g0 = new THREE.Group(); g0.visible = false; root.add(g0);
    const slab = new THREE.Mesh(new THREE.BoxGeometry(1, .1, BRIDGE_W * 2 - .1), bridgeM); slab.position.y = -.05; slab.receiveShadow = true; g0.add(slab);
    [-1, 1].forEach(s => { const e = new THREE.Mesh(new THREE.BoxGeometry(1, .03, .04), bridgeEdge); e.position.set(0, .01, s * (BRIDGE_W - .05)); e.layers.set(LAYER_FX); g0.add(e); });
    return { g: g0, slab, used: false, seg: null, k: 0 };
  });
  const spots = Array.from({ length: 4 }, () => { const l = new THREE.PointLight(0xffc070, 0, 3.2, 1.6); root.add(l); return l; });

  /* ================= 光柱：黎明的光从云缝里落下 ================= */
  const shafts = [[6.5, 7.5, 1.4], [19.5, 3.5, 1.2], [30.5, 5, 1.6], [56.5, 6.5, 1.6]].map(([x, z, r]) => lightShaft(root, x, z, { color: 0xffc890, r, I: 6, k: .35, lean: [-.35, -.3], hide: L.hide }));

  /* ================= 遍历摆放 ================= */
  for (let z = 0; z < MH; z++) for (let x = 0; x < MW; x++) {
    const c = grid[z][x];
    if (c === 'Y') addDeco(x, z, false);
    else if (c === 'h') addDeco(x, z, true);
  }
  stemCs.forEach((c, i) => root.add(voxelBatch(c, stemP[i], vm, { maxT: .07, minT: .05, slope: .01 })));
  const D = Math.SQRT1_2;
  const LA = addMirror(3, 4, 0, true, 'LA', true), MA1 = addMirror(9, 4, 0, true, 'MA1'), MA2 = addMirror(9, 10, STEP * 12, true, 'MA2');
  const LB = addMirror(15, 7, 0, true, 'LB', true), MB1 = addMirror(19, 11, 0, true, 'MB1');
  const MC1 = addMirror(31, 11, STEP * 13, true, 'MC1'), MC2 = addMirror(31, 7, STEP * 5, true, 'MC2');
  const MD = addMirror(44, 3, STEP * 4, true, 'MD'), ME = addMirror(40, 3, STEP * 6, true, 'ME');
  const R1 = addRecv(3, 10, 1, [1, 0]), R2 = addRecv(19, 3, 2, [0, 1]), R3a = addRecv(44, 11, 3, [-D, -D]), R3b = addRecv(36, 11, 4, [D, -D]);
  const mirrorAt = (x, z) => L.mirrors.find(m => m.x === x && m.z === z);

  /* ================= 引导微光 ================= */
  const GOLDc = [1, .82, .45], CREAM = [1, .95, .8], CORALc = [1, .55, .45];
  const B = {
    LA: fx.beacon(LA.cx, BY + .7, LA.cz, 0xffe0a0, 1), LB: fx.beacon(LB.cx, BY + .7, LB.cz, 0xffe0a0, 1),
    R1: fx.beacon(R1.cx, BY, R1.cz, 0xffa040, 1.2), R2: fx.beacon(R2.cx, BY, R2.cz, 0xffa040, 1.2), R3a: fx.beacon(R3a.cx, BY, R3a.cz, 0xffa040, 1.2), R3b: fx.beacon(R3b.cx, BY, R3b.cz, 0xffa040, 1.2),
    prism: fx.beacon(prism.cx, BY, prism.cz, 0xffe0a0, 1.1), card: fx.beacon(card.x, 1.15, card.z, 0xffd08a, 1), altar: fx.beacon(altar.x, 1.0, altar.z, 0xffd08a, 1.6)
  };

  /* ================= 状态 ================= */
  const S = { rays: 0, gotCard: false, done: false, hints: {}, day: 0, dayT: 0, twinHold: 0, twins: false, bridgeDown: false, crys: {}, bridgeList: [], trail: 0, sunUp: false };

  /* ================= 光路追踪 ================= */
  const hedgeShut = (x, z) => { const f = L.hedge.find(f => f.x === x + .5 && f.z === z + .5); return !f || f.open < .5; };
  const solidCell = (x, z) => { const c = cell(x, z); return c === '#' || c === 'W' || (c === 'G' || c === 'g') && gateAt(x).open < .9 || c === 'S' || c === 'A' || c === 'Y' || c === 'C' || c === 'h' && hedgeShut(x, z); };
  function clearLine(ax, az, bx, bz, skip) {
    const d = Math.hypot(bx - ax, bz - az), n = Math.ceil(d / .1);
    for (let i = 1; i < n; i++) { const t = i / n, x = ax + (bx - ax) * t, z = az + (bz - az) * t; const cx = Math.floor(x), cz = Math.floor(z); if (skip && skip(cx, cz)) continue; if (solidCell(cx, cz)) return false; }
    return true;
  }
  const targets = () => [...L.mirrors, prism, ...L.recv];
  const dist2 = (o, x, z) => Math.hypot(o.cx - x, o.cz - z);
  function snapDir(ox, oz, dx, dz, from) {
    let best = null, bd = SNAP, a0 = Math.atan2(dz, dx);
    for (const t of targets()) {
      if (t === from) continue;
      const vx = t.cx - ox, vz = t.cz - oz, L2 = Math.hypot(vx, vz); if (L2 < .6 || L2 > 18) continue;
      let da = Math.abs(Math.atan2(vz, vx) - a0); if (da > Math.PI) da = Math.PI * 2 - da;
      if (da < bd && clearLine(ox, oz, t.cx, t.cz, (x, z) => (x === Math.floor(t.cx) && z === Math.floor(t.cz)))) { bd = da; best = [vx / L2, vz / L2]; }
    }
    return best || [dx, dz];
  }
  let segs = [], hitR = new Set(), wrongR = new Set(), prismHit = false;
  function trace(ox, oz, dx, dz, from, depth, kind) {
    if (depth > 8 || segs.length >= beams.length) return;
    [dx, dz] = snapDir(ox, oz, dx, dz, from);
    let x = ox, z = oz, hit = null;
    for (let t = .2; t < 18; t += .05) {
      x = ox + dx * t; z = oz + dz * t;
      const cx = Math.floor(x), cz = Math.floor(z);
      for (const m of L.mirrors) if (m !== from && dist2(m, x, z) < .3) { hit = m; break; }
      if (!hit && from !== prism && dist2(prism, x, z) < .32) hit = prism;
      if (!hit) for (const r of L.recv) if (dist2(r, x, z) < .42) { hit = r; break; }
      if (hit) { x = hit.cx; z = hit.cz; break; }
      if (solidCell(cx, cz)) break;
    }
    const seg = { ax: ox, az: oz, bx: x, bz: z, from, to: hit, kind };
    segs.push(seg);
    if (!hit) return;
    if (L.mirrors.includes(hit)) {
      hit.lit = 1;
      if (hit.locked || hit.lens) return; // 凝金的镜子自己就是光源；透镜只接光点
      const n = [Math.cos(hit.a), Math.sin(hit.a)], d = dx * n[0] + dz * n[1];
      trace(hit.cx, hit.cz, dx - 2 * d * n[0], dz - 2 * d * n[1], hit, depth + 1, 'beam');
    } else if (hit === prism) {
      prismHit = true;
      const a = Math.atan2(dz, dx);
      [a - Math.PI / 4, a + Math.PI / 4].forEach(b => trace(prism.cx, prism.cz, Math.cos(b), Math.sin(b), prism, depth + 1, 'beam'));
    } else if (dx * hit.face[0] + dz * hit.face[1] < -.9) { hitR.add(hit); seg.ok = true; } else wrongR.add(hit);
  }
  function crossesVoid(s) {
    const d = Math.hypot(s.bx - s.ax, s.bz - s.az), n = Math.ceil(d / .2);
    for (let i = 1; i < n; i++) { const t = i / n; if (isVoid(cell(Math.floor(s.ax + (s.bx - s.ax) * t), Math.floor(s.az + (s.bz - s.az) * t)))) return true; }
    return false;
  }
  function onBridge(x, z) {
    for (const b of S.bridgeList) {
      const dx = b.bx - b.ax, dz = b.bz - b.az, L2 = dx * dx + dz * dz;
      const t = clamp(((x - b.ax) * dx + (z - b.az) * dz) / L2, 0, 1);
      if (Math.hypot(b.ax + dx * t - x, b.az + dz * t - z) < BRIDGE_W && b.k > .6) return true;
    }
    return false;
  }
  function unlock(m) {
    m.locked = null; m.a = m.shown;
    for (let i = S.bridgeList.length - 1; i >= 0; i--) { const b = S.bridgeList[i]; if (b.from === m) { b.b.used = false; b.b.g.visible = false; S.bridgeList.splice(i, 1); for (let j = 0; j < 24; j++) { const t = Math.random(); fx.emit(b.ax + (b.bx - b.ax) * t, .05, b.az + (b.bz - b.az) * t, { vy: -.6, life: 1, c: GOLDc, tw: 6, a: .7 }); } } }
    Object.keys(S.crys).forEach(k => { if (k.startsWith(m.id + '>')) delete S.crys[k]; });
    fx.ring(m.cx, .05, m.cz, 0xffd08a, 1.6, .6, { a: .6 }); AU.stone();
    if (!S.hints.unlock) { S.hints.unlock = 1; toast('光桥化成了金粉。这道光又可以送去别处了', 3.6); }
  }
  function crystallize(s) {
    const key = s.from.id + '>' + s.to.id || 'x';
    S.crys[key] = true;
    if (s.from.turn !== undefined && s.from.locked === null) { const L2 = Math.hypot(s.bx - s.ax, s.bz - s.az); s.from.locked = [(s.bx - s.ax) / L2, (s.bz - s.az) / L2]; }
    if (!crossesVoid(s)) { fx.ring(s.from.cx, BY, s.from.cz, 0xffd08a, 1.4, .8); return; }
    const b = bridges.find(b => !b.used); if (!b) return;
    const dx = s.bx - s.ax, dz = s.bz - s.az, len = Math.hypot(dx, dz);
    b.used = true; b.k = 0; b.seg = s;
    b.g.position.set((s.ax + s.bx) / 2, 0, (s.az + s.bz) / 2); b.g.rotation.y = -Math.atan2(dz, dx); b.g.scale.set(len, 1, 1); b.g.children.forEach(c => c.scale.set(1, 1, 1));
    b.g.visible = true;
    const rec = { ax: s.ax, az: s.az, bx: s.bx, bz: s.bz, k: 0, b, from: s.from };
    S.bridgeList.push(rec);
    AU.stone(); AU.lamp(2); flash(.15); shake(.05, .3);
    for (let i = 0; i < 40; i++) { const t = Math.random(); fx.emit(s.ax + dx * t, .05, s.az + dz * t, { vy: .4 + Math.random() * .6, life: 1.2, c: GOLDc, tw: 8 }); }
    fx.sigil(s.bx, .06, s.bz, 0xffd08a, 'sun', 2.2, 1.4);
    if (!S.hints.bridge) { S.hints.bridge = 1; toast('光走过的路，凝成了金色的桥', 4); }
  }

  /* ================= 事件 ================= */
  function addRay(r) {
    S.rays++; AU.lamp(S.rays - 1); ctx.updateHud();
    fx.bloom(r.cx, BY, r.cz, 50, GOLDc, { w: 2.6, vr: 2, up: .8 });
    fx.ring(r.cx, .04, r.cz, 0xffd08a, 3.4, 1.2); setTimeout(() => fx.ring(r.cx, .04, r.cz, 0xffc070, 2.2, 1), 200);
    fx.sigil(r.cx, .05, r.cz, 0xffd08a, 'sun', 3, 2.2, { spin: 2 });
    flash(.25); shake(.06, .35);
  }
  function bloomRecv(r) {
    r.on = true; AU.card && AU.lamp(1);
    fx.burst(r.cx, BY, r.cz, 26, { c: [1, .78, .3], sp: 1.4, life: 1, g: -1, up: .6 });
  }
  function openGate() {
    gate.opening = true;
    cine([
      { dur: 1.2, focus: [R1.cx, R1.cz - 1], start() { addRay(R1); toast('第一道日光。向日葵醒了', 3.4); } },
      { dur: 2.2, focus: [11, 7.5], start() { AU.stone(); shake(.08, .4); flash(.12); },
        run(k, dt) { if (Math.random() < dt * 30) fx.emit(12.5, .2 + Math.random() * 2, 7.5 + (Math.random() - .5) * 3, { vy: .3, life: .9, c: GOLDc, tw: 8 }); } }
    ]);
  }
  function openGate2() {
    gate2.opening = true;
    cine([
      { dur: 1.2, focus: [R2.cx, R2.cz + 1], start() { addRay(R2); toast('第二道日光。北岛的向日葵醒了', 3.4); } },
      { dur: 2.2, focus: [27.5, 11], start() { AU.stone(); shake(.08, .4); flash(.12); toast('云对岸，庭院的门打开了', 3.4); },
        run(k, dt) { if (Math.random() < dt * 30) fx.emit(28.5, .2 + Math.random() * 2, 11.5 + (Math.random() - .5) * 3, { vy: .3, life: .9, c: GOLDc, tw: 8 }); } }
    ]);
  }
  function solveTwins() {
    S.twins = true;
    cine([
      { dur: 1.4, focus: [40.5, 7.5], start() { bloomRecv(R3a); bloomRecv(R3b); flash(.25); shake(.06, .4); fx.sigil(prism.cx, .06, prism.cz, 0xffd08a, 'sun', 5, 2.4); toast('双生的向日葵一起开了', 3.4); } },
      { dur: 2.6, focus: [47.5, 6], start() { AU.stone(); shake(.12, .6); },
        run(k, dt) { machine.k = smooth(0, 1, k) * .25; if (Math.random() < dt * 30) fx.emit(48.8 + (Math.random() - .5) * 3, 3.2 + (Math.random() - .5) * 3, 3.6, { vy: .2, life: 1, c: GOLDc, tw: 8 }); } },
      { dur: 3.2, focus: [48.5, 7.5], start() { AU.stone(); },
        run(k, dt) { machine.k = .25 + easeBack(k) * .75; if (Math.random() < dt * 4) AU.stone(); shake(.06, .2); },
        end() { S.bridgeDown = true; machine.k = 1; shake(.14, .5); flash(.2); fx.ring(49, .05, 7.5, 0xffd08a, 4, 1.2); for (let i = 0; i < 40; i++) fx.emit(47 + Math.random() * 4, .1, 7.5 + (Math.random() - .5) * 1.4, { vy: .6 + Math.random(), vx: (Math.random() - .5), life: .8, c: [.9, .75, .6], a: .7 }); } },
      { dur: 1, focus: [48.5, 7.5], start() { addRay(R3a); toast('第三道日光。日轮放下了吊桥', 3.8); } }
    ]);
  }

  function reset() {
    Object.assign(S, { rays: 0, gotCard: false, done: false, hints: {}, day: 0, dayT: 0, twinHold: 0, twins: false, bridgeDown: false, crys: {}, bridgeList: [], trail: 0, sunUp: false });
    L.mirrors.forEach(m => { m.a = m.shown = m.a0; m.locked = null; });
    L.hedge.forEach(f => { f.open = 0; }); Object.keys(S).forEach(k => { if (k.startsWith('t_')) delete S[k]; });
    L.recv.forEach(r => { r.on = false; r.k = 0; r.hitT = 0; r.bloom.scale.setScalar(.01); r.bud.scale.setScalar(1); r.light.intensity = 0; r.mat.emissiveIntensity = 0; });
    bridges.forEach(b => { b.used = false; b.g.visible = false; });
    [gate, gate2].forEach(gt => Object.assign(gt, { open: 0, opening: false }));
    machine.k = 0;
    Object.assign(card, { taken: false }); card.g.visible = true;
    altar.slotM.opacity = 0; altar.light.intensity = 0; altar.halo.material.opacity = 0; altar.dialM.emissiveIntensity = 0; altar.marks.forEach(m => m.material.emissiveIntensity = 0);
    altar.big.position.y = -8; altar.faceM.emissiveIntensity = .2; altar.bigHalo.material.opacity = 0; altar.rays.scale.setScalar(.2);
    Object.values(B).forEach(b => b.on = true);
    sea.uniforms.trail.value = 0; sea.uniforms.spin.value = 0; sea.uniforms.glow.value = 0; sea.uniforms.day.value = 0;
    ctx.hemi.color.set(DAWN.sky);
  }

  /* ================= 黎明 → 正午 ================= */
  const DAWN = { sky: new THREE.Color(0xb48ab0), ground: new THREE.Color(0x2a1424), sun: new THREE.Color(0xffb48c) };
  const NOON = { sky: new THREE.Color(0xffd8a8), ground: new THREE.Color(0x5a3428), sun: new THREE.Color(0xfff0d0) };
  const tmpC = new THREE.Color();
  function applyDay(d) {
    ctx.hemi.color.lerpColors(DAWN.sky, NOON.sky, d); ctx.hemi.groundColor.lerpColors(DAWN.ground, NOON.ground, d);
    ctx.moon.color.lerpColors(DAWN.sun, NOON.sun, d);
    LV.light.moonK = 1 + d * .5;
    sea.uniforms.day.value = d;
    shafts.forEach(s => s.set(1 - d * .6));
  }
  let LV = null;

  function update(dt, T) {
    // 镜子转动动画
    L.mirrors.forEach(m => {
      let da = m.a - m.shown; while (da > Math.PI) da -= Math.PI * 2; while (da < -Math.PI) da += Math.PI * 2;
      m.shown += da * (1 - Math.exp(-dt * 10));
      m.yaw.rotation.y = -m.shown; m.dial.rotation.y = -m.shown;
      m.dm.emissiveIntensity = .3 + m.lit * .8 + (m.locked ? .5 : 0);
      m.lit = Math.max(0, m.lit - dt * 4);
    });
    // 光路
    segs = []; hitR = new Set(); wrongR = new Set(); prismHit = false;
    L.mirrors.forEach(m => { if (m.locked) trace(m.cx, m.cz, m.locked[0], m.locked[1], m, 0, 'beam'); });
    // 光点只能照进透镜；透镜把光沿「光点 → 透镜」的方向（取整到 45°）射出去
    L.mirrors.forEach(m => {
      if (m.locked || !m.lens) return;
      const d = Math.hypot(m.cx - orb.x, m.cz - orb.z);
      if (d > ORB_REACH || d < .3 || !clearLine(orb.x, orb.z, m.cx, m.cz, (x, z) => x === m.x && z === m.z)) return;
      segs.push({ ax: orb.x, az: orb.z, bx: m.cx, bz: m.cz, from: null, to: m, kind: 'orb' });
      m.lit = 1;
      const a = Math.round(Math.atan2(m.cz - orb.z, m.cx - orb.x) / QDIR) * QDIR; m.a = a;
      trace(m.cx, m.cz, Math.cos(a), Math.sin(a), m, 1, 'beam');
    });
    // 画光束
    beams.forEach((b, i) => {
      const s = segs[i];
      if (!s) { b.core.visible = b.glow.visible = false; return; }
      const dx = s.bx - s.ax, dz = s.bz - s.az, len = Math.hypot(dx, dz), ry = -Math.atan2(dz, dx);
      const y = s.kind === 'orb' ? null : BY;
      const ay = s.kind === 'orb' ? orb.y : BY;
      const mx = (s.ax + s.bx) / 2, mz = (s.az + s.bz) / 2, my = (ay + BY) / 2, pitch = Math.atan2(BY - ay, len);
      const w = s.kind === 'orb' ? .025 : .05 + Math.sin(T * 9 + i) * .006;
      [[b.core, w], [b.glow, w * 3.4]].forEach(([m, ww]) => { m.visible = len > .05; m.position.set(mx, my, mz); m.rotation.set(0, ry, pitch); m.scale.set(Math.hypot(len, BY - ay), ww, ww); });
      b.core.material.opacity = s.kind === 'orb' ? .35 : .95; b.glow.material.opacity = s.kind === 'orb' ? .12 : .32 + Math.sin(T * 5 + i) * .05;
      void y;
      if (s.kind !== 'orb' && Math.random() < dt * len * 1.5) { const t = Math.random(); fx.emit(s.ax + dx * t, BY, s.az + dz * t, { vy: .15, life: .7, c: GOLDc, tw: 8, a: .8 }); }
    });
    // 光斑：光束打到的地方
    const ends = segs.filter(s => s.kind !== 'orb' && s.to);
    spots.forEach((l, i) => { const s = ends[i]; if (s) { l.position.set(s.bx, BY, s.bz); l.intensity = 1.6; } else l.intensity = 0; });
    // 凝成金桥
    const seen = {};
    segs.forEach(s => {
      if (s.kind === 'orb' || !s.to || !s.from || !L.mirrors.includes(s.from) || s.from.locked) return;
      const recvTarget = L.recv.includes(s.to);
      if (recvTarget && !s.ok) return; // 照在花背面的光不算
      const key = s.from.id + '>' + s.to.id;
      seen[key] = true;
      if (S.crys[key]) return;
      if (!crossesVoid(s) && !(recvTarget && s.to.on)) return;
      S['t_' + key] = (S['t_' + key] || 0) + dt;
      if (S['t_' + key] > CRYST) crystallize(s);
    });
    Object.keys(S).forEach(k => { if (k.startsWith('t_') && !seen[k.slice(2)]) S[k] = 0; });
    S.bridgeList.forEach(b => { b.k = Math.min(1, b.k + dt * 2.5); b.b.slab.scale.set(1, 1, .2 + b.k * .8); bridgeM.emissiveIntensity = .4 + Math.sin(T * 2) * .08; });
    // 向日葵（受光的）
    L.recv.forEach(r => {
      const hit = hitR.has(r);
      r.lit = hit;
      if (!r.on) {
        if (hit && r.id <= 2) { r.hitT += dt; if (r.hitT > .6) { bloomRecv(r); if (r === R1) openGate(); else openGate2(); } }
        else r.hitT = Math.max(0, r.hitT - dt);
      }
      r.k += ((r.on ? 1 : hit ? .25 : 0) - r.k) * (1 - Math.exp(-dt * 3));
      const ko = r.on ? clamp(r.k, 0, 1) : 0;
      r.bloom.scale.setScalar(Math.max(.01, easeBack(clamp(ko * 1.2, 0, 1))));
      r.bud.scale.setScalar(Math.max(.01, 1 - ko * 1.3));
      r.mat.emissiveIntensity = r.k * .5 + (hit ? .2 : 0);
      r.light.intensity = r.k * 2.2;
      // 花盘一直朝着它认的那一侧；光从背后来，花会抖一下
      let tx = r.cx + r.face[0], tz = r.cz + r.face[1];
      if (S.done) { tx = altar.x; tz = altar.big.position.z; }
      if (wrongR.has(r)) { r.wrong += dt; r.head.rotation.z += Math.sin(T * 30) * .02; if (r.wrong > .8 && !S.hints.face) { S.hints.face = 1; toast('光照在了花的背面。向日葵只收它面朝那一侧的光', 4.4); } }
      const old = r.head.quaternion.clone(); faceToward(r.head, tx, tz); r.q.copy(r.head.quaternion); r.head.quaternion.copy(old).slerp(r.q, 1 - Math.exp(-dt * 3));
      if (r.on && Math.random() < dt * 3) fx.emit(r.cx + (Math.random() - .5) * .8, BY + .3, r.cz + (Math.random() - .5) * .3, { vy: .3, life: 1.6, c: GOLDc, tw: 6 });
    });
    // 双生：两朵同时被照到，并保持一会儿
    if (!S.twins) {
      const both = hitR.has(R3a) && hitR.has(R3b);
      const pv = S.twinHold;
      S.twinHold = both ? S.twinHold + dt : Math.max(0, S.twinHold - dt * 1.5);
      if (both) { AU.shadow(S.twinHold); if (Math.random() < dt * 16) fx.emit(prism.cx + (Math.random() - .5), .1, prism.cz + (Math.random() - .5), { vy: .4, life: .8, c: GOLDc, tw: 8 }); }
      if (S.twinHold >= 1 && pv < 1) solveTwins();
      if (!both && (hitR.has(R3a) || hitR.has(R3b)) && !S.hints.twin) { S.hints.twin = 1; toast('只照到了一朵。双生的花，要同时被照到', 4.4); }
    }
    prism.lit += ((prismHit ? 1 : 0) - prism.lit) * (1 - Math.exp(-dt * 6));
    prism.cry.rotation.y += dt * (.5 + prism.lit * 2); prism.pm.emissiveIntensity = .2 + prism.lit * 1.4;
    // 花园门
    [gate, gate2].forEach(gt => { if (gt.opening) gt.open = Math.min(1, gt.open + dt * .5); gt.leaves.forEach(l => { l.pivot.rotation.y = l.s * smooth(0, 1, gt.open) * 1.6; }); });
    // 日轮机关与吊桥
    machine.wheel.rotation.z = -machine.k * Math.PI * 2 - Math.sin(T * .6) * .02;
    machine.coreM.emissiveIntensity = .15 + machine.k * 1.4;
    machine.hinge.rotation.z = Math.PI / 2 * .96 * (1 - machine.k);
    { const tip = new THREE.Vector3(4, .1, 0).applyMatrix4(machine.hinge.matrixWorld); const top = new THREE.Vector3(48.8 - 1.2, 3.2 - .8, 3.6);
      machine.hinge.updateMatrixWorld(); const mid = tip.clone().add(top).multiplyScalar(.5); machine.chain.position.copy(mid); machine.chain.scale.y = tip.distanceTo(top); machine.chain.lookAt(top); machine.chain.rotateX(Math.PI / 2); }
    // 篱笆：光点靠近时，向日葵抬头让开一条路
    L.hedge.forEach(f => { const near = Math.hypot(orb.x - f.x, orb.z - f.z) < 2.6 || Math.hypot(P.x - f.x, P.z - f.z) < .75 && f.open > .5; f.open += ((near ? 1 : 0) - f.open) * (1 - Math.exp(-dt * 5)); });
    // 装饰向日葵：花盘追着光点转
    L.deco.forEach(f => {
      let tx = orb.x, ty = orb.y, tz = orb.z;
      if (S.done) { tx = altar.x; ty = altar.big.position.y; tz = altar.big.position.z; }
      const far = (Math.hypot(tx - f.x, tz - f.z) > 9 || f.hedge) && !S.done;
      const old = f.head.quaternion.clone();
      if (far) f.head.lookAt(f.x + Math.sin(T * .3 + f.ph) * .3, f.head.position.y + .4, f.z + 2); else faceToward(f.head, tx, tz);
      void ty;
      f.q.copy(f.head.quaternion); f.head.quaternion.copy(old).slerp(f.q, 1 - Math.exp(-dt * 2.2));
      f.inner.rotation.z = Math.sin(T * 1.2 + f.ph) * .05;
      if (f.hedge) { const s = (Math.floor(f.x) + Math.floor(f.z)) % 2 ? 1 : -1; f.head.position.x = f.x + f.open * .42 * s * (f.z > 9.6 ? 0 : 1); f.head.position.z = f.z + f.open * .42 * s * (f.z > 9.6 ? 1 : 0); f.inner.scale.setScalar(1 - f.open * .35); f.bush.scale.set(1 - f.open * .55, 1 - f.open * .8, 1 - f.open * .55); f.bush.position.y = .32 - f.open * .2; }
    });
    // 牌
    if (!card.taken) { card.holder.rotation.y += dt * 1.1; card.holder.position.y = 1.15 + Math.sin(T * 1.8) * .06; }
    // 白马旗帜飘动
    { const a = horse.flag.geometry.attributes.position, b = horse.base; for (let i = 0; i < a.count; i++) { const x = b[i * 3] + .4; a.array[i * 3 + 2] = b[i * 3 + 2] + Math.sin(T * 4 + x * 5) * .08 * x; } a.needsUpdate = true; }
    // 天色
    const dayGoal = S.done ? S.day : [0, .25, .5, .7][S.rays];
    if (!S.done) S.day += (dayGoal - S.day) * (1 - Math.exp(-dt * .6));
    applyDay(S.day);
    sea.uniforms.time.value = T; sea.uniforms.orb.value.set(orb.x, orb.y, orb.z); sea.uniforms.orbK.value = orb.k;
    // 晨间的花粉、飘过的金色尘埃
    if (Math.random() < dt * 10) fx.emit(P.x + (Math.random() - .5) * 24, .3 + Math.random() * 3, P.z + (Math.random() - .5) * 16, { vy: .08, vx: .15, life: 5, c: Math.random() < .6 ? [1, .85, .55] : [1, .7, .6], tw: 4, a: .6 });
    // 引导微光
    B.LA.on = !R1.on; B.LB.on = !R2.on;
    B.R1.on = !R1.on; B.R2.on = !R2.on; B.R3a.on = B.R3b.on = !S.twins; B.prism.on = !S.twins && P.x > 34;
    B.card.on = !card.taken; B.altar.on = !S.done;
  }

  function logic(dt) {
    const h = S.hints;
    if (!h.move && ctx.S.t > .8) { h.move = 1; toast('天快亮了。把光，送到最远的地方', 4.2); }
    if (!h.m1 && Math.hypot(P.x - LA.cx, P.z - LA.cz) < 3.2) { h.m1 = 1; toast('一块聚光的透镜。把光点放在它旁边，光会从对面射出去', 5); }
    if (!h.m2 && Math.hypot(P.x - MA1.cx, P.z - MA1.cz) < 2.4) { h.m2 = 1; toast('铜镜只接光束，不接光点。按 E 转动镜子', 4.2); }
    if (!h.b && P.x > 12.8) { h.b = 1; toast('云海上没有路。光走过的地方，会留下路', 4.4); }
    if (!h.c && P.x > 18 && P.z > 9) { h.c = 1; toast('凝成金桥的镜子不能再转了。站在它旁边按 E，可以把桥收回来', 5); }
    if (!h.g2 && S.rays >= 1 && P.x > 18 && P.z > 9 && !gate2.opening) { h.g2 = 1; setTimeout(() => toast('对岸的庭院门关着，光过不去', 3.4), 5200); }
    if (!h.p && P.x > 35 && Math.hypot(P.x - prism.cx, P.z - prism.cz) < 4) { h.p = 1; toast('棱镜把一道光分成两道，各偏 45°。光可以不止一次穿过它', 4.4); }
    if (!h.hedge && Math.hypot(P.x - 38.5, P.z - 9.5) < 3) { h.hedge = 1; toast('向日葵跟着光转。把光点带过来，它们会让开', 4.2); }
    if (!h.d && P.x > 50.5) { h.d = 1; toast('日台。三道日光与牌，缺一不可', 3.8); }
  }

  function nearest() {
    const out = [];
    L.mirrors.forEach(m => { if (m.locked) out.push({ type: 'unlock', m, x: m.cx, y: BY + .9, z: m.cz, r: 1.6, label: '收回光桥' }); else if (!m.lens) out.push({ type: 'mirror', m, x: m.cx, y: BY + .9, z: m.cz, r: 1.6, label: '转动镜子' }); });
    if (!card.taken) out.push({ type: 'card', x: card.x, y: 1.9, z: card.z, r: 1.4, label: '拾起牌' });
    if (!S.done) out.push(S.gotCard && S.rays === 3 ? { type: 'finale', x: altar.x, y: 1.6, z: altar.z, r: 2.4, label: '放入　XIX 太阳' } : { type: 'altar', x: altar.x, y: 1.6, z: altar.z, r: 2.4, label: '查看日台' });
    return out;
  }
  function interact(n) {
    if (n.type === 'mirror') {
      n.m.a = n.m.a + STEP; if (n.m.a > Math.PI * 2) n.m.a -= Math.PI * 2;
      AU.hover && AU.hover(3 + Math.round(n.m.a / STEP) % 4); fx.ring(n.m.cx, .05, n.m.cz, 0xffd08a, 1.1, .5, { a: .6 });
    } else if (n.type === 'unlock') { unlock(n.m);
    } else if (n.type === 'card') {
      card.taken = true; S.gotCard = true; AU.card();
      fx.bloom(card.x, 1.1, card.z, 50, [1, .85, .55], { w: -3, vr: 2 }); fx.sigil(card.x, .06, card.z, 0xffd08a, 'sun', 2.6, 2); fx.ring(card.x, .05, card.z, 0xffc070, 2.6, 1.1); flash(.2);
      card.g.visible = false;
      toast('拾得　XIX 太阳', 3); ctx.updateHud();
    } else if (n.type === 'altar') {
      const miss = []; if (S.rays < 3) miss.push(`${3 - S.rays} 道日光`); if (!S.gotCard) miss.push('那张牌');
      toast(`日台上的太阳还在沉睡。还缺${miss.join('和')}`, 3.4); AU.wrong();
    }
  }

  function finaleStart() {
    S.done = true; orb.lock = null; toast('日出', 4);
    fx.sigil(altar.x, .32, altar.z, 0xffd08a, 'sun', 5.6, 3.5, { spin: 1.2 }); flash(.3);
  }
  function finale(dt, e) {
    altar.slotM.opacity = smooth(.2, 1.2, e);
    altar.marks.forEach((m, i) => { m.material.emissiveIntensity = smooth(.6 + i * .35, 1 + i * .35, e) * 1.6; });
    altar.dialM.emissiveIntensity = smooth(1, 3, e) * .5;
    altar.light.intensity = smooth(1, 3.5, e) * 2.2; altar.halo.material.opacity = smooth(1, 3, e) * .28;
    if (e > 1.4 && e < 6.5 && Math.floor(e * 1.2) !== Math.floor((e - dt) * 1.2)) fx.ring(altar.x, .32, altar.z, 0xffd08a, 5 + Math.random() * 2, 1.6, { a: .6 });
    // 星轨：天还没亮透，星星先转成一圈圈弧线
    S.trail = smooth(1, 5, e);
    sea.uniforms.trail.value = S.trail; sea.uniforms.spin.value += dt * (.04 + S.trail * .6); sea.uniforms.pole.value.set(altar.x, altar.z - 6);
    // 巨臂把机械太阳从云海里托起来：沉重、缓慢
    const up = smooth(2, 7, e);
    altar.big.position.y = -8 + up * 10.4;
    if (up > 0 && up < 1) { shake(.05, .2); if (Math.random() < dt * 30) fx.emit(altar.x + (Math.random() - .5) * 6, CLOUD_Y + .2, .6 + (Math.random() - .5), { vy: 1 + Math.random(), g: -2, life: 1.2, c: [1, .85, .65], a: .8 }); }
    if (up >= 1 && !S.sunUp) { S.sunUp = true; AU.stone(); shake(.12, .6); flash(.35); }
    const shine = smooth(6.5, 9.5, e);
    altar.rays.scale.setScalar(.2 + easeBack(shine) * .8); altar.rays.rotation.z = -e * .15;
    altar.faceM.emissiveIntensity = .2 + shine * .9; altar.rayM.emissiveIntensity = .3 + shine; altar.bigHalo.material.opacity = shine * .25;
    sea.uniforms.glow.value = shine;
    // 正午到来
    S.day = .7 + smooth(6, 11, e) * .3; applyDay(S.day);
    ctx.hemi.intensity = .4 + smooth(6, 11, e) * .2;
    if (e > 6.5 && e < 11 && Math.random() < dt * 30) { const a = Math.random() * 6.28, r = 1 + Math.random() * 6; fx.emit(altar.x + Math.cos(a) * r, .3, altar.z + Math.sin(a) * r, { vy: 1 + Math.random(), life: 2, c: Math.random() < .5 ? [1, .85, .5] : [1, .95, .8], tw: 8 }); }
    return e > 12.5;
  }

  function idle() {
    if (!R1.on) return ['光点照进透镜，光会从透镜的另一侧射出去', '把光点放在透镜正西边，让光往东射到铜镜；再转动两面铜镜，让光从东边照到向日葵的花脸'];
    if (!LB.locked) return ['断岸上也有一块透镜，云海对面的小岛上有铜镜', '把光点放在透镜的西北边，光会斜着射向东南的小岛，等它凝成金桥'];
    if (!R2.on) return ['北岛的向日葵朝着南边', '在南岛上转动铜镜，让光往北，照到北岛向日葵的花脸'];
    if (!gate2.opening) return ['庭院的门还关着', '北岛的向日葵开了，门才会开'];
    if (P.x < 26 && !S.bridgeList.some(b => b.from === MB1 && b.bx > 25)) return ['南岛这面镜子的光，已经凝成了通往北岛的桥', '站在南岛铜镜旁按 E 收回光桥，再把它转向东边的庭院'];
    if (!MC2.locked) return ['庭院里两面镜子，能把光送过深谷', '先往北，再往东，对准深谷对面的棱镜'];
    if (!S.twins) return ['棱镜分出的光，有一道往东北去了', '让东北角的镜子把光送回西边的镜子，再往南折回棱镜。第二次穿过棱镜的光，会分向西南；别忘了用光点拨开篱笆'];
    if (!card.taken) return ['篱笆围起来的小花园里，好像还藏着什么', '把光点留在篱笆旁边，向日葵会让开一条路'];
    return ['三道日光与牌都齐了，过吊桥去日台', '一路往东，在日台前按 E'];
  }

  LV = {
    id: 3, roman: 'XIX', name: '太阳', motto: '把光，送到最远的地方', mood: 3,
    spawn: [3.5, 7.5], menuP: [3.5, 7.5], menuOrb: [6, 6.5], menuCam: [6.5, 7.6],
    hideInReflection: L.hide, voidMat: sea, mirrorY: CLOUD_Y,
    palette: ['#1c1024', '#2e1a36', '#4a2440', '#6e3448', '#9a4a4e', '#c46a4e', '#e48e52', '#f4b45e', '#fbd68a', '#fff1cf', '#f6c6a0', '#e89a8c', '#8a5a7a', '#5a3a6a', '#5a8a3a', '#a8c070'],
    tintLo: [1.05, .96, .98], tintHi: [1.04, 1.0, .93],
    light: { sky: 0xb07aa8, ground: 0x2a1424, hemi: .3, moon: 0xff9a7a, moonK: 1, moonDir: [9, -5], orb: 0xfff0d0, halo: 0xffd9a8, mote: [1, .88, .6],
      env: [0x8a5a7a, 0x1a0c18, [[6, 6, -3, 0xffd0a0, 1.8], [-4, 3, 4, 0xe89a8c, .6], [0, 8, 0, 0xb07aa8, 2]]] },
    endCard: { title: '正午', line: '第三幕　太阳　完<br>星、月、日，都已归位' },
    constrainOrb(o) {
      L.mirrors.forEach(m => { const dx = o.tx - m.cx, dz = o.tz - m.cz, d = Math.hypot(dx, dz); if (d < .5) { o.tx = m.cx + dx / (d || 1) * .5; o.tz = m.cz + dz / (d || 1) * .5; } });
    },
    cell,
    solid(x, z) {
      const cx = Math.floor(x), cz = Math.floor(z), c = cell(cx, cz);
      if (c === 'G' || c === 'g') return gateAt(cx).open < .85;
      if (c === 'h') { const f = L.hedge.find(f => f.x === cx + .5 && f.z === cz + .5); return !f || f.open < .5; }
      return SOLID.has(c);
    },
    hole(x, z) {
      const c = cell(Math.floor(x), Math.floor(z));
      if (c === 'b') return !S.bridgeDown && !onBridge(x, z);
      if (c === ' ') return !onBridge(x, z);
      return false;
    },
    ground(x, z) { const c = cell(Math.floor(x), Math.floor(z)); return c === 'b' ? S.bridgeDown : c !== ' ' || onBridge(x, z); },
    onFall() { if (!S.hints.fall) { S.hints.fall = 1; setTimeout(() => toast('云海托不住你。只有凝成金色的光，才能踩上去', 3.8), 900); } S._splash = false; },
    onFallFrame(P) { if (!S._splash && P.y < CLOUD_Y) { S._splash = true; fx.burst(P.x, CLOUD_Y + .1, P.z, 22, { c: [1, .85, .75], sp: 1.4, up: 2, g: -5, life: 1 }); } },
    ambient() { return .3 + S.day * .14; },
    reset, update, logic, nearest, interact, finaleStart, finale, idle,
    finaleCam: () => [altar.x - .5, altar.z - 3.4],
    finaleOrb: () => [altar.x - 1.8, altar.z + 1.2],
    progress: () => `${S.rays}${S.gotCard ? 1 : 0}${R1.on ? 1 : 0}${R2.on ? 1 : 0}${gate2.opening ? 1 : 0}${S.twins ? 1 : 0}${S.bridgeDown ? 1 : 0}${S.bridgeList.length}`,
    hud: () => ({ label: '日光', dots: [R1.on, R2.on, S.twins], have: S.gotCard, line: S.done ? '牌已归位' : S.gotCard ? '持有　XIX 太阳' : '太阳之牌　未寻得' }),
    _: { L, S, LA, MA1, MA2, LB, MB1, MC1, MC2, MD, ME, R1, R2, R3a, R3b, prism, gate, gate2, card, altar, machine, unlock, get segs() { return segs; }, onBridge, mirrorAt }
  };
  return LV;
}
