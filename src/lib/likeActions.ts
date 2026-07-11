import type { Track } from '../../electron/sc/types'
import { usePlayer } from '../player/store'
import { useLikes } from './likes'
import { pushToast } from '../ui/toast/store'

// Imperative optimistic like toggle for a specific track: flip the global
// useLikes store immediately, write to SoundCloud, and revert on failure. Used
// by the like hook (for any track) and the L keyboard shortcut (current track).
export async function toggleTrackLike(track: Track): Promise<void> {
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

// The L shortcut: toggle like on the currently-playing track.
export async function toggleCurrentLike(): Promise<void> {
  const track = usePlayer.getState().current
  if (track) await toggleTrackLike(track)
}
