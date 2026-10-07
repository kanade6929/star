// 主角「辰」：平面像素小人（32 像素 = 1 米，和场景贴图同密度），每帧程序化绘制。
// 设定：约 2.3 头身；银紫长发及腰 + 呆毛 + 左侧星形发夹；蓝色渐变大眼；
// 藏青水手连衣裙（白领、金色蝴蝶结、百褶裙摆）；藏青披风（紫色内衬、金边，背后金星徽）；白袜深色小皮鞋。
// 八个朝向：南、东南、东、东北、北 五个独立画面，西侧三向由东侧镜像（发夹位置按左右关系换边）。
// 每画一个部件同时写入颜色和法线（头是球、身体和四肢是圆柱、裙摆是带褶的圆锥），
// 所以动态光照到她身上时有体积；部件之间自动加接触阴影，形成结构线。
import { mk } from './sprites.js';

export const SW = 48, SH = 64; // 画布（像素）
const FOOT = 61;               // 鞋底所在行
const hex = h => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];
export const PAL = {
  out: '#1b1430',
  hair: '#e7e1fb', hairS: '#c6bdec', hairD: '#9f95d8', hairDD: '#7569b2', hairHi: '#ffffff',
  skin: '#ffeade', skinS: '#f5cbbd', skinD: '#e2a99e', blush: '#f7a1b6', mouth: '#b04d6b',
  lash: '#2a1b4e', irisD: '#2c308c', iris: '#4b63cd', irisL: '#88b6ff', irisLL: '#c6e2ff', eyeW: '#ffffff',
  dress: '#35418f', dressS: '#262f6c', dressD: '#1b2152', dressL: '#5164b8',
  collar: '#f6f3ff', collarS: '#cfc8ee', ribbon: '#f2d08c', ribbonS: '#c79e5e',
  cape: '#2a3170', capeS: '#1d2356', lining: '#8063c4', liningS: '#5f46a2', trim: '#eecb8b',
  sock: '#f4f1ff', sockS: '#c9c3e7', shoe: '#3c2c52', shoeS: '#261b37', pin: '#ffe9a0', pinD: '#e0b860'
};
const C = Object.fromEntries(Object.entries(PAL).map(([k, v]) => [k, hex(v)]));

/* ---------- 法线工具 ---------- */
const nz = (x, y, z) => { const l = Math.hypot(x, y, z) || 1; return [x / l, y / l, z / l]; };
const FLAT = [0, 0, 1];
// 椭球：头、发团、袖子
const sph = (cx, cy, rx, ry, k = 1) => (x, y) => { const u = (x + .5 - cx) / rx, v = (y + .5 - cy) / ry, d = Math.min(.9, u * u + v * v); return nz(u * k, -v * k, Math.sqrt(1 - d)); };
// 按当前行的左右边界当圆柱：身体、裙子、四肢、披风；ny 让面朝上一点（肩、裙摆）
const cyl = (k = 1, ny = 0, ripple = 0) => (x, y, xl, xr) => {
  const c = (xl + xr) / 2, hw = Math.max(1, (xr - xl + 1) / 2);
  let u = Math.max(-.92, Math.min(.92, (x + .5 - c) / hw));
  const r = ripple ? Math.sin(x * ripple) * .28 : 0;
  return nz(u * k + r, ny, Math.sqrt(1 - u * u));
};

// 二维阻尼弹簧：头发、披风、呆毛的摆动
class Spring2 {
  constructor(k, d) { this.k = k; this.d = d; this.x = 0; this.y = 0; this.vx = 0; this.vy = 0; }
  step(dt, tx, ty) {
    this.vx += ((tx - this.x) * this.k - this.vx * this.d) * dt; this.vy += ((ty - this.y) * this.k - this.vy * this.d) * dt;
    this.x += this.vx * dt; this.y += this.vy * dt; return this;
  }
}

const EYE = ['LLLLLL', 'DWWDD.', 'DWMMD.', 'MMMMM.', 'BBCBB.', '.CCCL.']; // 内眼角 → 外眼角，最后一列是外侧睫毛
const EYEC = { L: 'lash', D: 'irisD', W: 'eyeW', M: 'iris', B: 'irisL', C: 'irisLL' };

export class SpriteChar {
  constructor() {
    this.canvas = mk(SW, SH); this.normal = mk(SW, SH);
    this.g = this.canvas.getContext('2d'); this.ng = this.normal.getContext('2d');
    this.img = this.g.createImageData(SW, SH); this.nimg = this.ng.createImageData(SW, SH);
    this.col = new Uint8ClampedArray(SW * SH * 4); this.nrm = new Float32Array(SW * SH * 3); this.part = new Uint8Array(SW * SH);
    this.dir8 = 0; this.lastDir = 'down'; this.flip = false; this.pid = 0;
    this.phase = 0; this.t = 0; this.blinkT = 2.5; this.pv = [0, 0];
    this.hairS = new Spring2(55, 7); this.capeS = new Spring2(40, 6); this.lockS = new Spring2(90, 8); this.ahS = new Spring2(160, 6);
  }

