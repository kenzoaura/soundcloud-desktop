export interface PlayerSnapshot {
  title: string
  artist: string
  artworkUrl?: string
  url?: string
  durationSec: number
  positionSec: number
  isPlaying: boolean
}

export interface RpcActivity {
  type: number
  name: string
  details: string
  state: string
  largeImageKey?: string
  largeImageText: string
  startTimestamp?: number
  endTimestamp?: number
  buttons?: { label: string; url: string }[]
}

export function buildActivity(s: PlayerSnapshot, nowMs: number): RpcActivity {
  const activity: RpcActivity = {
    type: 2, // Listening
    // Friends-list compact line shows "Ouvindo {name}" — use the artist there.
    name: (s.artist || 'SoundCloud').slice(0, 128),
    details: s.title.slice(0, 128) || 'Faixa desconhecida',
    state: `por ${s.artist || 'artista desconhecido'}`.slice(0, 128),
    largeImageKey: s.artworkUrl,
    largeImageText: 'SoundCloud',
  }
  // "Open on SoundCloud" button (Discord requires a valid http(s) URL).
  if (s.url && /^https?:\/\//.test(s.url)) {
    activity.buttons = [{ label: 'Ouvir no SoundCloud', url: s.url }]
  }
  if (s.isPlaying && s.durationSec > 0) {
    const start = nowMs - Math.floor(s.positionSec * 1000)
    activity.startTimestamp = start
    activity.endTimestamp = start + Math.floor(s.durationSec * 1000)
  }
  return activity
}
