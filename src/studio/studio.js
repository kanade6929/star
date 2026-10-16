// Hug Studio · 调试模式（编辑器第 0 步）
// 网址加 ?edit 打开（只给电脑用）。在不改关卡结构的前提下：
//   判定：把格子碰撞、互动范围、光的触发点、复活点、区段分界画在画面上
//   画面：光照与后期的滑块、颜色，实时生效
//   试玩：跳章节、跳区段、Alt+点击传送、自由移动、时间快慢
//   批注：在场景里钉留言；「复制给 Claude」把改动和批注整理成一段文字
// 所有标记画在单独的 2D 图层上，不进游戏渲染，也不新建任何材质。
import * as THREE from 'three';
import { TUNE, TUNE_DEFAULT } from './tune.js';

const KEY = 'hugstudio1';
const CH = { 1: '星', 2: '月', 3: '太阳' };
const SLIDERS = [
  ['amb', '环境光', 0, 2.5, .01, '×'], ['moon', '月光', 0, 2.5, .01, '×'],
  ['orb', '星光亮度', 0, 2, .01, '×'], ['orbR', '星光照射距离', .3, 2, .01, '×'],
  ['bloom', '泛光强度', 0, 3, .01, '×'], ['thresh', '泛光门槛', .2, 1.5, .01, ''],
  ['dof', '景深模糊', 0, 3, .01, '×'], ['vig', '暗角', 0, 2.5, .01, '×'],
  ['pal', '像素色感（调色板吸附）', 0, .6, .01, '']
];
const COLORS = [['sky', '天光'], ['ground', '地面反光'], ['moon', '月光颜色'], ['orb', '星光颜色']];
const LAYERS = [
  ['grid', '格子碰撞（红=墙，蓝=虚空）', true], ['act', '走近互动的范围', true], ['orb', '光的触发点', true],
  ['safe', '复活点', true], ['node', '区段分界', true], ['num', '显示数值', true], ['pins', '批注', true], ['perf', '性能数字（左上角）', false]
];
const hex = c => '#' + new THREE.Color(c).getHexString();

