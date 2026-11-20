// GLSL sources. Everything shares COMMON for light, caustics and water fog.

export const HEAD = `#version 300 es
precision highp float;
`;

export const COMMON = `
uniform vec3 uCamPos;
uniform float uTime;
uniform vec3 uLightDir;
uniform vec3 uLightColor;
uniform float uLight;
uniform vec3 uAmbient;
uniform vec3 uWaterTop;
uniform vec3 uWaterDeep;
uniform float uFog;
uniform float uCaustics;
uniform float uSurfaceY;
uniform sampler2D uCausticTex;
uniform float uGlow;

float hash12(vec2 p) {
  vec3 p3 = fract(vec3(p.xyx) * 0.1031);
  p3 += dot(p3, p3.yzx + 33.33);
  return fract((p3.x + p3.y) * p3.z);
}
float vnoise(vec2 p) {
  vec2 i = floor(p), f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash12(i), hash12(i + vec2(1, 0)), u.x), mix(hash12(i + vec2(0, 1)), hash12(i + vec2(1, 1)), u.x), u.y);
}
vec3 waterColor(vec3 dir) {
  float t = clamp(dir.y * 1.5 + 0.42, 0.0, 1.0);
  t = t * t * (3.0 - 2.0 * t);
  vec3 c = mix(uWaterDeep, uWaterTop, t);
  float sun = pow(max(dot(dir, uLightDir), 0.0), 5.0);
  return c + uLightColor * sun * 0.22 * uLight;
}
float causticAt(vec3 P) {
  vec2 uv = P.xz * 0.085 + vec2(P.y * 0.015);
  float t = uTime * 0.045;
  vec2 w = vec2(sin(uv.y * 9.0 + t * 9.0), cos(uv.x * 8.0 - t * 8.0)) * 0.012;
  float a = texture(uCausticTex, uv + w + vec2(t, t * 0.7)).r;
  float b = texture(uCausticTex, uv * 1.37 - w + vec2(-t * 0.8, t * 0.45) + 0.5).r;
  float c = min(a, b);
  return c * c * 2.6 + (a + b) * 0.1;
}
vec3 applyFog(vec3 col, vec3 P) {
  vec3 d = P - uCamPos;
  float dist = length(d);
  float f = max(1.0 - exp(-dist * uFog), smoothstep(26.0, 62.0, dist));
  return mix(col, waterColor(d / dist), clamp(f, 0.0, 1.0));
}
vec3 lit(vec3 base, vec3 N, vec3 P, float gloss, float caus) {
  float ndl = dot(N, uLightDir);
  float wrap = clamp(ndl * 0.55 + 0.45, 0.0, 1.0);
  float depth = clamp((uSurfaceY - P.y) / uSurfaceY, 0.0, 1.0);
  float atten = mix(1.0, 0.62, depth);
  float c = causticAt(P) * uCaustics * caus * smoothstep(-0.1, 0.5, ndl) * atten;
  vec3 V = normalize(uCamPos - P);
  vec3 H = normalize(uLightDir + V);
  float spec = pow(max(dot(N, H), 0.0), 36.0) * gloss;
  float rim = pow(1.0 - clamp(abs(dot(N, V)), 0.0, 1.0), 3.0);
  vec3 light = uAmbient + uLightColor * uLight * (wrap * atten + c);
  return base * light + uLightColor * (uLight * spec) + rim * waterColor(-V) * 0.3;
}
vec3 hueShift(vec3 c, float a) {
  if (a == 0.0) return c;
  const vec3 k = vec3(0.57735);
  float ca = cos(a);
  return c * ca + cross(k, c) * sin(a) + k * dot(k, c) * (1.0 - ca);
}
`;

// ---------- background (full screen) ----------
export const BG_VS = HEAD + `
layout(location=0) in vec3 aPos;
out vec2 vNdc;
void main() { vNdc = aPos.xy; gl_Position = vec4(aPos.xy, 1.0, 1.0); }`;

