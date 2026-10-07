// 程序化像素贴图：16 像素 = 1 米
import { mk } from './sprites.js';

export const BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5];
export function rng(seed) { return function () { seed |= 0; seed = seed + 0x6D2B79F5 | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
export function hash(x, y) { let h = Math.imul(x | 0, 374761393) ^ Math.imul(y | 0, 668265263); h = Math.imul(h ^ (h >>> 13), 1274126177); return ((h ^ (h >>> 16)) >>> 0) / 4294967296; }
function vnoise(x, y, p) {
  let xi = Math.floor(x), yi = Math.floor(y); const xf = x - xi, yf = y - yi;
  const u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf);
  let x1 = xi + 1, y1 = yi + 1; if (p) { xi = ((xi % p) + p) % p; x1 = ((x1 % p) + p) % p; yi = ((yi % p) + p) % p; y1 = ((y1 % p) + p) % p; }
  const a = hash(xi, yi), b = hash(x1, yi), c = hash(xi, y1), d = hash(x1, y1);
  return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
}
export function fbm(x, y, p) { let s = 0, a = .5; for (let i = 0; i < 4; i++) { s += a * vnoise(x, y, p); x *= 2; y *= 2; if (p) p *= 2; a *= .5; } return s; }
const hex = h => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];
const clamp = (v, a, b) => v < a ? a : v > b ? b : v;

// 用明度坡道 + Bayer 抖动给每个像素取色
function painter(w, h) {
  const c = mk(w, h), g = c.getContext('2d'), im = g.createImageData(w, h), d = im.data;
  return {
    c,
    set(x, y, col, a = 255) { const i = (y * w + x) * 4; d[i] = col[0]; d[i + 1] = col[1]; d[i + 2] = col[2]; d[i + 3] = a; },
    ramp(x, y, ramp, v) { const f = clamp(v, 0, 1) * (ramp.length - 1) + (BAYER[(y & 3) * 4 + (x & 3)] / 16 - .5) * .9; this.set(x, y, ramp[clamp(Math.round(f), 0, ramp.length - 1)]); },
    done() { g.putImageData(im, 0, 0); return c; }
  };
}

// 石板地面：2×2 米一块，带八芒星嵌金（格瑞斯式的几何纹样）
const STONE = ['#4a4670', '#635e8c', '#7f79a6', '#9c96bf', '#bab4d6', '#d8d3ea'].map(hex);
const GOLD = ['#7a6040', '#a8874f', '#d1b072', '#efd9a0'].map(hex);
export function floorTex() {
  const N = 32, p = painter(N, N);
  for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
    // 四块小砖 + 中心星形嵌片
    const bx = x % 16, by = y % 16, cellId = (x >> 4) + (y >> 4) * 2;
    let v = .52 + (hash(cellId, 7) - .5) * .12 + (fbm(x * .18, y * .18, 6) - .5) * .22;
    if (bx === 0 || by === 0) v = .14; else if (bx === 1 || by === 1) v += .14; else if (bx === 15 || by === 15) v -= .12;
    // 斜向大理石纹
    const vein = Math.abs(Math.sin((x + y * .6) * .35 + fbm(x * .2, y * .2, 6) * 6));
    if (vein < .06) v -= .12;
    p.ramp(x, y, STONE, v);
  }
  // 在四砖交汇点放一枚小星（星形嵌金）
  const star = (cx, cy) => {
    const pts = [[0, 0], [1, 0], [-1, 0], [0, 1], [0, -1], [2, 0], [-2, 0], [0, 2], [0, -2], [3, 0], [-3, 0], [0, 3], [0, -3]];
    pts.forEach(([dx, dy]) => { const x = (cx + dx + N) % N, y = (cy + dy + N) % N; const a = Math.abs(dx) + Math.abs(dy); p.set(x, y, a === 0 ? STONE[5] : a < 3 ? STONE[4] : STONE[3]); });
    [[1, 1], [-1, 1], [1, -1], [-1, -1]].forEach(([dx, dy]) => p.set((cx + dx + N) % N, (cy + dy + N) % N, STONE[3]));
  };
  star(0, 0);
  return p.done();
}

