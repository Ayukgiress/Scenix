/**
 * useAudioMixer
 *
 * Owns a single AudioContext and a per-clip node chain:
 *
 *   MediaElementSourceNode
 *     → GainNode          (clip volume)
 *     → StereoPannerNode  (clip pan)
 *     → [effect insert]   ← future EQ / compression nodes splice in here
 *     → GainNode          (master volume)
 *     → AudioContext.destination
 *
 * The "effect insert" is represented by `insertInput` / `insertOutput` refs
 * stored on each TrackNodes entry. To add an effect node later:
 *   insertOutput.disconnect(masterGain)
 *   insertOutput.connect(effectNode)
 *   effectNode.connect(masterGain)
 *
 * Sync strategy: subscribes directly to the Zustand store (same pattern as
 * useCompositor) so the audio engine never causes React re-renders.
 */

import { useEffect, useRef } from "react"
import { useEditorStore, type LocalClip } from "@/store/editorStore"

// ─── types ───────────────────────────────────────────────────────────────────

interface TrackNodes {
  source:    MediaElementSourceNode
  gainNode:  GainNode          // per-clip volume
  panner:    StereoPannerNode  // per-clip pan
  /** Connect future effect nodes between insertOutput and masterGain */
  insertOutput: AudioNode      // currently === panner; reassign when inserting effects
  element:   HTMLMediaElement
  loadedUrl: string
}

export interface AudioMixerOptions {
  muted:  boolean
  volume: number  // master 0–1
}

// ─── helpers ─────────────────────────────────────────────────────────────────

function isAudioClip(c: LocalClip) {
  return c.type === "audio" || c.type === "video"
}

function isActive(c: LocalClip, t: number) {
  return t >= c.startTime - 0.05 && t < c.startTime + c.duration + 0.05
}

function clipTime(c: LocalClip, t: number) {
  return Math.max(0, t - c.startTime + (c.trimStart ?? 0))
}

// ─── hook ────────────────────────────────────────────────────────────────────

