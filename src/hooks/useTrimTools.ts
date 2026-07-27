import { create } from "zustand";
import { useEditorStore, type LocalClip } from "@/store/editorStore";

export type TrimTool = "select" | "trim" | "ripple" | "roll" | "slip" | "slide";

interface TrimToolState {
  activeTool: TrimTool;
  setTool: (t: TrimTool) => void;
  cycleTool: () => void;
}

const TOOL_ORDER: TrimTool[] = ["select", "trim", "ripple", "roll", "slip", "slide"];

export const useTrimToolStore = create<TrimToolState>((set, get) => ({
  activeTool: "select",
  setTool: (t) => set({ activeTool: t }),
  cycleTool: () => {
    const idx = TOOL_ORDER.indexOf(get().activeTool);
    set({ activeTool: TOOL_ORDER[(idx + 1) % TOOL_ORDER.length] });
  },
}));

// ─── Edit operations ──────────────────────────────────────────────────────────
// Each function reads/writes the editor store directly so they can be called
// from both mouse handlers and keyboard shortcuts.

function getStore() {
  return useEditorStore.getState();
}

/** Ripple trim: move one edge, shift all downstream clips on the same track. */
export function applyRippleTrim(
  clipId: string,
  edge: "left" | "right",
  delta: number, // seconds
) {
  const store = getStore();
  const clip = store.clips.find((c) => c.id === clipId);
  if (!clip) return;

  store.pushHistory();

  if (edge === "left") {
    const newStart = Math.max(0, clip.startTime + delta);
    const newDuration = clip.duration - (newStart - clip.startTime);
    if (newDuration < 0.1) return;
    const newTrimStart = Math.max(0, (clip.trimStart ?? 0) + delta);
    store.updateClipLocal(clipId, {
      startTime: newStart,
      duration: newDuration,
      trimStart: newTrimStart,
    });
    // Ripple: shift all clips on same track that start at or after original start
    store.clips
      .filter((c) => c.id !== clipId && c.track === clip.track && c.startTime >= clip.startTime)
      .forEach((c) => store.updateClipLocal(c.id, { startTime: c.startTime + delta }));
  } else {
    const newDuration = Math.max(0.1, clip.duration + delta);
    const newTrimEnd = (clip.trimEnd ?? clip.duration) + delta;
    const rippleDelta = newDuration - clip.duration;
    store.updateClipLocal(clipId, { duration: newDuration, trimEnd: newTrimEnd });
    // Ripple: shift all clips on same track that start after this clip ends
    const clipEnd = clip.startTime + clip.duration;
    store.clips
      .filter((c) => c.id !== clipId && c.track === clip.track && c.startTime >= clipEnd)
      .forEach((c) => store.updateClipLocal(c.id, { startTime: c.startTime + rippleDelta }));
  }
}

/** Roll edit: move the shared boundary between two adjacent clips. */
export function applyRollEdit(
  clipId: string,
  edge: "left" | "right",
  delta: number,
) {
  const store = getStore();
  const clip = store.clips.find((c) => c.id === clipId);
  if (!clip) return;

  // Find the adjacent clip sharing the boundary
  const adjacentClip =
    edge === "right"
      ? store.clips.find(
          (c) =>
            c.id !== clipId &&
            c.track === clip.track &&
            Math.abs(c.startTime - (clip.startTime + clip.duration)) < 0.05,
        )
      : store.clips.find(
          (c) =>
            c.id !== clipId &&
            c.track === clip.track &&
            Math.abs(c.startTime + c.duration - clip.startTime) < 0.05,
        );

  store.pushHistory();

  if (edge === "right") {
    const newDuration = Math.max(0.1, clip.duration + delta);
    store.updateClipLocal(clipId, {
      duration: newDuration,
      trimEnd: (clip.trimEnd ?? clip.duration) + delta,
    });
    if (adjacentClip) {
      const newAdjacentStart = adjacentClip.startTime + delta;
      const newAdjacentDuration = Math.max(0.1, adjacentClip.duration - delta);
      store.updateClipLocal(adjacentClip.id, {
        startTime: newAdjacentStart,
        duration: newAdjacentDuration,
        trimStart: Math.max(0, (adjacentClip.trimStart ?? 0) + delta),
      });
    }
  } else {
    const newStart = Math.max(0, clip.startTime + delta);
    const newDuration = Math.max(0.1, clip.duration - delta);
    store.updateClipLocal(clipId, {
      startTime: newStart,
      duration: newDuration,
      trimStart: Math.max(0, (clip.trimStart ?? 0) + delta),
    });
    if (adjacentClip) {
      store.updateClipLocal(adjacentClip.id, {
        duration: Math.max(0.1, adjacentClip.duration + delta),
        trimEnd: (adjacentClip.trimEnd ?? adjacentClip.duration) + delta,
      });
    }
  }
}