export const BG_FS = HEAD + COMMON + `
uniform mat4 uInvVP;
uniform float uRays;
in vec2 vNdc;
out vec4 o;
void main() {
  vec4 p = uInvVP * vec4(vNdc, 1.0, 1.0);
  vec3 dir = normalize(p.xyz / p.w - uCamPos);
  vec3 col = waterColor(dir);
  // distant light streaks
  float a = atan(dir.x, 0.6 + dir.y) * 7.0;
  float streak = vnoise(vec2(a + uTime * 0.05, uTime * 0.07)) * vnoise(vec2(a * 2.3 - uTime * 0.04, 3.0));
  col += uLightColor * uLight * uRays * streak * smoothstep(-0.1, 0.5, dir.y) * 0.18;
  col += (hash12(gl_FragCoord.xy + fract(uTime)) - 0.5) / 255.0;
  o = vec4(col, 1.0);
}`;

// ---------- sand floor ----------
export const FLOOR_VS = HEAD + `
layout(location=0) in vec3 aPos;
layout(location=1) in vec3 aNormal;
uniform mat4 uVP;
out vec3 vP; out vec3 vN;
void main() { vP = aPos; vN = aNormal; gl_Position = uVP * vec4(aPos, 1.0); }`;

export const FLOOR_FS = HEAD + COMMON + `
uniform int uFloorType;
uniform vec3 uFloorA;
uniform vec3 uFloorB;
in vec3 vP; in vec3 vN;
out vec4 o;
vec3 hsv(float h, float s, float v) {
  vec3 k = clamp(abs(mod(h * 6.0 + vec3(0, 4, 2), 6.0) - 3.0) - 1.0, 0.0, 1.0);
  return v * mix(vec3(1), k, s);
}
void main() {
  vec3 N = normalize(vN);
  vec2 xz = vP.xz;
  float big = vnoise(xz * 0.18) * 0.6 + vnoise(xz * 0.6) * 0.4;
  vec3 base = mix(uFloorA, uFloorB, big);
  float gloss = 0.05;
  if (uFloorType == 0) {
    // sand with ripples and grains
    float rip = sin(xz.x * 2.2 + vnoise(xz * 0.5) * 6.0 + xz.y * 0.6);
    N = normalize(N + vec3(rip * 0.12, 0.0, rip * 0.05));
    float grain = hash12(floor(xz * 90.0));
    base *= 0.9 + grain * 0.2;
    base *= 0.92 + 0.08 * rip;
  } else {
    float scale = uFloorType == 2 ? 1.6 : 0.9;
    vec4 cell = texture(uCausticTex, xz * scale * 0.25);
    float stone = smoothstep(0.62, 0.25, cell.g);
    vec3 sc;
    if (uFloorType == 3) sc = hsv(cell.b, 0.55, 0.95);
    else sc = mix(uFloorA, uFloorB, cell.b) * (0.8 + 0.4 * hash12(vec2(cell.b * 91.0, 3.0)));
    vec3 gap = uFloorA * (uFloorType == 3 ? 0.8 : 0.3);
    if (uFloorType == 2) { // soil: dark fine grains with a few stones
      float grain = hash12(floor(xz * 70.0));
      vec3 soil = uFloorA * (0.75 + grain * 0.4);
      stone *= step(0.72, cell.b);
      base = mix(soil, uFloorB * (0.8 + 0.4 * cell.b), stone);
    } else base = mix(gap, sc, stone);
    N = normalize(N + vec3(dFdx(stone), 0.0, dFdy(stone)) * -1.5);
    gloss = 0.25 * stone;
  }
  vec3 col = lit(base, N, vP, gloss, 1.3);
  o = vec4(applyFog(col, vP), 1.0);
}`;

// ---------- decorations ----------
export const DECOR_VS = HEAD + `
layout(location=0) in vec3 aPos;
layout(location=1) in vec3 aNormal;
layout(location=3) in vec4 aColor;
uniform mat4 uVP;
uniform mat4 uModel;
uniform float uTime;
uniform float uSway;
uniform float uPhase;
out vec3 vP; out vec3 vN; out vec3 vC;
void main() {
  vec3 p = aPos;
  float s = aColor.a;
  float t = uTime * 1.1 + uPhase;
  float sw = s * s * uSway;
  p.x += sw * (sin(t + p.y * 0.8) + 0.35 * sin(t * 2.3 + p.y * 2.1));
  p.z += sw * 0.6 * cos(t * 0.8 + p.y * 0.6);
  vec4 w = uModel * vec4(p, 1.0);
  vP = w.xyz;
  vN = mat3(uModel) * aNormal;
  vC = aColor.rgb;
  gl_Position = uVP * w;
}`;

