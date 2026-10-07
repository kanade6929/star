// 手机端测试：node test/mobile.js out.png W H '[steps]'
const { chromium } = require('playwright-core');
(async () => {
  const [out, W, H, script] = process.argv.slice(2);
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome', args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  const ctx = await b.newContext({ viewport: { width: +W, height: +H }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1' });
  const p = await ctx.newPage();
  p.on('console', m => { if (!/Canvas2D|PCFSoft/.test(m.text())) console.log('console:', m.type(), m.text()); });
  p.on('pageerror', e => console.log('pageerror:', e.message));
  await p.goto('file://' + process.cwd() + '/out/local.html'); await p.waitForTimeout(2500);
  const cdp = await ctx.newCDPSession(p);
  const touch = async (type, pts) => cdp.send('Input.dispatchTouchEvent', { type, touchPoints: pts.map(([x, y], i) => ({ x, y, id: i })) });
  let n = 0;
  for (const s of JSON.parse(script)) {
    if (s.eval) { const r = await p.evaluate(s.eval); if (r !== undefined) console.log('eval:', JSON.stringify(r)); }
    if (s.tap) await p.touchscreen.tap(s.tap[0], s.tap[1]);
    if (s.drag) { const [x0, y0, x1, y1, ms] = s.drag; await touch('touchStart', [[x0, y0]]); for (let k = 1; k <= 10; k++) { await touch('touchMove', [[x0 + (x1 - x0) * k / 10, y0 + (y1 - y0) * k / 10]]); await p.waitForTimeout((ms || 300) / 10); } if (!s.hold) await touch('touchEnd', []); }
    if (s.end) await touch('touchEnd', []);
    if (s.wait) await p.waitForTimeout(s.wait);
    if (s.shot) await p.screenshot({ path: out.replace('.png', '_' + (n++) + '.png') });
  }
  await b.close();
})();
