import { useParams } from 'react-router-dom'
import { useAsync } from '../useAsync'
import TrackList from '../TrackList'
import TrackListSkeleton from '../TrackListSkeleton'
import ErrorState from '../ErrorState'
import CollectionHeader from '../CollectionHeader'
import { usePlayer } from '../../player/store'

export default function PlaylistView() {
  const { id } = useParams()
  const { data, loading, error, reload } = useAsync(() => window.sc.playlist(Number(id)), [id])
  const playQueue = usePlayer((s) => s.playQueue)
  const tracks = data?.tracks ?? []

  return (
    <section>
      <CollectionHeader
        artworkUrl={data?.playlist.artworkUrl}
        eyebrow="Playlist"
        title={data?.playlist.title ?? 'Playlist'}
        meta={data ? `${data.playlist.user} · ${tracks.length} faixas` : undefined}
        onPlay={tracks.length > 0 ? () => void playQueue(tracks, 0) : undefined}
      />
      {loading ? (
        <TrackListSkeleton />
      ) : error ? (
        <ErrorState onRetry={reload} />
      ) : (
        <TrackList tracks={tracks} header />
      )}
    </section>
  )
}
