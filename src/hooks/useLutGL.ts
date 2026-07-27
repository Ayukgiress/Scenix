/**
 * WebGL LUT processor.
 *
 * For 3D LUTs: uploads the table as a WebGL 3D texture (OES_texture_3D or
 * WebGL2) and samples it with trilinear interpolation in the fragment shader.
 *
 * For 1D LUTs: uploads as a 1×size RGBA texture and applies per-channel
 * lookup in the fragment shader.
 *
 * Usage:
 *   const lut = useLutGL()
 *   const bmp = await lut.applyLut(sourceCanvas, lutData, intensity)
 *   ctx.drawImage(bmp, 0, 0)
 *   bmp?.close?.()
 */

import { useRef, useCallback } from "react"
import type { LutData } from "@/lib/parseCube"

// ── GLSL ─────────────────────────────────────────────────────────────────────

const VERT = /* glsl */ `
  attribute vec2 a_pos;
  varying vec2 v_uv;
  void main() {
    v_uv = a_pos * 0.5 + 0.5;
    gl_Position = vec4(a_pos, 0.0, 1.0);
  }
`

// 3D LUT fragment — uses a 3D texture sampled at the pixel's RGB coordinate.
// Intensity blends between the original colour and the LUT output.
const FRAG_3D = /* glsl */ `
  precision mediump float;
  uniform sampler2D u_frame;
  uniform mediump sampler3D u_lut3d;
  uniform float u_size;
  uniform float u_intensity;
  varying vec2 v_uv;

  void main() {
    vec4 src = texture2D(u_frame, vec2(v_uv.x, 1.0 - v_uv.y));
    // Scale input into the LUT's valid range (half-texel inset)
    float scale = (u_size - 1.0) / u_size;
    float offset = 0.5 / u_size;
    vec3 lutCoord = src.rgb * scale + offset;
    vec3 graded = texture3D(u_lut3d, lutCoord).rgb;
    gl_FragColor = vec4(mix(src.rgb, graded, u_intensity), src.a);
  }
`

// 1D LUT fragment — each channel is looked up independently in a 1D strip.
const FRAG_1D = /* glsl */ `
  precision mediump float;
  uniform sampler2D u_frame;
  uniform sampler2D u_lut1d;
  uniform float u_size;
  uniform float u_intensity;
  varying vec2 v_uv;

  float lookup1d(float v, float ch) {
    float x = (v * (u_size - 1.0) + 0.5) / u_size;
    return texture2D(u_lut1d, vec2(x, (ch + 0.5) / 3.0)).r;
  }

  void main() {
    vec4 src = texture2D(u_frame, vec2(v_uv.x, 1.0 - v_uv.y));
    vec3 graded = vec3(
      lookup1d(src.r, 0.0),
      lookup1d(src.g, 1.0),
      lookup1d(src.b, 2.0)
    );
    gl_FragColor = vec4(mix(src.rgb, graded, u_intensity), src.a);
  }
`

// ── types ─────────────────────────────────────────────────────────────────────

interface GL2State {
  kind: "3d"
  gl: WebGL2RenderingContext
  program: WebGLProgram
  frameTex: WebGLTexture
  lutTex: WebGLTexture
  uFrame: WebGLUniformLocation
  uLut: WebGLUniformLocation
  uSize: WebGLUniformLocation
  uIntensity: WebGLUniformLocation
  canvas: OffscreenCanvas | HTMLCanvasElement
  loadedLutId: string
}

interface GL1State {
  kind: "1d"
  gl: WebGLRenderingContext
  program: WebGLProgram
  frameTex: WebGLTexture
  lutTex: WebGLTexture
  uFrame: WebGLUniformLocation
  uLut: WebGLUniformLocation
  uSize: WebGLUniformLocation
  uIntensity: WebGLUniformLocation
  canvas: OffscreenCanvas | HTMLCanvasElement
  loadedLutId: string
}

type GLState = GL2State | GL1State

// ── helpers ───────────────────────────────────────────────────────────────────

