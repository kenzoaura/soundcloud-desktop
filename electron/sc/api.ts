import { webWrite, webRequest } from './webWrite'
import type { AuthSession } from '../auth/session'
import type { ClientId } from './clientId'
import type { Track, User, Playlist, HomeSelection, HomeItem, Comment, AppNotification } from './types'
import { normalizeTrack, normalizeUser, normalizePlaylist, bestArtwork } from './normalize'

const BASE = 'https://api-v2.soundcloud.com'

export class ScApi {
  // Cache resolved playlist promises by id: dedupes concurrent calls (React
  // StrictMode double-mounts in dev) and makes re-opening a playlist instant.
  private playlistCache = new Map<number, Promise<{ playlist: Playlist; tracks: Track[] } | null>>()

  constructor(private session: AuthSession, private clientId: ClientId) {}

  private async get(path: string, params: Record<string, string | number> = {}): Promise<unknown> {
    const cid = await this.clientId.get()
    const url = new URL(BASE + path)
    url.searchParams.set('client_id', cid)
    for (const [k, v] of Object.entries(params)) url.searchParams.set(k, String(v))
    const token = this.session.token()
    const res = await fetch(url.toString(), {
      headers: token ? { Authorization: `OAuth ${token}` } : {},
    })
    if (res.status === 401) {
      this.session.onUnauthorized()
      throw new Error('unauthorized')
    }
    if (res.status === 403) {
      this.clientId.invalidate()
      throw new Error('forbidden (client_id?)')
    }
    if (!res.ok) throw new Error(`api ${res.status}`)
    try {
      return await res.json()
    } catch {
      throw new Error('invalid JSON from api')
    }
  }

  // Write request (like/follow/repost). Routed through webWrite (hidden
  // soundcloud.com page) so it passes DataDome; a bare request gets a 403.
  private async mutate(method: 'POST' | 'PUT' | 'DELETE', apiPath: string): Promise<number> {
    const cid = await this.clientId.get()
    const url = `${BASE}${apiPath}?client_id=${encodeURIComponent(cid)}`
    const status = await webWrite(method, url, this.session.token())
    if (status === 401) {
      this.session.onUnauthorized()
      throw new Error('unauthorized')
    }
    return status
  }

  async me(): Promise<User | null> {
    return normalizeUser(await this.get('/me'))
  }

  async likePlaylist(playlistId: number, like: boolean): Promise<boolean> {
    const uid = await this.meId()
    const status = await this.mutate(like ? 'PUT' : 'DELETE', `/users/${uid}/playlist_likes/${playlistId}`)
    return status >= 200 && status < 300
  }

  private async meId(): Promise<number> {
    const me = (await this.get('/me')) as { id?: number }
    if (typeof me.id !== 'number') throw new Error('no me id')
    return me.id
  }

  async likeTrack(trackId: number, like: boolean): Promise<boolean> {
    const uid = await this.meId()
    const status = await this.mutate(like ? 'PUT' : 'DELETE', `/users/${uid}/track_likes/${trackId}`)
    return status >= 200 && status < 300
  }

  async repostTrack(trackId: number, repost: boolean): Promise<boolean> {
    const status = await this.mutate(repost ? 'PUT' : 'DELETE', `/me/track_reposts/${trackId}`)
    return status >= 200 && status < 300
  }

  async followUser(userId: number, follow: boolean): Promise<boolean> {
    const status = await this.mutate(follow ? 'POST' : 'DELETE', `/me/followings/${userId}`)
    return status >= 200 && status < 300
  }

  // Ids of everyone the logged-in user follows, so the UI can show the right
  // follow-button state. Best-effort: returns [] if the endpoint is unavailable.
  async followingIds(): Promise<number[]> {
    return this.idList('/me/followings/ids')
  }

  // Ids of tracks the user has liked / reposted, for correct button state.
  async likedTrackIds(): Promise<number[]> {
    return this.idList('/me/track_likes/ids')
  }

  async repostedTrackIds(): Promise<number[]> {
    return this.idList('/me/track_reposts/ids')
  }

