// 钢琴采样音频（沿用前代《辰星夜》的生成式琴声）
export function createAudio(onToggle) {
  const clamp = (v, a, b) => v < a ? a : v > b ? b : v;
  let ac = null, master = null, rev = null, music = null, sfx = null, on = true, ready = false;
  const buf = {}; let keysM = [];
  let mood = 1, nextBar = 0, barN = 0, lastMel = 72, timer = null;
  const last = {};
  function b64(url) { const s = atob(url.split(',')[1]), u = new Uint8Array(s.length); for (let i = 0; i < s.length; i++) u[i] = s.charCodeAt(i); return u.buffer; }
  function init() {
    if (ac) { if (ac.state === 'suspended') ac.resume(); return; }
    try { ac = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) { return; }
    master = ac.createGain(); master.gain.value = on ? .9 : 0;
    const lp = ac.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 7000; lp.Q.value = .2;
    const comp = ac.createDynamicsCompressor(); comp.threshold.value = -16; comp.ratio.value = 3; comp.attack.value = .01; comp.release.value = .4;
    master.connect(lp); lp.connect(comp); comp.connect(ac.destination);
    rev = ac.createConvolver(); const len = ac.sampleRate * 3.4 | 0, b = ac.createBuffer(2, len, ac.sampleRate);
    for (let c = 0; c < 2; c++) { const d = b.getChannelData(c); let lpv = 0; for (let i = 0; i < len; i++) { lpv += ((Math.random() * 2 - 1) - lpv) * .22; d[i] = lpv * Math.pow(1 - i / len, 3) * (i < ac.sampleRate * .02 ? i / (ac.sampleRate * .02) : 1); } }
    rev.buffer = b; const rg = ac.createGain(); rg.gain.value = .55; rev.connect(rg); rg.connect(master);
    music = ac.createGain(); music.gain.value = .5; music.connect(master); const ms = ac.createGain(); ms.gain.value = .6; music.connect(ms); ms.connect(rev);
    sfx = ac.createGain(); sfx.gain.value = .85; sfx.connect(master); const ss = ac.createGain(); ss.gain.value = .5; sfx.connect(ss); ss.connect(rev);
    const src = window.PIANO_SAMPLES || {};
    Object.keys(src).forEach(k => {
      const done = bf => { buf[k] = bf; keysM = Object.keys(buf).map(Number).sort((a, b) => a - b); if (!ready && keysM.length >= 5) { ready = true; startMusic(); } };
      try { const p = ac.decodeAudioData(b64(src[k]), done, () => {}); if (p && p.catch) p.catch(() => {}); } catch (e) {}
    });
  }
  function note(m, v, when = 0, bus = sfx, dur = 0) {
    if (!ac || !ready || !on) return;
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
    2: { beat: .9, chords: [[45, [60, 64, 67, 71]], [41, [57, 64, 65, 69]], [43, [59, 62, 67, 71]], [40, [59, 62, 67, 71]]], scale: [57, 59, 60, 62, 64, 67] }
  };
  function scaleNotes(sc) { const out = []; for (let o = 0; o < 3; o++) sc.forEach(n => out.push(n + 12 * o)); return out.filter(n => n >= 64 && n <= 88); }
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
    timer = setInterval(() => { if (!ac || !on) return; while (nextBar < ac.currentTime + .6) { scheduleBar(nextBar); nextBar += MOODS[mood].beat * 4; } }, 150);
  }
  function duck(sec) { if (!music) return; const t = ac.currentTime; music.gain.cancelScheduledValues(t); music.gain.setTargetAtTime(.12, t, .3); music.gain.setTargetAtTime(.5, t + sec, 1.5); }
  const arp = (ns, v, gap, d = 0) => ns.forEach((n, i) => note(n, v, d + i * gap));
  return {
    init, note,
    setMood(m) { mood = m; barN = 0; },
    toggle() { on = !on; if (master) master.gain.setTargetAtTime(on ? .9 : 0, ac.currentTime, .2); onToggle && onToggle(on); },
    get on() { return on; },
    hover(i) { if (throttle('h', 70)) { const ns = [72, 76, 79, 81, 84]; note(ns[i % 5], .07); note(ns[i % 5] + 12, .025, .04); } },
    deal() { arp([57, 64, 69, 72, 76], .09, .13); note(41, .12); },
    locked() { note(57, .07); note(62, .05, .16); },
    back() { note(79, .05); note(72, .045, .11); },
    step() { if (throttle('st', 330)) note([43, 45][Math.random() * 2 | 0], .025); },
    lamp(i) { const base = [60, 65, 67][i % 3]; arp([base, base + 4, base + 7, base + 11, base + 16], .2, .09); note(base - 24, .25); },
    card() { arp([72, 76, 79, 83, 88], .18, .11); note(48, .18); },
    stone() { note(33, .3); note(40, .18, .05); },
    finale() { duck(12); note(36, .4); note(43, .3, .1); const sc = [60, 62, 64, 67, 69, 71]; for (let k = 0; k < 18; k++) note(sc[k % 6] + 12 * (k / 6 | 0), .16, .3 + k * .2); arp([60, 64, 67, 71, 74, 79], .18, .1, 4.2); },
    fall() { note(64, .12); note(60, .1, .18); note(55, .1, .36); },
    ghost() { if (throttle('g', 160)) note([84, 86, 88, 91][Math.random() * 4 | 0], .045); },
    shadow(k) { if (throttle('sh', 260)) note([67, 71, 74, 79][Math.min(3, k * 4 | 0)], .06); },
    howl() { note(57, .16); note(64, .12, .25); note(69, .1, .5); note(76, .07, .75); },
    wrong() { note(47, .14); note(48, .12, .03); note(35, .12, .05); }
  };
}
