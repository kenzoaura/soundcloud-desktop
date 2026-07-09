import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { Heart } from 'lucide-react'
import { useAsync } from '../useAsync'
import TrackList from '../TrackList'
import TrackListSkeleton from '../TrackListSkeleton'
import ErrorState from '../ErrorState'
import CollectionHeader from '../CollectionHeader'
import { usePlayer } from '../../player/store'
import { pushToast } from '../toast/store'
import type { Playlist } from '../../../electron/sc/types'

function LikeButton({ playlist, initial }: { playlist: Playlist; initial: boolean }) {
  const [liked, setLiked] = useState(initial)
  const [busy, setBusy] = useState(false)
  const [pop, setPop] = useState(0)
  useEffect(() => setLiked(initial), [initial])
  const toggle = async () => {
    if (busy) return
    const next = !liked
    setLiked(next)
    if (next) setPop((p) => p + 1)
    setBusy(true)
    // Update the sidebar immediately (the API write + refetch lag a bit).
    window.dispatchEvent(new CustomEvent('sc:playlists-changed', { detail: { playlist, liked: next } }))
    const ok = await window.sc.likePlaylist(playlist.id, next)
    setBusy(false)
    if (ok) {
      pushToast(next ? 'Playlist curtida' : 'Removida das curtidas')
    } else {
      setLiked(!next)
      window.dispatchEvent(new CustomEvent('sc:playlists-changed', { detail: { playlist, liked: !next } }))
      pushToast('Não consegui atualizar', 'error')
    }
  }
  return (
    <button
      onClick={() => void toggle()}
      className={`inline-flex items-center gap-2 px-5 py-2 rounded-full text-sm font-semibold border transition-colors active:scale-95 ${
        liked
          ? 'bg-[var(--accent)] border-[var(--accent)] text-white'
          : 'bg-transparent border-white/25 text-white hover:border-white'
      }`}
    >
      <span key={pop} className={`inline-flex ${pop ? 'like-pop' : ''}`}>
        <Heart size={16} fill={liked ? 'currentColor' : 'none'} />
      </span>
      {liked ? 'Curtida' : 'Curtir'}
    </button>
  )
}

export default function PlaylistView() {
  const { id } = useParams()
  const pid = Number(id)
  const { data, loading, error, reload } = useAsync(() => window.sc.playlist(pid), [id])
  const liked = useAsync(() => window.sc.likedPlaylists(), [])
  const playQueue = usePlayer((s) => s.playQueue)
  const tracks = data?.tracks ?? []
  const isLiked = (liked.data ?? []).some((p) => p.id === pid)

  return (
    <section>
      <CollectionHeader
        artworkUrl={data?.playlist.artworkUrl}
        eyebrow="Playlist"
        title={data?.playlist.title ?? 'Playlist'}
        meta={data ? `${data.playlist.user} · ${tracks.length} faixas` : undefined}
        onPlay={tracks.length > 0 ? () => void playQueue(tracks, 0) : undefined}
      />
      {data && !liked.loading && (
        <div className="px-6 pb-2">
          <LikeButton playlist={data.playlist} initial={isLiked} />
        </div>
      )}
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
