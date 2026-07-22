import { useRef, useState, useCallback, useEffect } from "react";
import {
  Play,
  Pause,
  Scissors,
  ZoomIn,
  ZoomOut,
  Plus,
  Trash2,
  Video,
  Music,
  Type,
  Image as ImageIcon,
  Layers,
} from "lucide-react";
import WaveSurfer from "wavesurfer.js";
import { useEditorStore, type LocalClip } from "@/store/editorStore";
import { useAuth } from "@/hooks/useAuth";
import { useRealtimeCursors } from "@/hooks/useRealtimeCursors";

const PIXEL_PER_SECOND = 50;
const TRACK_HEIGHT = 56;
const SNAP_THRESHOLD_PX = 8;

export interface TrackConfig {
  label: string;
  type: "video" | "audio" | "text" | "image";
  color: string;
}

const DEFAULT_TRACKS: TrackConfig[] = [
  { label: "Video 1", type: "video", color: "oklch(0.55 0.18 280)" },
  { label: "Video 2", type: "video", color: "oklch(0.52 0.16 260)" },
  { label: "Text", type: "text", color: "oklch(0.55 0.14 140)" },
  { label: "Audio", type: "audio", color: "oklch(0.52 0.18 160)" },
];

function formatTime(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  const ms = Math.floor((seconds % 1) * 10);
  return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}.${ms}`;
}

function TrackTypeIcon({ type }: { type: string }) {
  const cls = "size-3 shrink-0";
  if (type === "video") return <Video className={cls} />;
  if (type === "audio") return <Music className={cls} />;
  if (type === "text") return <Type className={cls} />;
  if (type === "image") return <ImageIcon className={cls} />;
  return <Layers className={cls} />;
}

// Real waveform rendered via WaveSurfer into a hidden container, then drawn on canvas
function AudioWaveformBar({ url, width }: { url?: string; width: number }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const wsRef = useRef<WaveSurfer | null>(null);

  useEffect(() => {
    if (!containerRef.current || !url) return;
    const ws = WaveSurfer.create({
      container: containerRef.current,
      waveColor: "rgba(255,255,255,0.55)",
      progressColor: "rgba(255,255,255,0.2)",
      height: TRACK_HEIGHT - 14,
      barWidth: 2,
      barGap: 1,
      barRadius: 2,
      interact: false,
      normalize: true,
      backend: "WebAudio",
    });
    wsRef.current = ws;
    ws.load(url).catch(() => {});
    return () => {
      ws.destroy();
      wsRef.current = null;
    };
  }, [url]);

  useEffect(() => {
    if (wsRef.current) {
      // WaveSurfer v7 uses setOptions for width
      try {
        (
          wsRef.current as unknown as { setOptions: (o: object) => void }
        ).setOptions({ width });
      } catch {
        /* ignore */
      }
    }
  }, [width]);

  return (
    <div
      ref={containerRef}
      className="absolute inset-0 overflow-hidden rounded-md opacity-80"
      style={{ pointerEvents: "none" }}
    />
  );
}

// Video thumbnail strip — draws frames from a video element onto a canvas
function VideoThumbnailStrip({ url, width }: { url?: string; width: number }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    if (!url || !canvasRef.current) return;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const video = document.createElement("video");
    video.src = url;
    video.muted = true;
    video.preload = "metadata";
    video.crossOrigin = "anonymous";

    const thumbW = 48;
    const thumbH = TRACK_HEIGHT - 14;
    const count = Math.max(1, Math.floor(width / thumbW));
    canvas.width = count * thumbW;
    canvas.height = thumbH;

    video.addEventListener(
      "loadedmetadata",
      () => {
        const dur = video.duration;
        if (!isFinite(dur) || dur <= 0) return;
        let drawn = 0;

        const drawFrame = (i: number) => {
          if (i >= count) return;
          video.currentTime = (i / count) * dur;
        };

        video.addEventListener(
          "seeked",
          () => {
            ctx.drawImage(video, drawn * thumbW, 0, thumbW, thumbH);
            drawn++;
            if (drawn < count) drawFrame(drawn);
          },
          { once: false },
        );

        drawFrame(0);
      },
      { once: true },
    );

    video.load();
    return () => {
      video.src = "";
    };
  }, [url, width]);

  return (
    <canvas
      ref={canvasRef}
      className="absolute inset-0 h-full w-full object-cover rounded-md opacity-60"
      style={{ pointerEvents: "none" }}
    />
  );
}

function ClipElement({
  clip,
  zoom,
  tracks,
  snapPoints,
}: {
  clip: LocalClip;
  zoom: number;
  tracks: TrackConfig[];
  snapPoints: number[];
}) {
  const updateClipLocal = useEditorStore((s) => s.updateClipLocal);
  const syncUpdateClip = useEditorStore((s) => s.syncUpdateClip);
  const selectClip = useEditorStore((s) => s.selectClip);
  const selectedClipId = useEditorStore((s) => s.selectedClipId);
  const syncDeleteClip = useEditorStore((s) => s.syncDeleteClip);
  const pushHistory = useEditorStore((s) => s.pushHistory);
  const { accessToken } = useAuth();

  const [isDragging, setIsDragging] = useState(false);
  const [isResizing, setIsResizing] = useState<"left" | "right" | null>(null);
  const dragStartRef = useRef({
    x: 0,
    y: 0,
    startTime: 0,
    duration: 0,
    trimStart: 0,
    track: 0,
  });

  const isSelected = selectedClipId === clip.id;
  const width = Math.max(8, clip.duration * PIXEL_PER_SECOND * zoom);
  const left = clip.startTime * PIXEL_PER_SECOND * zoom;
  const trackCfg = tracks[clip.track] ?? tracks[0];

  // Snap a pixel value to the nearest snap point (returns snapped px)
  const snapPx = useCallback(
    (px: number): number => {
      for (const sp of snapPoints) {
        const spPx = sp * PIXEL_PER_SECOND * zoom;
        if (Math.abs(px - spPx) <= SNAP_THRESHOLD_PX) return spPx;
      }
      return px;
    },
    [snapPoints, zoom],
  );

  const startInteraction = (
    e: React.MouseEvent,
    action: "drag" | "resize-left" | "resize-right",
  ) => {
    e.stopPropagation();
    e.preventDefault();
    selectClip(clip.id);
    pushHistory();
    dragStartRef.current = {
      x: e.clientX,
      y: e.clientY,
      startTime: clip.startTime,
      duration: clip.duration,
      trimStart: clip.trimStart ?? 0,
      track: clip.track,
    };
    if (action === "drag") setIsDragging(true);
    else setIsResizing(action === "resize-left" ? "left" : "right");
  };

  const handleMouseMove = useCallback(
    (e: MouseEvent) => {
      const dx = e.clientX - dragStartRef.current.x;
      const dy = e.clientY - dragStartRef.current.y;
      const timeDelta = dx / (PIXEL_PER_SECOND * zoom);

      if (isDragging) {
        const rawPx =
          (dragStartRef.current.startTime + timeDelta) *
          PIXEL_PER_SECOND *
          zoom;
        const snappedPx = snapPx(Math.max(0, rawPx));
        const newStartTime = snappedPx / (PIXEL_PER_SECOND * zoom);

        // Vertical: determine new track from Y delta
        const trackDelta = Math.round(dy / TRACK_HEIGHT);
        const newTrack = Math.max(
          0,
          Math.min(tracks.length - 1, dragStartRef.current.track + trackDelta),
        );

        updateClipLocal(clip.id, { startTime: newStartTime, track: newTrack });
      } else if (isResizing === "left") {
        const newStartTime = Math.max(
          0,
          dragStartRef.current.startTime + timeDelta,
        );
        const newDuration = dragStartRef.current.duration - timeDelta;
        if (newDuration > 0.1) {
          const newTrimStart = Math.max(
            0,
            dragStartRef.current.trimStart + timeDelta,
          );
          updateClipLocal(clip.id, {
            startTime: newStartTime,
            duration: newDuration,
            trimStart: newTrimStart,
          });
        }
      } else if (isResizing === "right") {
        const newDuration = Math.max(
          0.1,
          dragStartRef.current.duration + timeDelta,
        );
        const newTrimEnd =
          (clip.trimEnd ?? dragStartRef.current.duration) + timeDelta;
        updateClipLocal(clip.id, {
          duration: newDuration,
          trimEnd: newTrimEnd,
        });
      }
    },
    [
      isDragging,
      isResizing,
      clip.id,
      clip.trimEnd,
      updateClipLocal,
      zoom,
      snapPx,
      tracks.length,
    ],
  );

  const handleMouseUp = useCallback(() => {
    // Only sync to server on mouseup — not on every move
    if ((isDragging || isResizing) && accessToken) {
      const store = useEditorStore.getState();
      const current = store.clips.find((c) => c.id === clip.id);
      if (current) {
        syncUpdateClip(
          clip.id,
          {
            startTime: current.startTime,
            duration: current.duration,
            track: current.track,
            trimStart: current.trimStart,
            trimEnd: current.trimEnd,
          },
          accessToken,
        );
      }
    }
    setIsDragging(false);
    setIsResizing(null);
  }, [isDragging, isResizing, clip.id, syncUpdateClip, accessToken]);

  useEffect(() => {
    if (isDragging || isResizing) {
      document.addEventListener("mousemove", handleMouseMove);
      document.addEventListener("mouseup", handleMouseUp);
      return () => {
        document.removeEventListener("mousemove", handleMouseMove);
        document.removeEventListener("mouseup", handleMouseUp);
      };
    }
  }, [isDragging, isResizing, handleMouseMove, handleMouseUp]);

  let clipLabel: string = clip.type;
  if (clip.type === "text" && clip.metadata?.text) {
    clipLabel = String(clip.metadata.text);
  }

  return (
    <div
      data-clip
      className={`group absolute rounded-md transition-shadow select-none ${
        isSelected
          ? "ring-2 ring-white ring-offset-1 ring-offset-transparent shadow-lg z-10"
          : "shadow-sm"
      } ${isDragging || isResizing ? "cursor-grabbing opacity-90" : "cursor-grab"} ${clip.syncing ? "opacity-60" : ""}`}
      style={{
        left: `${left}px`,
        width: `${width}px`,
        height: `${TRACK_HEIGHT - 10}px`,
        background: trackCfg.color,
        top: "5px",
      }}
      onMouseDown={(e) => startInteraction(e, "drag")}
    >
      {/* Resize handle left */}
      <div
        className="absolute left-0 top-0 h-full w-2 cursor-ew-resize rounded-l-md bg-white/20 opacity-0 transition-opacity hover:opacity-100 z-20"
        onMouseDown={(e) => startInteraction(e, "resize-left")}
      />
      {/* Resize handle right */}
      <div
        className="absolute right-0 top-0 h-full w-2 cursor-ew-resize rounded-r-md bg-white/20 opacity-0 transition-opacity hover:opacity-100 z-20"
        onMouseDown={(e) => startInteraction(e, "resize-right")}
      />

      {/* Thumbnail strip for video */}
      {clip.type === "video" && clip.url && width > 40 && (
        <VideoThumbnailStrip url={clip.url} width={width} />
      )}

      {/* Real waveform for audio */}
      {clip.type === "audio" && clip.url && (
        <AudioWaveformBar url={clip.url} width={width} />
      )}

      {/* Clip label */}
      <div className="relative flex h-full items-center gap-1 overflow-hidden px-2 z-10">
        <div className="size-1.5 shrink-0 rounded-full bg-white/60" />
        <span className="truncate text-[10px] font-medium text-white drop-shadow">
          {clipLabel}
        </span>
        {clip.speed && clip.speed !== 1 && (
          <span className="shrink-0 rounded bg-black/40 px-1 py-0.5 text-[8px] font-bold text-yellow-300">
            {clip.speed}x
          </span>
        )}
        {clip.keyframes && clip.keyframes.length > 0 && (
          <span className="shrink-0 text-[8px] text-white/60" title={`${clip.keyframes.length} keyframes`}>
            ◆{clip.keyframes.length}
          </span>
        )}
        {clip.chromaKey?.enabled && (
          <span className="shrink-0 rounded bg-green-500/30 px-1 py-0.5 text-[8px] text-green-300" title="Chroma key active">
            CK
          </span>
        )}
        <span className="ml-auto shrink-0 text-[9px] text-white/60">
          {formatTime(clip.duration)}
        </span>
        <button
          onClick={(e) => {
            e.stopPropagation();
            if (accessToken) syncDeleteClip(clip.id, accessToken);
          }}
          className="ml-0.5 rounded p-0.5 text-white/50 opacity-0 transition-opacity hover:bg-white/10 hover:text-white group-hover:opacity-100"
          title="Delete clip"
        >
          <Trash2 className="size-2.5" />
        </button>
      </div>
    </div>
  );
}

export function Timeline() {
  const timelineRef = useRef<HTMLDivElement>(null);
  const clips = useEditorStore((s) => s.clips);
  const currentTime = useEditorStore((s) => s.playback.currentTime);
  const duration = useEditorStore((s) => s.playback.duration);
  const seek = useEditorStore((s) => s.seek);
  const zoom = useEditorStore((s) => s.zoom);
  const setZoom = useEditorStore((s) => s.setZoom);
  const selectClip = useEditorStore((s) => s.selectClip);
  const togglePlay = useEditorStore((s) => s.togglePlay);
  const isPlaying = useEditorStore((s) => s.playback.isPlaying);
  const selectedClipId = useEditorStore((s) => s.selectedClipId);
  const splitClip = useEditorStore((s) => s.splitClip);
  const canUndo = useEditorStore((s) => s.canUndo);
  const canRedo = useEditorStore((s) => s.canRedo);
  const undo = useEditorStore((s) => s.undo);
  const redo = useEditorStore((s) => s.redo);
  const { accessToken } = useAuth();

  const remoteCursors = useRealtimeCursors();

  const [tracks, setTracks] = useState<TrackConfig[]>(DEFAULT_TRACKS);

  const visibleSeconds = Math.max(duration, 30);
  const timelineWidth = Math.max(
    visibleSeconds * PIXEL_PER_SECOND * zoom,
    1000,
  );
  const rulerHeight = 28;
  const tracksHeight = tracks.length * TRACK_HEIGHT;

  // Snap points: playhead + all clip start/end times
  const snapPoints = [
    currentTime,
    ...clips.flatMap((c) => [c.startTime, c.startTime + c.duration]),
  ];

  const handleTimelineClick = (e: React.MouseEvent<HTMLDivElement>) => {
    const target = e.target as HTMLElement;
    if (target.closest("[data-clip]") || target.closest("[data-track-label]"))
      return;
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left + (e.currentTarget.scrollLeft || 0);
    seek(Math.max(0, x / (PIXEL_PER_SECOND * zoom)));
    selectClip(null);
  };

  // Auto-scroll playhead into view
  useEffect(() => {
    const container = timelineRef.current?.parentElement;
    if (!container) return;
    const playheadX = currentTime * PIXEL_PER_SECOND * zoom;
    const { scrollLeft, clientWidth } = container;
    if (playheadX < scrollLeft + 40) {
      container.scrollLeft = Math.max(0, playheadX - 40);
    } else if (playheadX > scrollLeft + clientWidth - 40) {
      container.scrollLeft = playheadX - clientWidth + 40;
    }
  }, [currentTime, zoom]);

  const addTrack = () => {
    setTracks((prev) => [
      ...prev,
      {
        label: `Video ${prev.filter((t) => t.type === "video").length + 1}`,
        type: "video" as const,
        color: "oklch(0.50 0.15 270)",
      },
    ]);
  };

  const removeTrack = (idx: number) => {
    if (tracks.length <= 1) return;
    // Don't remove a track that has clips
    if (clips.some((c) => c.track === idx)) return;
    setTracks((prev) => prev.filter((_, i) => i !== idx));
  };

  return (
    <div
      className="flex shrink-0 flex-col border-t border-border/60 bg-[#0f0f11]"
      style={{ height: `${rulerHeight + tracksHeight + 44}px` }}
    >
      {/* Toolbar */}
      <div className="flex h-11 shrink-0 items-center justify-between border-b border-border/60 bg-card/60 px-3">
        <div className="flex items-center gap-2">
          {/* Play/Pause */}
          <button
            onClick={togglePlay}
            className="grid size-7 place-items-center rounded-full bg-primary text-primary-foreground hover:opacity-90"
            title={isPlaying ? "Pause (Space)" : "Play (Space)"}
          >
            {isPlaying ? (
              <Pause className="size-3.5" />
            ) : (
              <Play className="size-3.5" />
            )}
          </button>

          {/* Split */}
          <button
            onClick={() => {
              if (selectedClipId && accessToken)
                splitClip(selectedClipId, currentTime, accessToken);
            }}
            disabled={!selectedClipId}
            className="grid size-7 place-items-center rounded-full bg-muted text-muted-foreground hover:bg-muted/80 disabled:opacity-40"
            title="Split at playhead (S)"
          >
            <Scissors className="size-3.5" />
          </button>

          {/* Undo / Redo */}
          <button
            onClick={undo}
            disabled={!canUndo}
            className="rounded px-1.5 py-1 text-[10px] text-muted-foreground hover:bg-muted disabled:opacity-30"
            title="Undo (Ctrl+Z)"
          >
            ↩
          </button>
          <button
            onClick={redo}
            disabled={!canRedo}
            className="rounded px-1.5 py-1 text-[10px] text-muted-foreground hover:bg-muted disabled:opacity-30"
            title="Redo (Ctrl+Shift+Z)"
          >
            ↪
          </button>

          {isPlaying && (
            <span className="size-2 rounded-full bg-[var(--scrubber)] animate-pulse" />
          )}

          <span className="rounded bg-muted px-2 py-1 font-mono text-[10px] text-foreground">
            {formatTime(currentTime)}
          </span>
          <span className="text-[10px] text-muted-foreground">/</span>
          <span className="rounded bg-muted px-2 py-1 font-mono text-[10px] text-foreground">
            {formatTime(duration)}
          </span>
        </div>

        <div className="flex items-center gap-1">
          {/* Add track */}
          <button
            onClick={addTrack}
            className="flex items-center gap-1 rounded px-2 py-1 text-[10px] text-muted-foreground hover:bg-muted hover:text-foreground"
            title="Add track"
          >
            <Plus className="size-3" />
            Track
          </button>

          {/* Zoom */}
          <button
            onClick={() => setZoom(zoom - 0.25)}
            className="rounded p-1.5 text-foreground/70 hover:bg-muted"
            title="Zoom out (-)"
          >
            <ZoomOut className="size-3" />
          </button>
          <span className="w-10 text-center text-[11px] text-muted-foreground">
            {Math.round(zoom * 100)}%
          </span>
          <button
            onClick={() => setZoom(zoom + 0.25)}
            className="rounded p-1.5 text-foreground/70 hover:bg-muted"
            title="Zoom in (+)"
          >
            <ZoomIn className="size-3" />
          </button>
        </div>
      </div>

      {/* Tracks area */}
      <div className="flex min-h-0 flex-1 overflow-x-auto overflow-y-hidden">
        {/* Track labels */}
        <div
          className="flex w-20 shrink-0 flex-col border-r border-border/60 bg-card/80"
          style={{ paddingTop: `${rulerHeight}px` }}
        >
          {tracks.map((track, i) => (
            <div
              key={i}
              data-track-label
              className="group flex items-center justify-between border-b border-border/40 px-2 text-muted-foreground"
              style={{ height: `${TRACK_HEIGHT}px` }}
            >
              <div className="flex items-center gap-1.5 min-w-0">
                <TrackTypeIcon type={track.type} />
                <span className="truncate text-[9px] font-medium">
                  {track.label}
                </span>
              </div>
              {!clips.some((c) => c.track === i) && tracks.length > 1 && (
                <button
                  onClick={() => removeTrack(i)}
                  className="opacity-0 group-hover:opacity-100 rounded p-0.5 text-muted-foreground/50 hover:text-red-400 transition-opacity"
                  title="Remove empty track"
                >
                  <Trash2 className="size-2.5" />
                </button>
              )}
            </div>
          ))}
        </div>

        {/* Scrollable timeline */}
        <div
          ref={timelineRef}
          className="relative flex-1"
          onClick={handleTimelineClick}
        >
          {/* Ruler */}
          <div
            className="sticky top-0 z-10 border-b border-border/40 bg-[#0f0f11]"
            style={{ width: `${timelineWidth}px`, height: `${rulerHeight}px` }}
          >
            {Array.from({ length: Math.ceil(visibleSeconds) + 1 }).map(
              (_, i) => (
                <div
                  key={i}
                  className="absolute top-0 flex h-full flex-col justify-end border-l border-border/30"
                  style={{ left: `${i * PIXEL_PER_SECOND * zoom}px` }}
                >
                  <span className="mb-1 ml-1 text-[9px] text-muted-foreground/70">
                    {i}s
                  </span>
                </div>
              ),
            )}
            {/* Half-second ticks */}
            {Array.from({ length: Math.ceil(visibleSeconds * 2) + 1 }).map(
              (_, i) =>
                i % 2 !== 0 ? (
                  <div
                    key={`h${i}`}
                    className="absolute bottom-0 h-1.5 w-px bg-border/20"
                    style={{ left: `${i * 0.5 * PIXEL_PER_SECOND * zoom}px` }}
                  />
                ) : null,
            )}
          </div>

          {/* Track rows */}
          <div
            style={{ width: `${timelineWidth}px`, height: `${tracksHeight}px` }}
          >
            {tracks.map((track, trackIdx) => (
              <div
                key={trackIdx}
                className="relative border-b border-border/20"
                style={{ height: `${TRACK_HEIGHT}px` }}
              >
                {/* Grid lines */}
                {Array.from({ length: Math.ceil(visibleSeconds) + 1 }).map(
                  (_, i) => (
                    <div
                      key={i}
                      className="absolute top-0 h-full w-px bg-border/10"
                      style={{ left: `${i * PIXEL_PER_SECOND * zoom}px` }}
                    />
                  ),
                )}

                {/* Empty track hint */}
                {clips.filter((c) => c.track === trackIdx).length === 0 && (
                  <div className="pointer-events-none absolute inset-0 flex items-center px-3">
                    <span className="text-[9px] text-muted-foreground/25">
                      {track.label} — drag clips here
                    </span>
                  </div>
                )}

                {clips
                  .filter((c) => c.track === trackIdx)
                  .map((clip) => (
                    <ClipElement
                      key={clip.id}
                      clip={clip}
                      zoom={zoom}
                      tracks={tracks}
                      snapPoints={snapPoints}
                    />
                  ))}
              </div>
            ))}
          </div>

          {/* Playhead */}
          <div
            className="pointer-events-none absolute top-0 z-20 w-0.5 bg-[var(--scrubber)] shadow-[0_0_6px_var(--scrubber)]"
            style={{
              left: `${currentTime * PIXEL_PER_SECOND * zoom}px`,
              height: `${rulerHeight + tracksHeight}px`,
            }}
          >
            <div className="absolute -top-0 left-1/2 h-3 w-3 -translate-x-1/2 rotate-45 bg-[var(--scrubber)]" />
          </div>

          {/* Remote cursor playheads */}
          {Array.from(remoteCursors.values()).map((cursor) => (
            <div
              key={cursor.userId}
              className="pointer-events-none absolute top-0 z-20 w-0.5"
              style={{
                left: `${cursor.currentTime * PIXEL_PER_SECOND * zoom}px`,
                height: `${rulerHeight + tracksHeight}px`,
                background: cursor.color,
                opacity: 0.7,
              }}
            >
              <div
                className="absolute -top-0 left-1/2 -translate-x-1/2 whitespace-nowrap rounded px-1 py-0.5 text-[8px] font-medium text-white"
                style={{ background: cursor.color }}
              >
                {cursor.name}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
