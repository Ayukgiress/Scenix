import { useEffect, useState, useMemo } from "react"

export function useTypewriter(phrases: string[], speed = 38, pause = 2200) {
  const [phraseIdx, setPhraseIdx] = useState(0)
  const [charIdx, setCharIdx] = useState(0)
  const [deleting, setDeleting] = useState(false)

  useEffect(() => {
    const current = phrases[phraseIdx]
    if (!deleting && charIdx < current.length) {
      const t = setTimeout(() => setCharIdx((i) => i + 1), speed)
      return () => clearTimeout(t)
    }
    if (!deleting && charIdx === current.length) {
      const t = setTimeout(() => setDeleting(true), pause)
      return () => clearTimeout(t)
    }
    if (deleting && charIdx > 0) {
      const t = setTimeout(() => setCharIdx((i) => i - 1), speed / 2)
      return () => clearTimeout(t)
    }
    if (deleting && charIdx === 0) {
      const t = setTimeout(() => {
        setDeleting(false)
        setPhraseIdx((i) => (i + 1) % phrases.length)
      }, 0)
      return () => clearTimeout(t)
    }
  }, [charIdx, deleting, phraseIdx, phrases, speed, pause])

  const display = useMemo(
    () => phrases[phraseIdx].slice(0, charIdx),
    [charIdx, phraseIdx, phrases]
  )

  return display
}
