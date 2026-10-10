// 辰星夜 · 3D 像素光影 demo —— 第一幕「XVII 星」、第二幕「XVIII 月」
import * as THREE from 'three';
import { PixelPipeline, LAYER_FX, LAYER_SH_ORB, LAYER_SH_MOON } from './post.js';
import { billboard, tex, disposeGroup, makeEnv, SHAFT_T } from './common.js';
import { makeOrbStar } from './orbstar.js';
import { VoxChar } from './voxchar.js';
import { createAudio } from './audio.js';
import { FX } from './fx.js';
import { buildStar } from './level1.js';
import { buildMoon } from './level2.js';
import { buildSun } from './level3.js';

const $ = id => document.getElementById(id);
const clamp = (v, a, b) => v < a ? a : v > b ? b : v;
const lerp = (a, b, t) => a + (b - a) * t;
const smooth = (a, b, x) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };

/* ================= 渲染器 / 相机 ================= */
const canvas = $('c');
let renderer;
try { renderer = new THREE.WebGLRenderer({ canvas, antialias: false, powerPreference: 'high-performance' }); }
catch (e) { $('nogl').hidden = false; throw e; }
renderer.info.autoReset = false; // 每帧在主循环里清零：性能面板要看整帧（含阴影、倒影、后期）的绘制数
renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFShadowMap; renderer.shadowMap.autoUpdate = false;
const pipe = new PixelPipeline(renderer);
const scene = new THREE.Scene();
scene.environmentIntensity = .26; // 环境反射只留一点：暗处靠局部的强光来照亮
const cam = new THREE.OrthographicCamera(-1, 1, 1, -1, .1, 90);
// 镜头远近（「更多」里选）：远 = 俯视 58°；近 = 机位压低到 46°，更贴近主角
const ELEV_OF = { far: 58 * Math.PI / 180, near: 44 * Math.PI / 180 };
const ZOOM_OF = { far: 1, near: 1.22 };
const CUT_DZ = { far: 0, near: 1.4 }; // 过关演出：近镜头画面小一圈，镜头再往北一点，天上升起的月亮、太阳才完整 // 近：画面再拉近一些（俯角压低后地面纵深变长，拉近后纵深和远差不多，人物更大）
let ELEV0 = ELEV_OF.far;
const camDir = e => new THREE.Vector3(0, -Math.sin(e), -Math.cos(e));
const CAM_DIST = 30;
const camQuat = new THREE.Quaternion();
const _camM = new THREE.Matrix4();
function aimCamQuat() { camQuat.setFromRotationMatrix(_camM.lookAt(new THREE.Vector3(), camDir(ELEV0), new THREE.Vector3(0, 1, 0))); }
aimCamQuat();

// 手机竖着拿时，把整个游戏转 90° 横过来显示（全程横屏）
const TOUCH = matchMedia('(pointer: coarse)').matches;
const view = { rot: false, w: innerWidth, h: innerHeight };
function layoutView() {
  view.rot = TOUCH && innerHeight > innerWidth;
  view.w = view.rot ? innerHeight : innerWidth; view.h = view.rot ? innerWidth : innerHeight;
  const b = document.body, st = document.documentElement.style;
  b.classList.toggle('rot', view.rot);
  b.classList.toggle('short', view.h < 520);
  b.style.width = view.rot ? view.w + 'px' : ''; b.style.height = view.rot ? view.h + 'px' : '';
  // 用实际可见尺寸换算 vw/vh：手机浏览器地址栏伸缩时 1vh 不等于可见高度的 1%，会让贴边的文字和按钮错位
  st.setProperty('--vw', view.w / 100 + 'px'); st.setProperty('--vh', view.h / 100 + 'px'); st.setProperty('--W', innerWidth + 'px');
}
// 屏幕坐标 → 游戏画面坐标（竖屏旋转时换算）
function toView(cx, cy) { return view.rot ? [cy, innerWidth - cx] : [cx, cy]; }
// 设置：画质（高 / 中等）与光点皮肤。手机默认中等：画布不按高分屏放大，倒影和月光阴影隔帧更新
const SET_KEY = 'chenxingye3d_set';
const SET = { q: TOUCH ? 'mid' : 'high', skin: 'gold', fps: TOUCH ? '60' : 'max', cam: 'near' }; // 帧率默认：电脑无上限，手机 60；镜头默认近
try { Object.assign(SET, JSON.parse(localStorage.getItem(SET_KEY)) || {}); } catch (e) {}
if (!['max', '60', '30'].includes(SET.fps)) SET.fps = TOUCH ? '60' : 'max'; // 旧存档里的「自动」按设备默认
if (!ELEV_OF[SET.cam]) SET.cam = 'near';
ELEV0 = ELEV_OF[SET.cam]; aimCamQuat();
function saveSet() { try { localStorage.setItem(SET_KEY, JSON.stringify(SET)); } catch (e) {} }
function resize() {
  layoutView();
  pipe.quality = SET.q === 'mid' ? 1 : 0;
  pipe.resize(view.w, view.h, SET.q === 'mid' ? 1 : Math.min(devicePixelRatio || 1, 2));
  pipe.setupCamera(cam);
}
addEventListener('resize', resize); resize();
// 手机转屏、地址栏收起时尺寸会晚一点才稳定：再补几次
const relayout = () => { resize(); [120, 400, 900].forEach(t => setTimeout(resize, t)); };
addEventListener('orientationchange', relayout); if (window.visualViewport) visualViewport.addEventListener('resize', resize);

/* ================= 全局灯光（每关重新配色） ================= */
const hemi = new THREE.HemisphereLight(0x7470b0, 0x1a1028, .36); scene.add(hemi);
const moon = new THREE.DirectionalLight(0x8f9cff, .4);
moon.castShadow = true; moon.shadow.mapSize.set(1024, 1024);
Object.assign(moon.shadow.camera, { left: -16, right: 16, top: 16, bottom: -16, near: .5, far: 60 });
moon.shadow.bias = -.0003; moon.shadow.normalBias = .02;
moon.shadow.camera.layers.set(0); moon.shadow.camera.layers.enable(LAYER_SH_MOON);
scene.add(moon); scene.add(moon.target);
// 月光阴影跟着镜头走时，按阴影贴图的像素对齐，避免滚屏时影子边缘闪烁
const mR = new THREE.Vector3(), mU = new THREE.Vector3(), mF = new THREE.Vector3(), mC = new THREE.Vector3();
function snapMoon(c) {
  const d = LV.light.moonDir, D = new THREE.Vector3(d[0], 14, d[1]);
  mF.copy(D).negate().normalize(); mR.crossVectors(mF, new THREE.Vector3(0, 1, 0)).normalize(); mU.crossVectors(mR, mF);
  const tx = 32 / moon.shadow.mapSize.x;
  const a = Math.round(c.dot(mR) / tx) * tx, b = Math.round(c.dot(mU) / tx) * tx, f = c.dot(mF);
  mC.copy(mR).multiplyScalar(a).addScaledVector(mU, b).addScaledVector(mF, f);
  moon.target.position.copy(mC); moon.position.copy(mC).add(D);
}

/* ================= 灯光池 ================= */
// 关卡里不投影的点光源、聚光灯都是「虚拟灯」：每帧挑出照得到画面的那几盏，交给固定数量的真灯去画。
// 每个像素要算的灯从 14~17 盏降到最多 8+4 盏，关卡再大灯再多也不变；换关时灯数不变，不用为此重编着色器
const POOL_P = 8, POOL_S = 4, poolP = [], poolS = [];
for (let i = 0; i < POOL_P; i++) { const l = new THREE.PointLight(0xffffff, 0, 1, 1); l.userData.pool = true; scene.add(l); poolP.push(l); }
for (let i = 0; i < POOL_S; i++) { const l = new THREE.SpotLight(0xffffff, 0, 0, .5, .85, 1.2); l.userData.pool = true; scene.add(l, l.target); poolS.push(l); }
let virt = null; const poolStat = { p: 0, s: 0 };
const _lw = new THREE.Vector3(), _lt = new THREE.Vector3(), _sph = new THREE.Sphere(), _fr = new THREE.Frustum(), _m4 = new THREE.Matrix4();
function poolLights() {
  if (!virt) { virt = []; scene.traverse(o => { if ((o.isPointLight || o.isSpotLight) && !o.castShadow && !o.userData.pool) { o.visible = false; o.userData.wp = new THREE.Vector3(); o.userData.wt = new THREE.Vector3(); virt.push(o); } }); }
  scene.updateMatrixWorld(); cam.updateMatrixWorld();
  _fr.setFromProjectionMatrix(_m4.multiplyMatrices(cam.projectionMatrix, cam.matrixWorldInverse));
  const cP = [], cS = [];
  for (const l of virt) {
    if (l.intensity <= 1e-4 || !l.parent) continue;
    let v = true; for (let q = l.parent; q && v; q = q.parent) v = q.visible; if (!v) continue;
    const U = l.userData; U.wp.setFromMatrixPosition(l.matrixWorld);
    if (l.isSpotLight) { U.wt.setFromMatrixPosition(l.target.matrixWorld); _sph.center.copy(U.wt); _sph.radius = U.wp.distanceTo(U.wt) * Math.tan(l.angle) * 1.2 + 1; }
    else { _sph.center.copy(U.wp); _sph.radius = (l.distance || 60) + .5; }
    if (!_fr.intersectsSphere(_sph)) continue;
    U.d = _sph.center.distanceToSquared(camFocus) - _sph.radius * _sph.radius * .25;
    (l.isSpotLight ? cS : cP).push(l);
  }
  poolStat.p = cP.length; poolStat.s = cS.length;
  // 超出数量时留离画面中心近的（性能面板会提示，按预算不应发生）
  if (cP.length > POOL_P) cP.sort((a, b) => a.userData.d - b.userData.d);
  if (cS.length > POOL_S) cS.sort((a, b) => a.userData.d - b.userData.d);
  poolP.forEach((r, i) => { const l = cP[i]; if (!l) { r.intensity = 0; return; }
    r.color.copy(l.color); r.intensity = l.intensity; r.distance = l.distance; r.decay = l.decay; r.position.copy(l.userData.wp); });
  poolS.forEach((r, i) => { const l = cS[i]; if (!l) { r.intensity = 0; return; }
    r.color.copy(l.color); r.intensity = l.intensity; r.distance = l.distance; r.decay = l.decay; r.angle = l.angle; r.penumbra = l.penumbra;
    r.position.copy(l.userData.wp); r.target.position.copy(l.userData.wt); });
}

