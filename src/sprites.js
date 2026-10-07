// 像素素材：角色（含自动生成的法线贴图）、塔罗牌、小花等
export const mk = (w, h) => { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; };

// 角色调色板：月白发、深蓝斗篷、金色星饰
export const CHAR_PAL = {
  o: '#1c1633', h: '#e4def7', H: '#aa9fd8', f: '#f8e0d0', F: '#e9b9a9', e: '#2b2156', w: '#ffffff',
  b: '#f4a3b6', c: '#33408a', C: '#4b5fb6', d: '#232c66', g: '#e8c98e', y: '#fff3b8', s: '#3b2c4c', l: '#f1ecfb'
};

const FW = 16, FH = 24;
const pad = (rows) => {
  const out = rows.map(r => (r + '................').slice(0, FW));
  while (out.length < FH) out.unshift('................');
  return out;
};

// ---------- 正面 ----------
const FRONT_HEAD = [
  '................',
  '......oooo......',
  '....oohhhhoo..y.',
  '...ohhhhhhhhoyyy',
  '..ohhhhhhhhhhoy.',
  '..ohhhhhhhhhhho.',
  '.ohhhhhhhhhhhhho',
  '.ohhfhhhhhhhfhho',
  '.ohfffhhhhhfffho',
  '.ohfeefffffeefho',
  '.ohfewfffffewfho',
  '.oHbfffffffffbHo',
  '.oHHfffffFffffHo',
  '..oHHofffffoHHo.',
  '..ooggggyygggoo.',
];
const FRONT_BODY = {
  idle: [
    '...occcyycccco..',
    '..occcccccccccо.',
    '..ofcccccccccfo.',
    '..occcccccccccо.',
    '.occccccccccccо.',
    '.oggggggggggggo.',
    '...ool....loo...',
    '...oso....oso...',
  ],
  a: [
    '...occcyycccco..',
    '..occcccccccccо.',
    '..ofcccccccccfo.',
    '..occcccccccccо.',
    '.occccccccccccо.',
    '.oggggggggggggo.',
    '...ool....oo....',
    '...oso....oso...',
  ],
  b: [
    '...occcyycccco..',
    '..occcccccccccо.',
    '..ofcccccccccfo.',
    '..occcccccccccо.',
    '.occccccccccccо.',
    '.oggggggggggggo.',
    '....oo....loo...',
    '...oso....oso...',
  ]
};
// ---------- 背面 ----------
const BACK_HEAD = [
  '................',
  '......oooo......',
  '.y..oohhhhoo....',
  'yyyohhhhhhhhho..',
  '.yohhhhhhhhhhho.',
  '..ohhhhhhhhhhho.',
  '.ohhhhhhhhhhhhho',
  '.ohhhhhhhhhhhhho',
  '.ohhhhHhhhHhhhho',
  '.ohhhhHhhhHhhhho',
  '.oHhhhHhhhHhhhHo',
  '.oHHhhHhhhHhhHHo',
  '.oHHHhHhhhHhHHHo',
  '..oHHHHhhHHHHo..',
  '..oocccccccccoo.',
];
const BACK_BODY = {
  idle: [
    '...occcccccccco.',
    '..occccgycccccо.',
    '..occcyyyyccccо.',
    '..occccgycccccо.',
    '.occccccccccccо.',
    '.oggggggggggggo.',
    '...ool....loo...',
    '...oso....oso...',
  ],
  a: [
    '...occcccccccco.',
    '..occccgycccccо.',
    '..occcyyyyccccо.',
    '..occccgycccccо.',
    '.occccccccccccо.',
    '.oggggggggggggo.',
    '...ool....oo....',
    '...oso....oso...',
  ],
  b: [
    '...occcccccccco.',
    '..occccgycccccо.',
    '..occcyyyyccccо.',
    '..occccgycccccо.',
    '.occccccccccccо.',
    '.oggggggggggggo.',
    '....oo....loo...',
    '...oso....oso...',
  ]
};
// ---------- 侧面（朝右） ----------
const SIDE_HEAD = [
  '................',
  '.....oooo.......',
  '...oohhhhoo.....',
  '.yohhhhhhhhoo...',
  'yyyhhhhhhhhhho..',
  '.yhhhhhhhhhhhho.',
  'ohhhhhhhhhhhhho.',
  'ohhhhhhhhhfhhho.',
  'ohHhhhhhhffffho.',
  'ohHhhhhhfffeefo.',
  'oHHhhhhhfffewfo.',
  'oHHhhhhhffffbfo.',
  '.oHHhhhhffffffo.',
  '..oHHhhhoffffo..',
  '...ooggggggoo...',
];
const SIDE_BODY = {
  idle: [
    '...occcccccco...',
    '...occcccccccо..',
    '...occccccfccо..',
    '...occcccccccо..',
    '..occccccccccco.',
    '..oggggggggggggo',
    '.....oll.oo.....',
    '.....oso.oso....',
  ],
  a: [
    '...occcccccco...',
    '...occcccccccо..',
    '...occccccfccо..',
    '...occcccccccо..',
    '..occccccccccco.',
    '..oggggggggggggo',
    '....ol.....ll...',
    '...oso......oso.',
  ],
  b: [
    '...occcccccco...',
    '...occcccccccо..',
    '...occccccfccо..',
    '...occcccccccо..',
    '..occccccccccco.',
    '..oggggggggggggo',
    '......llol......',
    '......osoo......',
  ]
};

