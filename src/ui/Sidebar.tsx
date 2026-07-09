import { useEffect, useRef, useState } from 'react'
import { NavLink } from 'react-router-dom'
import { Home, Heart, Compass, Plus } from 'lucide-react'
import type { Playlist } from '../../electron/sc/types'
import { Skeleton } from './Skeleton'
import { useT } from './strings'
import { usePlaylistUi } from './playlist/store'

// Resizable width: drag the right edge. Dragging below COLLAPSE_AT snaps to an
// icon-only rail; otherwise the width is clamped between EXPAND_MIN and MAX.
const COLLAPSED_W = 72
const COLLAPSE_AT = 168
const EXPAND_MIN = 208
const MAX = 460
const DEFAULT_W = 288

export default function Sidebar() {
  const t = useT()
  const navRef = useRef<HTMLElement>(null)
  const [width, setWidth] = useState(() => {
    const v = Number(localStorage.getItem('sidebar-w'))
    return v >= COLLAPSED_W && v <= MAX ? v : DEFAULT_W
  })
  const [dragging, setDragging] = useState(false)
  const collapsed = width <= COLLAPSED_W

  useEffect(() => {
    if (!dragging) return
    const onMove = (e: MouseEvent) => {
      const left = navRef.current?.getBoundingClientRect().left ?? 0
      const raw = e.clientX - left
      setWidth(raw < COLLAPSE_AT ? COLLAPSED_W : Math.min(MAX, Math.max(EXPAND_MIN, raw)))
    }
    const onUp = () => setDragging(false)
    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
    return () => {
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('mouseup', onUp)
    }
  }, [dragging])

  useEffect(() => {
    localStorage.setItem('sidebar-w', String(width))
  }, [width])

  // Lock the cursor/selection globally while dragging so it stays smooth even
  // when the pointer leaves the thin handle.
  useEffect(() => {
    if (!dragging) return
    document.body.style.cursor = 'col-resize'
    document.body.style.userSelect = 'none'
    return () => {
      document.body.style.cursor = ''
      document.body.style.userSelect = ''
    }
  }, [dragging])

  const link =
    'flex items-center gap-3.5 px-3 py-2.5 rounded-md text-[15px] font-semibold text-[var(--text-dim)] hover:text-white hover:bg-[var(--bg-hover)] transition-colors' +
    (collapsed ? ' justify-center' : '')
  const cls = ({ isActive }: { isActive: boolean }) =>
    `${link} ${isActive ? 'text-white bg-[var(--bg-hover)]' : ''}`
  const [playlists, setPlaylists] = useState<Playlist[]>([])
  const [likedIds, setLikedIds] = useState<Set<number>>(new Set())
  const [loading, setLoading] = useState(true)
  useEffect(() => {
    const load = () => {
      Promise.all([
        window.sc.playlists().catch(() => [] as Playlist[]),
        window.sc.likedPlaylists().catch(() => [] as Playlist[]),
      ])
        .then(([own, liked]) => {
          // Own playlists first, then liked ones, de-duplicated by id.
          const seen = new Set(own.map((p) => p.id))
          const likedOnly = liked.filter((p) => !seen.has(p.id))
          setPlaylists([...own, ...likedOnly])
          setLikedIds(new Set(likedOnly.map((p) => p.id)))
        })
        .finally(() => setLoading(false))
    }
    load()
    // Optimistic update on like/unlike so the sidebar reflects it instantly;
    // fall back to a full reload when no playlist data is attached.
    const onChange = (e: Event) => {
      const detail = (e as CustomEvent).detail as { playlist?: Playlist; liked?: boolean } | undefined
      if (!detail?.playlist) {
        load()
        return
      }
      const { playlist, liked } = detail
      setPlaylists((prev) =>
        liked
          ? prev.some((p) => p.id === playlist.id)
            ? prev
            : [...prev, playlist]
          : prev.filter((p) => p.id !== playlist.id),
      )
      setLikedIds((prev) => {
        const n = new Set(prev)
        if (liked) n.add(playlist.id)
        else n.delete(playlist.id)
        return n
      })
    }
    window.addEventListener('sc:playlists-changed', onChange)
    // A just-created playlist: show it immediately (server already confirmed it),
    // then reconcile with a refetch a moment later once SoundCloud has caught up.
    let reconcile: ReturnType<typeof setTimeout>
    const onCreated = (e: Event) => {
      const p = (e as CustomEvent).detail?.playlist as Playlist | undefined
      if (!p) return
      setPlaylists((prev) => (prev.some((x) => x.id === p.id) ? prev : [p, ...prev]))
      clearTimeout(reconcile)
      reconcile = setTimeout(load, 3000)
    }
    window.addEventListener('sc:playlist-created', onCreated)
    // Playlists saved on the SoundCloud website don't push to the app, so
    // re-sync whenever the window regains focus (e.g. alt-tabbing back).
    const onFocus = () => load()
    window.addEventListener('focus', onFocus)
    return () => {
      window.removeEventListener('sc:playlists-changed', onChange)
      window.removeEventListener('sc:playlist-created', onCreated)
      window.removeEventListener('focus', onFocus)
      clearTimeout(reconcile)
    }
  }, [])

  return (
    <nav
      ref={navRef}
      style={{ width, transition: dragging ? 'none' : 'width 150ms ease' }}
      className="relative shrink-0 rounded-lg bg-[var(--bg-panel)] flex flex-col p-2.5 overflow-hidden"
    >
      <NavLink to="/" end className={cls} title={collapsed ? t('nav.home') : undefined}>
        <Home size={20} />
        {!collapsed && <span>{t('nav.home')}</span>}
      </NavLink>
      <NavLink to="/charts" className={cls} title={collapsed ? t('nav.charts') : undefined}>
        <Compass size={20} />
        {!collapsed && <span>{t('nav.charts')}</span>}
      </NavLink>
      <NavLink to="/likes" className={cls} title={collapsed ? t('nav.likes') : undefined}>
        <Heart size={20} />
        {!collapsed && <span>{t('nav.likes')}</span>}
      </NavLink>

      <div className={`mt-3 pt-3 border-t border-[var(--border)] flex-1 overflow-y-auto ${collapsed ? 'hidden' : ''}`}>
        <div className="flex items-center justify-between px-2 pb-2">
          <span className="text-[11px] font-bold uppercase tracking-wider text-[var(--text-dim)]">
            {t('nav.playlists')}
          </span>
          <button
            onClick={() => usePlaylistUi.getState().openCreate()}
            className="grid place-items-center w-6 h-6 rounded-md text-[var(--text-dim)] hover:text-white hover:bg-[var(--bg-hover)] transition-colors"
            title="Criar playlist"
            aria-label="Criar playlist"
          >
            <Plus size={16} />
          </button>
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
                      <div className="truncate text-xs text-[var(--text-dim)] flex items-center gap-1">
                        {likedIds.has(p.id) ? (
                          <>
                            <Heart size={11} className="text-[var(--accent)] shrink-0" fill="currentColor" />
                            <span className="truncate">Curtida · {p.user}</span>
                          </>
                        ) : p.trackCount > 0 ? (
                          `${p.trackCount} faixas`
                        ) : (
                          'Playlist'
                        )}
                      </div>
                    </div>
                  </>
                )}
              </NavLink>
            ))}
      </div>

      {/* Drag the right edge to resize; snaps to an icon rail when pulled in.
          Wide invisible hitbox, thin pill that only surfaces on hover/drag. */}
      <div
        onMouseDown={(e) => {
          e.preventDefault()
          setDragging(true)
        }}
        onDoubleClick={() => setWidth(collapsed ? DEFAULT_W : COLLAPSED_W)}
        className="group/rz absolute inset-y-0 right-0 w-2.5 cursor-col-resize z-20"
      >
        <span
          className={`absolute inset-y-2.5 right-[3px] w-[3px] rounded-full transition-all duration-200 ${
            dragging
              ? 'bg-[var(--accent)]'
              : 'bg-white/0 group-hover/rz:bg-white/25'
          }`}
        />
      </div>
    </nav>
  )
}