  /* ---------- 画像素 ---------- */
  clear() { this.col.fill(0); this.part.fill(0); for (let i = 0; i < SW * SH; i++) { this.nrm[i * 3] = 0; this.nrm[i * 3 + 1] = 0; this.nrm[i * 3 + 2] = 1; } }
  // n: 法线（null = 保留底下的法线，比如眼睛、嘴这种画在脸上的细节）
  px(x, y, c, n) {
    x = Math.floor(x); y = Math.floor(y);
    if (this.flip) x = SW - 1 - x;
    if (x < 0 || y < 0 || x >= SW || y >= SH) return;
    const i = y * SW + x, d = this.col;
    d[i * 4] = c[0]; d[i * 4 + 1] = c[1]; d[i * 4 + 2] = c[2]; d[i * 4 + 3] = 255;
    if (n) { this.nrm[i * 3] = this.flip ? -n[0] : n[0]; this.nrm[i * 3 + 1] = n[1]; this.nrm[i * 3 + 2] = n[2]; this.part[i] = this.pid; }
  }
  // 按行填充多边形；col / nf 可以是函数 (x, y, xl, xr)
  poly(pts, col, nf, keep) {
    let y0 = 1e9, y1 = -1e9; pts.forEach(p => { y0 = Math.min(y0, p[1]); y1 = Math.max(y1, p[1]); });
    for (let y = Math.floor(y0); y <= Math.ceil(y1); y++) {
      const yc = y + .5, xs = [];
      for (let i = 0; i < pts.length; i++) { const a = pts[i], b = pts[(i + 1) % pts.length]; if ((a[1] <= yc && b[1] > yc) || (b[1] <= yc && a[1] > yc)) xs.push(a[0] + (yc - a[1]) / (b[1] - a[1]) * (b[0] - a[0])); }
      xs.sort((a, b) => a - b);
      for (let k = 0; k + 1 < xs.length; k += 2) {
        const xl = Math.ceil(xs[k] - .5), xr = Math.floor(xs[k + 1] - .5);
        for (let x = xl; x <= xr; x++) if (!keep || keep(x, y)) this.px(x, y, typeof col === 'function' ? col(x, y, xl, xr) : col, nf ? nf(x, y, xl, xr) : FLAT);
      }
    }
  }
  ell(cx, cy, rx, ry, col, nf, keep) {
    for (let y = Math.floor(cy - ry); y <= Math.ceil(cy + ry); y++) {
      const v = (y + .5 - cy) / ry; if (Math.abs(v) > 1) continue;
      const w = rx * Math.sqrt(1 - v * v), xl = Math.ceil(cx - w - .5), xr = Math.floor(cx + w - .5);
      for (let x = xl; x <= xr; x++) if (!keep || keep(x, y)) this.px(x, y, typeof col === 'function' ? col(x, y, xl, xr) : col, nf ? nf(x, y, xl, xr) : sph(cx, cy, rx, ry)(x, y));
    }
  }
  rect(x0, y0, w, h, col, nf) { this.poly([[x0, y0], [x0 + w, y0], [x0 + w, y0 + h], [x0, y0 + h]], col, nf || cyl(.8)); }
  // 管子（四肢、发束、呆毛）：法线垂直于走向
  stroke(pts, w0, w1, col) {
    const L = pts.length - 1;
    for (let i = 0; i < L; i++) {
      const a = pts[i], b = pts[i + 1], n = Math.max(1, Math.ceil(Math.hypot(b[0] - a[0], b[1] - a[1]) * 3));
      for (let k = 0; k <= n; k++) {
        const f = (i + k / n) / L, x = a[0] + (b[0] - a[0]) * k / n, y = a[1] + (b[1] - a[1]) * k / n, r = (w0 + (w1 - w0) * f) / 2;
        for (let yy = Math.floor(y - r); yy <= Math.ceil(y + r); yy++) for (let xx = Math.floor(x - r); xx <= Math.ceil(x + r); xx++) {
          const dx = (xx + .5 - x) / r, dy = (yy + .5 - y) / r, d = dx * dx + dy * dy;
          if (d <= 1.05) this.px(xx, yy, typeof col === 'function' ? col(f, d) : col, nz(dx * .8, -dy * .8, Math.sqrt(Math.max(.1, 1 - d))));
        }
      }
    }
  }
  // 部件分组：后画的部件压在前面的部件上时，在交界下方加一圈接触阴影
  P() { this.pid++; }

