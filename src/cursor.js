// 自绘光标（仅鼠标设备）：平时 ↔ 悬停 交叉淡化，按下时收一下，点击处漫开一圈细线波纹
// 系统光标用 CSS 变量换成透明图，但保留 default / pointer / none 的语义，好在这里读出「此处该是哪种」
const SVG = (inner) => `<svg viewBox="0 0 32 32" width="32" height="32" aria-hidden="true">${inner}</svg>`;
const NORM = SVG(`<path d="M3 3 L20 11.5 L12.6 13.4 L10.2 21 Z" fill="#141030" fill-opacity=".85" stroke="#e8c98e" stroke-width="1.3" stroke-linejoin="round"/><path d="M5.6 5.6 L12.2 12.2" stroke="#e8c98e" stroke-opacity=".45" stroke-width=".8"/><path d="M20 17.2 Q20.6 20.4 23.8 21 Q20.6 21.6 20 24.8 Q19.4 21.6 16.2 21 Q19.4 20.4 20 17.2Z" fill="#e8c98e" fill-opacity=".75"/>`);
const HOV = SVG(`<circle cx="21" cy="21" r="6" fill="#ffd98c" fill-opacity=".09"/><path d="M3 3 L20 11.5 L12.6 13.4 L10.2 21 Z" fill="#f4cf6a" stroke="#fff1cc" stroke-width="1.2" stroke-linejoin="round"/><path d="M5.6 5.6 L12.2 12.2" stroke="#fff6dc" stroke-opacity=".8" stroke-width=".9"/><path d="M21 15.5 Q21.8 20.2 26.5 21 Q21.8 21.8 21 26.5 Q20.2 21.8 15.5 21 Q20.2 20.2 21 15.5Z" fill="#fff0c4"/>`);

export function initCursor() {
  if (!matchMedia('(hover: hover) and (pointer: fine)').matches) return;
  const root = document.documentElement;
  const el = document.createElement('div');
  el.id = 'cur'; el.innerHTML = `<div class="ci">${NORM}${HOV}</div>`;
  document.body.appendChild(el);
  let x = -99, y = -99, dirty = false, on = false;
  const place = () => { el.style.transform = `translate3d(${x - 3}px,${y - 3}px,0)`; };
  // 当前元素该显示哪种：读计算后的 cursor 末尾关键字（none = 游戏里，藏起来）
  const check = () => {
    dirty = false; const tgt = document.elementFromPoint(x, y); if (!tgt) return;
    const c = getComputedStyle(tgt).cursor;
    el.classList.toggle('hov', /pointer$/.test(c));
    el.classList.toggle('gone', /none$/.test(c));
  };
  addEventListener('pointermove', e => {
    if (e.pointerType !== 'mouse') return;
    x = e.clientX; y = e.clientY; place();
    if (!on) { on = true; root.classList.add('fcur'); el.classList.add('on'); }
    if (!dirty) { dirty = true; requestAnimationFrame(check); }
  }, { passive: true, capture: true });
  // 状态切换（开局、暂停、弹层）时光标不动也要重判一次
  new MutationObserver(() => { if (on && !dirty) { dirty = true; requestAnimationFrame(check); } })
    .observe(document.body, { attributes: true, attributeFilter: ['class'], subtree: true });
  document.addEventListener('mouseleave', () => el.classList.remove('on'));
  document.addEventListener('mouseenter', () => { if (on) el.classList.add('on'); });
  addEventListener('blur', () => el.classList.remove('down'));
  addEventListener('pointerdown', e => {
    if (e.pointerType !== 'mouse' || el.classList.contains('gone')) return;
    el.classList.add('down');
    const r = document.createElement('i'); r.className = 'curr';
    r.style.left = e.clientX + 'px'; r.style.top = e.clientY + 'px';
    document.body.appendChild(r);
    r.animate([{ transform: 'translate(-50%,-50%) scale(.15)', opacity: 1 }, { opacity: .75, offset: .4 }, { transform: 'translate(-50%,-50%) scale(1)', opacity: 0 }],
      { duration: 700, easing: 'cubic-bezier(.2,.7,.3,1)' }).onfinish = () => r.remove();
  }, { capture: true });
  addEventListener('pointerup', () => el.classList.remove('down'), { capture: true });
}