  private async idList(path: string): Promise<number[]> {
    try {
      const data = (await this.get(path, { limit: 5000 })) as { collection?: unknown }
      const arr = Array.isArray(data.collection) ? data.collection : []
      return arr.filter((x): x is number => typeof x === 'number')
    } catch {
      return []
    }
  }

  // NOTE: the SoundCloud v2 notifications endpoint isn't nailed down yet (the
  // candidates tried return 404). Kept best-effort for the future; returns [].
  async notifications(limit = 30): Promise<AppNotification[]> {
    let raw: unknown[] = []
    try {
      const data = (await this.get('/notifications', { limit })) as { collection?: unknown[] }
      raw = Array.isArray(data.collection) ? data.collection : []
    } catch {
      return []
    }
    const out: AppNotification[] = []
    for (const it of raw) {
      const r = (it ?? {}) as Record<string, unknown>
      const type = typeof r.type === 'string' ? r.type : ''
      const actor = ((r.user as Record<string, unknown>) ?? {}) as Record<string, unknown>
      const track = (r.track as Record<string, unknown>) ?? undefined
      const playlist = (r.playlist as Record<string, unknown>) ?? undefined
      const target = track ?? playlist
      let kind: AppNotification['kind'] = 'other'
      if (type.includes('follow') || type.includes('affiliation')) kind = 'follow'
      else if (type.includes('like')) kind = 'like'
      else if (type.includes('comment')) kind = 'comment'
      else if (type.includes('repost')) kind = 'repost'
      out.push({
        id: String(r.id ?? `${type}-${out.length}`),
        kind,
        userId: typeof actor.id === 'number' ? actor.id : undefined,
        userName: typeof actor.username === 'string' ? actor.username : '',
        userAvatar: bestArtwork(typeof actor.avatar_url === 'string' ? actor.avatar_url : undefined),
        targetKind: track ? 'faixa' : playlist ? 'playlist' : undefined,
        targetTitle: target && typeof target.title === 'string' ? target.title : undefined,
        targetArtwork: bestArtwork(
          target && typeof target.artwork_url === 'string' ? (target.artwork_url as string) : undefined,
        ),
        trackId: track && typeof track.id === 'number' ? track.id : undefined,
        createdAt: typeof r.created_at === 'string' ? r.created_at : undefined,
      })
    }
    return out
  }

  async home(): Promise<HomeSelection[]> {
    const data = (await this.get('/mixed-selections', { limit: 20 })) as { collection?: unknown[] }
    const cols = Array.isArray(data.collection) ? data.collection : []
    const out: HomeSelection[] = []
    for (const sel of cols) {
      const s = sel as Record<string, unknown>
      const rawItems = ((s.items as Record<string, unknown>)?.collection ?? []) as unknown[]
      const items: HomeItem[] = []
      for (const it of rawItems) {
        const r = (it ?? {}) as Record<string, unknown>
        const title = typeof r.title === 'string' ? r.title : ''
        if (!title) continue
        const artRaw =
          (typeof r.calculated_artwork_url === 'string' && r.calculated_artwork_url) ||
          (typeof r.artwork_url === 'string' && r.artwork_url) ||
          undefined
        const tks = Array.isArray(r.tracks) ? (r.tracks as Record<string, unknown>[]) : []
        const trackIds = tks
          .map((t) => (typeof t.id === 'number' ? t.id : null))
          .filter((x): x is number => x !== null)
        if (trackIds.length === 0) continue
        items.push({
          title,
          artworkUrl: bestArtwork(artRaw),
          permalink: typeof r.permalink_url === 'string' ? r.permalink_url : '',
          trackIds,
        })
      }
      const title = typeof s.title === 'string' ? s.title : ''
      if (title && items.length) out.push({ id: String(s.urn ?? title), title, items })
    }
    return out
  }

  async tracksByIds(ids: number[]): Promise<Track[]> {
    return this.hydrateTracks(ids)
  }

