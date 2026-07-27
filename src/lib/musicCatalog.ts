export type Mood = "happy" | "energetic" | "sad" | "calm" | "dark" | "inspiring" | "romantic" | "funny"
export type Genre = "ambient" | "cinematic" | "electronic" | "hip-hop" | "jazz" | "pop" | "rock" | "folk" | "classical"

export interface CatalogTrack {
  id: string
  title: string
  artist: string
  duration: number
  bpm: number | null
  mood: Mood
  genre: Genre
  url: string
  thumbnail: string
}

// All URLs are from archive.org (CC BY 4.0, Kevin MacLeod / incompetech.com)
// archive.org serves Access-Control-Allow-Origin: * — safe for browser audio
const A = (album: string, folder: string, file: string) =>
  `https://archive.org/download/${album}/${encodeURIComponent(folder)}/${encodeURIComponent(file)}`

const SS  = "Kevin-MacLeod_Somewhere-Sunny_2014_FullAlbum"
const DU  = "Kevin-MacLeod_Disco-Ultralounge_2014_FullAlbum"
const ME  = "Kevin-MacLeod_Medium-Electronic_2008_FullAlbum"
const RS  = "Kevin-MacLeod_Reggae-and-Ska_2009_FullAlbum"
const OS  = "Kevin-MacLeod_Ossuary_2015_FullAlbum"
const PK  = "Kevin-MacLeod_PsychoKiller_2014_FullAlbum"
const OD  = "Kevin-MacLeod_Oddities_2014_FullAlbum"
const DM  = "Kevin-MacLeod_Danse-Macabre_2008_FullAlbum"
const MS  = "Kevin-MacLeod_Magic-Scout-A-Calm-Experience_2018_FullAlbum"
const VD  = "Kevin-MacLeod_Vadodara_2014_FullAlbum"

