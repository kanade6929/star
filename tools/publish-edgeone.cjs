// EdgeOne 仅发布网站文件；构建器、源码、依赖和未精简的原字体不进入输出目录。
const fs = require('fs'), path = require('path');
const root = path.resolve(__dirname, '..'), output = path.join(root, 'out', 'edgeone');
fs.mkdirSync(output, { recursive: true });
let count = 0, bytes = 0;
function copy(name) {
  const file = path.join(root, name), stat = fs.statSync(file);
  if (stat.isDirectory()) {
    for (const entry of fs.readdirSync(file).sort()) {
      if (entry === '.gitkeep' || name === 'fonts' && entry === 'src') continue;
      copy(`${name}/${entry}`);
    }
    return;
  }
  if (stat.size > 25 * 1024 * 1024) throw new Error(`EdgeOne 文件大小超限: ${name}`);
  const dest = path.join(output, name);
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  fs.copyFileSync(file, dest);
  count++; bytes += stat.size;
}
['index.html', 'diag.html', 'assets', 'audio', 'fonts', 'img', '2d'].forEach(copy);
if (count > 20000) throw new Error('EdgeOne 文件数量超限');
console.log(`EdgeOne: ${count} files, ${bytes} bytes -> out/edgeone`);