export function initStudio(api) {
  const { P, orb, S, pipe, hemi, moon, orbLight, view } = api;
  let st = { tune: {}, colors: {}, notes: [], show: {}, open: true, tab: 'zone' };
  try { Object.assign(st, JSON.parse(localStorage.getItem(KEY)) || {}); } catch (e) {}
  const save = () => { try { localStorage.setItem(KEY, JSON.stringify(st)); } catch (e) {} };
  Object.assign(TUNE, st.tune);
  LAYERS.forEach(([k, , d]) => { if (st.show[k] === undefined) st.show[k] = d; });

  /* ---------- 画面上的标记图层 ---------- */
  const cv = document.createElement('canvas'); cv.id = 'hsOver';
  const g = cv.getContext('2d');
  document.body.appendChild(cv);
  let dpr = 1;
  function fit() { dpr = Math.min(2, devicePixelRatio || 1); cv.width = innerWidth * dpr; cv.height = innerHeight * dpr; }
  addEventListener('resize', fit); fit();
  const scr = (x, y, z) => { const [u, v] = api.toScreen(x, y, z); return [u * view.w, v * view.h]; };

  /* ---------- 面板 ---------- */
  const css = document.createElement('style');
  css.textContent = `
#hsOver{position:fixed;left:0;top:0;width:100%;height:100%;pointer-events:none;z-index:60}
#hs{position:fixed;top:10px;right:10px;bottom:10px;width:318px;z-index:70;display:flex;flex-direction:column;
  background:rgba(12,11,30,.9);border:1px solid rgba(232,201,142,.3);border-radius:8px;color:#e9e4f6;
  font:13px/1.5 "Noto Sans SC","PingFang SC","Microsoft YaHei",sans-serif;cursor:default;user-select:none;backdrop-filter:blur(4px)}
#hs *{cursor:inherit;box-sizing:border-box}
#hs button,#hs input,#hs label{cursor:pointer}
#hs textarea,#hs input[type=text]{cursor:text;user-select:text}
#hs.min{bottom:auto;width:auto}
#hs.min .hsBody,#hs.min .hsTabs,#hs.min .hsFoot{display:none}
#hs .hsHead{display:flex;align-items:center;gap:8px;padding:8px 10px;border-bottom:1px solid rgba(232,201,142,.2)}
#hs .hsHead b{font-family:"ZCOOL XiaoWei","Noto Serif SC",serif;font-weight:400;font-size:16px;color:#f4cf6a;letter-spacing:.06em}
#hs .hsHead span{color:#9d97bd;font-size:12px;flex:1}
#hs .hsTabs{display:flex;border-bottom:1px solid rgba(232,201,142,.2)}
#hs .hsTabs button{flex:1;padding:7px 0;background:none;border:0;color:#a8a2c8;font:inherit;border-bottom:2px solid transparent}
#hs .hsTabs button.on{color:#f4cf6a;border-bottom-color:#f4cf6a}
#hs .hsBody{flex:1;overflow:auto;padding:10px 12px;display:flex;flex-direction:column;gap:10px}
#hs .hsPane{display:none;flex-direction:column;gap:9px}
#hs .hsPane.on{display:flex}
#hs h4{margin:4px 0 0;font-size:12px;font-weight:500;color:#9d97bd;letter-spacing:.1em}
#hs .row{display:flex;align-items:center;gap:8px}
#hs .row input[type=range]{flex:1;accent-color:#f4cf6a;min-width:0}
#hs .row .v{width:46px;text-align:right;font-variant-numeric:tabular-nums;color:#f4cf6a}
#hs .row .v.ch{color:#ffb38a}
#hs .lab{display:flex;justify-content:space-between;color:#d6d0ea}
#hs .btns{display:flex;flex-wrap:wrap;gap:6px}
#hs .b{padding:5px 10px;border:1px solid rgba(232,201,142,.35);border-radius:5px;background:rgba(232,201,142,.06);color:#efe8dc;font:inherit}
#hs .b:hover{background:rgba(232,201,142,.16)}
#hs .b.on{background:#f4cf6a;color:#1b1838;border-color:#f4cf6a}
#hs .b.gold{background:#f4cf6a;color:#1b1838;border-color:#f4cf6a;font-weight:500}
#hs .b:focus-visible,#hs .hsTabs button:focus-visible{outline:2px solid #9fb2f2;outline-offset:1px}
#hs .chk{display:flex;gap:8px;align-items:center;color:#d6d0ea}
#hs .chk input{accent-color:#f4cf6a}
#hs .info{font:12px/1.6 ui-monospace,Consolas,monospace;color:#bfb9dc;white-space:pre-wrap;background:rgba(0,0,0,.25);padding:6px 8px;border-radius:5px}
#hs .tip{font-size:12px;color:#8f89b0}
#hs .note{display:flex;gap:6px;align-items:flex-start;padding:6px 8px;background:rgba(0,0,0,.25);border-radius:5px}
#hs .note p{margin:0;flex:1;min-width:0;word-break:break-all}
#hs .note small{color:#8f89b0;display:block}
#hs .note button{background:none;border:0;color:#8f89b0;font:inherit;padding:0 2px}
#hs textarea{width:100%;min-height:64px;resize:vertical;background:rgba(0,0,0,.3);color:#efe8dc;border:1px solid rgba(232,201,142,.3);border-radius:5px;padding:6px;font:inherit}
#hs input[type=color]{width:34px;height:22px;padding:0;border:1px solid rgba(232,201,142,.35);border-radius:4px;background:none}
#hs .hsFoot{padding:10px 12px;border-top:1px solid rgba(232,201,142,.2);display:flex;flex-direction:column;gap:6px}
#hs .toast{font-size:12px;color:#a8ec8a;min-height:18px}
body.hsPick #c{cursor:crosshair!important}
`;
  document.head.appendChild(css);
  const el = document.createElement('div'); el.id = 'hs';
  el.innerHTML = `
<div class="hsHead"><b>Hug Studio</b><span id="hsCh">调试模式</span><button class="b" id="hsMin" title="收起 / 展开（键盘 \` 键）">收起</button></div>
<div class="hsTabs">
  <button data-tab="zone">判定</button><button data-tab="look">画面</button><button data-tab="play">试玩</button><button data-tab="pin">批注</button>
</div>
<div class="hsBody">
  <div class="hsPane" data-pane="zone">
    <div id="hsLayers"></div>
    <div class="tip">光的触发点画在光点的高度上：光点进到圈里就算碰到。走近互动的范围画在地上：人站进圈里才能按 E。</div>
    <h4>此刻</h4><div class="info" id="hsInfo"></div>
  </div>
  <div class="hsPane" data-pane="look">
    <div id="hsSliders"></div>
    <h4>本章颜色</h4><div id="hsColors"></div>
    <div class="btns"><button class="b" id="hsResetLook">画面全部恢复原样</button></div>
  </div>
  <div class="hsPane" data-pane="play">
    <h4>章节</h4><div class="btns" id="hsChap"></div>
    <h4>跳到区段</h4><div class="btns" id="hsNodes"></div>
    <div class="btns"><button class="b" id="hsSkip">跳过开场</button><button class="b" id="hsTp">点击传送</button></div>
    <label class="chk"><input type="checkbox" id="hsFree"> 自由移动（穿墙、走过虚空不掉落）</label>
    <div class="lab"><span>时间速度</span><span class="v" id="hsSpeedV"></span></div>
    <div class="btns" id="hsSpeed"></div>
    <div class="tip">随时按住 Alt 点画面，主角就传送过去。</div>
  </div>
  <div class="hsPane" data-pane="pin">
    <div class="btns"><button class="b" id="hsAddPin">在画面上钉一条批注</button></div>
    <div id="hsPinNew" hidden><div class="tip">写下你想要的改动，回车保存：</div><textarea id="hsPinText" placeholder="例如：这盏灯的判定圈太偏右了"></textarea>
      <div class="btns"><button class="b gold" id="hsPinOk">保存</button><button class="b" id="hsPinNo">取消</button></div></div>
    <div id="hsPins" style="display:flex;flex-direction:column;gap:6px"></div>
  </div>
</div>
<div class="hsFoot">
  <button class="b gold" id="hsCopy">复制给 Claude</button>
  <div class="tip">把调过的参数、颜色和批注整理成一段文字，贴到线程里我就照着改进游戏。</div>
  <textarea id="hsOut" hidden readonly></textarea>
  <div class="toast" id="hsToast"></div>
</div>`;
  document.body.appendChild(el);
  const $ = id => el.querySelector('#' + id);
  // 面板里打字、按键不影响游戏
  ['keydown', 'keyup'].forEach(t => el.addEventListener(t, e => { if (e.key !== 'Escape') e.stopPropagation(); }));
  addEventListener('keydown', e => {
    if (e.target.closest && e.target.closest('#hs')) return;
    if (e.key === '`') { st.open = !st.open; syncOpen(); save(); }
  });
  let toastT = 0;
  const say = m => { $('hsToast').textContent = m; clearTimeout(toastT); toastT = setTimeout(() => $('hsToast').textContent = '', 3200); };
  function syncOpen() { el.classList.toggle('min', !st.open); $('hsMin').textContent = st.open ? '收起' : '展开'; }
  $('hsMin').onclick = () => { st.open = !st.open; syncOpen(); save(); };
  syncOpen();
  function setTab(t) {
    st.tab = t; save();
    el.querySelectorAll('.hsTabs button').forEach(b => b.classList.toggle('on', b.dataset.tab === t));
    el.querySelectorAll('.hsPane').forEach(p => p.classList.toggle('on', p.dataset.pane === t));
  }
  el.querySelectorAll('.hsTabs button').forEach(b => b.onclick = () => setTab(b.dataset.tab));
  setTab(st.tab);

  // 判定图层开关
  $('hsLayers').innerHTML = LAYERS.map(([k, n]) => `<label class="chk"><input type="checkbox" data-k="${k}"> ${n}</label>`).join('');
  $('hsLayers').querySelectorAll('input').forEach(i => { i.checked = st.show[i.dataset.k]; i.onchange = () => { st.show[i.dataset.k] = i.checked; save(); }; });

  // 画面滑块
  $('hsSliders').innerHTML = SLIDERS.map(([k, n, a, b, s]) =>
    `<div><div class="lab"><span>${n}</span><button class="b" data-reset="${k}" title="恢复原样" style="padding:0 6px;font-size:12px">复原</button></div>
     <div class="row"><input type="range" id="hsS_${k}" min="${a}" max="${b}" step="${s}"><span class="v" id="hsV_${k}"></span></div></div>`).join('');
  function syncSliders() {
    SLIDERS.forEach(([k, , , , , u]) => {
      $('hsS_' + k).value = TUNE[k];
      const v = $('hsV_' + k); v.textContent = (u === '×' ? '×' : '') + (+TUNE[k]).toFixed(2); v.classList.toggle('ch', TUNE[k] !== TUNE_DEFAULT[k]);
    });
  }
  SLIDERS.forEach(([k]) => { $('hsS_' + k).oninput = e => { TUNE[k] = +e.target.value; st.tune[k] = TUNE[k]; syncSliders(); save(); }; });
  el.querySelectorAll('[data-reset]').forEach(b => b.onclick = () => { const k = b.dataset.reset; TUNE[k] = TUNE_DEFAULT[k]; delete st.tune[k]; syncSliders(); save(); });
  syncSliders();

  // 本章颜色（覆盖关卡的 light 设置；换关时重新套用）
  const orig = {};
  function colorTargets(k) { return k === 'sky' ? [hemi.color] : k === 'ground' ? [hemi.groundColor] : k === 'moon' ? [moon.color] : [orbLight.color]; }
  function applyColors() {
    const c = st.colors[S.level] || {};
    COLORS.forEach(([k]) => { const v = c[k] ?? orig[S.level]?.[k]; if (v) colorTargets(k).forEach(t => t.set(v)); if (k === 'orb' && api.LV) api.LV.light.orb = new THREE.Color(v).getHex(); });
  }
  function buildColors() {
    const c = st.colors[S.level] || {};
    $('hsColors').innerHTML = COLORS.map(([k, n]) => `<div class="row"><span style="flex:1">${n}</span><span class="v ${c[k] ? 'ch' : ''}" style="width:auto">${c[k] ? '已改' : '原样'}</span>
      <input type="color" data-c="${k}" value="${c[k] || orig[S.level]?.[k] || '#ffffff'}"><button class="b" data-cr="${k}" style="padding:0 6px;font-size:12px" title="恢复原样">复原</button></div>`).join('');
    $('hsColors').querySelectorAll('[data-c]').forEach(i => i.oninput = () => { (st.colors[S.level] ||= {})[i.dataset.c] = i.value; applyColors(); save(); i.parentNode.querySelector('.v').textContent = '已改'; i.parentNode.querySelector('.v').classList.add('ch'); });
    $('hsColors').querySelectorAll('[data-cr]').forEach(b => b.onclick = () => { if (st.colors[S.level]) delete st.colors[S.level][b.dataset.cr]; applyColors(); buildColors(); save(); });
  }
  $('hsResetLook').onclick = () => {
    SLIDERS.forEach(([k]) => { TUNE[k] = TUNE_DEFAULT[k]; delete st.tune[k]; });
    delete st.colors[S.level]; applyColors(); buildColors(); syncSliders(); save(); say('本章画面已恢复原样');
  };

  // 试玩
  $('hsChap').innerHTML = [1, 2, 3].map(n => `<button class="b" data-ch="${n}">${n} ${CH[n]}</button>`).join('');
  $('hsChap').querySelectorAll('button').forEach(b => b.onclick = () => api.begin(+b.dataset.ch));
  $('hsSkip').onclick = () => api.skipIntro();
  $('hsFree').checked = TUNE.free;
  $('hsFree').onchange = e => { TUNE.free = e.target.checked; st.tune.free = TUNE.free || undefined; save(); };
  const SPEEDS = [.25, .5, 1, 2];
  $('hsSpeed').innerHTML = SPEEDS.map(s => `<button class="b" data-sp="${s}">×${s}</button>`).join('');
  function syncSpeed() { $('hsSpeed').querySelectorAll('button').forEach(b => b.classList.toggle('on', +b.dataset.sp === TUNE.speed)); $('hsSpeedV').textContent = '×' + TUNE.speed; }
  $('hsSpeed').querySelectorAll('button').forEach(b => b.onclick = () => { TUNE.speed = +b.dataset.sp; if (TUNE.speed === 1) delete st.tune.speed; else st.tune.speed = TUNE.speed; syncSpeed(); save(); });
  syncSpeed();

  function ground(x, z) { const L = api.LV; return !L.solid(x, z) && !L.hole(x, z); }
  function freeCell(x, z) {
    if (ground(x, z)) return [x, z];
    let best = null;
    for (let r = 1; r < 8 && !best; r++) for (let dz = -r; dz <= r; dz++) for (let dx = -r; dx <= r; dx++) {
      const cx = Math.floor(x) + dx + .5, cz = Math.floor(z) + dz + .5;
      if (ground(cx, cz)) { const d = Math.hypot(cx - x, cz - z); if (!best || d < best[2]) best = [cx, cz, d]; }
    }
    return best && [best[0], best[1]];
  }
  function teleport(x, z) {
    if (S.mode !== 'play') { if (S.mode === 'intro') api.skipIntro(); else { say('先进入章节再传送'); return; } }
    const p = TUNE.free ? [x, z] : freeCell(x, z);
    if (!p) { say('附近没有能站的地方'); return; }
    Object.assign(P, { x: p[0], z: p[1], y: 0, vx: 0, vz: 0, falling: false, fallT: 0, safe: [p[0], p[1]] });
    S.fadeTo = 0; api.snapCam();
  }
  function buildNodes() {
    const L = api.LV; if (!L) return;
    const xs = [L.spawn[0], ...(L.nodes || api.NODE_X[S.level] || []).map(x => x + 1.2)];
    $('hsNodes').innerHTML = xs.map((x, i) => `<button class="b" data-x="${x}">${i ? '区段 ' + i : '起点'}</button>`).join('');
    $('hsNodes').querySelectorAll('button').forEach(b => b.onclick = () => {
      const x = +b.dataset.x; let best = null;
      // 在分界线东边几列里，找最靠近出生点高度的可站格
      for (let dx = 0; dx < 8 && !best; dx++) for (let z = 0; z < L.MH; z++) {
        const cx = Math.floor(x) + dx + .5, cz = z + .5;
        if (ground(cx, cz) && (!best || Math.abs(cz - L.spawn[1]) < Math.abs(best[1] - L.spawn[1]))) best = [cx, cz];
      }
      if (best) teleport(best[0], best[1]);
    });
  }
  const ray = new THREE.Raycaster(), gp = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0), hit = new THREE.Vector3();
  function pickGround(cx, cy) {
    const nx = cx / view.w * 2 - 1, ny = -(cy / view.h) * 2 + 1;
    ray.setFromCamera(new THREE.Vector2(nx * pipe.w / (pipe.w + 2), ny * pipe.h / (pipe.h + 2)), api.cam);
    return ray.ray.intersectPlane(gp, hit);
  }
  let pick = null; // 'tp' | 'pin'
  function setPick(m) { pick = m; document.body.classList.toggle('hsPick', !!m); $('hsTp').classList.toggle('on', m === 'tp'); $('hsAddPin').classList.toggle('on', m === 'pin'); }
  $('hsTp').onclick = () => setPick(pick === 'tp' ? null : 'tp');
  api.canvas.addEventListener('pointerdown', e => {
    if (e.pointerType === 'touch') return;
    const mode = e.altKey ? 'tp' : pick; if (!mode) return;
    e.stopImmediatePropagation(); e.preventDefault();
    const h = pickGround(e.clientX, e.clientY); if (!h) return;
    if (mode === 'tp') { teleport(h.x, h.z); if (pick === 'tp') setPick(null); }
    else { pendingPin = [+h.x.toFixed(1), +h.z.toFixed(1)]; setPick(null); $('hsPinNew').hidden = false; $('hsPinText').value = ''; $('hsPinText').focus(); }
  }, true);

  // 批注
  let pendingPin = null;
  $('hsAddPin').onclick = () => { setTab('pin'); setPick(pick === 'pin' ? null : 'pin'); if (pick) say('在画面上点一下要批注的位置'); };
  function savePin() {
    const t = $('hsPinText').value.trim();
    if (t && pendingPin) { st.notes.push({ level: S.level, x: pendingPin[0], z: pendingPin[1], text: t, t: new Date().toISOString().slice(0, 16).replace('T', ' ') }); save(); }
    pendingPin = null; $('hsPinNew').hidden = true; buildPins();
  }
  $('hsPinOk').onclick = savePin;
  $('hsPinNo').onclick = () => { pendingPin = null; $('hsPinNew').hidden = true; };
  $('hsPinText').addEventListener('keydown', e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); savePin(); } });
  function buildPins() {
    const list = st.notes.map((n, i) => [n, i]).filter(([n]) => n.level === S.level);
    $('hsPins').innerHTML = list.length ? list.map(([n, i], j) => `<div class="note"><b style="color:#f4cf6a">${j + 1}</b><p>${esc(n.text)}<small>(${n.x}, ${n.z}) · ${n.t}</small></p>
      <button data-go="${i}" title="传送过去">去</button><button data-del="${i}" title="删除">✕</button></div>`).join('')
      : '<div class="tip">本章还没有批注。</div>';
    $('hsPins').querySelectorAll('[data-go]').forEach(b => b.onclick = () => { const n = st.notes[+b.dataset.go]; teleport(n.x, n.z + 1); });
    $('hsPins').querySelectorAll('[data-del]').forEach(b => b.onclick = () => { st.notes.splice(+b.dataset.del, 1); save(); buildPins(); });
  }
  const esc = s => s.replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);

  // 复制给 Claude
  $('hsCopy').onclick = () => {
    const L = api.LV, lines = [`【Hug Studio 调试记录】第 ${S.level} 章 ${CH[S.level]} · ${new Date().toLocaleString('zh-CN', { hour12: false })}`];
    const tuned = SLIDERS.filter(([k]) => TUNE[k] !== TUNE_DEFAULT[k]).map(([k, n, , , , u]) => `${n} ${u === '×' ? '×' + TUNE[k].toFixed(2) : TUNE[k].toFixed(2) + `（原 ${TUNE_DEFAULT[k]}）`}`);
    lines.push('画面：' + (tuned.length ? tuned.join('，') : '没有调整'));
    Object.entries(st.colors).forEach(([lv, c]) => {
      const e = COLORS.filter(([k]) => c[k]).map(([k, n]) => `${n} ${c[k]}（原 ${orig[lv]?.[k] || '?'}）`);
      if (e.length) lines.push(`第 ${lv} 章颜色：` + e.join('，'));
    });
    const notes = st.notes;
    if (notes.length) { lines.push('批注：'); notes.forEach((n, i) => lines.push(`${i + 1}. 第 ${n.level} 章 (${n.x}, ${n.z})：${n.text}`)); }
    lines.push(`主角位置：(${P.x.toFixed(1)}, ${P.z.toFixed(1)})，进度 ${L ? JSON.stringify(L.progress()) : '-'}`);
    lines.push('数据：' + JSON.stringify({ tune: st.tune, colors: st.colors, notes }));
    const text = lines.join('\n'), out = $('hsOut');
    out.value = text; out.hidden = false;
    const fallback = () => { out.focus(); out.select(); say('已选中全部文字，按 Ctrl+C 复制'); };
    try { navigator.clipboard.writeText(text).then(() => say('已复制，去线程里粘贴给我'), fallback); } catch (e) { fallback(); }
  };

  /* ---------- 每帧：画标记、套用倍率 ---------- */
  let infoT = 0;
  function ring(x, y, z, r, col, label, fill) {
    g.beginPath();
    for (let i = 0; i <= 48; i++) { const a = i / 48 * Math.PI * 2, [sx, sy] = scr(x + Math.cos(a) * r, y, z + Math.sin(a) * r); i ? g.lineTo(sx, sy) : g.moveTo(sx, sy); }
    if (fill) { g.fillStyle = fill; g.fill(); }
    g.strokeStyle = col; g.stroke();
    if (label) text(label, x, y, z - r, col);
  }
  function text(s, x, y, z, col) {
    const [sx, sy] = scr(x, y, z);
    g.font = '12px "Noto Sans SC","Microsoft YaHei",sans-serif'; g.textAlign = 'center';
    g.lineWidth = 3; g.strokeStyle = 'rgba(8,6,20,.85)'; g.strokeText(s, sx, sy - 4); g.fillStyle = col; g.fillText(s, sx, sy - 4); g.lineWidth = 1.5;
  }
  function dot(x, y, z, col, r = 4) { const [sx, sy] = scr(x, y, z); g.beginPath(); g.arc(sx, sy, r, 0, 7); g.fillStyle = col; g.fill(); }
  function line(a, b, col) { const p = scr(...a), q = scr(...b); g.beginPath(); g.moveTo(...p); g.lineTo(...q); g.strokeStyle = col; g.stroke(); }
  const num = v => st.show.num ? ' · r' + (+v).toFixed(2) : '';
  // orbNear 比较的是「看上去的位置」：y 高度的点要往画面上方挪 y·visK。触发圈画在光点高度上，光点进圈即触发
  const ORBC = 'rgba(244,207,106,.95)', ORBF = 'rgba(244,207,106,.10)';
  function orbRing(x, z, y, r, label) { const k = api.visK; ring(x, api.ORB_Y, z - y * k + api.ORB_Y * k, r, ORBC, label + num(r), ORBF); }

  let gridT = 0, gridC = null;
  function drawGrid() {
    const L = api.LV;
    if (!gridC || gridT <= 0) { // 机关会改变格子（石门、光桥），每 0.3 秒重新取样一次
      gridT = .3; gridC = [];
      for (let z = 0; z < L.MH; z++) for (let x = 0; x < L.MW; x++) { const s = L.solid(x + .5, z + .5), h = !s && L.hole(x + .5, z + .5); if (s || h) gridC.push([x, z, s]); }
    }
    gridC.forEach(([x, z, s]) => {
      const a = scr(x, 0, z), b = scr(x + 1, 0, z), c = scr(x + 1, 0, z + 1), d = scr(x, 0, z + 1);
      if (Math.max(a[0], c[0]) < -20 || Math.min(a[0], c[0]) > view.w + 20 || Math.max(a[1], c[1]) < -20 || Math.min(a[1], c[1]) > view.h + 20) return;
      g.beginPath(); g.moveTo(...a); g.lineTo(...b); g.lineTo(...c); g.lineTo(...d); g.closePath();
      g.fillStyle = s ? 'rgba(255,110,110,.12)' : 'rgba(110,150,255,.16)'; g.fill();
    });
  }
  function levelZones() {
    const L = api.LV, _ = L._ || {}, k = api.visK;
    if (S.level === 1) {
      (_.lamps || []).forEach((l, i) => { if (!l.lit) orbRing(l.x, l.z, 1.28, 1.7, `星灯 ${i + 1}`); });
      (_.anchors || []).forEach((a, i) => { if (!a.isle) orbRing(a.cx, a.cz, -.3, .95, `锚星 ${i + 1}`); });
      const r = _.rune, ob = _.ob;
      if (r && ob && !r.solved) { // 日晷：光、石碑、星纹三点一线（光离石碑 0.6~7，偏差 9° 以内）
        const dx = ob.x - r.x, dz = ob.z - r.z, d = Math.hypot(dx, dz), ux = dx / d, uz = dz / d, A = 9 * Math.PI / 180, y = api.ORB_Y;
        g.beginPath();
        [[.6, -A], [7, -A], [7, A], [.6, A]].forEach(([s, a], i) => { const c = Math.cos(a), sn = Math.sin(a), [sx, sy] = scr(ob.x + (ux * c - uz * sn) * s, y, ob.z + (uz * c + ux * sn) * s); i ? g.lineTo(sx, sy) : g.moveTo(sx, sy); });
        g.closePath(); g.fillStyle = ORBF; g.fill(); g.strokeStyle = ORBC; g.stroke();
        text('日晷：光放进这条扇形' + (st.show.num ? ' · 0.6~7 · ±9°' : ''), ob.x + ux * 3.5, y, ob.z + uz * 3.5, ORBC);
      }
    } else if (S.level === 2) {
      ring(orb.x, 0, orb.z, 9.6, 'rgba(159,178,242,.6)', '星光照射范围' + num(9.6));
      const dog = _.dog; if (dog && !S.solvedB) ring(dog.x, api.ORB_Y, dog.z, 3, ORBC, '犬：光在它南侧、照得到' + num(3), ORBF);
      ['qA', 'qB', 'qC', 'qD', 'qE'].forEach((n, i) => { const q = _[n]; if (q && !q.on) { dot(q.x, 0, q.z, ORBC); text(`月相石 ${i + 1}`, q.x, 0, q.z, ORBC); } });
    } else if (S.level === 3) {
      ring(orb.x, api.ORB_Y, orb.z, 6.5, 'rgba(255,190,140,.7)', '光能照进透镜的距离' + num(6.5));
      (_.L && _.L.hedge || []).forEach((f, i) => ring(f.x, api.ORB_Y, f.z, 2.6, 'rgba(168,236,138,.45)', i ? '' : '树篱：光靠近会让开' + num(2.6)));
      ['R1', 'R2', 'R3a', 'R3b'].forEach(n => { const r = _[n]; if (r && !r.on) { dot(r.cx, 0, r.cz, ORBC); text('受光花', r.cx, 0, r.cz, ORBC); } });
    }
    (L.sockets || []).forEach(s => { if (s.active()) ring(s.x, api.ORB_Y, s.z - (s.y || 0) * k + api.ORB_Y * k, s.r || .5, ORBC, '光的挂点' + num(s.r || .5), ORBF); });
  }

  let lastLV = null;
  api.onLevel = n => {
    const lg = api.LV.light;
    orig[n] ||= { sky: hex(lg.sky), ground: hex(lg.ground), moon: hex(lg.moon), orb: hex(lg.orb) };
    if (!api.LV.__hs) { // 自由移动：穿墙、不掉落
      const so = api.LV.solid, ho = api.LV.hole;
      api.LV.solid = function (x, z) { return !TUNE.free && so.call(this, x, z); };
      api.LV.hole = function (x, z) { return !TUNE.free && ho.call(this, x, z); };
      api.LV.__hs = true;
    }
    gridC = null; applyColors(); buildColors(); buildNodes(); buildPins();
    $('hsCh').textContent = `调试模式 · 第 ${n} 章 ${CH[n]}`;
  };

  api.frame = dt => {
    const L = api.LV; if (!L) return;
    api.PERF.on = st.show.perf; if (api.PERF.el) api.PERF.el.hidden = !st.show.perf;
    if (L !== lastLV) { lastLV = L; api.onLevel(S.level); }
    pipe.brightMat.uniforms.thresh.value = TUNE.thresh;
    pipe.compMat.uniforms.palK.value = TUNE.pal;
    orbLight.distance = 14 * TUNE.orbR;
    gridT -= dt;
    g.setTransform(dpr, 0, 0, dpr, 0, 0); g.clearRect(0, 0, view.w, view.h); g.lineWidth = 1.5;
    const inGame = S.mode === 'play' || S.mode === 'intro' || S.mode === 'paused' || S.mode === 'cut';
    if (inGame && pipe.w) {
      if (st.show.grid) drawGrid();
      if (st.show.node) (L.nodes || api.NODE_X[S.level] || []).forEach((x, i) => { line([x, 0, -1], [x, 0, L.MH + 1], 'rgba(207,227,255,.45)'); text(`区段 ${i + 1}`, x, 0, 0, 'rgba(207,227,255,.8)'); });
      if (st.show.act) L.nearest().forEach(o => ring(o.x, 0, o.z, o.r || 1.5, 'rgba(168,236,138,.85)', o.label + num(o.r || 1.5), 'rgba(168,236,138,.07)'));
      if (st.show.orb) { levelZones(); dot(orb.x, orb.y, orb.z, '#fff6dc', 3); line([orb.x, orb.y, orb.z], [orb.x, 0, orb.z], 'rgba(255,246,220,.5)'); }
      if (st.show.safe) { dot(P.safe[0], 0, P.safe[1], '#ff9ad0', 5); text('复活点', P.safe[0], 0, P.safe[1], '#ff9ad0'); }
      if (st.show.pins) st.notes.forEach((n, i) => { if (n.level !== S.level) return; dot(n.x, 0, n.z, '#f4cf6a', 6); text('✎ ' + (st.notes.filter(m => m.level === S.level).indexOf(n) + 1) + ' ' + n.text.slice(0, 14), n.x, 0, n.z, '#f4cf6a'); });
    }
    if ((infoT -= dt) <= 0) {
      infoT = .2;
      const c = L.cell ? L.cell(Math.floor(P.x), Math.floor(P.z)) : '?', n = L.nearest().find(o => Math.hypot(P.x - o.x, P.z - o.z) < (o.r || 1.5));
      $('hsInfo').textContent = `主角 (${P.x.toFixed(2)}, ${P.z.toFixed(2)})  格子「${c === ' ' ? '虚空' : c}」\n光点 (${orb.x.toFixed(2)}, ${orb.z.toFixed(2)})${orb.lock ? '  已挂在机关上' : ''}\n` +
        `可以互动：${n ? n.label : '无'}\n状态：${S.mode}  进度 ${JSON.stringify(L.progress())}`;
    }
  };
  return api;
}
