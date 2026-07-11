import type { Repeat } from './queue'

const KEY = 'sc:playback-prefs'

// Pure parse so it can be unit-tested without localStorage.
export function parsePlaybackPrefs(raw: string | null): { shuffle: boolean; repeat: Repeat } {
  try {
    const p = raw ? (JSON.parse(raw) as { shuffle?: unknown; repeat?: unknown }) : null
    const repeat: Repeat = p?.repeat === 'all' || p?.repeat === 'one' ? p.repeat : 'off'
    return { shuffle: p?.shuffle === true, repeat }
  } catch {
    return { shuffle: false, repeat: 'off' }
  }
}

export function loadPlaybackPrefs(): { shuffle: boolean; repeat: Repeat } {
  try {
    return parsePlaybackPrefs(localStorage.getItem(KEY))
  } catch {
    return { shuffle: false, repeat: 'off' }
  }
}

export function savePlaybackPrefs(p: { shuffle: boolean; repeat: Repeat }): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(p))
  } catch {
    // best-effort
  }
}
