import type { Track } from '../../electron/sc/types'

export type Repeat = 'off' | 'all' | 'one'
export interface QueueState {
  tracks: Track[]
  index: number
}

export function currentTrack(q: QueueState): Track | null {
  return q.tracks[q.index] ?? null
}

export function nextIndex(q: QueueState, repeat: Repeat): number | null {
  if (q.tracks.length === 0) return null
  if (repeat === 'one') return q.index
  if (q.index < q.tracks.length - 1) return q.index + 1
  return repeat === 'all' ? 0 : null
}

export function prevIndex(q: QueueState): number {
  return q.index > 0 ? q.index - 1 : 0
}

export function shuffled(tracks: Track[], keepIndex: number): QueueState {
  const current = tracks[keepIndex]
  const rest = tracks.filter((_, i) => i !== keepIndex)
  for (let i = rest.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[rest[i], rest[j]] = [rest[j], rest[i]]
  }
  return { tracks: current ? [current, ...rest] : rest, index: 0 }
}