/* ================= 角色 ================= */
// 主角是真正立体的体素小人：正面、侧面、背面都是同一个身体，直接投出和身形一致的影子
const pc = new VoxChar();
const player = new THREE.Group(); scene.add(player); player.add(pc.group);
pipe.normalExtra = (r, c) => { if (pc.group.parent && player.visible) pc.renderNormals(r, c); };
// 角色不参与法线描边，但两种光都能用它投影
pc.group.traverse(o => { if (o.isMesh) { o.layers.set(LAYER_FX); o.layers.enable(LAYER_SH_ORB); o.layers.enable(LAYER_SH_MOON); } });
const P = { x: 2.5, z: 7.5, dir: 'down', vx: 0, vz: 0, run: 0, moving: false, falling: false, fallT: 0, y: 0, safe: [2.5, 7.5], crouch: 0, lie: false, act: null, actT: 0 };

/* ================= 光点（鼠标即光源） ================= */
const ORB_Y = 1.6;
// 光点浮在半空：俯视镜头下，它「看起来」盖住的是更北边一点的地面。机关判定按画面上的重合来算
let VIS_K = 1 / Math.tan(ELEV0);
// 切换镜头远近：俯角、机关的画面重合判定、朝向镜头的光晕一起换，下一帧镜头就到新机位
function applyCam() {
  const q0 = camQuat.clone();
  ELEV0 = ELEV_OF[SET.cam]; VIS_K = 1 / Math.tan(ELEV0); aimCamQuat();
  if (S.mode !== 'menu') { pipe.setZoom(1, ZOOM_OF[SET.cam]); pipe.setupCamera(cam); }
  // 暂停菜单里切换：游戏不跑 update，这里直接把镜头摆到新机位，背后的画面马上变
  if (S.mode === 'paused') { S.elev = ELEV0; pipe.snap(cam, camFocus.clone().add(new THREE.Vector3(0, 0, -.6)), camDir(ELEV0), CAM_DIST); cam.updateMatrixWorld(); shadowForce = 2; }
  if (Math.abs(q0.dot(camQuat)) > .999999) return;
  scene.traverse(o => { if (Math.abs(o.quaternion.dot(q0)) > .99999) o.quaternion.copy(camQuat); });
}
function orbNear(x, z, y = 0) { return Math.hypot(orb.x - x, (orb.z - ORB_Y * VIS_K) - (z - y * VIS_K)); }
const orb = { x: 6, z: 6, tx: 6, tz: 6, y: ORB_Y, g: new THREE.Group(), lift: 0, lock: null, k: 1, held: 0, px: 6, pz: 6 };
const orbLight = new THREE.PointLight(0xffd88e, 7, 14, 1.38);   // 衰减放缓一点：光圈比以前大一圈，近处亮度不变
orbLight.castShadow = true; orbLight.shadow.mapSize.set(1024, 1024); orbLight.shadow.bias = -.0006; orbLight.shadow.normalBias = .025;
orbLight.shadow.camera.near = .05; orbLight.shadow.camera.far = 13;
orbLight.shadow.camera.layers.set(0); orbLight.shadow.camera.layers.enable(LAYER_SH_ORB);
moon.shadow.autoUpdate = false;
// 画质切换：中等时光点阴影贴图减半（像素风的影子看不出差别），并重建阴影贴图
let shadowForce = 2; // 大于 0 时强制重画阴影贴图（贴图刚重建、刚换关）
function applyQuality() {
  const ms = SET.q === 'mid' ? 512 : 1024;
  if (orbLight.shadow.mapSize.x !== ms) { orbLight.shadow.mapSize.set(ms, ms); if (orbLight.shadow.map) { orbLight.shadow.map.dispose(); orbLight.shadow.map = null; } }
  shadowForce = 2; resize();
}
applyQuality();
orb.g.add(orbLight);
// 光点本体是一颗立体的四芒星，光晕是空气里的体积散射（不是贴图）
const orbStar = makeOrbStar(LAYER_FX); orb.g.add(orbStar.g); let orbGlow = 1;
// 星之彩棱：底色是暖金白（和金色星光同一个家族），在上面叠一层缓缓流过的七色色散：
// 红橙黄绿青蓝紫依次循环，只取三成多混进暖金里，所以整体仍偏暖、有整体感，又看得出折射的彩色
const PRISM_BASE = new THREE.Color(0xffdca6);
const PRISM_PAL = [0xff8f80, 0xffb070, 0xffe07a, 0xa8ec8a, 0x86dcea, 0x98aaff, 0xd09cff].map(h => new THREE.Color(h));
const PRISM7 = [...PRISM_PAL, PRISM_BASE, PRISM_BASE].map(c => { const s = c.clone().convertLinearToSRGB(); return [s.r, s.g, s.b]; });
function prismAt(t, out, k = .36) { // t 任意实数：沿光谱一圈圈循环，相邻色平滑过渡
  const n = PRISM_PAL.length, u = ((t / 6.2832 * n) % n + n) % n, i = Math.floor(u), f = u - i;
  out.copy(PRISM_PAL[i]).lerp(PRISM_PAL[(i + 1) % n], f * f * (3 - 2 * f));
  return out.lerp(PRISM_BASE, 1 - k);
}
const _goldC = new THREE.Color(); const lum = c => c.r * .2126 + c.g * .7152 + c.b * .0722;
const prismCol = new THREE.Color(), glowCol = new THREE.Color();
function applySkin() {
  orbStar.setSkin(SET.skin);
  if (SET.skin !== 'prism' && LV) { orbLight.color.set(LV.light.orb); orbStar.setColor(0xffc45a); }
}
scene.add(orb.g);

/* ================= 特效 ================= */
const fx = new FX(scene, camQuat);

/* ================= 主界面：星空里熟睡的她 ================= */
// 远离关卡的一小块浮空石台，下面就是第一幕的星空虚空
const DREAM = [-120, 7];
const dream = new THREE.Group(); dream.position.set(DREAM[0], 0, DREAM[1]); scene.add(dream);
{
  const stoneM = new THREE.MeshStandardMaterial({ color: 0x2a2858, roughness: .35, metalness: .15 });
  const goldM = new THREE.MeshStandardMaterial({ color: 0xc9a25a, roughness: .3, metalness: .8, emissive: 0x3a2a10, emissiveIntensity: .4 });
  const dais = new THREE.Mesh(new THREE.CylinderGeometry(1.55, 1.05, .5, 40), stoneM); dais.position.y = -.25; dais.receiveShadow = true; dream.add(dais);
  const under = new THREE.Mesh(new THREE.ConeGeometry(1.05, 1.5, 40), stoneM); under.rotation.x = Math.PI; under.position.y = -1.3; dream.add(under);
  const rim = new THREE.Mesh(new THREE.TorusGeometry(1.54, .035, 5, 64), goldM); rim.rotation.x = Math.PI / 2; rim.position.y = .01; dream.add(rim);
  const sig = new THREE.Mesh(new THREE.PlaneGeometry(2.9, 2.9), new THREE.MeshBasicMaterial({ map: fx.sigT.star, color: 0x5a5070, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, opacity: .55 }));
  sig.rotation.x = -Math.PI / 2; sig.position.y = .02; sig.layers.set(LAYER_FX); dream.add(sig);
  dream.userData.sig = sig;
  // 几块缓缓漂浮的碎星石
  dream.userData.shards = [[-2.8, -.4, -1.6, .22], [2.9, -.9, -1.2, .16], [-2.3, -1.4, 1.9, .13], [2.4, -.2, 1.5, .19], [.3, -1.8, -2.6, .12]].map(([x, y, z, r], i) => {
    const m = new THREE.Mesh(new THREE.OctahedronGeometry(r, 0), goldM); m.position.set(x, y, z); m.userData = { y, ph: i * 1.7 }; dream.add(m); return m;
  });
}
function updateDream(dt) {
  dream.visible = S.mode === 'menu' || S.fade > .5 && !document.body.classList.contains('playing');
  if (!dream.visible) return;
  dream.userData.sig.rotation.z += dt * .05;
  dream.userData.sig.material.opacity = .22 + Math.sin(T * .8) * .07;
  dream.userData.shards.forEach(m => { m.rotation.y += dt * .5; m.position.y = m.userData.y + Math.sin(T * .6 + m.userData.ph) * .15; });
  if (Math.random() < dt * 9) fx.swirl(DREAM[0] + (Math.random() - .5) * .8, .1 + Math.random() * .4, DREAM[1], .7 + Math.random() * 1.1, Math.random() < .5 ? [.8, .86, 1] : [1, .9, .7], { w: .5 + Math.random() * .5, vy: .12, life: 3.2, a: .7 });
}

/* ================= 状态 ================= */
let T = 0;
const S = { mode: 'menu', t: 0, level: 1, fade: 1, fadeTo: 0, endShown: false, ev: -1, introT: 0, cine: null, shakeT: 0, shakeA: 0, shakeD: 1, flash: 0,
  idle: { x: 0, z: 0, t: 0, tier: 0, key: '' }, bars: false, elev: ELEV0, hints: {} };
const AU = createAudio(on => { syncSound(); toast(on ? '琴声已开启' : '琴声已关闭', 1.4); });
// 页面不在眼前时不放音乐：切标签页、切应用、锁屏（手机电脑都算）；电脑上窗口失焦也算
{
  let away = false, blurred = false;
  const sync = () => AU.setHidden(document.hidden || away || blurred);
  document.addEventListener('visibilitychange', sync);
  addEventListener('pagehide', () => { away = true; sync(); });
  addEventListener('pageshow', () => { away = false; sync(); });
  if (!TOUCH) { addEventListener('blur', () => { blurred = true; sync(); }); addEventListener('focus', () => { blurred = false; sync(); }); }
  addEventListener('pointerdown', () => { if (blurred) { blurred = false; sync(); } }, true);
}

