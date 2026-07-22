import { useRef, useState } from "react"
import { Upload, Download, Plus, Trash2, AlignLeft } from "lucide-react"
import { useEditorStore, type LocalClip } from "@/store/editorStore"
import { useAuth } from "@/hooks/useAuth"

interface Caption {
  id: string
  startTime: number
  endTime: number
  text: string
}

function parseSRT(srt: string): Caption[] {
  const blocks = srt.trim().split(/\n\s*\n/)
  const captions: Caption[] = []
  for (const block of blocks) {
    const lines = block.trim().split("\n")
    if (lines.length < 3) continue
    const timeLine = lines[1]
    const match = timeLine.match(
      /(\d{2}):(\d{2}):(\d{2})[,.](\d{3})\s*-->\s*(\d{2}):(\d{2}):(\d{2})[,.](\d{3})/
    )
    if (!match) continue
    const toSec = (h: string, m: string, s: string, ms: string) =>
      parseInt(h) * 3600 + parseInt(m) * 60 + parseInt(s) + parseInt(ms) / 1000
    captions.push({
      id: crypto.randomUUID(),
      startTime: toSec(match[1], match[2], match[3], match[4]),
      endTime: toSec(match[5], match[6], match[7], match[8]),
      text: lines.slice(2).join("\n"),
    })
  }
  return captions
}

function toSRT(captions: Caption[]): string {
  const pad = (n: number, len = 2) => String(n).padStart(len, "0")
  const fmt = (s: number) => {
    const h = Math.floor(s / 3600)
    const m = Math.floor((s % 3600) / 60)
    const sec = Math.floor(s % 60)
    const ms = Math.round((s % 1) * 1000)
    return `${pad(h)}:${pad(m)}:${pad(sec)},${pad(ms, 3)}`
  }
  return captions
    .map((c, i) => `${i + 1}\n${fmt(c.startTime)} --> ${fmt(c.endTime)}\n${c.text}`)
    .join("\n\n")
}

function fmtTime(s: number) {
  const m = Math.floor(s / 60)
  const sec = (s % 60).toFixed(1)
  return `${m}:${sec.padStart(4, "0")}`
}

