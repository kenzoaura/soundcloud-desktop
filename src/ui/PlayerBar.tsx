import { useEffect, useState } from 'react'
import { SkipBack, SkipForward, Play, Pause, Shuffle, Repeat, Repeat1 } from 'lucide-react'
import { usePlayer } from '../player/store'
import { getCoverColor, rgbToCss } from '../lib/color'
import Waveform from './Waveform'
import VolumeControl from './VolumeControl'
import QueuePopover from './QueuePopover'

function fmt(sec: number): string {
  if (!Number.isFinite(sec)) return '0:00'
  return `${Math.floor(sec / 60)}:${String(Math.floor(sec % 60)).padStart(2, '0')}`
}

export default function PlayerBar() {
  const s = usePlayer()
  const setNowPlaying = usePlayer((st) => st.setNowPlaying)
  const [dragging, setDragging] = useState(false)
  const [tint, setTint] = useState<string>('transparent')

  useEffect(() => {
    const url = s.current?.artworkUrl
    if (!url) {
      setTint('transparent')
      return
    }
    getCoverColor(url).then((c) => setTint(c ? rgbToCss(c, 0.12) : 'transparent'))
  }, [s.current?.artworkUrl])

  if (!s.current) {
    return <footer className="h-20 shrink-0 bg-[var(--bg-titlebar)] border-t border-[var(--border)]" />
  }
  const pct = s.duration ? (s.position / s.duration) * 100 : 0
  return (
    <footer
      className="h-20 shrink-0 border-t border-[var(--border)] grid grid-cols-[1fr_2fr_1fr] items-center px-4 gap-4 transition-colors duration-500"
      style={{ backgroundColor: 'var(--bg-titlebar)', backgroundImage: `linear-gradient(0deg, ${tint}, ${tint})` }}
    >
      {/* Now playing — click opens the expanded view */}
      <button
        onClick={() => setNowPlaying(true)}
        className="flex items-center gap-3 min-w-0 text-left group"
        aria-label="Abrir tocando agora"
      >
        <img
          src={s.current.artworkUrl}
          className="w-14 h-14 rounded object-cover bg-white/5 group-hover:brightness-110 transition"
        />
        <div className="min-w-0">
          <div className="text-sm truncate group-hover:underline">{s.current.title}</div>
          <div className="text-xs text-[var(--text-dim)] truncate">{s.current.artist}</div>
        </div>
      </button>

      {/* Controls */}
      <div className="flex flex-col items-center justify-center gap-2 w-full max-w-[540px] mx-auto">
        <div className="flex items-center gap-6">
          <button
            onClick={s.toggleShuffle}
            className={`transition-colors ${s.shuffle ? 'text-[var(--accent)]' : 'text-[var(--text-dim)] hover:text-white'}`}
            aria-label="Aleatório"
          >
            <Shuffle size={16} />
          </button>
          <button onClick={() => void s.previous()} className="text-[var(--text-dim)] hover:text-white transition-colors" aria-label="Anterior">
            <SkipBack size={18} fill="currentColor" />
          </button>
          <button
            onClick={s.toggle}
            className="w-9 h-9 rounded-full bg-white text-black grid place-items-center hover:scale-105 active:scale-95 transition-transform"
            aria-label={s.isPlaying ? 'Pausar' : 'Tocar'}
          >
            {s.isPlaying ? <Pause size={16} fill="currentColor" /> : <Play size={16} fill="currentColor" className="ml-0.5" />}
          </button>
          <button onClick={() => void s.next()} className="text-[var(--text-dim)] hover:text-white transition-colors" aria-label="Próxima">
            <SkipForward size={18} fill="currentColor" />
          </button>
          <button
            onClick={s.cycleRepeat}
            className={`transition-colors ${s.repeat !== 'off' ? 'text-[var(--accent)]' : 'text-[var(--text-dim)] hover:text-white'}`}
            aria-label="Repetir"
          >
            {s.repeat === 'one' ? <Repeat1 size={16} /> : <Repeat size={16} />}
          </button>
        </div>
        {/* Fixed-height progress row so the layout never jumps between tracks
            with and without a waveform. */}
        <div className="w-full flex items-center gap-2.5 h-7">
          <span className="text-[11px] text-[var(--text-muted)] w-9 text-right tabular-nums shrink-0">{fmt(s.position)}</span>
          {s.current.waveformUrl ? (
            <Waveform
              url={s.current.waveformUrl}
              progress={pct / 100}
              onSeek={(f) => s.seek(f * s.duration)}
              bars={64}
              className="flex-1 h-7"
            />
          ) : (
            <div className="flex-1 relative h-1 group">
              <div className="absolute inset-0 rounded-full bg-white/15" />
              <div
                className={`absolute inset-y-0 left-0 rounded-full bg-[var(--accent)] ${
                  dragging ? '' : 'transition-[width] duration-1000 ease-linear'
                }`}
                style={{ width: `${pct}%` }}
              />
              <input
                type="range"
                min={0}
                max={s.duration || 0}
                value={s.position}
                onMouseDown={() => setDragging(true)}
                onMouseUp={() => setDragging(false)}
                onChange={(e) => s.seek(Number(e.target.value))}
                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                aria-label="Progresso"
              />
            </div>
          )}
          <span className="text-[11px] text-[var(--text-muted)] w-9 tabular-nums shrink-0">{fmt(s.duration)}</span>
        </div>
      </div>

      {/* Queue + Volume */}
      <div className="flex items-center justify-end gap-3">
        <QueuePopover />
        <div className="max-[720px]:hidden">
          <VolumeControl />
        </div>
      </div>
    </footer>
  )
}