/* ================= UI 辅助 ================= */
let toastT = 0;
// 触屏上把"鼠标"的说法换成摇杆
const touchText = m => !TOUCH ? m : m.replace('移动鼠标', '推动右摇杆').replace('用鼠标', '用右摇杆').replace('晃动鼠标', '把右摇杆推到底').replace(/鼠标/g, '右摇杆')
  .replace(/按 ?E/g, '点「互动」').replace(/按 ?(Tab|Esc|M|Shift|空格)/g, '点按钮');
function toast(msg, dur = 3) { msg = touchText(msg); const el = $('toast'); el.textContent = msg; el.classList.add('on'); toastT = dur; }
// 常驻提示：每帧调用就一直显示；别的提示出现时先让它说完
function holdToast(msg) { msg = touchText(msg); if (toastT < .25 || $('toast').textContent === msg) toast(msg, .5); }
const promptEl = $('prompt');
const v3 = new THREE.Vector3();
function toScreen(x, y, z) {
  v3.set(x, y, z).project(cam);
  const fx_ = (pipe.w + 2) / pipe.w, fy = (pipe.h + 2) / pipe.h;
  return [(v3.x * fx_ + 1) / 2, (1 - v3.y * fy) / 2];
}
const tEbtn = $('tE'), tElab = $('tElab');
function showPrompt(label, x, y, z) {
  if (!label) { promptEl.classList.remove('on'); if (TOUCH && tEbtn.classList.contains('ready')) { tEbtn.classList.remove('ready'); tElab.textContent = '互动'; } return; }
  const [sx, sy] = toScreen(x, y, z);
  promptEl.style.left = (sx * view.w) + 'px'; promptEl.style.top = (sy * view.h) + 'px';
  promptEl.innerHTML = `<span class="key">E</span>${label}`; promptEl.classList.add('on');
  if (TOUCH && tElab.textContent !== label) tElab.textContent = label;
  if (TOUCH) tEbtn.classList.add('ready');
}
function updateHud() {
  if (!LV) return;
  const h = LV.hud();
  $('hudlabel').textContent = h.label;
  $('dots').innerHTML = h.dots.map(d => `<i class="${d ? 'on' : ''}"></i>`).join('');
  $('hudcard').textContent = LV.roman;
  $('hudcard').classList.toggle('have', h.have);
  $('cardline').textContent = h.line;
}
function shake(a, d = .5) { if (a >= S.shakeA * (S.shakeT / S.shakeD || 0)) { S.shakeA = a; S.shakeT = S.shakeD = d; } }
function flash(k) { S.flash = Math.max(S.flash, k); }
function setBars(on) { if (S.bars !== on) { S.bars = on; document.body.classList.toggle('cine', on); } }
// 仪式演出：锁住操作，镜头移到机关上，按步骤播放
function cine(steps) { S.cine = { steps, i: 0, t: 0, started: false }; setBars(true); }

/* ================= 关卡装载 ================= */
let LV = null, root = null;
const ctx = { THREE, camQuat, P, orb, orbNear, S, fx, AU, toast, holdToast, cine, shake, flash, hemi, moon, renderer, pipe, get T() { return T; }, get visK() { return VIS_K; }, updateHud };
const BUILDERS = { 1: buildStar, 2: buildMoon, 3: buildSun };
function loadLevel(n) {
  if (root) disposeGroup(root);
  virt = null;
  fx.clear();
  root = new THREE.Group(); scene.add(root); ctx.group = root;
  LV = BUILDERS[n](ctx);
  S.level = n;
  const lg = LV.light;
  hemi.color.set(lg.sky); hemi.groundColor.set(lg.ground); hemi.intensity = lg.hemi;
  moon.color.set(lg.moon); orbLight.color.set(lg.orb); orbStar.setColor(0xffc45a); applySkin();
  if (scene.environment) scene.environment.dispose();
  scene.environment = makeEnv(renderer, ...lg.env);
  pipe.setPalette(LV.palette, LV.tintLo, LV.tintHi);
  pipe.mirrorY = LV.mirrorY; pipe.hideInReflection = LV.hideInReflection || []; pipe.resetReflection();
  document.querySelector('#pause .proman').textContent = `${LV.roman}　${LV.name}`;
  const ch = $('chapter'); ch.querySelector('.num').textContent = LV.roman; ch.querySelector('.name').textContent = LV.name; ch.querySelector('.line').textContent = LV.motto;
  AU.setMood(LV.mood);
  needWarm = 2;
}

// 预热：关卡载入时把整关（包括还没出现的机关、特效）都完整渲染一遍，
// 让所有着色器和贴图提前编译、上传，走到下一个小场景时就不会突然卡一下
let needWarm = 0;
// 阴影着色器还会因为「投影物体有没有贴图、是不是实例化」分出不同版本：放一组隐形样本把这几种都覆盖到
const warmKit = new THREE.Group(); warmKit.visible = false; warmKit.position.set(0, -40, 0); scene.add(warmKit);
{
  const t = new THREE.DataTexture(new Uint8Array([255, 255, 255, 255]), 1, 1); t.needsUpdate = true;
  const g = new THREE.BoxGeometry(.01, .01, .01);
  [new THREE.MeshStandardMaterial(), new THREE.MeshStandardMaterial({ map: t })].forEach(m => {
    const a = new THREE.Mesh(g, m), b = new THREE.InstancedMesh(g, m, 1);
    [a, b].forEach(o => { o.castShadow = true; o.layers.enableAll(); warmKit.add(o); });
  });
}
function warmup() {
  const hid = [], fc = [], cs = [], ic = [], li = [], seen = new Set();
  const initTex = v => { if (v && v.isTexture && !seen.has(v)) { seen.add(v); renderer.initTexture(v); } };
  // 原本看不见的灯（如菜单梦境里的灯）预热时也保持关闭：灯光数量一变，所有着色器都要重编，预热就白做了
  const offL = []; scene.traverse(o => { if (o.isLight) { let v = true; for (let p = o; p; p = p.parent) v = v && p.visible; if (!v) offL.push(o); } });
  scene.traverse(o => {
    if (!o.visible) { hid.push(o); o.visible = true; }
    if (o.frustumCulled) { fc.push(o); o.frustumCulled = false; }
    if (o.isLight && o.castShadow && o.intensity < .01) { li.push([o, o.intensity]); o.intensity = 1; } // 熄灭的投影光也要把阴影着色器准备好
    if (o.isInstancedMesh && o.count === 0) { ic.push(o); o.count = 1; } // 还没长出来的体素也要预热
    if (o.isMesh && !o.castShadow) { cs.push(o); o.castShadow = true; } // 运行中才开始投影的物体也要预热阴影着色器
    if (o.material) (Array.isArray(o.material) ? o.material : [o.material]).forEach(m => {
      for (const k in m) initTex(m[k]);
      if (m.uniforms) for (const k in m.uniforms) initTex(m.uniforms[k].value);
    });
  });
  offL.forEach(o => o.visible = false);
  pipe.render(scene, cam, { time: T, fade: 1, focus: focusUV, dofK, flash: 0, vig, force: true });
  offL.forEach(o => o.visible = true);
  hid.forEach(o => o.visible = false); fc.forEach(o => o.frustumCulled = true); cs.forEach(o => o.castShadow = false); ic.forEach(o => o.count = 0); li.forEach(([o, v]) => o.intensity = v);
}

function resetLevel() {
  const [sx, sz] = LV.spawn;
  Object.assign(P, { x: sx, z: sz, dir: 'down', vx: 0, vz: 0, run: 0, moving: false, falling: false, fallT: 0, y: 0, safe: [sx, sz], crouch: 0, lie: false, act: null, actT: 0 });
  Object.assign(S, { t: 0, ev: -1, endShown: false, cine: null, hints: {} });
  S.idle = { x: sx, z: sz, t: 0, tier: 0, key: '' };
  orb.x = orb.tx = sx + 1; orb.z = orb.tz = sz; orb.lock = null; orb.k = 1;
  LV.reset();
  setBars(false);
  updateHud();
}

