import { useCallback, useEffect } from 'react'
import type { Track } from '../../electron/sc/types'
import { useLikes } from './likes'
import { toggleTrackLike } from './likeActions'

// Liked state + like toggle for a single track. `liked` is derived directly
// from the global useLikes store (single source of truth, so every heart in the
// app stays in sync); `toggle` performs the imperative optimistic write.
export function useTrackLike(track: Track | null): { liked: boolean; toggle: () => void } {
  const ensure = useLikes((s) => s.ensure)
  const liked = useLikes((s) => (track ? s.ids.has(track.id) : false))
  useEffect(() => ensure(), [ensure])
  const toggle = useCallback(() => {
    if (track) void toggleTrackLike(track)
  }, [track])
  return { liked, toggle }
}
