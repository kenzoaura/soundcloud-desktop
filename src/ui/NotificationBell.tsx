import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Bell } from 'lucide-react'
import { useAsync } from './useAsync'
import type { AppNotification } from '../../electron/sc/types'

function relative(iso?: string): string {
  if (!iso) return ''
  const d = new Date(iso).getTime()
  if (Number.isNaN(d)) return ''
  const min = Math.floor((Date.now() - d) / 60000)
  if (min < 60) return `há ${Math.max(1, min)}min`
  const h = Math.floor(min / 60)
  if (h < 24) return `há ${h}h`
  const days = Math.floor(h / 24)
  return `há ${days}d`
}

function text(n: AppNotification): string {
  const alvo = n.targetTitle ? ` "${n.targetTitle}"` : ''
  const tk = n.targetKind ?? 'faixa'
  switch (n.kind) {
    case 'follow':
      return 'começou a seguir você'
    case 'like':
      return `curtiu sua ${tk}${alvo}`
    case 'comment':
      return `comentou na sua ${tk}${alvo}`
    case 'repost':
      return `repostou sua ${tk}${alvo}`
    default:
      return 'interagiu com você'
  }
}

export default function NotificationBell() {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  const navigate = useNavigate()
  const { data, loading, reload } = useAsync(() => window.sc.notifications(), [])
  const items = data ?? []

  useEffect(() => {
    if (!open) return
    void reload()
    const onDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onDown)
    return () => document.removeEventListener('mousedown', onDown)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  const go = (n: AppNotification) => {
    setOpen(false)
    if (n.trackId) navigate(`/track/${n.trackId}`)
    else if (n.userId) navigate(`/artist/${n.userId}`)
  }

  return (
    <div className="relative" ref={ref} style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}>
      <button
        onClick={() => setOpen((v) => !v)}
        className={`w-9 h-9 rounded-full grid place-items-center transition-colors ${
          open ? 'bg-white/10 text-white' : 'text-[var(--text-dim)] hover:text-white hover:bg-white/5'
        }`}
        aria-label="Notificações"
        title="Notificações"
      >
        <Bell size={18} />
      </button>

      {open && (
        <div className="absolute top-full right-0 mt-2 w-96 max-h-[70vh] flex flex-col rounded-lg bg-[var(--bg-panel)] border border-[var(--border)] shadow-2xl overflow-hidden anim-slide-up">
          <div className="px-4 py-3 border-b border-[var(--border)] shrink-0">
            <span className="text-base font-bold">Notificações</span>
          </div>
          <div className="overflow-y-auto">
            {loading && <div className="px-4 py-6 text-sm text-[var(--text-muted)]">Carregando…</div>}
            {!loading && items.length === 0 && (
              <div className="px-4 py-8 text-sm text-[var(--text-muted)] text-center">Nada por aqui ainda</div>
            )}
            {items.map((n) => (
              <button
                key={n.id}
                onClick={() => go(n)}
                className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-white/5 border-b border-[var(--border)]/50"
              >
                <img src={n.userAvatar} className="w-10 h-10 rounded-full object-cover bg-white/10 shrink-0" />
                <div className="min-w-0 flex-1">
                  <div className="text-sm text-[var(--text-dim)] leading-snug">
                    <span className="font-semibold text-white">{n.userName}</span> {text(n)}
                  </div>
                  <div className="text-xs text-[var(--text-muted)] mt-0.5">{relative(n.createdAt)}</div>
                </div>
                {n.targetArtwork && (
                  <img src={n.targetArtwork} className="w-11 h-11 rounded object-cover bg-white/5 shrink-0" />
                )}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
