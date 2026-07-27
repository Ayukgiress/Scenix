/**
 * WebGL color-grade processor.
 *
 * Pass 1 — Curves: applies per-channel (R, G, B) and luma tone curves via a
 *   256×4 RGBA texture (one row per channel: R, G, B, Luma).  The luma curve
 *   is applied as a luminance-preserving lift/gamma/gain on all three channels.
 *
 * Pass 2 — Secondary correction: isolates a color range by HSL qualifier and
 *   applies hue/saturation/brightness adjustments only within that mask.
 *
 * Both passes are skipped when the data is at defaults to avoid GPU overhead.
 */

import { useRef, useCallback } from "react";
import type { ColorGradeSettings, CurvePoint } from "@/types/editor";

// ── GLSL ─────────────────────────────────────────────────────────────────────

const VERT = /* glsl */ `
  attribute vec2 a_pos;
  varying vec2 v_uv;
  void main() {
    v_uv = a_pos * 0.5 + 0.5;
    gl_Position = vec4(a_pos, 0.0, 1.0);
  }
`;

// Curves pass: sample per-channel LUT rows from a 256×4 texture.
// Row 0 = R, Row 1 = G, Row 2 = B, Row 3 = Luma.
// Luma curve is applied as a uniform lift on all channels (luminance-preserving).
const FRAG_CURVES = /* glsl */ `
  precision mediump float;
  uniform sampler2D u_frame;
  uniform sampler2D u_curves; // 256 × 4 RGBA — one row per channel
  varying vec2 v_uv;

  float sampleCurve(float v, float row) {
    return texture2D(u_curves, vec2((v * 255.0 + 0.5) / 256.0, (row + 0.5) / 4.0)).r;
  }

  void main() {
    vec4 src = texture2D(u_frame, vec2(v_uv.x, 1.0 - v_uv.y));
    float r = sampleCurve(src.r, 0.0);
    float g = sampleCurve(src.g, 1.0);
    float b = sampleCurve(src.b, 2.0);
    // Luma curve: compute luma of the already channel-corrected pixel,
    // then apply the luma curve as a ratio to preserve hue.
    float luma = 0.2126 * r + 0.7152 * g + 0.0722 * b;
    float lumaOut = sampleCurve(luma, 3.0);
    float ratio = luma > 0.001 ? lumaOut / luma : 1.0;
    gl_FragColor = vec4(clamp(vec3(r, g, b) * ratio, 0.0, 1.0), src.a);
  }
`;

// Secondary correction pass: HSL qualifier + hue/sat/brightness adjustments.
const FRAG_SECONDARY = /* glsl */ `
  precision mediump float;
  uniform sampler2D u_frame;
  // Qualifier
  uniform float u_hueCenter;   // 0–1 (hue/360)
  uniform float u_hueWidth;    // 0–1 (half-width, hue/360)
  uniform float u_satMin;
  uniform float u_satMax;
  uniform float u_lumMin;
  uniform float u_lumMax;
  // Adjustments
  uniform float u_adjHue;      // -0.5 to 0.5 (fraction of full circle)
  uniform float u_adjSat;      // -1 to 1
  uniform float u_adjBri;      // -1 to 1
  varying vec2 v_uv;

  vec3 rgb2hsl(vec3 c) {
    float maxC = max(c.r, max(c.g, c.b));
    float minC = min(c.r, min(c.g, c.b));
    float l = (maxC + minC) * 0.5;
    float d = maxC - minC;
    if (d < 0.0001) return vec3(0.0, 0.0, l);
    float s = l > 0.5 ? d / (2.0 - maxC - minC) : d / (maxC + minC);
    float h;
    if (maxC == c.r)      h = (c.g - c.b) / d + (c.g < c.b ? 6.0 : 0.0);
    else if (maxC == c.g) h = (c.b - c.r) / d + 2.0;
    else                  h = (c.r - c.g) / d + 4.0;
    return vec3(h / 6.0, s, l);
  }

  float hue2rgb(float p, float q, float t) {
    if (t < 0.0) t += 1.0;
    if (t > 1.0) t -= 1.0;
    if (t < 1.0/6.0) return p + (q - p) * 6.0 * t;
    if (t < 1.0/2.0) return q;
    if (t < 2.0/3.0) return p + (q - p) * (2.0/3.0 - t) * 6.0;
    return p;
  }

  vec3 hsl2rgb(vec3 hsl) {
    float h = hsl.x, s = hsl.y, l = hsl.z;
    if (s < 0.0001) return vec3(l);
    float q = l < 0.5 ? l * (1.0 + s) : l + s - l * s;
    float p = 2.0 * l - q;
    return vec3(hue2rgb(p, q, h + 1.0/3.0),
                hue2rgb(p, q, h),
                hue2rgb(p, q, h - 1.0/3.0));
  }

  void main() {
    vec4 src = texture2D(u_frame, vec2(v_uv.x, 1.0 - v_uv.y));
    vec3 hsl = rgb2hsl(src.rgb);

    // Hue distance (wrapping)
    float hueDist = abs(hsl.x - u_hueCenter);
    if (hueDist > 0.5) hueDist = 1.0 - hueDist;
    float hueMask  = smoothstep(u_hueWidth, u_hueWidth * 0.5, hueDist);
    float satMask  = smoothstep(u_satMin - 0.05, u_satMin + 0.05, hsl.y) *
                     smoothstep(u_satMax + 0.05, u_satMax - 0.05, hsl.y);
    float lumMask  = smoothstep(u_lumMin - 0.05, u_lumMin + 0.05, hsl.z) *
                     smoothstep(u_lumMax + 0.05, u_lumMax - 0.05, hsl.z);
    float mask = hueMask * satMask * lumMask;

    vec3 adj = hsl;
    adj.x = fract(adj.x + u_adjHue + 1.0);
    adj.y = clamp(adj.y + u_adjSat, 0.0, 1.0);
    adj.z = clamp(adj.z + u_adjBri, 0.0, 1.0);

    vec3 result = mix(src.rgb, hsl2rgb(adj), mask);
    gl_FragColor = vec4(result, src.a);
}
`;

