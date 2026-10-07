// 二次元风格像素角色：每帧程序化绘制，头发 / 披风 / 呆毛用质点链模拟，随动作自然飘动
import { mk, normalFromAlpha } from './sprites.js';

export const CW = 32, CH = 40; // 画布像素（16 px = 1 米）
const hex = h => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];
const C = Object.fromEntries(Object.entries({
  out: '#1d1530',
  hair: '#ece8fc', hairS: '#bdb4e4', hairD: '#8f86c8', hairHi: '#ffffff',
  skin: '#fde8dc', skinS: '#f0c6b6', blush: '#f6a0b4', mouth: '#c95f7a',
  lash: '#25194a', iris1: '#2f2f86', iris2: '#5468d0', iris3: '#9cc2ff', eyeHi: '#ffffff',
  dress: '#2f3a86', dressS: '#222a63', dressL: '#4859b4',
  collar: '#f6f2ff', ribbon: '#e8c98e',
  cape: '#262d6c', capeS: '#1b2052', lining: '#8463c4', trim: '#e8c98e',
  sock: '#f4f0ff', shoe: '#3b2c4c', pin: '#ffe9a0', pinD: '#e0b860'
}).map(([k, v]) => [k, hex(v)]));

// 质点链（Verlet）
class Chain {
  constructor(n, seg) { this.n = n; this.seg = seg; this.p = []; this.o = []; }
  reset(ax, ay, dx, dy) { this.p = []; this.o = []; for (let i = 0; i < this.n; i++) { const x = ax + dx * this.seg * i, y = ay + dy * this.seg * i; this.p.push([x, y]); this.o.push([x, y]); } }
  step(dt, ax, ay, fx, fy, restDx, restDy, stiff, damp) {
    const p = this.p, o = this.o;
    p[0][0] = ax; p[0][1] = ay; o[0][0] = ax; o[0][1] = ay;
    for (let i = 1; i < this.n; i++) {
      const q = p[i], r = o[i];
      const vx = (q[0] - r[0]) * damp, vy = (q[1] - r[1]) * damp;
      r[0] = q[0]; r[1] = q[1];
      // 回到静止形状的弱弹簧（保持发型/披风的轮廓）
      const rx = ax + restDx * this.seg * i, ry = ay + restDy * this.seg * i;
      q[0] += vx + (fx + (rx - q[0]) * stiff) * dt * dt;
      q[1] += vy + (fy + (ry - q[1]) * stiff) * dt * dt;
    }
    for (let k = 0; k < 4; k++) for (let i = 1; i < this.n; i++) {
      const a = p[i - 1], b = p[i]; let dx = b[0] - a[0], dy = b[1] - a[1]; const d = Math.hypot(dx, dy) || 1e-4;
      const f = (d - this.seg) / d; b[0] -= dx * f; b[1] -= dy * f;
      if (b[0] < 0) b[0] = 0; if (b[0] > CW - 1) b[0] = CW - 1; if (b[1] > CH - 1) b[1] = CH - 1;
    }
  }
}

