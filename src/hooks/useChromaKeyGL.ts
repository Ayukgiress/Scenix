/**
 * WebGL chroma-key processor.
 *
 * The fragment shader converts each pixel to HSV, computes the angular
 * distance between the pixel hue and the key hue, then derives an alpha
 * mask using tolerance (hard cut) and smoothing (soft edge).
 *
 * Usage:
 *   const ck = useChromaKeyGL()
 *   // inside draw loop:
 *   const bmp = ck.processFrame(videoEl, { color, tolerance, smoothing })
 *   ctx.drawImage(bmp, dx, dy, dw, dh)
 *   bmp.close()
 */

import { useRef, useCallback } from "react"

// ── GLSL ─────────────────────────────────────────────────────────────────────

const VERT_SRC = /* glsl */ `
  attribute vec2 a_pos;
  varying vec2 v_uv;
  void main() {
    v_uv = a_pos * 0.5 + 0.5;
    gl_Position = vec4(a_pos, 0.0, 1.0);
  }
`

const FRAG_SRC = /* glsl */ `
  precision mediump float;
  uniform sampler2D u_tex;
  uniform vec3      u_key;       // key colour in linear RGB [0,1]
  uniform float     u_tolerance; // hard-cut radius in hue-distance [0,1]
  uniform float     u_smoothing; // soft-edge width beyond tolerance [0,1]
  varying vec2 v_uv;

  // RGB → HSV (returns vec3(h,s,v), h in [0,1])
  vec3 rgb2hsv(vec3 c) {
    vec4 K = vec4(0.0, -1.0/3.0, 2.0/3.0, -1.0);
    vec4 p = mix(vec4(c.bg, K.wz), vec4(c.gb, K.xy), step(c.b, c.g));
    vec4 q = mix(vec4(p.xyw, c.r), vec4(c.r, p.yzx), step(p.x, c.r));
    float d = q.x - min(q.w, q.y);
    float e = 1.0e-10;
    return vec3(abs(q.z + (q.w - q.y) / (6.0 * d + e)), d / (q.x + e), q.x);
  }

  void main() {
    vec4 src    = texture2D(u_tex, vec2(v_uv.x, 1.0 - v_uv.y));
    vec3 keyHSV = rgb2hsv(u_key);
    vec3 srcHSV = rgb2hsv(src.rgb);

    // Angular hue distance [0, 0.5]
    float hueDist = abs(srcHSV.x - keyHSV.x);
    hueDist = min(hueDist, 1.0 - hueDist);

    // Weight by saturation so near-grey pixels are never keyed
    float dist = hueDist + (1.0 - srcHSV.y) * 0.5;

    float alpha = smoothstep(u_tolerance, u_tolerance + max(u_smoothing, 0.001), dist);
    gl_FragColor = vec4(src.rgb * alpha, src.a * alpha);
  }
`

// ── types ─────────────────────────────────────────────────────────────────────

export interface ChromaKeyParams {
  color: string     // hex e.g. "#00ff00"
  tolerance: number // 0–1
  smoothing: number // 0–1
}

interface GLState {
  gl:        WebGLRenderingContext
  program:   WebGLProgram
  uTex:      WebGLUniformLocation
  uKey:      WebGLUniformLocation
  uTol:      WebGLUniformLocation
  uSmooth:   WebGLUniformLocation
  tex:       WebGLTexture
  canvas:    OffscreenCanvas | HTMLCanvasElement
}

// ── helpers ───────────────────────────────────────────────────────────────────

function hexToRGB01(hex: string): [number, number, number] {
  const r = parseInt(hex.slice(1, 3), 16) / 255
  const g = parseInt(hex.slice(3, 5), 16) / 255
  const b = parseInt(hex.slice(5, 7), 16) / 255
  return [r, g, b]
}

function compileShader(gl: WebGLRenderingContext, type: number, src: string): WebGLShader {
  const s = gl.createShader(type)!
  gl.shaderSource(s, src)
  gl.compileShader(s)
  if (!gl.getShaderParameter(s, gl.COMPILE_STATUS))
    throw new Error(gl.getShaderInfoLog(s) ?? "shader compile error")
  return s
}

