export interface PlayerSnapshot {
  title: string
  artist: string
  artworkUrl?: string
  durationSec: number
  positionSec: number
  isPlaying: boolean
}

export interface RpcActivity {
  type: number
  details: string
  state: string
  largeImageKey?: string
  largeImageText: string
  startTimestamp?: number
  endTimestamp?: number
}

export function buildActivity(s: PlayerSnapshot, nowMs: number): RpcActivity {
  const activity: RpcActivity = {
    type: 2, // Listening
    details: s.title.slice(0, 128) || 'Unknown',
    state: (s.artist || 'SoundCloud').slice(0, 128),
    largeImageKey: s.artworkUrl,
    largeImageText: 'SoundCloud',
  }
  if (s.isPlaying && s.durationSec > 0) {
    const start = nowMs - Math.floor(s.positionSec * 1000)
    activity.startTimestamp = start
    activity.endTimestamp = start + Math.floor(s.durationSec * 1000)
  }
  return activity
}
