import type { Track, Transcoding } from './types'

export function pickTranscoding(track: Track, pref: 'progressive' | 'hls' = 'progressive'): Transcoding | null {
  const wanted = track.transcodings.find((t) => t.protocol === pref)
  if (wanted) return wanted
  const other = track.transcodings.find((t) => t.protocol === (pref === 'progressive' ? 'hls' : 'progressive'))
  return other ?? null
}

export interface ResolvedStream {
  url: string
  protocol: 'progressive' | 'hls'
}

export async function resolveStreamUrl(
  track: Track,
  clientId: string,
  token: string | null,
  pref: 'progressive' | 'hls' = 'progressive',
): Promise<ResolvedStream | null> {
  const tc = pickTranscoding(track, pref)
  if (!tc) return null
  const u = new URL(tc.url)
  u.searchParams.set('client_id', clientId)
  try {
    const res = await fetch(u.toString(), {
      headers: token ? { Authorization: `OAuth ${token}` } : {},
    })
    if (!res.ok) return null
    const data = (await res.json()) as { url?: string }
    if (!data.url) return null
    return { url: data.url, protocol: tc.protocol }
  } catch {
    return null
  }
}