/* ================= 输入 ================= */
const keys = {};
const mouse = { nx: 0, ny: 0, seen: false, fresh: false };
addEventListener('keydown', e => {
  const k = e.key.toLowerCase();
  if (S.mode === 'menu') { menuKey(e, k); return; }
  keys[k] = true;
  if (['arrowup', 'arrowdown', 'arrowleft', 'arrowright', ' '].includes(k)) e.preventDefault();
  if (k === 'escape' && S.mode === 'paused' && inPauseMore()) { AU.back(); pauseMore(false); return; }
  if ((k === 'escape' && !mapOn || k === 'p') && k !== 'tab') { if (S.mode === 'play' || S.mode === 'intro') pause(); else if (S.mode === 'paused') resume(); }
  if (k === 'm' && !e.repeat) AU.toggle();
  if (k === 'tab') { e.preventDefault(); if (!e.repeat) toggleMap(); }
  if (k === 'escape' && mapOn) { toggleMap(false); return; }
  if ((k === 'e' || k === ' ' || k === 'enter') && !e.repeat) { if (S.mode === 'play' && !S.cine) interact(); else if (S.mode === 'intro' && S.introT > .6) skipIntro(); }
});
addEventListener('keyup', e => { keys[e.key.toLowerCase()] = false; });
addEventListener('blur', () => { for (const k in keys) keys[k] = false; });
canvas.addEventListener('pointermove', e => { if (e.pointerType === 'touch') return; setMouse(e.clientX, e.clientY); });
function setMouse(cx, cy) {
  const nx = cx / view.w * 2 - 1, ny = -(cy / view.h) * 2 + 1;
  if (!mouse.seen || Math.abs(nx - mouse.nx) * view.w + Math.abs(ny - mouse.ny) * view.h > 1.5) mouse.fresh = true;
  mouse.nx = nx; mouse.ny = ny; mouse.seen = true;
  ptrEl.style.transform = `translate(${cx}px,${cy}px)`;
}
const ptrEl = $('ptr');
const ray = new THREE.Raycaster(), plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), -ORB_Y), hit = new THREE.Vector3();
function screenWorld(nx, ny) {
  const fx_ = pipe.w / (pipe.w + 2), fy = pipe.h / (pipe.h + 2);
  ray.setFromCamera(new THREE.Vector2(nx * fx_, ny * fy), cam);
  return ray.ray.intersectPlane(plane, hit);
}
function mouseWorld() { return screenWorld(mouse.nx, mouse.ny); }
// 光点被留在原地时，只有快要离开画面才被画面边缘推着走
const vEdge = new THREE.Vector3();
function keepOrbInView() {
  vEdge.set(orb.tx, ORB_Y, orb.tz).project(cam);
  const sx = vEdge.x * (pipe.w + 2) / pipe.w, sy = vEdge.y * (pipe.h + 2) / pipe.h, MX = .9, MY = .84;
  if (Math.abs(sx) <= MX && Math.abs(sy) <= MY) return false;
  const h = screenWorld(clamp(sx, -MX, MX), clamp(sy, -MY, MY));
  if (h) { orb.tx = h.x; orb.tz = h.z; }
  return true;
}
// 触屏：左半屏摇杆走路，右半屏摇杆推动光点（松手后光点留在原地）
const joy = { id: null, x: 0, y: 0, dx: 0, dz: 0 }, joyR = { id: null, x: 0, y: 0, dx: 0, dz: 0, t: 0 };
if (TOUCH) document.body.classList.add('touchdev');
const STICK_R = 42;
function stickEl(j) { return j === joy ? ['stick', 'knob'] : ['stick2', 'knob2']; }
function stickHome() {
  // 摇杆不用时停在两个下角，淡淡地提示位置
  [[joy, 'stick', 92, view.h - 92], [joyR, 'stick2', view.w - 180, view.h - 104]].forEach(([j, id, x, y]) => {
    if (j.id === null) { const el = $(id); el.style.left = x + 'px'; el.style.top = y + 'px'; el.classList.remove('on'); }
  });
}
addEventListener('resize', stickHome);
canvas.addEventListener('pointerdown', e => {
  if (e.pointerType !== 'touch') return;
  if (S.mode === 'intro' && S.introT > .6) { skipIntro(); return; }
  if (S.mode !== 'play') return;
  const [x, y] = toView(e.clientX, e.clientY);
  const j = x < view.w * .5 ? joy : joyR;
  if (j.id !== null) return;
  Object.assign(j, { id: e.pointerId, x, y, dx: 0, dz: 0 });
  const [s_, k_] = stickEl(j); const el = $(s_); el.style.left = x + 'px'; el.style.top = y + 'px'; el.classList.add('on');
  $(k_).style.transform = '';
});
canvas.addEventListener('pointermove', e => {
  if (e.pointerType !== 'touch') return;
  const j = e.pointerId === joy.id ? joy : e.pointerId === joyR.id ? joyR : null; if (!j) return;
  const [x, y] = toView(e.clientX, e.clientY);
  const dx = x - j.x, dy = y - j.y, d = Math.hypot(dx, dy);
  j.dx = dx / Math.max(d, STICK_R); j.dz = dy / Math.max(d, STICK_R);
  $(stickEl(j)[1]).style.transform = `translate(${j.dx * 24}px,${j.dz * 24}px)`;
});
const endJoy = e => { [joy, joyR].forEach(j => { if (e.pointerId === j.id) { j.id = null; j.dx = j.dz = 0; $(stickEl(j)[1]).style.transform = ''; } }); stickHome(); };
canvas.addEventListener('pointerup', endJoy); canvas.addEventListener('pointercancel', endJoy);
// 安卓：第一次点击时尝试全屏并锁定横屏
addEventListener('pointerdown', () => {
  if (!TOUCH || document.fullscreenElement || !document.documentElement.requestFullscreen) return;
  document.documentElement.requestFullscreen({ navigationUI: 'hide' }).then(() => screen.orientation && screen.orientation.lock && screen.orientation.lock('landscape').catch(() => {})).catch(() => {});
}, { once: true, capture: true });
$('tE').addEventListener('pointerdown', e => { e.preventDefault(); if (S.mode === 'play' && !S.cine) interact(); else if (S.mode === 'intro') skipIntro(); });
$('tP').addEventListener('pointerdown', e => { e.preventDefault(); if (S.mode === 'play') pause(); });
$('tM').addEventListener('pointerdown', e => { e.preventDefault(); toggleMap(); });
$('map').addEventListener('pointerdown', e => { e.preventDefault(); toggleMap(false); });
$('skip').addEventListener('pointerdown', e => { e.preventDefault(); e.stopPropagation(); if (S.mode === 'intro') skipIntro(); });

/* ================= 地图：Tab 打开，简约的俯视平面图 + 人物实时位置 + 还没拿到的牌和灯 ================= */
const mapEl = $('map'), mapC = $('mapc'), mapG = mapC.getContext('2d');
let mapOn = false, mapCS = 8, mapBase = null;
function toggleMap(on = !mapOn) {
  if (on && (S.mode !== 'play' || S.cine || !LV)) return;
  mapOn = on; mapEl.classList.toggle('on', on); mapEl.setAttribute('aria-hidden', on ? 'false' : 'true');
  if (on) { AU.hover && AU.hover(4); $('mapTitle').textContent = LV.name; $('mapLamp').textContent = LV.hud().label; mapBase = null; drawMap(); }
}
function drawMap() {
  const MW = LV.MW, MH = LV.MH;
  mapCS = Math.max(4, Math.floor(Math.min(view.w * .86 / MW, view.h * .5 / MH)));
  const cs = mapCS, W = MW * cs, H = MH * cs;
  if (mapC.width !== W || mapC.height !== H) { mapC.width = W; mapC.height = H; mapBase = null; }
  // 地形每 0.5 秒重算一次（门、桥、花海这些会变）
  if (!mapBase || T - mapBase.t > .5) {
    const c = mapBase && mapBase.c.width === W ? mapBase.c : Object.assign(document.createElement('canvas'), { width: W, height: H }), g = c.getContext('2d');
    g.clearRect(0, 0, W, H);
    for (let z = 0; z < MH; z++) for (let x = 0; x < MW; x++) {
      const solid = LV.solid(x + .5, z + .5), gr = !LV.hole(x + .5, z + .5) && LV.ground(x + .5, z + .5);
      if (solid) { g.fillStyle = 'rgba(232,201,142,.45)'; g.fillRect(x * cs, z * cs, cs, cs); }
      else if (gr) { g.fillStyle = 'rgba(239,232,220,.26)'; g.fillRect(x * cs, z * cs, cs, cs); }
    }
    mapBase = { c, t: T };
  }
  mapG.clearRect(0, 0, W, H); mapG.drawImage(mapBase.c, 0, 0);
  const pulse = .6 + .4 * Math.sin(T * 4);
  (LV.mapMarks ? LV.mapMarks() : []).forEach(m => {
    const x = m.x * cs, y = m.z * cs, r = Math.max(3, cs * .45);
    if (m.kind === 'card' && m.done) return;
    mapG.globalAlpha = m.done ? .35 : 1;
    if (m.kind === 'lamp') { mapG.fillStyle = m.done ? '#b8a070' : '#ffcf6a'; if (!m.done) { mapG.shadowColor = '#ffb84a'; mapG.shadowBlur = 8 * pulse; } mapG.beginPath(); mapG.arc(x, y, r * (m.done ? .6 : .8), 0, 7); mapG.fill(); }
    else if (m.kind === 'card') { mapG.fillStyle = '#f4ead8'; mapG.shadowColor = '#fff'; mapG.shadowBlur = 6 * pulse; mapG.save(); mapG.translate(x, y); mapG.rotate(Math.PI / 4); mapG.fillRect(-r * .7, -r * .7, r * 1.4, r * 1.4); mapG.restore(); }
    else if (m.kind === 'goal') { mapG.strokeStyle = '#e8c98e'; mapG.lineWidth = 1.5; mapG.beginPath(); mapG.arc(x, y, r * 1.3, 0, 7); mapG.stroke(); }
    mapG.shadowBlur = 0; mapG.globalAlpha = 1;
  });
  // 光点与人物
  mapG.fillStyle = 'rgba(255,200,110,.85)'; mapG.beginPath(); mapG.arc(orb.x * cs, orb.z * cs, Math.max(2, cs * .25), 0, 7); mapG.fill();
  const px = P.x * cs, py = P.z * cs;
  mapG.fillStyle = 'rgba(232,106,74,.35)'; mapG.beginPath(); mapG.arc(px, py, Math.max(5, cs * .9) * (1 + .25 * pulse), 0, 7); mapG.fill();
  mapG.fillStyle = '#fff'; mapG.strokeStyle = '#e86a4a'; mapG.lineWidth = 2; mapG.beginPath(); mapG.arc(px, py, Math.max(3, cs * .45), 0, 7); mapG.fill(); mapG.stroke();
}

/* ================= 互动 ================= */
function nearest() {
  let best = null;
  LV.nearest().forEach(o => { const d = Math.hypot(P.x - o.x, P.z - o.z); if (d < (o.r || 1.5) && (!best || d < best.d)) best = { d, ...o }; });
  return best;
}
function interact() {
  const n = nearest(); if (!n) return;
  if (n.type === 'finale') { S.ev = 0; S.mode = 'cut'; AU.finale(); setBars(true); LV.finaleStart(); updateHud(); return; }
  LV.interact(n);
  // 抬手触碰机关：转向目标
  P.reachT = 0; P.reachYaw = (Math.abs(n.x - P.x) + Math.abs(n.z - P.z) > .15) ? Math.atan2(n.x - P.x, n.z - P.z) : null;
}
const REACH = .8;
function reachState(dt) {
  if (P.reachT == null) return null;
  P.reachT += dt; const t = P.reachT;
  if (t > REACH || P.lie || P.falling) { P.reachT = null; return null; }
  const e = x => x * x * (3 - 2 * x);
  const k = t < .18 ? e(t / .18) : t < .5 ? 1 : 1 - e((t - .5) / (REACH - .5));
  const tap = t > .16 && t < .4 ? Math.sin((t - .16) / .24 * Math.PI) : 0;
  // 指尖碰到的一瞬：一小簇光点
  if (t >= .28 && t - dt < .28) { const a = P.reachYaw ?? pc.yawA; fx.burst(P.x + Math.sin(a) * .45, P.y + .75, P.z + Math.cos(a) * .45, 8, { c: [1, .92, .7], sp: .5, life: .5, g: 0, up: .2 }); }
  return { k, tap, yaw: P.reachYaw };
}