// 夜色草地：蓝绿，点缀白色小点
const GRASS = ['#152a3a', '#1d3a48', '#264d55', '#33615f', '#457a6c', '#64987f'].map(hex);
export function grassTex() {
  const N = 32, S = 2, p = painter(N * S, N * S);
  for (let yy = 0; yy < N * S; yy++) for (let xx = 0; xx < N * S; xx++) { const x = xx / S, y = yy / S;
    let v = .45 + (fbm(x * .15, y * .15, 5) - .5) * .7;
    const blade = hash(x, y * 3) > .86; if (blade) v += .22;
    if (hash(x * 7, y) > .975) v -= .25;
    p.ramp(xx, yy, GRASS, v);
  }
  return p.done();
}

// 墙面：错缝砌石，越往下越暗
const WALL = ['#2a2547', '#38325c', '#4a4372', '#5e568a', '#7a72a3', '#9a93bf'].map(hex);
export function wallSideTex() {
  const W = 16, H = 32, S = 2, p = painter(W * S, H * S);
  for (let yy = 0; yy < H * S; yy++) for (let xx = 0; xx < W * S; xx++) { const x = xx / S, y = yy / S;
    const row = y >> 3, inY = y & 7, off = row % 2 ? 8 : 0, bx = (x + off) % 16, inX = bx % 8, col = ((x + off) >> 3) + row * 3;
    let v = .55 + (hash(col, row) - .5) * .2 + (fbm(x * .3, y * .3, 4) - .5) * .25;
    if (inY === 0) v += .2; else if (inY === 7 || inX === 0) v = .08;
    v -= (y / H) * .25;
    p.ramp(xx, yy, WALL, v);
  }
  return p.done();
}
export function wallTopTex() {
  const N = 16, S = 2, p = painter(N * S, N * S);
  for (let yy = 0; yy < N * S; yy++) for (let xx = 0; xx < N * S; xx++) { const x = xx / S, y = yy / S;
    let v = .72 + (fbm(x * .3, y * .3, 4) - .5) * .25;
    if (x === 0 || y === 0) v += .12; if (x === N - 1 || y === N - 1) v -= .2;
    p.ramp(xx, yy, STONE, v);
  }
  return p.done();
}
// 浮岛崖壁（地块边缘向下）
const ROCK = ['#120f24', '#1d1835', '#2a2347', '#3a3160', '#4c4378'].map(hex);
export function cliffTex() {
  const W = 16, H = 32, S = 2, p = painter(W * S, H * S);
  for (let yy = 0; yy < H * S; yy++) for (let xx = 0; xx < W * S; xx++) { const x = xx / S, y = yy / S;
    let v = .75 - y / H * .8 + (fbm(x * .25, y * .12, 4) - .5) * .5;
    if (y < 2) v = .95;
    p.ramp(xx, yy, ROCK, v);
  }
  return p.done();
}
// 光之桥：半透明星晶石板
export function bridgeTex() {
  const N = 16, p = painter(N, N);
  const C = ['#4d6fc4', '#7aa0e8', '#a9c8ff', '#d9e8ff', '#ffffff'].map(hex);
  for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
    let v = .35 + (fbm(x * .3, y * .3, 4) - .5) * .3;
    if (x === 0 || y === 0 || x === N - 1 || y === N - 1) v = .85;
    const d = Math.abs(x - 7.5) + Math.abs(y - 7.5);
    if (d < 1.5 || (Math.abs(x - 7.5) < .6 && Math.abs(y - 7.5) < 5) || (Math.abs(y - 7.5) < .6 && Math.abs(x - 7.5) < 5)) v = .95;
    p.ramp(x, y, C, v);
  }
  return p.done();
}
// 石碑/方尖碑表面，带刻纹
export function obeliskTex() {
  const W = 16, H = 48, S = 2, p = painter(W * S, H * S);
  for (let yy = 0; yy < H * S; yy++) for (let xx = 0; xx < W * S; xx++) { const x = xx / S, y = yy / S;
    let v = .6 + (fbm(x * .25, y * .2, 4) - .5) * .3 - (y / H) * .2;
    if ((y === 10 || y === 38) && x > 2 && x < 13) v = .15;
    p.ramp(xx, yy, STONE, v);
  }
  // 八芒星刻纹
  const cx = 15, cy = 45; // 高清坐标
  for (let k = -8; k <= 8; k++) { p.set(cx + k, cy, GOLD[2]); p.set(cx, cy + k, GOLD[2]); }
  for (let k = -4; k <= 4; k++) { p.set(cx + k, cy + k, GOLD[1]); p.set(cx + k, cy - k, GOLD[1]); }
  p.set(cx, cy, GOLD[3]); p.set(cx + 1, cy, GOLD[3]); p.set(cx, cy + 1, GOLD[3]);
  return p.done();
}
// 星纹地砖（日晷的目标）
export function runeTex() {
  const N = 16, c = mk(N, N), g = c.getContext('2d');
  g.fillStyle = '#ffffff';
  const px = (x, y) => g.fillRect(x, y, 1, 1);
  for (let a = 0; a < 64; a++) { const t = a / 64 * Math.PI * 2; px(Math.round(7.5 + Math.cos(t) * 6.6), Math.round(7.5 + Math.sin(t) * 6.6)); }
  for (let k = -5; k <= 5; k++) { px(7 + k, 7); px(7, 7 + k); }
  for (let k = -2; k <= 2; k++) { px(7 + k, 7 + k); px(7 + k, 7 - k); }
  return c;
}
// 柱子（八棱柱身）
export function columnTex() {
  const W = 16, H = 32, S = 2, p = painter(W * S, H * S);
  for (let yy = 0; yy < H * S; yy++) for (let xx = 0; xx < W * S; xx++) { const x = xx / S, y = yy / S;
    let v = .62 + (fbm(x * .3, y * .15, 4) - .5) * .25;
    if (x % 4 === 0) v -= .2;
    p.ramp(xx, yy, STONE, v);
  }
  return p.done();
}
// 石门：深色门板 + 金色星饰
export function gateTex() {
  const W = 48, H = 32, p = painter(W, H);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    let v = .35 + (fbm(x * .2, y * .2, 4) - .5) * .2;
    if (x % 16 === 0 || y === 0) v = .6;
    p.ramp(x, y, WALL, v);
  }
  const cx = 24, cy = 16;
  for (let k = -9; k <= 9; k++) { p.set(cx + k, cy, GOLD[2]); }
  for (let k = -12; k <= 12; k++) p.set(cx, cy + k < 0 ? 0 : Math.min(H - 1, cy + k), GOLD[2]);
  for (let k = -4; k <= 4; k++) { p.set(cx + k, cy + k, GOLD[1]); p.set(cx + k, cy - k, GOLD[1]); }
  return p.done();
}
// 水面：深蓝 + 像素波纹（滚动使用）
export function waterTex() {
  const N = 32, p = painter(N, N);
  const C = ['#141c45', '#1d2a5e', '#2a3f7c', '#3c5a9e', '#6d8fd0', '#bcd2ff'].map(hex);
  for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
    let v = .3 + (fbm(x * .12, y * .25, 4) - .5) * .5;
    const w = Math.sin(x * .4 + Math.sin(y * .5) * 2 + y * .2);
    if (w > .93) v = .85;
    p.ramp(x, y, C, v);
  }
  return p.done();
}
// 叶冠（格瑞斯式几何树用的柔和色块）
export function foliageTex(cols) {
  const N = 16, p = painter(N, N), R = cols.map(hex);
  for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) p.ramp(x, y, R, .5 + (fbm(x * .3, y * .3, 4) - .5) * .5 + (hash(x, y) > .9 ? .2 : 0));
  return p.done();
}

