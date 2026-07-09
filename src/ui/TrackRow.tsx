import { useEffect } from 'react'
import { Play, Heart, Clock, Plus, MoreHorizontal } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import type { Track } from '../../electron/sc/types'
import { usePlayer } from '../player/store'
import { useLikes } from '../lib/likes'
import Equalizer from './Equalizer'
import { useContextMenu } from './contextMenu/store'
import { usePlaylistUi, notifyPlaylistsChanged } from './playlist/store'
import { pushToast } from './toast/store'

function fmt(ms: number): string {
  const s = Math.floor(ms / 1000)
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`
}

function compact(n?: number): string {
  if (!n) return '0'
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1).replace('.0', '')}M`
  if (n >= 1_000) return `${(n / 1_000).toFixed(1).replace('.0', '')}K`
  return String(n)
}

export default function TrackRow({
  tracks,
  index,
  liked = false,
  playlistId,
}: {
  tracks: Track[]
  index: number
  liked?: boolean
  playlistId?: number
}) {
  const t = tracks[index]
  const current = usePlayer((s) => s.current)
  const isPlaying = usePlayer((s) => s.isPlaying)
  const playQueue = usePlayer((s) => s.playQueue)
  const enqueue = usePlayer((s) => s.enqueue)
  const openMenu = useContextMenu((s) => s.openMenu)
  const navigate = useNavigate()
  const isCurrent = current?.id === t.id
  const ensureLikes = useLikes((s) => s.ensure)
  const isLiked = useLikes((s) => s.ids.has(t.id)) || liked
  useEffect(() => ensureLikes(), [ensureLikes])

  const openMenuAt = (clientX: number, clientY: number) => {
    const remove = {
      label: 'Remover da playlist',
      onClick: async () => {
        if (playlistId === undefined) return
        const ok = await window.sc.removeFromPlaylist(playlistId, t.id)
        if (ok) {
          pushToast('Removida da playlist')
          notifyPlaylistsChanged()
          window.dispatchEvent(new CustomEvent('sc:playlist-tracks-changed', { detail: { id: playlistId } }))
        } else pushToast('Não consegui remover', 'error')
      },
    }
    openMenu(clientX, clientY, [
      { label: 'Tocar', onClick: () => void playQueue(tracks, index) },
      { label: 'Adicionar à fila', onClick: () => { enqueue(t); pushToast('Adicionado à fila') } },
      { label: 'Adicionar à playlist', onClick: () => usePlaylistUi.getState().openAdd(t) },
      ...(playlistId !== undefined ? [remove] : []),
      { label: 'Abrir faixa', onClick: () => navigate(`/track/${t.id}`) },
      { label: 'Ir para o artista', onClick: () => navigate(`/artist/${t.artistId}`) },
      { label: 'Abrir no SoundCloud', onClick: () => t.permalink && window.sc.openExternal(t.permalink) },
      {
        label: 'Copiar link',
        onClick: () => {
          if (t.permalink) void navigator.clipboard.writeText(t.permalink).then(() => pushToast('Link copiado'))
        },
      },
    ])
  }

  return (
    <div
      onDoubleClick={() => void playQueue(tracks, index)}
      onContextMenu={(e) => {
        e.preventDefault()
        openMenuAt(e.clientX, e.clientY)
      }}
      style={index < 15 ? { animationDelay: `${index * 25}ms` } : undefined}
      className="group anim-slide-up grid grid-cols-[1.75rem_2.75rem_1fr_auto] items-center gap-3 px-3 py-1.5 rounded-md hover:bg-[var(--bg-hover)] cursor-default"
    >
      <button
        onClick={() => void playQueue(tracks, index)}
        className="text-sm text-right grid place-items-center h-4"
        aria-label="Tocar"
      >
        {isCurrent && isPlaying ? (
          <Equalizer />
        ) : (
          <>
            <span className={`group-hover:hidden tabular-nums ${isCurrent ? 'text-[var(--accent)]' : 'text-[var(--text-muted)]'}`}>
              {index + 1}
            </span>
            <Play size={13} className="hidden group-hover:block text-white" fill="currentColor" />
          </>
        )}
      </button>
      <img
        src={t.artworkUrl}
        onClick={() => navigate(`/track/${t.id}`)}
        className="w-11 h-11 rounded object-cover bg-white/5 cursor-pointer"
      />
      <div className="min-w-0">
        <button
          onClick={() => navigate(`/track/${t.id}`)}
          className={`block max-w-full truncate text-sm text-left hover:underline ${isCurrent ? 'text-[var(--accent)]' : 'text-white'}`}
        >
          {t.title}
        </button>
        <button
          onClick={() => navigate(`/artist/${t.artistId}`)}
          className="block max-w-full truncate text-xs text-left text-[var(--text-dim)] hover:text-white hover:underline"
        >
          {t.artist}
        </button>
      </div>
      <div className="flex items-center gap-5 text-[var(--text-dim)]">
        <span className="hidden min-[620px]:flex items-center gap-1.5 text-[13px] tabular-nums w-16 justify-end">
          <Play size={13} className="text-[var(--text-muted)]" fill="currentColor" />
          {compact(t.playbackCount)}
        </span>
        <span className="hidden min-[560px]:flex items-center gap-1.5 text-[13px] tabular-nums w-14 justify-end">
          <Heart
            size={13}
            className={isLiked ? 'text-[var(--accent)]' : 'text-[var(--text-muted)]'}
            fill={isLiked ? 'currentColor' : 'none'}
          />
          {compact(t.likesCount)}
        </span>
        <span className="flex items-center gap-1.5 text-[13px] font-medium text-[var(--text-dim)] tabular-nums pr-1 justify-end">
          <Clock size={13} className="text-[var(--text-muted)]" />
          {fmt(t.durationMs)}
        </span>
        {/* Hover actions: add-to-playlist and the context menu. */}
        <span className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
          <button
            onClick={(e) => {
              e.stopPropagation()
              usePlaylistUi.getState().openAdd(t)
            }}
            className="grid place-items-center w-7 h-7 rounded-full text-[var(--text-dim)] hover:text-white hover:bg-white/10 transition-colors"
            title="Adicionar à playlist"
            aria-label="Adicionar à playlist"
          >
            <Plus size={16} />
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation()
              const r = (e.currentTarget as HTMLElement).getBoundingClientRect()
              openMenuAt(r.right, r.bottom)
            }}
            className="grid place-items-center w-7 h-7 rounded-full text-[var(--text-dim)] hover:text-white hover:bg-white/10 transition-colors"
            title="Mais"
            aria-label="Mais opções"
          >
            <MoreHorizontal size={16} />
          </button>
        </span>
      </div>
    </div>
  )
}