/* ================= 移动与坠落 ================= */
function blocked(x, z) { const r = .26; return LV.solid(x - r, z - r) || LV.solid(x + r, z - r) || LV.solid(x - r, z + r) || LV.solid(x + r, z + r); }
function updatePlayer(dt, canMove) {
  if (P.falling) {
    P.fallT += dt; P.y = -P.fallT * P.fallT * 9;
    if (LV.onFallFrame) LV.onFallFrame(P);
    if (P.fallT > .45 && S.fadeTo === 0) S.fadeTo = 1;
    if (P.fallT > .9) {
      // 就近复活：回到最后一次站稳的地面
      P.falling = false; P.fallT = 0; P.y = 0; P.x = P.safe[0]; P.z = P.safe[1]; P.vx = P.vz = 0;
      // 复活点本身已经没了（例如脚下的浮岛被叫走、池水退了）：就近找一块实地
      if (LV.hole(P.x, P.z)) {
        let best = null, bd = 1e9;
        for (let dz = -8; dz <= 8; dz++) for (let dx = -8; dx <= 8; dx++) { const x = Math.floor(P.x) + dx + .5, z = Math.floor(P.z) + dz + .5, d = dx * dx + dz * dz; if (d < bd && !LV.hole(x, z) && LV.ground(x, z) && !blocked(x, z)) { bd = d; best = [x, z]; } }
        if (best) { P.x = best[0]; P.z = best[1]; P.safe = best; }
      }
      if (!orb.lock) { orb.x = orb.tx = P.x; orb.z = orb.tz = P.z; }
      S.fadeTo = 0;
      fx.swirl(P.x, .4, P.z, .6, [.8, .85, 1]);
    }
    return;
  }
  let ix = 0, iz = 0;
  if (canMove) {
    if (keys.a || keys.arrowleft) ix -= 1; if (keys.d || keys.arrowright) ix += 1;
    if (keys.w || keys.arrowup) iz -= 1; if (keys.s || keys.arrowdown) iz += 1;
    if (joy.id !== null) { ix += joy.dx; iz += joy.dz; }
  }
  const m = Math.hypot(ix, iz);
  const wantRun = (keys.shift || (joy.id !== null && m > .95)) ? 1 : 0;
  P.run = lerp(P.run, m > .15 ? wantRun : 0, 1 - Math.exp(-dt * 6));
  const sp = (3.0 + P.run * 2.2) / Math.max(1, m);
  // 带加速度的移动：起步和停下都有一点惯性
  const tx = m > .15 ? ix * sp : 0, tz = m > .15 ? iz * sp : 0, acc = m > .15 ? 14 : 18;
  P.vx += (tx - P.vx) * (1 - Math.exp(-dt * acc)); P.vz += (tz - P.vz) * (1 - Math.exp(-dt * acc));
  const dx = P.vx * dt, dz = P.vz * dt;
  // 防失足：站在实地上时，不会自己走出边缘，而是贴着边滑过去（斜着的窄桥也能顺着走）；只有脚下的路自己消失了才会掉下去
  const safeHere = !LV.hole(P.x, P.z);
  const okAt = (x, z) => !blocked(x, z) && !(safeHere && LV.hole(x, z));
  const slide = (x, z, d, alongX) => {
    if (okAt(x, z)) return [x, z];
    if (blocked(x, z) || !safeHere) return null;
    // 前面是空的：试着朝两侧偏一点，沿着边缘或斜桥继续走
    for (const s of [1, -1]) { const nx = alongX ? x : x + s * Math.abs(d) * .9, nz = alongX ? z + s * Math.abs(d) * .9 : z; if (okAt(nx, nz) && !LV.hole(nx, nz)) return [nx, nz]; }
    return null;
  };
  let mv = Math.abs(dx) > 1e-6 ? slide(P.x + dx, P.z, dx, true) : null;
  if (mv) { P.x = mv[0]; P.z = mv[1]; } else if (Math.abs(dx) > 1e-6) P.vx = 0;
  mv = Math.abs(dz) > 1e-6 ? slide(P.x, P.z + dz, dz, false) : null;
  if (mv) { P.x = mv[0]; P.z = mv[1]; } else if (Math.abs(dz) > 1e-6) P.vz = 0;
  P.moving = Math.hypot(P.vx, P.vz) > .4;
  if (m > .15) P.dir = Math.abs(ix) > Math.abs(iz) * 1.1 ? (ix > 0 ? 'right' : 'left') : (iz > 0 ? 'down' : 'up');
  if (P.moving) {
    AU.step();
    if (LV.onStep) LV.onStep(P, dt);
    else if (P.run > .6 && Math.random() < dt * 14) fx.emit(P.x + (Math.random() - .5) * .3, .05, P.z + .1, { vy: .4, vx: -P.vx * .1, vz: -P.vz * .1, life: .5, c: [.55, .52, .7], a: .5, drag: 2 });
  }
  // 踩空？
  if (LV.hole(P.x, P.z)) {
    P.falling = true; P.fallT = 0; AU.fall();
    if (LV.onFall) LV.onFall(P);
    return;
  }
  // 记录最后一次站稳的位置（四角都在实地上）
  const r = .3;
  if (LV.ground(P.x - r, P.z - r) && LV.ground(P.x + r, P.z - r) && LV.ground(P.x - r, P.z + r) && LV.ground(P.x + r, P.z + r)) P.safe = [P.x, P.z];
}

/* ================= 开场：躺在地上醒来 ================= */
const INTRO = { lie: 2.6, sit: 3.1, rub: 4.7, look: 6.5, stand: 7.1, cam: 8.3 };
function skipIntro() { if (S.introT < INTRO.stand) { S.introT = INTRO.stand; P.lie = false; P.act = null; P.crouch = 0; } }
function updateIntro(dt) {
  if (!S.loading) S.introT += dt; const t = S.introT;
  P.vx = P.vz = 0; P.moving = false; P.dir = 'down';
  if (t < INTRO.lie) { P.lie = true; P.crouch = 7; P.act = null; }
  else if (t < INTRO.sit) { if (P.lie) { P.lie = false; fx.burst(P.x, .3, P.z, 14, { c: [.75, .8, 1], sp: .8, life: .9, g: .2, up: .4 }); } P.crouch = 7; P.act = null; }
  else if (t < INTRO.rub) { P.act = 'rub'; P.actT = t - INTRO.sit; P.crouch = 7; }
  else if (t < INTRO.look) { P.act = 'look'; P.actT = (t - INTRO.rub); P.crouch = 7; }
  else if (t < INTRO.stand) { P.act = null; P.crouch = 7 * (1 - smooth(INTRO.look, INTRO.stand, t)); }
  else { P.crouch = 0; P.act = null; P.lie = false; }
  // 星光环绕
  if (t < INTRO.look) {
    const a = T * 1.5, r = 1.15 - smooth(0, INTRO.lie, t) * .2;
    orb.tx = P.x + Math.cos(a) * r; orb.tz = P.z + Math.sin(a) * r * .8;
    if (Math.random() < dt * 40) fx.swirl(P.x + (Math.random() - .5) * .2, .15 + Math.random() * .5, P.z, .5 + Math.random() * .7, Math.random() < .5 ? [.8, .86, 1] : [1, .9, .7], { w: 1.4 + Math.random(), vy: .22, life: 2.2 });
  } else { orb.tx = lerp(orb.tx, P.x + 1.1, .05); orb.tz = lerp(orb.tz, P.z - .2, .05); }
  if (t > 1.1 && !S.chShown) { S.chShown = true; const ch = $('chapter'); ch.classList.add('on'); setTimeout(() => ch.classList.remove('on'), 3600); }
  if (t > INTRO.stand + .2 && S.mode === 'intro') { S.mode = 'play'; setBars(false); $('hud').classList.add('on'); $('skip').classList.remove('on'); }
}

