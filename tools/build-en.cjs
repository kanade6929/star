// 英文版 Starli：和中文版共用同一份源码，构建时按 i18n/en 的译文替换文字，输出 en/index.html。
// 译文是“原样的一段中文代码 → 英文”，源码以后改了文字，这里会报出没用上的译文和打包后还剩下的中文。
// 英文页用以 / 开头的绝对路径，放在 en.hugloom.art 根目录或 hugloom.art/en/ 下都能打开。
const fs = require('fs'), path = require('path'), esb = require('esbuild');
const root = path.resolve(__dirname, '..'), DIR = path.join(root, 'i18n', 'en');
const CJK = /[　-〿㐀-鿿＀-￯]/;

function pairs(file) {
  const out = []; let from = null;
  for (const line of fs.readFileSync(path.join(DIR, file), 'utf8').split('\n')) {
    if (line.startsWith('- ')) from = line.slice(2);
    else if (line.startsWith('+ ') && from !== null) { out.push([from, line.slice(2)]); from = null; }
  }
  return out.sort((a, b) => b[0].length - a[0].length);
}
function translator(list) {
  const used = new Set();
  const run = text => { for (const [a, b] of list) if (text.includes(a)) { text = text.split(a).join(b); used.add(a); } return text; };
  run.unused = () => list.filter(([a]) => !used.has(a)).map(([a]) => a);
  return run;
}
function leftovers(text, where) {
  const plain = text.replace(/\\u([0-9a-fA-F]{4})/g, (_, h) => String.fromCharCode(parseInt(h, 16)));
  const hits = new Set();
  // 着色器源码里的 // 注释不会显示出来，不算
  for (const line of plain.split('\n').map(l => l.replace(/(^|[^:])\/\/.*$/, '$1'))) {
    const re = new RegExp(CJK.source + '+', 'g'); let m;
    while ((m = re.exec(line))) hits.add(line.slice(Math.max(0, m.index - 24), m.index + m[0].length + 24));
  }
  if (hits.size) throw new Error(`英文版 ${where} 里还有没翻译的中文：\n  ` + [...hits].join('\n  '));
}

// 英文版整段删掉：支持作者（微信二维码）；B 站链接换成 X（推特），links.json 里还没填链接时也先删掉
const LINKS = JSON.parse(fs.readFileSync(path.join(DIR, 'links.json'), 'utf8'));
const X_ICON = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4.5 4h4.2l10.8 16h-4.2zM19.2 4l-6.1 7M4.8 20l6.2-7.1"/></svg>';
const REMOVE = [
  /\n<div class="supbox[\s\S]*?(?=\n<div id="splash")/,
  /\n\s*<button class="fb main" id="finSup">[^\n]*/,
  ...(LINKS.x ? [] : [/\n\s*<a class="fb" id="finBili"[^\n]*/, /\n\s*<a class="vbtn vlink"[^\n]*/]),
  /\n\s*<div class="mrow msup">[\s\S]*?<div class="redeemed"[^\n]*\n\s*<\/div>/,
  /<i class="lock" aria-hidden="true">[\s\S]*?<\/i>/,
  /\n@font-face\{font-family:"(Noto Serif SC|ZCOOL XiaoWei)"[^\n]*/g
];

module.exports = function buildEn({ asset, urls, pianoUrl, template, document }) {
  const js = translator(pairs('js.txt')), html = translator(pairs('html.txt'));
  const own = {};
  for (const f of fs.readdirSync(path.join(DIR, 'fonts')).sort()) if (f.endsWith('.woff2')) {
    const name = `i18n/en/fonts/${f}`; own[name] = asset(f, fs.readFileSync(path.join(root, name)));
  }
  for (const f of fs.readdirSync(path.join(DIR, 'img')).sort()) if (f.endsWith('.png')) {
    const name = `i18n/en/img/${f}`; own[name] = asset(f, fs.readFileSync(path.join(root, name)));
  }
  const abs = {};
  for (const [k, v] of Object.entries({ ...urls, ...own })) abs[k] = '/' + v;
  // 译好的源码放到 out/en-src（同步打包不能用插件），再从那里打包
  const src = path.join(root, 'out', 'en-src');
  fs.rmSync(src, { recursive: true, force: true }); fs.mkdirSync(src, { recursive: true });
  for (const f of fs.readdirSync(path.join(root, 'src'))) if (f.endsWith('.js')) fs.writeFileSync(path.join(src, f), js(fs.readFileSync(path.join(root, 'src', f), 'utf8'))
    .replace("const BILI_URL = 'https://b23.tv/QomRCGl';", () => `const BILI_URL = ${JSON.stringify(LINKS.x)};`));
  const game = esb.buildSync({
    absWorkingDir: root, entryPoints: ['./out/en-src/main.js'], tsconfigRaw: {},
    bundle: true, minify: true, format: 'iife', write: false,
    target: 'es2020', legalComments: 'none', define: { __ASSET_URLS: JSON.stringify(abs) }
  }).outputFiles[0].text;
  leftovers(game, '游戏脚本');
  const gameUrl = asset('game-en.js', game);

  let page = template;
  for (const re of REMOVE) page = page.replace(re, '');
  page = page.replace(/\/\*[^*]*?\*\//g, c => CJK.test(c) ? '' : c);
  if (LINKS.x) page = page.split('href="https://b23.tv/QomRCGl"').join(`href="${LINKS.x}"`)
    .replace(/(<a class="fb" id="finBili"[^>]*>)<svg[\s\S]*?<\/svg>我的 B 站主页/, (_, a) => a + X_ICON + 'Follow me on X')
    .replace('<span class="lbl">前往作者主页</span>', '<span class="lbl">Follow me on X</span>');
  page = html(page);
  page = page.replace('</style>', () => fs.readFileSync(path.join(DIR, 'style.css'), 'utf8').replace(/\/\*[^*]*?\*\//g, '') + '</style>');
  page = page.replace('<!--PIANO-->', `<script src="/${pianoUrl}"></script>`)
    .replace(/<script>\s*<!--BUNDLE-->\s*<\/script>/, `<script src="/${gameUrl}"></script>`);
  for (const [name, url] of Object.entries(abs)) page = page.split(`"${name}"`).join(`"${url}"`);
  page = page.replace('<title>', `<link rel="preload" as="script" href="/${pianoUrl}">\n<link rel="preload" as="script" href="/${gameUrl}">\n<title>`);
  leftovers(page, '页面');
  const unused = [...js.unused().map(a => 'js: ' + a), ...html.unused().map(a => 'html: ' + a)];
  if (unused.length) throw new Error('英文版有译文没用上（原文可能改过了）：\n  ' + unused.join('\n  '));
  fs.mkdirSync(path.join(root, 'en'), { recursive: true });
  fs.writeFileSync(path.join(root, 'en', 'index.html'), document(page).replace('<html lang="zh-CN">', '<html lang="en">'));
  console.log('EN  en/index.html; script', gameUrl);
};