// Blend mode shader: implements all standard blend modes in GLSL for consistent cross-browser support
const FRAG_BLEND = /* glsl */ `
  precision mediump float;
  uniform sampler2D u_foreground;
  uniform sampler2D u_background;
  uniform int u_blendMode; // 0 = normal, 1 = screen, 2 = multiply, 3 = overlay, 4 = darken, 5 = lighten, 6 = color-dodge, 7 = color-burn, 8 = hard-light, 9 = soft-light, 10 = difference, 11 = exclusion, 12 = hue, 13 = saturation, 14 = color, 15 = luminosity
  varying vec2 v_uv;

  vec3 screen(vec3 a, vec3 b) {
    return 1.0 - (1.0 - a) * (1.0 - b);
  }
  
  vec3 multiply(vec3 a, vec3 b) {
    return a * b;
  }
  
  vec3 overlay(vec3 a, vec3 b) {
    return mix(2.0 * a * b, 1.0 - 2.0 * (1.0 - a) * (1.0 - b), step(0.5, b));
  }
  
  vec3 hardLight(vec3 a, vec3 b) {
    return mix(2.0 * a * b, 1.0 - 2.0 * (1.0 - a) * (1.0 - b), step(0.5, a));
  }
  
  vec3 softLight(vec3 a, vec3 b) {
    return mix(
      b - (1.0 - 2.0 * a) * b * (1.0 - b),
      mix(
        b + (2.0 * a - 1.0) * (16.0 * b * b * b - 12.0 * b * b + 2.0 * b),
        b + (2.0 * a - 1.0) * (sqrt(b) - b),
        step(0.25, b)
      ),
      step(0.5, a)
    );
  }
  
  vec3 difference(vec3 a, vec3 b) {
    return abs(b - a);
  }
  
  vec3 exclusion(vec3 a, vec3 b) {
    return a + b - 2.0 * a * b;
  }
  
  vec3 colorDodge(vec3 a, vec3 b) {
    return min(vec3(1.0), b / (1.0 - a));
  }
  
  vec3 colorBurn(vec3 a, vec3 b) {
    return max(vec3(0.0), 1.0 - (1.0 - b) / a);
  }
  
  vec3 darken(vec3 a, vec3 b) {
    return min(a, b);
  }
  
  vec3 lighten(vec3 a, vec3 b) {
    return max(a, b);
  }
  
  // HSL conversion for hue/saturation/color/luminosity modes
  vec3 rgb2hsl(vec3 c) {
    float minc = min(c.r, min(c.g, c.b));
    float maxc = max(c.r, max(c.g, c.b));
    float d = maxc - minc;
    float h = 0.0;
    float s = 0.0;
    float l = (maxc + minc) / 2.0;
    if (d > 0.00001) {
      s = l < 0.5 ? d / (maxc + minc) : d / (2.0 - maxc - minc);
      if (c.r == maxc) h = mod((c.g - c.b) / d, 6.0);
      else if (c.g == maxc) h = (c.b - c.r) / d + 2.0;
      else h = (c.r - c.g) / d + 4.0;
      h /= 6.0;
    }
    return vec3(h, s, l);
  }
  
  vec3 hsl2rgb(vec3 c) {
    float h = c.x;
    float s = c.y;
    float l = c.z;
    vec3 rgb;
    if (s == 0.0) {
      rgb = vec3(l);
    } else {
      float q = l < 0.5 ? l * (1.0 + s) : l + s - l * s;
      float p = 2.0 * l - q;
      float hue = h;
      vec3 tc = vec3(hue + 1.0/3.0, hue, hue - 1.0/3.0);
      tc.x = fract(tc.x);
      tc.y = fract(tc.y);
      tc.z = fract(tc.z);
      vec3 xyz;
      xyz.x = tc.x < 1.0/6.0 ? p + 6.0 * (q - p) * tc.x : (tc.x < 0.5 ? q : (tc.x < 2.0/3.0 ? p + 6.0 * (q - p) * (2.0/3.0 - tc.x) : p));
      xyz.y = tc.y < 1.0/6.0 ? p + 6.0 * (q - p) * tc.y : (tc.y < 0.5 ? q : (tc.y < 2.0/3.0 ? p + 6.0 * (q - p) * (2.0/3.0 - tc.y) : p));
      xyz.z = tc.z < 1.0/6.0 ? p + 6.0 * (q - p) * tc.z : (tc.z < 0.5 ? q : (tc.z < 2.0/3.0 ? p + 6.0 * (q - p) * (2.0/3.0 - tc.z) : p));
      rgb = xyz;
    }
    return rgb;
  }
  
  vec3 setLuminance(vec3 c, float l) {
    vec3 hsl = rgb2hsl(c);
    hsl.z = l;
    return hsl2rgb(hsl);
  }
  
  vec3 setSaturation(vec3 c, float s) {
    vec3 hsl = rgb2hsl(c);
    hsl.y = s;
    return hsl2rgb(hsl);
  }

  void main() {
    vec4 bg = texture2D(u_background, v_uv);
    vec4 fg = texture2D(u_foreground, v_uv);
    
    vec3 result = fg.rgb;
    
    if (u_blendMode == 1) result = screen(fg.rgb, bg.rgb);
    else if (u_blendMode == 2) result = multiply(fg.rgb, bg.rgb);
    else if (u_blendMode == 3) result = overlay(fg.rgb, bg.rgb);
    else if (u_blendMode == 4) result = darken(fg.rgb, bg.rgb);
    else if (u_blendMode == 5) result = lighten(fg.rgb, bg.rgb);
    else if (u_blendMode == 6) result = colorDodge(fg.rgb, bg.rgb);
    else if (u_blendMode == 7) result = colorBurn(fg.rgb, bg.rgb);
    else if (u_blendMode == 8) result = hardLight(fg.rgb, bg.rgb);
    else if (u_blendMode == 9) result = softLight(fg.rgb, bg.rgb);
    else if (u_blendMode == 10) result = difference(fg.rgb, bg.rgb);
    else if (u_blendMode == 11) result = exclusion(fg.rgb, bg.rgb);
    else if (u_blendMode == 12) { // Hue: keep fg hue, bg saturation and luminance
      vec3 bgHSL = rgb2hsl(bg.rgb);
      vec3 fgHSL = rgb2hsl(fg.rgb);
      result = hsl2rgb(vec3(fgHSL.x, bgHSL.y, bgHSL.z));
    } else if (u_blendMode == 13) { // Saturation: keep fg saturation, bg hue and luminance
      vec3 bgHSL = rgb2hsl(bg.rgb);
      vec3 fgHSL = rgb2hsl(fg.rgb);
      result = hsl2rgb(vec3(bgHSL.x, fgHSL.y, bgHSL.z));
    } else if (u_blendMode == 14) { // Color: keep fg hue and saturation, bg luminance
      vec3 bgHSL = rgb2hsl(bg.rgb);
      vec3 fgHSL = rgb2hsl(fg.rgb);
      result = hsl2rgb(vec3(fgHSL.x, fgHSL.y, bgHSL.z));
    } else if (u_blendMode == 15) { // Luminosity: keep fg luminance, bg hue and saturation
      vec3 bgHSL = rgb2hsl(bg.rgb);
      vec3 fgHSL = rgb2hsl(fg.rgb);
      result = hsl2rgb(vec3(bgHSL.x, bgHSL.y, fgHSL.z));
    }
    
    // Alpha blending with premultiplied alpha
    float alpha = fg.a;
    result = result * alpha + bg.rgb * (1.0 - alpha);
    gl_FragColor = vec4(result, 1.0);
  }
`;