export const DECOR_FS = HEAD + COMMON + `
uniform float uHue;
uniform float uEmissive;
uniform float uHighlight;
uniform float uGhost;
in vec3 vP; in vec3 vN; in vec3 vC;
out vec4 o;
void main() {
  vec3 N = normalize(vN);
  if (!gl_FrontFacing) N = -N;
  vec3 base = max(hueShift(vC, uHue), 0.0);
  vec3 col = lit(base, N, vP, 0.25, 1.0);
  col += base * uEmissive * (0.6 + 0.4 * sin(uTime * 1.5 + vP.x)) * (0.35 + uGlow);
  col = applyFog(col, vP);
  col += vec3(0.25, 0.45, 0.6) * uHighlight * (0.6 + 0.4 * sin(uTime * 6.0));
  o = vec4(col, uGhost > 0.0 ? 0.55 : 1.0);
}`;

// ---------- drawn creatures ----------
export const FISH_VS = HEAD + `
layout(location=0) in vec3 aPos;
layout(location=1) in vec3 aNormal;
layout(location=2) in vec2 aUv;
layout(location=4) in vec2 aBody;    // x: 0 head .. 1 tail, y: 0 top .. 1 bottom
uniform mat4 uVP;
uniform mat4 uModel;
uniform int uStyle;                  // 0 fish, 1 eel, 2 jelly, 3 floaty, 4 crawler
uniform float uPhase;
uniform float uAmp;
uniform float uBend;
uniform float uWaveK;
uniform float uPuff;
out vec3 vP; out vec3 vN; out vec2 vUv;
void main() {
  vec3 p = aPos;
  vec3 n = aNormal;
  float bx = aBody.x, by = aBody.y;
  if (uStyle == 0 || uStyle == 1) {
    float w = uStyle == 0 ? (0.12 + 0.88 * bx * bx) : (0.25 + 0.75 * bx);
    float ph = uPhase - bx * uWaveK;
    p.z += sin(ph) * uAmp * w + uBend * bx * bx;
    p.z -= sin(uPhase) * uAmp * 0.25 * (1.0 - bx); // head counter-sway
    float slope = cos(ph) * uAmp * w * uWaveK + 2.0 * uBend * bx;
    n = normalize(n + vec3(slope * n.z, 0.0, 0.0));
  } else if (uStyle == 2) {
    float pulse = sin(uPhase);
    float top = 1.0 - by;
    p.x *= 1.0 + pulse * 0.10 * top - pulse * 0.04 * by;
    p.z *= 1.0 + pulse * 0.10 * top;
    p.y *= 1.0 - pulse * 0.05;
    p.x += sin(uPhase * 0.7 - by * 6.0) * uAmp * 0.6 * by * by;
    p.z += cos(uPhase * 0.6 - by * 5.0) * uAmp * 0.6 * by * by;
  } else if (uStyle == 3) {
    float legs = smoothstep(0.45, 1.0, by);
    p.z += sin(uPhase - by * 3.0) * uAmp * legs;
    p.x += sin(uPhase * 0.5) * uAmp * 0.3 * legs;
    p.z += uBend * (1.0 - by) * 0.3;
  } else {
    float legs = smoothstep(0.55, 1.0, by);
    p.x += sin(uPhase + bx * 14.0) * uAmp * legs;
    p.y += abs(sin(uPhase + bx * 9.0)) * uAmp * 0.4 * legs;
  }
  p.z *= 1.0 + uPuff * 0.8;
  vec4 w = uModel * vec4(p, 1.0);
  vP = w.xyz;
  vN = mat3(uModel) * n;
  vUv = aUv;
  gl_Position = uVP * w;
}`;

