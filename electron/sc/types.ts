export interface Transcoding { url: string; protocol: 'progressive' | 'hls'; mimeType: string }
export interface Track {
  id: number
  title: string
  durationMs: number
  artworkUrl?: string
  permalink: string
  artist: string
  artistId: number
  transcodings: Transcoding[]
  waveformUrl?: string
  playbackCount?: number
  likesCount?: number
  repostsCount?: number
  commentCount?: number
  createdAt?: string
}

export interface Comment {
  id: number
  body: string
  atMs: number
  userName: string
  userAvatar?: string
  createdAt: string
}

export interface Fan {
  id: number
  username: string
  avatarUrl?: string
  plays: number
}
export interface User {
  id: number
  username: string
  avatarUrl?: string
  permalink: string
  bannerUrl?: string
  followersCount?: number
  followingsCount?: number
  likesCount?: number
  trackCount?: number
  playlistCount?: number
  description?: string
  verified?: boolean
  city?: string
  country?: string
}
export interface Playlist {
  id: number; title: string; artworkUrl?: string; trackCount: number; user: string; permalink: string
}
export interface HomeItem {
  title: string
  artworkUrl?: string
  permalink: string
  trackIds: number[]
}
export interface HomeSelection {
  id: string
  title: string
  items: HomeItem[]
}

export interface AppNotification {
  id: string
  // follow | like | comment | repost | other
  kind: 'follow' | 'like' | 'comment' | 'repost' | 'other'
  userId?: number
  userName: string
  userAvatar?: string
  // What was acted on ("faixa", "playlist") + its title, when applicable.
  targetKind?: string
  targetTitle?: string
  targetArtwork?: string
  trackId?: number
  createdAt?: string
}
