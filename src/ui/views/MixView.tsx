import { useLocation } from 'react-router-dom'
import { useAsync } from '../useAsync'
import CollectionHeader from '../CollectionHeader'
import TrackList from '../TrackList'
import TrackListSkeleton from '../TrackListSkeleton'
import EmptyState from '../EmptyState'
import { usePlayer } from '../../player/store'

interface MixState {
  title: string
  trackIds: number[]
  artworkUrl?: string
}

export default function MixView() {
  const { state } = useLocation() as { state?: MixState }
  const ids = state?.trackIds ?? []
  const { data, loading } = useAsync(() => window.sc.tracksByIds(ids.slice(0, 50)), [state?.title, ids.length])
  const playQueue = usePlayer((s) => s.playQueue)
  const playShuffled = usePlayer((s) => s.playShuffled)
  const tracks = data ?? []

  return (
    <section>
      <CollectionHeader
        artworkUrl={state?.artworkUrl}
        eyebrow="Seleção"
        title={state?.title ?? 'Mix'}
        meta={tracks.length > 0 ? `${tracks.length} faixas` : undefined}
        onPlay={tracks.length > 0 ? () => void playQueue(tracks, 0) : undefined}
        onShufflePlay={tracks.length > 0 ? () => void playShuffled(tracks) : undefined}
      />
      {loading ? (
        <TrackListSkeleton />
      ) : tracks.length === 0 ? (
        <EmptyState title="Seleção vazia" />
      ) : (
        <TrackList tracks={tracks} header />
      )}
    </section>
  )
}
