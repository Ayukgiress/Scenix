import { useEffect, useRef, useCallback } from "react";
import type { RefObject } from "react";
import { useEditorStore, type LocalClip } from "@/store/editorStore";
import { interpolateKeyframes } from "@/lib/keyframes";
import { colorGradeToFilter } from "@/components/editor/ColorGradePanel";
import { useChromaKeyGL } from "@/hooks/useChromaKeyGL";
import { useLutGL } from "@/hooks/useLutGL";
import { useColorGradeGL } from "@/hooks/useColorGradeGL";
import { parseCube } from "@/lib/parseCube";
import type { LutData } from "@/lib/parseCube";

// ─── helpers ─────────────────────────────────────────────────────────────────

function isVisual(c: LocalClip) {
  return c.type === "video" || c.type === "image";
}

function transitionWindow(c: LocalClip): number {
  if (!c.transition || c.transition.type === "none") return 0.05;
  return Math.max(0.05, c.transition.duration ?? 0);
}

function isActive(c: LocalClip, t: number) {
  const tw = transitionWindow(c);
  return t >= c.startTime - tw && t < c.startTime + c.duration + tw;
}

function clipTime(c: LocalClip, t: number) {
  return Math.max(0, t - c.startTime + (c.trimStart ?? 0));
}

function buildFilter(c: LocalClip): string {
  const meta = (c.metadata?.filter as string) ?? "";
  const grade = c.colorGrade ? colorGradeToFilter(c.colorGrade) : "";
  return [meta, grade].filter(Boolean).join(" ") || "none";
}

function resolveOpacity(c: LocalClip, t: number): number {
  if (c.keyframes?.length) {
    return interpolateKeyframes(
      c.keyframes,
      "opacity",
      t - c.startTime,
      c.opacity ?? 1,
    );
  }
  return c.opacity ?? 1;
}

function resolveMaskValue(
  clip: LocalClip,
  t: number,
  property: string,
  defaultValue: number,
): number {
  if (!clip.keyframes?.length) return defaultValue;
  return interpolateKeyframes(
    clip.keyframes,
    property,
    t - clip.startTime,
    defaultValue,
  );
}

function applyClipMaskPath(
  ctx: CanvasRenderingContext2D,
  clip: LocalClip,
  dx: number,
  dy: number,
  dw: number,
  dh: number,
  t: number,
) {
  const mask = clip.mask;
  if (!mask?.enabled) return;

  const maskX = resolveMaskValue(clip, t, "maskX", mask.x ?? 0);
  const maskY = resolveMaskValue(clip, t, "maskY", mask.y ?? 0);
  const maskScale = resolveMaskValue(clip, t, "maskScale", mask.scale ?? 1);
  const maskRotation = resolveMaskValue(
    clip,
    t,
    "maskRotation",
    mask.rotation ?? 0,
  );

  const maskCenterX = dx + dw * (0.5 + maskX);
  const maskCenterY = dy + dh * (0.5 + maskY);
  const maskRotationRad = (maskRotation * Math.PI) / 180;

  ctx.translate(maskCenterX, maskCenterY);
  ctx.rotate(maskRotationRad);
  ctx.scale(maskScale, maskScale);
  ctx.translate(-maskCenterX, -maskCenterY);

  ctx.beginPath();

  if (mask.shape === "circle") {
    const radius = Math.min(dw, dh) * (mask.radius ?? 0.5);
    ctx.arc(maskCenterX, maskCenterY, radius, 0, Math.PI * 2);
  } else if (mask.shape === "freeform") {
    const points = mask.points ?? [];
    if (points.length > 0) {
      for (let i = 0; i < points.length; i += 1) {
        const p = points[i];
        const px = dx + (p.x + maskX) * dw;
        const py = dy + (p.y + maskY) * dh;
        if (i === 0) {
          ctx.moveTo(px, py);
        } else {
          const prev = points[i - 1];
          if (
            prev.cp2x != null &&
            prev.cp2y != null &&
            p.cp1x != null &&
            p.cp1y != null
          ) {
            ctx.bezierCurveTo(
              dx + (prev.cp2x + maskX) * dw,
              dy + (prev.cp2y + maskY) * dh,
              dx + (p.cp1x + maskX) * dw,
              dy + (p.cp1y + maskY) * dh,
              px,
              py,
            );
          } else {
            ctx.lineTo(px, py);
          }
        }
      }
      ctx.closePath();
    } else {
      ctx.rect(dx, dy, dw, dh);
    }
  } else {
    const rectW = dw * (mask.width ?? 1);
    const rectH = dh * (mask.height ?? 1);
    const rectX = maskCenterX - rectW / 2;
    const rectY = maskCenterY - rectH / 2;
    ctx.rect(rectX, rectY, rectW, rectH);
  }

  ctx.clip();
}