  // SoundCloud charts: kind 'top' (most played) or 'trending' (rising), for a
  // genre urn like "soundcloud:genres:all-music". The collection embeds only
  // stubs, so hydrate the ids for full track data.
  // The v2 /charts endpoint is gated for our client_id (400/404), so "explore by
  // genre" is backed by a search. Use /search/tracks (tracks-only) instead of the
  // mixed /search, otherwise most of the `limit` results are users/playlists and
  // only a handful of tracks come back.
  async genreTracks(term: string, limit = 50): Promise<Track[]> {
    const data = (await this.get('/search/tracks', { q: term, limit })) as { collection?: unknown[] }
    const out: Track[] = []
    for (const raw of Array.isArray(data.collection) ? data.collection : []) {
      const t = normalizeTrack(raw)
      if (t) out.push(t)
    }
    return out
  }

  async track(id: number): Promise<Track | null> {
    return normalizeTrack(await this.get(`/tracks/${id}`))
  }

  async trackRelated(id: number, limit = 12): Promise<Track[]> {
    const data = (await this.get(`/tracks/${id}/related`, { limit })) as { collection?: unknown[] }
    const out: Track[] = []
    for (const raw of Array.isArray(data.collection) ? data.collection : []) {
      const t = normalizeTrack(raw)
      if (t) out.push(t)
    }
    return out
  }

  async trackComments(id: number, limit = 40): Promise<Comment[]> {
    const data = (await this.get(`/tracks/${id}/comments`, { limit, threaded: 0 })) as { collection?: unknown[] }
    const out: Comment[] = []
    for (const raw of Array.isArray(data.collection) ? data.collection : []) {
      const c = raw as Record<string, unknown>
      const cid = typeof c.id === 'number' ? c.id : null
      const body = typeof c.body === 'string' ? c.body : ''
      if (cid === null || !body) continue
      const u = (c.user ?? {}) as Record<string, unknown>
      out.push({
        id: cid,
        body,
        atMs: typeof c.timestamp === 'number' ? c.timestamp : 0,
        userName: typeof u.username === 'string' ? u.username : '',
        userAvatar: bestArtwork(typeof u.avatar_url === 'string' ? u.avatar_url : undefined),
        createdAt: typeof c.created_at === 'string' ? c.created_at : '',
      })
    }
    return out
  }

  // "Top listeners" isn't exposed by the API v2; the closest public data is who
  // liked the track. Returns those users.
  async trackLikers(id: number, limit = 15): Promise<User[]> {
    const data = (await this.get(`/tracks/${id}/likers`, { limit })) as { collection?: unknown[] }
    const out: User[] = []
    for (const raw of Array.isArray(data.collection) ? data.collection : []) {
      const u = normalizeUser(raw)
      if (u) out.push(u)
    }
    return out
  }

  async playHistory(limit = 25): Promise<Track[]> {
    const data = (await this.get('/me/play-history/tracks', { limit })) as { collection?: unknown[] }
    const out: Track[] = []
    for (const it of Array.isArray(data.collection) ? data.collection : []) {
      const t = normalizeTrack((it as Record<string, unknown>)?.track ?? it)
      if (t) out.push(t)
    }
    return out
  }

  async likes(userId: number, limit = 50): Promise<Track[]> {
    const data = (await this.get(`/users/${userId}/track_likes`, { limit })) as { collection?: unknown[] }
    const items = Array.isArray(data.collection) ? data.collection : []
    const out: Track[] = []
    for (const it of items) {
      const track = (it as Record<string, unknown>)?.track ?? it
      const t = normalizeTrack(track)
      if (t) out.push(t)
    }
    return out
  }

