// 特效：像素粒子（含环绕运动）、地面光环、旋转星印、引导微光
import * as THREE from 'three';
import { LAYER_FX } from './post.js';
import { mk } from './sprites.js';
import { haloCanvas } from './sprites.js';

const nearest = t => { t.magFilter = t.minFilter = THREE.NearestFilter; t.generateMipmaps = false; return t; };

// 八芒星印 / 新月印（像素线稿）
function sigilCanvas(kind) {
  const N = 48, c = mk(N, N), g = c.getContext('2d'), cx = N / 2 - .5;
  g.fillStyle = '#fff';
  const px = (x, y) => g.fillRect(Math.round(x), Math.round(y), 1, 1);
  const circle = (r, step = 1) => { const n = Math.ceil(r * 7); for (let i = 0; i < n; i += step) { const a = i / n * 6.283; px(cx + Math.cos(a) * r, cx + Math.sin(a) * r); } };
  circle(22); circle(17, 2);
  if (kind === 'sun') {
    // 日轮：同心圆 + 十二道长短相间的光芒
    circle(8); circle(5, 2);
    for (let i = 0; i < 12; i++) { const a = i / 12 * 6.283, r0 = 10, r1 = i % 2 ? 13.5 : 16; for (let r = r0; r <= r1; r += .5) px(cx + Math.cos(a) * r, cx + Math.sin(a) * r); }
    for (let i = 0; i < 24; i++) { const a = i / 24 * 6.283 + .13; px(cx + Math.cos(a) * 19.5, cx + Math.sin(a) * 19.5); }
  } else if (kind === 'moon') {
    // 新月：两圆相减
    for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
      const a = Math.hypot(x - cx, y - cx), b = Math.hypot(x - cx - 5, y - cx + 3);
      if (Math.abs(a - 12) < .6 && b > 10.5) px(x, y);
      if (Math.abs(b - 10.5) < .6 && a < 12) px(x, y);
    }
    for (let i = 0; i < 8; i++) { const a = i / 8 * 6.283; px(cx + Math.cos(a) * 19.5, cx + Math.sin(a) * 19.5); }
  } else {
    for (let k = -14; k <= 14; k++) { px(cx + k, cx); px(cx, cx + k); }
    for (let k = -8; k <= 8; k++) { px(cx + k, cx + k); px(cx + k, cx - k); }
    for (let i = 0; i < 8; i++) { const a = i / 8 * 6.283 + .39; px(cx + Math.cos(a) * 19.5, cx + Math.sin(a) * 19.5); }
  }
  return c;
}

