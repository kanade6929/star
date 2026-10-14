# 字体瘦身：只留游戏里真正显示的字（从打包好的 index.html 里取，注释里的字不算）
# 用法：先 node build.js，再 python3 tools/subset-fonts.py（需要 pip install fonttools brotli）
# fonts/src/ 里是较全的字体，fonts/*.woff2 是网页实际加载的精简版。新加了文字就重跑一次
import re, glob, os, sys
from fontTools import subset
from fontTools.ttLib import TTFont

root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
html = open(os.path.join(root, 'index.html'), encoding='utf8').read()
html = html.replace(open(os.path.join(root, 'vendor/piano-samples.js'), encoding='utf8').read(), '')
# 游戏脚本已拆成 assets/game.<指纹>.js，文字大多在里面，一起算上（钢琴采样脚本不算）
for js in re.findall(r'assets/game\.[0-9a-f]+\.js', html):
    html += open(os.path.join(root, js), encoding='utf8').read()
chars = set(html)
for m in re.finditer(r'\\u\{([0-9a-fA-F]+)\}|\\u([0-9a-fA-F]{4})', html):
    chars.add(chr(int(m.group(1) or m.group(2), 16)))
cjk = {ord(c) for c in chars if ord(c) >= 0x2E80}
def fix_winding(font):
    # 站酷小薇原字体里个别字（如「回」）内圈轮廓方向画反了，浏览器会把它填成实心方块；按嵌套层数把方向理顺
    gl = font['glyf']; fixed = []
    def area(p): return sum(p[i][0] * p[i - 1][1] - p[i - 1][0] * p[i][1] for i in range(len(p))) / 2
    def inside(pt, poly):
        x, y = pt; c = False
        for i in range(len(poly)):
            (x1, y1), (x2, y2) = poly[i], poly[i - 1]
            if (y1 > y) != (y2 > y) and x < (x2 - x1) * (y - y1) / (y2 - y1) + x1: c = not c
        return c
    for name in font.getGlyphOrder():
        g = gl[name]
        if g.isComposite() or g.numberOfContours < 2: continue
        co, ends, fl = g.getCoordinates(gl); co = list(co); fl = list(fl)
        rng = []; s0 = 0
        for e in ends: rng.append((s0, e + 1)); s0 = e + 1
        cs = [co[a:b] for a, b in rng]; A = [area(c) for c in cs]
        if A[0] == 0: continue
        sign = 1 if A[max(range(len(A)), key=lambda i: abs(A[i]))] > 0 else -1
        flip = []
        for i, c in enumerate(cs):
            depth = sum(1 for j in range(len(cs)) if j != i and abs(A[j]) > abs(A[i]) and inside(c[0], cs[j]))
            want = sign if depth % 2 == 0 else -sign
            if A[i] * want < 0: flip.append(i)
        if not flip: continue
        for i in flip:
            a, b = rng[i]; co[a:b] = co[a:b][::-1]; fl[a:b] = fl[a:b][::-1]
        g.coordinates = type(g.coordinates)(co); g.flags = bytearray(fl); fixed.append(name)
    return fixed

bad = 0
for src in sorted(glob.glob(os.path.join(root, 'fonts/src/*.woff2'))):
    cmap = TTFont(src).getBestCmap()
    # 拉丁字母、数字、标点全留（体积很小），中文只留用到的
    keep = {u for u in cmap if u < 0x2E80 or (0x3000 <= u <= 0x303F) or (0xFF00 <= u <= 0xFFEF)} | (cjk & set(cmap))
    miss = sorted(u for u in cjk - set(cmap) if not 0xFE00 <= u <= 0xFE0F)
    out = os.path.join(root, 'fonts', os.path.basename(src))
    opt = subset.Options(); opt.flavor = 'woff2'; opt.layout_features = ['*']; opt.name_IDs = ['*']; opt.notdef_outline = True
    f = TTFont(src); s = subset.Subsetter(opt); s.populate(unicodes=keep); s.subset(f)
    if 'zcool' in src:
        fx = fix_winding(f)
        if fx: print('  修正轮廓方向:', ''.join(chr(u) for u, n in f.getBestCmap().items() if n in fx))
    f.flavor = 'woff2'; f.save(out)
    print(os.path.basename(src), len(keep), 'glyphs', os.path.getsize(src) // 1024, '->', os.path.getsize(out) // 1024, 'KB')
    if miss:
        bad = 1; print('  缺字（会用系统字体显示）:', ''.join(map(chr, miss)))
sys.exit(bad)