/* ================= 主更新 ================= */
const tmpV = new THREE.Vector3(), tmpM = new THREE.Vector3();
let camFocus = new THREE.Vector3(6, 0, 7); const camVel = new THREE.Vector3(), camD = new THREE.Vector3();
const focusUV = new THREE.Vector2(.5, .47);
let dofK = 1, vig = .55;
function update(dt) {
  if (mapOn) { if (S.mode !== 'play' || S.cine) toggleMap(false); else drawMap(); }
  T += dt; S.t += dt; SHAFT_T.value = T;
  const play = S.mode === 'play';
  const intro = S.mode === 'intro';
  if (intro) updateIntro(dt);
  // 仪式演出
  let cineFocus = null;
  if (S.cine) {
    const c = S.cine, st = c.steps[c.i];
    if (!c.started) { c.started = true; st.start && st.start(); }
    c.t += dt; st.run && st.run(Math.min(1, c.t / st.dur), dt, c.t);
    if (st.focus) cineFocus = st.focus;
    if (c.t >= st.dur) { st.end && st.end(); c.i++; c.t = 0; c.started = false; if (c.i >= c.steps.length) { S.cine = null; if (S.mode !== 'cut') setBars(false); } }
  }
  // 光点目标
  if (S.mode === 'menu') {
    const a = T * .55; orb.tx = DREAM[0] + Math.cos(a) * 1.75; orb.tz = DREAM[1] + .1 + Math.sin(a) * 1.2;
  } else if ((play || S.mode === 'cut') && (mouse.seen || joyR.id !== null)) {
    const h = mouse.seen ? mouseWorld() : null, rm = Math.hypot(joyR.dx, joyR.dz);
    if (orb.lock) {
      // 鼠标移开，或右摇杆推到底一会儿，光点离开轴心
      joyR.t = joyR.id !== null && rm > .8 ? joyR.t + dt : 0;
      if ((mouse.seen && mouse.fresh && Math.hypot(mouse.nx - orb.lockM[0], mouse.ny - orb.lockM[1]) > .2) || joyR.t > .35) { orb.lock = null; orb.unlockT = .6; AU.ghost(); }
    } else {
      orb.unlockT = Math.max(0, (orb.unlockT || 0) - dt);
      // 右摇杆：推着光点走，越推越快；松手就停在原地
      if (joyR.id !== null && rm > .12) { const sp = 7.5 * Math.pow(Math.min(1, rm), 1.6); orb.tx += joyR.dx / rm * Math.min(1, rm) * sp * dt; orb.tz += joyR.dz / rm * Math.min(1, rm) * sp * dt; orb.held = 1; }
      // 鼠标真的动了，光点才去鼠标那里；鼠标不动时光点留在原地（不跟着角色和画面走）
      else if (mouse.fresh && h) { orb.tx = h.x; orb.tz = h.z; orb.held = 1; }
      else orb.held = Math.max(0, orb.held - dt * 1.5);
      keepOrbInView();
      if (LV.constrainOrb) LV.constrainOrb(orb);
    }
  }
  mouse.fresh = false;
  // 机关插槽（可以是会动的）：光点停在附近就被挂走，之后跟着插槽走，直到鼠标/右摇杆把它取下
  if (play || S.mode === 'cut') {
    if (orb.lock) { orb.tx = orb.lock.x; orb.tz = orb.lock.z; }
    else if (!orb.unlockT && Math.hypot(orb.tx - orb.x, orb.tz - orb.z) < .3) (LV.sockets || []).forEach(s => { if (!orb.lock && orbNear(s.x, s.z, s.y || 0) < (s.r || .5) && s.active()) { orb.lock = s; orb.lockM = [mouse ? mouse.nx : 0, mouse ? mouse.ny : 0]; s.onLock && s.onLock(); } });
  }
  if (S.mode === 'cut' && LV.finaleOrb) { const f = LV.finaleOrb(S.ev); orb.tx = lerp(orb.tx, f[0], .03); orb.tz = lerp(orb.tz, f[1], .03); }
  const k = 1 - Math.exp(-dt * 11);
  orb.x += (orb.tx - orb.x) * k; orb.z += (orb.tz - orb.z) * k;
  // 光点靠近角色时自然升高，避免贴脸过曝
  const near = 1 - smooth(.4, 1.8, Math.hypot(orb.x - P.x, orb.z - P.z));
  orb.lift = lerp(orb.lift, S.mode === 'menu' || intro || orb.lock ? 0 : near * .8, 1 - Math.exp(-dt * 6));
  const bob = Math.sin(T * 2.2) * .06 + orb.lift;
  orb.y = ORB_Y + bob;
  orb.g.position.set(Math.round(orb.x * 32) / 32, Math.round(orb.y * 32) / 32, Math.round(orb.z * 32) / 32);
  // 光源本身不吸附像素格：否则光照和影子会随着一格一格跳动而闪烁
  orbLight.position.set(orb.x - orb.g.position.x, orb.y - orb.g.position.y, orb.z - orb.g.position.z);
  const fin = S.mode === 'cut' ? 1 - smooth(1, 3, S.ev) * .8 : 1;
  orb.k = (1 - near * (intro ? .55 : .35)) * fin * (S.mode === 'menu' ? .75 : 1);
  orbLight.intensity = (7 + Math.sin(T * 1.7) * .1) * orb.k;
  if (SET.skin === 'prism') {
    // 彩棱：在一组和谐的浅色之间缓缓来回流动；亮度按金色星光补齐，再略亮一点
    prismAt(T * .5, prismCol, .34); orbLight.color.copy(prismCol);
    orbLight.intensity *= clamp(lum(_goldC.set(LV.light.orb)) / Math.max(lum(prismCol), .05), 1, 1.3) * 1.04;
    orbStar.setColor(prismAt(T * .5 + 1.2, glowCol, .22));
  }
  orbGlow = fin * (intro ? .5 : S.mode === 'menu' ? .35 : 1 - near * .55);
  // 光尘拖尾：划得越快留下越多，沿路径均匀撒开
  const ov = Math.hypot(orb.x - orb.px, orb.z - orb.pz), mc = LV.light.mote;
  orb.dust = (orb.dust || 0) + dt * (16 + Math.min(ov / dt, 30) * 4.5);
  for (; orb.dust >= 1; orb.dust--) {
    const u = Math.random();
    fx.emit(lerp(orb.px, orb.x, u) + (Math.random() - .5) * .22, orb.y + (Math.random() - .5) * .22, lerp(orb.pz, orb.z, u) + (Math.random() - .5) * .22,
      { vy: -.12 - Math.random() * .15, vx: (Math.random() - .5) * .3, vz: (Math.random() - .5) * .3, drag: 1.5, life: .9 + Math.random() * .8, c: Math.random() < .25 ? [1, 1, 1] : SET.skin === 'prism' ? PRISM7[(Math.random() * PRISM7.length) | 0] : mc, s: Math.random() < .3 ? 2 : 1, a: .95, tw: 9 });
  }
  orb.px = orb.x; orb.pz = orb.z;

  if (play) updatePlayer(dt, !S.cine);
  if (play && !S.cine) { LV.logic(dt); idleHints(dt); nodeHints(); }
  if (S.mode === 'cut') { S.ev += dt; if (LV.finale(dt, S.ev) && !S.endShown) { S.endShown = true; endGame(); } }
  else { const amb = S.mode === 'menu' ? LV.light.hemi : LV.ambient(P); hemi.intensity = lerp(hemi.intensity, amb, 1 - Math.exp(-dt * 2)); moon.intensity = hemi.intensity * LV.light.moonK; }

  // 角色帧
  pc.update({ dir: P.dir, moving: P.moving && !P.falling, run: P.run, vx: P.falling ? 0 : P.vx, vz: P.falling ? 0 : P.vz, dt, lie: P.lie, crouch: P.crouch, act: P.act, actT: P.actT, reach: reachState(dt) });
  player.position.set(Math.round(P.x * 32) / 32, P.y, Math.round(P.z * 32) / 32); pc.U.foot.value.copy(player.position);

  LV.update(dt, T);
  updateDream(dt);
  fx.update(dt, T);

  // 相机：开场时压低视角、聚焦主角
  // 开场结束、黑边收起时视角不能一下跳回去：开场里按时间曲线走，之后接着平滑地回到正常俯角
  const lowT = intro ? 1 - smooth(INTRO.stand - .3, INTRO.cam, S.introT) : S.mode === 'menu' ? .7 : 0;
  S.lowK = intro || S.lowK === undefined ? lowT : lerp(S.lowK, lowT, 1 - Math.exp(-dt * 1.2));
  if (Math.abs(S.lowK - lowT) < 1e-4) S.lowK = lowT;
  const lowK = S.lowK;
  // 主界面的梦境镜头不受镜头远近影响；开场压低视角时，近镜头再往下压 12°（远镜头压 20°，都到 38° 或更低）
  const e0 = S.mode === 'menu' ? ELEV_OF.far : ELEV0, eLow = Math.min(e0 - 12 * Math.PI / 180, 38 * Math.PI / 180);
  S.elev = e0 - lowK * (e0 - eLow);
  const dir = camDir(S.elev);
  let target;
  if (S.mode === 'menu') target = tmpV.set(DREAM[0] + 5.2 + Math.sin(T * .1) * .25, 0, DREAM[1] - 1.1);
  else if (cineFocus) target = tmpV.set(cineFocus[0], 0, cineFocus[1]);
  else if (S.mode === 'cut') { const f = LV.finaleCam(S.ev), k = smooth(0, 2, S.ev); target = tmpV.set(lerp(P.x, f[0], k), 0, lerp(P.z, f[1] - CUT_DZ[SET.cam], k)); }
  else if (intro) target = tmpV.set(P.x, 0, P.z + .3 * lowK);
  else { const lk = .18 * Math.min(1, orb.held * 2); target = tmpV.set(P.x + (orb.x - P.x) * lk, 0, P.z + (orb.z - P.z) * lk); }
  // 镜头跟随用临界阻尼弹簧：换目标（演出结束回到主角）时速度连续，不会突然一顿；演出结束后跟随力度慢慢恢复
  const wT = cineFocus ? 2.4 : 6.5;
  S.camW = S.camW === undefined ? wT : lerp(S.camW, wT, 1 - Math.exp(-dt * 1.5));
  camVel.addScaledVector(camD.subVectors(target, camFocus), S.camW * S.camW * dt).multiplyScalar(1 / (1 + 2 * S.camW * dt));
  camFocus.addScaledVector(camVel, dt);
  const focusPt = camFocus.clone().add(new THREE.Vector3(0, 0, -.6 * (1 - lowK)));
  if (S.shakeT > 0) { S.shakeT -= dt; const a = S.shakeA * Math.max(0, S.shakeT / S.shakeD); focusPt.x += (Math.random() - .5) * a; focusPt.z += (Math.random() - .5) * a; }
  pipe.snap(cam, focusPt, dir, CAM_DIST);
  orbStar.update(dt, T, cam, Math.max(.35, orb.k), orbGlow);
  snapMoon(camFocus);
  if (LV.voidMat) LV.voidMat.uniforms.cam.value.set(camFocus.x, camFocus.z);
  // 景深焦点：开场时对准主角，其余时候在画面中央
  cam.updateMatrixWorld();
  const [fsx, fsy] = toScreen(P.x, .8, P.z);
  const menuM = S.mode === 'menu';
  focusUV.lerp(intro || menuM ? new THREE.Vector2(fsx, 1 - fsy) : new THREE.Vector2(.5, .47), 1 - Math.exp(-dt * 3));
  dofK = lerp(dofK, intro ? 1.6 : menuM ? 1.4 : 1, 1 - Math.exp(-dt * 2));
  vig = lerp(vig, menuM ? 1.25 : intro || S.cine ? 1.1 : .55, 1 - Math.exp(-dt * 2));
  S.flash *= Math.exp(-dt * 5);

  // 提示
  if (toastT > 0) { toastT -= dt; if (toastT <= 0) $('toast').classList.remove('on'); }
  if (lostT > 0) { lostT -= dt; if (lostT <= 0 || S.mode !== 'play') { lostT = 0; $('lost').classList.remove('on'); } }
  if (play && !P.falling && !S.cine) { const n = nearest(); n ? showPrompt(n.label, n.x, n.y, n.z) : showPrompt(null); } else showPrompt(null);
  S.fade = lerp(S.fade, S.fadeTo, 1 - Math.exp(-dt * (S.fadeTo ? 9 : 3)));
}

