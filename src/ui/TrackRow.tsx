import { Play } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import type { Track } from '../../electron/sc/types'
import { usePlayer } from '../player/store'
import Equalizer from './Equalizer'
import { useContextMenu } from './contextMenu/store'
import { pushToast } from './toast/store'

function fmt(ms: number): string {
  const s = Math.floor(ms / 1000)
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`
}

export default function TrackRow({ tracks, index }: { tracks: Track[]; index: number }) {
  const t = tracks[index]
  const current = usePlayer((s) => s.current)
  const isPlaying = usePlayer((s) => s.isPlaying)
  const playQueue = usePlayer((s) => s.playQueue)
  const enqueue = usePlayer((s) => s.enqueue)
  const openMenu = useContextMenu((s) => s.openMenu)
  const navigate = useNavigate()
  const isCurrent = current?.id === t.id

  const onContext = (e: React.MouseEvent) => {
    e.preventDefault()
    openMenu(e.clientX, e.clientY, [
      { label: 'Tocar', onClick: () => void playQueue(tracks, index) },
      { label: 'Adicionar à fila', onClick: () => { enqueue(t); pushToast('Adicionado à fila') } },
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
      onContextMenu={onContext}
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
      <span className="text-xs text-[var(--text-muted)] tabular-nums pr-1">{fmt(t.durationMs)}</span>
    </div>
  )
}