interface TransitionState {
  alpha: number;
  clipRect: { x: number; y: number; w: number; h: number } | null;
  tx: number;
  ty: number;
  scale: number;
}

const IDENTITY_TRANSITION: TransitionState = {
  alpha: 1,
  clipRect: null,
  tx: 0,
  ty: 0,
  scale: 1,
};

function easeInOut(p: number): number {
  return p < 0.5 ? 2 * p * p : -1 + (4 - 2 * p) * p;
}

function resolveTransition(
  c: LocalClip,
  t: number,
  dx: number,
  dy: number,
  dw: number,
  dh: number,
): TransitionState {
  const tr = c.transition;
  if (!tr || tr.type === "none") return IDENTITY_TRANSITION;

  const dur = Math.max(0.01, tr.duration);

  // p = 0→1 for "in", 1→0 for "out" (how far through the transition we are)
  let p = 1;
  const inProgress = (t - c.startTime) / dur;
  const outProgress = (c.startTime + c.duration - t) / dur;

  const isIn = tr.position === "in" || tr.position === "both";
  const isOut = tr.position === "out" || tr.position === "both";

  if (isIn && inProgress < 1) p = Math.max(0, Math.min(1, inProgress));
  if (isOut && outProgress < 1) p = Math.max(0, Math.min(1, outProgress));

  if (p >= 1) return IDENTITY_TRANSITION;

  const ep = easeInOut(p); // eased progress

  switch (tr.type) {
    case "fade":
    case "dissolve":
      return { alpha: ep, clipRect: null, tx: 0, ty: 0, scale: 1 };

    case "wipe-right":
      // Reveal left→right: clip rect grows from x=dx to x=dx+dw
      return {
        alpha: 1,
        clipRect: { x: dx, y: dy, w: dw * ep, h: dh },
        tx: 0,
        ty: 0,
        scale: 1,
      };

    case "wipe-left":
      // Reveal right→left: clip rect grows from x=dx+dw back to x=dx
      return {
        alpha: 1,
        clipRect: { x: dx + dw * (1 - ep), y: dy, w: dw * ep, h: dh },
        tx: 0,
        ty: 0,
        scale: 1,
      };

    case "slide-right":
      // Incoming slides in from the left
      return { alpha: 1, clipRect: null, tx: -dw * (1 - ep), ty: 0, scale: 1 };

    case "slide-left":
      // Incoming slides in from the right
      return { alpha: 1, clipRect: null, tx: dw * (1 - ep), ty: 0, scale: 1 };

    case "zoom-in":
      // Incoming scales up from 0 to 1
      return {
        alpha: ep,
        clipRect: null,
        tx: 0,
        ty: 0,
        scale: Math.max(0.001, ep),
      };

    case "zoom-out":
      // Incoming scales down from 2× to 1×
      return { alpha: ep, clipRect: null, tx: 0, ty: 0, scale: 1 + (1 - ep) };

    default:
      return IDENTITY_TRANSITION;
  }
}

// ─── element pool ─────────────────────────────────────────────────────────────

type PoolEntry =
  | { kind: "video"; el: HTMLVideoElement; loadedUrl: string }
  | { kind: "image"; el: HTMLImageElement; loadedUrl: string };

// ─── offscreen canvas pool ────────────────────────────────────────────────────
// One reusable offscreen canvas per clip — resized as needed.
// Used to render a clip in isolation (filter applied to source only) before
// alpha-compositing the result onto the main canvas.  This prevents filter
// bleed and ensures globalAlpha multiplies the already-filtered pixels rather
// than the raw source pixels.

