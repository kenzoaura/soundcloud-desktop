import { ipcRenderer, contextBridge } from 'electron'
import { IPC, type PlayerCommand } from './ipc'
import type { Track } from './sc/types'

contextBridge.exposeInMainWorld('windowControls', {
  minimize: () => ipcRenderer.send(IPC.WINDOW_MINIMIZE),
  toggleMaximize: () => ipcRenderer.send(IPC.WINDOW_MAXIMIZE),
  close: () => ipcRenderer.send(IPC.WINDOW_CLOSE),
  isMaximized: () => ipcRenderer.invoke(IPC.WINDOW_IS_MAXIMIZED),
})

contextBridge.exposeInMainWorld('sc', {
  me: () => ipcRenderer.invoke(IPC.SC_ME),
  likes: (limit?: number) => ipcRenderer.invoke(IPC.SC_LIKES, limit),
  streamUrl: (track: Track) => ipcRenderer.invoke(IPC.SC_STREAM_URL, track),
  search: (q: string) => ipcRenderer.invoke(IPC.SC_SEARCH, q),
  playlists: () => ipcRenderer.invoke(IPC.SC_PLAYLISTS),
  playlist: (id: number) => ipcRenderer.invoke(IPC.SC_PLAYLIST, id),
  feed: () => ipcRenderer.invoke(IPC.SC_FEED),
  user: (id: number) => ipcRenderer.invoke(IPC.SC_USER, id),
  userTracks: (id: number) => ipcRenderer.invoke(IPC.SC_USER_TRACKS, id),
  userPlaylists: (id: number) => ipcRenderer.invoke(IPC.SC_USER_PLAYLISTS, id),
  userLikes: (id: number) => ipcRenderer.invoke(IPC.SC_USER_LIKES, id),
  home: () => ipcRenderer.invoke(IPC.SC_HOME),
  playHistory: () => ipcRenderer.invoke(IPC.SC_PLAY_HISTORY),
  tracksByIds: (ids: number[]) => ipcRenderer.invoke(IPC.SC_TRACKS_BY_IDS, ids),
  track: (id: number) => ipcRenderer.invoke(IPC.SC_TRACK, id),
  trackRelated: (id: number) => ipcRenderer.invoke(IPC.SC_TRACK_RELATED, id),
  trackComments: (id: number) => ipcRenderer.invoke(IPC.SC_TRACK_COMMENTS, id),
  trackLikers: (id: number) => ipcRenderer.invoke(IPC.SC_TRACK_LIKERS, id),
  likeTrack: (id: number, like: boolean) => ipcRenderer.invoke(IPC.SC_LIKE_TRACK, id, like),
  repostTrack: (id: number, repost: boolean) => ipcRenderer.invoke(IPC.SC_REPOST_TRACK, id, repost),
  followUser: (id: number, follow: boolean) => ipcRenderer.invoke(IPC.SC_FOLLOW_USER, id, follow),
  followingIds: () => ipcRenderer.invoke(IPC.SC_FOLLOWING_IDS),
  notifications: () => ipcRenderer.invoke(IPC.SC_NOTIFICATIONS),
  logout: () => ipcRenderer.invoke(IPC.AUTH_LOGOUT),
  openExternal: (url: string) => ipcRenderer.send(IPC.OPEN_EXTERNAL, url),
  coverBytes: (url: string) => ipcRenderer.invoke(IPC.COVER_BYTES, url),
  waveform: (url: string) => ipcRenderer.invoke(IPC.SC_WAVEFORM, url),
})

contextBridge.exposeInMainWorld('player', {
  reportProgress: (s: unknown) => ipcRenderer.send(IPC.PLAYER_PROGRESS, s),
  onCommand: (cb: (cmd: PlayerCommand) => void) =>
    ipcRenderer.on(IPC.PLAYER_COMMAND, (_e, cmd: PlayerCommand) => cb(cmd)),
})

contextBridge.exposeInMainWorld('settings', {
  get: () => ipcRenderer.invoke(IPC.SETTINGS_GET),
  set: (patch: unknown) => ipcRenderer.invoke(IPC.SETTINGS_SET, patch),
})