// 用拉丁 o 统一（上面有些行误用了西里尔 о，这里一并纠正）
const fix = rows => rows.map(r => r.replace(/о/g, 'o'));

function frames(head, body) {
  const f = k => pad(fix(head.concat(body[k])));
  return [f('idle'), f('a'), f('idle'), f('b')];
}
const SETS = { down: frames(FRONT_HEAD, FRONT_BODY), up: frames(BACK_HEAD, BACK_BODY), side: frames(SIDE_HEAD, SIDE_BODY) };

// 图集：行 = 方向(down, up, right, left)，列 = 4 帧
export function buildCharAtlas() {
  const cols = 4, rowsN = 4, W = FW * cols, H = FH * rowsN;
  const col = mk(W, H), g = col.getContext('2d');
  const put = (x, y, ch) => { const c = CHAR_PAL[ch]; if (!c) return; g.fillStyle = c; g.fillRect(x, y, 1, 1); };
  const order = [['down', false], ['up', false], ['side', false], ['side', true]];
  order.forEach(([k, flip], r) => {
    SETS[k].forEach((rows, fi) => {
      rows.forEach((row, y) => {
        for (let x = 0; x < FW; x++) {
          const ch = row[x]; if (ch === '.') continue;
          put(fi * FW + (flip ? FW - 1 - x : x), r * FH + y, ch);
        }
      });
    });
  });
  // 轻微的明暗：斗篷下半部和头发下缘稍暗（反照率里只放一点点，主要靠法线光照）
  const nrm = normalFromAlpha(col, FW, FH, { hair: CHAR_PAL.h });
  return { color: col, normal: nrm, fw: FW, fh: FH, cols, rows: rowsN };
}

// 由透明度生成"鼓起来"的高度场，再求法线：像素画也能被 3D 光照照亮
export function normalFromAlpha(src, cellW, cellH, opt = {}) {
  const W = src.width, H = src.height, g = src.getContext('2d');
  const d = g.getImageData(0, 0, W, H).data;
  const A = (x, y) => (x < 0 || y < 0 || x >= W || y >= H) ? 0 : d[(y * W + x) * 4 + 3] > 10 ? 1 : 0;
  // 到边缘的距离（只在单元格内算，避免帧之间串）
  const dist = new Float32Array(W * H);
  const R = 4;
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    if (!A(x, y)) continue;
    const cx0 = Math.floor(x / cellW) * cellW, cy0 = Math.floor(y / cellH) * cellH;
    let best = R;
    for (let dy = -R; dy <= R; dy++) for (let dx = -R; dx <= R; dx++) {
      const xx = x + dx, yy = y + dy;
      const inCell = xx >= cx0 && xx < cx0 + cellW && yy >= cy0 && yy < cy0 + cellH;
      if (!inCell || !A(xx, yy)) { const dd = Math.hypot(dx, dy); if (dd < best) best = dd; }
    }
    dist[y * W + x] = best;
  }
  const h = new Float32Array(W * H);
  for (let i = 0; i < W * H; i++) { const t = Math.min(dist[i], R) / R; h[i] = Math.sqrt(Math.max(0, 1 - (1 - t) * (1 - t))); }
  const out = mk(W, H), og = out.getContext('2d'), im = og.createImageData(W, H), o = im.data;
  const Hh = (x, y) => (x < 0 || y < 0 || x >= W || y >= H) ? 0 : h[y * W + x];
  const k = opt.strength || 2.2;
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const i = y * W + x;
    if (!A(x, y)) { o[i * 4] = 128; o[i * 4 + 1] = 128; o[i * 4 + 2] = 255; o[i * 4 + 3] = 255; continue; }
    const dx = (Hh(x + 1, y) - Hh(x - 1, y)) * .5, dyDown = (Hh(x, y + 1) - Hh(x, y - 1)) * .5;
    let nx = -dx * k, ny = dyDown * k, nz = 1;
    const L = Math.hypot(nx, ny, nz); nx /= L; ny /= L; nz /= L;
    o[i * 4] = (nx * .5 + .5) * 255; o[i * 4 + 1] = (ny * .5 + .5) * 255; o[i * 4 + 2] = (nz * .5 + .5) * 255; o[i * 4 + 3] = 255;
  }
  og.putImageData(im, 0, 0);
  return out;
}

