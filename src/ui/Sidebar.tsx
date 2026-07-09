import { useEffect, useState } from 'react'
import { NavLink } from 'react-router-dom'
import { Home, Heart, Compass } from 'lucide-react'
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
    Promise.all([
      window.sc.playlists().catch(() => [] as Playlist[]),
      window.sc.likedPlaylists().catch(() => [] as Playlist[]),
    ])
      .then(([own, liked]) => {
        // Own playlists first, then liked ones, de-duplicated by id.
        const seen = new Set(own.map((p) => p.id))
        setPlaylists([...own, ...liked.filter((p) => !seen.has(p.id))])
      })
      .finally(() => setLoading(false))
  }, [])

  return (
    <nav className="w-60 max-[900px]:w-16 shrink-0 rounded-lg bg-[var(--bg-panel)] flex flex-col p-2 overflow-hidden">
      <NavLink to="/" end className={cls}>
        <Home size={18} />
        <span className="max-[900px]:hidden">{t('nav.home')}</span>
      </NavLink>
      <NavLink to="/charts" className={cls}>
        <Compass size={18} />
        <span className="max-[900px]:hidden">{t('nav.charts')}</span>
      </NavLink>
      <NavLink to="/likes" className={cls}>
        <Heart size={18} />
        <span className="max-[900px]:hidden">{t('nav.likes')}</span>
      </NavLink>

      <div className="mt-3 pt-3 border-t border-[var(--border)] flex-1 overflow-y-auto max-[900px]:hidden">
        <div className="px-2 pb-2 text-[11px] font-bold uppercase tracking-wider text-[var(--text-dim)]">
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
                  `group flex items-center gap-3 px-2 py-1.5 rounded-md transition-colors hover:bg-[var(--bg-hover)] ${
                    isActive ? 'bg-[var(--bg-hover)]' : ''
                  }`
                }
              >
                {({ isActive }) => (
                  <>
                    <img src={p.artworkUrl} className="w-11 h-11 rounded-md object-cover bg-white/5 shrink-0 shadow-sm" />
                    <div className="min-w-0">
                      <div
                        className={`truncate text-sm font-semibold transition-colors ${
                          isActive ? 'text-[var(--accent)]' : 'text-white'
                        }`}
                      >
                        {p.title}
                      </div>
                      <div className="truncate text-xs text-[var(--text-dim)]">
                        {p.trackCount > 0 ? `${p.trackCount} faixas` : 'Playlist'}
                      </div>
                    </div>
                  </>
                )}
              </NavLink>
            ))}
      </div>
    </nav>
  )
}
