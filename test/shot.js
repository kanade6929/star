const { chromium } = require('playwright-core');
(async () => {
  const [url, out, w = 1280, h = 720, wait = 500, evalCode] = process.argv.slice(2);
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome', args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  const p = await b.newPage({ viewport: { width: +w, height: +h } });
  p.on('console', m => console.log('console:', m.type(), m.text()));
  p.on('pageerror', e => console.log('pageerror:', e.message));
  await p.goto(url); await p.waitForTimeout(+wait);
  if (evalCode) { const r = await p.evaluate(evalCode); if (r !== undefined) console.log('eval:', JSON.stringify(r)); await p.waitForTimeout(800); }
  await p.screenshot({ path: out }); await b.close();
})();
