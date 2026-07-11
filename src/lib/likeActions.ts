import { usePlayer } from '../player/store'
import { useLikes } from './likes'
import { pushToast } from '../ui/toast/store'

// Imperative like toggle for the currently-playing track, for non-React callers
// (keyboard shortcut). Mirrors useTrackLike's optimistic-write-then-revert flow
// but without the React hook machinery.
export async function toggleCurrentLike(): Promise<void> {
  const track = usePlayer.getState().current
  if (!track) return
  const likes = useLikes.getState()
  const next = !likes.ids.has(track.id)
  likes.set(track.id, next) // optimistic
  const ok = await window.sc.likeTrack(track.id, next).catch(() => false)
  if (ok) {
    window.dispatchEvent(new CustomEvent('sc:likes-changed', { detail: { track, liked: next } }))
  } else {
    likes.set(track.id, !next) // revert
    pushToast('Não consegui atualizar', 'error')
  }
}
