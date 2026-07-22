import { useEffect } from "react";
import { useEditorStore } from "@/store/editorStore";
import { useAuth } from "@/hooks/useAuth";

// Simple event bus so EditorPage can open the shortcuts modal
const listeners = new Set<() => void>();
export const shortcutHelpBus = {
  subscribe: (fn: () => void) => { listeners.add(fn); return () => listeners.delete(fn) },
  emit: () => listeners.forEach((fn) => fn()),
};

export function useEditorShortcuts() {
  const { accessToken } = useAuth();

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

      // Undo / Redo
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

      switch (e.code) {
        case "Space":
          e.preventDefault();
          store.playback.isPlaying ? store.pause() : store.play();
          break;

        case "ArrowLeft":
          e.preventDefault();
          store.seek(Math.max(0, store.playback.currentTime - (e.shiftKey ? 5 : 1)));
          break;

        case "ArrowRight":
          e.preventDefault();
          store.seek(Math.min(store.playback.duration, store.playback.currentTime + (e.shiftKey ? 5 : 1)));
          break;

        case "Comma":
          e.preventDefault();
          store.seek(Math.max(0, store.playback.currentTime - (1 / 30)));
          break;

        case "Period":
          e.preventDefault();
          store.seek(Math.min(store.playback.duration, store.playback.currentTime + (1 / 30)));
          break;

        case "Home":
          e.preventDefault();
          store.seek(0);
          break;

        case "End":
          e.preventDefault();
          store.seek(store.playback.duration);
          break;

        case "KeyS":
          if (!e.ctrlKey && !e.metaKey && store.selectedClipId && accessToken) {
            e.preventDefault();
            store.splitClip(store.selectedClipId, store.playback.currentTime, accessToken);
          }
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

        case "Slash":
          if (e.shiftKey) { // ? key
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
