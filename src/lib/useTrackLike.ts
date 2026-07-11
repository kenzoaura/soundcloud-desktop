import { useEffect } from 'react'
import type { Track } from '../../electron/sc/types'
import { useLikes } from './likes'
import { useToggleSync } from '../ui/useToggleSync'
import { pushToast } from '../ui/toast/store'

// Liked state + optimistic like toggle for a single track, backed by the global
// useLikes store so every heart in the app (rows, player, now-playing) stays in
// sync. Writes are debounced/coalesced by useToggleSync.
export function useTrackLike(track: Track | null): { liked: boolean; toggle: () => void } {
  const ensure = useLikes((s) => s.ensure)
  const setLike = useLikes((s) => s.set)
  const liked = useLikes((s) => (track ? s.ids.has(track.id) : false))
  useEffect(() => ensure(), [ensure])

  const { on, toggle } = useToggleSync(
    liked,
    async (next) => {
      if (!track) return false
      const ok = await window.sc.likeTrack(track.id, next)
      if (ok)
        window.dispatchEvent(new CustomEvent('sc:likes-changed', { detail: { track, liked: next } }))
      return ok
    },
    {
      onChange: (next) => {
        if (track) setLike(track.id, next)
      },
      onFail: () => pushToast('Não consegui atualizar', 'error'),
    },
  )

  return { liked: track ? on : false, toggle }
}
