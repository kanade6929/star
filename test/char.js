import { PixelChar } from '../src/character.js';
document.body.style.cssText = 'background:#3a3a55;display:flex;flex-wrap:wrap;gap:6px;margin:6px';
const show = (c, label) => { const d = document.createElement('canvas'); d.width = c.width * 7; d.height = c.height * 7; const g = d.getContext('2d'); g.imageSmoothingEnabled = false; g.drawImage(c, 0, 0, d.width, d.height); document.body.appendChild(d); };
const cases = [['down', 0, 0, 0], ['down', 1, 0, 2.6], ['down', 1, 0, 2.6, .25], ['up', 1, 0, -2.6], ['right', 1, 2.8, 0], ['right', 1, 5, 0, 0, 1], ['left', 1, -5, 0, 0, 1], ['right', 0, 0, 0]];
cases.forEach(([dir, mv, vx, vz, extra = 0, run = 0]) => {
  const ch = new PixelChar();
  const n = 40 + Math.round(extra * 40);
  for (let i = 0; i < n; i++) ch.update({ dir, moving: !!mv, run, vx, vz, dt: 1 / 30 });
  show(ch.canvas); 
});
const ch = new PixelChar(); for (let i = 0; i < 30; i++) ch.update({ dir: 'down', moving: false, run: 0, vx: 0, vz: 0, dt: 1 / 30 }); show(ch.normal);