/** Slip edit: shift the clip's in/out points without moving it on the timeline. */
export function applySlipEdit(clipId: string, delta: number) {
  const store = getStore();
  const clip = store.clips.find((c) => c.id === clipId);
  if (!clip) return;

  store.pushHistory();
  store.updateClipLocal(clipId, {
    trimStart: Math.max(0, (clip.trimStart ?? 0) + delta),
    trimEnd: (clip.trimEnd ?? clip.duration) + delta,
  });
}

/** Slide edit: move the clip on the timeline, rolling adjacent clips to fill. */
export function applySlideEdit(clipId: string, delta: number) {
  const store = getStore();
  const clip = store.clips.find((c) => c.id === clipId);
  if (!clip) return;

  const newStart = Math.max(0, clip.startTime + delta);
  const actualDelta = newStart - clip.startTime;
  if (Math.abs(actualDelta) < 0.001) return;

  const prevClip = store.clips
    .filter((c) => c.id !== clipId && c.track === clip.track && c.startTime < clip.startTime)
    .sort((a, b) => b.startTime - a.startTime)[0];

  const nextClip = store.clips
    .filter((c) => c.id !== clipId && c.track === clip.track && c.startTime > clip.startTime)
    .sort((a, b) => a.startTime - b.startTime)[0];

  store.pushHistory();
  store.updateClipLocal(clipId, { startTime: newStart });

  // Roll the outpoint of the preceding clip
  if (prevClip) {
    const newPrevDuration = Math.max(0.1, prevClip.duration + actualDelta);
    store.updateClipLocal(prevClip.id, {
      duration: newPrevDuration,
      trimEnd: (prevClip.trimEnd ?? prevClip.duration) + actualDelta,
    });
  }
  // Roll the inpoint of the following clip
  if (nextClip) {
    const newNextStart = nextClip.startTime + actualDelta;
    const newNextDuration = Math.max(0.1, nextClip.duration - actualDelta);
    store.updateClipLocal(nextClip.id, {
      startTime: newNextStart,
      duration: newNextDuration,
      trimStart: Math.max(0, (nextClip.trimStart ?? 0) + actualDelta),
    });
  }
}

/** Standard trim (no ripple): just resize the clip edge. */
export function applyTrim(
  clipId: string,
  edge: "left" | "right",
  delta: number,
) {
  const store = getStore();
  const clip = store.clips.find((c) => c.id === clipId);
  if (!clip) return;

  store.pushHistory();

  if (edge === "left") {
    const newStart = Math.max(0, clip.startTime + delta);
    const newDuration = Math.max(0.1, clip.duration - (newStart - clip.startTime));
    store.updateClipLocal(clipId, {
      startTime: newStart,
      duration: newDuration,
      trimStart: Math.max(0, (clip.trimStart ?? 0) + delta),
    });
  } else {
    store.updateClipLocal(clipId, {
      duration: Math.max(0.1, clip.duration + delta),
      trimEnd: (clip.trimEnd ?? clip.duration) + delta,
    });
  }
}

// ─── JKL scrub-while-trimming ─────────────────────────────────────────────────
// Exported so useEditorShortcuts can call it.
export function applyJKLTrim(
  clipId: string,
  edge: "left" | "right",
  tool: TrimTool,
  delta: number, // seconds (positive = forward, negative = backward)
) {
  switch (tool) {
    case "ripple": return applyRippleTrim(clipId, edge, delta);
    case "roll":   return applyRollEdit(clipId, edge, delta);
    case "slip":   return applySlipEdit(clipId, delta);
    case "slide":  return applySlideEdit(clipId, delta);
    default:       return applyTrim(clipId, edge, delta);
  }
}

// Re-export clip type for consumers
export type { LocalClip };