export const FISH_FS = HEAD + COMMON + `
uniform sampler2D uTex;
uniform float uHighlight;
uniform float uFlash;
in vec3 vP; in vec3 vN; in vec2 vUv;
out vec4 o;
void main() {
  vec4 t = texture(uTex, vUv);
  if (t.a < 0.5) discard;
  vec3 N = normalize(vN);
  if (!gl_FrontFacing) N = -N;
  vec3 base = t.rgb;
  vec3 col = lit(base * 1.05, N, vP, 0.55, 0.7);
  col += base * uGlow * 0.55;
  col = applyFog(col, vP);
  col += vec3(1.0, 0.95, 0.7) * uFlash * 0.5;
  col += vec3(0.3, 0.55, 0.7) * uHighlight * 0.35;
  o = vec4(col, 1.0);
}`;

// ---------- light shafts ----------
export const RAYS_VS = HEAD + `
layout(location=0) in vec3 aPos;
layout(location=2) in vec2 aUv;
layout(location=3) in vec4 aColor;   // r: seed, g: width
uniform mat4 uVP;
uniform float uTime;
out vec2 vUv; out float vSeed; out vec3 vP;
void main() {
  vec3 p = aPos;
  p.x += sin(uTime * 0.13 + aColor.r * 20.0) * 1.2 * aUv.y;
  vUv = aUv; vSeed = aColor.r; vP = p;
  gl_Position = uVP * vec4(p, 1.0);
}`;

export const RAYS_FS = HEAD + COMMON + `
uniform float uRays;
in vec2 vUv; in float vSeed; in vec3 vP;
out vec4 o;
void main() {
  float edge = smoothstep(0.0, 0.35, vUv.x) * smoothstep(1.0, 0.65, vUv.x);
  float fall = pow(1.0 - vUv.y, 1.4) * smoothstep(0.0, 0.08, vUv.y);
  float flick = 0.55 + 0.45 * sin(uTime * (0.3 + vSeed * 0.4) + vSeed * 40.0);
  float stripes = 0.6 + 0.4 * vnoise(vec2(vUv.x * 6.0 + vSeed * 10.0, uTime * 0.2));
  float dist = length(vP - uCamPos);
  float a = edge * fall * flick * stripes * uRays * 0.16 * exp(-dist * uFog * 0.6);
  o = vec4(uLightColor * uLight * a, 1.0);
}`;

// ---------- water surface seen from below ----------
export const SURF_VS = HEAD + `
layout(location=0) in vec3 aPos;
uniform mat4 uVP;
out vec3 vP;
void main() { vP = aPos; gl_Position = uVP * vec4(aPos, 1.0); }`;

export const SURF_FS = HEAD + COMMON + `
in vec3 vP;
out vec4 o;
void main() {
  vec3 P = vP;
  float c = causticAt(vec3(P.x * 0.7, 0.0, P.z * 0.7 + uTime * 0.05));
  float n = vnoise(P.xz * 0.15 + uTime * 0.05);
  vec3 d = P - uCamPos;
  float dist = length(d);
  vec3 sky = mix(uWaterTop * 1.5, uLightColor, 0.35) * (0.35 + uLight * 0.6);
  vec3 col = sky * (0.55 + 0.6 * c + 0.3 * n);
  float fade = exp(-dist * uFog * 1.1);
  o = vec4(mix(waterColor(d / dist), col, fade), 1.0);
}`;

// ---------- floating specks ----------
export const SNOW_VS = HEAD + `
layout(location=0) in vec3 aPos;     // seed position in unit box
layout(location=3) in vec4 aColor;   // rand
uniform mat4 uVP;
uniform float uTime;
uniform vec3 uBoxMin;
uniform vec3 uBoxSize;
uniform float uPx;
out float vA; out vec3 vP;
void main() {
  vec3 u = aPos;
  u.y = fract(u.y - uTime * (0.004 + aColor.r * 0.006));
  u.x = fract(u.x + sin(uTime * 0.1 + aColor.g * 30.0) * 0.004 + uTime * 0.002);
  vec3 p = uBoxMin + u * uBoxSize;
  p.z += sin(uTime * 0.2 + aColor.b * 20.0) * 0.4;
  vP = p;
  vec4 c = uVP * vec4(p, 1.0);
  gl_Position = c;
  gl_PointSize = clamp(uPx * (0.6 + aColor.a) / c.w, 1.0, 6.0);
  vA = smoothstep(0.0, 0.1, u.y) * smoothstep(1.0, 0.85, u.y);
}`;

