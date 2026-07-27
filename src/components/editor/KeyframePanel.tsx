import { useState } from "react"
import { Plus, Trash2, Diamond } from "lucide-react"
import { useEditorStore, type LocalClip } from "@/store/editorStore"
import type { Keyframe } from "@/types/editor"

const ANIMATABLE_PROPS = [
	{ key: "opacity", label: "Opacity", min: 0, max: 1, step: 0.01, format: (v: number) => `${Math.round(v * 100)}%` },
	{ key: "x", label: "Position X", min: -100, max: 200, step: 0.5, format: (v: number) => `${v.toFixed(1)}%` },
	{ key: "y", label: "Position Y", min: -100, max: 200, step: 0.5, format: (v: number) => `${v.toFixed(1)}%` },
	{ key: "scale", label: "Scale", min: 0, max: 4, step: 0.01, format: (v: number) => `${(v * 100).toFixed(0)}%` },
	{ key: "rotation", label: "Rotation", min: -360, max: 360, step: 1, format: (v: number) => `${v}°` },
	{ key: "volume", label: "Volume", min: 0, max: 1, step: 0.01, format: (v: number) => `${Math.round(v * 100)}%` },
	{ key: "maskX", label: "Mask X", min: -1, max: 1, step: 0.01, format: (v: number) => `${v.toFixed(2)}` },
	{ key: "maskY", label: "Mask Y", min: -1, max: 1, step: 0.01, format: (v: number) => `${v.toFixed(2)}` },
	{ key: "maskScale", label: "Mask Scale", min: 0, max: 4, step: 0.01, format: (v: number) => `${(v * 100).toFixed(0)}%` },
	{ key: "maskRotation", label: "Mask Rotation", min: -360, max: 360, step: 1, format: (v: number) => `${v}°` },
]

const EASINGS: Keyframe["easing"][] = ["linear", "ease-in", "ease-out", "ease-in-out"]

function getDefaultValue(prop: string, clip: LocalClip): number {
	if (prop === "opacity") return clip.opacity ?? 1
	if (prop === "x") return clip.x ?? 0
	if (prop === "y") return clip.y ?? 0
	if (prop === "scale") return 1
	if (prop === "rotation") return clip.rotation ?? 0
	if (prop === "volume") return clip.volume ?? 1
	if (prop === "maskX") return clip.mask?.x ?? 0
	if (prop === "maskY") return clip.mask?.y ?? 0
	if (prop === "maskScale") return clip.mask?.scale ?? 1
	if (prop === "maskRotation") return clip.mask?.rotation ?? 0
	return 0
}