// 快走进下一个场景小节点时，身后还有牌没捡、灯没亮：温柔地提一句（每个节点只说一次）
// 节点位置按关卡的区段分界（关卡可以用 LV.nodes 覆盖）
const NODE_X = { 1: [23.5, 36.5, 49.5, 67, 88], 2: [18, 25, 40.5, 48.5, 55, 84], 3: [18, 35, 51, 64.6, 82] };
const LAMP_LEFT = { 星灯: '还有星灯没有亮', 月相: '还有月相石没有醒来', 日光: '还有日光没有被唤起' };
function nodeHints() {
  if (S.mode !== 'play' || S.cine || P.vx < .3 || !LV.mapMarks) return;
  const xs = LV.nodes || NODE_X[S.level] || [];
  const B = xs.find(b => P.x > b - 2.6 && P.x < b);
  if (B === undefined || S.hints['node' + B]) return;
  const left = LV.mapMarks().filter(m => !m.done && m.x < B && m.x < P.x - 3 && (m.kind === 'lamp' || m.kind === 'card'));
  S.hints['node' + B] = 1;
  if (!left.length) return;
  const card = left.some(m => m.kind === 'card'), lamp = left.some(m => m.kind === 'lamp');
  const lab = LV.hud().label, lampTxt = LAMP_LEFT[lab] || `还有${lab}在等你`;
  const msg = card && lamp ? `身后${lampTxt}，还落着一张牌。不急，想回去的话，路一直都在`
    : card ? '身后好像还落着一张牌，它在等你。不急，想回去的话，路一直都在'
    : `身后${lampTxt}。不急，想回去的话，路一直都在`;
  const el = $('lost'); el.textContent = msg; el.classList.add('on'); lostT = 5.5; AU.ghost();
}
let lostT = 0;

// 在一个地方停留太久：根据当前进度给出提示，先含蓄、再明确
function idleHints(dt) {
  const I = S.idle, key = LV.progress();
  if (Math.hypot(P.x - I.x, P.z - I.z) > 2.4 || key !== I.key) { I.x = P.x; I.z = P.z; I.t = 0; I.tier = 0; I.key = key; return; }
  I.t += dt;
  const H = LV.idle(P);
  if (!H) return;
  if (I.tier === 0 && I.t > 16) { I.tier = 1; toast(H[0], 5.5); AU.ghost(); }
  else if (I.tier === 1 && I.t > 36) { I.tier = 2; toast(H[1] || H[0], 6.5); AU.ghost(); }
}

/* ================= 菜单 / 流程 ================= */
const PROG_KEY = 'chenxingye3d';
let prog = { done: [] };
try { prog = JSON.parse(localStorage.getItem(PROG_KEY)) || prog; } catch (e) {}
function saveProg() { try { localStorage.setItem(PROG_KEY, JSON.stringify(prog)); } catch (e) {} }
const menu = $('menu');
function syncSound() { document.querySelectorAll('#vMore [data-snd]').forEach(b => b.setAttribute('aria-checked', (b.dataset.snd === 'on') === !!AU.on)); }
function nextLevel() { if (!prog.done.includes(1)) return 1; if (!prog.done.includes(2)) return 2; if (!prog.done.includes(3)) return 3; return 1; }
function refreshMenu() {
  [1, 2, 3].forEach(n => { document.querySelector(`.tcard[data-n="${n}"] .st`).textContent = prog.done.includes(n) ? '已完成' : '可进入'; });
  const nl = nextLevel();
  document.querySelector('#mainNav [data-act="start"] .sub').textContent = prog.done.includes(1) ? (nl === 2 ? '第二幕 月' : nl === 3 ? '第三幕 太阳' : '再走一次') : '';
}
let woke = false;
function wake() { if (woke) { AU.init(); return; } woke = true; AU.init(); menu.classList.add('awake'); }
addEventListener('pointerdown', wake, { capture: true });
addEventListener('keydown', wake, { capture: true });
function showView(v) {
  $('vMain').classList.toggle('off', v !== 'main'); $('vChap').classList.toggle('off', v !== 'chap'); $('vMore').classList.toggle('off', v !== 'more');
  if (v === 'more') { refreshMore(); setTimeout(() => document.querySelector('#vMore .seg [aria-checked="true"]').focus({ preventScroll: true }), 300); return; }
  const deck = $('deck');
  if (v === 'chap') { deck.classList.remove('dealt', 'picking'); deck.classList.add('dealing'); requestAnimationFrame(() => requestAnimationFrame(() => deck.classList.add('dealt'))); AU.deal(); setTimeout(() => deck.querySelector('.tcard:not(.locked)').focus(), 300); }
  else setTimeout(() => document.querySelector('#mainNav .vbtn').focus({ preventScroll: true }), 50);
}
function menuAct(act) {
  if (act === 'start') begin(nextLevel());
  else if (act === 'chapters') showView('chap');
  else if (act === 'more') showView('more');
}
function refreshMore() {
  document.querySelectorAll('#vMore [data-q]').forEach(b => b.setAttribute('aria-checked', b.dataset.q === SET.q));
  document.querySelectorAll('#vMore [data-skin]').forEach(b => b.setAttribute('aria-checked', b.dataset.skin === SET.skin));
  document.querySelectorAll('#vMore [data-fps]').forEach(b => b.setAttribute('aria-checked', b.dataset.fps === SET.fps));
  document.querySelectorAll('#vMore [data-cam]').forEach(b => b.setAttribute('aria-checked', b.dataset.cam === SET.cam));
  syncSound();
}
document.querySelectorAll('#vMore [data-snd]').forEach(b => b.addEventListener('click', () => { if ((b.dataset.snd === 'on') !== !!AU.on) AU.toggle(); syncSound(); }));
document.querySelectorAll('#vMore [data-fps]').forEach((b, i) => b.addEventListener('click', () => { if (SET.fps === b.dataset.fps) return; SET.fps = b.dataset.fps; saveSet(); refreshMore(); AU.hover(i + 2); }));
document.querySelectorAll('#vMore [data-cam]').forEach((b, i) => b.addEventListener('click', () => { if (SET.cam === b.dataset.cam) return; SET.cam = b.dataset.cam; saveSet(); applyCam(); refreshMore(); AU.hover(i + 3); }));
document.querySelectorAll('#vMore [data-q]').forEach((b, i) => b.addEventListener('click', () => { if (SET.q === b.dataset.q) return; SET.q = b.dataset.q; saveSet(); applyQuality(); refreshMore(); AU.hover(i + 2); }));
document.querySelectorAll('#vMore [data-skin]').forEach((b, i) => b.addEventListener('click', () => {
  if (SET.skin === b.dataset.skin) return; SET.skin = b.dataset.skin; saveSet(); applySkin(); refreshMore(); AU.hover(i + 4);
  fx.bloom(orb.x, orb.y, orb.z, 24, SET.skin === 'prism' ? [1, .88, .7] : [1, .85, .55], { w: 2, vr: 1.2, up: .3 });
}));
$('back2').addEventListener('click', () => { AU.back(); if (inPauseMore()) pauseMore(false); else showView('main'); });
document.querySelectorAll('.vbtn').forEach((b, i) => {
  b.addEventListener('click', () => { const a = b.dataset.act; if (b.closest('#pause')) pauseAct(a); else menuAct(a); });
  b.addEventListener('mouseenter', () => AU.hover(i));
});
document.querySelectorAll('.tcard').forEach(c => {
  c.addEventListener('click', () => {
    if (c.classList.contains('locked')) { c.classList.remove('nudge'); void c.offsetWidth; c.classList.add('nudge'); AU.locked(); return; }
    $('deck').classList.add('picking'); c.classList.add('chosen'); setTimeout(() => begin(+c.dataset.n), 650);
  });
  c.addEventListener('mouseenter', () => AU.hover(+c.dataset.n + 1));
});
$('back').addEventListener('click', () => { AU.back(); showView('main'); });
function menuKey(e, k) {
  if (k === 'escape' && (!$('vChap').classList.contains('off') || !$('vMore').classList.contains('off'))) { AU.back(); showView('main'); }
}
// 进关卡的黑屏加载：章节徽记缓缓画出，UI 一起隐去；预热完再淡出
const LOAD_INFO = {
  1: { num: 'XVII', name: '星', line: '星辰正在苏醒', c: '#cfe3ff', g: 'M0-34L7.5-11.5 24-24 11.5-7.5 34 0 11.5 7.5 24 24 7.5 11.5 0 34-7.5 11.5-24 24-11.5 7.5-34 0-11.5-7.5-24-24-7.5-11.5Z M0-7A7 7 0 1 1 0 7A7 7 0 1 1 0-7' },
  2: { num: 'XVIII', name: '月', line: '月影正在升起', c: '#cdb8ff', g: 'M8-31A32 32 0 1 0 8 31A25 25 0 1 1 8-31Z M22-8L24-2 30 0 24 2 22 8 20 2 14 0 20-2Z' },
  3: { num: 'XIX', name: '太阳', line: '日轮正在燃起', c: '#ffcf7a', g: 'M0-15A15 15 0 1 1 0 15A15 15 0 1 1 0-15 M0-23V-33 M0 23V33 M-23 0H-33 M23 0H33 M16.3-16.3L23.3-23.3 M-16.3 16.3L-23.3 23.3 M16.3 16.3L23.3 23.3 M-16.3-16.3L-23.3-23.3' },
};
let loadDone = null;
function showLoader(n) {
  const I = LOAD_INFO[n] || LOAD_INFO[1], L = $('loader');
  L.style.setProperty('--lc', I.c);
  $('ldNum').textContent = I.num; $('ldName').textContent = I.name; $('ldLine').textContent = I.line;
  $('ldGlyph').setAttribute('d', I.g);
  L.classList.remove('on', 'drawn'); void L.offsetWidth; // 重新触发描线动画
  L.classList.add('on'); L.setAttribute('aria-hidden', 'false');
  document.body.classList.add('loading');
}
function hideLoader() {
  const L = $('loader'); L.classList.remove('on'); L.setAttribute('aria-hidden', 'true');
  document.body.classList.remove('loading');
  S.loading = false; S.fadeTo = 0; loadDone = null;
}
function begin(n = 1) {
  AU.init(); endSplash(true);
  if (S.loading) return;
  S.loading = true; S.fadeTo = 1; showLoader(n);
  const t0 = performance.now();
  setTimeout(() => {
    if (!LV || S.level !== n) loadLevel(n);
    pipe.setZoom(1, ZOOM_OF[SET.cam]); pipe.setupCamera(cam);
    stickHome();
    resetLevel(); needWarm = 2; shadowForce = 2; // 黑屏时以游戏镜头再预热一遍
    menu.classList.add('hide'); document.body.classList.add('playing'); $('end').classList.remove('on');
    $('deck').classList.remove('picking'); document.querySelectorAll('.tcard').forEach(c => c.classList.remove('chosen'));
    S.mode = 'intro'; S.introT = 0; S.chShown = false; camFocus.set(P.x, 0, P.z); camVel.set(0, 0, 0);
    P.lie = true; P.crouch = 7;
    setBars(true);
    $('hud').classList.remove('on');
    $('skip').classList.toggle('on', prog.done.includes(n));
    AU.setMood(LV.mood);
    // 预热完成、徽记至少停留一会儿后再揭开
    loadDone = () => hideLoader();
    const wait = () => { if (!loadDone) return; if (needWarm || performance.now() - t0 < 2800) return setTimeout(wait, 80); loadDone(); };
    setTimeout(wait, 80);
  }, 1000);
}
const pauseEl = $('pause');
let pausedFrom = 'play';
function pause() { if (S.loading) return; pausedFrom = S.mode; S.mode = 'paused'; pauseEl.classList.remove('off'); document.body.classList.add('paused'); setTimeout(() => pauseEl.querySelector('.vbtn').focus(), 50); }
function resume() { if (inPauseMore()) pauseMore(false); S.mode = pausedFrom; pauseEl.classList.add('off'); document.body.classList.remove('paused'); document.activeElement && document.activeElement.blur(); }
function pauseAct(a) { if (a === 'resume') resume(); else if (a === 'menu') toMenu(); else if (a === 'more') pauseMore(true); }
// 暂停菜单里的「更多」：把同一个设置面板借到暂停层里显示
const vMore = $('vMore'), vMoreHome = vMore.parentNode;
function pauseMore(on) {
  if (on) { pauseEl.appendChild(vMore); pauseEl.classList.add('pmore'); vMore.classList.remove('off'); refreshMore(); setTimeout(() => document.querySelector('#vMore .seg [aria-checked="true"]').focus({ preventScroll: true }), 200); }
  else { pauseEl.classList.remove('pmore'); vMore.classList.add('off'); vMoreHome.appendChild(vMore); setTimeout(() => pauseEl.querySelector('[data-act="more"]').focus(), 50); }
}
const inPauseMore = () => pauseEl.classList.contains('pmore');
// 主界面：她躺在星空里的石台上熟睡，镜头更近
function toDream() {
  Object.assign(P, { x: DREAM[0] + .15, z: DREAM[1] + .2, lie: true, crouch: 0, act: null, dir: 'down' });
  orb.x = orb.tx = DREAM[0] + 1.5; orb.z = orb.tz = DREAM[1]; orb.px = orb.x; orb.pz = orb.z;
  camFocus.set(DREAM[0] + 4.7, 0, DREAM[1] - 1.1); camVel.set(0, 0, 0); S.lowK = .7;
  pipe.setZoom(1.25); pipe.setupCamera(cam);
}
function toMenu() {
  S.fadeTo = 1;
  setTimeout(() => {
    pauseEl.classList.add('off'); document.body.classList.remove('paused', 'playing'); $('end').classList.remove('on'); $('hud').classList.remove('on'); $('skip').classList.remove('on');
    if (S.level !== 1) loadLevel(1);
    resetLevel(); toDream(); S.mode = 'menu'; S.fadeTo = 0; menu.classList.remove('hide'); refreshMenu(); showView('main'); AU.setMood(0); setBars(false);
  }, 600);
}
function endGame() {
  const n = S.level;
  if (!prog.done.includes(n)) prog.done.push(n); saveProg();
  const E = LV.endCard;
  $('endRoman').textContent = LV.roman; $('endTitle').textContent = E.title; $('endLine').innerHTML = E.line;
  $('again2').textContent = n === 1 ? '前往月之章' : n === 2 ? '前往太阳之章' : '再走太阳之章';
  $('end').classList.add('on'); S.mode = 'end'; refreshMenu(); setBars(false);
  setTimeout(() => $('again2').focus(), 400);
}
$('again').addEventListener('click', toMenu);
$('again2').addEventListener('click', () => { $('end').classList.remove('on'); begin(S.level === 1 ? 2 : S.level === 2 ? 3 : 3); });