// Color space conversion pass: convert source color space to display (sRGB)
const FRAG_COLORSPACE = /* glsl */ `
  precision mediump float;
  uniform sampler2D u_frame;
  uniform int u_sourceColorSpace; // 0 = srgb, 1 = rec709, 2 = rec2020, 3 = p3, 4 = linear, 5 = log-c, 6 = s-log3, 7 = v-log
  varying vec2 v_uv;

  // sRGB <-> Linear conversion
  float srgbToLinear(float c) {
    if (c <= 0.04045) return c / 12.92;
    return pow((c + 0.055) / 1.055, 2.4);
  }

  float linearToSrgb(float c) {
    if (c <= 0.0031308) return c * 12.92;
    return 1.055 * pow(c, 1.0/2.4) - 0.055;
  }

  vec3 srgbToLinearVec(vec3 c) {
    return vec3(srgbToLinear(c.r), srgbToLinear(c.g), srgbToLinear(c.b));
  }

  vec3 linearToSrgbVec(vec3 c) {
    return vec3(linearToSrgb(c.r), linearToSrgb(c.g), linearToSrgb(c.b));
  }

  // Rec.709 <-> Linear
  float rec709ToLinear(float c) {
    if (c < 0.081) return c / 4.5;
    return pow((c + 0.099) / 1.099, 1.0 / 0.45);
  }

  float linearToRec709(float c) {
    if (c < 0.018) return c * 4.5;
    return 1.099 * pow(c, 0.45) - 0.099;
  }

  // Canon C-Log to linear
  float logCToLinear(float c) {
    if (c < 0.07305207) return (c - 0.07305207) / 5.555556;
    return pow(10.0, (c - 0.38553685) / 0.23650068) - 0.00907644;
  }

  // Sony S-Log3 to linear
  float sLog3ToLinear(float c) {
    if (c < 0.01125000) return (c - 0.03000000) * 0.04104048;
    return pow(10.0, (c - 0.61659995) / 0.04288991) - 0.03000000;
  }

  // Panasonic V-Log to linear
  float vLogToLinear(float c) {
    if (c < 0.09286412) return (c - 0.12500000) * 0.22222222;
    return pow(10.0, (c - 0.35829268) / 0.15268713) - 0.01000000;
  }

  // Rec.2020 to Rec.709 (basic matrix - simplified for preview purposes)
  vec3 rec2020ToRec709(vec3 c) {
    // Simplified conversion matrix
    return vec3(
      1.6605 * c.r - 0.5876 * c.g - 0.0728 * c.b,
      -0.1246 * c.r + 1.1329 * c.g - 0.0083 * c.b,
      -0.0093 * c.r - 0.0735 * c.g + 1.0828 * c.b
    );
  }

  // DCI-P3 to Rec.709 (basic matrix - simplified for preview purposes)
  vec3 p3ToRec709(vec3 c) {
    // Simplified conversion matrix
    return vec3(
      1.2249 * c.r - 0.2249 * c.g + 0.0000 * c.b,
      -0.0420 * c.r + 1.0420 * c.g + 0.0000 * c.b,
      -0.0193 * c.r - 0.0784 * c.g + 1.0977 * c.b
    );
  }

  void main() {
    vec4 src = texture2D(u_frame, vec2(v_uv.x, 1.0 - v_uv.y));
    vec3 color = src.rgb;
    vec3 linearColor;

    // Convert source to linear first
    if (u_sourceColorSpace == 0) { // srgb
      linearColor = srgbToLinearVec(color);
    } else if (u_sourceColorSpace == 1) { // rec709
      linearColor = vec3(rec709ToLinear(color.r), rec709ToLinear(color.g), rec709ToLinear(color.b));
    } else if (u_sourceColorSpace == 2) { // rec2020
      // First convert Rec.2020 to Rec.709 gamut, then to linear
      vec3 rec709Color = rec2020ToRec709(color);
      linearColor = vec3(rec709ToLinear(rec709Color.r), rec709ToLinear(rec709Color.g), rec709ToLinear(rec709Color.b));
    } else if (u_sourceColorSpace == 3) { // p3
      // First convert P3 to Rec.709 gamut, then to linear
      vec3 rec709Color = p3ToRec709(color);
      linearColor = vec3(rec709ToLinear(rec709Color.r), rec709ToLinear(rec709Color.g), rec709ToLinear(rec709Color.b));
    } else if (u_sourceColorSpace == 4) { // linear
      linearColor = color;
    } else if (u_sourceColorSpace == 5) { // log-c
      linearColor = vec3(logCToLinear(color.r), logCToLinear(color.g), logCToLinear(color.b));
    } else if (u_sourceColorSpace == 6) { // s-log3
      linearColor = vec3(sLog3ToLinear(color.r), sLog3ToLinear(color.g), sLog3ToLinear(color.b));
    } else if (u_sourceColorSpace == 7) { // v-log
      linearColor = vec3(vLogToLinear(color.r), vLogToLinear(color.g), vLogToLinear(color.b));
    } else { // default: srgb
      linearColor = srgbToLinearVec(color);
    }

    // Convert linear to sRGB for display
    vec3 displayColor = linearToSrgbVec(linearColor);
    
    // Clamp to valid range
    displayColor = clamp(displayColor, 0.0, 1.0);
    
    gl_FragColor = vec4(displayColor, src.a);
  }
`;