// XVII 星 塔罗牌（像素画）
export function starCardCanvas() {
  const W = 24, H = 40, c = mk(W, H), g = c.getContext('2d');
  g.fillStyle = '#efe6d2'; g.fillRect(0, 0, W, H);
  g.fillStyle = '#c9a964'; g.fillRect(1, 1, W - 2, H - 2);
  g.fillStyle = '#1d2050'; g.fillRect(2, 2, W - 4, H - 4);
  // 夜空渐层
  const sky = ['#1d2050', '#252a66', '#2f3678', '#3b3f86', '#4c4790'];
  for (let y = 2; y < 30; y++) { g.fillStyle = sky[Math.min(4, (y - 2) / 6 | 0)]; g.fillRect(2, y, W - 4, 1); }
  // 大星
  const px = (x, y, col) => { g.fillStyle = col; g.fillRect(x, y, 1, 1); };
  const cx = 12, cy = 10;
  for (let k = -5; k <= 5; k++) { px(cx + k, cy, '#fff3b8'); px(cx, cy + k, '#fff3b8'); }
  for (let k = -2; k <= 2; k++) { px(cx + k, cy + k, '#e8c98e'); px(cx + k, cy - k, '#e8c98e'); }
  px(cx, cy, '#ffffff');
  // 七颗小星
  [[5, 5], [19, 5], [4, 13], [20, 14], [7, 19], [17, 20], [12, 3]].forEach(([x, y]) => { px(x, y, '#fff3b8'); px(x - 1, y, '#8f8cc8'); px(x + 1, y, '#8f8cc8'); px(x, y - 1, '#8f8cc8'); px(x, y + 1, '#8f8cc8'); });
  // 水面
  for (let y = 30; y < 36; y++) { g.fillStyle = y % 2 ? '#3d5fa8' : '#4a73bb'; g.fillRect(2, y, W - 4, 1); }
  // 跪着倒水的少女（极简剪影）
  g.fillStyle = '#e4def7'; g.fillRect(10, 24, 4, 3); g.fillRect(9, 27, 6, 3);
  g.fillStyle = '#f8e0d0'; g.fillRect(11, 22, 2, 2);
  g.fillStyle = '#e8c98e'; g.fillRect(7, 26, 2, 2); g.fillRect(15, 26, 2, 2);
  g.fillStyle = '#bfe3ff'; px(7, 28, '#bfe3ff'); px(6, 29, '#bfe3ff'); px(17, 28, '#bfe3ff'); px(18, 29, '#bfe3ff');
  // XVII
  g.fillStyle = '#e8c98e'; g.fillRect(2, 36, W - 4, 2);
  g.fillStyle = '#1d2050';
  [[9, 36], [9, 37], [11, 36], [11, 37], [13, 36], [13, 37], [15, 36], [15, 37]].forEach(([x, y]) => px(x, y, '#5a4630'));
  return c;
}
// 牌背
export function cardBackCanvas() {
  const W = 24, H = 40, c = mk(W, H), g = c.getContext('2d');
  g.fillStyle = '#c9a964'; g.fillRect(0, 0, W, H);
  g.fillStyle = '#2a2560'; g.fillRect(1, 1, W - 2, H - 2);
  g.fillStyle = '#e8c98e';
  for (let y = 3; y < H - 3; y += 4) for (let x = 3 + (y / 4 % 2) * 2; x < W - 3; x += 4) g.fillRect(x, y, 1, 1);
  g.fillRect(11, 14, 2, 12); g.fillRect(6, 19, 12, 2);
  return c;
}

// 小花（Billboard 用）
export function flowerCanvas(col, stem) {
  const c = mk(8, 8), g = c.getContext('2d');
  const px = (x, y, k) => { g.fillStyle = k; g.fillRect(x, y, 1, 1); };
  px(3, 5, stem); px(3, 6, stem); px(3, 7, stem); px(4, 6, stem);
  px(3, 2, col); px(2, 3, col); px(4, 3, col); px(3, 4, col); px(3, 3, '#fff6d8');
  return c;
}

// 光点：像素四芒星
export function orbCanvas() {
  const c = mk(9, 9), g = c.getContext('2d');
  const px = (x, y, k) => { g.fillStyle = k; g.fillRect(x, y, 1, 1); };
  for (let k = -4; k <= 4; k++) { const a = Math.abs(k); const col = a < 2 ? '#ffffff' : a < 3 ? '#fff3b8' : '#e8c98e'; px(4 + k, 4, col); px(4, 4 + k, col); }
  px(3, 3, '#fff3b8'); px(5, 3, '#fff3b8'); px(3, 5, '#fff3b8'); px(5, 5, '#fff3b8');
  return c;
}
// 柔光晕（像素化的径向渐变）
export function haloCanvas(n = 32) {
  const c = mk(n, n), g = c.getContext('2d'), im = g.createImageData(n, n), d = im.data;
  const B = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5];
  for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) {
    const r = Math.hypot(x + .5 - n / 2, y + .5 - n / 2) / (n / 2);
    let a = Math.max(0, 1 - r); a = a * a;
    a = Math.floor(a * 6 + B[(y & 3) * 4 + (x & 3)] / 16) / 6;
    const i = (y * n + x) * 4; d[i] = 255; d[i + 1] = 255; d[i + 2] = 255; d[i + 3] = a * 255;
  }
  g.putImageData(im, 0, 0); return c;
}
