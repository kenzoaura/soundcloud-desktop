import { useEffect, useState } from 'react'
import { NavLink } from 'react-router-dom'
import { Home, Heart } from 'lucide-react'
import type { Playlist } from '../../electron/sc/types'
import { Skeleton } from './Skeleton'
import { useT } from './strings'

const link =
  'flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium text-[var(--text-dim)] hover:text-white hover:bg-[var(--bg-hover)] transition-colors max-[900px]:justify-center'

function cls({ isActive }: { isActive: boolean }) {
  return `${link} ${isActive ? 'text-white bg-[var(--bg-hover)]' : ''}`
}

export default function Sidebar() {
  const t = useT()
  const [playlists, setPlaylists] = useState<Playlist[]>([])
  const [loading, setLoading] = useState(true)
  useEffect(() => {
    window.sc
      .playlists()
      .then(setPlaylists)
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  return (
    <nav className="w-60 max-[900px]:w-16 shrink-0 rounded-lg bg-[var(--bg-panel)] flex flex-col p-2 overflow-hidden">
      <NavLink to="/" end className={cls}>
        <Home size={18} />
        <span className="max-[900px]:hidden">{t('nav.home')}</span>
      </NavLink>
      <NavLink to="/likes" className={cls}>
        <Heart size={18} />
        <span className="max-[900px]:hidden">{t('nav.likes')}</span>
      </NavLink>

      <div className="mt-3 pt-3 border-t border-[var(--border)] flex-1 overflow-y-auto max-[900px]:hidden">
        <div className="px-3 pb-2 text-[11px] font-semibold uppercase tracking-wider text-[var(--text-muted)]">
          {t('nav.playlists')}
        </div>
        {loading
          ? Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="flex items-center gap-3 px-3 py-2">
                <Skeleton className="h-9 w-9 shrink-0" />
                <Skeleton className="h-3 flex-1" />
              </div>
            ))
          : playlists.map((p) => (
              <NavLink
                key={p.id}
                to={`/playlist/${p.id}`}
                className={({ isActive }) =>
                  `flex items-center gap-3 px-3 py-1.5 rounded-md text-sm transition-colors hover:bg-[var(--bg-hover)] ${
                    isActive ? 'bg-[var(--bg-hover)]' : ''
                  }`
                }
              >
                <img src={p.artworkUrl} className="w-9 h-9 rounded object-cover bg-white/5 shrink-0" />
                <div className="min-w-0">
                  <div className="truncate text-[var(--text-dim)]">{p.title}</div>
                  <div className="truncate text-[11px] text-[var(--text-muted)]">Playlist · {p.user}</div>
                </div>
              </NavLink>
            ))}
      </div>
    </nav>
  )
}