// ── helpers ───────────────────────────────────────────────────────────────────

function makeCanvas(w: number, h: number): OffscreenCanvas | HTMLCanvasElement {
  if (typeof OffscreenCanvas !== "undefined") return new OffscreenCanvas(w, h);
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  return c;
}

function compile(gl: WebGLRenderingContext, type: number, src: string) {
  const s = gl.createShader(type)!;
  gl.shaderSource(s, src);
  gl.compileShader(s);
  if (!gl.getShaderParameter(s, gl.COMPILE_STATUS))
    throw new Error(gl.getShaderInfoLog(s)!);
  return s;
}

function link(gl: WebGLRenderingContext, vert: string, frag: string) {
  const p = gl.createProgram()!;
  gl.attachShader(p, compile(gl, gl.VERTEX_SHADER, vert));
  gl.attachShader(p, compile(gl, gl.FRAGMENT_SHADER, frag));
  gl.linkProgram(p);
  if (!gl.getProgramParameter(p, gl.LINK_STATUS))
    throw new Error(gl.getProgramInfoLog(p)!);
  return p;
}

function quad(gl: WebGLRenderingContext, prog: WebGLProgram) {
  const buf = gl.createBuffer()!;
  gl.bindBuffer(gl.ARRAY_BUFFER, buf);
  gl.bufferData(
    gl.ARRAY_BUFFER,
    new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]),
    gl.STATIC_DRAW,
  );
  const loc = gl.getAttribLocation(prog, "a_pos");
  gl.enableVertexAttribArray(loc);
  gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
}