  async search(q: string, limit = 20): Promise<{ tracks: Track[]; users: User[]; playlists: Playlist[] }> {
    const data = (await this.get('/search', { q, limit })) as { collection?: unknown[] }
    const tracks: Track[] = []
    const users: User[] = []
    const playlists: Playlist[] = []
    for (const raw of Array.isArray(data.collection) ? data.collection : []) {
      const kind = (raw as Record<string, unknown>)?.kind
      if (kind === 'track') {
        const t = normalizeTrack(raw)
        if (t) tracks.push(t)
      } else if (kind === 'user') {
        const u = normalizeUser(raw)
        if (u) users.push(u)
      } else if (kind === 'playlist') {
        const p = normalizePlaylist(raw)
        if (p) playlists.push(p)
      }
    }
    return { tracks, users, playlists }
  }

  // Playlists the user has liked (shown in the sidebar alongside own playlists).
  async likedPlaylists(userId: number, limit = 50): Promise<Playlist[]> {
    const data = (await this.get(`/users/${userId}/playlist_likes`, { limit })) as { collection?: unknown[] }
    const out: Playlist[] = []
    for (const it of Array.isArray(data.collection) ? data.collection : []) {
      const p = normalizePlaylist((it as Record<string, unknown>)?.playlist ?? it)
      if (p) out.push(p)
    }
    return out
  }

  async playlists(userId: number): Promise<Playlist[]> {
    const data = (await this.get(`/users/${userId}/playlists`, { limit: 50 })) as { collection?: unknown[] }
    const out: Playlist[] = []
    for (const raw of Array.isArray(data.collection) ? data.collection : []) {
      const p = normalizePlaylist(raw)
      if (p) out.push(p)
    }
    return out
  }

  async playlist(id: number): Promise<{ playlist: Playlist; tracks: Track[] } | null> {
    const cached = this.playlistCache.get(id)
    if (cached) return cached
    const p = this.fetchPlaylist(id)
    this.playlistCache.set(id, p)
    // Drop the entry if it failed so a later open can retry.
    p.catch(() => this.playlistCache.delete(id))
    return p
  }

  private async fetchPlaylist(id: number): Promise<{ playlist: Playlist; tracks: Track[] } | null> {
    const raw = (await this.get(`/playlists/${id}`)) as Record<string, unknown>
    const playlist = normalizePlaylist(raw)
    if (!playlist) return null
    // SoundCloud only fully embeds the first ~5 tracks; the rest are id-only
    // stubs. Collect every id and hydrate them via /tracks?ids= in batches.
    const list = Array.isArray(raw.tracks) ? (raw.tracks as Record<string, unknown>[]) : []
    const ids = list
      .map((t) => (typeof t.id === 'number' ? t.id : null))
      .filter((x): x is number => x !== null)
    const tracks = await this.hydrateTracks(ids)
    return { playlist, tracks }
  }

  // Fetch full track objects for the given ids (batched, max 50 per request),
  // returned in the original id order. Batches run in parallel so a large
  // playlist costs ~one round-trip instead of N sequential ones.
  private async hydrateTracks(ids: number[]): Promise<Track[]> {
    const chunks: number[][] = []
    for (let i = 0; i < ids.length; i += 50) chunks.push(ids.slice(i, i + 50))
    const results = await Promise.all(
      chunks.map((chunk) => this.get('/tracks', { ids: chunk.join(',') }).catch(() => [])),
    )
    const byId = new Map<number, Track>()
    for (const data of results) {
      const arr = Array.isArray(data) ? data : []
      for (const raw of arr) {
        const t = normalizeTrack(raw)
        if (t) byId.set(t.id, t)
      }
    }
    const out: Track[] = []
    for (const id of ids) {
      const t = byId.get(id)
      if (t) out.push(t)
    }
    return out
  }

  async feed(limit = 40): Promise<Track[]> {
    const data = (await this.get('/stream', { limit })) as { collection?: unknown[] }
    const out: Track[] = []
    for (const it of Array.isArray(data.collection) ? data.collection : []) {
      const t = normalizeTrack((it as Record<string, unknown>)?.track)
      if (t) out.push(t)
    }
    return out
  }

  async user(id: number): Promise<User | null> {
    return normalizeUser(await this.get(`/users/${id}`))
  }

