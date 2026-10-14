// 发布页使用内容指纹资源；out/ 保留内联脚本，供本地预览与测试。
const fs = require('fs'), path = require('path'), crypto = require('crypto'), esb = require('esbuild');
process.chdir(__dirname);
fs.mkdirSync('assets', { recursive: true });
fs.mkdirSync('out', { recursive: true });

function asset(name, bytes) {
  const hash = crypto.createHash('sha256').update(bytes).digest('hex').slice(0, 16);
  const ext = path.extname(name), stem = path.basename(name, ext);
  const url = `assets/${stem}.${hash}${ext}`;
  fs.writeFileSync(url, bytes);
  return url;
}
const urls = {};
function collect(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name))) {
    const name = `${dir}/${entry.name}`;
    if (entry.isDirectory()) { if (entry.name !== 'src') collect(name); }
    else if (/\.(mp3|woff2|png)$/.test(entry.name)) urls[name] = asset(name, fs.readFileSync(name));
  }
}
['audio', 'fonts', 'img'].forEach(collect);
function bundle(manifest) {
  return esb.buildSync({
    absWorkingDir: __dirname, entryPoints: ['./src/main.js'], tsconfigRaw: {},
    bundle: true, minify: true, format: 'iife', write: false,
    target: 'es2020', legalComments: 'none', define: { __ASSET_URLS: JSON.stringify(manifest) }
  }).outputFiles[0].text;
}
const piano = fs.readFileSync('vendor/piano-samples.js', 'utf8');
const pianoUrl = asset('piano.js', piano), gameUrl = asset('game.js', bundle(urls));
const template = fs.readFileSync('page.html', 'utf8');
function document(page) {
  return '<!doctype html>\n<html lang="zh-CN">\n<head>\n<meta charset="utf-8">\n' +
    page.replace('<canvas', '</head>\n<body>\n<canvas') + '\n</body>\n</html>\n';
}
let web = template.replace('<!--PIANO-->', `<script src="${pianoUrl}"></script>`)
  .replace(/<script>\s*<!--BUNDLE-->\s*<\/script>/, `<script src="${gameUrl}"></script>`);
for (const [name, url] of Object.entries(urls)) web = web.split(name).join(url);
// 在解析页面时并行下载两段脚本，仍按原来的钢琴采样→游戏顺序执行。
web = web.replace('<title>', `<link rel="preload" as="script" href="${pianoUrl}">\n<link rel="preload" as="script" href="${gameUrl}">\n<title>`);
fs.writeFileSync('index.html', document(web));

const inlineJs = bundle({}).replace(/<\/script/gi, '<\\/script').replace(/<!--/g, '<\\!--');
const local = template.replace('<!--PIANO-->', () => `<script>\n${piano}</script>`)
  .replace('<!--BUNDLE-->', () => inlineJs);
fs.writeFileSync('out/chenxingye.html', local);
fs.writeFileSync('out/local.html', '<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"></head><body>' + local + '</body></html>');
fs.writeFileSync('out/asset-manifest.json', JSON.stringify(urls, null, 2) + '\n');
console.log('HTML', fs.statSync('index.html').size, 'bytes; cached scripts', pianoUrl, gameUrl);