export class PixelChar {
  constructor() {
    this.canvas = mk(CW, CH); this.g = this.canvas.getContext('2d');
    this.img = this.g.createImageData(CW, CH); this.d = this.img.data;
    this.normal = mk(CW, CH);
    this.view = ''; this.flip = false; this.phase = 0; this.t = 0; this.blinkT = 2.5; this.bob = 0;
    this.chains = { hairL: new Chain(6, 2.2), hairR: new Chain(6, 2.2), lockL: new Chain(4, 2), lockR: new Chain(4, 2), capeL: new Chain(5, 2.2), capeR: new Chain(5, 2.2), ahoge: new Chain(3, 1.6), back: new Chain(6, 2.3) };
    this.prevV = [0, 0];
  }
  /* ---------- 像素绘制工具 ---------- */
  clear() { this.d.fill(0); }
  px(x, y, c) { x = Math.round(x); y = Math.round(y); if (x < 0 || y < 0 || x >= CW || y >= CH) return; if (this.flip) x = CW - 1 - x; const i = (y * CW + x) * 4, d = this.d; d[i] = c[0]; d[i + 1] = c[1]; d[i + 2] = c[2]; d[i + 3] = 255; }
  rect(x0, y0, w, h, c) { for (let y = y0; y < y0 + h; y++) for (let x = x0; x < x0 + w; x++) this.px(x, y, c); }
  ell(cx, cy, rx, ry, c, keep) { for (let y = Math.floor(cy - ry); y <= Math.ceil(cy + ry); y++) for (let x = Math.floor(cx - rx); x <= Math.ceil(cx + rx); x++) { const u = (x + .5 - cx) / rx, v = (y + .5 - cy) / ry; if (u * u + v * v <= 1 && (!keep || keep(x, y))) this.px(x, y, c); } }
  poly(pts, c, shade) {
    let y0 = 1e9, y1 = -1e9; pts.forEach(p => { y0 = Math.min(y0, p[1]); y1 = Math.max(y1, p[1]); });
    for (let y = Math.floor(y0); y <= Math.ceil(y1); y++) {
      const yc = y + .5, xs = [];
      for (let i = 0; i < pts.length; i++) { const a = pts[i], b = pts[(i + 1) % pts.length]; if ((a[1] <= yc && b[1] > yc) || (b[1] <= yc && a[1] > yc)) xs.push(a[0] + (yc - a[1]) / (b[1] - a[1]) * (b[0] - a[0])); }
      xs.sort((a, b) => a - b);
      for (let k = 0; k + 1 < xs.length; k += 2) for (let x = Math.ceil(xs[k] - .5); x <= Math.floor(xs[k + 1] - .5); x++) this.px(x, y, shade ? shade(x, y) : c);
    }
  }
  stroke(pts, w, c, tipC) {
    for (let i = 0; i + 1 < pts.length; i++) {
      const a = pts[i], b = pts[i + 1], n = Math.max(1, Math.ceil(Math.hypot(b[0] - a[0], b[1] - a[1]) * 2));
      for (let k = 0; k <= n; k++) {
        const x = a[0] + (b[0] - a[0]) * k / n, y = a[1] + (b[1] - a[1]) * k / n, r = w / 2 * (1 - .35 * (i + k / n) / pts.length);
        const col = tipC && i >= pts.length - 2 ? tipC : c;
        for (let yy = Math.floor(y - r); yy <= Math.ceil(y + r); yy++) for (let xx = Math.floor(x - r); xx <= Math.ceil(x + r); xx++) if ((xx + .5 - x) ** 2 + (yy + .5 - y) ** 2 <= r * r + .15) this.px(xx, yy, col);
      }
    }
  }
  outline() {
    const d = this.d, A = (x, y) => x >= 0 && y >= 0 && x < CW && y < CH && d[(y * CW + x) * 4 + 3] > 0 && !this._o[y * CW + x];
    this._o = new Uint8Array(CW * CH);
    const add = [];
    for (let y = 0; y < CH; y++) for (let x = 0; x < CW; x++) if (!d[(y * CW + x) * 4 + 3] && (A(x - 1, y) || A(x + 1, y) || A(x, y - 1) || A(x, y + 1))) add.push([x, y]);
    const o = C.out; add.forEach(([x, y]) => { const i = (y * CW + x) * 4; d[i] = o[0]; d[i + 1] = o[1]; d[i + 2] = o[2]; d[i + 3] = 255; });
  }