function tex2d(gl: WebGLRenderingContext) {
  const t = gl.createTexture()!;
  gl.bindTexture(gl.TEXTURE_2D, t);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
  return t;
}

// ── curve math ────────────────────────────────────────────────────────────────

const DEFAULT_POINTS: CurvePoint[] = [
  [0, 0],
  [0.25, 0.25],
  [0.5, 0.5],
  [0.75, 0.75],
  [1, 1],
];

/** Monotone cubic (Fritsch-Carlson) interpolation through control points. */
function evalCurve(pts: CurvePoint[], x: number): number {
  const sorted = [...pts].sort((a, b) => a[0] - b[0]);
  const n = sorted.length;
  if (n === 0) return x;
  if (x <= sorted[0][0]) return sorted[0][1];
  if (x >= sorted[n - 1][0]) return sorted[n - 1][1];

  // Find segment
  let i = 0;
  while (i < n - 2 && sorted[i + 1][0] < x) i++;

  const [x0, y0] = sorted[i];
  const [x1, y1] = sorted[i + 1];
  const h = x1 - x0;
  if (h < 1e-9) return y0;

  // Compute tangents (Catmull-Rom clamped to monotone)
  const m0 =
    i > 0
      ? 0.5 *
        ((y1 - y0) / h + (y0 - sorted[i - 1][1]) / (x0 - sorted[i - 1][0]))
      : (y1 - y0) / h;
  const m1 =
    i < n - 2
      ? 0.5 *
        ((y1 - y0) / h + (sorted[i + 2][1] - y1) / (sorted[i + 2][0] - x1))
      : (y1 - y0) / h;

  const t = (x - x0) / h;
  const t2 = t * t,
    t3 = t2 * t;
  return (
    (2 * t3 - 3 * t2 + 1) * y0 +
    (t3 - 2 * t2 + t) * h * m0 +
    (-2 * t3 + 3 * t2) * y1 +
    (t3 - t2) * h * m1
  );
}

/** Build a 256-entry Uint8 LUT from control points. */
function buildLutRow(pts: CurvePoint[]): Uint8Array {
  const row = new Uint8Array(256);
  for (let i = 0; i < 256; i++) {
    row[i] = Math.round(
      Math.min(1, Math.max(0, evalCurve(pts, i / 255))) * 255,
    );
  }
  return row;
}

function isIdentityPoints(pts: CurvePoint[]): boolean {
  return pts.every(([x, y]) => Math.abs(x - y) < 0.001);
}