function makeCanvas(w: number, h: number): OffscreenCanvas | HTMLCanvasElement {
  if (typeof OffscreenCanvas !== "undefined") return new OffscreenCanvas(w, h)
  const c = document.createElement("canvas")
  c.width = w; c.height = h
  return c
}

function compileShader(gl: WebGLRenderingContext | WebGL2RenderingContext, type: number, src: string) {
  const s = gl.createShader(type)!
  gl.shaderSource(s, src)
  gl.compileShader(s)
  if (!gl.getShaderParameter(s, gl.COMPILE_STATUS))
    throw new Error(gl.getShaderInfoLog(s) ?? "shader error")
  return s
}

function buildProgram(gl: WebGLRenderingContext | WebGL2RenderingContext, vert: string, frag: string) {
  const p = gl.createProgram()!
  gl.attachShader(p, compileShader(gl, gl.VERTEX_SHADER, vert))
  gl.attachShader(p, compileShader(gl, gl.FRAGMENT_SHADER, frag))
  gl.linkProgram(p)
  if (!gl.getProgramParameter(p, gl.LINK_STATUS))
    throw new Error(gl.getProgramInfoLog(p) ?? "link error")
  return p
}

function setupQuad(gl: WebGLRenderingContext | WebGL2RenderingContext, program: WebGLProgram) {
  const buf = gl.createBuffer()!
  gl.bindBuffer(gl.ARRAY_BUFFER, buf)
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1,-1, 1,-1, -1,1, 1,1]), gl.STATIC_DRAW)
  const loc = gl.getAttribLocation(program, "a_pos")
  gl.enableVertexAttribArray(loc)
  gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0)
}

function makeTexture(gl: WebGLRenderingContext | WebGL2RenderingContext, target: number) {
  const t = gl.createTexture()!
  gl.bindTexture(target, t)
  gl.texParameteri(target, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE)
  gl.texParameteri(target, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE)
  gl.texParameteri(target, gl.TEXTURE_MIN_FILTER, gl.LINEAR)
  gl.texParameteri(target, gl.TEXTURE_MAG_FILTER, gl.LINEAR)
  return t
}

// ── init helpers ──────────────────────────────────────────────────────────────

function init3D(w: number, h: number): GL2State | null {
  const canvas = makeCanvas(w, h)
  const gl = canvas.getContext("webgl2", { premultipliedAlpha: false }) as WebGL2RenderingContext | null
  if (!gl) return null
  const program = buildProgram(gl, VERT, FRAG_3D)
  gl.useProgram(program)
  setupQuad(gl, program)
  const frameTex = makeTexture(gl, gl.TEXTURE_2D)
  const lutTex = makeTexture(gl, gl.TEXTURE_3D)
  gl.texParameteri(gl.TEXTURE_3D, gl.TEXTURE_WRAP_R, gl.CLAMP_TO_EDGE)
  return {
    kind: "3d", gl, program, canvas, frameTex, lutTex, loadedLutId: "",
    uFrame:     gl.getUniformLocation(program, "u_frame")!,
    uLut:       gl.getUniformLocation(program, "u_lut3d")!,
    uSize:      gl.getUniformLocation(program, "u_size")!,
    uIntensity: gl.getUniformLocation(program, "u_intensity")!,
  }
}

function init1D(w: number, h: number): GL1State | null {
  const canvas = makeCanvas(w, h)
  const gl = canvas.getContext("webgl", { premultipliedAlpha: false }) as WebGLRenderingContext | null
  if (!gl) return null
  const program = buildProgram(gl, VERT, FRAG_1D)
  gl.useProgram(program)
  setupQuad(gl, program)
  const frameTex = makeTexture(gl, gl.TEXTURE_2D)
  const lutTex   = makeTexture(gl, gl.TEXTURE_2D)
  return {
    kind: "1d", gl, program, canvas, frameTex, lutTex, loadedLutId: "",
    uFrame:     gl.getUniformLocation(program, "u_frame")!,
    uLut:       gl.getUniformLocation(program, "u_lut1d")!,
    uSize:      gl.getUniformLocation(program, "u_size")!,
    uIntensity: gl.getUniformLocation(program, "u_intensity")!,
  }
}