export const SNOW_FS = HEAD + COMMON + `
uniform float uAmount;
in float vA; in vec3 vP;
out vec4 o;
void main() {
  vec2 q = gl_PointCoord * 2.0 - 1.0;
  float r = dot(q, q);
  if (r > 1.0) discard;
  float dist = length(vP - uCamPos);
  float a = (1.0 - r) * vA * uAmount * 0.5 * exp(-dist * uFog * 0.7);
  o = vec4((uLightColor * uLight * 0.7 + uAmbient + uGlow * vec3(0.2, 0.6, 0.8)) * a, 1.0);
}`;

// ---------- bubbles & food (point sprites) ----------
export const POINTS_VS = HEAD + `
layout(location=0) in vec4 aPos;     // xyz, size (world)
layout(location=3) in vec4 aColor;   // alpha, kind, spare
uniform mat4 uVP;
uniform float uPx;
out float vA; out float vKind; out vec3 vP;
void main() {
  vec4 c = uVP * vec4(aPos.xyz, 1.0);
  gl_Position = c;
  gl_PointSize = clamp(uPx * aPos.w / c.w, 1.5, 96.0);
  vA = aColor.x; vKind = aColor.y; vP = aPos.xyz;
}`;

export const POINTS_FS = HEAD + COMMON + `
in float vA; in float vKind; in vec3 vP;
out vec4 o;
void main() {
  vec2 q = gl_PointCoord * 2.0 - 1.0;
  q.y = -q.y;
  float r = length(q);
  if (r > 1.0) discard;
  if (vKind < 0.5) {
    // bubble: bright rim + highlight
    float rim = smoothstep(0.6, 1.0, r) * smoothstep(1.0, 0.92, r);
    float hl = smoothstep(0.35, 0.0, length(q - vec2(-0.35, 0.4)));
    vec3 c = mix(uWaterTop * 1.6 + 0.2, vec3(1.0), 0.5) * (0.4 + 0.6 * uLight) + uGlow * vec3(0.1, 0.3, 0.4);
    float a = (rim * 0.85 + hl * 0.9 + 0.08) * vA;
    o = vec4(c * a, a);
  } else {
    // food pellet: little lit sphere
    vec3 N = vec3(q, sqrt(max(0.0, 1.0 - r * r)));
    vec3 base = vKind < 1.5 ? vec3(0.78, 0.42, 0.18) : vec3(0.55, 0.75, 0.25);
    vec3 col = lit(base, N, vP, 0.4, 0.5);
    col = applyFog(col, vP);
    float a = vA * smoothstep(1.0, 0.85, r);
    o = vec4(col * a, a);
  }
}`;

// ---------- soft blob shadows / selection rings on the floor ----------
export const BLOB_VS = HEAD + `
layout(location=0) in vec3 aPos;     // unit quad xz in [-1,1]
layout(location=5) in vec4 aInst;    // x y z radius
layout(location=6) in vec4 aInst2;   // alpha, ring
uniform mat4 uVP;
out vec2 vQ; out float vA; out float vRing;
void main() {
  vQ = aPos.xz;
  vA = aInst2.x; vRing = aInst2.y;
  vec3 p = aInst.xyz + vec3(aPos.x * aInst.w, 0.03, aPos.z * aInst.w);
  gl_Position = uVP * vec4(p, 1.0);
}`;

export const BLOB_FS = HEAD + `
uniform float uTime;
in vec2 vQ; in float vA; in float vRing;
out vec4 o;
void main() {
  float r = length(vQ);
  if (vRing > 0.5) {
    float a = smoothstep(0.78, 0.88, r) * smoothstep(1.0, 0.9, r) * vA * (0.7 + 0.3 * sin(uTime * 5.0));
    o = vec4(vec3(0.6, 0.95, 1.0) * a, a);
  } else {
    float a = (1.0 - smoothstep(0.0, 1.0, r)) * vA;
    o = vec4(0.0, 0.0, 0.0, a);
  }
}`;