// ── GL state ──────────────────────────────────────────────────────────────────

interface GLState {
  gl: WebGLRenderingContext;
  canvas: OffscreenCanvas | HTMLCanvasElement;
  // curves pass
  curveProg: WebGLProgram;
  curveFrameTex: WebGLTexture;
  curveLutTex: WebGLTexture;
  // secondary pass
  secProg: WebGLProgram;
  secFrameTex: WebGLTexture;
  w: number;
  h: number;
}

// ── hook ──────────────────────────────────────────────────────────────────────

// Add color space mapping
export function mapColorSpaceToEnum(colorSpace: string | undefined): number {
  switch (colorSpace) {
    case "srgb": return 0;
    case "rec709": return 1;
    case "rec2020": return 2;
    case "p3": return 3;
    case "linear": return 4;
    case "log-c": return 5;
    case "s-log3": return 6;
    case "v-log": return 7;
    default: return 0; // default to srgb
  }
}

// Add blend mode mapping
export function mapBlendModeToEnum(blendMode: string | undefined): number {
  switch (blendMode) {
    case "normal": return 0;
    case "screen": return 1;
    case "multiply": return 2;
    case "overlay": return 3;
    case "darken": return 4;
    case "lighten": return 5;
    case "color-dodge": return 6;
    case "color-burn": return 7;
    case "hard-light": return 8;
    case "soft-light": return 9;
    case "difference": return 10;
    case "exclusion": return 11;
    case "hue": return 12;
    case "saturation": return 13;
    case "color": return 14;
    case "luminosity": return 15;
    default: return 0; // default to normal
  }
}

// Blend mode state for WebGL context management
interface GLBlendState {
  gl: WebGLRenderingContext;
  canvas: HTMLCanvasElement;
  w: number;
  h: number;
  prog: WebGLProgram;
}

const blendStateRef: { current: GLBlendState | null } = { current: null };

// Native canvas blend operations supported by the 2D compositor.
const CANVAS_BLEND_OPERATIONS: Record<string, GlobalCompositeOperation> = {
  screen: "screen",
  multiply: "multiply",
  overlay: "overlay",
  darken: "darken",
  lighten: "lighten",
  "color-dodge": "color-dodge",
  "color-burn": "color-burn",
  "hard-light": "hard-light",
  "soft-light": "soft-light",
  difference: "difference",
  exclusion: "exclusion",
  hue: "hue",
  saturation: "saturation",
  color: "color",
  luminosity: "luminosity",
};

function getCanvasBlendOperation(
  blendMode: string | undefined,
): GlobalCompositeOperation | null {
  if (!blendMode) return null;

  const op = CANVAS_BLEND_OPERATIONS[blendMode];
  if (!op) return null;

  const testCanvas = document.createElement("canvas");
  const ctx = testCanvas.getContext("2d");
  if (!ctx) return null;

  const previousOp = ctx.globalCompositeOperation;
  ctx.globalCompositeOperation = op;
  const isSupported = ctx.globalCompositeOperation === op;
  ctx.globalCompositeOperation = previousOp;

  return isSupported ? op : null;
}

// Apply blend mode to composite foreground over background using WebGL
export async function applyBlendWebGL(
  foreground: HTMLCanvasElement | OffscreenCanvas | ImageBitmap,
  background: HTMLCanvasElement | OffscreenCanvas | ImageBitmap,
  blendMode: string | undefined,
): Promise<ImageBitmap | null> {
  const bmEnum = mapBlendModeToEnum(blendMode);
  if (bmEnum === 0) return null; // normal blend mode, no need for WebGL

  const w = foreground.width, h = foreground.height;
  if (background.width !== w || background.height !== h) return null;

  const canvasBlendMode = getCanvasBlendOperation(blendMode);
  if (canvasBlendMode) {
    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;

    const ctx = canvas.getContext("2d", { alpha: true });
    if (ctx) {
      ctx.clearRect(0, 0, w, h);
      ctx.drawImage(background as CanvasImageSource, 0, 0, w, h);
      ctx.globalCompositeOperation = canvasBlendMode;
      ctx.drawImage(foreground as CanvasImageSource, 0, 0, w, h);
      ctx.globalCompositeOperation = "source-over";

      if (typeof createImageBitmap !== "undefined") {
        return createImageBitmap(canvas);
      }
    }
  }

  // (Re)init when size changes
  let s = blendStateRef.current;
  if (!s || s.w !== w || s.h !== h) {
    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    const gl = canvas.getContext("webgl", {
      premultipliedAlpha: false,
    }) as WebGLRenderingContext | null;
    if (!gl) return null;

    const prog = link(gl, VERT, FRAG_BLEND);
    gl.useProgram(prog);
    quad(gl, prog);

    s = {
      gl,
      canvas,
      w,
      h,
      prog,
    };
    blendStateRef.current = s;
  }

  const { gl, canvas, prog } = s;
  gl.viewport(0, 0, w, h);

  // Create textures for foreground and background
  const fgTex = tex2d(gl);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, foreground as TexImageSource);
  gl.activeTexture(gl.TEXTURE0);
  gl.bindTexture(gl.TEXTURE_2D, fgTex);
  gl.uniform1i(gl.getUniformLocation(prog, "u_foreground"), 0);

  const bgTex = tex2d(gl);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, background as TexImageSource);
  gl.activeTexture(gl.TEXTURE1);
  gl.bindTexture(gl.TEXTURE_2D, bgTex);
  gl.uniform1i(gl.getUniformLocation(prog, "u_background"), 1);

  // Set blend mode uniform
  gl.uniform1i(gl.getUniformLocation(prog, "u_blendMode"), bmEnum);

  // Draw
  gl.drawArrays(gl.TRIANGLES, 0, 6);

  // Return result as ImageBitmap
  return createImageBitmap(canvas);
}

