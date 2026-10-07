// 打包：把 src/ 打成一个单文件网页
//   index.html        —— 发布用（GitHub Pages 直接打开这个）
//   out/chenxingye.html、out/local.html —— 本地预览与测试
const fs = require('fs'), esb = require('esbuild');
const piano = '<script>\n' + fs.readFileSync('vendor/piano-samples.js', 'utf8') + '</script>';
const r = esb.buildSync({ entryPoints: ['src/main.js'], bundle: true, minify: true, format: 'iife', write: false, target: 'es2020', legalComments: 'none' });
let js = r.outputFiles[0].text;
if (/<\/script|<!--/i.test(js)) { js = js.replace(/<\/script/gi, '<\\/script').replace(/<!--/g, '<\\!--'); console.log('escaped'); }
const page = fs.readFileSync('page.html', 'utf8').replace('<!--PIANO-->', () => piano).replace('<!--BUNDLE-->', () => js);
const full = '<!doctype html>\n<html lang="zh-CN">\n<head>\n<meta charset="utf-8">\n' + page.replace('<canvas', '</head>\n<body>\n<canvas') + '\n</body>\n</html>\n';
fs.mkdirSync('out', { recursive: true });
fs.writeFileSync('out/chenxingye.html', page);
fs.writeFileSync('out/local.html', '<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"></head><body>' + page + '</body></html>');
fs.writeFileSync('index.html', full);
console.log('size', (page.length / 1024).toFixed(0) + 'KB', 'js', (js.length / 1024).toFixed(0) + 'KB');
