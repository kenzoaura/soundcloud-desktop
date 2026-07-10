import { useEffect, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { Search } from 'lucide-react'
import TrackList from '../TrackList'
import TrackListSkeleton from '../TrackListSkeleton'
import EmptyState from '../EmptyState'
import type { Track, User, Playlist } from '../../../electron/sc/types'

type Results = { tracks: Track[]; users: User[]; playlists: Playlist[] }

type Tab = 'all' | 'tracks' | 'artists' | 'playlists'

export default function SearchView() {
  const [params] = useSearchParams()
  const q = params.get('q') ?? ''
  const [res, setRes] = useState<Results | null>(null)
  const [loading, setLoading] = useState(false)
  const [tab, setTab] = useState<Tab>('all')

  useEffect(() => {
    if (!q.trim()) {
      setRes(null)
      return
    }
    let alive = true
    setLoading(true)
    window.sc
      .search(q.trim())
      .then((r) => {
        if (alive) {
          setRes(r)
          setLoading(false)
        }
      })
      .catch(() => {
        if (alive) setLoading(false)
      })
    return () => {
      alive = false
    }
  }, [q])

  return (
    <section className="p-6">
      <h1 className="display text-2xl mb-4 truncate">{q ? `Resultados para "${q}"` : 'Buscar'}</h1>

      {!q && (
        <EmptyState
          icon={<Search size={28} />}
          title="Busque no SoundCloud"
          subtitle="Use a barra no topo para procurar faixas, artistas e playlists."
        />
      )}

      {loading && <TrackListSkeleton />}

      {res && !loading && res.tracks.length === 0 && res.users.length === 0 && res.playlists.length === 0 && (
        <EmptyState icon={<Search size={28} />} title="Nada encontrado" subtitle={`Sem resultados para "${q}"`} />
      )}

      {res && !loading && (res.tracks.length > 0 || res.users.length > 0 || res.playlists.length > 0) && (
        <>
          <div className="flex gap-2 mb-5">
            {([
              ['all', 'Tudo'],
              ['tracks', 'Faixas'],
              ['artists', 'Artistas'],
              ['playlists', 'Playlists'],
            ] as [Tab, string][]).map(([key, label]) => (
              <button
                key={key}
                onClick={() => setTab(key)}
                className={`px-4 py-1.5 text-sm font-semibold rounded-full transition-colors ${
                  tab === key ? 'bg-white text-black' : 'text-[var(--text-dim)] hover:text-white hover:bg-[var(--bg-hover)]'
                }`}
              >
                {label}
              </button>
            ))}
          </div>
          {(tab === 'all' || tab === 'artists') && res.users.length > 0 && (
            <div className="pb-3">
              <h2 className="text-lg font-bold mb-3">Artistas</h2>
              <div className="flex gap-5 flex-wrap">
                {res.users.slice(0, 8).map((u) => (
                  <Link key={u.id} to={`/artist/${u.id}`} className="w-28 text-center group hover-lift">
                    <img
                      src={u.avatarUrl}
                      className="w-24 h-24 rounded-full object-cover bg-white/5 mx-auto group-hover:ring-2 group-hover:ring-[var(--accent)] transition"
                    />
                    <div className="text-sm truncate mt-2">{u.username}</div>
                  </Link>
                ))}
              </div>
            </div>
          )}
          {(tab === 'all' || tab === 'playlists') && res.playlists.length > 0 && (
            <div className="pb-3">
              <h2 className="text-lg font-bold mb-3">Playlists</h2>
              <div className="grid grid-cols-2 min-[720px]:grid-cols-4 min-[1100px]:grid-cols-6 gap-4">
                {res.playlists.slice(0, 12).map((p) => (
                  <Link key={p.id} to={`/playlist/${p.id}`} className="group hover-lift">
                    <div className="art-zoom rounded-lg">
                      <img
                        src={p.artworkUrl}
                        className="aspect-square w-full object-cover rounded-lg bg-white/5 shadow-lg group-hover:brightness-110 transition"
                      />
                    </div>
                    <div className="text-sm font-semibold truncate mt-2">{p.title}</div>
                    <div className="text-xs text-[var(--text-dim)] truncate">{p.user} · {p.trackCount} faixas</div>
                  </Link>
                ))}
              </div>
            </div>
          )}
          {(tab === 'all' || tab === 'tracks') && res.tracks.length > 0 && (
            <>
              <h2 className="text-lg font-bold pt-1">Faixas</h2>
              <TrackList tracks={res.tracks} />
            </>
          )}
        </>
      )}
    </section>
  )
}