  /* ---------- 后处理：接触阴影 + 外轮廓 ---------- */
  finish() {
    const d = this.col, pr = this.part, W = SW, H = SH;
    const dark = new Float32Array(W * H).fill(1);
    for (let y = 1; y < H; y++) for (let x = 0; x < W; x++) {
      const i = y * W + x; if (!d[i * 4 + 3]) continue;
      const up = i - W, l = x > 0 ? i - 1 : -1, r = x < W - 1 ? i + 1 : -1;
      if (d[up * 4 + 3] && pr[up] > pr[i]) dark[i] = .8;
      else if ((l >= 0 && d[l * 4 + 3] && pr[l] > pr[i] + 0) || (r >= 0 && d[r * 4 + 3] && pr[r] > pr[i])) dark[i] = Math.min(dark[i], .88);
    }
    for (let i = 0; i < W * H; i++) if (dark[i] < 1) { d[i * 4] *= dark[i]; d[i * 4 + 1] *= dark[i] * .97; d[i * 4 + 2] *= Math.min(1, dark[i] * 1.06); }
    // 外轮廓：用相邻像素颜色压暗（不是纯黑），和场景的描边一致
    const add = [];
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      const i = y * W + x; if (d[i * 4 + 3]) continue;
      let src = -1;
      for (const [dx, dy] of [[0, -1], [-1, 0], [1, 0], [0, 1]]) { const xx = x + dx, yy = y + dy; if (xx >= 0 && yy >= 0 && xx < W && yy < H && d[(yy * W + xx) * 4 + 3] && !this._isOut?.[yy * W + xx]) { src = yy * W + xx; break; } }
      if (src >= 0) add.push([i, src, x - (src % W), y - Math.floor(src / W)]);
    }
    const o = C.out;
    add.forEach(([i, s, dx, dy]) => {
      d[i * 4] = o[0] * .7 + d[s * 4] * .18; d[i * 4 + 1] = o[1] * .7 + d[s * 4 + 1] * .18; d[i * 4 + 2] = o[2] * .7 + d[s * 4 + 2] * .2; d[i * 4 + 3] = 255;
      const n = nz(dx * .9, -dy * .9, .45); this.nrm[i * 3] = n[0]; this.nrm[i * 3 + 1] = n[1]; this.nrm[i * 3 + 2] = n[2];
    });
    this.img.data.set(d); this.g.putImageData(this.img, 0, 0);
    const nd = this.nimg.data, nr = this.nrm;
    for (let i = 0; i < W * H; i++) { nd[i * 4] = (nr[i * 3] * .5 + .5) * 255; nd[i * 4 + 1] = (nr[i * 3 + 1] * .5 + .5) * 255; nd[i * 4 + 2] = (nr[i * 3 + 2] * .5 + .5) * 255; nd[i * 4 + 3] = 255; }
    this.ng.putImageData(this.nimg, 0, 0);
  }

  /* ---------- 每帧更新 ---------- */
  // st: { dir, moving, run(0..1), vx, vz(米/秒), dt, lie, crouch(旧像素 0..7), act('rub'|'look'), actT }
  update(st) {
    const dt = Math.min(st.dt || 1 / 60, 1 / 30); this.t += dt;
    const sp = Math.hypot(st.vx, st.vz);
    // 朝向：走动时按速度分八个方向（带一点回滞，斜着走不会来回跳）；停下保持最后的朝向
    if (st.moving && sp > .3) {
      const a = Math.atan2(st.vx, st.vz) / (Math.PI / 4), cur = this.dir8 > 4 ? this.dir8 - 8 : this.dir8;
      let da = a - cur; while (da > 4) da -= 8; while (da < -4) da += 8;
      if (Math.abs(da) > .62) this.dir8 = ((Math.round(a) % 8) + 8) % 8;
    } else if (st.dir !== this.lastDir) this.dir8 = { down: 0, right: 2, up: 4, left: 6 }[st.dir] ?? this.dir8;
    this.lastDir = st.dir;
    const run = st.run || 0, moving = st.moving && sp > .2;
    this.phase = moving ? this.phase + dt * (8.5 + run * 5) : 0;
    // 屏幕速度（像素/秒）驱动头发、披风
    const vx = st.vx * 32, vy = st.vz * 32 * .85;
    const ax = (vx - this.pv[0]) / dt, ay = (vy - this.pv[1]) / dt; this.pv = [vx, vy];
    const idle = Math.sin(this.t * 1.6);
    this.hairS.step(dt, Math.max(-5, Math.min(5, -vx * .05 - ax * .002)) + idle * .3, Math.max(-3, Math.min(2, -Math.abs(vy) * .03)));
    this.capeS.step(dt, Math.max(-7, Math.min(7, -vx * .07 - ax * .003)) + idle * .4, Math.max(-4, Math.min(1, -sp * 1.1)));
    this.lockS.step(dt, Math.max(-2.5, Math.min(2.5, -vx * .03)) + Math.sin(this.t * 2.3) * .25, 0);
    this.ahS.step(dt, Math.max(-3, Math.min(3, -vx * .04)) + Math.sin(this.t * 3) * .4, moving ? Math.abs(Math.cos(this.phase)) * 1.5 : 0);
    this.blinkT -= dt; if (this.blinkT < -.13) this.blinkT = 2.2 + Math.random() * 3;
    this.clear(); this.pid = 0;
    if (st.lie) this.drawLie();
    else this.draw(st, moving, run);
    this.flip = false; this.finish();
  }

  /* ---------- 站立 / 行走 / 坐 ---------- */
  draw(st, moving, run) {
    const d8 = this.dir8, view = d8 <= 4 ? d8 : 8 - d8, flipB = d8 > 4;
    const sx = [0, .71, 1, .71, 0][view], front = [1, .71, 0, -.71, -1][view];
    const s = Math.sin(this.phase), c = Math.cos(this.phase);
    const cr = Math.round((st.crouch || 0) * 2);               // 坐下时身体下沉（像素）
    const sit = cr >= 8;
    const bob = moving ? -Math.round(Math.abs(s) * (1 + run * .8)) : (!sit && Math.sin(this.t * 2.1) > .7 ? 1 : 0);
    const by = bob + cr;
    const bx = 24, T0 = 29 + by, waist = 38 + by, hem = Math.min(FOOT - 1, 50 + by);
    const hw = view === 2 ? 4.5 : view === 0 || view === 4 ? 6 : 5.5;
    const lean = moving ? Math.round(sx * (run > .5 ? 1.5 : .5)) : 0;
    this._lean = lean;
    const hc = 24 + lean, hcy = 16 + by + (st.act === 'rub' ? 1 : 0);
    const H = this.hairS, Cp = this.capeS;
    this.flip = flipB;

    // —— 1. 身后的长发（正面、侧面时在身体后面）
    if (front >= 0) { this.P(); this.backHair(view, hc, hcy, H, false); }
    // —— 2. 身后的披风（正面时只露出两侧的紫色内衬）
    if (front >= 0) { this.P(); this.capeBehind(view, bx, T0, hw, Cp); }
    // —— 3. 远侧手臂（侧面、斜向时在身体后面）
    const armSw = moving ? s * (1.6 + run * 1.4) : 0;
    if (view !== 0 && view !== 4 && !sit) { this.P(); this.arm(view, bx, T0, hw, -1, -armSw, true, st); }
    // —— 4. 腿和鞋
    this.P(); this.legs(view, bx, hem, s, c, moving, run, sit, cr);
    // —— 5. 身体：上衣 + 百褶裙
    this.P(); this.body(view, bx, T0, waist, hem, hw, sit, cr);
    // —— 6. 披风（背面、斜背面盖住身体）
    if (front < 0) { this.P(); this.capeBack(view, bx, T0, hw, Cp); }
    // —— 7. 脖子、领子、蝴蝶结
    if (view <= 2) { this.P(); const nx = 24 + lean + [0, .71, 1][view] * 3; this.rect(Math.round(nx - 2), hcy + 9, 4, T0 - hcy - 7, C.skinS, cyl(.7)); }
    this.P(); this.collar(view, bx, T0, hw);
    // —— 8. 近侧手臂
    if (!sit || st.act !== 'rub') { this.P(); if (view === 0 || view === 4) { this.arm(view, bx, T0, hw, -1, armSw, false, st, sit); this.P(); this.arm(view, bx, T0, hw, 1, -armSw, false, st, sit); } else this.arm(view, bx, T0, hw, 1, armSw, false, st, sit); }
    // —— 9. 背面的长发盖在披风上
    if (front < 0) { this.P(); this.backHair(view, hc, hcy, H, true); }
    // —— 10. 头（看向左右时头可以单独转）
    let hView = view, hFlip = flipB;
    if (st.act === 'look') { const t = st.actT || 0, lk = t < .8 ? -1 : t < 1.7 ? 1 : 0; if (lk) { hView = 1; hFlip = lk < 0; } }
    this.flip = hFlip;
    this.P(); this.head(hView, hc, hcy, st, moving, run);
    // 星形发夹别在她的左侧：按真实朝向算左边在画面哪里（朝东时在头的另一侧，看不到）
    const hd8 = hFlip ? 8 - hView : hView, a = hd8 * Math.PI / 4, lx = Math.cos(a), lz = -Math.sin(a);
    if (lz > -.8) { this.flip = false; const hs = hFlip ? SW - hc : hc; this.P(); this.starPin(hs + lx * 7 + (hd8 === 6 ? 1 : 0), hcy - 6 - (lz < 0 ? 1.5 : 0)); }
    this.flip = flipB;
    // —— 11. 揉眼睛的手画在脸前
    if (st.act === 'rub') { this.P(); this.rubArm(bx, T0, hc, hcy, st.actT || 0); }
  }

  backHair(view, hc, hcy, H, over) {
    const hx = H.x, hy = H.y, bot = 41 + hcy - 16;
    const strands = (x, y) => { const k = ((x * 7 + 3) % 5 + 5) % 5; return k === 0 ? C.hairD : k === 2 ? C.hairS : C.hair; };
    const nf = cyl(.75, -.1);
    if (view === 0 || view === 1) {
      const o = view === 1 ? -1.5 : 0;
      this.poly([[hc - 10.5 + o, hcy], [hc + 10.5 + o, hcy], [hc + 10 + o + hx, bot + hy], [hc + 6 + o + hx, bot + 1.5 + hy], [hc + 1 + o + hx, bot + .5 + hy], [hc - 4 + o + hx, bot + 2 + hy], [hc - 10 + o + hx, bot + hy]], (x, y) => y > bot - 3 + hy ? C.hairD : C.hairS, nf);
    } else if (view === 2) {
      this.poly([[hc - 10.5, hcy - 3], [hc - 1, hcy + 5], [hc - 2 + hx * .6, bot - 2 + hy], [hc - 5 + hx, bot + 1.5 + hy], [hc - 9 + hx, bot + hy], [hc - 12 + hx * 1.2, bot - 4 + hy]], (x, y) => y > bot - 3 + hy ? C.hairD : strands(x, y), nf);
    } else {
      // 背面：长发盖住披风上半，发尾分成几缕
      // 背面：长发垂到背中间，下端收窄成几缕，下面露出披风和星徽
      const o = view === 3 ? -2 : 0, b2 = bot - 4;
      const pts = [[hc - 10.5 + o, hcy], [hc + 10.5 + o, hcy], [hc + 10 + o + hx * .5, hcy + 12]];
      const tips = [[8.5, -1], [6.5, 1.5], [3.5, -.5], [.5, 2.5], [-2.5, -.2], [-5.5, 1.8], [-8.5, -.8]];
      tips.forEach(([dx, dy]) => pts.push([hc + o + dx + hx * (1 + Math.abs(dx) * .03), b2 + dy + hy]));
      pts.push([hc - 10 + o + hx * .5, hcy + 12]);
      this.poly(pts, (x, y) => y > b2 - 1 + hy ? C.hairS : strands(x, y), nf);
      // 发丝高光
      for (let y = hcy + 9; y < bot - 6; y += 1) { const x = hc + o - 3 + Math.round(Math.sin(y * .5) * .5 + hx * (y - hcy) / 30); this.px(x, y, C.hairHi, null); }
    }
  }

  capeBehind(view, bx, T0, hw, Cp) {
    const bot = Math.min(FOOT - 1, 53 + T0 - 29) + Cp.y, cx = Cp.x;
    if (view === 2) {
      const pts = [[bx - 1, T0], [bx - hw - 1.5, T0 + 1], [bx - hw - 6 + cx, bot], [bx + 1 + cx * .4, bot + 1]];
      this.poly(pts, (x, y, xl, xr) => y >= bot - .5 ? C.trim : x > xr - 2 ? C.lining : (x + y) % 6 === 0 ? C.capeS : C.cape, cyl(.8, 0, .9));
    } else {
      const o = view === 1 ? -1.5 : 0;
      this.poly([[bx - hw - 1 + o, T0 + 1], [bx + hw + 1 + o, T0 + 1], [bx + 12 + o + cx, bot], [bx - 12 + o + cx, bot]], (x, y) => y >= bot - .5 ? C.trim : y > bot - 4 ? C.liningS : C.lining, cyl(.8));
    }
  }

  capeBack(view, bx, T0, hw, Cp) {
    const bot = Math.min(FOOT - 1, 53 + T0 - 29) + Cp.y, cx = Cp.x, o = view === 3 ? -2.5 : 0;
    const fold = (x) => ((Math.round(x - bx) % 4) + 4) % 4 === 0;
    this.poly([[bx - hw - 1.5 + o, T0], [bx + hw + 1.5 + o, T0], [bx + 12.5 + o + cx, bot], [bx - 12.5 + o + cx, bot]],
      (x, y) => y >= bot - .5 ? C.trim : (fold(x - cx * (y - T0) / 24) && y > T0 + 4 ? C.capeS : C.cape), cyl(.8, 0, .8));
    // 背后的金色星徽（八芒星的简化）
    const sx0 = bx + o + Math.round(cx * .5), sy0 = T0 + 13;
    [[0, -3], [0, -2], [0, -1], [0, 0], [0, 1], [0, 2], [0, 3], [-3, 0], [-2, 0], [-1, 0], [1, 0], [2, 0], [3, 0], [-1, -1], [1, -1], [-1, 1], [1, 1]].forEach(([dx, dy]) => this.px(sx0 + dx, sy0 + dy, Math.abs(dx) + Math.abs(dy) <= 1 ? C.pin : C.trim, null));
  }

  legs(view, bx, hem, s, c, moving, run, sit, cr) {
    if (sit) {
      // 坐在地上：鞋从裙摆两侧露出来
      this.rect(bx - 12, FOOT - 2, 5, 3, C.shoe, cyl(.6, .3)); this.rect(bx + 8, FOOT - 2, 5, 3, C.shoe, cyl(.6, .3));
      this.rect(bx - 8, FOOT - 2, 3, 2, C.sock); this.rect(bx + 6, FOOT - 2, 3, 2, C.sock);
      return;
    }
    const A = moving ? 2 + run * 1.5 : 0;
    const top = hem - 2;
    const leg = (x, lift, shade, toe) => {
      const yb = FOOT - lift;
      this.rect(x, top, 3, Math.max(1, yb - 2 - top), (xx, yy) => yy === yb - 3 ? C.sockS : shade ? C.sockS : C.sock, cyl(.85));
      this.rect(x - (toe < 0 ? 1 : 0), yb - 2, toe ? 4 : 3, 2, (xx, yy) => yy === yb - 1 ? C.shoeS : shade ? C.shoeS : C.shoe, cyl(.7, .2));
      this.px(x + (toe > 0 ? 3 : -1), yb - 1, shade ? C.shoeS : C.shoe, nz(toe || .5, 0, .8));
    };
    if (view === 0 || view === 4) {
      const lL = Math.round(Math.max(0, s) * A), lR = Math.round(Math.max(0, -s) * A);
      leg(bx - 5, lL, view === 4, -1); this.P(); leg(bx + 2, lR, view === 4, 1);
    } else if (view === 2) {
      const st = moving ? s * (3 + run * 1.5) : 0, lf = Math.round(Math.max(0, c) * (1 + run)), lb = Math.round(Math.max(0, -c) * (1 + run));
      leg(Math.round(bx - 2 - st), lb, true, 1); this.P(); leg(Math.round(bx - 1 + st), lf, false, 1);
    } else {
      // 斜向：近侧腿在右，远侧在左；步子同时有前后和抬脚
      const st = moving ? s * (2 + run) : 0, lN = Math.round(Math.max(0, -s) * A * .7), lF = Math.round(Math.max(0, s) * A * .7);
      const back = view === 3;
      leg(Math.round(bx - 4 - st * .6), lF, true, back ? -1 : 1); this.P(); leg(Math.round(bx + 1 + st * .6), lN, back, back ? -1 : 1);
    }
  }

  body(view, bx, T0, waist, hem, hw, sit, cr) {
    const o = view === 1 ? .5 : view === 3 ? -.5 : 0;
    // 上衣
    this.poly([[bx - hw + o, T0 + 1], [bx - hw + 1 + o, T0], [bx + hw - 1 + o, T0], [bx + hw + o, T0 + 1], [bx + hw - .5 + o, waist], [bx - hw + .5 + o, waist]],
      (x, y, xl, xr) => (view === 4 || view === 3) ? C.dressS : C.dress, cyl(.9, .05));
    // 百褶裙：每片褶的法线朝向不同，光扫过时一明一暗
    const spread = sit ? Math.min(6, cr * .5) : 0, sk = (view === 2 ? 8.5 : 10.5) + spread, hemY = sit ? FOOT : hem;
    const skirtN = (x, y, xl, xr) => {
      const base = cyl(.9, .25)(x, y, xl, xr), panel = Math.floor((x - xl) / Math.max(2.5, (xr - xl + 1) / 6));
      return nz(base[0] + (panel % 2 ? .3 : -.3), base[1], base[2]);
    };
    const skirtC = (x, y, xl, xr) => {
      if (y >= hemY - 1.5) return C.trim;
      const w = xr - xl + 1, f = (x - xl) / Math.max(1, w), k = Math.floor(f * 6), e = f * 6 - k;
      if (e < 1 / w * 6 * .9 && k > 0) return C.dressD; // 褶线
      if (y <= waist + .5) return C.dressS;          // 腰线
      return (view === 4 || view === 3) ? (k % 2 ? C.dressS : C.dress) : (k % 2 ? C.dress : C.dressL);
    };
    this.poly([[bx - hw + .5 + o, waist], [bx + hw - .5 + o, waist], [bx + sk + o, hemY], [bx - sk + o, hemY]], skirtC, skirtN);
  }

  collar(view, bx, T0, hw) {
    const nf = cyl(.8, .35);
    if (view === 0 || view === 1) {
      const o = view === 1 ? 1.5 : 0;
      this.poly([[bx - hw - .5 + o * .3, T0 + .5], [bx + hw + .5 + o * .3, T0 + .5], [bx + hw - 1 + o, T0 + 3], [bx + o, T0 + 7.5], [bx - hw + 1 + o, T0 + 3]], (x, y) => y >= T0 + 2.5 && Math.abs(x + .5 - bx - o) > 1.5 ? C.collarS : C.collar, nf);
      this.poly([[bx - 2.5 + o, T0 + .5], [bx + 2.5 + o, T0 + .5], [bx + o, T0 + 5]], C.skinS, nf);   // 领口露出的脖子
      const rx = Math.round(bx + o), ry = T0 + 6;
      [[-3, 0], [-2, 0], [2, 0], [3, 0], [-3, 1], [3, 1], [-1, 2], [1, 2]].forEach(([dx, dy]) => this.px(rx + dx, ry + dy, C.ribbon, null));
      [[-1, 0], [1, 0], [-2, 1], [2, 1]].forEach(([dx, dy]) => this.px(rx + dx, ry + dy, C.ribbonS, null));
      this.px(rx, ry, C.pinD, null); this.px(rx, ry + 1, C.ribbonS, null);
    } else if (view === 2) {
      // 侧面：水手领的方形后片搭在肩后，蝴蝶结在胸前
      this.poly([[bx - hw - .5, T0 + .5], [bx + 1, T0 + .5], [bx, T0 + 4.5], [bx - hw - .5, T0 + 5]], (x, y) => y >= T0 + 4 ? C.collarS : C.collar, nf);
      this.px(bx + hw - 1, T0 + 4, C.ribbon, null); this.px(bx + hw, T0 + 4, C.ribbon, null); this.px(bx + hw - 1, T0 + 5, C.ribbonS, null);
    } else {
      // 背面：方形后领盖在披风上，下沿一道金线
      const o = view === 3 ? -1 : 0;
      this.poly([[bx - hw - .5 + o, T0], [bx + hw + .5 + o, T0], [bx + hw + o, T0 + 5.5], [bx - hw + o, T0 + 5.5]], (x, y) => y >= T0 + 4.5 ? C.trim : y >= T0 + 3.5 ? C.collarS : C.collar, nf);
    }
  }

  // side: -1 屏幕左 / +1 屏幕右；sw: 前后摆动量
  arm(view, bx, T0, hw, side, sw, far, st, sit) {
    const sleeveC = far ? C.dressS : C.dressL, skinC = far ? C.skinS : C.skin;
    if (view === 0 || view === 4) {
      const x = bx + side * (hw + 1.2), dy = Math.round(sw * 1.1);
      this.ell(x, T0 + 3, 2.4, 2.8, view === 4 ? C.dress : sleeveC);
      const hx = x + side * (sit ? 1.5 : .3 + Math.abs(sw) * .25), hy = T0 + 10 + (sit ? 4 : dy);
      this.stroke([[x, T0 + 5], [hx, hy - 1]], 2.4, 2.1, skinC);
      this.ell(hx, hy, 1.6, 1.5, skinC);
    } else if (view === 2) {
      // 侧面：手臂前后摆，远侧那只只在摆到身前时露出来
      const sx0 = bx - (far ? -1 : 0), e = sw * .55, h = sw;
      this.stroke([[sx0, T0 + 4], [sx0 + e, T0 + 7], [sx0 + h, T0 + 10]], 2.5, 2.1, (f) => f < .35 ? (far ? C.dressS : C.dressL) : skinC);
      this.ell(sx0, T0 + 3, 2.5, 2.6, far ? C.dressS : C.dressL);
      this.ell(sx0 + h, T0 + 10.5, 1.5, 1.4, skinC);
    } else {
      // 斜向：近侧手臂在右，远侧在左后方
      const x = far ? bx - hw - .5 : bx + hw + .5, e = sw * .5;
      this.ell(x, T0 + 3, 2.3, 2.6, view === 3 ? C.dress : sleeveC);
      if (view === 1 || !far) {
        this.stroke([[x, T0 + 5], [x + e, T0 + 9.5]], 2.3, 2, skinC);
        this.ell(x + e, T0 + 10.3, 1.5, 1.4, skinC);
      }
    }
  }

  rubArm(bx, T0, hc, hcy, t) {
    const side = t % 1.3 < .65 ? -1 : 1, ex = hc + side * 4.5, hx = ex + Math.round(Math.sin(t * 14)), hy = hcy + 6 + Math.round(Math.cos(t * 14) * .6);
    const sx0 = bx + side * 7;
    this.ell(sx0, T0 + 3, 2.4, 2.8, C.dressL);
    this.stroke([[sx0, T0 + 5], [sx0 + side * 1.5, T0 + 1], [hx, hy + 2]], 2.4, 2.2, C.skin);
    this.ell(hx, hy + 1, 2, 1.8, C.skin);
  }

  /* ---------- 头 ---------- */
  head(view, hc, hcy, st, moving, run) {
    const sx = [0, .71, 1, .71, 0][view];
    const headN = sph(hc, hcy + 1, 12.5, 12, .95);
    // 后脑发团
    const gx = hc - sx * 1.2, gy = hcy - .5, grx = 11 - sx * .6, gry = 10.5;
    const hairCol = (x, y) => {
      const u = (x + .5 - gx) / grx, v = (y + .5 - gy) / gry, r = Math.hypot(u, v * 1.05);
      if (Math.abs(r - .6) < .07 && v < -.25 && Math.abs(u) < .62 && ((x + y) % 5 !== 0)) return C.hairHi; // 天使环
      if (v > .55) return C.hairS;
      if (u * (view >= 3 ? 1 : -1) > .72) return C.hairS;
      return C.hair;
    };
    this.ell(gx, gy, grx, gry, hairCol, headN);
    // 发旋处的几道发丝（背面）
    if (view >= 3) { for (let k = -2; k <= 2; k++) this.px(gx + k * 3 + (view === 3 ? -1 : 0), gy - 6 + Math.abs(k), C.hairS, null); }
    // 脸
    if (view <= 2) {
      const fcx = hc + sx * 3.4, fcy = hcy + 3.3, frx = 8.6 - sx * 2.4, fry = 7.6;
      this.P();
      this.ell(fcx, fcy, frx, fry, (x, y) => (y + .5 > fcy + fry - 1.2 ? C.skinS : C.skin), headN);
      // 刘海：参差的发尖，两侧鬓角更长；侧面时后半边被头发盖住
      const edge = x => {
        const u = (x + .5 - fcx) / frx, side = Math.max(0, Math.abs(u) - .7) * 16;
        const f = ((x + .5 - fcx) / 3.1 + 10.5) % 1, tip = (1 - Math.abs(2 * f - 1)) * 2.4;
        return hcy + 1.8 + side + tip;
      };
      const backLim = view === 2 ? fcx - 1.5 : view === 1 ? fcx - frx + 1.2 : -99;
      this.P();
      for (let y = Math.floor(fcy - fry); y <= Math.ceil(fcy + fry); y++) for (let x = Math.floor(fcx - frx - 1); x <= Math.ceil(fcx + frx + 1); x++) {
        const u = (x + .5 - fcx) / frx, v = (y + .5 - fcy) / fry; if (u * u + v * v > 1) continue;
        const e = edge(x);
        if (y + .5 <= e || x + .5 < backLim) this.px(x, y, (y + .5 > e - 1.1 && x + .5 >= backLim) ? C.hairS : C.hair, headN(x, y));
        else if (y + .5 <= e + 1) this.px(x, y, C.skinS, null); // 刘海下的阴影
      }
      this.face(view, fcx, fcy, frx, hcy, st, moving, run);
      // 鬓发（脸两侧垂下的两缕）
      const L = this.lockS.x;
      this.P();
      if (view === 0) {
        this.stroke([[fcx - frx + .8, hcy + 1], [fcx - frx - .2 + L * .5, hcy + 10], [fcx - frx + .6 + L, hcy + 15]], 3.4, 1.6, f => f > .8 ? C.hairS : C.hair);
        this.stroke([[fcx + frx - .8, hcy + 1], [fcx + frx + .2 + L * .5, hcy + 10], [fcx + frx - .6 + L, hcy + 15]], 3.4, 1.6, f => f > .8 ? C.hairS : C.hair);
      } else if (view === 1) {
        this.stroke([[fcx + frx - .6, hcy + 1], [fcx + frx + .4 + L * .5, hcy + 10], [fcx + frx - .3 + L, hcy + 15]], 3.2, 1.5, f => f > .8 ? C.hairS : C.hair);
      } else {
        this.stroke([[fcx - 2, hcy + 2], [fcx - 2.5 + L * .5, hcy + 10], [fcx - 2 + L, hcy + 14.5]], 3.2, 1.5, f => f > .8 ? C.hairS : C.hair);
      }
    } else if (view === 3) {
      // 斜背面：只露出一点脸颊和耳朵
      this.P(); this.ell(gx + 9.6, gy + 7.5, 1.2, 2, C.skinS, headN);
    }
    // 呆毛
    this.P();
    const A = this.ahS;
    this.stroke([[hc + 1, hcy - 9.5], [hc + 1.5 + A.x * .5, hcy - 13 + A.y * .5], [hc + 4 + A.x, hcy - 14.5 + A.y], [hc + 5.5 + A.x * 1.2, hcy - 13.5 + A.y]], 2.2, 1.2, C.hair);
  }

  face(view, fcx, fcy, frx, hcy, st, moving, run) {
    const shut = this.blinkT < 0 || st.act === 'rub';
    const ey = hcy + 3;
    const eye = (cx, outer, w) => {
      // outer: 外眼角在哪一侧（+1 右 / -1 左）；w: 5 正常，4 侧过去的那只
      const cols = w === 5 ? [0, 1, 2, 3, 4, 5] : [1, 2, 3, 4, 5];
      const x0 = outer > 0 ? cx - 2 : cx + 2;
      if (shut) {
        cols.forEach((ci, k) => { if (ci < 5) this.px(x0 + outer * k, ey + 3, C.lash, null); });
        this.px(x0 + outer * (cols.length - 1), ey + 2, C.lash, null);
        return;
      }
      EYE.forEach((row, r) => cols.forEach((ci, k) => { const ch = row[ci]; if (ch !== '.') this.px(x0 + outer * k, ey + r, C[EYEC[ch]], null); }));
    };
    const mouthOpen = (moving && run > .5) || (st.act === 'rub' && Math.sin((st.actT || 0) * 2.4) > .3);
    if (view === 0) {
      eye(Math.round(fcx - 5), -1, 5); eye(Math.round(fcx + 4), 1, 5);
      [-7, -6, 6, 7].forEach(dx => this.px(Math.round(fcx) + dx - (dx < 0 ? 0 : 1), ey + 6, C.blush, null));
      const mx = Math.round(fcx) - 1, my = hcy + 9;
      if (mouthOpen) { this.px(mx, my, C.mouth, null); this.px(mx + 1, my, C.mouth, null); this.px(mx, my + 1, C.blush, null); this.px(mx + 1, my + 1, C.blush, null); }
      else { this.px(mx, my, C.mouth, null); this.px(mx + 1, my, C.skinD, null); }
    } else if (view === 1) {
      eye(Math.round(fcx + 2.5), 1, 5); eye(Math.round(fcx - 3.5), -1, 4);
      [5, 6].forEach(dx => this.px(Math.round(fcx) + dx, ey + 6, C.blush, null)); this.px(Math.round(fcx) - 5, ey + 6, C.blush, null);
      const mx = Math.round(fcx + 1.5), my = hcy + 9;
      this.px(mx, my, C.mouth, null); if (mouthOpen) this.px(mx, my + 1, C.blush, null);
    } else {
      eye(Math.round(fcx + 2), 1, 4);
      this.px(Math.round(fcx + 3), ey + 6, C.blush, null); this.px(Math.round(fcx + 4), ey + 6, C.blush, null);
      this.px(Math.round(fcx + frx - .5), hcy + 9, C.mouth, null);
    }
  }

  starPin(x, y) {
    x = Math.round(x); y = Math.round(y);
    [[0, -2], [0, -1], [-2, 0], [-1, 0], [0, 0], [1, 0], [2, 0], [0, 1], [0, 2], [-1, -1], [1, 1], [1, -1], [-1, 1]].forEach(([dx, dy]) => {
      const tip = Math.abs(dx) + Math.abs(dy) === 2 && (dx === 0 || dy === 0), diag = dx && dy;
      this.px(x + dx, y + dy, diag || tip ? C.pinD : C.pin, nz(dx * .4, -dy * .4, 1));
    });
  }

  /* ---------- 躺着睡觉（侧卧，头在左，披风当被子） ---------- */
  drawLie() {
    this.flip = false;
    const br = Math.sin(this.t * 1.9) > .4 ? 1 : 0;
    // 散在地上的长发
    this.P(); this.ell(10, 55, 9.5, 5.5, (x, y) => (x + y) % 5 === 0 ? C.hairD : C.hairS, cyl(.6, .5));
    this.ell(5, 59, 5, 2.5, C.hairS, cyl(.6, .5));
    // 身体（裙子）
    this.P(); this.poly([[18, 49 - br], [33, 50], [37, 59], [18, 60]], (x, y) => y >= 59 ? C.trim : y < 52 ? C.dressL : C.dress, cyl(.6, .6));
    // 腿和鞋（膝盖微弯）
    this.P(); this.poly([[35, 53], [42, 54], [42, 57], [36, 58]], C.sock, cyl(.6, .5)); this.rect(42, 54, 4, 3, C.shoe, cyl(.6, .4));
    // 披风像被子一样盖在身上
    this.P(); this.poly([[17, 51 - br], [26, 49 - br], [38, 52], [44, 58], [41, 61], [18, 61]], (x, y, xl, xr) => y >= 60 ? C.trim : x < xl + 2 ? C.lining : (x + y) % 7 === 0 ? C.capeS : C.cape, cyl(.6, .7, .7));
    // 手放在脸旁
    this.P(); this.ell(16, 57, 2, 1.6, C.skin);
    // 头（侧脸朝向镜头，闭着眼）
    this.P(); const hn = sph(11, 52, 9, 8.5, .9);
    this.ell(11, 51.5, 9, 8.2, (x, y) => y > 56 ? C.hairS : C.hair, hn);
    this.P(); this.ell(12.5, 54.5, 6.6, 5.6, (x, y) => y > 58 ? C.skinS : C.skin, hn);
    // 刘海
    this.P(); for (let x = 6; x <= 19; x++) { const e = 50.5 + ((x * 3) % 5 === 0 ? 1.5 : .5) + (x < 8 ? 2 : 0); for (let y = 44; y <= e; y++) { const u = (x + .5 - 11) / 9, v = (y + .5 - 51.5) / 8.2; if (u * u + v * v <= 1) this.px(x, y, y > e - 1 ? C.hairS : C.hair, hn(x, y)); } }
    // 闭着的眼睛、腮红、嘴
    [[8, 54], [9, 54], [10, 54], [7, 53]].forEach(([x, y]) => this.px(x, y, C.lash, null));
    [[14, 54], [15, 54], [16, 54], [17, 53]].forEach(([x, y]) => this.px(x, y, C.lash, null));
    this.px(7, 56, C.blush, null); this.px(8, 56, C.blush, null); this.px(16, 56, C.blush, null); this.px(17, 56, C.blush, null);
    this.px(12, 58, C.mouth, null);
    [[8, 46], [9, 45], [10, 45], [14, 45], [15, 45]].forEach(([x, y]) => this.px(x, y, C.hairHi, null));
    this.P(); this.stroke([[11, 43.5], [10, 41], [12, 39.5]], 2, 1.2, C.hair);
    this.P(); this.starPin(18, 46);
  }
}