export const MUSIC_CATALOG: CatalogTrack[] = [
  // ── Happy ──────────────────────────────────────────────────────────────────
  {
    id: "km-ss-01", title: "Somewhere Sunny", artist: "Kevin MacLeod",
    duration: 148, bpm: 110, mood: "happy", genre: "folk", thumbnail: "#f59e0b",
    url: A(SS, "Somewhere Sunny", "Kevin MacLeod - 01 - Somewhere Sunny.mp3"),
  },
  {
    id: "km-ss-02", title: "Clear Air", artist: "Kevin MacLeod",
    duration: 132, bpm: 105, mood: "happy", genre: "folk", thumbnail: "#10b981",
    url: A(SS, "Somewhere Sunny", "Kevin MacLeod - 02 - Clear Air.mp3"),
  },
  {
    id: "km-ss-03", title: "Happy Alley", artist: "Kevin MacLeod",
    duration: 120, bpm: 118, mood: "happy", genre: "pop", thumbnail: "#f97316",
    url: A(SS, "Somewhere Sunny", "Kevin MacLeod - 03 - Happy Alley.mp3"),
  },
  {
    id: "km-ss-05", title: "Sunshine", artist: "Kevin MacLeod",
    duration: 140, bpm: 124, mood: "happy", genre: "pop", thumbnail: "#eab308",
    url: A(SS, "Somewhere Sunny", "Kevin MacLeod - 05 - Sunshine.mp3"),
  },
  {
    id: "km-od-02", title: "Brightly Fancy", artist: "Kevin MacLeod",
    duration: 115, bpm: 130, mood: "happy", genre: "folk", thumbnail: "#84cc16",
    url: A(OD, "Oddities", "Kevin MacLeod - 02 - Brightly Fancy.mp3"),
  },

  // ── Funny ──────────────────────────────────────────────────────────────────
  {
    id: "km-od-05", title: "Fluffing a Duck", artist: "Kevin MacLeod",
    duration: 108, bpm: 128, mood: "funny", genre: "jazz", thumbnail: "#d97706",
    url: A(OD, "Oddities", "Kevin MacLeod - 05 - Fluffing a Duck.mp3"),
  },
  {
    id: "km-od-06", title: "Hamster March", artist: "Kevin MacLeod",
    duration: 95, bpm: 140, mood: "funny", genre: "pop", thumbnail: "#f59e0b",
    url: A(OD, "Oddities", "Kevin MacLeod - 06 - Hamster March.mp3"),
  },
  {
    id: "km-od-13", title: "Winner Winner!", artist: "Kevin MacLeod",
    duration: 88, bpm: 135, mood: "funny", genre: "pop", thumbnail: "#fb923c",
    url: A(OD, "Oddities", "Kevin MacLeod - 13 - Winner Winner!.mp3"),
  },

  // ── Energetic ──────────────────────────────────────────────────────────────
  {
    id: "km-me-03", title: "Dance Monster", artist: "Kevin MacLeod",
    duration: 155, bpm: 140, mood: "energetic", genre: "electronic", thumbnail: "#ef4444",
    url: A(ME, "Medium Electronic", "Kevin MacLeod - 03 - Dance Monster.mp3"),
  },
  {
    id: "km-me-06", title: "Enter the Party", artist: "Kevin MacLeod",
    duration: 138, bpm: 148, mood: "energetic", genre: "electronic", thumbnail: "#dc2626",
    url: A(ME, "Medium Electronic", "Kevin MacLeod - 06 - Enter the Party.mp3"),
  },
  {
    id: "km-me-08", title: "Go Cart", artist: "Kevin MacLeod",
    duration: 125, bpm: 160, mood: "energetic", genre: "electronic", thumbnail: "#7c3aed",
    url: A(ME, "Medium Electronic", "Kevin MacLeod - 08 - Go Cart.mp3"),
  },
  {
    id: "km-pk-02", title: "Chase Pulse Faster", artist: "Kevin MacLeod",
    duration: 112, bpm: 155, mood: "energetic", genre: "cinematic", thumbnail: "#b91c1c",
    url: A(PK, "PsychoKiller", "Kevin MacLeod - 02 - Chase Pulse Faster.mp3"),
  },

  // ── Calm ───────────────────────────────────────────────────────────────────
  {
    id: "km-ms-01", title: "Cottages", artist: "Kevin MacLeod",
    duration: 174, bpm: 72, mood: "calm", genre: "ambient", thumbnail: "#06b6d4",
    url: A(MS, "Magic Scout- A Calm Experience", "Kevin MacLeod - 01 - Cottages.mp3"),
  },
  {
    id: "km-ms-02", title: "Farm", artist: "Kevin MacLeod",
    duration: 180, bpm: 68, mood: "calm", genre: "ambient", thumbnail: "#0ea5e9",
    url: A(MS, "Magic Scout- A Calm Experience", "Kevin MacLeod - 02 - Farm.mp3"),
  },
  {
    id: "km-ms-03", title: "Manor", artist: "Kevin MacLeod",
    duration: 165, bpm: 70, mood: "calm", genre: "ambient", thumbnail: "#38bdf8",
    url: A(MS, "Magic Scout- A Calm Experience", "Kevin MacLeod - 03 - Manor.mp3"),
  },
  {
    id: "km-ms-04", title: "Northern Glade", artist: "Kevin MacLeod",
    duration: 200, bpm: 65, mood: "calm", genre: "ambient", thumbnail: "#7dd3fc",
    url: A(MS, "Magic Scout- A Calm Experience", "Kevin MacLeod - 04 - Northern Glade.mp3"),
  },
  {
    id: "km-os-05", title: "Ossuary 5 - Rest", artist: "Kevin MacLeod",
    duration: 160, bpm: 60, mood: "calm", genre: "classical", thumbnail: "#94a3b8",
    url: A(OS, "Ossuary", "Kevin MacLeod - 05 - Ossuary 5 - Rest.mp3"),
  },

  // ── Sad ────────────────────────────────────────────────────────────────────
  {
    id: "km-dm-04", title: "Danse Macabre - Sad Part", artist: "Kevin MacLeod",
    duration: 150, bpm: 60, mood: "sad", genre: "classical", thumbnail: "#64748b",
    url: A(DM, "Danse Macabre", "Kevin MacLeod - 04 - Danse Macabre - Sad Part.mp3"),
  },
  {
    id: "km-os-01", title: "Ossuary 1 - A Beginning", artist: "Kevin MacLeod",
    duration: 188, bpm: 58, mood: "sad", genre: "ambient", thumbnail: "#475569",
    url: A(OS, "Ossuary", "Kevin MacLeod - 01 - Ossuary 1 - A Beginning.mp3"),
  },
  {
    id: "km-os-06", title: "Ossuary 6 - Air", artist: "Kevin MacLeod",
    duration: 142, bpm: 62, mood: "sad", genre: "classical", thumbnail: "#334155",
    url: A(OS, "Ossuary", "Kevin MacLeod - 06 - Ossuary 6 - Air.mp3"),
  },

  // ── Dark ───────────────────────────────────────────────────────────────────
  {
    id: "km-pk-06", title: "Evening of Chaos", artist: "Kevin MacLeod",
    duration: 145, bpm: 85, mood: "dark", genre: "cinematic", thumbnail: "#1e1b4b",
    url: A(PK, "PsychoKiller", "Kevin MacLeod - 06 - Evening of Chaos.mp3"),
  },
  {
    id: "km-pk-09", title: "Hush", artist: "Kevin MacLeod",
    duration: 132, bpm: 78, mood: "dark", genre: "cinematic", thumbnail: "#312e81",
    url: A(PK, "PsychoKiller", "Kevin MacLeod - 09 - Hush.mp3"),
  },
  {
    id: "km-pk-20", title: "The Hive", artist: "Kevin MacLeod",
    duration: 158, bpm: 90, mood: "dark", genre: "cinematic", thumbnail: "#4c1d95",
    url: A(PK, "PsychoKiller", "Kevin MacLeod - 20 - The Hive.mp3"),
  },
  {
    id: "km-dm-01", title: "Danse Macabre", artist: "Kevin MacLeod",
    duration: 210, bpm: 88, mood: "dark", genre: "classical", thumbnail: "#1e293b",
    url: A(DM, "Danse Macabre", "Kevin MacLeod - 01 - Danse Macabre.mp3"),
  },

  // ── Inspiring ──────────────────────────────────────────────────────────────
  {
    id: "km-vd-12", title: "Finding Movement", artist: "Kevin MacLeod",
    duration: 165, bpm: 95, mood: "inspiring", genre: "cinematic", thumbnail: "#f59e0b",
    url: A(VD, "Vadodara", "Kevin MacLeod - 12 - Finding Movement.mp3"),
  },
  {
    id: "km-os-07", title: "Ossuary 7 - Resolve", artist: "Kevin MacLeod",
    duration: 178, bpm: 100, mood: "inspiring", genre: "cinematic", thumbnail: "#fbbf24",
    url: A(OS, "Ossuary", "Kevin MacLeod - 07 - Ossuary 7 - Resolve.mp3"),
  },

  // ── Jazz / Lounge ──────────────────────────────────────────────────────────
  {
    id: "km-du-01", title: "Airport Lounge", artist: "Kevin MacLeod",
    duration: 170, bpm: 115, mood: "calm", genre: "jazz", thumbnail: "#b45309",
    url: A(DU, "Disco Ultralounge", "Kevin MacLeod - 01 - Airport Lounge.mp3"),
  },
  {
    id: "km-du-03", title: "Avant Jazz", artist: "Kevin MacLeod",
    duration: 148, bpm: 122, mood: "funny", genre: "jazz", thumbnail: "#92400e",
    url: A(DU, "Disco Ultralounge", "Kevin MacLeod - 03 - Avant Jazz.mp3"),
  },
  {
    id: "km-du-11", title: "George Street Shuffle", artist: "Kevin MacLeod",
    duration: 152, bpm: 118, mood: "happy", genre: "jazz", thumbnail: "#78350f",
    url: A(DU, "Disco Ultralounge", "Kevin MacLeod - 11 - George Street Shuffle.mp3"),
  },

  // ── Reggae / Folk ──────────────────────────────────────────────────────────
  {
    id: "km-rs-03", title: "Beach Party", artist: "Kevin MacLeod",
    duration: 144, bpm: 96, mood: "happy", genre: "folk", thumbnail: "#0d9488",
    url: A(RS, "Reggae & Ska", "Kevin MacLeod - 03 - Beach Party.mp3"),
  },
  {
    id: "km-rs-04", title: "Easy Jam", artist: "Kevin MacLeod",
    duration: 138, bpm: 88, mood: "calm", genre: "folk", thumbnail: "#0f766e",
    url: A(RS, "Reggae & Ska", "Kevin MacLeod - 04 - Easy Jam.mp3"),
  },
]