type OffscreenEntry = {
  canvas: OffscreenCanvas | HTMLCanvasElement;
  w: number;
  h: number;
};

function getOffscreen(
  pool: Map<string, OffscreenEntry>,
  id: string,
  w: number,
  h: number,
): {
  canvas: OffscreenCanvas | HTMLCanvasElement;
  ctx: OffscreenCanvasRenderingContext2D | CanvasRenderingContext2D;
} | null {
  let entry = pool.get(id);
  if (!entry || entry.w !== w || entry.h !== h) {
    let canvas: OffscreenCanvas | HTMLCanvasElement;
    if (typeof OffscreenCanvas !== "undefined") {
      canvas = new OffscreenCanvas(w, h);
    } else {
      canvas = document.createElement("canvas");
      canvas.width = w;
      canvas.height = h;
    }
    entry = { canvas, w, h };
    pool.set(id, entry);
  }
  const ctx = entry.canvas.getContext("2d") as
    | OffscreenCanvasRenderingContext2D
    | CanvasRenderingContext2D
    | null;
  if (!ctx) return null;
  return { canvas: entry.canvas, ctx };
}

// ─── types ────────────────────────────────────────────────────────────────────

export interface CompositorOptions {
  muted: boolean;
  volume: number;
  onFrameDrawn?: () => void;
}

export interface CompositorResult {
  videoError: string | null;
}

// ─── hook ─────────────────────────────────────────────────────────────────────

