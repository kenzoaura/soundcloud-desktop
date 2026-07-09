import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ExternalLink, LogOut, User as UserIcon, Settings, CircleUser } from 'lucide-react'
import type { User } from '../../electron/sc/types'

export default function AccountChip() {
  const [me, setMe] = useState<User | null>(null)
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  const navigate = useNavigate()
  const go = (to: string) => {
    navigate(to)
    setOpen(false)
  }

  useEffect(() => {
    window.sc.me().then(setMe).catch(() => {})
  }, [])

  useEffect(() => {
    const onDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onDown)
    return () => document.removeEventListener('mousedown', onDown)
  }, [])

  return (
    <div ref={ref} className="relative flex items-center" style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}>
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex items-center gap-2.5 pl-1 pr-3 py-1 rounded-full bg-black/25 hover:bg-black/40 transition-colors"
      >
        {me?.avatarUrl ? (
          <img src={me.avatarUrl} className="w-9 h-9 rounded-full object-cover bg-white/10" />
        ) : (
          <span className="w-9 h-9 rounded-full bg-white/10 grid place-items-center">
            <UserIcon size={18} className="text-gray-300" />
          </span>
        )}
        <span className="text-sm font-semibold text-white max-w-36 truncate max-[560px]:hidden">
          {me?.username ?? '…'}
        </span>
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-2 z-50 w-52 rounded-lg bg-[var(--bg-elevated)] border border-[var(--border)] shadow-xl py-1 text-sm anim-pop origin-top-right">
          <div className="px-3 py-2 border-b border-[var(--border)]">
            <div className="text-white truncate font-medium">{me?.username ?? 'Conta'}</div>
            <div className="text-[var(--text-muted)] text-xs">SoundCloud</div>
          </div>
          {me && (
            <button
              onClick={() => go(`/artist/${me.id}`)}
              className="w-full flex items-center gap-2 px-3 py-2 text-left text-gray-200 hover:bg-[var(--bg-hover)]"
            >
              <CircleUser size={15} /> Meu perfil
            </button>
          )}
          <button
            onClick={() => go('/settings')}
            className="w-full flex items-center gap-2 px-3 py-2 text-left text-gray-200 hover:bg-[var(--bg-hover)]"
          >
            <Settings size={15} /> Configurações
          </button>
          <button
            onClick={() => {
              if (me?.permalink) window.sc.openExternal(me.permalink)
              setOpen(false)
            }}
            className="w-full flex items-center gap-2 px-3 py-2 text-left text-gray-200 hover:bg-[var(--bg-hover)]"
          >
            <ExternalLink size={15} /> Ver no SoundCloud
          </button>
          <button
            onClick={() => void window.sc.logout()}
            className="w-full flex items-center gap-2 px-3 py-2 text-left text-gray-200 hover:bg-[var(--bg-hover)]"
          >
            <LogOut size={15} /> Sair
          </button>
        </div>
      )}
    </div>
  )
}