interface GLColorSpaceState {
  gl: WebGLRenderingContext;
  canvas: OffscreenCanvas | HTMLCanvasElement;
  csProg: WebGLProgram;
  csFrameTex: WebGLTexture;
  w: number;
  h: number;
}

export function useColorGradeGL() {
  const stateRef = useRef<GLState | null>(null);
  const csStateRef = useRef<GLColorSpaceState | null>(null);

  // Add new function to apply color space conversion
  const applyColorSpace = useCallback(
    async (
      source: HTMLCanvasElement | OffscreenCanvas,
      sourceColorSpace: string | undefined,
    ): Promise<ImageBitmap | OffscreenCanvas | HTMLCanvasElement | null> => {
      const csEnum = mapColorSpaceToEnum(sourceColorSpace);
      if (csEnum === 0) return null; // already sRGB, no conversion needed

      const w = source.width, h = source.height;

      // (Re)init when size changes
      let s = csStateRef.current;
      if (!s || s.w !== w || s.h !== h) {
        const canvas = makeCanvas(w, h);
        const gl = canvas.getContext("webgl", {
          premultipliedAlpha: false,
        }) as WebGLRenderingContext | null;
        if (!gl) return null;

        const csProg = link(gl, VERT, FRAG_COLORSPACE);
        gl.useProgram(csProg);
        quad(gl, csProg);
        const csFrameTex = tex2d(gl);

        s = {
          gl,
          canvas,
          csProg,
          csFrameTex,
          w,
          h,
        };
        csStateRef.current = s;
      }

      const { gl } = s;
      gl.viewport(0, 0, w, h);

      // Apply color space conversion pass
      gl.useProgram(s.csProg);
      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D, s.csFrameTex);
      try {
        gl.texImage2D(
          gl.TEXTURE_2D,
          0,
          gl.RGBA,
          gl.RGBA,
          gl.UNSIGNED_BYTE,
          source as TexImageSource,
        );
      } catch {
        return null;
      }

      gl.uniform1i(gl.getUniformLocation(s.csProg, "u_frame"), 0);
      gl.uniform1i(gl.getUniformLocation(s.csProg, "u_sourceColorSpace"), csEnum);
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
      gl.flush();

      if (typeof createImageBitmap !== "undefined") {
        return createImageBitmap(s.canvas as ImageBitmapSource);
      }
      return s.canvas;
    },
    [],
  );

  const apply = useCallback(
    async (
      source: HTMLCanvasElement | OffscreenCanvas,
      grade: ColorGradeSettings,
    ): Promise<ImageBitmap | OffscreenCanvas | HTMLCanvasElement | null> => {
      const { curves, secondary } = grade;
      const hasCurves =
        curves &&
        (!isIdentityPoints(curves.luma) ||
          !isIdentityPoints(curves.r) ||
          !isIdentityPoints(curves.g) ||
          !isIdentityPoints(curves.b));
      const hasSec = secondary?.enabled;

      if (!hasCurves && !hasSec) return null; // nothing to do

      const w = source.width,
        h = source.height;

      // (Re)init when size changes
      let s = stateRef.current;
      if (!s || s.w !== w || s.h !== h) {
        const canvas = makeCanvas(w, h);
        const gl = canvas.getContext("webgl", {
          premultipliedAlpha: false,
        }) as WebGLRenderingContext | null;
        if (!gl) return null;

        const curveProg = link(gl, VERT, FRAG_CURVES);
        gl.useProgram(curveProg);
        quad(gl, curveProg);
        const curveFrameTex = tex2d(gl);
        const curveLutTex = tex2d(gl);

        const secProg = link(gl, VERT, FRAG_SECONDARY);
        gl.useProgram(secProg);
        quad(gl, secProg);
        const secFrameTex = tex2d(gl);

        s = {
          gl,
          canvas,
          curveProg,
          curveFrameTex,
          curveLutTex,
          secProg,
          secFrameTex,
          w,
          h,
        };
        stateRef.current = s;
      }

      const { gl } = s;
      gl.viewport(0, 0, w, h);

      let currentSource: HTMLCanvasElement | OffscreenCanvas | ImageBitmap =
        source;

      // ── Pass 1: curves ────────────────────────────────────────────────────────
      if (hasCurves) {
        gl.useProgram(s.curveProg);

        // Upload frame
        gl.activeTexture(gl.TEXTURE0);
        gl.bindTexture(gl.TEXTURE_2D, s.curveFrameTex);
        try {
          gl.texImage2D(
            gl.TEXTURE_2D,
            0,
            gl.RGBA,
            gl.RGBA,
            gl.UNSIGNED_BYTE,
            currentSource as TexImageSource,
          );
        } catch {
          return null;
        }

        // Build 256×4 LUT texture (rows: R, G, B, Luma)
        const lutData = new Uint8Array(256 * 4 * 4);
        const rows = [
          buildLutRow(curves!.r ?? DEFAULT_POINTS),
          buildLutRow(curves!.g ?? DEFAULT_POINTS),
          buildLutRow(curves!.b ?? DEFAULT_POINTS),
          buildLutRow(curves!.luma ?? DEFAULT_POINTS),
        ];
        for (let row = 0; row < 4; row++) {
          for (let i = 0; i < 256; i++) {
            const base = (row * 256 + i) * 4;
            lutData[base] =
              lutData[base + 1] =
              lutData[base + 2] =
                rows[row][i];
            lutData[base + 3] = 255;
          }
        }
        gl.activeTexture(gl.TEXTURE1);
        gl.bindTexture(gl.TEXTURE_2D, s.curveLutTex);
        gl.texImage2D(
          gl.TEXTURE_2D,
          0,
          gl.RGBA,
          256,
          4,
          0,
          gl.RGBA,
          gl.UNSIGNED_BYTE,
          lutData,
        );

        gl.uniform1i(gl.getUniformLocation(s.curveProg, "u_frame"), 0);
        gl.uniform1i(gl.getUniformLocation(s.curveProg, "u_curves"), 1);
        gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
        gl.flush();

        if (hasSec) {
          // Read back for secondary pass
          currentSource =
            typeof createImageBitmap !== "undefined"
              ? await createImageBitmap(s.canvas as ImageBitmapSource)
              : s.canvas;
        }
      }

      // ── Pass 2: secondary correction ─────────────────────────────────────────
      if (hasSec) {
        gl.useProgram(s.secProg);

        gl.activeTexture(gl.TEXTURE0);
        gl.bindTexture(gl.TEXTURE_2D, s.secFrameTex);
        try {
          gl.texImage2D(
            gl.TEXTURE_2D,
            0,
            gl.RGBA,
            gl.RGBA,
            gl.UNSIGNED_BYTE,
            currentSource as TexImageSource,
          );
        } catch {
          return null;
        } finally {
          if (currentSource instanceof ImageBitmap) currentSource.close();
        }

        const q = secondary!.qualifier;
        const u = (name: string) => gl.getUniformLocation(s!.secProg, name);
        gl.uniform1i(u("u_frame"), 0);
        gl.uniform1f(u("u_hueCenter"), q.hueCenter / 360);
        gl.uniform1f(u("u_hueWidth"), q.hueWidth / 360);
        gl.uniform1f(u("u_satMin"), q.satMin);
        gl.uniform1f(u("u_satMax"), q.satMax);
        gl.uniform1f(u("u_lumMin"), q.lumMin);
        gl.uniform1f(u("u_lumMax"), q.lumMax);
        gl.uniform1f(u("u_adjHue"), secondary!.hue / 360);
        gl.uniform1f(u("u_adjSat"), secondary!.saturation);
        gl.uniform1f(u("u_adjBri"), secondary!.brightness);
        gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
        gl.flush();
      }

      if (typeof createImageBitmap !== "undefined") {
        return createImageBitmap(s.canvas as ImageBitmapSource);
      }
      return s.canvas;
    },
    [],
  );

  return { apply, applyColorSpace };
}