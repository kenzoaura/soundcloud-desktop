import { useEffect, useState } from 'react'
import { Heart } from 'lucide-react'
import { useAsync } from '../useAsync'
import TrackList from '../TrackList'
import TrackListSkeleton from '../TrackListSkeleton'
import EmptyState from '../EmptyState'
import ErrorState from '../ErrorState'
import CollectionHeader from '../CollectionHeader'
import { usePlayer } from '../../player/store'
import type { Track } from '../../../electron/sc/types'

export default function LikesView() {
  const { data, loading, error, reload } = useAsync(() => window.sc.likes(50), [])
  const playQueue = usePlayer((s) => s.playQueue)
  const playShuffled = usePlayer((s) => s.playShuffled)
  const [tracks, setTracks] = useState<Track[]>([])

  useEffect(() => {
    if (data) setTracks(data)
  }, [data])

  // React instantly to a like/unlike, then reconcile with the server (the API
  // list lags a moment after the write).
  useEffect(() => {
    const onChange = (e: Event) => {
      const detail = (e as CustomEvent).detail as { track?: Track; liked?: boolean } | undefined
      if (detail?.track) {
        const { track, liked } = detail
        setTracks((prev) =>
          liked
            ? prev.some((t) => t.id === track.id)
              ? prev
              : [track, ...prev]
            : prev.filter((t) => t.id !== track.id),
        )
      }
      setTimeout(() => void reload(), 2500)
    }
    window.addEventListener('sc:likes-changed', onChange)
    return () => window.removeEventListener('sc:likes-changed', onChange)
  }, [reload])

  return (
    <section>
      <CollectionHeader
        eyebrow="Coleção"
        title="Curtidas"
        meta={tracks.length > 0 ? `${tracks.length} faixas` : undefined}
        onPlay={tracks.length > 0 ? () => void playQueue(tracks, 0) : undefined}
        onShufflePlay={tracks.length > 0 ? () => void playShuffled(tracks) : undefined}
      />
      {loading ? (
        <TrackListSkeleton />
      ) : error ? (
        <ErrorState onRetry={reload} />
      ) : tracks.length === 0 ? (
        <EmptyState
          icon={<Heart size={28} />}
          title="Sem curtidas ainda"
          subtitle="As faixas que você curtir no SoundCloud aparecem aqui."
        />
      ) : (
        <TrackList tracks={tracks} header liked />
      )}
    </section>
  )
}
