import { useEffect, useRef } from "react";
import { useEditorStore } from "@/store/editorStore";
import { useAuth } from "@/hooks/useAuth";
import { useTrimToolStore, applyJKLTrim } from "@/hooks/useTrimTools";

// Simple event bus so EditorPage can open the shortcuts modal
const listeners = new Set<() => void>();
export const shortcutHelpBus = {
  subscribe: (fn: () => void) => { listeners.add(fn); return () => listeners.delete(fn) },
  emit: () => listeners.forEach((fn) => fn()),
};

// J/K/L speed ladder — each successive J or L press steps through this list.
// Negative values = reverse, positive = forward.
const JKL_SPEEDS = [-8, -4, -2, -1, 1, 2, 4, 8];
const JKL_FWD_START = JKL_SPEEDS.indexOf(1);   // index 4
const JKL_REV_START = JKL_SPEEDS.indexOf(-1);  // index 3

export function useEditorShortcuts() {
  const { accessToken } = useAuth();
  const jklIndexRef = useRef<number | null>(null);
  // Track which edge is being JKL-trimmed: null = normal playback mode
  const trimEdgeRef = useRef<"left" | "right" | null>(null);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (
        target &&
        (target.tagName === "INPUT" ||
          target.tagName === "TEXTAREA" ||
          target.tagName === "SELECT" ||
          target.isContentEditable)
      ) return;

      const store = useEditorStore.getState();
      const { playback } = store;
      const frameDuration = 1 / (playback.frameRate || 30);
      const trimStore = useTrimToolStore.getState();

      // ── Undo / Redo ────────────────────────────────────────────────────────
      if ((e.ctrlKey || e.metaKey) && e.code === "KeyZ") {
        e.preventDefault();
        if (e.shiftKey) store.redo(); else store.undo();
        return;
      }
      if ((e.ctrlKey || e.metaKey) && e.code === "KeyY") {
        e.preventDefault();
        store.redo();
        return;
      }

      // Skip modifier-key combos for the plain shortcuts below
      if (e.ctrlKey || e.metaKey || e.altKey) return;

      switch (e.code) {

        // ── Play / Pause ─────────────────────────────────────────────────────
        case "Space":
          e.preventDefault();
          if (playback.isPlaying) {
            store.pause();
            jklIndexRef.current = null;
          } else {
            // Resume forward at ×1 if we were stopped
            if (!playback.isPlaying) {
              store.setPlaybackRate(1);
              store.play();
              jklIndexRef.current = JKL_FWD_START;
            }
          }
          break;

        // ── J — reverse (each press increases reverse speed) ─────────────────
        case "KeyJ": {
          e.preventDefault();
          // JKL trim mode: if a clip is selected and a trim tool is active
          if (store.selectedClipId && trimStore.activeTool !== "select" && trimEdgeRef.current) {
            applyJKLTrim(store.selectedClipId, trimEdgeRef.current, trimStore.activeTool, -frameDuration);
            break;
          }
          const cur = jklIndexRef.current;
          let next: number;
          if (cur === null || JKL_SPEEDS[cur] >= 0) {
            next = JKL_REV_START;
          } else {
            next = Math.max(0, cur - 1);
          }
          jklIndexRef.current = next;
          store.setPlaybackRate(JKL_SPEEDS[next]);
          store.play();
          break;
        }

        // ── K — pause ────────────────────────────────────────────────────────
        case "KeyK":
          e.preventDefault();
          store.pause();
          jklIndexRef.current = null;
          break;

        // ── L — forward (each press increases forward speed) ─────────────────
        case "KeyL": {
          e.preventDefault();
          // JKL trim mode
          if (store.selectedClipId && trimStore.activeTool !== "select" && trimEdgeRef.current) {
            applyJKLTrim(store.selectedClipId, trimEdgeRef.current, trimStore.activeTool, frameDuration);
            break;
          }
          const cur = jklIndexRef.current;
          let next: number;
          if (cur === null || JKL_SPEEDS[cur] <= 0) {
            next = JKL_FWD_START;
          } else {
            next = Math.min(JKL_SPEEDS.length - 1, cur + 1);
          }
          jklIndexRef.current = next;
          store.setPlaybackRate(JKL_SPEEDS[next]);
          store.play();
          break;
        }

        // ── Frame step (comma / period) ───────────────────────────────────────
        case "Comma":
          e.preventDefault();
          store.pause();
          jklIndexRef.current = null;
          store.seek(Math.max(0, playback.currentTime - frameDuration));
          break;

        case "Period":
          e.preventDefault();
          store.pause();
          jklIndexRef.current = null;
          store.seek(Math.min(playback.duration, playback.currentTime + frameDuration));
          break;

        // ── Arrow seek ────────────────────────────────────────────────────────
        case "ArrowLeft":
          e.preventDefault();
          store.seek(Math.max(0, playback.currentTime - (e.shiftKey ? 5 : 1)));
          break;

        case "ArrowRight":
          e.preventDefault();
          store.seek(Math.min(playback.duration, playback.currentTime + (e.shiftKey ? 5 : 1)));
          break;

        // ── Jump to start / end ───────────────────────────────────────────────
        case "Home":
          e.preventDefault();
          store.seek(0);
          break;

        case "End":
          e.preventDefault();
          store.seek(playback.duration);
          break;

        // ── In / Out points ───────────────────────────────────────────────────
        case "KeyI":
          e.preventDefault();
          // Toggle: clear if already set to current time, otherwise set
          if (playback.inPoint !== null && Math.abs(playback.inPoint - playback.currentTime) < frameDuration) {
            store.setInPoint(null);
          } else {
            store.setInPoint(playback.currentTime);
          }
          break;

        case "KeyO":
          e.preventDefault();
          if (playback.outPoint !== null && Math.abs(playback.outPoint - playback.currentTime) < frameDuration) {
            store.setOutPoint(null);
          } else {
            store.setOutPoint(playback.currentTime);
          }
          break;

        // Seek to in / out point
        case "ShiftLeft":
        case "ShiftRight":
          // handled via e.shiftKey on arrow keys above
          break;

        // ── Clip operations ───────────────────────────────────────────────────
        case "KeyS":
          if (store.selectedClipId && accessToken) {
            e.preventDefault();
            store.splitClip(store.selectedClipId, playback.currentTime, accessToken);
          }
          break;

        // ── Trim tool cycle / edge selection ─────────────────────────────────
        // T cycles through trim tools; [ / ] selects left / right edge for JKL trim
        case "KeyT":
          e.preventDefault();
          trimStore.cycleTool();
          break;

        case "BracketLeft":
          e.preventDefault();
          trimEdgeRef.current = "left";
          break;

        case "BracketRight":
          e.preventDefault();
          trimEdgeRef.current = "right";
          break;

        case "KeyM":
          if (store.selectedClipId && accessToken) {
            e.preventDefault();
            const clip = store.clips.find((c) => c.id === store.selectedClipId);
            if (clip && (clip.type === "video" || clip.type === "audio")) {
              const newVolume = (clip.volume ?? 1) > 0 ? 0 : 1;
              store.pushHistory();
              store.updateClipLocal(store.selectedClipId, { volume: newVolume });
              store.syncUpdateClip(store.selectedClipId, { volume: newVolume }, accessToken);
            }
          }
          break;

        case "Delete":
        case "Backspace":
          if (store.selectedClipId && accessToken) {
            e.preventDefault();
            store.syncDeleteClip(store.selectedClipId, accessToken);
            store.selectClip(null);
          }
          break;

        case "Escape":
          store.selectClip(null);
          break;

        // ── Zoom ──────────────────────────────────────────────────────────────
        case "Equal":
        case "NumpadAdd":
          e.preventDefault();
          store.setZoom(Math.min(4, store.zoom + 0.25));
          break;

        case "Minus":
        case "NumpadSubtract":
          e.preventDefault();
          store.setZoom(Math.max(0.25, store.zoom - 0.25));
          break;

        // ── Help ──────────────────────────────────────────────────────────────
        case "Slash":
          if (e.shiftKey) {
            e.preventDefault();
            shortcutHelpBus.emit();
          }
          break;
      }
    };

    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [accessToken]);
}
