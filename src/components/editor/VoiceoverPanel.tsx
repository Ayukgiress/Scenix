import { useRef, useState, useEffect, useCallback } from "react"
import { Mic, MicOff, Square, Play, Pause, Plus, Trash2 } from "lucide-react"
import { useEditorStore, type LocalClip } from "@/store/editorStore"
import { useAuth } from "@/hooks/useAuth"
import { api, uploadToCloudinary } from "@/lib/api"

interface Recording {
  id: string
  blob: Blob
  url: string
  duration: number
  name: string
}

function fmtTime(s: number) {
  const m = Math.floor(s / 60)
  return `${m}:${Math.floor(s % 60).toString().padStart(2, "0")}`
}

export function VoiceoverPanel() {
  const { accessToken } = useAuth()
  const addClipLocal = useEditorStore((s) => s.addClipLocal)
  const syncAddClip = useEditorStore((s) => s.syncAddClip)
  const projectId = useEditorStore((s) => s.projectId)
  const clips = useEditorStore((s) => s.clips)
  const currentTime = useEditorStore((s) => s.playback.currentTime)

  const [recordings, setRecordings] = useState<Recording[]>([])
  const [isRecording, setIsRecording] = useState(false)
  const [recordingTime, setRecordingTime] = useState(0)
  const [previewId, setPreviewId] = useState<string | null>(null)
  const [uploadingId, setUploadingId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [level, setLevel] = useState(0)

  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const chunksRef = useRef<Blob[]>([])
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const previewAudioRef = useRef<HTMLAudioElement | null>(null)
  const analyserRef = useRef<AnalyserNode | null>(null)
  const animFrameRef = useRef<number>(0)
  const streamRef = useRef<MediaStream | null>(null)

  const stopLevelMeter = () => {
    cancelAnimationFrame(animFrameRef.current)
    setLevel(0)
  }

  const startLevelMeter = (stream: MediaStream) => {
    const ctx = new AudioContext()
    const src = ctx.createMediaStreamSource(stream)
    const analyser = ctx.createAnalyser()
    analyser.fftSize = 256
    src.connect(analyser)
    analyserRef.current = analyser
    const data = new Uint8Array(analyser.frequencyBinCount)
    const tick = () => {
      analyser.getByteFrequencyData(data)
      const avg = data.reduce((a, b) => a + b, 0) / data.length
      setLevel(avg / 128)
      animFrameRef.current = requestAnimationFrame(tick)
    }
    tick()
  }

  const startRecording = useCallback(async () => {
    setError(null)
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      streamRef.current = stream
      startLevelMeter(stream)

      const mr = new MediaRecorder(stream, { mimeType: "audio/webm" })
      mediaRecorderRef.current = mr
      chunksRef.current = []

      mr.ondataavailable = (e) => { if (e.data.size > 0) chunksRef.current.push(e.data) }
      mr.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: "audio/webm" })
        const url = URL.createObjectURL(blob)
        // Measure duration
        const audio = new Audio(url)
        audio.onloadedmetadata = () => {
          const duration = isFinite(audio.duration) ? audio.duration : recordingTime
          setRecordings((prev) => [
            ...prev,
            { id: crypto.randomUUID(), blob, url, duration, name: `Voiceover ${prev.length + 1}` },
          ])
        }
        stream.getTracks().forEach((t) => t.stop())
        streamRef.current = null
        stopLevelMeter()
      }

      mr.start(100)
      setIsRecording(true)
      setRecordingTime(0)
      timerRef.current = setInterval(() => setRecordingTime((t) => t + 1), 1000)
    } catch {
      setError("Microphone access denied. Please allow microphone permissions.")
    }
  }, [recordingTime])

  const stopRecording = useCallback(() => {
    mediaRecorderRef.current?.stop()
    if (timerRef.current) clearInterval(timerRef.current)
    setIsRecording(false)
  }, [])

  useEffect(() => () => {
    stopLevelMeter()
    if (timerRef.current) clearInterval(timerRef.current)
    streamRef.current?.getTracks().forEach((t) => t.stop())
    previewAudioRef.current?.pause()
  }, [])

  const togglePreview = (rec: Recording) => {
    if (previewId === rec.id) {
      previewAudioRef.current?.pause()
      setPreviewId(null)
      return
    }
    previewAudioRef.current?.pause()
    const audio = new Audio(rec.url)
    audio.onended = () => setPreviewId(null)
    audio.play().catch(() => {})
    previewAudioRef.current = audio
    setPreviewId(rec.id)
  }

  const addToTimeline = async (rec: Recording) => {
    if (!accessToken || !projectId) return
    setUploadingId(rec.id)
    try {
      const file = new File([rec.blob], `${rec.name}.webm`, { type: "audio/webm" })
      const sig = await api.createCloudinaryUpload(accessToken, { filename: file.name, type: "AUDIO" })
      const uploaded = await uploadToCloudinary(file, sig)
      const media = await api.createMedia(accessToken, {
        filename: file.name, type: "audio",
        size: rec.blob.size, url: uploaded.secure_url,
        projectId, duration: rec.duration,
      })
      const lastEnd = clips.filter((c) => c.type === "audio").reduce((m, c) => Math.max(m, c.startTime + c.duration), currentTime)
      const clip: LocalClip = {
        id: `tmp_${crypto.randomUUID()}`,
        mediaId: media.id,
        type: "audio",
        url: media.url,
        startTime: lastEnd,
        duration: rec.duration,
        track: 3,
        trimStart: 0,
        trimEnd: rec.duration,
        volume: 1,
        effects: [],
      }
      addClipLocal(clip)
      await syncAddClip(clip, accessToken)
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to upload recording")
    } finally {
      setUploadingId(null)
    }
  }

  const removeRecording = (id: string) => {
    if (previewId === id) { previewAudioRef.current?.pause(); setPreviewId(null) }
    setRecordings((prev) => prev.filter((r) => r.id !== id))
  }

  return (
    <div className="flex h-full flex-col">
      <div className="border-b border-border/60 px-3 py-2.5">
        <span className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">Voiceover</span>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto p-3">
        {error && (
          <div className="mb-3 rounded-md border border-red-500/20 bg-red-500/10 px-3 py-2 text-[10px] text-red-400">
            {error}
            <button onClick={() => setError(null)} className="ml-2 underline">dismiss</button>
          </div>
        )}

        {/* Record button */}
        <div className="mb-4 flex flex-col items-center gap-3">
          {/* Level meter */}
          <div className="flex h-3 w-full items-center gap-0.5 overflow-hidden rounded-full bg-muted/40">
            {Array.from({ length: 20 }).map((_, i) => (
              <div
                key={i}
                className={`h-full flex-1 rounded-sm transition-all ${
                  i / 20 < level
                    ? level > 0.8 ? "bg-red-400" : level > 0.5 ? "bg-yellow-400" : "bg-emerald-400"
                    : "bg-muted"
                }`}
              />
            ))}
          </div>

          <button
            onClick={isRecording ? stopRecording : startRecording}
            className={`flex size-16 items-center justify-center rounded-full transition-all ${
              isRecording
                ? "bg-red-500 text-white shadow-[0_0_20px_rgba(239,68,68,0.5)] hover:bg-red-600"
                : "bg-primary text-primary-foreground hover:opacity-90"
            }`}
          >
            {isRecording ? <Square className="size-6" /> : <Mic className="size-6" />}
          </button>

          {isRecording ? (
            <div className="flex items-center gap-2">
              <span className="size-2 animate-pulse rounded-full bg-red-400" />
              <span className="font-mono text-[13px] text-foreground">{fmtTime(recordingTime)}</span>
              <span className="text-[11px] text-muted-foreground">Recording…</span>
            </div>
          ) : (
            <p className="text-[11px] text-muted-foreground">Click to start recording</p>
          )}
        </div>

        {/* Recordings list */}
        {recordings.length > 0 && (
          <div className="space-y-2">
            <p className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
              Recordings ({recordings.length})
            </p>
            {recordings.map((rec) => (
              <div key={rec.id} className="rounded-lg border border-border/60 bg-card p-2.5">
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => togglePreview(rec)}
                    className={`grid size-7 shrink-0 place-items-center rounded-full transition-colors ${
                      previewId === rec.id
                        ? "bg-primary text-primary-foreground"
                        : "bg-primary/10 text-primary hover:bg-primary/20"
                    }`}
                  >
                    {previewId === rec.id ? <Pause className="size-3" /> : <Play className="size-3" />}
                  </button>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[11px] font-medium">{rec.name}</p>
                    <p className="text-[9px] text-muted-foreground">{fmtTime(rec.duration)}</p>
                  </div>
                  <button
                    onClick={() => addToTimeline(rec)}
                    disabled={!accessToken || !projectId || uploadingId === rec.id}
                    className="grid size-6 place-items-center rounded-md bg-primary/10 text-primary hover:bg-primary/20 disabled:opacity-40"
                    title="Add to timeline"
                  >
                    {uploadingId === rec.id
                      ? <span className="size-3 animate-spin rounded-full border border-primary border-t-transparent" />
                      : <Plus className="size-3.5" />
                    }
                  </button>
                  <button
                    onClick={() => removeRecording(rec.id)}
                    className="grid size-6 place-items-center rounded-md text-muted-foreground/40 hover:bg-red-500/10 hover:text-red-400"
                  >
                    <Trash2 className="size-3" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        {!isRecording && recordings.length === 0 && (
          <div className="mt-4 rounded-md border border-border/40 bg-muted/20 p-3">
            <div className="flex items-start gap-2">
              <MicOff className="mt-0.5 size-3.5 shrink-0 text-muted-foreground/50" />
              <p className="text-[10px] text-muted-foreground">
                Record voiceovers directly in the browser. Recordings are uploaded to your project and added to the audio track.
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
