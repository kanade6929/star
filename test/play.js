const { chromium } = require('playwright-core');
(async () => {
  const [out, script] = process.argv.slice(2);
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome', args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  const p = await b.newPage({ viewport: { width: 1280, height: 720 } });
  p.on('console', m => { if (!/PCFSoft/.test(m.text())) console.log('console:', m.type(), m.text()); });
  p.on('pageerror', e => console.log('pageerror:', e.message));
  await p.goto('file://' + process.cwd() + '/out/local.html'); await p.waitForTimeout(1500);
  const steps = JSON.parse(script);
  let n = 0;
  for (const s of steps) {
    if (s.eval) { const r = await p.evaluate(s.eval); if (r !== undefined) console.log('eval:', JSON.stringify(r)); }
    if (s.wait) await p.waitForTimeout(s.wait);
    if (s.key) await p.keyboard.down(s.key), await p.waitForTimeout(s.hold || 300), await p.keyboard.up(s.key);
    if (s.mouse) await p.mouse.move(s.mouse[0], s.mouse[1]);
    if (s.shot) { await p.screenshot({ path: out.replace('.png', '_' + (n++) + '.png') }); }
  }
  await b.close();
})();
