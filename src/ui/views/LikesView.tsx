import { Heart } from 'lucide-react'
import { useAsync } from '../useAsync'
import TrackList from '../TrackList'
import TrackListSkeleton from '../TrackListSkeleton'
import EmptyState from '../EmptyState'
import ErrorState from '../ErrorState'
import CollectionHeader from '../CollectionHeader'
import { usePlayer } from '../../player/store'

export default function LikesView() {
  const { data, loading, error, reload } = useAsync(() => window.sc.likes(50), [])
  const playQueue = usePlayer((s) => s.playQueue)
  const tracks = data ?? []

  return (
    <section>
      <CollectionHeader
        eyebrow="Coleção"
        title="Curtidas"
        meta={tracks.length > 0 ? `${tracks.length} faixas` : undefined}
        onPlay={tracks.length > 0 ? () => void playQueue(tracks, 0) : undefined}
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
        <TrackList tracks={tracks} header />
      )}
    </section>
  )
}
