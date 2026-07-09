import { usePlayer } from './store'
import type { Track } from '../../electron/sc/types'

const KEY = 'sc:session'

export interface SavedSession {
  tracks: Track[]
  index: number
  current: Track | null
  position: number
  duration: number
}

export function loadSession(): SavedSession | null {
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) return null
    const s = JSON.parse(raw) as SavedSession
    if (!s || !s.current || !Array.isArray(s.tracks)) return null
    return s
  } catch {
    return null
  }
}

function save() {
  const st = usePlayer.getState()
  if (!st.current) return
  const data: SavedSession = {
    tracks: st.queue.tracks,
    index: st.queue.index,
    current: st.current,
    position: st.position,
    duration: st.duration,
  }
  try {
    localStorage.setItem(KEY, JSON.stringify(data))
  } catch {
    // storage full or unavailable — session persistence is best-effort
  }
}

// Restore the last session (paused) and keep persisting as playback changes.
export function initSession() {
  const saved = loadSession()
  if (saved) usePlayer.getState().restore(saved)

  let lastSaved = 0
  usePlayer.subscribe((s, prev) => {
    const trackChanged =
      s.current?.id !== prev.current?.id ||
      s.queue.tracks !== prev.queue.tracks ||
      s.queue.index !== prev.queue.index
    const now = Date.now()
    if (trackChanged) {
      save()
      lastSaved = now
      return
    }
    // Throttle position writes so we don't hammer localStorage every tick.
    if (s.position !== prev.position && now - lastSaved > 3000) {
      save()
      lastSaved = now
    }
  })
}
