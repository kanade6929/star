// 体素化的像素画：把像素画挤出厚度，变成一块块小方块（参考视频里角色和道具的做法）。
// 正面是一整块平的像素画；厚度往后长，中间厚、边缘薄（按到轮廓的距离）。
// 从斜上方看能看到头顶、肩膀的厚度和侧面，光点移动时侧面明暗会变。
import * as THREE from 'three';

const LIN = new Float32Array(256); for (let i = 0; i < 256; i++) { const c = i / 255; LIN[i] = c <= .04045 ? c / 12.92 : Math.pow((c + .055) / 1.055, 2.4); }
const BOX = new THREE.BoxGeometry(1, 1, 1);

// 逐像素算出方块：回调 (cx, cy, t, r, g, b)，cx/cy 为以底边中点为原点的像素坐标（y 向上），t 为厚度
function scan(ctx, W, H, dist, o, cb) {
  const d = ctx.getImageData(0, 0, W, H).data, INF = 99;
  for (let i = 0; i < W * H; i++) dist[i] = d[i * 4 + 3] > 127 ? INF : 0;
  // 到轮廓的距离（两遍倒角距离变换）
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const i = y * W + x; if (!dist[i]) continue;
    let v = dist[i];
    v = x > 0 ? Math.min(v, dist[i - 1] + 1) : 1;
    v = y > 0 ? Math.min(v, dist[i - W] + 1) : Math.min(v, 1);
    if (x > 0 && y > 0) v = Math.min(v, dist[i - W - 1] + 1.4);
    if (x < W - 1 && y > 0) v = Math.min(v, dist[i - W + 1] + 1.4);
    dist[i] = v;
  }
  for (let y = H - 1; y >= 0; y--) for (let x = W - 1; x >= 0; x--) {
    const i = y * W + x; if (!dist[i]) continue;
    let v = dist[i];
    v = x < W - 1 ? Math.min(v, dist[i + 1] + 1) : Math.min(v, 1);
    v = y < H - 1 ? Math.min(v, dist[i + W] + 1) : Math.min(v, 1);
    if (x < W - 1 && y < H - 1) v = Math.min(v, dist[i + W + 1] + 1.4);
    if (x > 0 && y < H - 1) v = Math.min(v, dist[i + W - 1] + 1.4);
    dist[i] = v;
  }
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const i = y * W + x; if (!dist[i]) continue;
    cb(x + .5 - W / 2, H - y - .5, Math.min(o.maxT, o.minT + (dist[i] - 1) * o.slope), LIN[d[i * 4]], LIN[d[i * 4 + 1]], LIN[d[i * 4 + 2]]);
  }
}
const DEF = { px: 1 / 16, stretchY: 1, maxT: .3, minT: .07, slope: .042 };

// 体素材质：侧面、顶面压暗一点让厚度更明显；暗处保留一点自身颜色；受光有上限
export function voxMat(o = {}) {
  const m = new THREE.MeshStandardMaterial({ roughness: .7, metalness: 0, ...o });
  m.onBeforeCompile = sh => {
    sh.vertexShader = 'varying float vSide;\n' + sh.vertexShader.replace('#include <begin_vertex>', '#include <begin_vertex>\nvSide = 1. - abs(normal.z);');
    sh.fragmentShader = 'varying float vSide;\n' + sh.fragmentShader
      .replace('#include <color_fragment>', '#include <color_fragment>\ndiffuseColor.rgb *= mix(1., .6, vSide);')
      .replace('#include <emissivemap_fragment>', '#include <emissivemap_fragment>\ntotalEmissiveRadiance += diffuseColor.rgb * .14;')
      .replace('#include <opaque_fragment>', 'outgoingLight = min(outgoingLight, diffuseColor.rgb * 1.3 + totalEmissiveRadiance);\n#include <opaque_fragment>');
  };
  m.customProgramCacheKey = () => 'vox';
  return m;
}

// 每帧会变的像素画（角色）
export class VoxelSprite {
  constructor(canvas, mat, opts = {}) {
    this.c = canvas; this.W = canvas.width; this.H = canvas.height;
    this.g = canvas.getContext('2d', { willReadFrequently: true });
    this.o = { ...DEF, ...opts };
    const N = this.W * this.H;
    this.mesh = new THREE.InstancedMesh(BOX, mat, N);
    this.mesh.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(N * 3), 3);
    this.mesh.count = 0; this.mesh.frustumCulled = false;
    this.dist = new Float32Array(N); this.M = new THREE.Matrix4();
  }
  update() {
    const o = this.o, px = o.px, py = o.px * o.stretchY, M = this.M, ic = this.mesh.instanceColor.array, mesh = this.mesh;
    let n = 0;
    scan(this.g, this.W, this.H, this.dist, o, (cx, cy, t, r, g, b) => {
      M.makeScale(px, py, t); M.setPosition(cx * px, cy * py, -t / 2); // 正面齐平，只往后长厚度
      mesh.setMatrixAt(n, M); ic[n * 3] = r; ic[n * 3 + 1] = g; ic[n * 3 + 2] = b; n++;
    });
    mesh.count = n; mesh.instanceMatrix.needsUpdate = true; mesh.instanceColor.needsUpdate = true;
  }
}

// 静态的像素道具：一张像素画挤成体素，按 placements（Matrix4 列表）摆很多份，合成一个实例网格
export function voxelBatch(canvas, placements, mat, opts = {}) {
  const o = { ...DEF, ...opts }, W = canvas.width, H = canvas.height, vox = [];
  scan(canvas.getContext('2d', { willReadFrequently: true }), W, H, new Float32Array(W * H), o, (cx, cy, t, r, g, b) => vox.push([cx, cy, t, r, g, b]));
  const N = vox.length * placements.length;
  const mesh = new THREE.InstancedMesh(BOX, mat, Math.max(1, N));
  mesh.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(Math.max(1, N) * 3), 3);
  const L = new THREE.Matrix4(), M = new THREE.Matrix4(), ic = mesh.instanceColor.array, py = o.px * o.stretchY;
  let n = 0;
  placements.forEach(P => vox.forEach(([cx, cy, t, r, g, b]) => {
    L.makeScale(o.px, py, t); L.setPosition(cx * o.px, cy * py, -t / 2 + (o.center ? 0 : 0));
    M.multiplyMatrices(P, L); mesh.setMatrixAt(n, M); ic[n * 3] = r; ic[n * 3 + 1] = g; ic[n * 3 + 2] = b; n++;
  }));
  mesh.count = N; mesh.castShadow = true; mesh.receiveShadow = true;
  return mesh;
}
// 摆放矩阵：位置、绕 y 转、后仰角度（让俯视镜头看得到顶面）、缩放
export function place(x, y, z, ry = 0, tilt = .35, s = 1) {
  const q = new THREE.Quaternion().setFromEuler(new THREE.Euler(-tilt, ry, 0, 'YXZ'));
  return new THREE.Matrix4().compose(new THREE.Vector3(x, y, z), q, new THREE.Vector3(s, s, s));
}
