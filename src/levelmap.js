// 用「底图文件」搭出来的关卡：Hug Studio 地图编辑器画的图，在这里变成和正式关卡同样材质、同样光影的场景。
// 底图文件格式（hugstudio.map/1）：
//   { format, name, roman, motto, theme: 'star'|'moon'|'sun', w, h, rows: ['#....', ...], spawn: [x, z] }
// 地面   #高墙  =矮墙  .石板  ,草地  空格=虚空  W水
// 摆件   T树  C柱  c断柱  L星灯（只是装饰，还没有机关）  O石碑
// 摆件所在的格子：树下铺草，其余铺石板；摆件都挡路。
import * as THREE from 'three';
import * as TX from './textures.js';
import { haloCanvas } from './sprites.js';
import { tex, ntex, toon, reflective, billboard, quadGeo, cliffMesh, instWalls, hashv, shadowAll, slabFloor, bevelWallGeo } from './common.js';
import { starVoid, cloudSea } from './abyss.js';

export const TILES = [
  { c: '.', name: '石板', col: '#8a8fc4' }, { c: ',', name: '草地', col: '#4a9a72' },
  { c: '#', name: '高墙', col: '#3d3f7a' }, { c: '=', name: '矮墙', col: '#6a6aa8' },
  { c: ' ', name: '虚空', col: '#0b0a1f' }, { c: 'W', name: '水', col: '#2f5684' }
];
export const PROPS = [
  { c: 'T', name: '树', col: '#5bb39a' }, { c: 'C', name: '柱', col: '#c3c4e6' }, { c: 'c', name: '断柱', col: '#9a9fcc' },
  { c: 'L', name: '星灯', col: '#f4cf6a' }, { c: 'O', name: '石碑', col: '#b8b0e0' }
];
// 第四章《审判》的机关格子（只在 builder 为 judgement 的底图里起作用，见 level4.js）
export const MECH = [
  { c: 'E', name: '回声石', col: '#cfdcff' }, { c: 'S', name: '影子', col: '#4c5578' }, { c: 'B', name: '钟', col: '#c99a52' },
  { c: '~', name: '声之石', col: '#8d98b8' }, { c: 'G', name: '石门', col: '#b4bdd2' }, { c: 'K', name: '塔罗牌', col: '#f2d8a0' },
  { c: 'A', name: '祭坛', col: '#e8c0b8' }, { c: 'H', name: '号角', col: '#f4cf6a' }
];
const SOLID = new Set(['#', '=', 'W', 'T', 'C', 'c', 'L', 'O']);
const WALL_H = 1.7, LOW_H = .45;

export const THEMES = {
  star: {
    label: '星（蓝紫夜）', mood: 1, floor: () => TX.floorTexHD(), grass: () => TX.grassTex(), wallS: () => TX.wallSideTex(), wallT: () => TX.wallTopTex(), sea: 'stars',
    palette: ['#0b0a1f', '#1a1838', '#2a2a5a', '#3d3f7a', '#5a5f9e', '#8a8fc4', '#c3c4e6', '#eef0ff', '#143a44', '#23626a', '#4a9a92', '#4a3a6e', '#7a5f98', '#e3c2b4', '#e8c98e', '#fff1c4'],
    tintLo: [.97, .96, 1.04], tintHi: [1.06, 1.02, .94],
    light: { sky: 0x7470b0, ground: 0x1a1028, hemi: .24, moon: 0x8f9cff, moonK: 1.4, moonDir: [-7, 5], orb: 0xffd88e, halo: 0xffc878, mote: [1, .86, .55],
      env: [0x2a2650, 0x06051a, [[4, 5, 2, 0xffd9a0, .9], [-5, 4, -3, 0x9fb4ff, 1.1], [0, 8, 0, 0x8080c0, 2]]] }
  },
  moon: {
    label: '月（银蓝湖）', mood: 2, floor: () => TX.moonStoneTexHD(), grass: () => TX.mossTex(), wallS: () => TX.ruinWallTex(), wallT: () => TX.ruinTopTex(), sea: 'stars',
    palette: ['#0a0a1c', '#15152e', '#22224a', '#33356a', '#4b4f8c', '#6a6fae', '#9a9fcc', '#cfd3ea', '#f2f0ff', '#1b3150', '#2f5684', '#6f9ad0', '#3a5a64', '#e88a9a', '#f6b8bc', '#e6d6a8'],
    tintLo: [.96, .97, 1.05], tintHi: [1.02, 1.0, 1.05],
    light: { sky: 0x8a90d0, ground: 0x141830, hemi: .3, moon: 0xb8c4ff, moonK: 1.35, moonDir: [6, -5], orb: 0xffd88e, halo: 0xffc878, mote: [1, .86, .55],
      env: [0x3a4070, 0x080a18, [[6, 6, -3, 0xdfe6ff, 1.8], [-4, 3, 4, 0xe88a9a, .5], [0, 8, 0, 0x8a90d0, 2]]] }
  },
  sun: {
    label: '太阳（暖砖与云海）', mood: 3, floor: () => TX.sunStoneTexHD(), grass: () => TX.meadowTex(), wallS: () => TX.brickWallTex(), wallT: () => TX.brickTopTex(), sea: 'clouds',
    palette: ['#1c1024', '#2e1a36', '#4a2440', '#6e3448', '#9a4a4e', '#c46a4e', '#e48e52', '#f4b45e', '#fbd68a', '#fff1cf', '#f6c6a0', '#e89a8c', '#8a5a7a', '#5a3a6a', '#5a8a3a', '#a8c070'],
    tintLo: [1.05, .96, .98], tintHi: [1.04, 1.0, .93],
    light: { sky: 0xb07aa8, ground: 0x2a1424, hemi: .3, moon: 0xff9a7a, moonK: 1, moonDir: [9, -5], orb: 0xffd88e, halo: 0xffc878, mote: [1, .86, .55],
      env: [0x8a5a7a, 0x1a0c18, [[6, 6, -3, 0xffd0a0, 1.8], [-4, 3, 4, 0xe89a8c, .6], [0, 8, 0, 0xb07aa8, 2]]] }
  }
};

