// 两种"深渊"：星之章的星空虚空、月之章的夜湖（倒映天空与月亮）
// 两者都支持通关时的星轨：星星绕天极旋转，拖出延时摄影般的弧线
import * as THREE from 'three';
import { REFL } from './post.js';

const COMMON = `
  float h(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
  float n(vec2 p){ vec2 i = floor(p), f = fract(p); f = f * f * (3. - 2. * f);
    return mix(mix(h(i), h(i + vec2(1, 0)), f.x), mix(h(i + vec2(0, 1)), h(i + vec2(1, 1)), f.x), f.y); }
  vec2 rot(vec2 p, vec2 c, float a){ vec2 d = p - c; float s = sin(a), co = cos(a); return c + vec2(d.x * co - d.y * s, d.x * s + d.y * co); }
  vec3 layer(vec2 p, float dens, float sz, float time){ vec2 g = floor(p * dens); vec2 f = fract(p * dens);
    float r = h(g); if (r > .925) { vec2 c = vec2(h(g + 3.1), h(g + 7.7)) * .8 + .1; float d = length(f - c);
      float tw = .6 + .4 * sin(time * (1. + r * 3.) + r * 40.);
      vec3 col = mix(vec3(.8, .85, 1.), vec3(1., .9, .7), h(g + 1.3));
      return col * step(d, sz) * tw * (r - .925) * 13.3; } return vec3(0.); }
  // 银河：大尺度的紫、靛、青、玫瑰色缓慢渐变，加一条斜向拉长、带暗尘的星云带（很淡，只做底色）
  vec3 galaxy(vec2 p, float time){
    float g1 = n(p * .035 + 2.), g2 = n(p * .05 - 7.);
    vec3 c = mix(vec3(.02, .011, .045), vec3(.007, .02, .045), g1);
    c = mix(c, vec3(.036, .012, .036), smoothstep(.55, .9, g2) * .7);
    vec2 r = vec2(p.x * .8 + p.y * .6, -p.x * .6 + p.y * .8);
    float w = (n(vec2(r.x * .05, 0.) + 5.) - .5) * 7.;
    float yb = mod(r.y + w + 24., 48.) - 24.;
    float band = exp(-yb * yb / 34.);
    float cl = n(vec2(r.x * .12, r.y * .35)) * .6 + n(vec2(r.x * .3, r.y * .9) + 3.) * .4;
    float dust = smoothstep(.55, .78, n(vec2(r.x * .2, r.y * .7) + 11.));
    vec3 bc = mix(vec3(.026, .022, .06), vec3(.014, .04, .062), n(r * .06));
    bc = mix(bc, vec3(.05, .024, .05), smoothstep(.6, .9, n(r * .09 + 4.)) * .6);
    vec3 col = c * .75 + bc * band * (.45 + cl * .8) * (1. - dust * .55);
    // 星云带里细密的微星
    vec2 gg = floor(p * 9.); float hh = h(gg + 2.7);
    col += vec3(.75, .8, 1.) * step(.965, hh) * band * (.5 + .5 * sin(time * 2. + hh * 50.)) * .12;
    return col * .62;
  }
  // 星轨：极坐标下按环分格，每颗星拖出一段弧
  vec3 trails(vec2 p, vec2 pole, float spin, float len){
    vec2 d = p - pole; float r = length(d); if (r < .3) return vec3(0.);
    float a = atan(d.y, d.x);
    float W = .38; float ri = floor(r / W); float rc = (ri + .5) * W;
    float lw = abs(r - rc); if (lw > .035 || h(vec2(ri, 3.3)) < .3) return vec3(0.);
    float N = max(4., floor(rc * 1.5)); float seg = 6.2832 / N;
    float aa = mod(a - spin, 6.2832);
    vec3 col = vec3(0.);
    float s0 = floor(aa / seg);
    for (int k = 0; k < 10; k++) {
      float s = s0 + float(k);
      float si = mod(s, N);
      float hs = h(vec2(ri, si) + .37);
      if (hs < .72) continue;
      float th = (s + .15 + .7 * h(vec2(si, ri) + 9.1)) * seg;
      float t = (aa - th + len) / len;
      if (t >= 0. && t <= 1.) {
        vec3 c = mix(vec3(.75, .82, 1.), vec3(1., .88, .66), h(vec2(si * 1.7, ri)));
        col += c * pow(t, 1.8) * (.35 + .65 * hs) * 1.1;
      }
      if (th - len > aa + seg) break;
    }
    return col;
  }
`;