export function useCompositor(
  canvasRef: RefObject<HTMLCanvasElement | null>,
  options: CompositorOptions,
): CompositorResult {
  const pool = useRef<Map<string, PoolEntry>>(new Map());
  const offscreens = useRef<Map<string, OffscreenEntry>>(new Map());
  // LUT data cache: url → parsed LutData (avoids re-parsing on every frame)
  const lutCache = useRef<Map<string, LutData>>(new Map());
  const optionsRef = useRef(options);
  const onFrameDrawnRef = useRef(options.onFrameDrawn);
  useEffect(() => {
    optionsRef.current = options;
    onFrameDrawnRef.current = options.onFrameDrawn;
    // Update muted state on all active video elements
    for (const [, entry] of pool.current) {
      if (entry.kind === "video") {
        entry.el.muted = options.muted;
        entry.el.volume = options.volume;
      }
    }
  }, [options]);
  const { processFrame: ckProcessFrame } = useChromaKeyGL();
  const { applyLut: applyLutGL } = useLutGL();
  const { apply: applyGradeGL, applyColorSpace: applyColorSpaceGL } =
    useColorGradeGL();

  // Fetch + parse a .cube file, caching by URL
  const getLut = useCallback(async (url: string): Promise<LutData | null> => {
    const cached = lutCache.current.get(url);
    if (cached) return cached;
    try {
      const text = await fetch(url).then((r) => r.text());
      const data = parseCube(text);
      lutCache.current.set(url, data);
      return data;
    } catch {
      return null;
    }
  }, []);

  const applyGradeGLToCanvas = useCallback(
    async (canvas: OffscreenCanvas | HTMLCanvasElement, clip: LocalClip) => {
      if (!clip.colorGrade) return;
      const out = await applyGradeGL(canvas, clip.colorGrade);
      if (!out) return;
      const ctx2 = canvas.getContext("2d") as CanvasRenderingContext2D;
      ctx2.clearRect(0, 0, canvas.width, canvas.height);
      ctx2.drawImage(out as CanvasImageSource, 0, 0);
      if (out instanceof ImageBitmap) out.close();
    },
    [applyGradeGL],
  );

  // Helper: apply color space conversion GL pass to an offscreen canvas in-place
  const applyColorSpaceGLToCanvas = useCallback(
    async (canvas: OffscreenCanvas | HTMLCanvasElement, clip: LocalClip) => {
      if (!clip.colorSpace || clip.colorSpace === "srgb") return;
      const out = await applyColorSpaceGL(canvas, clip.colorSpace);
      if (!out) return;
      const ctx2 = canvas.getContext("2d") as CanvasRenderingContext2D;
      ctx2.clearRect(0, 0, canvas.width, canvas.height);
      ctx2.drawImage(out as CanvasImageSource, 0, 0);
      if (out instanceof ImageBitmap) out.close();
    },
    [applyColorSpaceGL],
  );

  const drawFrame = useCallback(
    (
      ctx: CanvasRenderingContext2D,
      cw: number,
      ch: number,
      clips: LocalClip[],
      t: number,
    ) => {
      ctx.clearRect(0, 0, cw, ch);

      const { globalLut } = useEditorStore.getState();

      const active = clips

        .filter((c) => isVisual(c) && isActive(c, t))
        .sort((a, b) =>
          a.track !== b.track
            ? a.track - b.track
            : (a.zIndex ?? 0) - (b.zIndex ?? 0),
        );

      for (const clip of active) {
        const entry = pool.current.get(clip.id);
        if (!entry) continue;

        // Destination rect — x/y are % of canvas; width/height are px or full canvas
        const dx = ((clip.x ?? 0) / 100) * cw;
        const dy = ((clip.y ?? 0) / 100) * ch;
        const dw = clip.width != null ? clip.width : cw;
        const dh = clip.height != null ? clip.height : ch;

        if (dw <= 0 || dh <= 0) continue;

        const baseOpacity = resolveOpacity(clip, t);
        const tr = resolveTransition(clip, t, dx, dy, dw, dh);
        const opacity = Math.max(0, Math.min(1, baseOpacity * tr.alpha));
        const filter = buildFilter(clip);
        const hasFilter = filter !== "none";
        const hasTransition = tr !== IDENTITY_TRANSITION;
        const needsRotation = !!clip.rotation;

        // ── fast path: no filter, full opacity, no transition, no rotation ─────
        if (!hasFilter && opacity >= 1 && !hasTransition && !needsRotation) {
          if (clip.chromaKey?.enabled && clip.chromaKey.color) {
            const src = entry.el;
            // Always process chroma key frames, browser will handle video readiness
            ckProcessFrame(
              src,
              Math.round(dw),
              Math.round(dh),
              clip.chromaKey,
            ).then((bmp) => {
              if (!bmp) return;
              ctx.drawImage(bmp as CanvasImageSource, dx, dy, dw, dh);
              if (bmp instanceof ImageBitmap) bmp.close();
            }).catch(() => { /* ignore frame processing errors */ });
          } else {
            // Apply blend mode for fast path
            const blendMode = clip.blendMode ?? "normal";
            const supportedCanvasBlendModes: Set<string> = new Set([
              "normal",
              "screen",
              "multiply",
              "overlay",
              "darken",
              "lighten",
              "color-dodge",
              "color-burn",
              "hard-light",
              "soft-light",
              "difference",
              "exclusion",
              "hue",
              "saturation",
              "color",
              "luminosity",
            ]);

            if (supportedCanvasBlendModes.has(blendMode)) {
              ctx.globalCompositeOperation =
                blendMode as GlobalCompositeOperation;
            }

            const hasMask = !!clip.mask?.enabled;
            if (hasMask) {
              ctx.save();
              applyClipMaskPath(ctx, clip, dx, dy, dw, dh, t);
            }

            try {
              // Always try to draw video elements - browsers will render whatever is available
              ctx.drawImage(entry.el, dx, dy, dw, dh);
            } catch {
              /* element not ready */
            }

            if (hasMask) ctx.restore();

            // Reset to normal for next operations
            ctx.globalCompositeOperation = "source-over";
          }
          // Per-clip LUT on fast path: read back the region, apply, blit
          if (clip.lut?.enabled && clip.lut.url) {
            const rdw = Math.round(dw);
            const rdh = Math.round(dh);
            getLut(clip.lut.url).then((lutData) => {
              if (!lutData) return;
              const region = ctx.getImageData(
                Math.round(dx),
                Math.round(dy),
                rdw,
                rdh,
              );
              const tmp =
                typeof OffscreenCanvas !== "undefined"
                  ? new OffscreenCanvas(rdw, rdh)
                  : Object.assign(document.createElement("canvas"), {
                      width: rdw,
                      height: rdh,
                    });
              const tmpCtx = tmp.getContext("2d") as CanvasRenderingContext2D;
              tmpCtx.putImageData(region, 0, 0);
              applyLutGL(tmp, lutData, clip.lut!.intensity).then((out) => {
                if (!out) return;
                ctx.drawImage(
                  out as CanvasImageSource,
                  Math.round(dx),
                  Math.round(dy),
                  rdw,
                  rdh,
                );
                if (out instanceof ImageBitmap) out.close();
              });
            });
          }
          // Curves + secondary on fast path: read back region, apply GL, blit
          if (clip.colorGrade?.curves || clip.colorGrade?.secondary?.enabled) {
            const rdw = Math.round(dw);
            const rdh = Math.round(dh);
            const region = ctx.getImageData(
              Math.round(dx),
              Math.round(dy),
              rdw,
              rdh,
            );
            const tmp =
              typeof OffscreenCanvas !== "undefined"
                ? new OffscreenCanvas(rdw, rdh)
                : Object.assign(document.createElement("canvas"), {
                    width: rdw,
                    height: rdh,
                  });
            (tmp.getContext("2d") as CanvasRenderingContext2D).putImageData(
              region,
              0,
              0,
            );
            // Apply color space conversion first, then color grading
            applyColorSpaceGLToCanvas(tmp, clip)
              .then(() => {
                return applyGradeGLToCanvas(tmp, clip);
              })
              .then(() => {
                ctx.drawImage(
                  tmp as CanvasImageSource,
                  Math.round(dx),
                  Math.round(dy),
                  rdw,
                  rdh,
                );
              });
          } else if (clip.colorSpace && clip.colorSpace !== "srgb") {
            // Only color space conversion needed on fast path
            const rdw = Math.round(dw);
            const rdh = Math.round(dh);
            const region = ctx.getImageData(
              Math.round(dx),
              Math.round(dy),
              rdw,
              rdh,
            );
            const tmp =
              typeof OffscreenCanvas !== "undefined"
                ? new OffscreenCanvas(rdw, rdh)
                : Object.assign(document.createElement("canvas"), {
                    width: rdw,
                    height: rdh,
                  });
            (tmp.getContext("2d") as CanvasRenderingContext2D).putImageData(
              region,
              0,
              0,
            );
            applyColorSpaceGLToCanvas(tmp, clip).then(() => {
              ctx.drawImage(
                tmp as CanvasImageSource,
                Math.round(dx),
                Math.round(dy),
                rdw,
                rdh,
              );
            });
          }
          continue;
        }

        // ── compositing path ───────────────────────────────────────────────────
        // Step 1: render clip into offscreen with its CSS filter applied.
        const off = getOffscreen(
          offscreens.current,
          clip.id,
          Math.round(dw),
          Math.round(dh),
        );
        if (!off) continue;
        const { canvas: offCanvas, ctx: offCtx } = off;

        offCtx.clearRect(0, 0, Math.round(dw), Math.round(dh));
        offCtx.filter = filter;
        try {
          if (entry.kind === "video") {
            if (entry.el.readyState >= 2)
              offCtx.drawImage(entry.el, 0, 0, Math.round(dw), Math.round(dh));
          } else {
            offCtx.drawImage(entry.el, 0, 0, Math.round(dw), Math.round(dh));
          }
        } catch {
          /* element not ready */
        }
        offCtx.filter = "none";

        if (clip.chromaKey?.enabled && clip.chromaKey.color) {
          const src = entry.kind === "video" ? entry.el : entry.el;
          if (entry.kind !== "video" || entry.el.readyState >= 2) {
            // Replace offscreen content with WebGL-keyed frame
            ckProcessFrame(
              src,
              Math.round(dw),
              Math.round(dh),
              clip.chromaKey,
            ).then((bmp) => {
              if (!bmp) return;
              offCtx.clearRect(0, 0, Math.round(dw), Math.round(dh));
              offCtx.drawImage(bmp as CanvasImageSource, 0, 0);
              if (bmp instanceof ImageBitmap) bmp.close();
            });
          }
        }

        // Per-clip LUT on compositing path: apply to offscreen before blitting
        if (clip.lut?.enabled && clip.lut.url) {
          const rdw = Math.round(dw);
          const rdh = Math.round(dh);
          getLut(clip.lut.url).then((lutData) => {
            if (!lutData) return;
            applyLutGL(offCanvas, lutData, clip.lut!.intensity).then((out) => {
              if (!out) return;
              offCtx.clearRect(0, 0, rdw, rdh);
              offCtx.drawImage(out as CanvasImageSource, 0, 0);
              if (out instanceof ImageBitmap) out.close();
            });
          });
        }
        // Color space conversion on compositing path: apply first to offscreen before blitting
        if (clip.colorSpace && clip.colorSpace !== "srgb") {
          applyColorSpaceGLToCanvas(offCanvas, clip);
        }
        // Curves + secondary on compositing path: apply to offscreen before blitting
        if (clip.colorGrade?.curves || clip.colorGrade?.secondary?.enabled) {
          applyGradeGLToCanvas(offCanvas, clip);
        }

        // Step 2: composite offscreen onto main canvas applying transition transforms.
        ctx.save();
        ctx.globalAlpha = opacity;

        // Wipe: restrict drawing to a growing/shrinking rect
        if (tr.clipRect) {
          ctx.beginPath();
          ctx.rect(tr.clipRect.x, tr.clipRect.y, tr.clipRect.w, tr.clipRect.h);
          ctx.clip();
        }

        // Rotation (around clip centre, applied before slide/zoom so pivot is correct)
        const pivotX = dx + dw / 2;
        const pivotY = dy + dh / 2;
        const needsTransform =
          needsRotation || tr.tx !== 0 || tr.ty !== 0 || tr.scale !== 1;

        if (needsTransform) {
          ctx.translate(pivotX, pivotY);
          if (needsRotation) ctx.rotate((clip.rotation! * Math.PI) / 180);
          if (tr.scale !== 1) ctx.scale(tr.scale, tr.scale);
          ctx.translate(-pivotX + tr.tx, -pivotY + tr.ty);
        }

        if (clip.mask?.enabled) {
          applyClipMaskPath(ctx, clip, dx, dy, dw, dh, t);
        }

        // Apply blend mode
        const blendMode = clip.blendMode ?? "normal";
        const supportedCanvasBlendModes: Set<string> = new Set([
          "normal",
          "screen",
          "multiply",
          "overlay",
          "darken",
          "lighten",
          "color-dodge",
          "color-burn",
          "hard-light",
          "soft-light",
          "difference",
          "exclusion",
          "hue",
          "saturation",
          "color",
          "luminosity",
        ]);

        if (supportedCanvasBlendModes.has(blendMode)) {
          // Use native canvas globalCompositeOperation for supported modes
          ctx.globalCompositeOperation = blendMode as GlobalCompositeOperation;
        }

        try {
          ctx.drawImage(offCanvas as CanvasImageSource, dx, dy, dw, dh);
        } catch {
          /* not ready */
        }

        // Reset to normal for next clip
        ctx.globalCompositeOperation = "source-over";

        ctx.restore();
      }
      // Global LUT post-pass: apply to the entire composited frame
      if (globalLut?.enabled && globalLut.url) {
        const canvas = ctx.canvas;
        getLut(globalLut.url).then((lutData) => {
          if (!lutData) return;
          const tmp =
            typeof OffscreenCanvas !== "undefined"
              ? new OffscreenCanvas(canvas.width, canvas.height)
              : Object.assign(document.createElement("canvas"), {
                  width: canvas.width,
                  height: canvas.height,
                });
          const tmpCtx = tmp.getContext("2d") as CanvasRenderingContext2D;
          tmpCtx.drawImage(canvas, 0, 0);
          applyLutGL(tmp, lutData, globalLut.intensity).then((out) => {
            if (!out) return;
            ctx.clearRect(0, 0, canvas.width, canvas.height);
            ctx.drawImage(out as CanvasImageSource, 0, 0);
            if (out instanceof ImageBitmap) out.close();
            onFrameDrawnRef.current?.();
          });
          return; // onFrameDrawn fires inside the async chain above
        });
      }
      // Notify after all clips are drawn
      onFrameDrawnRef.current?.();
    },
    [
      getLut,
      applyLutGL,
      applyGradeGLToCanvas,
      applyColorSpaceGLToCanvas,
      ckProcessFrame,
    ],
  );

  // ── sync element pool ───────────────────────────────────────────────────────

  const syncPool = useCallback((clips: LocalClip[], t: number) => {
    const activeIds = new Set(
      clips.filter((c) => isVisual(c) && isActive(c, t)).map((c) => c.id),
    );

    for (const [id, entry] of pool.current) {
      if (!activeIds.has(id)) {
        if (entry.kind === "video") entry.el.pause();
        pool.current.delete(id);
        offscreens.current.delete(id);
      }
    }

    for (const clip of clips) {
      if (!isVisual(clip) || !isActive(clip, t)) continue;
      const url = clip.url ?? "";
      if (!url) continue;

      const existing = pool.current.get(clip.id);

      if (clip.type === "video") {
        if (!existing || existing.kind !== "video") {
          const vid = document.createElement("video");
          vid.muted = optionsRef.current.muted;
          vid.volume = optionsRef.current.volume;
          vid.playsInline = true;
          vid.preload = "auto";
          vid.crossOrigin = "anonymous";
          vid.src = url;
          vid.load(); // Explicitly start loading the video
          pool.current.set(clip.id, { kind: "video", el: vid, loadedUrl: url });
        } else if (existing.loadedUrl !== url) {
          existing.el.pause();
          existing.el.src = url;
          existing.el.muted = optionsRef.current.muted;
          existing.el.volume = optionsRef.current.volume;
          existing.loadedUrl = url;
          offscreens.current.delete(clip.id);
        }
      } else if (clip.type === "image") {
        if (!existing || existing.kind !== "image") {
          const img = new Image();
          img.crossOrigin = "anonymous";
          img.src = url;
          pool.current.set(clip.id, { kind: "image", el: img, loadedUrl: url });
        } else if (existing.loadedUrl !== url) {
          existing.el.src = url;
          existing.loadedUrl = url;
          offscreens.current.delete(clip.id);
        }
      }
    }
  }, []);

  // ── seek all active video elements ─────────────────────────────────────────

  const seekAll = useCallback((clips: LocalClip[], t: number) => {
    for (const clip of clips) {
      if (clip.type !== "video" || !isActive(clip, t)) continue;
      const entry = pool.current.get(clip.id);
      if (!entry || entry.kind !== "video") continue;
      const vid = entry.el;
      const ct = clipTime(clip, t);
      if (Math.abs(vid.currentTime - ct) > 0.15) {
        try {
          vid.currentTime = ct;
        } catch {
          /* not ready */
        }
      }
    }
  }, []);


  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    // Scrub path: store subscription redraws on every seek/pause state change
    const unsub = useEditorStore.subscribe((state) => {
      const { clips, playback } = state;
      const { currentTime, isPlaying } = playback;
      if (isPlaying) return; // RAF loop handles playback frames

      const ctx = canvas.getContext("2d");
      if (!ctx) return;

      syncPool(clips, currentTime);
      seekAll(clips, currentTime);

      requestAnimationFrame(() => {
        drawFrame(ctx, canvas.width, canvas.height, clips, currentTime);
      });
    });

    // RAF loop
    let rafId = 0;
    let alive = true;
    let lastTs: number | null = null;
    const currentPool = pool.current;
    const currentOffscreens = offscreens.current;

    const step = (now: number) => {
      if (!alive) return;

      const store = useEditorStore.getState();
      const { clips, playback } = store;
      const { isPlaying, currentTime, duration, playbackRate } = playback;

      const ctx = canvas.getContext("2d");
      if (!ctx) {
        rafId = requestAnimationFrame(step);
        return;
      }

      if (!isPlaying) {
        lastTs = null;
        // Still need to sync pool and draw when paused to handle store updates
        syncPool(clips, currentTime);
        drawFrame(ctx, canvas.width, canvas.height, clips, currentTime);
        rafId = requestAnimationFrame(step);
        return;
      }

      // Reset lastTs when we start playing to avoid large initial dt
      if (lastTs === null) {
        lastTs = now;
        rafId = requestAnimationFrame(step);
        return;
      }

      // Sync pool every frame so newly-entering clips get pool entries
      syncPool(clips, currentTime);

      // Advance time — always use wall-clock for smooth timeline updates
      // This ensures video always renders even if the video element takes time to load
      const dt = (now - lastTs) / 1000;
      const next: number = currentTime + dt * playbackRate;
      lastTs = now;

      // Handle in/out points for looped playback within in/out range
      const inPoint = playback.inPoint ?? 0;
      const outPoint = playback.outPoint ?? duration;

      if (outPoint > 0 && next >= outPoint) {
        // If we have an in point, loop back to it; otherwise pause at the end
        if (playback.inPoint !== null) {
          store.setCurrentTime(inPoint);
          lastTs = now; // Reset timestamp for smooth loop
        } else {
          store.pause();
          store.setCurrentTime(outPoint);
          for (const [, entry] of pool.current) {
            if (entry.kind === "video") entry.el.pause();
          }
        }
        drawFrame(ctx, canvas.width, canvas.height, clips, playback.inPoint !== null ? inPoint : outPoint);
        rafId = requestAnimationFrame(step);
        return;
      }

      if (next <= inPoint) {
        // If we're going reverse past in point, loop to out point if we have one, else pause at 0
        if (playback.outPoint !== null) {
          store.setCurrentTime(outPoint);
          lastTs = now;
        } else {
          store.pause();
          store.setCurrentTime(inPoint);
          for (const [, entry] of pool.current) {
            if (entry.kind === "video") entry.el.pause();
          }
        }
        drawFrame(ctx, canvas.width, canvas.height, clips, playback.outPoint !== null ? outPoint : inPoint);
        rafId = requestAnimationFrame(step);
        return;
      }

      store.setCurrentTime(next);

      // Drive all active video elements — including the primary clock source
      // Note: HTMLVideoElement.playbackRate must be positive; reverse is handled
      // by the compositor time-advance above (negative store.playbackRate).
      const isReverse = playbackRate < 0;
      for (const clip of clips) {
        if (clip.type !== "video" || !isActive(clip, next)) continue;
        const entry = pool.current.get(clip.id);
        if (!entry || entry.kind !== "video") continue;
        const vid = entry.el;

        if (isReverse) {
          // Reverse: scrub the video element to the correct position each frame;
          // HTMLVideoElement cannot play backwards natively.
          if (!vid.paused) vid.pause();
          const ct = clipTime(clip, next);
          if (Math.abs(vid.currentTime - ct) > 0.08) {
            try {
              vid.currentTime = ct;
            } catch {
              /* not ready */
            }
          }
        } else {
          vid.playbackRate = playbackRate * (clip.speed ?? 1);

          // Resync videos that have drifted from the playhead (including primary)
          const ct = clipTime(clip, next);
          if (Math.abs(vid.currentTime - ct) > 0.3) {
            try {
              vid.currentTime = ct;
            } catch {
              /* not ready */
            }
          }

          if (vid.paused) {
            // Always try to play, even if readyState is low - browsers will handle it
            vid.play().catch((e) => {
              if (e.name !== "AbortError") console.warn("compositor play:", e);
            });
          }
        }
      }

      drawFrame(ctx, canvas.width, canvas.height, clips, next);
      rafId = requestAnimationFrame(step);
    };

    rafId = requestAnimationFrame(step);

    return () => {
      alive = false;
      cancelAnimationFrame(rafId);
      unsub();
      for (const [, entry] of currentPool) {
        if (entry.kind === "video") entry.el.pause();
      }
      currentPool.clear();
      currentOffscreens.clear();
    };
  }, [canvasRef, drawFrame, seekAll, syncPool]);

  return { videoError: null };
}