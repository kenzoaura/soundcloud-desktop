import { Link, useNavigate } from 'react-router-dom'
import { Heart, Play } from 'lucide-react'
import { useAsync } from '../useAsync'
import { usePlayer } from '../../player/store'
import { pushToast } from '../toast/store'
import { translateSelectionTitle } from '../i18n'
import { useT, type StringKey } from '../strings'
import { Skeleton } from '../Skeleton'
import type { Track, HomeSelection, HomeItem } from '../../../electron/sc/types'

function greetKey(): StringKey {
  const h = new Date().getHours()
  if (h < 6) return 'greet.dawn'
  if (h < 12) return 'greet.morning'
  if (h < 18) return 'greet.afternoon'
  return 'greet.evening'
}

function TrackCard({ tracks, index }: { tracks: Track[]; index: number }) {
  const t = tracks[index]
  const playQueue = usePlayer((s) => s.playQueue)
  const navigate = useNavigate()
  return (
    <div className="group text-left w-40 shrink-0">
      <div className="relative cursor-pointer" onClick={() => navigate(`/track/${t.id}`)}>
        <img src={t.artworkUrl} className="aspect-square w-full object-cover rounded-lg bg-white/5 shadow-lg group-hover:brightness-110 transition" />
        <button
          onClick={(e) => {
            e.stopPropagation()
            void playQueue(tracks, index)
          }}
          className="absolute bottom-2 right-2 w-11 h-11 rounded-full bg-[var(--accent)] grid place-items-center text-white opacity-0 translate-y-2 group-hover:opacity-100 group-hover:translate-y-0 transition-all shadow-xl hover:scale-105"
          aria-label="Tocar"
        >
          <Play size={18} fill="currentColor" />
        </button>
      </div>
      <button onClick={() => navigate(`/track/${t.id}`)} className="block max-w-full text-sm font-semibold truncate mt-2 hover:underline text-left">
        {t.title}
      </button>
      <div className="text-xs text-[var(--text-dim)] truncate">{t.artist}</div>
    </div>
  )
}

function SelectionCard({ item }: { item: HomeItem }) {
  const playQueue = usePlayer((s) => s.playQueue)
  const navigate = useNavigate()
  const title = translateSelectionTitle(item.title)
  const open = () =>
    navigate('/mix', { state: { title, trackIds: item.trackIds, artworkUrl: item.artworkUrl } })
  const play = async (e: React.MouseEvent) => {
    e.stopPropagation()
    const tracks = await window.sc.tracksByIds(item.trackIds.slice(0, 50))
    if (tracks.length) void playQueue(tracks, 0)
    else pushToast('Não consegui carregar essa seleção', 'error')
  }
  return (
    <div className="group text-left w-40 shrink-0">
      <div className="relative cursor-pointer" onClick={open}>
        <img src={item.artworkUrl} className="aspect-square w-full object-cover rounded-lg bg-white/5 shadow-lg group-hover:brightness-110 transition" />
        <button
          onClick={play}
          className="absolute bottom-2 right-2 w-11 h-11 rounded-full bg-[var(--accent)] grid place-items-center text-white opacity-0 translate-y-2 group-hover:opacity-100 group-hover:translate-y-0 transition-all shadow-xl hover:scale-105"
          aria-label="Tocar"
        >
          <Play size={18} fill="currentColor" />
        </button>
      </div>
      <button onClick={open} className="block max-w-full text-sm font-semibold truncate mt-2 hover:underline text-left">
        {title}
      </button>
    </div>
  )
}

function Row({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="mb-8">
      <h2 className="text-xl font-bold tracking-tight mb-3">{title}</h2>
      <div className="flex gap-4 overflow-x-auto pb-2 -mx-1 px-1">{children}</div>
    </div>
  )
}

function RowSkeleton() {
  return (
    <div className="mb-8">
      <Skeleton className="h-5 w-48 mb-3" />
      <div className="flex gap-4">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="w-40 shrink-0">
            <Skeleton className="aspect-square rounded-lg" />
            <Skeleton className="h-3 w-3/4 mt-2" />
          </div>
        ))}
      </div>
    </div>
  )
}

export default function HomeView() {
  const t = useT()
  const me = useAsync(() => window.sc.me(), [])
  const playlists = useAsync(() => window.sc.playlists(), [])
  const history = useAsync(() => window.sc.playHistory(), [])
  const home = useAsync(() => window.sc.home(), [])
  const pls = playlists.data ?? []
  const hist: Track[] = history.data ?? []
  const selections: HomeSelection[] = home.data ?? []

  return (
    <section className="p-6">
      <h1 className="display text-3xl mb-5">
        {t(greetKey())}
        {me.data?.username ? `, ${me.data.username}` : ''}
      </h1>

      {/* Quick access */}
      <div className="grid grid-cols-1 min-[560px]:grid-cols-2 min-[1100px]:grid-cols-3 gap-3 mb-10">
        <Link to="/likes" className="group flex items-center gap-4 h-16 rounded-md bg-white/[0.06] hover:bg-white/[0.12] overflow-hidden transition-colors">
          <div className="h-16 w-16 grid place-items-center shrink-0" style={{ background: 'linear-gradient(135deg, var(--accent), #7a1f00)' }}>
            <Heart size={22} className="text-white" fill="currentColor" />
          </div>
          <span className="font-bold truncate">{t('nav.likes')}</span>
        </Link>
        {playlists.loading
          ? Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-16 rounded-md" />)
          : pls.slice(0, 8).map((p) => (
              <Link key={p.id} to={`/playlist/${p.id}`} className="group flex items-center gap-4 h-16 rounded-md bg-white/[0.06] hover:bg-white/[0.12] overflow-hidden transition-colors">
                <img src={p.artworkUrl} className="h-16 w-16 object-cover bg-white/5 shrink-0" />
                <span className="font-bold truncate pr-3">{p.title}</span>
              </Link>
            ))}
      </div>

      {/* Recently played */}
      {hist.length > 0 && (
        <Row title={t('home.recent')}>
          {hist.slice(0, 12).map((t, i) => (
            <TrackCard key={`${t.id}-${i}`} tracks={hist} index={i} />
          ))}
        </Row>
      )}

      {/* SoundCloud's personalized selections */}
      {home.loading && (
        <>
          <RowSkeleton />
          <RowSkeleton />
        </>
      )}
      {selections.map((sel) => (
        <Row key={sel.id} title={translateSelectionTitle(sel.title)}>
          {sel.items.map((item, i) => (
            <SelectionCard key={`${sel.id}-${i}`} item={item} />
          ))}
        </Row>
      ))}
    </section>
  )
}
