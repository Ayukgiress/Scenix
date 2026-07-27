import { useEffect } from "react"
import { useEditorStore } from "@/store/editorStore"

// Lightweight hook for components that need to drive a <video> element
// from the store's playback state without owning the RAF loop.
// PreviewPanel owns the RAF loop; this hook just syncs currentTime to the element.
export function usePlaybackEngine(videoRef: React.RefObject<HTMLVideoElement | null>) {
  const isPlaying = useEditorStore((state) => state.playback.isPlaying)
  const currentTime = useEditorStore((state) => state.playback.currentTime)

  useEffect(() => {
    const video = videoRef.current
    if (!video) return
    if (Math.abs(video.currentTime - currentTime) > 0.2) {
      try { video.currentTime = currentTime } catch { /* not ready */ }
    }
  }, [currentTime, videoRef])

  useEffect(() => {
    const video = videoRef.current
    if (!video) return
    if (isPlaying) {
      video.play().catch((e) => { if (e.name !== "AbortError") console.warn("video play:", e) })
    } else {
      video.pause()
    }
  }, [isPlaying, videoRef])
}