// ── hook ──────────────────────────────────────────────────────────────────────

export function useLutGL() {
  const stateRef = useRef<GLState | null>(null)

  const applyLut = useCallback(async (
    source: HTMLCanvasElement | OffscreenCanvas,
    lut: LutData,
    intensity: number,
  ): Promise<ImageBitmap | OffscreenCanvas | HTMLCanvasElement | null> => {
    const w = source.width
    const h = source.height
    const lutId = `${lut.kind}-${lut.size}-${lut.table.length}`

    // (Re)init when kind changes or canvas size changes
    const cur = stateRef.current
    const needsReinit =
      !cur ||
      (cur.canvas as OffscreenCanvas).width  !== w ||
      (cur.canvas as OffscreenCanvas).height !== h ||
      (lut.kind === "3D" && cur.kind !== "3d") ||
      (lut.kind === "1D" && cur.kind !== "1d")

    if (needsReinit) {
      stateRef.current = lut.kind === "3D" ? init3D(w, h) : init1D(w, h)
    }

    const s = stateRef.current
    if (!s) return null

    const { gl } = s

    // Resize viewport
    gl.viewport(0, 0, w, h)

    // Upload frame texture (unit 0)
    gl.activeTexture(gl.TEXTURE0)
    gl.bindTexture(gl.TEXTURE_2D, s.frameTex)
    try {
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, source as TexImageSource)
    } catch { return null }

    // Upload LUT texture (unit 1) — only when LUT changes
    gl.activeTexture(gl.TEXTURE1)
    if (s.loadedLutId !== lutId) {
      if (s.kind === "3d") {
        const gl2 = s.gl
        gl2.bindTexture(gl2.TEXTURE_3D, s.lutTex)
        // Convert Float32 [0,1] table to Uint8 for upload
        const bytes = new Uint8Array(lut.table.length)
        for (let i = 0; i < lut.table.length; i++) bytes[i] = Math.round(Math.min(1, Math.max(0, lut.table[i])) * 255)
        gl2.texImage3D(gl2.TEXTURE_3D, 0, gl2.RGB, lut.size, lut.size, lut.size, 0, gl2.RGB, gl2.UNSIGNED_BYTE, bytes)
      } else {
        // 1D: pack as 3-row × size-column RGBA texture (R=red channel, G=green, B=blue)
        const gl1 = s.gl
        gl1.bindTexture(gl1.TEXTURE_2D, s.lutTex)
        const bytes = new Uint8Array(lut.size * 3 * 4)
        for (let ch = 0; ch < 3; ch++) {
          for (let i = 0; i < lut.size; i++) {
            const v = Math.round(Math.min(1, Math.max(0, lut.table[i * 3 + ch])) * 255)
            const idx = (ch * lut.size + i) * 4
            bytes[idx] = v; bytes[idx+1] = v; bytes[idx+2] = v; bytes[idx+3] = 255
          }
        }
        gl1.texImage2D(gl1.TEXTURE_2D, 0, gl1.RGBA, lut.size, 3, 0, gl1.RGBA, gl1.UNSIGNED_BYTE, bytes)
      }
      s.loadedLutId = lutId
    } else {
      if (s.kind === "3d") s.gl.bindTexture(s.gl.TEXTURE_3D, s.lutTex)
      else s.gl.bindTexture(s.gl.TEXTURE_2D, s.lutTex)
    }

    // Set uniforms
    gl.uniform1i(s.uFrame, 0)
    gl.uniform1i(s.uLut, 1)
    gl.uniform1f(s.uSize, lut.size)
    gl.uniform1f(s.uIntensity, Math.max(0, Math.min(1, intensity)))

    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4)
    gl.flush()

    if (typeof createImageBitmap !== "undefined") {
      return createImageBitmap(s.canvas as ImageBitmapSource)
    }
    return s.canvas
  }, [])

  return { applyLut }
}
