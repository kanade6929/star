// 钢琴采样音频（沿用前代《辰星夜》的生成式琴声）
export function createAudio(onToggle) {
  const clamp = (v, a, b) => v < a ? a : v > b ? b : v;
  let ac = null, master = null, rev = null, music = null, bgm = null, sfx = null, dry = null, wetBus = null, on = true, ready = false;
  const buf = {}; let keysM = [];
  let mood = 1, nextBar = 0, barN = 0, lastMel = 72, timer = null;
  const last = {};
  const BG = .5; let noise = null, dipEnd = 0;
  function b64(url) { const s = atob(url.split(',')[1]), u = new Uint8Array(s.length); for (let i = 0; i < s.length; i++) u[i] = s.charCodeAt(i); return u.buffer; }
  let hidden = false;
  function init() {
    if (ac) { if (!hidden) { if (ac.state === 'suspended') ac.resume(); unlock(); } return; }
    try { ac = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) { return; }
    master = ac.createGain(); master.gain.value = on ? .9 : 0;
    const lp = ac.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 7000; lp.Q.value = .2;
    const comp = ac.createDynamicsCompressor(); comp.threshold.value = -16; comp.ratio.value = 3; comp.attack.value = .01; comp.release.value = .4;
    master.connect(lp); lp.connect(comp); comp.connect(ac.destination);
    rev = ac.createConvolver(); const len = ac.sampleRate * 3.4 | 0, b = ac.createBuffer(2, len, ac.sampleRate);
    for (let c = 0; c < 2; c++) { const d = b.getChannelData(c); let lpv = 0; for (let i = 0; i < len; i++) { lpv += ((Math.random() * 2 - 1) - lpv) * .22; d[i] = lpv * Math.pow(1 - i / len, 3) * (i < ac.sampleRate * .02 ? i / (ac.sampleRate * .02) : 1); } }
    rev.buffer = b; const rg = ac.createGain(); rg.gain.value = .55; rev.connect(rg); rg.connect(master);
    music = ac.createGain(); music.gain.value = .5; music.connect(master); const ms = ac.createGain(); ms.gain.value = .6; music.connect(ms); ms.connect(rev);
    bgm = ac.createGain(); bgm.gain.value = BG; bgm.connect(master);
    noise = ac.createBuffer(1, ac.sampleRate * 2, ac.sampleRate); { const d = noise.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1; }
    sfx = ac.createGain(); sfx.gain.value = .85; sfx.connect(master); const ss = ac.createGain(); ss.gain.value = .5; sfx.connect(ss); ss.connect(rev);
    dry = ac.createGain(); dry.gain.value = .85; dry.connect(master); wetBus = ac.createGain(); wetBus.gain.value = .35; wetBus.connect(rev);
    loadSamples();
    if (ac.state === 'suspended') { const p = ac.resume(); if (p && p.catch) p.catch(() => {}); }
    unlock();
    bgmTick(); timerB = setInterval(bgmTick, 200);
    const src = window.PIANO_SAMPLES || {};
    Object.keys(src).forEach(k => {
      const done = bf => { buf[k] = bf; keysM = Object.keys(buf).map(Number).sort((a, b) => a - b); if (!ready && keysM.length >= 5) { ready = true; startMusic(); } };
      try { const p = ac.decodeAudioData(b64(src[k]), done, () => {}); if (p && p.catch) p.catch(() => {}); } catch (e) {}
    });
  }
  function note(m, v, when = 0, bus = sfx, dur = 0) {
    if (!ac || !ready || !on || hidden) return;
    let k = keysM[0]; for (const kk of keysM) if (Math.abs(kk - m) < Math.abs(k - m)) k = kk;
    const t = ac.currentTime + when;
    const s = ac.createBufferSource(); s.buffer = buf[k]; s.playbackRate.value = Math.pow(2, (m - k) / 12);
    const g = ac.createGain(); g.gain.setValueAtTime(v, t);
    if (dur) { g.gain.setValueAtTime(v, t + dur); g.gain.exponentialRampToValueAtTime(.0008, t + dur + .8); }
    let out = g;
    if (ac.createStereoPanner) { const pn = ac.createStereoPanner(); pn.pan.value = clamp((m - 64) / 40, -.5, .5); g.connect(pn); out = pn; }
    s.connect(g); out.connect(bus); s.start(t); s.stop(t + (dur ? dur + 1 : s.buffer.duration / s.playbackRate.value));
  }
  const throttle = (id, gap) => { const n = performance.now(); if (last[id] && n - last[id] < gap) return false; last[id] = n; return true; };
  const MOODS = {
    0: { beat: 1.05, dens: .6, chords: [[41, [57, 60, 64, 67]], [45, [55, 60, 64, 67]], [38, [57, 60, 64, 65]], [46, [57, 62, 65, 69]]], scale: [60, 62, 64, 67, 69] },
    1: { beat: .78, chords: [[48, [64, 67, 71, 74]], [45, [60, 64, 67, 71]], [41, [60, 64, 69, 71]], [43, [62, 67, 71, 74]]], scale: [60, 62, 64, 67, 69, 71] },
    3: { beat: .66, chords: [[43, [62, 67, 71, 74]], [48, [64, 67, 72, 76]], [45, [64, 69, 72, 76]], [50, [62, 66, 69, 74]]], scale: [62, 64, 66, 67, 69, 71, 74] },
    2: { beat: .9, chords: [[45, [60, 64, 67, 71]], [41, [57, 64, 65, 69]], [43, [59, 62, 67, 71]], [40, [59, 62, 67, 71]]], scale: [57, 59, 60, 62, 64, 67] }
  };
  function scaleNotes(sc) { const out = []; for (let o = 0; o < 3; o++) sc.forEach(n => out.push(n + 12 * o)); return out.filter(n => n >= 64 && n <= 88); }
  // 背景音乐（Suno 生成的曲子，audio/ 目录）：曲与曲之间、每次循环首尾都交叉淡化，不硬切
  // 某首加载失败时，这一幕退回上面的钢琴生成式音乐
  const BGM = { 0: 'audio/menu.mp3', 1: 'audio/star.mp3', 2: 'audio/moon.mp3', 3: 'audio/sun.mp3' };
  const XF = 4, FADE = 3, failed = {};
  let timerB = null;
  // 曲子在后台整首下载进内存（blob），之后进关卡、回主界面、循环接头都从内存播，手机上不再等网络
  // 还没下完的那首先边下边播；一次只下一首，按「马上要用」的顺序排队
  const blobUrl = {}; let pq = [], busy = false;
  function prefetch(moods) {
    const us = moods.map(m => BGM[m]).filter(u => u && !blobUrl[u]);
    pq = us.concat(pq.filter(u => !us.includes(u))); pump();
  }
  function pump() {
    if (busy) return; const u = pq.shift(); if (!u) return; if (blobUrl[u]) { pump(); return; }
    busy = true;
    fetch(u).then(r => r.ok ? r.blob() : Promise.reject(r.status)).then(b => { blobUrl[u] = URL.createObjectURL(b); }).catch(() => {}).then(() => { busy = false; pump(); });
  }
  let retryT = 0;
  const pool = [0, 1, 2].map(() => { const el = new Audio(); el.preload = 'auto'; el.src = 'data:audio/mpeg;base64,SUQzBAAAAAAAI1RTU0UAAAAPAAADTGF2ZjYwLjE2LjEwMAAAAAAAAAAAAAAA//NwwAAAAAAAAAAAAEluZm8AAAAPAAAABgAAAykAWlpaWlpaWlpaWlpaWlpaWnt7e3t7e3t7e3t7e3t7e3t7nJycnJycnJycnJycnJycnL29vb29vb29vb29vb29vb293t7e3t7e3t7e3t7e3t7e3t7/////////////////////AAAAAExhdmM2MC4zMQAAAAAAAAAAAAAAACQCowAAAAAAAAMpso+sIAAAAAAAAAAAAAAAAAD/80DEAAAAA0gAAAAATEFNRTMuMTAwVVVVVVVVVVVVVUxBTUUzLjEwMFVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVf/zQsRbAAADSAAAAABVVVVVVVVVVVVVVVVVVVVVVVVVVUxBTUUzLjEwMFVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVf/zQMSkAAADSAAAAABVVVVVVVVVVVVVVVVVVVVVVVVVTEFNRTMuMTAwVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVV//NCxKMAAANIAAAAAFVVVVVVVVVVVVVVVVVVVVVVVVVVTEFNRTMuMTAwVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVV//NAxKQAAANIAAAAAFVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVX/80LEowAAA0gAAAAAVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVU='; return { el, g: null, url: null, ending: 0 }; });
  // 在用户操作里调用：让每个播放器都"解锁"（手机浏览器要求），被浏览器拦下的背景音乐也在这时补播
  function unlock() { pool.forEach(v => { if (v.ending) return; const p = v.el.play(); if (p && p.then) p.then(() => { if (!v.url) v.el.pause(); }).catch(() => {}); }); }
  function voice() { return pool.find(v => !v.url) || pool.reduce((a, b) => (a.ending && (!b.ending || a.ending < b.ending)) ? a : b); }
  function fadeTo(v, val, sec) { if (!v.g) return; const t = ac.currentTime; v.g.gain.cancelScheduledValues(t); v.g.gain.setValueAtTime(v.g.gain.value, t); v.g.gain.linearRampToValueAtTime(val, t + sec); }
  function release(v, sec) { if (!v.url) return; fadeTo(v, 0, sec); v.ending = performance.now() + sec * 1000 + 100; }
  function startVoice(url, sec) {
    const v = voice(); if (v.url) { v.el.pause(); }
    if (!v.g) { try { const n = ac.createMediaElementSource(v.el); v.g = ac.createGain(); n.connect(v.g); v.g.connect(bgm); } catch (e) { return null; } }
    v.g.gain.cancelScheduledValues(ac.currentTime); v.g.gain.setValueAtTime(0, ac.currentTime);
    v.url = url; v.ending = 0; v.next = false;
    const src = blobUrl[url] || url;
    if (v.el.getAttribute('src') !== src) v.el.src = src; else v.el.currentTime = 0;
    v.el.onerror = () => { if (v.url === url) { failed[url] = true; v.url = null; } };
    const p = v.el.play(); if (p && p.catch) p.catch(() => {});
    if (v.el.readyState >= 3) fadeTo(v, 1, sec);
    else v.el.addEventListener('playing', () => { if (v.url === url && !v.ending) fadeTo(v, 1, sec); }, { once: true });
    return v;
  }
  function bgmTick() {
    if (!ac || hidden) return;
    const url = failed[BGM[mood]] ? null : BGM[mood];
    pool.forEach(v => { if (v.ending && performance.now() > v.ending) { v.el.pause(); v.url = null; v.ending = 0; } });
    const live = pool.filter(v => v.url && !v.ending);
    live.forEach(v => { if (v.url !== url) release(v, FADE); });
    const cur = live.find(v => v.url === url);
    if (cur && !cur.next && !cur.ending) {
      // 网络慢、还没开始出声，而整首已经下进内存了：换成内存里的那份，马上开始
      if (cur.el.readyState < 3 && blobUrl[url] && cur.el.getAttribute('src') !== blobUrl[url]) { cur.el.src = blobUrl[url]; const p = cur.el.play(); if (p && p.catch) p.catch(() => {}); }
      // 手机上 play() 被浏览器拦下（还没点过屏幕）时不会自己再试：每秒补一次，点过屏幕后立刻就能响
      else if (cur.el.paused && performance.now() > retryT) { retryT = performance.now() + 1000; const p = cur.el.play(); if (p && p.catch) p.catch(() => {}); }
    }
    if (url && !cur) startVoice(url, FADE);
    else if (cur && !cur.next && cur.el.duration && cur.el.duration - cur.el.currentTime < XF + .3) { cur.next = true; release(cur, XF); startVoice(url, XF); }
  }
  const bgmOn = () => !!(BGM[mood] && !failed[BGM[mood]]);
  function scheduleBar(t0) {
    const M = MOODS[mood], bt = M.beat, [root, ch] = M.chords[barN % M.chords.length];
    const nt = (m, v, t, bus) => note(m, v, Math.max(0, t - ac.currentTime), bus);
    const breathe = barN % 8 === 7;
    if (!breathe) {
      nt(root, .30, t0, music);
      if (barN % 2 === 0) nt(root + 12, .12, t0 + bt * 2, music);
      const pick = ch.filter(() => Math.random() < .7).slice(0, 3);
      pick.forEach((n, i) => nt(n, .1 + Math.random() * .04, t0 + .06 + i * .07, music));
    }
    const mel = scaleNotes(M.scale); const slots = [0, 1, 2, 3, 4, 5, 6, 7].filter(() => Math.random() < (breathe ? .15 : .3) * (M.dens || 1));
    slots.forEach(sl => {
      let i = mel.indexOf(lastMel); if (i < 0) i = mel.length >> 1;
      i = clamp(i + [-2, -1, -1, 1, 1, 2, 0][Math.random() * 7 | 0], 0, mel.length - 1);
      lastMel = mel[i];
      nt(lastMel, .07 + Math.random() * .08, t0 + sl * bt / 2 + Math.random() * .03, music);
    });
    barN++;
  }
  function startMusic() {
    if (timer) return; nextBar = ac.currentTime + .4;
    timer = setInterval(() => { if (!ac || !on) return; if (bgmOn()) { nextBar = Math.max(nextBar, ac.currentTime + .4); return; } while (nextBar < ac.currentTime + .6) { scheduleBar(nextBar); nextBar += MOODS[mood].beat * 4; } }, 150);
  }
  function duck(sec) { if (!music) return; const t = ac.currentTime; music.gain.cancelScheduledValues(t); music.gain.setTargetAtTime(.12, t, .3); music.gain.setTargetAtTime(.5, t + sec, 1.5); dip(.3, sec, .6); }
  // 音效响起时压低背景音乐，结束后慢慢回来；连续触发时以最晚的结束时间为准
  function dip(level, hold, fall = .08) {
    if (!bgm) return; const t = ac.currentTime; dipEnd = Math.max(dipEnd, t + hold);
    bgm.gain.cancelScheduledValues(t); bgm.gain.setValueAtTime(bgm.gain.value, t);
    bgm.gain.setTargetAtTime(BG * level, t, fall); bgm.gain.setTargetAtTime(BG, dipEnd, .7);
  }
  const arp = (ns, v, gap, d = 0) => ns.forEach((n, i) => note(n, v, d + i * gap));

  // ── 合成音效 ──
  // 音效的音高跟着背景音乐"此刻"的和弦走：离线分析了四首曲子的和弦进行（每段几秒），
  // 播放时读当前曲子的播放位置，取这一段和弦的五声音阶（大和弦用大调五声、小和弦用小调五声），
  // 低音落在和弦根音上。四首都在 D 大调 / B 小调里，所以用到的音都不会出调。
  // 和弦编号：0 D  1 Em  2 F#m  3 G  4 A  5 Bm；格式"秒:编号"
  const CHORDS = {
    menu: '0:0 8.5:3 15.5:5 20:2 21.5:3 27.5:0 35.5:3 43:5 46:0 49.5:3 56:1 59.5:4 62.5:2 66.5:5 70.5:3 72.5:1 76.5:4 83.5:3 87:4 89.5:2 93.5:5 96.5:1 101:2 104:3 107.5:0 108.5:4 110.5:3 114:4 117:2 121:5 123:4 125:1 131:4 137.5:0 140.5:4 144.5:0 150:2 152:3 155.5:5 158:1 162.5:4 169:0',
    star: '0:4 2.5:0 9.5:3 14:0 15.5:5 16.5:0 21.5:3 25.5:0 33.5:5 36.5:3 40:5 45.5:3 52:0 59.5:3 64:1 67.5:2 69.5:0 71.5:3 77:0 83.5:3 89.5:0 96:3 102.5:5 105.5:4 108.5:3 115:5 118:2 121.5:1 123:0 124.5:4 132:0 140.5:4 145.5:5 151.5:3 158.5:0 165.5:4 171.5:5 174:0 177:3 184:0 191:3 196.5:0',
    moon: '0:2 4:1 8:0 10.5:3 13.5:0 17:5 20.5:4 29:0 31.5:3 38.5:5 45:1 52.5:5 58.5:1 66.5:5 72.5:1 79:4 86.5:3 90.5:4 94:5 100:3 104.5:4 108:5 113:2 114.5:3 118:4 121.5:5 127:2 128.5:3 132:2 135.5:4 141.5:1 146:2 149:5 156:1 159.5:2 163:5 170:1 173:4 177.5:5 180.5:4 183:2 188:4 191:5 198.5:2 203:1 205.5:5',
    sun: '0:4 4.5:0 11:5 14:0 16:1 27:4 31.5:0'
  };
  const CH_ROOT = [2, 4, 6, 7, 9, 11], CH_MIN = [0, 1, 1, 0, 0, 1];
  const chordTab = {}; Object.keys(CHORDS).forEach(k => { chordTab[`audio/${k}.mp3`] = CHORDS[k].split(' ').map(x => x.split(':').map(Number)); });
  // 当前和弦：正在放的那首曲子的位置；快换和弦时（0.35 秒内）提前用下一个，音效的尾巴才不会和新和弦打架
  function chordNow() {
    const url = BGM[mood], v = pool.find(x => x.url === url && !x.ending && !x.el.paused) || pool.find(x => x.url && !x.el.paused && !x.ending);
    const tab = v && chordTab[v.url];
    if (!tab || !bgmOn()) return mood === 2 ? 5 : 0;
    const t = v.el.currentTime + .35; let c = tab[0][1]; for (const [s0, k] of tab) { if (s0 > t) break; c = k; }
    return c;
  }
  let chSet = [2, 4, 6, 9, 11], chRoot = 2, chTri = [2, 6, 9];
  // 每个音效开头调一次：刷新这一刻的音阶
  function tune() { const c = chordNow(), r = CH_ROOT[c]; chRoot = r; chTri = [0, CH_MIN[c] ? 3 : 4, 7].map(x => (x + r) % 12); chSet = (CH_MIN[c] ? [0, 3, 5, 7, 10] : [0, 2, 4, 7, 9]).map(x => (x + r) % 12).sort((a, b) => a - b); }
  // pent(deg, base)：从 base（不在音阶里就往下找最近的音阶音）起往上数 deg 个音阶音
  const pent = (deg, base = 62) => { let m = base; while (!chSet.includes(((m % 12) + 12) % 12)) m--; for (let k = 0; k < deg; k++) { m++; while (!chSet.includes(m % 12)) m++; } return m; };
  // ct(k, base)：从 base 往上数第 k 个和弦内音（三和弦 1-3-5），点灯这类要"落稳"的琶音用它
  const ct = (k, base = 62) => { let m = base; while (!chTri.includes(((m % 12) + 12) % 12)) m--; for (let j = 0; j < k; j++) { m++; while (!chTri.includes(m % 12)) m++; } return m; };
  // 和弦根音，落在 57–68 之间
  const root = () => 57 + ((chRoot - 57) % 12 + 12) % 12;
  const hz = m => 440 * Math.pow(2, (m - 69) / 12);
  const live = () => ac && on && !hidden;
  function pan(node, p) { if (!ac.createStereoPanner) return node; const pn = ac.createStereoPanner(); pn.pan.value = clamp(p, -.6, .6); node.connect(pn); return pn; }
  // 玻璃铃：正弦载波 + 3.5 倍频调制，调制量随时间衰减，像配乐里的高音颗粒
  function bell(m, v, when = 0, dec = 1.6, bright = 1) {
    if (!live()) return; const t = ac.currentTime + when, f = hz(m);
    const c = ac.createOscillator(), mo = ac.createOscillator(), mg = ac.createGain(), g = ac.createGain();
    c.frequency.value = f; mo.frequency.value = f * 3.5; mg.gain.setValueAtTime(f * 1.2 * bright, t); mg.gain.exponentialRampToValueAtTime(f * .02 + 1, t + dec * .6);
    mo.connect(mg); mg.connect(c.frequency); c.connect(g);
    g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(v, t + .006); g.gain.exponentialRampToValueAtTime(.0005, t + dec);
    const o2 = ac.createOscillator(), g2 = ac.createGain(); o2.frequency.value = f * 2; o2.connect(g2); g2.connect(g); g2.gain.value = .18;
    pan(g, (m - 74) / 30).connect(sfx);
    [c, mo, o2].forEach(o => { o.start(t); o.stop(t + dec + .05); });
  }
  // 温暖长音：两支略微走音的三角波 + 低通，缓起缓落，用来托住和弦
  function pad(m, v, when = 0, dur = 1.5, att = .25, cut = 1800) {
    if (!live()) return; const t = ac.currentTime + when;
    const lp = ac.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.setValueAtTime(cut * .5, t); lp.frequency.linearRampToValueAtTime(cut, t + att + dur * .5); lp.Q.value = .3;
    const g = ac.createGain(); g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(v, t + att); g.gain.setValueAtTime(v, t + att + dur); g.gain.exponentialRampToValueAtTime(.0005, t + att + dur + 1.4);
    lp.connect(g); pan(g, (m - 62) / 40).connect(sfx);
    [-5, 5].forEach(d => { const o = ac.createOscillator(); o.type = 'triangle'; o.frequency.value = hz(m); o.detune.value = d; o.connect(lp); o.start(t); o.stop(t + att + dur + 1.5); });
  }
  // 低频下潜：正弦从 f0 滑到 f1，像配乐里那种深沉的低音
  function sub(f0, f1, v, when = 0, dur = .7) {
    if (!live()) return; const t = ac.currentTime + when, o = ac.createOscillator(), g = ac.createGain();
    o.frequency.setValueAtTime(f0, t); o.frequency.exponentialRampToValueAtTime(f1, t + dur);
    g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(v, t + .02); g.gain.exponentialRampToValueAtTime(.0005, t + dur + .3);
    o.connect(g); g.connect(sfx); o.start(t); o.stop(t + dur + .35);
  }
  // 滤波噪声：石头摩擦、风声、脚步
  function hiss(v, when = 0, dur = .6, f0 = 400, f1 = 200, type = 'lowpass', q = .7, att = .02) {
    if (!live() || !noise) return; const t = ac.currentTime + when, n = ac.createBufferSource(); n.buffer = noise; n.loop = true;
    const fl = ac.createBiquadFilter(); fl.type = type; fl.Q.value = q; fl.frequency.setValueAtTime(f0, t); fl.frequency.exponentialRampToValueAtTime(f1, t + dur);
    const g = ac.createGain(); g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(v, t + att); g.gain.exponentialRampToValueAtTime(.0005, t + dur);
    n.connect(fl); fl.connect(g); g.connect(sfx); n.start(t, Math.random() * 1.5); n.stop(t + dur + .05);
  }
  // ── 采样音效 ──
  // audio/sfx/ 里是真乐器单音：钢片琴 glock、颤音琴 vibe、泰国锣 gong、拉奏大锣 tam（爱荷华大学乐器库，可随意使用），
  // 竖琴 harp（tonejs-instruments，CC BY 3.0），以及 Kenney 的 CC0 音效（脚步、纸牌、门闩、石头、闷响）。
  // 都已离线调到和配乐同一个音准、对齐响度；每个文件是一条"音色条"，固定长度的格子一个接一个，按格子切出来播。
  // 采样没加载好之前，退回上面的合成音色。
  const SMP = {
    lead: .05,
    glock: { slot: 2.4, notes: [86, 88, 90, 93, 95, 98, 100, 102, 105, 107] },
    vibe: { slot: 4, notes: [50, 52, 54, 57, 59, 62, 64, 66, 69, 71, 74, 76, 78, 81, 83] },
    harp: { slot: 3, notes: [52, 55, 59, 62, 65, 69, 72, 76, 79, 83, 86, 89, 93] },
    step: { slot: .3 }, cards: { slot: 1.3 }, latch: { slot: .45 }, thud: { slot: .6 }, rock: { slot: 1 }, gong: { slot: 6 }, tam: { slot: 7 }
  };
  const smp = {};
  function loadSamples() {
    Object.keys(SMP).forEach(k => {
      if (k === 'lead') return;
      fetch(`audio/sfx/${k}.mp3`).then(r => r.ok ? r.arrayBuffer() : Promise.reject(r.status))
        .then(a => new Promise((ok, no) => { const q = ac.decodeAudioData(a, ok, no); if (q && q.catch) q.catch(no); })).then(b => { smp[k] = b; }).catch(() => {});
    });
  }
  // 播第 i 格：rate 变调，dur 截短（带渐出），lp 低通，p 声像，wet 混响（0 干声，1 正常，>1 更远）
  function slot(k, i, { v = .5, when = 0, rate = 1, dur = 0, lp = 0, p = 0, wet = 1, att = 0 } = {}) {
    const b = smp[k]; if (!b) return false; if (!live()) return true;
    const S = SMP[k], t = ac.currentTime + when, full = (S.slot - SMP.lead) / rate, len = dur ? Math.min(dur, full) : full;
    const s = ac.createBufferSource(); s.buffer = b; s.playbackRate.value = rate;
    const g = ac.createGain(); g.gain.setValueAtTime(att ? 0 : v, t); if (att) g.gain.linearRampToValueAtTime(v, t + att);
    if (dur && dur < full) { g.gain.setValueAtTime(v, t + len * .55); g.gain.exponentialRampToValueAtTime(.0005, t + len); }
    let node = g; if (lp) { const f = ac.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = lp; f.Q.value = .5; g.connect(f); node = f; }
    node = pan(node, p); node.connect(wet ? sfx : dry); if (wet > 1) node.connect(wetBus);
    s.connect(g); s.start(t, i * S.slot + SMP.lead - .004); s.stop(t + len + .02);
    return true;
  }
  // 乐器音：挑最近的采样音再变调，m 是 MIDI 音高；LVL 把三件乐器的响度拉齐
  const LVL = { vibe: 3, glock: 4.5, harp: 1.6 };
  function inst(k, m, v, when = 0, o = {}) {
    const ns = SMP[k].notes; v *= LVL[k]; let i = 0; ns.forEach((n, j) => { if (Math.abs(n - m) < Math.abs(ns[i] - m)) i = j; });
    return slot(k, i, Object.assign({ v, when, rate: Math.pow(2, (m - ns[i]) / 12), p: (m - 74) / 34 }, o));
  }
  const rnd = n => Math.random() * n | 0;
  // 竖琴拨弦序列 / 钢片琴星光点点
  const harp = (ms, v, when = 0, gap = .09, o) => ms.forEach((m, k) => inst('harp', m, v * (1 - k * .03), when + k * gap + Math.random() * .012, o) || bell(m, v * .3, when + k * gap, 1.6));
  const glint = (n, v, when = 0, lo = 10, span = 5) => { for (let k = 0; k < n; k++) { const m = pent(lo + rnd(span)), w = when + k * .08 + Math.random() * .04, a = v * (.55 + Math.random() * .45); inst('glock', m, a, w, { lp: 6500, wet: 2, dur: 1.6 }) || bell(m, a * .4, w, .9, .6); } };
  const piano = (m, v, when = 0, dur = 0) => note(m, v, when, sfx, dur);
  const sparkle = (n, v, when = 0, lo = 10, span = 5) => { for (let i = 0; i < n; i++) bell(pent(lo + (Math.random() * span | 0)), v * (.6 + Math.random() * .4), when + i * .07 + Math.random() * .03, .9, .6); };
  // 切出页面（换标签页、切到别的应用、锁屏）时整体静音暂停，回来再接着放
  function setHidden(h) {
    if (h === hidden) return; hidden = h;
    if (!ac) return;
    if (h) {
      pool.forEach(v => { v.wasPlaying = !v.el.paused; v.el.pause(); });
      if (ac.suspend) ac.suspend().catch(() => {});
    } else {
      const go = () => pool.forEach(v => { if (v.wasPlaying && v.url) { const p = v.el.play(); if (p && p.catch) p.catch(() => {}); } v.wasPlaying = false; });
      if (ac.resume) ac.resume().then(go, go); else go();
    }
  }
  return {
    init, note, setHidden, prefetch,
    get running() { return !!ac && ac.state === 'running' && pool.some(v => v.url && !v.el.paused); }, _dbg: () => ({ ac: ac && ac.state, hidden, blobs: Object.keys(blobUrl), vs: pool.map(v => [v.url, (v.el.getAttribute('src') || '').slice(0, 5), v.el.readyState, +v.el.currentTime.toFixed(1), v.el.paused ? 1 : 0, v.g ? +v.g.gain.value.toFixed(2) : '-', v.ending ? 1 : 0]), playing: pool.filter(v => !v.el.paused).map(v => v.url), samples: Object.keys(smp), chord: chordNow(), t: (pool.find(v => v.url === BGM[mood] && !v.ending) || { el: {} }).el.currentTime }), _nodes: () => ({ ac, master, bgm }),
    setMood(m) { if (m === mood) return; mood = m; barN = 0; if (ac) bgmTick(); },
    toggle() { on = !on; if (master) master.gain.setTargetAtTime(on ? .9 : 0, ac.currentTime, .2); onToggle && onToggle(on); },
    get on() { return on; },
    hover(i) { tune(); if (!throttle('h', 70)) return; const m = pent(7 + i % 5); inst('vibe', m, .2, 0, { dur: 1.3, lp: 7000 }) || bell(m, .05, 0, 1.1, .7); inst('glock', m + 12, .035, .01, { dur: .9, lp: 6000, wet: 2 }); },
    deal() { tune(); slot('cards', 0, { v: .42, lp: 7500, wet: .5 }) || hiss(.05, 0, .7, 1800, 5000, 'bandpass', 1.2, .25); slot('cards', 1, { v: .3, when: .28, rate: 1.05, lp: 7000, wet: .5 }); harp([5, 6, 7, 8, 9].map(d => pent(d)), .3, .1, .11); inst('vibe', 50, .16, .05, { dur: 2.5 }); },
    locked() { tune(); slot('latch', 0, { v: .32, rate: .75, lp: 2400, wet: .6 }); inst('vibe', pent(3, 50), .22, 0, { dur: .32, lp: 2500 }) || bell(pent(3, 50), .07, 0, .5, .3); inst('vibe', pent(1, 50), .18, .11, { dur: .36, lp: 2200 }); },
    back() { tune(); inst('vibe', pent(9), .17, 0, { dur: 1 }) || bell(pent(9), .045, 0, .9, .6); inst('vibe', pent(7), .15, .1, { dur: 1.3 }); },
    step() { if (throttle('st', 330)) slot('step', rnd(5), { v: .16, rate: .9 + Math.random() * .18, lp: 3000, wet: 0 }) || hiss(.022, 0, .09, 900 + Math.random() * 300, 500, 'bandpass', 1, .005); },
    lamp(i) { tune();
      const r = root(), ch = [0, 1, 2, 3, 4].map(k => ct(k + (i % 3), r));
      dip(.3, 2.6); sub(110, 70, .1, 0, .5); hiss(.03, 0, .5, 600, 3000, 'bandpass', .8, .2);
      inst('vibe', r - 12, .26, 0) || pad(r - 12, .07, 0, 1.4, .35); inst('vibe', ch[2] - 12, .16, .04); piano(r - 24, .22, 0, 1.6);
      harp(ch, .34, .06, .1);
      ch.forEach((m, k) => inst('vibe', m + 12, .07, .1 + k * .1, { dur: 2.4 }));
      glint(5, .07, .6, 11, 4);
    },
    card() { tune();
      const r = root(); dip(.25, 3.2);
      slot('tam', 0, { v: .2, rate: .85, lp: 2600, att: .3 }); piano(r - 24, .3, 0, 2.2); piano(pent(2, r) - 12, .18, .05, 2);
      inst('vibe', r - 12, .26, 0) || pad(r - 12, .08, 0, 2, .5); inst('vibe', pent(2, r) - 12, .18, .08); inst('vibe', pent(3, r), .14, .2);
      harp([0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11].map(d => pent(d + 2, r)), .28, 0, .055);
      glint(9, .085, .75, 12, 4);
    },
    stone() {
      if (!throttle('sn', 140)) return; const rep = !throttle('sn2', 700); last.sn2 = performance.now();
      dip(.35, 1.2);
      if (!slot('rock', rnd(3), { v: rep ? .34 : .5, rate: .5 + Math.random() * .14, lp: 1500, wet: 1.4 })) { sub(75, 38, .22, 0, .7); hiss(.09, 0, .9, 380, 120, 'lowpass', .6, .05); return; }
      if (!rep) { slot('thud', rnd(3), { v: .7, rate: .75 + Math.random() * .1, lp: 1200 }); sub(70, 36, .14, 0, .8); }
      hiss(.04, 0, rep ? .5 : .9, 320, 110, 'lowpass', .6, .05);
    },
    finale() { tune();
      duck(12); const r = root(), g = Math.pow(2, ((chRoot - 2 + 18) % 12 - 6) / 12);
      slot('gong', 0, { v: .38, rate: g, lp: 4000, wet: 1.6 }) || sub(90, 45, .2, 0, 1.6); slot('tam', 0, { v: .22, rate: .7, lp: 1800, att: .8 });
      piano(r - 24, .32, 0, 4); piano(r - 12, .2, .02, 4);
      pad(r - 24, .06, 0, 6, 1.5, 1200); pad(r - 12, .045, .3, 6, 1.5);
      [r - 12, pent(2, r) - 12, pent(3, r) - 12, pent(5, r) - 12].forEach((m, k) => inst('vibe', m, .2, .2 + k * .12));
      harp([0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map(d => pent(d + 2, r)), .26, .5, .07);
      for (let k = 0; k < 16; k++) { const m = pent(k % 8 + 10, r); inst('glock', m, .07, 1.6 + k * .22, { lp: 6500, wet: 2 }) || bell(m, .06, 1.6 + k * .22, 2.4, .8); }
      glint(10, .05, 4.6, 12, 5);
    },
    fall() { tune(); dip(.4, 1.2); hiss(.07, 0, 1.1, 2400, 300, 'bandpass', .9, .15); harp([pent(9), pent(7), pent(5), pent(3)], .24, 0, .16, { lp: 5000, wet: 2 }); },
    ghost() { tune(); if (!throttle('g', 160)) return; const m = pent(10 + rnd(5)); inst('glock', m, .06, 0, { lp: 6500, wet: 2, dur: 1.4 }) || bell(m, .035, 0, 1, .5); },
    shadow(k) { tune(); if (!throttle('sh', 260)) return; const m = pent(5 + Math.min(4, k * 5 | 0), root()); inst('vibe', m, .2, 0, { dur: 1.2 }) || bell(m, .05, 0, 1, .7); },
    howl() { tune();
      if (!live()) return; dip(.3, 2.6); const t = ac.currentTime, o = ac.createOscillator(), vib = ac.createOscillator(), vg = ac.createGain(), g = ac.createGain(), lp = ac.createBiquadFilter();
      const f = hz(pent(3, 59) - 12); o.type = 'triangle'; o.frequency.setValueAtTime(f, t); o.frequency.exponentialRampToValueAtTime(f * 1.5, t + .7); o.frequency.setValueAtTime(f * 1.5, t + 1.6); o.frequency.exponentialRampToValueAtTime(f * 1.12, t + 2.4);
      vib.frequency.value = 5; vg.gain.value = 4; vib.connect(vg); vg.connect(o.frequency); lp.type = 'lowpass'; lp.frequency.value = 1400;
      g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(.07, t + .5); g.gain.setValueAtTime(.07, t + 1.6); g.gain.exponentialRampToValueAtTime(.0005, t + 2.6);
      o.connect(lp); lp.connect(g); g.connect(sfx); [o, vib].forEach(x => { x.start(t); x.stop(t + 2.7); });
      slot('tam', 0, { v: .14, rate: .6, lp: 1200, att: .6, dur: 3.5 }) || pad(59 - 12, .05, 0, 1.6, .5); inst('vibe', pent(5, 59), .16, .7) || bell(pent(5, 59), .05, .7, 2);
    },
    wrong() { tune(); dip(.45, .9); piano(pent(0, 38), .45, 0, .6); piano(pent(1, 38), .36, .06, .6); slot('thud', 0, { v: .3, rate: 1.3, lp: 700 }) || hiss(.03, 0, .25, 500, 200); inst('vibe', pent(1, 50), .12, .02, { dur: .5, lp: 1800 }) || bell(pent(1, 50), .08, 0, .7, .25); }
  };
}