// 星之章：星云虚空
export function starVoid() {
  return new THREE.ShaderMaterial({
    uniforms: { time: { value: 0 }, cam: { value: new THREE.Vector2() }, trail: { value: 0 }, spin: { value: 0 }, pole: { value: new THREE.Vector2() } },
    vertexShader: `varying vec3 vW; void main(){ vec4 w = modelMatrix * vec4(position, 1.); vW = w.xyz; gl_Position = projectionMatrix * viewMatrix * w; }`,
    fragmentShader: `uniform float time, trail, spin; uniform vec2 cam, pole; varying vec3 vW;
      ${COMMON}
      void main(){
        vec2 p = vW.xz;
        vec2 p1 = p + cam * .35, p2 = p + cam * .6;
        float neb = n(p1 * .12) * .6 + n(p1 * .3 + 5.) * .4;
        vec3 base = mix(vec3(.003, .003, .011), vec3(.008, .005, .02), smoothstep(.3, .9, neb)) * .6 + galaxy(p1 * .9, time);
        base += vec3(.017, .007, .028) * smoothstep(.62, .95, n(p1 * .08 + 9.));
        base += vec3(.006, .016, .03) * smoothstep(.65, .95, n(p1 * .1 - 3.));
        // 星星本身也会跟着天极转起来
        vec2 pl = pole + cam * .35;
        vec2 q1 = rot(p1, pl, spin), q2 = rot(p2, pole + cam * .6, spin);
        vec3 s = layer(q2, 2.2, .09, time) + layer(q1, 4., .07, time) * .6 + layer(q1 + 11., 7., .06, time) * .35;
        vec3 tr = trails(p1, pl, spin, trail * 1.4);
        gl_FragColor = vec4(base * (1. + trail * .6) + s * .95 * (1. - trail * .7) + tr * trail, 1.);
      }`
  });
}

// 月之章：夜湖。倒映岛上的东西（反射图）、天上的星和月，水面有像素波纹和低雾
export function lakeMat() {
  return new THREE.ShaderMaterial({
    uniforms: {
      time: { value: 0 }, cam: { value: new THREE.Vector2() }, trail: { value: 0 }, spin: { value: 0 }, pole: { value: new THREE.Vector2() },
      moon: { value: new THREE.Vector3(30, -6, 1) }, phase: { value: .2 }, orb: { value: new THREE.Vector3() }, orbK: { value: 1 },
      tReflect: REFL.tReflect, reflMat: REFL.reflMat, glow: { value: 0 }
    },
    vertexShader: `uniform mat4 reflMat; varying vec3 vW; varying vec4 vR;
      void main(){ vec4 w = modelMatrix * vec4(position, 1.); vW = w.xyz; vR = reflMat * w; gl_Position = projectionMatrix * viewMatrix * w; }`,
    fragmentShader: `uniform float time, trail, spin, phase, orbK, glow; uniform vec2 cam, pole; uniform vec3 moon, orb; uniform sampler2D tReflect; varying vec3 vW; varying vec4 vR;
      ${COMMON}
      void main(){
        vec2 p = vW.xz;
        // 像素波纹：横向的细长起伏
        float rip = n(vec2(p.x * 1.2 + time * .25, p.y * 5. - time * .4)) - .5;
        rip += (n(vec2(p.x * 2.7 - time * .3, p.y * 9. + time * .2)) - .5) * .5;
        vec3 base = mix(vec3(.006, .007, .022), vec3(.012, .01, .04), smoothstep(.2, .8, n(p * .07 + 3.))) * .75 + galaxy(p + cam * .5 + vec2(rip * .2, 0.), time) * .6;
        // 天空倒影（视差更远）
        vec2 sp = p + cam * .5 + vec2(rip * .25, 0.);
        vec2 pl = pole + cam * .5;
        vec2 q = rot(sp, pl, spin);
        vec3 stars = layer(q, 2.6, .08, time) + layer(q + 7., 5., .06, time) * .5;
        vec3 tr = trails(p + cam * .5 + vec2(rip * .03, 0.), pl, spin, trail * 1.25) * .55;
        // 月亮倒影：带相位的圆，被波纹切成几条
        vec2 mp = vec2(moon.x, moon.y) + cam * .5;
        vec2 md = (sp - mp) * vec2(1., 1.35);
        float band = step(.0, sin(p.y * 10. + time * 1.5 + rip * 6.)) * .45 + .55;
        float disc = smoothstep(moon.z, moon.z - .08, length(md));
        float sh = smoothstep(moon.z * .96, moon.z * .9, length(md - vec2(moon.z * 1.9 * (1. - phase), -moon.z * .1)));
        float lit = disc * (1. - sh * (1. - phase * phase));
        vec3 mcol = vec3(.95, .93, 1.) * lit * band * (.9 + glow * .45);
        mcol += vec3(.25, .22, .45) * smoothstep(moon.z * 3.2, 0., length(md)) * .3 * (1. + glow * .7);
        // 岸上物体的倒影
        vec2 ruv = vR.xy / vR.w + vec2(rip * .012, 0.);
        vec3 refl = texture2D(tReflect, ruv).rgb * .8;
        // 光点在水里的倒影：竖长的光柱，被波纹打散
        vec2 od = p - orb.xz - vec2(0., orb.y * .9);
        float ostreak = exp(-pow(od.x / (.32 + abs(od.y) * .12), 2.) - pow(od.y / 2.2, 2.)) * (.6 + .4 * band);
        vec3 ocol = vec3(.62, .72, 1.) * ostreak * .55 * orbK;
        // 低雾
        float fog = smoothstep(.45, .9, n(p * .18 + vec2(time * .05, time * .02)));
        vec3 col = base + stars * .6 * (1. - trail * .7) + min(tr * trail, vec3(.75)) + mcol + refl * (1. - glow * .25) + ocol;
        col = min(col, vec3(1.05, 1.03, 1.1));
        col = mix(col, vec3(.04, .04, .085), fog * .3);
        col += vec3(.012, .012, .03) * (rip + .5) * .5;
        gl_FragColor = vec4(col, 1.);
      }`
  });
}