export function SubtitlePanel() {
  const { accessToken } = useAuth()
  const addClipLocal = useEditorStore((s) => s.addClipLocal)
  const syncAddClip = useEditorStore((s) => s.syncAddClip)
  const currentTime = useEditorStore((s) => s.playback.currentTime)

  const [captions, setCaptions] = useState<Caption[]>([])
  const [editingId, setEditingId] = useState<string | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  const importSRT = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = (ev) => {
      const parsed = parseSRT(ev.target?.result as string)
      setCaptions(parsed)
    }
    reader.readAsText(file)
    e.target.value = ""
  }

  const exportSRT = () => {
    const blob = new Blob([toSRT(captions)], { type: "text/plain" })
    const a = document.createElement("a")
    a.href = URL.createObjectURL(blob)
    a.download = "subtitles.srt"
    a.click()
    URL.revokeObjectURL(a.href)
  }

  const addCaption = () => {
    const newCap: Caption = {
      id: crypto.randomUUID(),
      startTime: currentTime,
      endTime: currentTime + 3,
      text: "New caption",
    }
    setCaptions((prev) => [...prev, newCap].sort((a, b) => a.startTime - b.startTime))
    setEditingId(newCap.id)
  }

  const updateCaption = (id: string, patch: Partial<Caption>) => {
    setCaptions((prev) => prev.map((c) => (c.id === id ? { ...c, ...patch } : c)))
  }

  const removeCaption = (id: string) => {
    setCaptions((prev) => prev.filter((c) => c.id !== id))
  }

  const addAllToTimeline = async () => {
    if (!accessToken) return
    for (const cap of captions) {
      const clip: LocalClip = {
        id: `tmp_${crypto.randomUUID()}`,
        mediaId: "",
        type: "text",
        startTime: cap.startTime,
        duration: cap.endTime - cap.startTime,
        track: 2,
        trimStart: 0,
        trimEnd: cap.endTime - cap.startTime,
        volume: 0,
        effects: [],
        metadata: {
          text: cap.text,
          fontSize: 20,
          fontWeight: "normal",
          color: "#ffffff",
          x: 50,
          y: 88,
        },
      }
      addClipLocal(clip)
      await syncAddClip(clip, accessToken)
    }
  }

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-between border-b border-border/60 px-3 py-2.5">
        <span className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
          Subtitles
        </span>
        <div className="flex items-center gap-1">
          <button
            onClick={() => fileRef.current?.click()}
            className="rounded p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
            title="Import SRT"
          >
            <Upload className="size-3.5" />
          </button>
          {captions.length > 0 && (
            <button
              onClick={exportSRT}
              className="rounded p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
              title="Export SRT"
            >
              <Download className="size-3.5" />
            </button>
          )}
        </div>
      </div>

      <input ref={fileRef} type="file" accept=".srt,.vtt" className="hidden" onChange={importSRT} />

      <div className="min-h-0 flex-1 overflow-y-auto p-2">
        {captions.length === 0 ? (
          <div className="flex h-full flex-col items-center justify-center gap-3 px-4 text-center">
            <AlignLeft className="size-8 text-muted-foreground/30" />
            <div>
              <p className="text-[12px] font-medium text-foreground">No subtitles</p>
              <p className="mt-0.5 text-[10px] text-muted-foreground">Import an SRT file or add captions manually</p>
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => fileRef.current?.click()}
                className="flex items-center gap-1.5 rounded-md border border-border bg-background px-3 py-1.5 text-[11px] hover:bg-muted"
              >
                <Upload className="size-3" /> Import SRT
              </button>
              <button
                onClick={addCaption}
                className="flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-[11px] font-medium text-primary-foreground hover:opacity-90"
              >
                <Plus className="size-3" /> Add
              </button>
            </div>
          </div>
        ) : (
          <div className="space-y-1.5">
            <div className="flex items-center justify-between pb-1">
              <span className="text-[10px] text-muted-foreground">{captions.length} captions</span>
              <div className="flex gap-1">
                <button
                  onClick={addCaption}
                  className="flex items-center gap-1 rounded px-2 py-0.5 text-[10px] text-muted-foreground hover:bg-muted hover:text-foreground"
                >
                  <Plus className="size-3" /> Add
                </button>
                <button
                  onClick={addAllToTimeline}
                  disabled={!accessToken}
                  className="flex items-center gap-1 rounded bg-primary/10 px-2 py-0.5 text-[10px] text-primary hover:bg-primary/20 disabled:opacity-50"
                >
                  → Timeline
                </button>
              </div>
            </div>

            {captions.map((cap) => (
              <div
                key={cap.id}
                className={`rounded-md border bg-card p-2 ${editingId === cap.id ? "border-primary/50" : "border-border/60"}`}
              >
                <div className="mb-1.5 flex items-center gap-1.5">
                  <span className="font-mono text-[9px] text-muted-foreground">
                    {fmtTime(cap.startTime)}
                  </span>
                  <span className="text-[9px] text-muted-foreground/40">→</span>
                  <span className="font-mono text-[9px] text-muted-foreground">
                    {fmtTime(cap.endTime)}
                  </span>
                  <button
                    onClick={() => setEditingId(editingId === cap.id ? null : cap.id)}
                    className="ml-auto rounded px-1.5 py-0.5 text-[9px] text-muted-foreground hover:bg-muted"
                  >
                    {editingId === cap.id ? "Done" : "Edit"}
                  </button>
                  <button
                    onClick={() => removeCaption(cap.id)}
                    className="rounded p-0.5 text-muted-foreground/40 hover:text-red-400"
                  >
                    <Trash2 className="size-3" />
                  </button>
                </div>

                {editingId === cap.id ? (
                  <div className="space-y-1.5">
                    <textarea
                      value={cap.text}
                      onChange={(e) => updateCaption(cap.id, { text: e.target.value })}
                      rows={2}
                      className="w-full resize-none rounded border border-border bg-background px-2 py-1 text-[11px] text-foreground outline-none focus:border-primary"
                    />
                    <div className="grid grid-cols-2 gap-1.5">
                      <div>
                        <label className="mb-0.5 block text-[9px] text-muted-foreground">Start (s)</label>
                        <input
                          type="number"
                          step="0.1"
                          value={cap.startTime.toFixed(1)}
                          onChange={(e) => updateCaption(cap.id, { startTime: parseFloat(e.target.value) })}
                          className="w-full rounded border border-border bg-background px-2 py-1 text-[11px] outline-none focus:border-primary"
                        />
                      </div>
                      <div>
                        <label className="mb-0.5 block text-[9px] text-muted-foreground">End (s)</label>
                        <input
                          type="number"
                          step="0.1"
                          value={cap.endTime.toFixed(1)}
                          onChange={(e) => updateCaption(cap.id, { endTime: parseFloat(e.target.value) })}
                          className="w-full rounded border border-border bg-background px-2 py-1 text-[11px] outline-none focus:border-primary"
                        />
                      </div>
                    </div>
                  </div>
                ) : (
                  <p className="text-[11px] text-foreground">{cap.text}</p>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