// 由明度生成可平铺的法线贴图：砖缝、纹理凹下去，像素级的凹凸光影
export function heightNormal(src, k = 2.5, invert = false) {
  const W = src.width, H = src.height, d = src.getContext('2d').getImageData(0, 0, W, H).data;
  const h = new Float32Array(W * H);
  const raw = new Float32Array(W * H);
  for (let i = 0; i < W * H; i++) { const l = (d[i * 4] * .3 + d[i * 4 + 1] * .59 + d[i * 4 + 2] * .11) / 255; raw[i] = invert ? 1 - l : l; }
  // 先平滑一次，去掉抖动噪点，只保留砖缝和大的起伏（高清贴图用 5×5，不然高光会变成满地的白点）
  const R = W >= 32 && H >= 32 ? 2 : 1, NN = (2 * R + 1) * (2 * R + 1);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) { let s = 0; for (let j = -R; j <= R; j++) for (let i = -R; i <= R; i++) s += raw[((y + j + H) % H) * W + ((x + i + W) % W)]; h[y * W + x] = s / NN; }
  const out = mk(W, H), g = out.getContext('2d'), im = g.createImageData(W, H), o = im.data;
  const Hh = (x, y) => h[((y + H) % H) * W + ((x + W) % W)];
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    let nx = -(Hh(x + 1, y) - Hh(x - 1, y)) * k, ny = (Hh(x, y + 1) - Hh(x, y - 1)) * k, nz = 1;
    const L = Math.hypot(nx, ny, nz); const i = (y * W + x) * 4;
    o[i] = (nx / L * .5 + .5) * 255; o[i + 1] = (ny / L * .5 + .5) * 255; o[i + 2] = (nz / L * .5 + .5) * 255; o[i + 3] = 255;
  }
  g.putImageData(im, 0, 0); return out;
}

