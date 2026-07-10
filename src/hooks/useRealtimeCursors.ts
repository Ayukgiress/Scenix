import { useEffect, useState } from "react"
import { realtimeService, type RemoteCursor } from "@/services/realtimeService"
import { useEditorStore } from "@/store/editorStore"

export function useRealtimeCursors() {
  const [cursors, setCursors] = useState<Map<string, RemoteCursor>>(new Map())
  const currentTime = useEditorStore((s) => s.playback.currentTime)
  const selectedClipId = useEditorStore((s) => s.selectedClipId)

  // Subscribe to remote cursor updates
  useEffect(() => {
    return realtimeService.subscribeCursors(setCursors)
  }, [])

  // Broadcast our own cursor position whenever it changes
  useEffect(() => {
    realtimeService.broadcastCursor({ currentTime, selectedClipId })
  }, [currentTime, selectedClipId])

  return cursors
}
