const KEY = (import.meta.env.VITE_PIXABAY_KEY as string | undefined) ?? ""
const BASE = "https://pixabay.com/api/music/"

export interface PixabayTrack {
  id: number
  title: string
  artist: string
  duration: number        // seconds
  bpm: number | null
  genre: string
  mood: string
  url: string             // preview/download MP3
  thumbnail: string       // album art
  pixabayUrl: string      // page link
}

export type PixabayMood =
  | "happy" | "sad" | "energetic" | "calm" | "romantic"
  | "dark" | "funny" | "inspiring"

export type PixabayGenre =
  | "ambient" | "cinematic" | "classical" | "country" | "dance"
  | "electronic" | "folk" | "hip-hop" | "jazz" | "pop" | "rock"
  | "soul" | "world"

export interface PixabaySearchParams {
  query?: string
  mood?: PixabayMood
  genre?: PixabayGenre
  minBpm?: number
  maxBpm?: number
  minDuration?: number
  maxDuration?: number
  page?: number
  perPage?: number
}

export interface PixabayResult {
  tracks: PixabayTrack[]
  total: number
  page: number
  perPage: number
}

// Pixabay music API returns hits[] with these raw fields
interface RawHit {
  id: number
  tags: string
  previewURL: string
  previewWidth: number
  previewHeight: number
  webformatURL: string
  largeImageURL: string
  duration: number
  user: string
  userImageURL: string
  pageURL: string
  // music-specific (may be absent on older hits)
  title?: string
  artist?: string
  bpm?: number
  genre?: string
  mood?: string
  audio?: string          // direct MP3 when available
}

function toTrack(hit: RawHit): PixabayTrack {
  return {
    id: hit.id,
    title: hit.title ?? hit.tags?.split(",")[0]?.trim() ?? `Track ${hit.id}`,
    artist: hit.artist ?? hit.user ?? "Unknown artist",
    duration: hit.duration ?? 0,
    bpm: hit.bpm ?? null,
    genre: hit.genre ?? "Unknown",
    mood: hit.mood ?? "Unknown",
    url: hit.audio ?? hit.previewURL,
    thumbnail: hit.webformatURL ?? hit.largeImageURL ?? "",
    pixabayUrl: hit.pageURL,
  }
}

export async function searchMusic(params: PixabaySearchParams): Promise<PixabayResult> {
  if (!KEY) throw new Error("VITE_PIXABAY_KEY is not set")

  const q = new URLSearchParams({ key: KEY, media_type: "music" })

  if (params.query)       q.set("q", params.query)
  if (params.mood)        q.set("mood", params.mood)
  if (params.genre)       q.set("category", params.genre)
  if (params.minBpm)      q.set("min_bpm", String(params.minBpm))
  if (params.maxBpm)      q.set("max_bpm", String(params.maxBpm))
  if (params.minDuration) q.set("min_duration", String(params.minDuration))
  if (params.maxDuration) q.set("max_duration", String(params.maxDuration))

  const page    = params.page    ?? 1
  const perPage = params.perPage ?? 20
  q.set("page",     String(page))
  q.set("per_page", String(perPage))

  const res = await fetch(`${BASE}?${q}`)
  if (!res.ok) throw new Error(`Pixabay error ${res.status}`)

  const data = await res.json() as { totalHits: number; hits: RawHit[] }
  return {
    tracks:  (data.hits ?? []).map(toTrack),
    total:   data.totalHits ?? 0,
    page,
    perPage,
  }
}
