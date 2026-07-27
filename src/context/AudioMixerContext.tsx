import { createContext, useContext } from "react"

export interface AudioMixerAPI {
  setSolo:     (clipId: string | null) => void
  insertEffect:(clipId: string, node: AudioNode) => () => void
  getLevels:   () => Map<string, number>
}

export const AudioMixerContext = createContext<AudioMixerAPI | null>(null)

export function useAudioMixerAPI(): AudioMixerAPI | null {
  return useContext(AudioMixerContext)
}
