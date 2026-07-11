import type { Track } from '../../../electron/sc/types'
import type { MenuItem } from './store'
import { usePlaylistUi, notifyPlaylistsChanged } from '../playlist/store'
import { pushToast } from '../toast/store'

export interface TrackMenuContext {
  track: Track
  tracks: Track[]
  index: number
  playlistId?: number
  navigate: (path: string) => void
  playQueue: (tracks: Track[], startIndex: number) => void
  playNext: (track: Track) => void
  enqueue: (track: Track) => void
}

// The shared right-click menu for a track, reused by TrackRow and the PlayerBar
// now-playing artwork.
export function buildTrackMenu(ctx: TrackMenuContext): MenuItem[] {
  const { track: t, tracks, index, playlistId, navigate, playQueue, playNext, enqueue } = ctx
  const remove: MenuItem = {
    label: 'Remover da playlist',
    onClick: async () => {
      if (playlistId === undefined) return
      const ok = await window.sc.removeFromPlaylist(playlistId, t.id)
      if (ok) {
        pushToast('Removida da playlist')
        notifyPlaylistsChanged()
        window.dispatchEvent(new CustomEvent('sc:playlist-tracks-changed', { detail: { id: playlistId } }))
      } else pushToast('Não consegui remover', 'error')
    },
  }
  return [
    { label: 'Tocar', onClick: () => void playQueue(tracks, index) },
    { label: 'Tocar a seguir', onClick: () => { playNext(t); pushToast('Tocará a seguir') } },
    { label: 'Adicionar à fila', onClick: () => { enqueue(t); pushToast('Adicionado à fila') } },
    { label: 'Adicionar à playlist', onClick: () => usePlaylistUi.getState().openAdd(t) },
    ...(playlistId !== undefined ? [remove] : []),
    { label: 'Abrir faixa', onClick: () => navigate(`/track/${t.id}`) },
    { label: 'Ir para o artista', onClick: () => navigate(`/artist/${t.artistId}`) },
    { label: 'Abrir no SoundCloud', onClick: () => t.permalink && window.sc.openExternal(t.permalink) },
    {
      label: 'Copiar link',
      onClick: () => {
        if (t.permalink) void navigator.clipboard.writeText(t.permalink).then(() => pushToast('Link copiado'))
      },
    },
  ]
}
