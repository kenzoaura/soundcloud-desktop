import { useEffect, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { Search } from 'lucide-react'
import TrackList from '../TrackList'
import TrackListSkeleton from '../TrackListSkeleton'
import EmptyState from '../EmptyState'
import type { Track, User, Playlist } from '../../../electron/sc/types'

type Results = { tracks: Track[]; users: User[]; playlists: Playlist[] }

export default function SearchView() {
  const [params] = useSearchParams()
  const q = params.get('q') ?? ''
  const [res, setRes] = useState<Results | null>(null)
  const [loading, setLoading] = useState(false)

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

      {res && !loading && res.tracks.length === 0 && res.users.length === 0 && (
        <EmptyState icon={<Search size={28} />} title="Nada encontrado" subtitle={`Sem resultados para "${q}"`} />
      )}

      {res && !loading && (res.tracks.length > 0 || res.users.length > 0) && (
        <>
          {res.users.length > 0 && (
            <div className="pb-3">
              <h2 className="text-lg font-bold mb-3">Artistas</h2>
              <div className="flex gap-5 flex-wrap">
                {res.users.slice(0, 8).map((u) => (
                  <Link key={u.id} to={`/artist/${u.id}`} className="w-28 text-center group">
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
          {res.tracks.length > 0 && <h2 className="text-lg font-bold pt-1">Faixas</h2>}
          <TrackList tracks={res.tracks} />
        </>
      )}
    </section>
  )
}
