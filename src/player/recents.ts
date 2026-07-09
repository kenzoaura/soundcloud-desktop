import type { Track } from '../../electron/sc/types'

const KEY = 'sc:recents'

export function getRecents(): Track[] {
  try {
    const v = JSON.parse(localStorage.getItem(KEY) || '[]')
    return Array.isArray(v) ? v : []
  } catch {
    return []
  }
}

export function addRecent(track: Track): void {
  try {
    const list = getRecents().filter((t) => t.id !== track.id)
    list.unshift(track)
    localStorage.setItem(KEY, JSON.stringify(list.slice(0, 20)))
  } catch {
    // ignore
  }
}
