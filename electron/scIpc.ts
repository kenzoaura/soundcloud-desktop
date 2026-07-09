import { ipcMain } from 'electron'
import { IPC } from './ipc'
import type { ScApi } from './sc/api'
import type { ClientId } from './sc/clientId'
import type { AuthSession } from './auth/session'
import type { Track } from './sc/types'
import { resolveStreamUrl } from './sc/stream'
import { getSettings } from './settings'

export function registerScIpc(api: ScApi, clientId: ClientId, session: AuthSession): void {
  let userId: number | null = null

  ipcMain.handle(IPC.SC_ME, async () => {
    const me = await api.me()
    if (me) userId = me.id
    return me
  })

  ipcMain.handle(IPC.SC_LIKES, async (_e, limit?: number) => {
    if (userId === null) {
      const me = await api.me()
      userId = me ? me.id : null
    }
    if (userId === null) return []
    return api.likes(userId, limit ?? 50)
  })

  ipcMain.handle(IPC.SC_STREAM_URL, async (_e, track: Track) => {
    const cid = await clientId.get()
    return resolveStreamUrl(track, cid, session.token(), getSettings().streamPref)
  })

  ipcMain.handle(IPC.SC_SEARCH, (_e, q: string) => api.search(q))

  ipcMain.handle(IPC.SC_PLAYLISTS, async () => {
    if (userId === null) {
      const me = await api.me()
      userId = me ? me.id : null
    }
    return userId === null ? [] : api.playlists(userId)
  })

  ipcMain.handle(IPC.SC_PLAYLIST, (_e, id: number) => api.playlist(id))
  ipcMain.handle(IPC.SC_FEED, () => api.feed())
  ipcMain.handle(IPC.SC_USER, (_e, id: number) => api.user(id))
  ipcMain.handle(IPC.SC_USER_TRACKS, (_e, id: number) => api.userTracks(id))
  ipcMain.handle(IPC.SC_USER_PLAYLISTS, (_e, id: number) => api.playlists(id))
  ipcMain.handle(IPC.SC_USER_LIKES, (_e, id: number) => api.likes(id))
  ipcMain.handle(IPC.SC_HOME, () => api.home())
  ipcMain.handle(IPC.SC_PLAY_HISTORY, () => api.playHistory())
  ipcMain.handle(IPC.SC_TRACKS_BY_IDS, (_e, ids: number[]) => api.tracksByIds(ids))
  ipcMain.handle(IPC.SC_TRACK, (_e, id: number) => api.track(id))
  ipcMain.handle(IPC.SC_TRACK_RELATED, (_e, id: number) => api.trackRelated(id))
  ipcMain.handle(IPC.SC_TRACK_COMMENTS, (_e, id: number) => api.trackComments(id))
  ipcMain.handle(IPC.SC_TRACK_LIKERS, (_e, id: number) => api.trackLikers(id))
  ipcMain.handle(IPC.SC_LIKE_TRACK, (_e, id: number, like: boolean) => api.likeTrack(id, like))
  ipcMain.handle(IPC.SC_REPOST_TRACK, (_e, id: number, repost: boolean) => api.repostTrack(id, repost))
  ipcMain.handle(IPC.SC_FOLLOW_USER, (_e, id: number, follow: boolean) => api.followUser(id, follow))
  ipcMain.handle(IPC.SC_FOLLOWING_IDS, () => api.followingIds())
  ipcMain.handle(IPC.SC_NOTIFICATIONS, () => api.notifications())
}
