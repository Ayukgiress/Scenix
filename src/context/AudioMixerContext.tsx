import { createContext, useContext } from "react"

export interface AudioMixerAPI {
  setSolo: (clipId: string | null) => void
  insertEffect: (clipId: string, node: AudioNode) => () => void
}

export const AudioMixerContext = createContext<AudioMixerAPI | null>(null)

export function useAudioMixerAPI(): AudioMixerAPI | null {
  return useContext(AudioMixerContext)
}