/* ================= 月之章：水上遗迹 ================= */
const MSTONE = ['#2b2a4a', '#3e3d66', '#58587f', '#75779c', '#9598ba', '#b9bdd6', '#dcdff0'].map(hex);
const MOSS = ['#121d2c', '#18283a', '#1f3546', '#2a4552', '#3a5a64', '#5a7c80'].map(hex);
const SAND = ['#1c2036', '#272c48', '#353b5c', '#4a5274', '#68708f'].map(hex);
const RUIN = ['#232540', '#2f3254', '#3f4369', '#525880', '#6b7298', '#8e95b8'].map(hex);
const CORAL = ['#6a3550', '#a85a72', '#e88a9a', '#f6b8bc'].map(hex);
// 月石步道：大块圆角石板，缝隙深凹，中间有新月刻纹，局部是湿的（更亮更平滑）
export function moonStoneTex() {
  const N = 32, p = painter(N, N);
  for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
    const bx = x % 16, by = y % 16, id = (x >> 4) + (y >> 4) * 2;
    let v = .5 + (hash(id, 3) - .5) * .14 + (fbm(x * .2, y * .2, 6) - .5) * .2;
    // 圆角缝：角上更宽，凹陷更深
    const cx = Math.min(bx, 15 - bx), cy = Math.min(by, 15 - by);
    if (cx === 0 || cy === 0 || (cx + cy < 3)) v = .05;
    else if (cx === 1 || cy === 1) v += (bx < 8 && by < 8) ? .18 : .08; else if (bx === 14 || by === 14) v -= .1;
    // 新月刻纹（凹下去）
    if (id === 0) { const a = Math.hypot(bx - 7.5, by - 7.5), b = Math.hypot(bx - 9, by - 6.5); if (a < 4.2 && a > 3.2 && b > 3.4) v = .2; }
    if (fbm(x * .12 + 4, y * .12, 4) > .62) v += .08;
    p.ramp(x, y, MSTONE, v);
  }
  return p.done();
}
export function mossTex() {
  const N = 32, S = 2, p = painter(N * S, N * S);
  for (let yy = 0; yy < N * S; yy++) for (let xx = 0; xx < N * S; xx++) { const x = xx / S, y = yy / S;
    let v = .42 + (fbm(x * .16, y * .16, 5) - .5) * .8;
    if (hash(x, y * 3) > .88) v += .25;
    if (hash(x * 5, y) > .985) v = 1;
    p.ramp(xx, yy, MOSS, v);
  }
  return p.done();
}
export function sandTex() {
  const N = 32, S = 2, p = painter(N * S, N * S);
  for (let yy = 0; yy < N * S; yy++) for (let xx = 0; xx < N * S; xx++) { const x = xx / S, y = yy / S;
    let v = .45 + (fbm(x * .22, y * .22, 7) - .5) * .5;
    const pb = hash((x >> 1) * 3, (y >> 1) * 7); if (pb > .9) v += .3; else if (pb < .05) v -= .25;
    p.ramp(xx, yy, SAND, v);
  }
  return p.done();
}
// 断墙：大块条石错缝，底部长苔，有裂纹
export function ruinWallTex() {
  const W = 16, H = 32, S = 2, p = painter(W * S, H * S);
  for (let yy = 0; yy < H * S; yy++) for (let xx = 0; xx < W * S; xx++) { const x = xx / S, y = yy / S;
    const row = (y / 6) | 0, inY = y % 6, off = row % 2 ? 5 : 0, bx = (x + off) % 10, col = ((x + off) / 10 | 0) + row * 3;
    let v = .58 + (hash(col, row) - .5) * .22 + (fbm(x * .3, y * .3, 4) - .5) * .25;
    if (inY === 0) v += .18; else if (inY === 5 || bx === 0) v = .06;
    if (Math.abs(x - 6 - Math.sin(y * .7) * 2) < .6 && y > 8 && y < 22) v = .1;
    v -= (y / H) * .2;
    p.ramp(xx, yy, RUIN, v);
    if (y > H - 8 && fbm(x * .4, y * .5, 4) > .48 - (y - H + 8) * .04) p.ramp(xx, yy, MOSS, .45 + hash(x, y) * .3);
  }
  return p.done();
}
export function ruinTopTex() {
  const N = 16, S = 2, p = painter(N * S, N * S);
  for (let yy = 0; yy < N * S; yy++) for (let xx = 0; xx < N * S; xx++) { const x = xx / S, y = yy / S;
    let v = .6 + (fbm(x * .3, y * .3, 4) - .5) * .3;
    if (x === 0 || y === 0) v += .15; if (x === N - 1 || y === N - 1) v = .1;
    p.ramp(xx, yy, RUIN, v);
    if (fbm(x * .3 + 7, y * .3, 4) > .6) p.ramp(xx, yy, MOSS, .5);
  }
  return p.done();
}
// 塔身：环形石带 + 窄窗
export function towerTex() {
  const W = 32, H = 64, S = 2, p = painter(W * S, H * S);
  for (let yy = 0; yy < H * S; yy++) for (let xx = 0; xx < W * S; xx++) { const x = xx / S, y = yy / S;
    const row = (y / 5) | 0, inY = y % 5, off = row % 2 ? 4 : 0;
    let v = .55 + (hash(((x + off) / 8) | 0, row) - .5) * .2 + (fbm(x * .2, y * .2, 4) - .5) * .2;
    if (inY === 0) v += .15; else if (inY === 4 || (x + off) % 8 === 0) v = .08;
    if (y % 20 === 10 || y % 20 === 11) v = y % 20 === 10 ? .85 : .2;
    if ((x % 16 > 6 && x % 16 < 9) && (y % 20 > 13 && y % 20 < 19)) v = .02;
    v -= (y / H) * .15;
    p.ramp(xx, yy, MSTONE, v);
  }
  return p.done();
}
// 影石（只在影子里成形的路）：半透明月白，中间一枚新月
export function mistTex() {
  const N = 16, p = painter(N, N);
  const C = ['#3a3a70', '#5c5f9c', '#8a8dc4', '#b9bce6', '#e8eaff'].map(hex);
  for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
    let v = .35 + (fbm(x * .3, y * .3, 4) - .5) * .3;
    if (x === 0 || y === 0 || x === N - 1 || y === N - 1) v = .85;
    else if (x === 1 || y === 1) v = .1;
    const a = Math.hypot(x - 7.5, y - 7.5), b = Math.hypot(x - 9, y - 6.5);
    if (a < 4.5 && a > 3.3 && b > 3.6) v = .95;
    p.ramp(x, y, C, v);
  }
  return p.done();
}
// 月洞门的石盘：同心圆 + 四个月相
export function moonDiscTex() {
  const N = 48, p = painter(N, N), c = (N - 1) / 2;
  for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
    const r = Math.hypot(x - c, y - c);
    let v = .45 + (fbm(x * .2, y * .2, 4) - .5) * .25;
    if (Math.abs(r - 22) < .8 || Math.abs(r - 16) < .6) v = .85; else if (Math.abs(r - 21) < .6) v = .1;
    if (r < 3.5) v = .9;
    for (let k = 0; k < 4; k++) {
      const a = k / 4 * Math.PI * 2 + Math.PI / 4, mx = c + Math.cos(a) * 10, my = c + Math.sin(a) * 10;
      const d1 = Math.hypot(x - mx, y - my), d2 = Math.hypot(x - mx - (3 - k * 1.5), y - my);
      if (d1 < 3.5 && (k === 3 || d2 > 3.2)) v = .9; else if (d1 < 3.8 && d1 >= 3.5) v = .15;
    }
    p.ramp(x, y, MSTONE, v);
  }
  return p.done();
}
export function coralRamp() { return CORAL; }
// 芦苇（朝相机的小片）
export function reedCanvas(seed) {
  const c = mk(10, 16), g = c.getContext('2d'), r = rng(seed);
  const cols = ['#2a4552', '#3a5a64', '#5a7c80', '#8fb0b0'];
  for (let k = 0; k < 4; k++) {
    let x = 2 + r() * 6, h = 8 + r() * 7;
    for (let y = 15; y > 15 - h; y--) { g.fillStyle = cols[Math.min(3, (15 - y) / 4 | 0)]; g.fillRect(Math.round(x), y, 1, 1); x += (r() - .5) * .5; }
    if (r() > .4) { g.fillStyle = '#c9b48a'; g.fillRect(Math.round(x), 15 - h, 1, 2); }
  }
  return c;
}
// 睡莲
export function lotusCanvas(open) {
  const c = mk(12, 8), g = c.getContext('2d');
  const px = (x, y, k) => { g.fillStyle = k; g.fillRect(x, y, 1, 1); };
  g.fillStyle = '#1f3d42'; for (let x = 1; x < 11; x++) for (let y = 4; y < 8; y++) if (Math.hypot(x - 5.5, (y - 5.8) * 1.8) < 5) px(x, y, '#2a5552');
  if (open) { [[5, 2], [6, 2], [4, 3], [5, 3], [6, 3], [7, 3], [3, 4], [8, 4]].forEach(([x, y]) => px(x, y, '#f6d6e4')); px(5, 4, '#ffe9a0'); px(6, 4, '#ffe9a0'); }
  return c;
}