export function useAudioMixer(options: AudioMixerOptions) {
  // Stable refs — never cause re-renders
  const ctxRef        = useRef<AudioContext | null>(null)
  const masterGain    = useRef<GainNode | null>(null)
  const tracks        = useRef<Map<string, TrackNodes>>(new Map())
  const optionsRef    = useRef(options)
  const soloIdRef     = useRef<string | null>(null)

  // Keep options ref current without recreating the effect
  useEffect(() => { optionsRef.current = options }, [options])

  // ── lazily create AudioContext on first user gesture ─────────────────────
  function getCtx(): AudioContext {
    if (!ctxRef.current || ctxRef.current.state === "closed") {
      const ctx = new AudioContext()
      ctxRef.current = ctx
      const mg = ctx.createGain()
      mg.connect(ctx.destination)
      masterGain.current = mg
    }
    // Resume if suspended (browser autoplay policy)
    if (ctxRef.current.state === "suspended") {
      ctxRef.current.resume().catch(() => {})
    }
    return ctxRef.current
  }

  // ── build or update the node chain for one clip ───────────────────────────
  function ensureTrack(clip: LocalClip, ctx: AudioContext): TrackNodes {
    const existing = tracks.current.get(clip.id)
    const url = clip.url ?? ""

    if (existing) {
      // URL changed — tear down and rebuild
      if (existing.loadedUrl !== url) {
        existing.source.disconnect()
        existing.gainNode.disconnect()
        existing.panner.disconnect()
        existing.element.pause()
        tracks.current.delete(clip.id)
      } else {
        return existing
      }
    }

    if (!url) throw new Error("no url")

    const el = document.createElement(clip.type === "audio" ? "audio" : "video")
    el.src = url
    el.preload = "auto"
    el.muted = false          // audio must NOT be muted for WebAudio to work
    if (el instanceof HTMLVideoElement) el.playsInline = true
    // crossOrigin required for createMediaElementSource on cross-origin media
    el.crossOrigin = "anonymous"

    const source   = ctx.createMediaElementSource(el)
    const gainNode = ctx.createGain()
    const panner   = ctx.createStereoPanner()

    // Chain: source → gain → panner → [insert point] → masterGain
    source.connect(gainNode)
    gainNode.connect(panner)
    panner.connect(masterGain.current!)

    const entry: TrackNodes = {
      source, gainNode, panner,
      insertOutput: panner,   // effect nodes splice between panner and masterGain
      element: el,
      loadedUrl: url,
    }
    tracks.current.set(clip.id, entry)
    return entry
  }

  // ── remove tracks that are no longer active ───────────────────────────────
  function pruneStale(activeIds: Set<string>) {
    for (const [id, t] of tracks.current) {
      if (!activeIds.has(id)) {
        t.source.disconnect()
        t.gainNode.disconnect()
        t.panner.disconnect()
        t.element.pause()
        tracks.current.delete(id)
      }
    }
  }

  // ── apply param values to an existing track ───────────────────────────────
  function applyParams(
    track: TrackNodes,
    clip: LocalClip,
    isPlaying: boolean,
    playbackRate: number,
    currentTime: number,
    soloId: string | null,
  ) {
    const { muted, volume } = optionsRef.current

    // Effective mute: global mute OR clip muted OR (solo active and this isn't the solo clip)
    const effectiveMute =
      muted ||
      clip.muted === true ||
      clip.volume === 0 ||
      (soloId !== null && soloId !== clip.id)

    const targetGain = effectiveMute
      ? 0
      : Math.max(0, Math.min(1, (clip.volume ?? 1) * volume))

    // Use setTargetAtTime for click-free gain changes (10ms time constant)
    const ctx = ctxRef.current!
    track.gainNode.gain.setTargetAtTime(targetGain, ctx.currentTime, 0.01)
    track.panner.pan.setTargetAtTime(
      Math.max(-1, Math.min(1, clip.pan ?? 0)),
      ctx.currentTime,
      0.01,
    )

    const el = track.element
    el.playbackRate = playbackRate * (clip.speed ?? 1)

    // Seek if drifted more than 200 ms
    const ct = clipTime(clip, currentTime)
    if (Math.abs(el.currentTime - ct) > 0.2) {
      try { el.currentTime = ct } catch { /* not ready */ }
    }

    if (isPlaying) {
      if (el.paused && el.readyState >= 2) {
        el.play().catch((e) => { if (e.name !== "AbortError") console.warn("mixer play:", e) })
      }
    } else {
      if (!el.paused) el.pause()
    }
  }

  // ── master volume ─────────────────────────────────────────────────────────
  function applyMasterVolume() {
    const mg = masterGain.current
    const ctx = ctxRef.current
    if (!mg || !ctx) return
    const { muted, volume } = optionsRef.current
    mg.gain.setTargetAtTime(muted ? 0 : volume, ctx.currentTime, 0.01)
  }

  // ── main effect ───────────────────────────────────────────────────────────
  useEffect(() => {
    // Subscribe to store changes — runs outside React render cycle
    const unsub = useEditorStore.subscribe((state) => {
      const { clips, playback } = state
      const { currentTime, isPlaying, playbackRate } = playback

      // Don't create AudioContext until there's something to play
      const audioClips = clips.filter((c) => isAudioClip(c) && isActive(c, currentTime) && c.url)
      if (audioClips.length === 0) {
        // Still need to prune if tracks exist
        if (tracks.current.size > 0) pruneStale(new Set())
        return
      }

      let ctx: AudioContext
      try { ctx = getCtx() } catch { return }

      applyMasterVolume()

      const activeIds = new Set(audioClips.map((c) => c.id))
      pruneStale(activeIds)

      for (const clip of audioClips) {
        let track: TrackNodes
        try { track = ensureTrack(clip, ctx) } catch { continue }
        applyParams(track, clip, isPlaying, playbackRate, currentTime, soloIdRef.current)
      }
    })

    return () => {
      unsub()
      // Tear down all tracks
      for (const [, t] of tracks.current) {
        t.source.disconnect()
        t.gainNode.disconnect()
        t.panner.disconnect()
        t.element.pause()
      }
      tracks.current.clear()
      // Close context — will be recreated on next play
      ctxRef.current?.close().catch(() => {})
      ctxRef.current = null
      masterGain.current = null
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // ── public API ────────────────────────────────────────────────────────────

  /** Set the solo clip id. Pass null to clear solo. */
  function setSolo(clipId: string | null) {
    soloIdRef.current = clipId
    // Re-apply params immediately so the gain change is instant
    const state = useEditorStore.getState()
    const { clips, playback } = state
    for (const clip of clips) {
      if (!isAudioClip(clip)) continue
      const track = tracks.current.get(clip.id)
      if (!track) continue
      applyParams(track, clip, playback.isPlaying, playback.playbackRate, playback.currentTime, clipId)
    }
  }

  /**
   * Insert an AudioNode into the effect chain for a clip.
   * The node is spliced between the StereoPanner and the master GainNode.
   * Returns a cleanup function that removes the node.
   */
  function insertEffect(clipId: string, node: AudioNode): () => void {
    const track = tracks.current.get(clipId)
    const mg = masterGain.current
    if (!track || !mg) return () => {}

    track.insertOutput.disconnect(mg)
    track.insertOutput.connect(node)
    node.connect(mg)

    return () => {
      try {
        track.insertOutput.disconnect(node)
        node.disconnect(mg)
        track.insertOutput.connect(mg)
      } catch { /* already disconnected */ }
    }
  }

  return { setSolo, insertEffect }
}