/* ---------- 放进场景：一张正对镜头的像素片 ---------- */
// 几何体是一张直立在脚下、面朝南的平面：光照、阴影、遮挡深度都按直立的身体算；
// 显示时以脚为轴往后倒到正对镜头（像素和屏幕一一对应），并把脚吸附到渲染像素格上，走动时像素不闪。
// 投影用两张替身片，分别转向光点和月光，用当前帧的剪影投影。
const TILT_VS = `uniform vec3 cFoot; uniform float cTilt; uniform vec2 cRes;
vec4 sprClip(vec4 clipUp, vec3 wpos) {
  vec3 d = wpos - cFoot; float c = cos(cTilt), s = sin(cTilt);
  vec4 ct = projectionMatrix * viewMatrix * vec4(cFoot + vec3(d.x, d.y * c, d.z - d.y * s), 1.);
  vec4 cf = projectionMatrix * viewMatrix * vec4(cFoot, 1.);
  vec2 sn = floor((cf.xy * .5 + .5) * cRes + .5) / cRes * 2. - 1.;
  ct.xy += sn - cf.xy;
  return vec4(ct.xy, clipUp.z / clipUp.w * ct.w, ct.w);
}`;
export function spriteRig(THREE, pc, layers) {
  const tx = (c, srgb) => { const t = new THREE.CanvasTexture(c); t.magFilter = t.minFilter = THREE.NearestFilter; t.generateMipmaps = false; if (srgb) t.colorSpace = THREE.SRGBColorSpace; return t; };
  const map = tx(pc.canvas, true), nmap = tx(pc.normal, false);
  const U = { cFoot: { value: new THREE.Vector3() }, cTilt: { value: 1 }, cRes: { value: new THREE.Vector2(640, 360) } };
  const geo = new THREE.PlaneGeometry(SW / 32, SH / 32); geo.translate(0, SH / 64 - (SH - FOOT - 1) / 32, 0);
  const mat = new THREE.MeshStandardMaterial({ map, normalMap: nmap, alphaTest: .5, roughness: .78, metalness: 0 });
  mat.onBeforeCompile = sh => {
    Object.assign(sh.uniforms, U);
    sh.vertexShader = TILT_VS + '\n' + sh.vertexShader.replace('#include <project_vertex>', '#include <project_vertex>\ngl_Position = sprClip(gl_Position, (modelMatrix * vec4(transformed, 1.)).xyz);');
    // 暗处保留一点自身颜色；受光有上限，光点贴近时不会被冲白
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <emissivemap_fragment>', '#include <emissivemap_fragment>\ntotalEmissiveRadiance += diffuseColor.rgb * .13;')
      .replace('#include <opaque_fragment>', 'outgoingLight = min(outgoingLight, diffuseColor.rgb * 1.05 + totalEmissiveRadiance);\n#include <opaque_fragment>');
  };
  mat.customProgramCacheKey = () => 'sprchar';
  const mesh = new THREE.Mesh(geo, mat); mesh.receiveShadow = true; mesh.frustumCulled = false; mesh.layers.set(layers.fx);
  // 描边法线图里的角色：一块正对镜头的平面
  const nMat = new THREE.ShaderMaterial({
    uniforms: { ...U, map: { value: map } },
    vertexShader: TILT_VS + `\nvarying vec2 vUv; void main(){ vUv = uv; vec4 wp = modelMatrix * vec4(position, 1.); gl_Position = sprClip(projectionMatrix * viewMatrix * wp, wp.xyz); }`,
    fragmentShader: `uniform sampler2D map; varying vec2 vUv; void main(){ if (texture2D(map, vUv).a < .5) discard; gl_FragColor = vec4(.5, .5, 1., 1.); }`
  });
  // 投影替身
  const shMat = new THREE.MeshBasicMaterial({ map, alphaTest: .5, colorWrite: false, depthWrite: false, side: THREE.DoubleSide });
  shMat.shadowSide = THREE.DoubleSide;
  const shOrb = new THREE.Mesh(geo, shMat), shMoon = new THREE.Mesh(geo, shMat);
  shOrb.castShadow = shMoon.castShadow = true; shOrb.layers.set(layers.shOrb); shMoon.layers.set(layers.shMoon);
  const group = new THREE.Group(); group.add(mesh, shOrb, shMoon);
  return {
    group, mesh, U,
    update(foot, elev, resW, resH, orbPos, moonFrom) {
      map.needsUpdate = true; nmap.needsUpdate = true;
      U.cFoot.value.copy(foot); U.cTilt.value = elev; U.cRes.value.set(resW, resH);
      // 替身以脚为轴往背光一侧倒一点：地上的影子仍然连着脚，但不会在她自己身上投出一道竖直的硬边
      shOrb.rotation.set(-.45, Math.atan2(orbPos.x - foot.x, orbPos.z - foot.z), 0, 'YXZ');
      shMoon.rotation.set(-.45, Math.atan2(moonFrom.x, moonFrom.z), 0, 'YXZ');
    },
    renderNormals(r, cam) {
      if (!group.visible || !group.parent?.visible) return;
      const m = mesh.material, ac = r.autoClear, lm = cam.layers.mask;
      mesh.material = nMat; r.autoClear = false; cam.layers.enableAll();
      r.render(mesh, cam);
      mesh.material = m; r.autoClear = ac; cam.layers.mask = lm;
    }
  };
}