/* ================= 主循环 ================= */
let moonPending = true;
// 帧率：电脑默认无上限，手机默认 60；可选 30 帧；暂停时只画 10 帧
const PERF = { on: /[?&]perf\b/.test(location.search), el: null, n: 0, t0: 0, ms: 0, sh: 0, calls: 0, fps: 0 };
function fpsCap() {
  if (S.mode === 'paused' || document.body.classList.contains('loading')) return 10;
  if (SET.fps === '30') return 30;
  return SET.fps === 'max' ? 1000 : 60; // 无上限：跟着屏幕刷新率走
}
let last = performance.now(), lastDraw = 0;
function frame(now) {
  requestAnimationFrame(frame);
  const minDt = 1000 / fpsCap(), el = now - lastDraw;
  if (el < minDt - 1.5 && !needWarm) return;
  lastDraw = el < minDt * 2 ? now - (el % minDt) : now;
  const dt = clamp((now - last) / 1000, .001, .05); last = now;
  const w0 = performance.now();
  if (S.mode !== 'paused') update(dt);
  poolLights();
  // 暂停时画面静止：阴影贴图沿用上一帧（角色待机、漂浮的装饰每帧都在动，游戏中无法跳过）
  const dirty = S.mode !== 'paused' || needWarm > 0 || shadowForce > 0; if (shadowForce > 0) shadowForce--;
  if (dirty) moonPending = true;
  const moonNow = moonPending && (pipe.quality === 0 || pipe.frameN % 2 === 0 || needWarm > 0); // 中等画质：月光阴影隔帧更新
  moon.shadow.needsUpdate = moonNow; if (moonNow) moonPending = false;
  pipe.shadowDirty = dirty || moonNow;
  if (needWarm && pipe.w) { warmup(); needWarm--; } // 连续两帧：第一帧时有些阴影贴图才刚创建
  renderer.info.reset();
  pipe.render(scene, cam, { time: T, fade: S.fade, grade: 0, focus: focusUV, dofK, flash: S.flash, vig });
  perfTick(now, performance.now() - w0, pipe.shadowDirty);
}
// 帧率统计；网址加 ?perf 显示性能面板
function perfTick(now, ms, sh) {
  const P_ = PERF; P_.n++; P_.ms += ms; P_.sh += sh ? 1 : 0; P_.calls += renderer.info.render.calls;
  if (now - P_.t0 < 1000) return;
  const sec = (now - P_.t0) / 1000;
  if (P_.on) {
    if (!P_.el) { P_.el = document.createElement('div'); P_.el.style.cssText = 'position:fixed;left:6px;top:6px;z-index:99;font:11px/1.4 monospace;color:#cfe;background:rgba(0,0,0,.55);padding:4px 7px;border-radius:4px;pointer-events:none;white-space:pre'; document.body.appendChild(P_.el); }
    const R_ = renderer.info.render;
    P_.el.textContent = `${(P_.n / sec).toFixed(0)} fps (上限 ${fpsCap() > 100 ? '无' : fpsCap()})  CPU ${(P_.ms / P_.n).toFixed(1)}ms\n绘制 ${(P_.calls / P_.n).toFixed(0)}/帧  三角 ${(R_.triangles / 1000).toFixed(0)}k\n灯 ${poolStat.p}/${POOL_P}+${poolStat.s}/${POOL_S}  阴影重画 ${(100 * P_.sh / P_.n).toFixed(0)}%  画布 ${pipe.devW}×${pipe.devH}  像素 ${pipe.w}×${pipe.h}`;
  }
  P_.fps = P_.n / sec; P_.n = 0; P_.ms = 0; P_.sh = 0; P_.calls = 0; P_.t0 = now;
}
loadLevel(1); AU.setMood(0);
// 进主菜单就试着放背景音乐；浏览器不允许自动播放时，等第一次点击或按键再响
AU.init(); setTimeout(() => { if (AU.running && !woke) { woke = true; menu.classList.add('awake'); } }, 1500);
// 开场：先提示戴耳机，再是慢慢亮起的 Hug 工作室标志，然后才进主界面。点一下可以跳过
const splash = $('splash'), splashT = [];
function endSplash(fast) {
  if (splash.classList.contains('done')) return;
  splashT.forEach(clearTimeout);
  if (fast) splash.style.transition = 'opacity .5s ease';
  splash.classList.add('done'); menu.classList.add('intro');
}
// 等首帧（含着色器预热）画完再开始计时，免得慢设备上标志一闪而过
function runSplash() {
  if (splash.classList.contains('done')) return;
  splashT.push(setTimeout(() => $('sp1').classList.add('on'), 150));
  splashT.push(setTimeout(() => $('sp1').classList.remove('on'), 2900));
  splashT.push(setTimeout(() => $('sp2').classList.add('on'), 3900));
  splashT.push(setTimeout(() => endSplash(), 8600));
}
splash.addEventListener('pointerdown', () => endSplash(true));
addEventListener('keydown', () => endSplash(true), { capture: true });
resetLevel(); refreshMenu(); syncSound(); S.mode = 'menu'; S.fadeTo = 0;
toDream(); stickHome();
requestAnimationFrame(frame);
requestAnimationFrame(() => requestAnimationFrame(runSplash));
setTimeout(() => document.querySelector('#mainNav .vbtn').focus({ preventScroll: true }), 100);

// 调试/测试钩子
window.__G = { scene, AU, fx,
  sim(sec) { if (loadDone) loadDone(); for (let t = 0; t < sec; t += 1 / 30) update(1 / 30); return [S.mode, LV.progress(), P.x.toFixed(1), P.z.toFixed(1), P.falling]; },
  S, P, orb, PERF, SET, applyCam, poolLights, poolStat, nodeHints, get LV() { return LV; }, get mouse() { return mouse; }, set mouse(v) { mouse.seen = false; },
  begin, toMenu, interact, setMouse, mouseWorld, keys, update, pipe, cam, loadLevel, skipIntro, nearest, warmup, render() { pipe.render(scene, cam, { time: T, fade: S.fade, focus: focusUV, dofK, flash: S.flash, vig }); }
};