  /* ---------- 每帧更新 ---------- */
  // st: { dir, moving, run(0..1), vx, vz (米/秒), dt, lie, crouch(像素), act('rub'|'look'), actT }
  update(st) {
    const dt = Math.min(st.dt, 1 / 30);
    this.t += dt;
    if (st.lie) { this.view = 'lie'; this.drawLie(); this.finish(); return; }
    const view = st.dir === 'left' || st.dir === 'right' ? 'side' : st.dir;
    const flip = st.dir === 'left';
    const run = st.run || 0;
    if (st.moving) this.phase += dt * (9 + run * 6); else this.phase = 0;
    const s = Math.sin(this.phase);
    const amp = st.moving ? 1 + run * .6 : 0;
    this.bob = st.moving ? -Math.round(Math.abs(s) * amp) : (Math.sin(this.t * 2.1) > .55 ? 1 : 0) * 0;
    const breathe = !st.moving && Math.sin(this.t * 2.1) > .6 ? 1 : 0;
    // 屏幕空间速度（像素/秒）
    let vx = st.vx * 16, vy = st.vz * 16 * .85; if (flip) vx = -vx;
    const ax = (vx - this.prevV[0]) / dt, ay = (vy - this.prevV[1]) / dt; this.prevV = [vx, vy];
    const by = this.bob + breathe + Math.round(st.crouch || 0);
    if (view !== this.view || flip !== this.flip) { this.view = view; this.flip = flip; this.resetChains(by); }
    // 外力：重力 + 空气阻力（与运动方向相反）+ 惯性 + 轻微飘动
    const flutter = Math.sin(this.t * 7.3) * 6 + Math.sin(this.t * 13.1) * 3;
    const wind = [-vx * 1.25 - ax * .03, -vy * (view === 'side' ? .6 : .35) - ay * .02];
    const G = 70;
    const ch = this.chains, R = this.rig(by);
    const sim = (c, a, rest, k, extra = [0, 0], mul = 1) => c.step(dt, a[0], a[1], (wind[0] * mul + extra[0]), (G + wind[1] * mul + extra[1] + (st.moving ? flutter * mul : 0)), rest[0], rest[1], k, .9);
    if (view === 'down') {
      sim(ch.hairL, R.hairL, [-.15, 1], 60); sim(ch.hairR, R.hairR, [.15, 1], 60);
      sim(ch.lockL, R.lockL, [-.05, 1], 120, [0, 0], .5); sim(ch.lockR, R.lockR, [.05, 1], 120, [0, 0], .5);
      sim(ch.capeL, R.capeL, [-.35, 1], 40, [-6 * (st.moving ? 1 : 0), 0]); sim(ch.capeR, R.capeR, [.35, 1], 40, [6 * (st.moving ? 1 : 0), 0]);
    } else if (view === 'up') {
      sim(ch.back, R.back, [0, 1], 50); sim(ch.hairL, R.hairL, [-.1, 1], 60); sim(ch.hairR, R.hairR, [.1, 1], 60);
      sim(ch.capeL, R.capeL, [-.3, 1], 40); sim(ch.capeR, R.capeR, [.3, 1], 40);
    } else {
      sim(ch.back, R.back, [-.35, 1], 45); sim(ch.lockR, R.lockR, [.05, 1], 120, [0, 0], .4);
      sim(ch.capeL, R.capeL, [-.45, 1], 35); sim(ch.capeR, R.capeR, [-.15, 1], 40);
    }
    // 呆毛：向上的弹簧，跟随身体上下摆动
    ch.ahoge.step(dt, R.ahoge[0], R.ahoge[1], -vx * .4, -G * 1.6 - this.bob * 40, .35, -1, 260, .82);
    // 眨眼
    this.blinkT -= dt; if (this.blinkT < -.12) this.blinkT = 2 + Math.random() * 3;
    this.draw(st, by, run);
    this.finish();
  }
  finish() {
    this.g.putImageData(this.img, 0, 0);
    const n = normalFromAlpha(this.canvas, CW, CH, { strength: 2 });
    const ng = this.normal.getContext('2d'); ng.clearRect(0, 0, CW, CH); ng.drawImage(n, 0, 0);
  }
  rig(by) {
    const v = this.view;
    if (v === 'down') return { hairL: [10, 17 + by], hairR: [22, 17 + by], lockL: [9, 19 + by], lockR: [23, 19 + by], capeL: [11, 25 + by], capeR: [21, 25 + by], ahoge: [16, 8 + by] };
    if (v === 'up') return { back: [16, 20 + by], hairL: [11, 18 + by], hairR: [21, 18 + by], capeL: [11, 25 + by], capeR: [21, 25 + by], ahoge: [16, 8 + by] };
    return { back: [11, 16 + by], lockR: [19, 18 + by], capeL: [13, 25 + by], capeR: [16, 25 + by], ahoge: [15, 8 + by] };
  }
  resetChains(by) {
    const R = this.rig(by), ch = this.chains;
    const set = (c, a, dx, dy) => a && c.reset(a[0], a[1], dx, dy);
    set(ch.hairL, R.hairL, -.15, 1); set(ch.hairR, R.hairR, .15, 1); set(ch.lockL, R.lockL, 0, 1); set(ch.lockR, R.lockR, 0, 1);
    set(ch.capeL, R.capeL, -.35, 1); set(ch.capeR, R.capeR, .35, 1); set(ch.back, R.back, 0, 1); set(ch.ahoge, R.ahoge, .35, -1);
  }

