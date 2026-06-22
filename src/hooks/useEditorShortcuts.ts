import { useEffect } from "react"
import { useEditorStore } from "@/store/editorStore"
import { useAuth } from "@/hooks/useAuth"

/**
 * Global editor keyboard shortcuts:
 *  - Space: play / pause
 *  - Left / Right: seek ±1 second
 *  - Shift + Left / Right: seek ±5 seconds
 *  - Delete / Backspace: delete selected clip
 *  - Escape: deselect clip
 *  - Home: rewind to start
 *  - End: jump to end
 *  - + / -: zoom in / out
 */
export function useEditorShortcuts() {
  const { accessToken } = useAuth()
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null
      if (
        target &&
        (target.tagName === "INPUT" ||
          target.tagName === "TEXTAREA" ||
          target.tagName === "SELECT" ||
          target.isContentEditable)
      ) {
        return
      }

      const store = useEditorStore.getState()
      switch (e.code) {
        case "Space":
          e.preventDefault()
          if (store.playback.isPlaying) store.pause()
          else store.play()
          break
        case "ArrowLeft":
          e.preventDefault()
          store.seek(
            Math.max(0, store.playback.currentTime - (e.shiftKey ? 5 : 1)),
          )
          break
        case "ArrowRight":
          e.preventDefault()
          store.seek(
            Math.min(
              store.playback.duration,
              store.playback.currentTime + (e.shiftKey ? 5 : 1),
            ),
          )
          break
        case "Home":
          e.preventDefault()
          store.seek(0)
          break
        case "End":
          e.preventDefault()
          store.seek(store.playback.duration)
          break
        case "Delete":
        case "Backspace": {
          if (store.selectedClipId && accessToken) {
            e.preventDefault()
            store.syncDeleteClip(store.selectedClipId, accessToken)
            store.selectClip(null)
          }
          break
        }
        case "Escape":
          store.selectClip(null)
          break
        case "Equal":
        case "NumpadAdd":
          e.preventDefault()
          store.setZoom(Math.min(4, store.zoom + 0.25))
          break
        case "Minus":
        case "NumpadSubtract":
          e.preventDefault()
          store.setZoom(Math.max(0.25, store.zoom - 0.25))
          break
      }
    }
    window.addEventListener("keydown", handler)
    return () => window.removeEventListener("keydown", handler)
  }, [accessToken])
}