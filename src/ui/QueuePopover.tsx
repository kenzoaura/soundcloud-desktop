import { useEffect, useRef, useState } from 'react'
import { ListMusic, X, Volume2, Play, Pause } from 'lucide-react'
import { usePlayer } from '../player/store'

function fmt(ms?: number): string {
  if (!ms || !Number.isFinite(ms)) return ''
  const sec = Math.round(ms / 1000)
  return `${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, '0')}`
}

export default function QueuePopover() {
  const queue = usePlayer((s) => s.queue)
  const isPlaying = usePlayer((s) => s.isPlaying)
  const toggle = usePlayer((s) => s.toggle)
  const jumpTo = usePlayer((s) => s.jumpTo)
  const removeFromQueue = usePlayer((s) => s.removeFromQueue)
  const clearQueue = usePlayer((s) => s.clearQueue)
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const onDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onDown)
    return () => document.removeEventListener('mousedown', onDown)
  }, [open])

  const upcoming = queue.tracks.length - queue.index - 1

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen((v) => !v)}
        className={`w-8 h-8 grid place-items-center rounded-full transition-colors ${
          open ? 'text-[var(--accent)] bg-white/5' : 'text-[var(--text-dim)] hover:text-white hover:bg-white/5'
        }`}
        aria-label="Fila"
        title="Fila"
      >
        <ListMusic size={18} />
      </button>

      {open && (
        <div className="absolute bottom-full right-0 mb-3 z-50 w-80 max-h-[26rem] flex flex-col rounded-lg bg-[var(--bg-panel)] border border-[var(--border)] shadow-2xl overflow-hidden anim-pop origin-bottom-right">
          <div className="flex items-center justify-between px-4 py-3 border-b border-[var(--border)] shrink-0">
            <span className="text-sm font-semibold">Fila</span>
            {upcoming > 0 && (
              <button onClick={clearQueue} className="text-xs text-[var(--text-dim)] hover:text-white">
                Limpar
              </button>
            )}
          </div>
          <div className="overflow-y-auto py-1">
            {queue.tracks.map((t, i) => {
              const isCurrent = i === queue.index
              const isPast = i < queue.index
              return (
                <div
                  key={`${t.id}-${i}`}
                  className={`group flex items-center gap-3 px-3 py-2 ${isPast ? 'opacity-40' : ''} hover:bg-white/5`}
                >
                  <div className="relative w-10 h-10 shrink-0">
                    <img src={t.artworkUrl} className="w-full h-full rounded object-cover bg-white/5" />
                    <button
                      onClick={() => (isCurrent ? toggle() : void jumpTo(i))}
                      className="absolute inset-0 grid place-items-center rounded bg-black/45 text-white opacity-0 group-hover:opacity-100 transition-opacity"
                      aria-label={isCurrent && isPlaying ? 'Pausar' : 'Tocar'}
                    >
                      {isCurrent && isPlaying ? (
                        <Pause size={16} fill="currentColor" />
                      ) : (
                        <Play size={16} fill="currentColor" />
                      )}
                    </button>
                  </div>
                  <button
                    onClick={() => void jumpTo(i)}
                    className="flex items-center gap-3 min-w-0 flex-1 text-left"
                  >
                    <div className="min-w-0">
                      <div className={`text-sm truncate ${isCurrent ? 'text-[var(--accent)]' : ''}`}>{t.title}</div>
                      <div className="text-xs text-[var(--text-dim)] truncate">{t.artist}</div>
                    </div>
                  </button>
                  <div className="shrink-0 w-10 flex items-center justify-end">
                    {isCurrent ? (
                      isPlaying ? (
                        <Volume2 size={15} className="text-[var(--accent)]" />
                      ) : (
                        <span className="text-xs text-[var(--text-muted)] tabular-nums">{fmt(t.durationMs)}</span>
                      )
                    ) : (
                      <>
                        <span className="text-xs text-[var(--text-muted)] tabular-nums group-hover:hidden">{fmt(t.durationMs)}</span>
                        <button
                          onClick={() => removeFromQueue(i)}
                          className="hidden group-hover:inline-flex text-[var(--text-muted)] hover:text-white"
                          aria-label="Remover da fila"
                        >
                          <X size={15} />
                        </button>
                      </>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