export function KeyframePanel({ clip }: { clip: LocalClip }) {
	const updateClipLocal = useEditorStore((s) => s.updateClipLocal)
	const currentTime = useEditorStore((s) => s.playback.currentTime)

	const [selectedProp, setSelectedProp] = useState("opacity")
	const [selectedEasing, setSelectedEasing] = useState<Keyframe["easing"]>("ease-in-out")

	const keyframes = clip.keyframes ?? []
	const propDef = ANIMATABLE_PROPS.find((p) => p.key === selectedProp)!

	const addKeyframe = () => {
		const relTime = Math.max(0, Math.min(clip.duration, currentTime - clip.startTime))
		const existing = keyframes.find((k) => k.property === selectedProp && Math.abs(k.time - relTime) < 0.05)
		if (existing) return

		const value = getDefaultValue(selectedProp, clip)
		const kf: Keyframe = { time: relTime, property: selectedProp, value, easing: selectedEasing }
		updateClipLocal(clip.id, { keyframes: [...keyframes, kf].sort((a, b) => a.time - b.time) })
	}

	const removeKeyframe = (idx: number) => {
		const next = keyframes.filter((_, i) => i !== idx)
		updateClipLocal(clip.id, { keyframes: next })
	}

	const updateKeyframeValue = (idx: number, value: number) => {
		const next = keyframes.map((k, i) => i === idx ? { ...k, value } : k)
		updateClipLocal(clip.id, { keyframes: next })
	}

	const propKeyframes = keyframes.filter((k) => k.property === selectedProp)

	return (
		<div className="space-y-3">
			{/* Property selector */}
			<div>
				<label className="mb-1.5 block text-[10px] font-medium uppercase tracking-wider text-muted-foreground">Property</label>
				<select
					value={selectedProp}
					onChange={(e) => setSelectedProp(e.target.value)}
					className="w-full rounded-md border border-border bg-background px-2 py-1.5 text-[11px] text-foreground outline-none focus:border-primary"
				>
					{ANIMATABLE_PROPS.map((p) => (
						<option key={p.key} value={p.key}>{p.label}</option>
					))}
				</select>
			</div>

			{/* Easing */}
			<div>
				<label className="mb-1.5 block text-[10px] font-medium uppercase tracking-wider text-muted-foreground">Easing</label>
				<div className="grid grid-cols-2 gap-1">
					{EASINGS.map((e) => (
						<button
							key={e}
							onClick={() => setSelectedEasing(e)}
							className={`rounded px-2 py-1 text-[10px] transition-colors ${selectedEasing === e ? "bg-primary/20 text-primary" : "bg-muted text-muted-foreground hover:text-foreground"}`}
						>
							{e}
						</button>
					))}
				</div>
			</div>

			{/* Add keyframe at playhead */}
			<button
				onClick={addKeyframe}
				className="flex w-full items-center justify-center gap-1.5 rounded-md border border-dashed border-primary/40 bg-primary/5 py-2 text-[11px] text-primary hover:bg-primary/10"
			>
				<Plus className="size-3" />
				Add keyframe at {(Math.max(0, currentTime - clip.startTime)).toFixed(2)}s
			</button>

			{/* Keyframe list for selected property */}
			{propKeyframes.length > 0 ? (
				<div className="space-y-1.5">
					<p className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
						{propDef.label} keyframes ({propKeyframes.length})
					</p>
					{propKeyframes.map((kf) => {
						const idx = keyframes.indexOf(kf)
						return (
							<div key={idx} className="flex items-center gap-2 rounded-md border border-border/60 bg-card p-2">
								<Diamond className="size-3 shrink-0 text-primary" />
								<span className="w-10 shrink-0 font-mono text-[10px] text-muted-foreground">{kf.time.toFixed(2)}s</span>
								<input
									type="range"
									min={propDef.min}
									max={propDef.max}
									step={propDef.step}
									value={kf.value}
									onChange={(e) => updateKeyframeValue(idx, parseFloat(e.target.value))}
									className="flex-1 accent-primary"
								/>
								<span className="w-12 shrink-0 text-right text-[10px] text-muted-foreground">{propDef.format(kf.value)}</span>
								<button
									onClick={() => removeKeyframe(idx)}
									className="rounded p-0.5 text-muted-foreground/50 hover:text-red-400"
								>
									<Trash2 className="size-3" />
								</button>
							</div>
						)
					})}
				</div>
			) : (
				<p className="text-center text-[10px] text-muted-foreground/50">No keyframes for {propDef.label}</p>
			)}

			{/* All keyframes summary */}
			{keyframes.length > 0 && (
				<div className="rounded-md border border-border/40 bg-muted/20 p-2">
					<p className="mb-1.5 text-[10px] font-medium uppercase tracking-wider text-muted-foreground">All keyframes ({keyframes.length})</p>
					<div className="relative h-6 w-full rounded bg-muted/40">
						{keyframes.map((kf, i) => (
							<div
								key={i}
								className="absolute top-1/2 -translate-x-1/2 -translate-y-1/2"
								style={{ left: `${(kf.time / clip.duration) * 100}%` }}
								title={`${kf.property}: ${kf.value.toFixed(2)} @ ${kf.time.toFixed(2)}s`}
							>
								<div className="size-2 rotate-45 bg-primary" />
							</div>
						))}
					</div>
				</div>
			)}
		</div>
	)
}
