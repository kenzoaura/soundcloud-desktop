import { create } from 'zustand'
import type { Track, Playlist } from '../../../electron/sc/types'

// Which playlist dialog is open (create / add-track-to / rename). Driven from
// the sidebar button, track context menus and the playlist header.
type Modal =
  | { kind: 'create'; seedTrackId?: number }
  | { kind: 'add'; track: Track }
  | { kind: 'rename'; playlist: Playlist }
  | null

interface PlaylistUi {
  modal: Modal
  openCreate: (seedTrackId?: number) => void
  openAdd: (track: Track) => void
  openRename: (playlist: Playlist) => void
  close: () => void
}

export const usePlaylistUi = create<PlaylistUi>((set) => ({
  modal: null,
  openCreate: (seedTrackId) => set({ modal: { kind: 'create', seedTrackId } }),
  openAdd: (track) => set({ modal: { kind: 'add', track } }),
  openRename: (playlist) => set({ modal: { kind: 'rename', playlist } }),
  close: () => set({ modal: null }),
}))

// Any playlist mutation fires this so the sidebar (and open views) re-sync.
export function notifyPlaylistsChanged(): void {
  window.dispatchEvent(new CustomEvent('sc:playlists-changed'))
}

// A freshly created playlist (already confirmed by the server). The sidebar
// shows it right away, then reconciles with a refetch a moment later.
export function notifyPlaylistCreated(playlist: Playlist): void {
  window.dispatchEvent(new CustomEvent('sc:playlist-created', { detail: { playlist } }))
}
