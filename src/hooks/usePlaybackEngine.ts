import { useEffect, useRef } from "react"
import { useEditorStore } from "@/store/editorStore"

export function usePlaybackEngine(videoRef: React.RefObject<HTMLVideoElement>) {
  const isPlaying = useEditorStore((state) => state.playback.isPlaying)
  const currentTime = useEditorStore((state) => state.playback.currentTime)
  const setCurrentTime = useEditorStore((state) => state.setCurrentTime)
  const pause = useEditorStore((state) => state.pause)
  const duration = useEditorStore((state) => state.playback.duration)

  const rafRef = useRef<number>()
  const lastTimeRef = useRef(0)

  useEffect(() => {
    if (!videoRef.current) return

    if (isPlaying) {
      const animate = () => {
        const now = performance.now()
        const delta = (now - lastTimeRef.current) / 1000

        if (delta > 0) {
          const newTime = currentTime + delta
          
          if (newTime >= duration) {
            pause()
            setCurrentTime(0)
          } else {
            setCurrentTime(newTime)
          }
        }

        lastTimeRef.current = now
        rafRef.current = requestAnimationFrame(animate)
      }

      lastTimeRef.current = performance.now()
      rafRef.current = requestAnimationFrame(animate)
    } else {
      if (rafRef.current) {
        cancelAnimationFrame(rafRef.current)
      }
    }

    return () => {
      if (rafRef.current) {
        cancelAnimationFrame(rafRef.current)
      }
    }
  }, [isPlaying, currentTime, duration, pause, setCurrentTime, videoRef])

  // Sync video element with timeline
  useEffect(() => {
    if (videoRef.current) {
      videoRef.current.currentTime = currentTime
    }
  }, [currentTime, videoRef])
}
