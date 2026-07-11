import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { Heart, Pencil, Trash2 } from 'lucide-react'
import { useAsync } from '../useAsync'
import TrackList from '../TrackList'
import TrackListSkeleton from '../TrackListSkeleton'
import ErrorState from '../ErrorState'
import CollectionHeader from '../CollectionHeader'
import { usePlayer } from '../../player/store'
import { usePlaylistUi, notifyPlaylistsChanged } from '../playlist/store'
import { useToggleSync } from '../useToggleSync'
import { pushToast } from '../toast/store'
import type { Playlist } from '../../../electron/sc/types'

function LikeButton({ playlist, initial }: { playlist: Playlist; initial: boolean }) {
  const [pop, setPop] = useState(0)
  const { on: liked, toggle } = useToggleSync(
    initial,
    async (next) => {
      const ok = await window.sc.likePlaylist(playlist.id, next)
      if (!ok) {
        // Roll the sidebar back to the confirmed state on failure.
        window.dispatchEvent(new CustomEvent('sc:playlists-changed', { detail: { playlist, liked: !next } }))
      }
      return ok
    },
    {
      onChange: (next) => {
        if (next) setPop((p) => p + 1)
        // Reflect in the sidebar immediately (optimistic).
        window.dispatchEvent(new CustomEvent('sc:playlists-changed', { detail: { playlist, liked: next } }))
      },
      onFail: () => pushToast('Não consegui atualizar', 'error'),
    },
  )
  return (
    <button
      onClick={toggle}
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
  const navigate = useNavigate()
  const { data, loading, error, reload } = useAsync(() => window.sc.playlist(pid), [id])
  const liked = useAsync(() => window.sc.likedPlaylists(), [])
  const own = useAsync(() => window.sc.playlists(), [])
  const openRename = usePlaylistUi((s) => s.openRename)
  const playQueue = usePlayer((s) => s.playQueue)
  const tracks = data?.tracks ?? []
  const isLiked = (liked.data ?? []).some((p) => p.id === pid)
  const isOwner = (own.data ?? []).some((p) => p.id === pid)

  // Reload when a track is removed here or the playlist is renamed elsewhere.
  useEffect(() => {
    const onCh = (e: Event) => {
      if ((e as CustomEvent).detail?.id === pid) reload()
    }
    window.addEventListener('sc:playlist-tracks-changed', onCh)
    window.addEventListener('sc:playlist-renamed', onCh)
    return () => {
      window.removeEventListener('sc:playlist-tracks-changed', onCh)
      window.removeEventListener('sc:playlist-renamed', onCh)
    }
  }, [pid, reload])

  const del = async () => {
    if (!data) return
    if (!window.confirm(`Excluir a playlist "${data.playlist.title}"? Isso não pode ser desfeito.`)) return
    const ok = await window.sc.deletePlaylist(pid)
    if (ok) {
      notifyPlaylistsChanged()
      pushToast('Playlist excluída')
      navigate('/')
    } else pushToast('Não consegui excluir', 'error')
  }

  return (
    <section>
      <CollectionHeader
        artworkUrl={data?.playlist.artworkUrl}
        eyebrow="Playlist"
        title={data?.playlist.title ?? 'Playlist'}
        creatorId={data?.playlist.userId}
        creatorName={data?.playlist.user}
        meta={data ? `${tracks.length} faixas` : undefined}
        onPlay={tracks.length > 0 ? () => void playQueue(tracks, 0) : undefined}
      />
      {data && (
        <div className="px-6 pb-2 flex items-center gap-3">
          {isOwner ? (
            <>
              <button
                onClick={() => openRename(data.playlist)}
                className="inline-flex items-center gap-2 px-5 py-2 rounded-full text-sm font-semibold border border-white/25 text-white hover:border-white transition-colors active:scale-95"
              >
                <Pencil size={15} />
                Renomear
              </button>
              <button
                onClick={() => void del()}
                className="inline-flex items-center gap-2 px-5 py-2 rounded-full text-sm font-semibold border border-white/25 text-white hover:border-[var(--error,#e5484d)] hover:text-[var(--error,#e5484d)] transition-colors active:scale-95"
              >
                <Trash2 size={15} />
                Excluir
              </button>
            </>
          ) : (
            !liked.loading && <LikeButton playlist={data.playlist} initial={isLiked} />
          )}
        </div>
      )}
      {loading ? (
        <TrackListSkeleton />
      ) : error ? (
        <ErrorState onRetry={reload} />
      ) : (
        <TrackList tracks={tracks} header playlistId={isOwner ? pid : undefined} />
      )}
    </section>
  )
}
