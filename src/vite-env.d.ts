/// <reference types="vite/client" />

interface WindowControls {
  minimize(): void
  toggleMaximize(): void
  close(): void
  isMaximized(): Promise<boolean>
}

type ScTrack = import('../electron/sc/types').Track
type ScUser = import('../electron/sc/types').User
type ScPlaylist = import('../electron/sc/types').Playlist
type ScHomeSelection = import('../electron/sc/types').HomeSelection
type ScComment = import('../electron/sc/types').Comment
type ScNotification = import('../electron/sc/types').AppNotification

interface ScBridge {
  me(): Promise<ScUser | null>
  likes(limit?: number): Promise<ScTrack[]>
  streamUrl(track: ScTrack): Promise<{ url: string; protocol: 'progressive' | 'hls' } | null>
  search(q: string): Promise<{ tracks: ScTrack[]; users: ScUser[]; playlists: ScPlaylist[] }>
  playlists(): Promise<ScPlaylist[]>
  likedPlaylists(): Promise<ScPlaylist[]>
  likePlaylist(id: number, like: boolean): Promise<boolean>
  createPlaylist(title: string, isPublic: boolean, trackIds?: number[]): Promise<ScPlaylist | null>
  addToPlaylist(playlistId: number, trackId: number): Promise<boolean>
  removeFromPlaylist(playlistId: number, trackId: number): Promise<boolean>
  renamePlaylist(id: number, title: string): Promise<boolean>
  deletePlaylist(id: number): Promise<boolean>
  playlist(id: number): Promise<{ playlist: ScPlaylist; tracks: ScTrack[] } | null>
  feed(): Promise<ScTrack[]>
  user(id: number): Promise<ScUser | null>
  userTracks(id: number): Promise<ScTrack[]>
  userPlaylists(id: number): Promise<ScPlaylist[]>
  userLikes(id: number): Promise<ScTrack[]>
  userFollowers(id: number): Promise<ScUser[]>
  userFollowings(id: number): Promise<ScUser[]>
  home(): Promise<ScHomeSelection[]>
  playHistory(): Promise<ScTrack[]>
  tracksByIds(ids: number[]): Promise<ScTrack[]>
  genreTracks(term: string): Promise<ScTrack[]>
  track(id: number): Promise<ScTrack | null>
  trackRelated(id: number): Promise<ScTrack[]>
  trackComments(id: number): Promise<ScComment[]>
  trackLikers(id: number): Promise<ScUser[]>
  likeTrack(id: number, like: boolean): Promise<boolean>
  repostTrack(id: number, repost: boolean): Promise<boolean>
  followUser(id: number, follow: boolean): Promise<boolean>
  followingIds(): Promise<number[]>
  likedTrackIds(): Promise<number[]>
  repostedTrackIds(): Promise<number[]>
  notifications(): Promise<ScNotification[]>
  logout(): Promise<void>
  openExternal(url: string): void
  coverBytes(url: string): Promise<string | null>
  waveform(url: string): Promise<number[] | null>
}

interface PlayerBridge {
  reportProgress(
    s: {
      title: string
      artist: string
      artworkUrl?: string
      url?: string
      durationSec: number
      positionSec: number
      isPlaying: boolean
    } | null,
  ): void
  onCommand(cb: (cmd: 'toggle' | 'next' | 'previous') => void): void
}

interface AppSettings {
  zoom: number
  theme: 'dark' | 'slate' | 'warm' | 'violet' | 'ocean'
  language: 'pt' | 'en'
  discordEnabled: boolean
  closeToTray: boolean
  streamPref: 'progressive' | 'hls'
  startWithWindows: boolean
  notifications: boolean
  reduceMotion: boolean
  volume: number
  autoplay: boolean
}
interface SettingsBridge {
  get(): Promise<AppSettings>
  set(patch: Partial<AppSettings>): Promise<AppSettings>
}

interface UpdateStatus {
  state: 'checking' | 'up-to-date' | 'available' | 'downloading' | 'downloaded' | 'error' | string
  version?: string
  percent?: number
  message?: string
}
interface UpdaterBridge {
  check(): Promise<string>
  version(): Promise<string>
  onStatus(cb: (s: UpdateStatus) => void): void
}

interface Window {
  windowControls: WindowControls
  sc: ScBridge
  player: PlayerBridge
  settings: SettingsBridge
  updater: UpdaterBridge
}
