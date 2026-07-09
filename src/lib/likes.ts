import { create } from 'zustand'
import type { Track } from '../../electron/sc/types'

// Global set of the logged-in user's liked track ids, so every TrackRow can
// render a filled heart for tracks the user has liked — anywhere in the app.
interface LikesState {
  ids: Set<number>
  loaded: boolean
  ensure: () => void
  set: (id: number, liked: boolean) => void
}

export const useLikes = create<LikesState>((set, get) => ({
  ids: new Set(),
  loaded: false,
  ensure: () => {
    if (get().loaded) return
    set({ loaded: true })
    window.sc
      .likedTrackIds()
      .then((ids) => set({ ids: new Set(ids) }))
      .catch(() => set({ loaded: false }))
  },
  set: (id, liked) =>
    set((s) => {
      const ids = new Set(s.ids)
      if (liked) ids.add(id)
      else ids.delete(id)
      return { ids }
    }),
}))

// Keep the store in sync with like toggles fired elsewhere (track page, etc).
window.addEventListener('sc:likes-changed', (e) => {
  const detail = (e as CustomEvent).detail as { track?: Track; liked?: boolean } | undefined
  if (detail?.track) useLikes.getState().set(detail.track.id, detail.liked ?? false)
})
