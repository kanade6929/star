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

仓库开启 GitHub Pages（Settings → Pages → Deploy from a branch → `main` / `root`）后，打开 `https://<用户名>.github.io/<仓库名>/` 即可。`index.html` 是打包好的单文件游戏，不需要构建服务器。

## 修改与打包

```bash
npm install
node build.js          # 生成 index.html 和 out/
```

- `src/`：游戏源码（Three.js）。`main.js` 主循环与操作，`level1.js` 星之章，`level2.js` 月之章，`post.js` 像素渲染管线。
- `page.html`：页面模板（菜单、HUD、触屏按钮）。
- `test/`：用 Playwright 跑的自动测试脚本（`play.js` 电脑、`mobile.js` 手机）。

## 致谢

钢琴采样：Salamander Grand Piano（Alexander Holm，CC BY 3.0）。

音效采样（`audio/sfx/`）：
- 钢片琴、颤音琴、泰国锣、大锣：University of Iowa Electronic Music Studios, Musical Instrument Samples（可自由使用）。
- 竖琴：tonejs-instruments（Nicholaus Brosowsky，CC BY 3.0）。
- 脚步、纸牌、门闩、石头与闷响：Kenney（RPG Audio、Casino Audio、Impact Sounds，CC0）。

## 旧版

之前的 2D 横版《辰星夜》保留在 [`2d/`](2d/) 目录，在线地址是本仓库 Pages 网址后面加 `/2d/`。