// 第四章的起始底图：两座小庭院，中间一座窄桥跨过虚空。之后由 kanade 在编辑器里改
export function defaultMap() {
  const w = 40, h = 15, g = Array.from({ length: h }, () => Array(w).fill(' '));
  const room = (x0, z0, x1, z1) => { for (let z = z0; z <= z1; z++) for (let x = x0; x <= x1; x++) g[z][x] = (x === x0 || x === x1 || z === z0 || z === z1) ? '#' : '.'; };
  room(0, 2, 13, 12); room(26, 1, 39, 13);
  for (let x = 13; x <= 26; x++) g[7][x] = '.';
  g[7][13] = '.'; g[7][26] = '.';
  [[2, 4], [11, 10], [29, 3], [37, 11]].forEach(([x, z]) => g[z][x] = 'T');
  [[2, 3], [3, 3], [3, 4], [10, 10], [11, 11], [10, 11]].forEach(([x, z]) => g[z][x] = ',');
  [[5, 4], [8, 4], [5, 10], [8, 10]].forEach(([x, z]) => g[z][x] = 'C');
  g[7][33] = 'L'; g[3][35] = 'c';
  for (let z = 5; z <= 9; z++) for (let x = 30; x <= 31; x++) g[z][x] = 'W';
  return { format: 'hugstudio.map/1', name: '第四章', roman: 'XX', motto: '还没有名字的地方', theme: 'star', w, h, rows: g.map(r => r.join('')), spawn: [3.5, 7.5] };
}

export function normalizeMap(d) {
  const w = Math.max(8, Math.min(200, d.w | 0)), h = Math.max(6, Math.min(60, d.h | 0));
  const rows = Array.from({ length: h }, (_, z) => ((d.rows && d.rows[z]) || '').padEnd(w, ' ').slice(0, w));
  return { ...d, w, h, rows, theme: THEMES[d.theme] || d.builder ? (d.theme || 'star') : 'star', spawn: d.spawn || [2.5, h / 2] };
}