  async userTracks(id: number, limit = 40): Promise<Track[]> {
    const data = (await this.get(`/users/${id}/tracks`, { limit })) as { collection?: unknown[] }
    const out: Track[] = []
    for (const raw of Array.isArray(data.collection) ? data.collection : []) {
      const t = normalizeTrack(raw)
      if (t) out.push(t)
    }
    return out
  }

  // --- Playlist CRUD (write; routed through webRequest to pass DataDome) ---

  async createPlaylist(title: string, isPublic: boolean, trackIds: number[] = []): Promise<Playlist | null> {
    const cid = await this.clientId.get()
    const url = `${BASE}/playlists?client_id=${encodeURIComponent(cid)}`
    const body = {
      playlist: { title, sharing: isPublic ? 'public' : 'private', tracks: trackIds },
    }
    const { status, data } = await webRequest('POST', url, this.session.token(), body)
    if (status < 200 || status >= 300) return null
    return normalizePlaylist(data)
  }

  async addToPlaylist(playlistId: number, trackId: number): Promise<boolean> {
    const ids = await this.playlistTrackIds(playlistId)
    if (ids.includes(trackId)) return true
    ids.push(trackId)
    return this.putPlaylist(playlistId, { tracks: ids })
  }

  async removeFromPlaylist(playlistId: number, trackId: number): Promise<boolean> {
    const ids = (await this.playlistTrackIds(playlistId)).filter((x) => x !== trackId)
    return this.putPlaylist(playlistId, { tracks: ids })
  }

  // Persist a new track order. The caller supplies the FULL ordered id list
  // (a playlist PUT replaces the whole track set).
  async reorderPlaylist(playlistId: number, orderedTrackIds: number[]): Promise<boolean> {
    // The caller passes the desired order of the tracks it can see. Reconcile
    // with the authoritative server id list so tracks that failed to hydrate in
    // the UI are never dropped: keep the requested order, then append the rest.
    const authoritative = await this.playlistTrackIds(playlistId)
    const requested = orderedTrackIds.filter((id) => authoritative.includes(id))
    const missing = authoritative.filter((id) => !requested.includes(id))
    return this.putPlaylist(playlistId, { tracks: [...requested, ...missing] })
  }

  async renamePlaylist(playlistId: number, title: string): Promise<boolean> {
    return this.putPlaylist(playlistId, { title })
  }

  async deletePlaylist(playlistId: number): Promise<boolean> {
    const status = await this.mutate('DELETE', `/playlists/${playlistId}`)
    this.playlistCache.delete(playlistId)
    return status >= 200 && status < 300
  }

  // The full current track-id list, needed because a playlist PUT replaces the
  // whole track set (omitting ids would drop those tracks).
  private async playlistTrackIds(id: number): Promise<number[]> {
    const raw = (await this.get(`/playlists/${id}`)) as Record<string, unknown>
    const list = Array.isArray(raw.tracks) ? (raw.tracks as Record<string, unknown>[]) : []
    return list.map((t) => (typeof t.id === 'number' ? t.id : null)).filter((x): x is number => x !== null)
  }

  private async putPlaylist(id: number, patch: Record<string, unknown>): Promise<boolean> {
    const cid = await this.clientId.get()
    const url = `${BASE}/playlists/${id}?client_id=${encodeURIComponent(cid)}`
    const { status } = await webRequest('PUT', url, this.session.token(), { playlist: patch })
    this.playlistCache.delete(id) // force a fresh fetch next time it's opened
    return status >= 200 && status < 300
  }

  async followers(id: number, limit = 60): Promise<User[]> {
    return this.userList(`/users/${id}/followers`, limit)
  }

  async followings(id: number, limit = 60): Promise<User[]> {
    return this.userList(`/users/${id}/followings`, limit)
  }

  private async userList(path: string, limit: number): Promise<User[]> {
    const data = (await this.get(path, { limit })) as { collection?: unknown[] }
    const out: User[] = []
    for (const raw of Array.isArray(data.collection) ? data.collection : []) {
      const u = normalizeUser(raw)
      if (u) out.push(u)
    }
    return out
  }
}
