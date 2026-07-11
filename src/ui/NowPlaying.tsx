import { useEffect, useState } from 'react'
import {
  ChevronDown,
  SkipBack,
  SkipForward,
  Play,
  Pause,
  Shuffle,
  Repeat,
  Repeat1,
  ListMusic,
} from 'lucide-react'
import { usePlayer } from '../player/store'
import { getCoverColor, rgbToCss, type RGB } from '../lib/color'
import Waveform from './Waveform'

function fmt(sec: number): string {
  if (!Number.isFinite(sec)) return '0:00'
  return `${Math.floor(sec / 60)}:${String(Math.floor(sec % 60)).padStart(2, '0')}`
}

export default function NowPlaying() {
  const s = usePlayer()
  const open = usePlayer((st) => st.nowPlayingOpen)
  const setNowPlaying = usePlayer((st) => st.setNowPlaying)
  const [color, setColor] = useState<RGB | null>(null)
  const [queueOpen, setQueueOpen] = useState(false)

  useEffect(() => {
    if (!s.current?.artworkUrl) {
      setColor(null)
      return
    }
    getCoverColor(s.current.artworkUrl).then(setColor)
    // Only recompute the tint when the artwork changes, not on every store update.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [s.current?.artworkUrl])

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setNowPlaying(false)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, setNowPlaying])

  if (!open || !s.current) return null
  const base = color ?? { r: 40, g: 40, b: 40 }
  const upcoming = s.queue.tracks.slice(s.queue.index + 1)

  return (
    <div className="fixed inset-0 z-40 overflow-hidden bg-[var(--bg-app)]">
      {/* Ambient blurred cover backdrop */}
      <img
        src={s.current.artworkUrl}
        aria-hidden
        className="absolute inset-0 w-full h-full object-cover blur-[80px] scale-125 opacity-40"
      />
      <div
        className="absolute inset-0"
        style={{ background: `linear-gradient(180deg, ${rgbToCss(base, 0.5)} 0%, rgba(10,10,10,0.85) 65%, var(--bg-app) 100%)` }}
      />

      <div className="relative h-full flex flex-col anim-slide-up">
        {/* top bar */}
        <div
          className="h-9 flex items-center justify-between px-4"
          style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}
        >
          <button onClick={() => setNowPlaying(false)} className="text-gray-300 hover:text-white" aria-label="Fechar">
            <ChevronDown size={22} />
          </button>
          <button
            onClick={() => setQueueOpen((q) => !q)}
            className={queueOpen ? 'text-[var(--accent)]' : 'text-gray-300 hover:text-white'}
            aria-label="Fila"
          >
            <ListMusic size={20} />
          </button>
        </div>

        <div className="flex-1 flex min-h-0">
          {/* main */}
          <div className="flex-1 flex flex-col items-center justify-center gap-7 px-6 min-h-0">
            <img
              src={s.current.artworkUrl}
              className="w-72 h-72 max-h-[42vh] rounded-2xl object-cover shadow-2xl bg-white/5"
            />
            <div className="text-center max-w-2xl px-4">
              <div className="display text-4xl truncate">{s.current.title}</div>
              <div className="text-[var(--text-dim)] text-lg truncate mt-2">{s.current.artist}</div>
            </div>
            <div className="w-full max-w-3xl flex items-center gap-3">
              <span className="text-xs text-[var(--text-muted)] w-10 text-right tabular-nums">{fmt(s.position)}</span>
              {s.current.waveformUrl ? (
                <Waveform
                  url={s.current.waveformUrl}
                  progress={s.duration ? s.position / s.duration : 0}
                  onSeek={(f) => s.seek(f * s.duration)}
                  bars={160}
                  className="flex-1 h-20"
                />
              ) : (
                <input
                  type="range"
                  min={0}
                  max={s.duration || 0}
                  value={s.position}
                  onChange={(e) => s.seek(Number(e.target.value))}
                  className="flex-1 h-1 accent-[var(--accent)] cursor-pointer"
                />
              )}
              <span className="text-xs text-[var(--text-muted)] w-10 tabular-nums">{fmt(s.duration)}</span>
            </div>
            <div className="flex items-center gap-6">
              <button onClick={s.toggleShuffle} className={s.shuffle ? 'text-[var(--accent)]' : 'text-[var(--text-dim)] hover:text-white'} aria-label="Aleatório">
                <Shuffle size={20} />
              </button>
              <button onClick={() => void s.previous()} className="text-gray-200 hover:text-white" aria-label="Anterior">
                <SkipBack size={26} fill="currentColor" />
              </button>
              <button
                onClick={s.toggle}
                className="w-16 h-16 rounded-full bg-white text-black grid place-items-center hover:scale-105 active:scale-95 transition-transform"
                aria-label={s.isPlaying ? 'Pausar' : 'Tocar'}
              >
                {s.isPlaying ? <Pause size={26} fill="currentColor" /> : <Play size={26} fill="currentColor" />}
              </button>
              <button onClick={() => void s.next()} className="text-gray-200 hover:text-white" aria-label="Próxima">
                <SkipForward size={26} fill="currentColor" />
              </button>
              <button onClick={s.cycleRepeat} className={s.repeat !== 'off' ? 'text-[var(--accent)]' : 'text-[var(--text-dim)] hover:text-white'} aria-label="Repetir">
                {s.repeat === 'one' ? <Repeat1 size={20} /> : <Repeat size={20} />}
              </button>
            </div>
          </div>

          {/* queue panel */}
          {queueOpen && (
            <aside className="w-80 max-[900px]:w-64 shrink-0 border-l border-white/10 bg-black/25 backdrop-blur-md overflow-y-auto p-3 anim-fade-in">
              <div className="eyebrow px-2 pb-2">A seguir</div>
              {upcoming.length === 0 && <div className="px-2 text-sm text-[var(--text-muted)]">Fim da fila.</div>}
              {upcoming.map((t, i) => (
                <button
                  key={`${t.id}-${i}`}
                  onClick={() => void s.playQueue(s.queue.tracks, s.queue.index + 1 + i)}
                  className="w-full flex items-center gap-3 px-2 py-1.5 rounded-md hover:bg-white/10 text-left"
                >
                  <img src={t.artworkUrl} className="w-10 h-10 rounded object-cover bg-white/5 shrink-0" />
                  <div className="min-w-0">
                    <div className="text-sm truncate">{t.title}</div>
                    <div className="text-xs text-[var(--text-dim)] truncate">{t.artist}</div>
                  </div>
                </button>
              ))}
            </aside>
          )}
        </div>
      </div>
    </div>
  )
}