export const MOODS: { value: Mood; label: string; emoji: string; color: string }[] = [
  { value: "happy",     label: "Happy",     emoji: "😊", color: "bg-yellow-500/15 text-yellow-400 border-yellow-500/30" },
  { value: "energetic", label: "Energetic", emoji: "⚡", color: "bg-red-500/15 text-red-400 border-red-500/30" },
  { value: "calm",      label: "Calm",      emoji: "🌊", color: "bg-sky-500/15 text-sky-400 border-sky-500/30" },
  { value: "sad",       label: "Sad",       emoji: "🌧️", color: "bg-slate-500/15 text-slate-400 border-slate-500/30" },
  { value: "inspiring", label: "Inspiring", emoji: "✨", color: "bg-amber-500/15 text-amber-400 border-amber-500/30" },
  { value: "dark",      label: "Dark",      emoji: "🌑", color: "bg-violet-500/15 text-violet-400 border-violet-500/30" },
  { value: "funny",     label: "Funny",     emoji: "😄", color: "bg-orange-500/15 text-orange-400 border-orange-500/30" },
]

export const GENRES: { value: Genre; label: string }[] = [
  { value: "ambient",    label: "Ambient" },
  { value: "cinematic",  label: "Cinematic" },
  { value: "classical",  label: "Classical" },
  { value: "electronic", label: "Electronic" },
  { value: "folk",       label: "Folk" },
  { value: "jazz",       label: "Jazz" },
  { value: "pop",        label: "Pop" },
]