export function buildMapLevel(ctx, data) {
  const { group: root, camQuat } = ctx;
  const D = normalizeMap(data), TH = THEMES[D.theme];
  const MW = D.w, MH = D.h, grid = D.rows.map(r => r.split(''));
  const cell = (x, z) => (x < 0 || z < 0 || x >= MW || z >= MH) ? ' ' : grid[z][x];
  const isVoid = c => c === ' ';
  const L = { sway: [], hide: [], lamps: [] };

  /* 材质：跟着画风走 */
  const cFloor = TH.floor(), cGrass = TH.grass(), cWallS = TH.wallS(), cWallT = TH.wallT(), cCliff = TX.cliffTex();
  const matStone = toon({ map: tex(cFloor), normalMap: ntex(cFloor, 3.5), normalScale: new THREE.Vector2(.85, .85), roughness: .5 });
  const matGrass = toon({ map: tex(cGrass), normalMap: ntex(cGrass, 3.4), roughness: .95 });
  const ws = toon({ map: tex(cWallS), normalMap: ntex(cWallS, 5.5), normalScale: new THREE.Vector2(1.4, 1.4), roughness: .7 });
  const wt = toon({ map: tex(cWallT), normalMap: ntex(cWallT, 3), roughness: .45 });
  const stoneM = toon({ color: 0x9c96bf, roughness: .42, metalness: .05 });
  const goldM = toon({ color: 0xd1b072, roughness: .28, metalness: .85 });

  /* 地面、崖壁、墙 */
  const floors = { '.': [], ',': [] }, cliffs = [], tall = [], low = [], water = [];
  for (let z = 0; z < MH; z++) for (let x = 0; x < MW; x++) {
    const c = grid[z][x]; if (isVoid(c)) continue;
    if (c === 'W') water.push([x, z]);
    else if (c === '#') tall.push([x, z]);
    else if (c === '=') low.push([x, z]);
    if (c === 'W') { /* 水下不铺地 */ } else floors[c === ',' || c === 'T' ? ',' : '.'].push([x, z]);
    [[0, 1], [0, -1], [1, 0], [-1, 0]].forEach(([dx, dz]) => { if (isVoid(cell(x + dx, z + dz))) cliffs.push([x, z, dx, dz]); });
  }
  if (floors['.'].length) root.add(slabFloor(floors['.'], matStone, { seed: 4, tile: 4 }));
  if (floors[','].length) { const fg = new THREE.Mesh(quadGeo(floors[',']), matGrass); fg.receiveShadow = true; root.add(fg); }
  if (cliffs.length) root.add(cliffMesh(cliffs, toon({ map: tex(cCliff), normalMap: ntex(cCliff, 4), side: THREE.DoubleSide })));
  const wallMats = [ws, wt];
  if (tall.length) instWalls(root, tall, bevelWallGeo(WALL_H), wallMats);
  if (low.length) instWalls(root, low, bevelWallGeo(LOW_H), wallMats);
  if (water.length) {
    const cW = TX.waterTex();
    const wm = reflective(toon({ map: tex(cW), normalMap: ntex(cW, 2.2), transparent: true, opacity: .92, emissive: 0x1a2a66, emissiveIntensity: .3, roughness: .26, metalness: .1 }), .45, .5);
    const m = new THREE.Mesh(quadGeo(water, -.14, 2), wm); m.receiveShadow = true; root.add(m);
    root.add(new THREE.Mesh(quadGeo(water, -.5, 2), toon({ color: 0x141a3a })));
  }

  /* 虚空：星空或云海 */
  const voidMat = TH.sea === 'clouds' ? cloudSea() : starVoid();
  const voidPlane = new THREE.Mesh(new THREE.PlaneGeometry(400, 400), voidMat);
  voidPlane.rotation.x = -Math.PI / 2; voidPlane.position.set(MW / 2, TH.sea === 'clouds' ? -1.2 : -7, MH / 2); root.add(voidPlane);
  L.hide.push(voidPlane);

  /* 摆件 */
  const crown = tex(TX.foliageTex(['#1d2a4a', '#2a4a6a', '#3a6a7a', '#5a9a9a', '#9ad0c0']));
  const trunkM = toon({ color: 0x3a2c52 }), crownM = toon({ map: crown, flatShading: true, roughness: .6 });
  const cCol = TX.columnTex(), colM = toon({ map: tex(cCol), normalMap: ntex(cCol, 4), normalScale: new THREE.Vector2(1.3, 1.3), roughness: .35 });
  const haloT = tex(haloCanvas(64)); haloT.wrapS = haloT.wrapT = THREE.ClampToEdgeWrapping;
  const add = (x, z, f) => { const g0 = new THREE.Group(); g0.position.set(x + .5, 0, z + .5); f(g0); shadowAll(g0); root.add(g0); return g0; };
  for (let z = 0; z < MH; z++) for (let x = 0; x < MW; x++) {
    const c = grid[z][x];
    if (c === 'T') {
      const g0 = add(x, z, g0 => {
        const t = new THREE.Mesh(new THREE.CylinderGeometry(.05, .09, .9, 5), trunkM); t.position.y = .45; g0.add(t);
        if (hashv(x, z) > .45) [[.55, 1.0, 1.15], [.4, .8, 1.65], [.24, .5, 2.05]].forEach(([r, h, y]) => { const m = new THREE.Mesh(new THREE.ConeGeometry(r, h, 6), crownM); m.position.y = y; g0.add(m); });
        else { const s = new THREE.Mesh(new THREE.IcosahedronGeometry(.58, 0), crownM); s.position.y = 1.35; g0.add(s); const s2 = new THREE.Mesh(new THREE.IcosahedronGeometry(.3, 0), crownM); s2.position.set(.3, 1.85, .1); g0.add(s2); }
        g0.rotation.y = hashv(z, x) * 6.28;
      });
      L.sway.push({ o: g0, ph: hashv(x, z) * 6 });
    } else if (c === 'C' || c === 'c') {
      add(x, z, g0 => {
        const broken = c === 'c', h = broken ? .9 + hashv(x, z) * .5 : 2.2;
        const base = new THREE.Mesh(new THREE.BoxGeometry(.8, .16, .8), colM); base.position.y = .08; g0.add(base);
        const shaft = new THREE.Mesh(new THREE.CylinderGeometry(.26, .29, h, 8), colM); shaft.position.y = .16 + h / 2; g0.add(shaft);
        if (!broken) { const cap = new THREE.Mesh(new THREE.BoxGeometry(.78, .18, .78), colM); cap.position.y = .16 + h + .09; g0.add(cap); const band = new THREE.Mesh(new THREE.CylinderGeometry(.3, .3, .05, 8), goldM); band.position.y = .16 + h - .2; g0.add(band); }
        else { const chunk = new THREE.Mesh(new THREE.DodecahedronGeometry(.22, 0), colM); chunk.position.set(.45, .15, .35); g0.add(chunk); }
      });
    } else if (c === 'L') {
      add(x, z, g0 => {
        const ped = new THREE.Mesh(new THREE.CylinderGeometry(.2, .3, .8, 8), stoneM); ped.position.y = .4; g0.add(ped);
        const bowl = new THREE.Mesh(new THREE.CylinderGeometry(.36, .14, .2, 8), stoneM); bowl.position.y = .9; g0.add(bowl);
        const lip = new THREE.Mesh(new THREE.TorusGeometry(.36, .025, 4, 16), goldM); lip.rotation.x = Math.PI / 2; lip.position.y = 1.0; g0.add(lip);
        const cr = new THREE.Mesh(new THREE.OctahedronGeometry(.17, 0), new THREE.MeshStandardMaterial({ roughness: .3, color: 0x8f8cc8, emissive: 0xffd89a, emissiveIntensity: .6 }));
        cr.position.y = 1.28; g0.add(cr);
        const halo = billboard(haloT, 1.8, 1.8, true, camQuat); halo.position.y = 1.28; halo.material.color.set(0xffd89a); halo.material.opacity = .35; g0.add(halo);
        const light = new THREE.PointLight(0xffd29a, 1.2, 6, 1.6); light.position.y = 1.3; g0.add(light);
        L.lamps.push({ x: x + .5, z: z + .5, cr });
      });
      L.lamps[L.lamps.length - 1].cr.castShadow = false;
    } else if (c === 'O') {
      add(x, z, g0 => {
        const base = new THREE.Mesh(new THREE.BoxGeometry(.9, .2, .9), stoneM); base.position.y = .1; g0.add(base);
        const cOb = TX.obeliskTex();
        const body = new THREE.Mesh(new THREE.CylinderGeometry(.2, .34, 2.6, 4, 1), toon({ map: tex(cOb), normalMap: ntex(cOb, 4), roughness: .35 })); body.rotation.y = Math.PI / 4; body.position.y = 1.5; g0.add(body);
        const tip = new THREE.Mesh(new THREE.ConeGeometry(.2, .36, 4), goldM); tip.rotation.y = Math.PI / 4; tip.position.y = 2.98; g0.add(tip);
      });
    }
  }

  function update(dt, T) {
    voidMat.uniforms.time.value = T;
    L.sway.forEach(s => { s.o.rotation.z = Math.sin(T * .9 + s.ph) * .02; });
    L.lamps.forEach((l, i) => { l.cr.rotation.y = T * .8 + i; l.cr.position.y = 1.28 + Math.sin(T * 1.6 + i) * .04; });
  }
  const none = () => {};
  return {
    id: 4, roman: D.roman || 'XX', name: D.name || '第四章', motto: D.motto || '', mood: TH.mood,
    spawn: D.spawn, menuP: D.spawn, menuOrb: [D.spawn[0] + 2, D.spawn[1]], menuCam: D.spawn,
    leash: 7.5, mirrorY: -.14, hideInReflection: L.hide, voidMat,
    palette: TH.palette, tintLo: TH.tintLo, tintHi: TH.tintHi, light: { ...TH.light },
    endCard: { title: D.name || '第四章', line: '编辑中的章节' },
    cell,
    solid(x, z) { return SOLID.has(cell(Math.floor(x), Math.floor(z))); },
    hole(x, z) { return isVoid(cell(Math.floor(x), Math.floor(z))); },
    ground(x, z) { return !isVoid(cell(Math.floor(x), Math.floor(z))); },
    ambient() { return TH.light.hemi; },
    reset: none, update, logic: none, nearest: () => [], interact: none, finaleStart: none, finale: () => false, idle: () => null,
    finaleCam: () => D.spawn, finaleOrb: () => D.spawn,
    progress: () => '0', MW, MH, nodes: [],
    mapMarks: () => L.lamps.map(l => ({ x: l.x, z: l.z, kind: 'lamp', done: true })),
    hud: () => ({ label: '星灯', dots: [], have: false, line: '编辑中' }),
    _: { L, data: D }
  };
}