/* ================= 高清贴图：32 像素 = 1 米（和画面像素一一对应） ================= */
// 一块 1 米石板：明暗从左上到右下缓缓过渡（像参考里被灯照着的地砖），边上一像素高光 / 暗边
function tileShade(bx, by, N, id, salt) {
  let v = .5 + (hash(id, salt) - .5) * .16;
  v += (.5 - (bx + by) / (2 * N)) * .18;
  if (bx < 1 || by < 1) v += .16; else if (bx > N - 2 || by > N - 2) v -= .14;
  return v;
}
// 星之章大理石板：64×64 = 2×2 块，部分石板中心嵌一枚金色四芒星
export function floorTexHD() {
  const N = 64, T = 32, p = painter(N, N);
  for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
    const bx = x % T, by = y % T, id = (x >> 5) + (y >> 5) * 2;
    let v = tileShade(bx, by, T, id, 7) + (fbm(x * .07, y * .07, 9) - .5) * .14;
    const vein = Math.abs(Math.sin((x + y * .55) * .16 + fbm(x * .08, y * .08, 9) * 5 + id));
    if (vein < .045) v -= .1; else if (vein < .09) v -= .04;
    if (hash(x * 3 + id, y * 5) > .992) v -= .2;
    p.ramp(x, y, STONE, v);
    // 四芒星嵌金（只在对角两块上）
    if (id === 0 || id === 3) {
      const dx = Math.abs(bx - 15.5), dy = Math.abs(by - 15.5);
      const star = dx * dy < 2.2 && dx + dy < 6.5;
      if (star) p.ramp(x, y, GOLD, .9 - (dx + dy) / 8 + (bx < 16 && by < 16 ? .1 : 0));
    }
  }
  return p.done();
}
// 月之章月石：圆角大石板，局部湿润发亮，有的刻着新月
export function moonStoneTexHD() {
  const N = 64, T = 32, p = painter(N, N);
  for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
    const bx = x % T, by = y % T, id = (x >> 5) + (y >> 5) * 2;
    let v = tileShade(bx, by, T, id, 3) - .04 + (fbm(x * .09, y * .09, 11) - .5) * .16;
    if (fbm(x * .05 + 4, y * .05, 6) > .6) v += .07; // 湿的地方
    if (hash(x * 7 + id, y * 3) > .99) v -= .22;
    if (id === 1 || id === 2) { const a = Math.hypot(bx - 15.5, by - 15.5), b = Math.hypot(bx - 18.5, by - 13); if (a < 8.4 && a > 6.4 && b > 6.8) v = .14 + (a < 7 ? .08 : 0); }
    p.ramp(x, y, MSTONE, v);
  }
  return p.done();
}
// 通用：把旧的 16 像素/米贴图函数按 2 倍分辨率重画（坐标缩小一半，抖动在新像素上做）
export function hd(fnName, ...args) { return HD[fnName](...args); }
const HD = {};