function buildProgram(gl: WebGLRenderingContext): WebGLProgram {
  const prog = gl.createProgram()!
  gl.attachShader(prog, compileShader(gl, gl.VERTEX_SHADER,   VERT_SRC))
  gl.attachShader(prog, compileShader(gl, gl.FRAGMENT_SHADER, FRAG_SRC))
  gl.linkProgram(prog)
  if (!gl.getProgramParameter(prog, gl.LINK_STATUS))
    throw new Error(gl.getProgramInfoLog(prog) ?? "program link error")
  return prog
}

function initGL(w: number, h: number): GLState | null {
  let canvas: OffscreenCanvas | HTMLCanvasElement
  if (typeof OffscreenCanvas !== "undefined") {
    canvas = new OffscreenCanvas(w, h)
  } else {
    canvas = document.createElement("canvas")
    canvas.width = w; canvas.height = h
  }

  const gl = canvas.getContext("webgl", { premultipliedAlpha: false }) as WebGLRenderingContext | null
  if (!gl) return null

  const program = buildProgram(gl)
  gl.useProgram(program)

  // Full-screen quad
  const buf = gl.createBuffer()!
  gl.bindBuffer(gl.ARRAY_BUFFER, buf)
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1,-1, 1,-1, -1,1, 1,1]), gl.STATIC_DRAW)
  const aPos = gl.getAttribLocation(program, "a_pos")
  gl.enableVertexAttribArray(aPos)
  gl.vertexAttribPointer(aPos, 2, gl.FLOAT, false, 0, 0)

  // Texture
  const tex = gl.createTexture()!
  gl.bindTexture(gl.TEXTURE_2D, tex)
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE)
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE)
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR)
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR)

  return {
    gl, program, tex, canvas,
    uTex:    gl.getUniformLocation(program, "u_tex")!,
    uKey:    gl.getUniformLocation(program, "u_key")!,
    uTol:    gl.getUniformLocation(program, "u_tolerance")!,
    uSmooth: gl.getUniformLocation(program, "u_smoothing")!,
  }
}

// ── hook ──────────────────────────────────────────────────────────────────────

export function useChromaKeyGL() {
  const stateRef = useRef<GLState | null>(null)

  /**
   * Render `source` through the chroma-key shader and return an ImageBitmap
   * (or the OffscreenCanvas itself when createImageBitmap is unavailable).
   * Caller is responsible for calling .close() on the returned ImageBitmap.
   */
  const processFrame = useCallback(
    async (
      source: HTMLVideoElement | HTMLImageElement | ImageBitmap,
      w: number,
      h: number,
      params: ChromaKeyParams,
    ): Promise<ImageBitmap | OffscreenCanvas | HTMLCanvasElement | null> => {
      // (Re-)initialise GL context when size changes
      const cur = stateRef.current
      if (!cur || (cur.canvas as OffscreenCanvas).width !== w || (cur.canvas as OffscreenCanvas).height !== h) {
        stateRef.current = initGL(w, h)
      }
      const s = stateRef.current
      if (!s) return null

      const { gl, tex, uKey, uTol, uSmooth } = s

      // Resize viewport if needed
      gl.viewport(0, 0, w, h)

      // Upload source frame as texture
      gl.bindTexture(gl.TEXTURE_2D, tex)
      try {
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, source as TexImageSource)
      } catch {
        return null
      }

      // Set uniforms
      const [r, g, b] = hexToRGB01(params.color)
      gl.uniform3f(uKey, r, g, b)
      gl.uniform1f(uTol,    params.tolerance * 0.5) // map [0,1] → [0,0.5] hue-dist space
      gl.uniform1f(uSmooth, params.smoothing  * 0.3)
      gl.uniform1i(s.uTex, 0)

      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4)
      gl.flush()

      if (typeof createImageBitmap !== "undefined") {
        return createImageBitmap(s.canvas as ImageBitmapSource)
      }
      return s.canvas
    },
    [],
  )

  return { processFrame }
}
