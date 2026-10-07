import { buildCharAtlas, starCardCanvas, orbCanvas, flowerCanvas } from '../src/sprites.js';
const a = buildCharAtlas();
const show = (c, s) => { const d = document.createElement('canvas'); d.width = c.width * s; d.height = c.height * s; const g = d.getContext('2d'); g.imageSmoothingEnabled = false; g.drawImage(c, 0, 0, d.width, d.height); d.style.margin = '8px'; document.body.appendChild(d); };
document.body.style.background = '#556';
show(a.color, 6); show(a.normal, 6); show(starCardCanvas(), 6); show(orbCanvas(), 6); show(flowerCanvas('#f4a3b6', '#2f6b5e'), 6);
