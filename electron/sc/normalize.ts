import type { Track, User, Playlist, Transcoding } from './types'

export function bestArtwork(
  url: string | null | undefined,
  fallback?: string | null,
): string | undefined {
  const src = (url && typeof url === 'string' ? url : '') || (fallback ?? '')
  if (!src) return undefined
  return src.replace(/-large(\.\w+)(\?.*)?$/, '-t500x500$1')
}

function str(v: unknown): string | undefined {
  return typeof v === 'string' && v ? v : undefined
}
function num(v: unknown): number | undefined {
  return typeof v === 'number' && Number.isFinite(v) ? v : undefined
}

export function normalizeUser(raw: unknown): User | null {
  if (!raw || typeof raw !== 'object') return null
  const r = raw as Record<string, unknown>
  const id = num(r.id)
  const username = str(r.username)
  if (id === undefined || !username) return null
  const visuals = (r.visuals as Record<string, unknown>) ?? {}
  const visualList = Array.isArray(visuals.visuals) ? (visuals.visuals as Record<string, unknown>[]) : []
  return {
    id,
    username,
    avatarUrl: bestArtwork(str(r.avatar_url)),
    permalink: str(r.permalink_url) ?? '',
    bannerUrl: str(visualList[0]?.visual_url),
    followersCount: num(r.followers_count),
    followingsCount: num(r.followings_count),
    likesCount: num(r.likes_count) ?? num(r.public_favorites_count),
    trackCount: num(r.track_count),
    description: str(r.description),
    verified: r.verified === true,
    city: str(r.city),
    country: str(r.country_code),
  }
}

function normalizeTranscodings(raw: unknown): Transcoding[] {
  const media = (raw as Record<string, unknown>)?.media as Record<string, unknown> | undefined
  const list = Array.isArray(media?.transcodings) ? (media!.transcodings as unknown[]) : []
  const out: Transcoding[] = []
  for (const t of list) {
    if (!t || typeof t !== 'object') continue
    const tr = t as Record<string, unknown>
    const fmt = (tr.format ?? {}) as Record<string, unknown>
    const url = str(tr.url)
    const protocol = fmt.protocol === 'hls' ? 'hls' : fmt.protocol === 'progressive' ? 'progressive' : undefined
    if (!url || !protocol) continue
    out.push({ url, protocol, mimeType: str(fmt.mime_type) ?? 'audio/mpeg' })
  }
  return out
}

export function normalizeTrack(raw: unknown): Track | null {
  if (!raw || typeof raw !== 'object') return null
  const r = raw as Record<string, unknown>
  const id = num(r.id)
  const title = str(r.title)
  if (id === undefined || !title) return null
  const user = (r.user ?? {}) as Record<string, unknown>
  return {
    id,
    title,
    durationMs: num(r.duration) ?? 0,
    artworkUrl: bestArtwork(str(r.artwork_url), str(user.avatar_url)),
    permalink: str(r.permalink_url) ?? '',
    artist: str(user.username) ?? 'Unknown',
    artistId: num(user.id) ?? 0,
    transcodings: normalizeTranscodings(r),
    waveformUrl: str(r.waveform_url),
    playbackCount: num(r.playback_count),
    likesCount: num(r.likes_count),
    repostsCount: num(r.reposts_count),
    commentCount: num(r.comment_count),
    createdAt: str(r.created_at) ?? str(r.display_date),
  }
}

export function normalizePlaylist(raw: unknown): Playlist | null {
  if (!raw || typeof raw !== 'object') return null
  const r = raw as Record<string, unknown>
  const id = num(r.id)
  const title = str(r.title)
  if (id === undefined || !title) return null
  const user = (r.user ?? {}) as Record<string, unknown>
  return {
    id,
    title,
    artworkUrl: bestArtwork(str(r.artwork_url), str(user.avatar_url)),
    trackCount: num(r.track_count) ?? 0,
    user: str(user.username) ?? 'Unknown',
    permalink: str(r.permalink_url) ?? '',
  }
}
