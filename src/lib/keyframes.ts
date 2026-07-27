import type { Keyframe } from "@/types/editor"

/** Interpolate a keyframe-animated property value at a given clip-relative time */
export function interpolateKeyframes(
  keyframes: Keyframe[],
  property: string,
  time: number,
  defaultValue: number,
): number {
  const kfs = keyframes.filter((k) => k.property === property).sort((a, b) => a.time - b.time)
  if (kfs.length === 0) return defaultValue
  if (time <= kfs[0].time) return kfs[0].value
  if (time >= kfs[kfs.length - 1].time) return kfs[kfs.length - 1].value

  const next = kfs.findIndex((k) => k.time > time)
  const prev = kfs[next - 1]
  const curr = kfs[next]
  const t = (time - prev.time) / (curr.time - prev.time)

  // Apply easing
  let et = t
  if (curr.easing === "ease-in") et = t * t
  else if (curr.easing === "ease-out") et = t * (2 - t)
  else if (curr.easing === "ease-in-out") et = t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t

  return prev.value + (curr.value - prev.value) * et
}