export class FX {
  constructor(scene, camQuat) {
    this.scene = scene; this.camQuat = camQuat; this.T = 0;
    // 粒子
    const PN = this.PN = 1400;
    this.pPos = new Float32Array(PN * 3); this.pCol = new Float32Array(PN * 3); this.pSize = new Float32Array(PN); this.pAlpha = new Float32Array(PN);
    this.parts = Array.from({ length: PN }, () => ({ life: 0 }));
    const pg = this.pg = new THREE.BufferGeometry();
    pg.setAttribute('position', new THREE.BufferAttribute(this.pPos, 3)); pg.setAttribute('color', new THREE.BufferAttribute(this.pCol, 3));
    pg.setAttribute('size', new THREE.BufferAttribute(this.pSize, 1)); pg.setAttribute('alpha', new THREE.BufferAttribute(this.pAlpha, 1));
    const pm = new THREE.ShaderMaterial({
      vertexShader: `attribute float size; attribute float alpha; attribute vec3 color; varying vec3 vC; varying float vA;
        void main(){ vC = color; vA = alpha; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.); gl_PointSize = max(1., floor(size * 1.5 + .5)); }`,
      fragmentShader: `varying vec3 vC; varying float vA; void main(){ if (vA <= .01) discard; gl_FragColor = vec4(vC * vA, 1.); }`,
      transparent: true, depthWrite: false, blending: THREE.AdditiveBlending
    });
    const points = new THREE.Points(pg, pm); points.frustumCulled = false; points.layers.set(LAYER_FX); scene.add(points);
    this.cursor = 0;
    // 光环 / 星印
    this.ringGeo = new THREE.RingGeometry(.92, 1, 48); this.ringGeo.rotateX(-Math.PI / 2);
    this.sigT = { star: nearest(new THREE.CanvasTexture(sigilCanvas('star'))), moon: nearest(new THREE.CanvasTexture(sigilCanvas('moon'))), sun: nearest(new THREE.CanvasTexture(sigilCanvas('sun'))) };
    this.haloT = nearest(new THREE.CanvasTexture(haloCanvas(64)));
    this.items = [];
    this.beacons = [];
    // 常驻的隐形样本：光环、星印用的材质每次新建、用完就释放，若没有常驻的同类材质，
    // 着色器会被释放后再重新编译，点亮机关的瞬间就会卡一下。留一份常驻，着色器就一直在。
    const keepOpts = { transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide };
    [new THREE.MeshBasicMaterial(keepOpts), new THREE.MeshBasicMaterial({ ...keepOpts, map: this.haloT })].forEach(mat => {
      const m = new THREE.Mesh(new THREE.PlaneGeometry(.01, .01), mat); m.layers.set(LAYER_FX); m.visible = false; m.position.y = -50; scene.add(m);
    });
  }
  /* ---------- 粒子 ---------- */
  emit(x, y, z, o = {}) {
    const p = this.parts[this.cursor]; this.cursor = (this.cursor + 1) % this.PN;
    p.x = x; p.y = y; p.z = z; p.vx = o.vx || 0; p.vy = o.vy || 0; p.vz = o.vz || 0; p.g = o.g || 0;
    p.life = p.max = o.life || 1; p.c = o.c || [1, 1, 1]; p.s = o.s || 1; p.a = o.a ?? 1; p.tw = o.tw || 0; p.drag = o.drag || 0;
    // 环绕运动：绕 (cx, cz) 旋转，半径随时间变化
    p.orb = o.orbit ? { ...o.orbit } : null;
    return p;
  }
  burst(x, y, z, n, o = {}) {
    for (let i = 0; i < n; i++) {
      const a = Math.random() * 6.28, sp = (o.sp || 1.5) * (.3 + Math.random() * .7);
      this.emit(x, y, z, { vx: Math.cos(a) * sp, vz: Math.sin(a) * sp, vy: (o.up || 1) * (Math.random() * 1.5), g: o.g ?? -.6, life: (o.life || 1.2) * (.6 + Math.random() * .6), c: o.c, s: Math.random() < .3 ? 2 : 1, drag: 1.2, tw: o.tw || 0 });
    }
  }
  // 绽放：向外旋转散开的螺旋粒子
  bloom(x, y, z, n, c, o = {}) {
    for (let i = 0; i < n; i++) {
      const a = i / n * 6.283 + Math.random() * .3;
      this.emit(x, y + (Math.random() - .5) * .2, z, { vy: (o.up ?? .6) * (.4 + Math.random()), g: o.g ?? -.15, life: (o.life || 1.6) * (.7 + Math.random() * .5), c, s: Math.random() < .35 ? 2 : 1, tw: 7,
        orbit: { cx: x, cz: z, a, r: o.r0 || .2, w: (o.w || 2.6) * (Math.random() < .5 ? 1 : 1) * (.7 + Math.random() * .6), vr: (o.vr || 1.8) * (.6 + Math.random() * .7) } });
    }
  }
  // 环绕：粒子围着一点缓慢旋转上升（醒来、星光环绕）
  swirl(x, y, z, r, c, o = {}) {
    const a = Math.random() * 6.283;
    this.emit(x, y, z, { vy: o.vy ?? .25, life: o.life || 2.4, c, s: Math.random() < .3 ? 2 : 1, tw: 6, a: o.a ?? 1,
      orbit: { cx: x, cz: z, a, r, w: o.w || 1.6, vr: o.vr || 0 } });
  }
  /* ---------- 光环 / 星印 ---------- */
  ring(x, y, z, color, size = 3, dur = 1.1, o = {}) {
    const m = new THREE.Mesh(this.ringGeo, new THREE.MeshBasicMaterial({ color, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide }));
    m.position.set(x, y, z); m.layers.set(LAYER_FX); this.scene.add(m);
    this.items.push({ m, t: 0, dur, upd: (k) => { const e = 1 - Math.pow(1 - k, 3); m.scale.setScalar(.2 + e * size); m.material.opacity = (1 - k) * (o.a ?? 1); } });
  }
  sigil(x, y, z, color, kind = 'star', size = 2.4, dur = 2, o = {}) {
    const mat = new THREE.MeshBasicMaterial({ map: this.sigT[kind], color, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide });
    const m = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), mat); m.layers.set(LAYER_FX);
    if (o.flat !== false) m.rotation.x = -Math.PI / 2; else m.quaternion.copy(this.camQuat);
    m.position.set(x, y, z); this.scene.add(m);
    const spin = o.spin ?? 2.5, r0 = m.rotation.z;
    this.items.push({ m, t: 0, dur, upd: (k) => {
      const e = 1 - Math.pow(1 - Math.min(1, k * 1.6), 3);
      m.scale.setScalar(size * (.35 + e * .65));
      if (o.flat !== false) m.rotation.z = r0 + k * spin * dur; else m.rotateZ(.016 * spin);
      m.material.opacity = Math.min(1, k * 6) * (1 - k) * (o.a ?? 1);
    } });
  }
  /* ---------- 引导微光：重要机关上一点带颜色的光，与环境区分开 ---------- */
  beacon(x, y, z, color, size = 1.1) {
    const mat = new THREE.MeshBasicMaterial({ map: this.haloT, color, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide, opacity: 0 });
    const m = new THREE.Mesh(new THREE.PlaneGeometry(size, size), mat); m.quaternion.copy(this.camQuat); m.layers.set(LAYER_FX);
    m.position.set(x, y, z); this.scene.add(m);
    const c = new THREE.Color(color);
    const b = { m, on: true, k: 0, x, y, z, col: [c.r, c.g, c.b], ph: Math.random() * 6, mote: Math.random() };
    this.beacons.push(b); return b;
  }
  update(dt, T) {
    this.T = T;
    // 粒子
    const { parts, pPos, pCol, pSize, pAlpha } = this;
    for (let i = 0; i < this.PN; i++) {
      const p = parts[i];
      if (p.life > 0) {
        p.life -= dt; p.vy += p.g * dt; const dr = Math.exp(-p.drag * dt);
        if (p.orb) {
          const o = p.orb; o.a += o.w * dt; o.r = Math.max(0, o.r + o.vr * dt); o.vr *= Math.exp(-1.4 * dt);
          p.x = o.cx + Math.cos(o.a) * o.r; p.z = o.cz + Math.sin(o.a) * o.r; p.y += p.vy * dt; p.vy *= Math.exp(-.8 * dt);
        } else {
          p.vx *= dr; p.vz *= dr; if (p.drag) p.vy *= dr;
          p.x += p.vx * dt; p.y += p.vy * dt; p.z += p.vz * dt;
        }
        const k = p.life / p.max, tw = p.tw ? .55 + .45 * Math.sin(T * p.tw + i) : 1;
        pPos[i * 3] = p.x; pPos[i * 3 + 1] = p.y; pPos[i * 3 + 2] = p.z;
        pCol[i * 3] = p.c[0]; pCol[i * 3 + 1] = p.c[1]; pCol[i * 3 + 2] = p.c[2];
        pSize[i] = p.s; pAlpha[i] = p.a * Math.min(1, k * 3) * Math.min(1, (1 - k) * 8) * tw;
      } else pAlpha[i] = 0;
    }
    const A = this.pg.attributes; A.position.needsUpdate = A.color.needsUpdate = A.size.needsUpdate = A.alpha.needsUpdate = true;
    // 光环、星印
    this.items = this.items.filter(it => {
      it.t += dt; const k = Math.min(1, it.t / it.dur); it.upd(k);
      if (k >= 1) { it.m.removeFromParent(); it.m.material.dispose(); if (it.m.geometry !== this.ringGeo) it.m.geometry.dispose(); return false; }
      return true;
    });
    // 引导微光：缓慢呼吸，偶尔升起一粒同色光尘
    this.beacons.forEach(b => {
      b.k += ((b.on ? 1 : 0) - b.k) * (1 - Math.exp(-dt * 2.5));
      b.m.material.opacity = b.k * (.2 + .1 * Math.sin(T * 2.2 + b.ph));
      b.m.visible = b.k > .01;
      b.mote -= dt;
      if (b.on && b.mote < 0) { b.mote = .5 + Math.random() * .7; this.emit(b.x + (Math.random() - .5) * .35, b.y - .2, b.z + (Math.random() - .5) * .35, { vy: .35, life: 1.5, c: b.col, tw: 5, a: .9 }); }
    });
  }
  clear() {
    this.parts.forEach(p => p.life = 0);
    this.items.forEach(it => { it.m.removeFromParent(); it.m.material.dispose(); }); this.items = [];
    this.beacons.forEach(b => { b.m.removeFromParent(); b.m.material.dispose(); b.m.geometry.dispose(); }); this.beacons = [];
  }
}