  /* ---------- 绘制 ---------- */
  draw(st, by, run) {
    this.clear();
    const v = this.view, ch = this.chains, s = Math.sin(this.phase);
    const moving = st.moving, legA = moving ? (1.5 + run) : 0;
    const blink = this.blinkT < 0;
    if (v === 'down') {
      // 后发（披在身后）
      this.poly([[9, 13 + by], [23, 13 + by], ...ch.hairR.p.slice(1), ...ch.hairL.p.slice(1).reverse()], C.hairS, (x, y) => (x + y) % 5 === 0 ? C.hairD : C.hairS);
      // 披风（身后，从两侧露出内衬）
      const cL = ch.capeL.p, cR = ch.capeR.p;
      this.poly([[12, 24 + by], [20, 24 + by], ...cR.slice(1), [cR[cR.length - 1][0] - 1, cR[cR.length - 1][1]], [cL[cL.length - 1][0] + 1, cL[cL.length - 1][1]], ...cL.slice(1).reverse()], C.lining);
      [cL, cR].forEach(c => { const e = c[c.length - 1]; this.px(e[0], e[1], C.trim); });
      // 腿（蹲坐时膝盖弯下去，坐在地上时两只鞋向外摊开）
      const cr = Math.round(st.crouch || 0);
      const lL = moving ? Math.round(Math.max(0, s) * legA) : 0, lR = moving ? Math.round(Math.max(0, -s) * legA) : 0;
      if (cr < 5) {
        const top = 33 + cr;
        this.rect(13, top, 2, Math.max(0, 4 - cr - lL), C.sock); this.rect(13, 37 - lL, 2, 1, C.shoe); this.rect(12, 37 - lL, 1, 1, C.shoe);
        this.rect(17, top, 2, Math.max(0, 4 - cr - lR), C.sock); this.rect(17, 37 - lR, 2, 1, C.shoe); this.rect(19, 37 - lR, 1, 1, C.shoe);
      } else {
        this.rect(11, 37, 3, 1, C.shoe); this.rect(18, 37, 3, 1, C.shoe); this.rect(13, 36, 2, 1, C.sock); this.rect(17, 36, 2, 1, C.sock);
      }
      // 裙装（坐下时裙摆摊在地上）
      const hem = Math.min(37, 33 + by), spread = cr * .35;
      this.poly([[12, 24 + by], [20, 24 + by], [22.5 + spread, hem], [9.5 - spread, hem]], C.dress, (x, y) => x < 13 ? C.dressL : x > 19 ? C.dressS : (y === hem - 1 ? C.trim : C.dress));
      // 手臂：揉眼睛 / 自然下垂 / 走路摆动
      const aw = moving ? Math.round(s * (1 + run)) : 0;
      const rub = st.act === 'rub', rubSide = rub ? ((st.actT || 0) % 1.3 < .65 ? 0 : 1) : -1;
      const armDown = (x, c1) => { const hy = Math.min(37, 29 + by); if (cr >= 5) { this.rect(x, 25 + by, 2, Math.max(1, hy - 25 - by), c1); this.rect(x + (x < 16 ? -1 : 1), hy, 2, 1, C.skin); } else { this.rect(x, 25 + by + (x < 16 ? aw : -aw), 2, 4, c1); this.rect(x, 29 + by + (x < 16 ? aw : -aw), 2, 1, C.skin); } };
      if (rubSide !== 0) armDown(10, C.dressL);
      if (rubSide !== 1) armDown(20, C.dressS);
      // 水手领 + 蝴蝶结
      this.poly([[12.5, 24 + by], [19.5, 24 + by], [16, 28 + by]], C.collar);
      this.rect(15, 26 + by, 2, 1, C.ribbon); this.px(14, 27 + by, C.ribbon); this.px(17, 27 + by, C.ribbon); this.px(16, 27 + by, C.pinD);
      // 脸
      this.ell(16, 18 + by, 6.4, 5.8, C.skin);
      this.px(11, 22 + by, C.skinS); this.px(20, 22 + by, C.skinS);
      // 头发（刘海按列给出下沿）
      const bangs = { 8: 22, 9: 21, 10: 19, 11: 16, 12: 15, 13: 16, 14: 17, 15: 15, 16: 14, 17: 15, 18: 17, 19: 16, 20: 15, 21: 16, 22: 19, 23: 21, 24: 22 };
      this.ell(16, 14 + by, 8.6, 7.2, C.hair, (x, y) => y <= (bangs[x] ?? 13) + by);
      for (const k in bangs) { const x = +k, b = bangs[k] + by; this.px(x, b, C.hairS); }
      // 天使环高光
      [[11, 10], [12, 10], [13, 9], [19, 9], [20, 10], [21, 10]].forEach(([x, y]) => this.px(x, y + by, C.hairHi));
      // 眼睛（大眼 + 高光）
      const look = st.act === 'look' ? ((st.actT || 0) < .8 ? -1 : (st.actT || 0) < 1.7 ? 1 : 0) : 0;
      const sleepy = st.act === 'rub';
      const eye = (x0, out) => {
        x0 += look;
        if (blink || sleepy) { this.rect(x0, 19 + by, 3, 1, C.lash); if (sleepy) { this.px(x0 - 1, 18 + by, C.lash); this.px(x0 + 3, 18 + by, C.lash); } return; }
        this.rect(x0 - (out < 0 ? 1 : 0), 17 + by, 4, 1, C.lash);
        this.rect(x0, 18 + by, 3, 1, C.iris1); this.rect(x0, 19 + by, 3, 1, C.iris2); this.rect(x0, 20 + by, 3, 1, C.iris3);
        this.px(out < 0 ? x0 : x0 + 2, 18 + by, C.eyeHi); this.px(out < 0 ? x0 + 2 : x0, 20 + by, C.eyeHi);
      };
      eye(11, -1); eye(18, 1);
      this.rect(10, 21 + by, 2, 1, C.blush); this.rect(20, 21 + by, 2, 1, C.blush);
      if ((run > .5 && moving) || (rub && Math.sin((st.actT || 0) * 2.4) > .3)) { this.rect(15, 22 + by, 2, 1, C.mouth); } else this.px(16 + look, 22 + by, C.mouth);
      // 鬓发（在脸前）
      this.stroke(ch.lockL.p, 2.2, C.hair, C.hairS); this.stroke(ch.lockR.p, 2.2, C.hair, C.hairS);
      this.drawAhoge(); this.drawPin(22, 9 + by);
      // 揉眼睛的手（画在脸前）
      if (rub) {
        const t = st.actT || 0, ex = rubSide === 0 ? 12 : 19, sx = rubSide === 0 ? 11 : 21;
        const hx = ex + Math.round(Math.sin(t * 15)), hy = 19 + by + Math.round(Math.cos(t * 15) * .6);
        this.stroke([[sx, 26 + by], [sx + (rubSide === 0 ? -1 : 1), 23 + by], [hx, hy + 1]], 2.2, rubSide === 0 ? C.dressL : C.dressS);
        this.rect(hx - 1, hy, 3, 2, C.skin); this.px(hx - 1, hy + 2, C.skinS);
      }
    } else if (v === 'up') {
      const lL = moving ? Math.round(Math.max(0, s) * legA) : 0, lR = moving ? Math.round(Math.max(0, -s) * legA) : 0;
      this.rect(13, 33, 2, 4 - lL, C.sock); this.rect(13, 37 - lL, 2, 1, C.shoe);
      this.rect(17, 33, 2, 4 - lR, C.sock); this.rect(17, 37 - lR, 2, 1, C.shoe);
      this.poly([[12, 24 + by], [20, 24 + by], [22.5, 33 + by], [9.5, 33 + by]], C.dressS);
      // 披风盖住背部
      const cL = ch.capeL.p, cR = ch.capeR.p;
      this.poly([[11, 24 + by], [21, 24 + by], ...cR.slice(1), ...cL.slice(1).reverse()], C.cape, (x, y) => (x < 13 ? C.capeS : C.cape));
      this.stroke([cL[cL.length - 1], [16, Math.max(cL[cL.length - 1][1], cR[cR.length - 1][1]) + .5], cR[cR.length - 1]], 1.2, C.trim);
      // 背后的星徽
      [[16, 28], [15, 29], [16, 29], [17, 29], [16, 30], [14, 29], [18, 29], [16, 27], [16, 31]].forEach(([x, y]) => this.px(x, y + by, C.trim));
      // 头发（全是后脑）
      this.ell(16, 15 + by, 8.6, 7.6, C.hair);
      [[12, 11], [13, 10], [14, 10], [18, 10], [19, 10], [20, 11]].forEach(([x, y]) => this.px(x, y + by, C.hairHi));
      for (let x = 9; x <= 23; x += 3) this.px(x, 20 + by, C.hairS);
      // 长发披在披风上
      const b = ch.back.p, hl = ch.hairL.p, hr = ch.hairR.p;
      this.poly([[10, 18 + by], [22, 18 + by], ...hr.slice(1), ...hl.slice(1).reverse()], C.hair, (x, y) => (x % 3 === 0 ? C.hairS : C.hair));
      this.stroke(b, 2, C.hairS);
      this.drawAhoge(); this.drawPin(10, 9 + by);
    } else {
      // 侧面（朝右，朝左时整体镜像）
      const legX = moving ? Math.round(s * (2 + run)) : 0, lift = moving ? Math.round(Math.max(0, Math.cos(this.phase)) * (1 + run)) : 0;
      // 后发与披风先画
      const bk = ch.back.p;
      this.poly([[10, 13 + by], [15, 15 + by], ...bk.slice(1).map(p => [p[0] + 1.5, p[1]]), ...bk.slice(1).reverse().map(p => [p[0] - 1.5, p[1]])], C.hairS, (x, y) => (x + y) % 4 === 0 ? C.hairD : C.hairS);
      const cL = ch.capeL.p, cR = ch.capeR.p;
      this.poly([[13, 24 + by], [17, 24 + by], ...cR.slice(1), ...cL.slice(1).reverse()], C.cape, (x, y) => x > 15 ? C.lining : C.cape);
      this.px(cL[cL.length - 1][0], cL[cL.length - 1][1], C.trim);
      // 后腿（暗）
      this.rect(15 - legX, 33, 2, 4, C.hairD); this.rect(15 - legX, 37, 3, 1, C.shoe);
      // 身体
      this.poly([[13, 24 + by], [19, 24 + by], [21, 33 + by], [11.5, 33 + by]], C.dress, (x, y) => x < 14 ? C.dressS : x > 18 ? C.dressL : (y === 32 + by ? C.trim : C.dress));
      this.poly([[16, 24 + by], [20, 24 + by], [18, 27 + by]], C.collar);
      // 前腿
      this.rect(16 + legX, 33, 2, 4 - lift, C.sock); this.rect(16 + legX, 37 - lift, 3, 1, C.shoe);
      // 手臂
      const aw = moving ? Math.round(-s * (1.5 + run)) : 0;
      this.rect(16 + aw, 25 + by, 2, 4, C.dressL); this.rect(16 + aw, 29 + by, 2, 1, C.skin);
      // 脸与头发
      this.ell(17.5, 18 + by, 5.6, 5.8, C.skin);
      const front = { 14: 17, 15: 15, 16: 14, 17: 15, 18: 16, 19: 15, 20: 16, 21: 15, 22: 17, 23: 19 };
      this.ell(15.5, 14.5 + by, 8, 7.2, C.hair, (x, y) => x <= 13 ? y <= 22 + by : y <= (front[x] ?? 13) + by);
      for (const k in front) this.px(+k, front[k] + by, C.hairS);
      [[13, 9], [14, 9], [15, 9], [16, 10]].forEach(([x, y]) => this.px(x, y + by, C.hairHi));
      for (let y = 15; y <= 21; y += 2) this.px(10, y + by, C.hairS);
      // 眼（侧面只露一只）
      if (blink) this.rect(19, 19 + by, 3, 1, C.lash);
      else { this.rect(19, 17 + by, 3, 1, C.lash); this.rect(20, 18 + by, 2, 1, C.iris1); this.rect(20, 19 + by, 2, 1, C.iris2); this.rect(20, 20 + by, 2, 1, C.iris3); this.px(20, 18 + by, C.eyeHi); }
      this.px(21, 21 + by, C.blush); this.px(22, 21 + by, C.blush);
      this.px(22, 22 + by, C.mouth);
      this.stroke(ch.lockR.p, 2, C.hair, C.hairS);
      this.drawAhoge(); this.drawPin(10, 10 + by);
    }
    this.outline();
  }
  // 躺在地上（侧卧，头在左）：披风像毯子一样铺开，长发散在地面
  drawLie() {
    this.clear();
    const br = Math.sin(this.t * 1.9) > .4 ? 1 : 0;
    this.ell(17, 35.5, 13.5, 3, C.cape); this.ell(18, 35.8, 10, 1.8, C.capeS);
    [[4, 36], [8, 38], [27, 37], [30, 35]].forEach(([x, y]) => this.px(x, y, C.trim));
    this.ell(6.5, 34.5, 6, 3.6, C.hairS); this.ell(3.5, 37, 3.5, 1.6, C.hairS); this.ell(10, 37.6, 3, 1, C.hairD);
    // 身体
    this.poly([[12, 31 - br], [23, 32], [25, 36], [12, 36]], C.dress, (x, y) => y < 33 ? C.dressL : y > 34 ? C.dressS : C.dress);
    this.rect(13, 35, 11, 1, C.trim);
    this.poly([[12, 31 - br], [15, 31], [13, 34]], C.collar); this.px(13, 32, C.ribbon);
    this.rect(25, 33, 4, 2, C.sock); this.rect(29, 33, 2, 2, C.shoe);
    // 手臂枕在脸旁
    this.rect(13, 34, 5, 1, C.dressS); this.rect(11, 34, 2, 1, C.skin);
    // 脸（闭着眼睛）
    this.ell(8.5, 33.5, 4.2, 3.4, C.skin);
    this.ell(7.5, 31.6, 5.2, 3.2, C.hair, (x, y) => y <= 32 || x <= 4);
    this.rect(6, 34, 2, 1, C.lash); this.rect(10, 34, 2, 1, C.lash);
    this.px(5, 35, C.blush); this.px(12, 35, C.blush); this.px(9, 36, C.mouth);
    [[6, 29], [7, 29], [9, 30]].forEach(([x, y]) => this.px(x, y, C.hairHi));
    this.stroke([[7, 29], [5, 27], [4, 27.5]], 1.2, C.hair);
    this.drawPin(12, 30);
    this.outline();
  }
  drawAhoge() { this.stroke(this.chains.ahoge.p, 1.3, C.hair); }
  drawPin(x, y) { [[0, -1], [-1, 0], [0, 0], [1, 0], [0, 1]].forEach(([dx, dy]) => this.px(x + dx, y + dy, dx || dy ? C.pinD : C.pin)); this.px(x, y, C.pin); }
}
