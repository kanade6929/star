// Hug Studio · 底图编辑器（第四章用）
// 直接在游戏画面上涂格子：松开鼠标后整关按新底图重建，看到的就是游戏里的样子。
// 底图自动存在浏览器里；也可以复制成文字交给 Claude，或者存成文件。
import { TILES, PROPS, THEMES, defaultMap, normalizeMap } from '../levelmap.js';

const ALL = [...TILES, ...PROPS];
const nameOf = c => (ALL.find(t => t.c === c) || { name: c }).name;

export function initMapEditor(api, ui) {
  const { el, st, save, say, pickGround, scr, g } = ui;
  const { S, P } = api;
  const $ = id => el.querySelector('#' + id);
  let map = normalizeMap(st.map || defaultMap());
  const undo = [], redo = [];
  let tool = 'brush', brush = '.', size = 1;

  el.querySelector('[data-pane=map]').innerHTML = `
    <div id="hmOff"><div class="tip">底图编辑器用来画第四章。先打开它：</div>
      <div class="btns"><button class="b gold" id="hmOpen">打开第四章（编辑中）</button></div></div>
    <div id="hmOn" style="display:flex;flex-direction:column;gap:9px">
      <h4>地面</h4><div class="btns" id="hmTiles"></div>
      <h4>摆件</h4><div class="btns" id="hmProps"></div>
      <h4>工具</h4><div class="btns" id="hmTools"></div>
      <div class="row"><span>笔刷大小</span><span style="flex:1"></span><div class="btns" id="hmSize"></div></div>
      <div class="btns"><button class="b" id="hmUndo" title="Ctrl+Z">撤销</button><button class="b" id="hmRedo" title="Ctrl+Y">重做</button></div>
      <label class="chk"><input type="checkbox" id="hmFree"> 自由移动（画虚空时不会掉下去）</label>
      <div class="lab"><span>视野远近</span><span class="v" id="hmZoomV"></span></div>
      <div class="row"><input type="range" id="hmZoom" min=".45" max="1.22" step=".01"></div>
      <h4>这一章</h4>
      <div class="row"><span style="width:52px">画风</span><select id="hmTheme" style="flex:1"></select></div>
      <div class="row"><span style="width:52px">名字</span><input type="text" id="hmName" style="flex:1;min-width:0"></div>
      <div class="row"><span style="width:52px">一句话</span><input type="text" id="hmMotto" style="flex:1;min-width:0"></div>
      <div class="row"><span style="width:52px">大小</span><input type="number" id="hmW" min="8" max="200" style="width:64px"> × <input type="number" id="hmH" min="6" max="60" style="width:56px">
        <button class="b" id="hmSizeOk">改</button></div>
      <h4>保存与交接</h4>
      <div class="tip">每一笔都自动存在这台电脑的浏览器里。</div>
      <div class="btns"><button class="b" id="hmCopy">复制底图文字</button><button class="b" id="hmPaste">粘贴底图</button><button class="b" id="hmFile">存成文件</button><button class="b" id="hmOpenFile">打开文件</button></div>
      <textarea id="hmText" hidden placeholder="把底图文字粘贴到这里，然后点「载入」"></textarea>
      <div class="btns" id="hmLoadRow" hidden><button class="b gold" id="hmLoad">载入</button><button class="b" id="hmLoadNo">取消</button></div>
      <div class="btns"><button class="b" id="hmReset">恢复起始底图</button></div>
    </div>`;
  const sw = t => `<button class="b" data-t="${t.c === ' ' ? 'void' : t.c}" title="${t.name}"><i style="display:inline-block;width:10px;height:10px;border-radius:2px;margin-right:5px;vertical-align:-1px;background:${t.col};border:1px solid rgba(255,255,255,.25)"></i>${t.name}</button>`;
  $('hmTiles').innerHTML = TILES.map(sw).join('');
  $('hmProps').innerHTML = PROPS.map(sw).join('');
  const TOOLS = [['brush', '画笔'], ['rect', '矩形'], ['fill', '填充'], ['spawn', '出生点'], ['look', '只看不画']];
  $('hmTools').innerHTML = TOOLS.map(([k, n]) => `<button class="b" data-tool="${k}">${n}</button>`).join('');
  $('hmSize').innerHTML = [1, 2, 3].map(n => `<button class="b" data-sz="${n}">${n}</button>`).join('');
  $('hmTheme').innerHTML = Object.entries(THEMES).map(([k, t]) => `<option value="${k}">${t.label}</option>`).join('');
  function sync() {
    el.querySelectorAll('[data-t]').forEach(b => b.classList.toggle('on', (b.dataset.t === 'void' ? ' ' : b.dataset.t) === brush && tool !== 'spawn' && tool !== 'look'));
    el.querySelectorAll('[data-tool]').forEach(b => b.classList.toggle('on', b.dataset.tool === tool));
    el.querySelectorAll('[data-sz]').forEach(b => b.classList.toggle('on', +b.dataset.sz === size));
    $('hmTheme').value = map.theme; $('hmName').value = map.name || ''; $('hmMotto').value = map.motto || '';
    $('hmW').value = map.w; $('hmH').value = map.h;
    $('hmUndo').disabled = !undo.length; $('hmRedo').disabled = !redo.length;
    const on = S.level === 4; $('hmOff').hidden = on; $('hmOn').style.display = on ? 'flex' : 'none';
    $('hmFree').checked = api.TUNE.free;
  }
  el.querySelectorAll('[data-t]').forEach(b => b.onclick = () => { brush = b.dataset.t === 'void' ? ' ' : b.dataset.t; if (tool === 'spawn' || tool === 'look') tool = 'brush'; sync(); });
  el.querySelectorAll('[data-tool]').forEach(b => b.onclick = () => { tool = b.dataset.tool; sync(); });
  el.querySelectorAll('[data-sz]').forEach(b => b.onclick = () => { size = +b.dataset.sz; sync(); });
  $('hmOpen').onclick = () => {
    // 第一次打开：视野拉远一些、开自由移动，方便边走边画
    if (st.mapZoom == null) { st.mapZoom = .75; $('hmZoom').value = .75; $('hmZoomV').textContent = '0.75'; }
    if (st.tune.free === undefined && !api.TUNE.free) { api.TUNE.free = true; st.tune.free = true; }
    save(); api.begin(4);
  };
  $('hmFree').onchange = e => { api.TUNE.free = e.target.checked; st.tune.free = e.target.checked || undefined; save(); };
  const zoom0 = 1.22;
  $('hmZoom').value = st.mapZoom || zoom0; $('hmZoomV').textContent = (+$('hmZoom').value).toFixed(2);
  $('hmZoom').oninput = e => { st.mapZoom = +e.target.value; $('hmZoomV').textContent = st.mapZoom.toFixed(2); api.setView(st.mapZoom); save(); };

  /* ---------- 改图、撤销、重建 ---------- */
  let rebuildT = 0;
  function commit(next, msg) {
    undo.push(JSON.stringify(map)); if (undo.length > 120) undo.shift(); redo.length = 0;
    map = normalizeMap(next); st.map = map; save(); sync();
    clearTimeout(rebuildT); rebuildT = setTimeout(() => { if (S.level === 4) api.reload(); }, 30);
    if (msg) say(msg);
  }
  function step(from, to) {
    if (!from.length) return; to.push(JSON.stringify(map));
    map = normalizeMap(JSON.parse(from.pop())); st.map = map; save(); sync(); if (S.level === 4) api.reload();
  }
  $('hmUndo').onclick = () => step(undo, redo);
  $('hmRedo').onclick = () => step(redo, undo);
  addEventListener('keydown', e => {
    if (S.level !== 4 || !(e.ctrlKey || e.metaKey) || (e.target.closest && e.target.closest('input,textarea'))) return;
    const k = e.key.toLowerCase();
    if (k === 'z' && !e.shiftKey) { e.preventDefault(); step(undo, redo); } else if (k === 'y' || (k === 'z' && e.shiftKey)) { e.preventDefault(); step(redo, undo); }
  }, true);
  const setRows = (cells, c) => {
    const rows = map.rows.map(r => r.split(''));
    cells.forEach(([x, z]) => { if (x >= 0 && z >= 0 && x < map.w && z < map.h) rows[z][x] = c; });
    return { ...map, rows: rows.map(r => r.join('')) };
  };
  $('hmTheme').onchange = e => commit({ ...map, theme: e.target.value }, '画风已换：' + THEMES[e.target.value].label);
  $('hmName').onchange = e => commit({ ...map, name: e.target.value.trim() });
  $('hmMotto').onchange = e => commit({ ...map, motto: e.target.value.trim() });
  $('hmSizeOk').onclick = () => {
    const w = +$('hmW').value | 0, h = +$('hmH').value | 0;
    commit({ ...map, w, h }, `大小改成 ${w}×${h}（右边和下边增减）`);
  };
  $('hmReset').onclick = () => commit(defaultMap(), '已恢复起始底图，可以撤销');

  /* ---------- 存取 ---------- */
  const text = () => JSON.stringify({ ...map, rows: undefined }).replace(/}$/, ',"rows":[\n' + map.rows.map(r => JSON.stringify(r)).join(',\n') + '\n]}');
  function copy(s, ok) {
    const fb = () => { $('hmText').hidden = false; $('hmText').value = s; $('hmText').focus(); $('hmText').select(); say('已选中全部文字，按 Ctrl+C 复制'); };
    try { navigator.clipboard.writeText(s).then(() => say(ok), fb); } catch (e) { fb(); }
  }
  $('hmCopy').onclick = () => copy(text(), '底图已复制，可以贴给 Claude');
  $('hmPaste').onclick = () => { $('hmText').hidden = false; $('hmLoadRow').hidden = false; $('hmText').value = ''; $('hmText').focus(); };
  $('hmLoadNo').onclick = () => { $('hmText').hidden = true; $('hmLoadRow').hidden = true; };
  function load(s) {
    try { const d = JSON.parse(s); if (!d.rows) throw 0; commit(d, '底图已载入'); $('hmText').hidden = true; $('hmLoadRow').hidden = true; }
    catch (e) { say('这段文字不是底图，请复制完整再试'); }
  }
  $('hmLoad').onclick = () => load($('hmText').value);
  $('hmFile').onclick = async () => {
    if (!window.showSaveFilePicker) { copy(text(), '这个页面不能直接存文件，底图已复制成文字'); return; }
    try {
      const h = await showSaveFilePicker({ suggestedName: (map.name || '第四章') + '.hugmap.json', types: [{ description: 'Hug Studio 底图', accept: { 'application/json': ['.json'] } }] });
      const w = await h.createWritable(); await w.write(text()); await w.close(); say('已存到电脑');
    } catch (e) { if (e.name !== 'AbortError') copy(text(), '存文件没成功，底图已复制成文字'); }
  };
  $('hmOpenFile').onclick = async () => {
    if (!window.showOpenFilePicker) { $('hmPaste').onclick(); say('这个页面不能直接开文件，请把文字粘贴进来'); return; }
    try { const [h] = await showOpenFilePicker({ types: [{ description: 'Hug Studio 底图', accept: { 'application/json': ['.json'] } }] }); load(await (await h.getFile()).text()); }
    catch (e) { if (e.name !== 'AbortError') say('文件没能打开'); }
  };

  /* ---------- 在画面上涂 ---------- */
  let drag = null, hover = null;
  const cellAt = (cx, cy) => { const h = pickGround(cx, cy); return h && [Math.floor(h.x), Math.floor(h.z)]; };
  const active = () => ui.tab() === 'map' && S.level === 4 && tool !== 'look' && (S.mode === 'play' || S.mode === 'paused');
  function stamp(c, out) { const r = size - 1, o = Math.floor(r / 2); for (let dz = 0; dz <= r; dz++) for (let dx = 0; dx <= r; dx++) out.set((c[0] + dx - o) + ',' + (c[1] + dz - o), [c[0] + dx - o, c[1] + dz - o]); }
  function lineCells(a, b, out) { const n = Math.max(Math.abs(b[0] - a[0]), Math.abs(b[1] - a[1]), 1); for (let i = 0; i <= n; i++) stamp([Math.round(a[0] + (b[0] - a[0]) * i / n), Math.round(a[1] + (b[1] - a[1]) * i / n)], out); }
  function rectCells(a, b) { const out = new Map(); for (let z = Math.min(a[1], b[1]); z <= Math.max(a[1], b[1]); z++) for (let x = Math.min(a[0], b[0]); x <= Math.max(a[0], b[0]); x++) out.set(x + ',' + z, [x, z]); return out; }
  function flood(c) {
    const rows = map.rows, from = rows[c[1]] && rows[c[1]][c[0]]; if (from === undefined || from === brush) return [];
    const seen = new Set(), q = [c], out = [];
    while (q.length && out.length < 6000) { const [x, z] = q.pop(), k = x + ',' + z; if (seen.has(k) || x < 0 || z < 0 || x >= map.w || z >= map.h || rows[z][x] !== from) continue; seen.add(k); out.push([x, z]); q.push([x + 1, z], [x - 1, z], [x, z + 1], [x, z - 1]); }
    return out;
  }
  api.canvas.addEventListener('pointerdown', e => {
    if (e.button !== 0 || e.altKey || !active()) return;
    const c = cellAt(e.clientX, e.clientY); if (!c) return;
    e.stopImmediatePropagation(); e.preventDefault();
    if (tool === 'spawn') { if (c[0] < 0 || c[1] < 0 || c[0] >= map.w || c[1] >= map.h) return; commit({ ...map, spawn: [c[0] + .5, c[1] + .5] }, '出生点已设好'); return; }
    if (tool === 'fill') { const cells = flood(c); if (cells.length) commit(setRows(cells, brush), `填充了 ${cells.length} 格${nameOf(brush)}`); return; }
    drag = { a: c, b: c, cells: new Map() }; if (tool === 'brush') stamp(c, drag.cells);
    api.canvas.setPointerCapture(e.pointerId);
  }, true);
  api.canvas.addEventListener('pointermove', e => {
    if (!active()) { hover = null; return; }
    const c = cellAt(e.clientX, e.clientY); hover = c;
    if (!drag || !c) return;
    e.stopImmediatePropagation();
    if (tool === 'brush') lineCells(drag.b, c, drag.cells);
    drag.b = c;
  }, true);
  const end = () => {
    if (!drag) return;
    const cells = [...(tool === 'rect' ? rectCells(drag.a, drag.b) : drag.cells).values()];
    drag = null;
    if (cells.length) commit(setRows(cells, brush));
  };
  api.canvas.addEventListener('pointerup', end, true); api.canvas.addEventListener('pointercancel', () => { drag = null; }, true);

  // 叠加层：格线、正在涂的格子、鼠标所在格、出生点
  function quad(x, z, fill, stroke) {
    const a = scr(x, 0, z), b = scr(x + 1, 0, z), c = scr(x + 1, 0, z + 1), d = scr(x, 0, z + 1);
    g.beginPath(); g.moveTo(...a); g.lineTo(...b); g.lineTo(...c); g.lineTo(...d); g.closePath();
    if (fill) { g.fillStyle = fill; g.fill(); } if (stroke) { g.strokeStyle = stroke; g.stroke(); }
  }
  const colOf = c => (ALL.find(t => t.c === c) || { col: '#fff' }).col;
  ui.draw = () => {
    if (ui.tab() !== 'map' || S.level !== 4) return;
    g.lineWidth = 1;
    g.strokeStyle = 'rgba(207,227,255,.12)'; g.beginPath();
    for (let x = 0; x <= map.w; x++) { g.moveTo(...scr(x, 0, 0)); g.lineTo(...scr(x, 0, map.h)); }
    for (let z = 0; z <= map.h; z++) { g.moveTo(...scr(0, 0, z)); g.lineTo(...scr(map.w, 0, z)); }
    g.stroke();
    g.strokeStyle = 'rgba(244,207,106,.6)'; g.beginPath(); [[0, 0], [map.w, 0], [map.w, map.h], [0, map.h], [0, 0]].forEach((p, i) => i ? g.lineTo(...scr(p[0], 0, p[1])) : g.moveTo(...scr(p[0], 0, p[1]))); g.stroke();
    if (drag) { const cells = tool === 'rect' ? rectCells(drag.a, drag.b) : drag.cells; const f = colOf(brush) + 'aa'; cells.forEach(([x, z]) => quad(x, z, f, 'rgba(255,255,255,.5)')); }
    else if (hover && tool !== 'look') { const m = new Map(); tool === 'brush' || tool === 'rect' ? stamp(hover, m) : m.set('h', hover); m.forEach(([x, z]) => quad(x, z, tool === 'spawn' ? 'rgba(255,154,208,.3)' : colOf(brush) + '66', '#fff')); }
    const [sx, sy] = scr(map.spawn[0], 0, map.spawn[1]); g.beginPath(); g.arc(sx, sy, 6, 0, 7); g.fillStyle = '#ff9ad0'; g.fill();
    g.font = '12px "Noto Sans SC","Microsoft YaHei",sans-serif'; g.textAlign = 'center'; g.fillText('出生点', sx, sy - 10);
    if (hover) { const c = map.rows[hover[1]] && map.rows[hover[1]][hover[0]]; ui.status(`格子 (${hover[0]}, ${hover[1]})：${c === undefined ? '地图外' : nameOf(c)}`); }
  };
  ui.mapData = () => map;
  ui.mapText = text;
  ui.onLevelMap = sync;
  sync();
}
