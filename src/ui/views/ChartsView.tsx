import { useState } from 'react'
import { useAsync } from '../useAsync'
import TrackList from '../TrackList'
import TrackListSkeleton from '../TrackListSkeleton'
import EmptyState from '../EmptyState'
import ErrorState from '../ErrorState'

// [label, search term]. Genres map to a search that surfaces popular tracks.
const GENRES: [string, string][] = [
  ['Hip-hop & Rap', 'hip hop rap'],
  ['Pop', 'pop'],
  ['Eletrônica', 'electronic'],
  ['House', 'house'],
  ['Deep House', 'deep house'],
  ['Techno', 'techno'],
  ['Trap', 'trap'],
  ['Phonk', 'phonk'],
  ['R&B & Soul', 'r&b soul'],
  ['Rock', 'rock'],
  ['Indie', 'indie'],
  ['Ambient', 'ambient'],
  ['Drum & Bass', 'drum and bass'],
  ['Dubstep', 'dubstep'],
  ['Funk', 'funk brasil'],
  ['Sertanejo', 'sertanejo'],
  ['Reggaeton', 'reggaeton'],
  ['Lo-fi', 'lofi'],
]

export default function ChartsView() {
  const [genre, setGenre] = useState(GENRES[0])
  const { data, loading, error, reload } = useAsync(() => window.sc.genreTracks(genre[1]), [genre[1]])
  const tracks = data ?? []

  const pill = (active: boolean) =>
    `px-4 py-2 text-sm font-semibold rounded-full transition-colors whitespace-nowrap ${
      active ? 'bg-white text-black' : 'text-[var(--text-dim)] hover:text-white hover:bg-[var(--bg-hover)]'
    }`

  return (
    <section className="p-6">
      <div className="rounded-xl p-6 mb-6" style={{ background: 'linear-gradient(135deg, var(--accent), #7a1f00)' }}>
        <div className="eyebrow text-white/80">SoundCloud</div>
        <h1 className="display text-4xl text-white mt-1">Explorar</h1>
        <p className="text-white/80 text-sm mt-2">Faixas populares por gênero.</p>
      </div>

      {/* Genre chips */}
      <div className="flex gap-2 overflow-x-auto pb-3 mb-4 -mx-1 px-1">
        {GENRES.map((g) => (
          <button key={g[1]} className={pill(genre[1] === g[1])} onClick={() => setGenre(g)}>
            {g[0]}
          </button>
        ))}
      </div>

      {loading ? (
        <TrackListSkeleton />
      ) : error ? (
        <ErrorState onRetry={reload} />
      ) : tracks.length === 0 ? (
        <EmptyState title="Nada aqui" subtitle="Sem faixas para este gênero." />
      ) : (
        <TrackList tracks={tracks} header />
      )}
    </section>
  )
}
