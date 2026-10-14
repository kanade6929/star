# 辰星夜

用星光解谜的俯视角像素光影小游戏。鼠标（手机上是右摇杆）就是光源：光照到的地方、影子落下的地方，都是解谜的语言。

- 第一幕「XVII 星」：虚空上的路只在星光里显现，用石碑的影子开启机关。
- 第二幕「XVIII 月」：雾湖遗迹，规则反过来，路只在影子里成形。
- 第三幕「XIX 太阳」：尚在远方。

## 怎么玩

| | 电脑 | 手机（横屏） |
|---|---|---|
| 走路 | WASD / 方向键，Shift 奔跑 | 左边摇杆，推到底奔跑 |
| 移动星光 | 移动鼠标；鼠标不动时星光留在原地 | 右边摇杆；松手后星光留在原地 |
| 互动 | E / 空格 | E 键 |
| 暂停 | Esc | 右上角按钮 |

手机竖着拿时，游戏会自动转成横屏显示。

## 在线游玩

在线地址：[star.hugloom.art](https://star.hugloom.art/)。Cloudflare Workers Builds 已连接本仓库的 `main` 分支，构建命令为 `npm run build`，部署命令为 `npx wrangler deploy`。

GitHub Pages 仍可从 `main` / `root` 发布。`index.html` 与 `assets/` 是已生成的发布文件，需要一起提交。

## 修改与打包

### EdgeOne Pages

导入本 Git 仓库的 `main` 分支，框架选择 Other。`edgeone.json` 已指定安装命令 `npm ci --no-audit --no-fund`、构建命令 `npm run build:edgeone`、输出目录 `out/edgeone` 和静态资源缓存头。

未备案域名使用「全球可用区（不含中国大陆）」，并绑定自定义域名。该区域由 EdgeOne 调度境外节点，不代表固定香港节点。网站音画资源和游戏行为保持原版；输出目录包含新版、旧版 2D 以及旧资源路径。

现有 Cloudflare 构建命令仍为 `npm run build`，两种发布方式共用同一份游戏源码。

```bash
npm install
node build.js          # 生成 index.html、assets/ 和 out/
```

- `src/`：游戏源码（Three.js）。`main.js` 主循环与操作，`level1.js` 星之章，`level2.js` 月之章，`post.js` 像素渲染管线。
- `page.html`：页面模板（菜单、HUD、触屏按钮）。
- `assets/`：内容指纹命名的发布资源。音频、字体和图片由原文件直接复制，未重新编码；游戏脚本和钢琴采样按原顺序加载。Cloudflare 将这些资源缓存一年，文件改变时 URL 自动改变。入口 HTML 每次检查更新。
- `out/chenxingye.html`、`out/local.html`：保留内联脚本的本地预览。用 HTTP 服务从仓库根目录访问，以便加载原路径的音乐和字体。
- 历史指纹文件保留，避免尚未刷新页面的玩家在更新后请求不到资源。部署时不应只上传 `index.html`。
- `test/`：用 Playwright 跑的自动测试脚本（`play.js` 电脑、`mobile.js` 手机）。

## 版权

© 2026 kanade（Hug 工作室），保留一切权利。代码、关卡、美术、音乐与文字未经作者书面许可不得复制、修改、再发布或商用，详见 [LICENSE](LICENSE)。下面「致谢」中的第三方素材遵循各自的许可。

## 致谢

渲染引擎：Three.js（MIT License，© three.js authors）。

钢琴采样：Salamander Grand Piano（Alexander Holm，CC BY 3.0）。

音效采样（`audio/sfx/`）：
- 钢片琴、颤音琴、泰国锣、大锣：University of Iowa Electronic Music Studios, Musical Instrument Samples（可自由使用）。
- 竖琴：tonejs-instruments（Nicholaus Brosowsky，CC BY 3.0）。
- 脚步、纸牌、门闩、石头与闷响：Kenney（RPG Audio、Casino Audio、Impact Sounds，CC0）。

## 旧版

之前的 2D 横版《辰星夜》保留在 [`2d/`](2d/) 目录，在线地址是本仓库 Pages 网址后面加 `/2d/`。
