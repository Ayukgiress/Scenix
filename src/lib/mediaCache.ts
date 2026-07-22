// Lightweight media metadata cache backed by localStorage.
// Prevents re-fetching duration/thumbnail on every project load.

const CACHE_KEY = "scenix_media_cache_v1"
const MAX_ENTRIES = 500

interface CachedMedia {
  id: string
  duration?: number
  thumbnailUrl?: string
  width?: number
  height?: number
  cachedAt: number
}

function load(): Record<string, CachedMedia> {
  try {
    return JSON.parse(localStorage.getItem(CACHE_KEY) ?? "{}") as Record<string, CachedMedia>
  } catch {
    return {}
  }
}

function save(cache: Record<string, CachedMedia>) {
  try {
    // Evict oldest entries if over limit
    const entries = Object.entries(cache).sort((a, b) => b[1].cachedAt - a[1].cachedAt)
    const trimmed = Object.fromEntries(entries.slice(0, MAX_ENTRIES))
    localStorage.setItem(CACHE_KEY, JSON.stringify(trimmed))
  } catch {
    // Storage full — clear and retry
    localStorage.removeItem(CACHE_KEY)
  }
}

export const mediaCache = {
  get(id: string): CachedMedia | null {
    return load()[id] ?? null
  },

  set(id: string, data: Omit<CachedMedia, "id" | "cachedAt">) {
    const cache = load()
    cache[id] = { ...data, id, cachedAt: Date.now() }
    save(cache)
  },

  /** Merge cached metadata into a media asset if fields are missing */
  hydrate<T extends { id: string; duration?: number; thumbnailUrl?: string | null }>(asset: T): T {
    const cached = load()[asset.id]
    if (!cached) return asset
    return {
      ...asset,
      duration: asset.duration ?? cached.duration,
      thumbnailUrl: asset.thumbnailUrl ?? cached.thumbnailUrl ?? null,
    }
  },

  clear() {
    localStorage.removeItem(CACHE_KEY)
  },
}