// 太阳之章：黎明的云海。day 从 0（破晓前，云缝里还有星星）到 1（正午，金色的云）
// 通关时星星先绕天极转出星轨，随后被升起的太阳淡掉
export function cloudSea() {
  return new THREE.ShaderMaterial({
    uniforms: { time: { value: 0 }, cam: { value: new THREE.Vector2() }, trail: { value: 0 }, spin: { value: 0 }, pole: { value: new THREE.Vector2() },
      day: { value: 0 }, sun: { value: new THREE.Vector3(60, 2, 3) }, glow: { value: 0 }, orb: { value: new THREE.Vector3() }, orbK: { value: 1 } },
    vertexShader: `varying vec3 vW; void main(){ vec4 w = modelMatrix * vec4(position, 1.); vW = w.xyz; gl_Position = projectionMatrix * viewMatrix * w; }`,
    fragmentShader: `uniform float time, trail, spin, day, glow, orbK; uniform vec2 cam, pole; uniform vec3 sun, orb; varying vec3 vW;
      ${COMMON}
      void main(){
        vec2 p = vW.xz;
        // 深处的天空：破晓前是深紫，白天是暖杏色
        vec2 sp = p + cam * .55;
        vec3 deep = mix(vec3(.035, .02, .06), vec3(.42, .26, .24), day);
        deep = mix(deep, mix(vec3(.09, .035, .08), vec3(.85, .55, .38), day), smoothstep(.3, .9, n(sp * .05)));
        // 破晓前透出淡淡的银河；天亮后换成薰衣草到杏色的柔和渐变
        deep += galaxy(sp, time) * (1. - day) * .9;
        deep = mix(deep, deep * vec3(.86, .9, 1.22), smoothstep(.35, .85, n(sp * .03 + 6.)) * day * .8);
        vec2 q = rot(sp, pole + cam * .55, spin);
        vec3 stars = (layer(q, 2.4, .08, time) + layer(q + 7., 4.6, .06, time) * .5) * .7 * (1. - day) * (1. - trail * .7);
        vec3 tr = trails(sp, pole + cam * .55, spin, trail * 1.3) * trail * (1. - smoothstep(.55, 1., day));
        // 两层云：近的走得快，像素化的边缘
        vec2 c1 = p + cam * .3 + vec2(time * .12, 0.), c2 = p + cam * .15 + vec2(time * .05, time * .02);
        float a1 = n(c1 * .16) * .65 + n(c1 * .42) * .35, a2 = n(c2 * .09 + 4.) * .6 + n(c2 * .25 + 9.) * .4;
        float k1 = step(.56, a1), k2 = step(.5, a2);
        float rim1 = step(.56, a1) - step(.6, a1);
        vec3 cloudLo = mix(vec3(.16, .07, .13), vec3(.95, .66, .48), day), cloudHi = mix(vec3(.38, .16, .22), vec3(1., .88, .66), day);
        vec3 col = deep + stars + min(tr, vec3(.8));
        col = mix(col, cloudLo * (.75 + a2 * .4), k2 * .85);
        col = mix(col, cloudHi * (.8 + a1 * .35), k1);
        col += vec3(1., .78, .5) * rim1 * (.15 + day * .25);
        // 太阳的反光：云层上一片金色
        float sd = length((p + cam * .3 - sun.xy) * vec2(1., 1.3));
        col += vec3(1., .72, .38) * smoothstep(sun.z * 6., 0., sd) * (.18 + glow * .5) * (.4 + day);
        // 光点照亮下面的云
        col += vec3(1., .85, .6) * exp(-pow(length(p - orb.xz) / 2.6, 2.)) * .16 * orbK * (k1 + k2 * .5);
        gl_FragColor = vec4(min(col, vec3(1.1)), 1.);
      }`
  });
}
