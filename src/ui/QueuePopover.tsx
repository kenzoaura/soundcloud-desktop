import { useEffect, useRef, useState } from 'react'
import { ListMusic, X, Volume2 } from 'lucide-react'
import { usePlayer } from '../player/store'

export default function QueuePopover() {
  const queue = usePlayer((s) => s.queue)
  const isPlaying = usePlayer((s) => s.isPlaying)
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
        className={open ? 'text-[var(--accent)]' : 'text-[var(--text-dim)] hover:text-white'}
        aria-label="Fila"
        title="Fila"
      >
        <ListMusic size={18} />
      </button>

      {open && (
        <div className="absolute bottom-full right-0 mb-3 w-80 max-h-[26rem] flex flex-col rounded-lg bg-[var(--bg-panel)] border border-[var(--border)] shadow-2xl overflow-hidden anim-slide-up">
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
                  <button
                    onClick={() => void jumpTo(i)}
                    className="flex items-center gap-3 min-w-0 flex-1 text-left"
                  >
                    <img src={t.artworkUrl} className="w-10 h-10 rounded object-cover bg-white/5 shrink-0" />
                    <div className="min-w-0">
                      <div className={`text-sm truncate ${isCurrent ? 'text-[var(--accent)]' : ''}`}>{t.title}</div>
                      <div className="text-xs text-[var(--text-dim)] truncate">{t.artist}</div>
                    </div>
                  </button>
                  {isCurrent ? (
                    isPlaying && <Volume2 size={15} className="text-[var(--accent)] shrink-0" />
                  ) : (
                    <button
                      onClick={() => removeFromQueue(i)}
                      className="opacity-0 group-hover:opacity-100 text-[var(--text-muted)] hover:text-white shrink-0"
                      aria-label="Remover da fila"
                    >
                      <X size={15} />
                    </button>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
