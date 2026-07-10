import { useNavigate } from 'react-router-dom'
import { Play, Pause } from 'lucide-react'
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
    <div className="group text-left w-40 shrink-0 hover-lift">
      <div className="relative cursor-pointer art-zoom rounded-lg" onClick={() => navigate(`/track/${t.id}`)}>
        <img src={t.artworkUrl} className="aspect-square w-full object-cover rounded-lg bg-white/5 shadow-lg group-hover:brightness-110 transition" />
        <button
          onClick={(e) => {
            e.stopPropagation()
            void playQueue(tracks, index)
          }}
          className="absolute bottom-2 right-2 w-11 h-11 rounded-full bg-[var(--accent)] grid place-items-center text-white opacity-0 translate-y-2 group-hover:opacity-100 group-hover:translate-y-0 transition-all shadow-xl hover:scale-110 press"
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
    <div className="group text-left w-40 shrink-0 hover-lift">
      <div className="relative cursor-pointer art-zoom rounded-lg" onClick={open}>
        <img src={item.artworkUrl} className="aspect-square w-full object-cover rounded-lg bg-white/5 shadow-lg group-hover:brightness-110 transition" />
        <button
          onClick={play}
          className="absolute bottom-2 right-2 w-11 h-11 rounded-full bg-[var(--accent)] grid place-items-center text-white opacity-0 translate-y-2 group-hover:opacity-100 group-hover:translate-y-0 transition-all shadow-xl hover:scale-110 press"
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
      <div className="flex gap-4 overflow-x-auto pb-2 -mx-1 px-1 stagger-in">{children}</div>
    </div>
  )
}

function RowSkeleton() {
  return (
    <div className="mb-8">
      <Skeleton className="h-5 w-48 mb-3" />
      <div className="flex gap-4">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="w-40 shrink-0">
            <Skeleton className="aspect-square rounded-lg" />
            <Skeleton className="h-3 w-3/4 mt-2" />
          </div>
        ))}
      </div>
    </div>
  )
}

// A recently-played tile: compact pill with artwork + title, reflecting play
// state, in place of the old sidebar-duplicating quick-access shortcuts.
function RecentTile({ tracks, index }: { tracks: Track[]; index: number }) {
  const t = tracks[index]
  const playQueue = usePlayer((s) => s.playQueue)
  const toggle = usePlayer((s) => s.toggle)
  const current = usePlayer((s) => s.current)
  const isPlaying = usePlayer((s) => s.isPlaying)
  const navigate = useNavigate()
  const isCur = current?.id === t.id
  const play = () => (isCur ? toggle() : void playQueue(tracks, index))
  return (
    <div
      onClick={() => navigate(`/track/${t.id}`)}
      className="group relative flex items-center gap-4 h-16 rounded-md bg-white/[0.06] hover:bg-white/[0.12] overflow-hidden transition-colors cursor-pointer art-zoom"
    >
      <img src={t.artworkUrl} className="h-16 w-16 object-cover bg-white/5 shrink-0" />
      <div className="min-w-0 flex-1 pr-1">
        <div className={`font-bold truncate ${isCur ? 'text-[var(--accent)]' : ''}`}>{t.title}</div>
        <div className="text-xs text-[var(--text-dim)] truncate">{t.artist}</div>
      </div>
      <button
        onClick={(e) => {
          e.stopPropagation()
          play()
        }}
        className={`mr-3 w-10 h-10 rounded-full bg-[var(--accent)] grid place-items-center text-white shadow-lg shrink-0 transition hover:scale-110 press ${
          isCur ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'
        }`}
        aria-label={isCur && isPlaying ? 'Pausar' : 'Tocar'}
      >
        {isCur && isPlaying ? <Pause size={16} fill="currentColor" /> : <Play size={16} fill="currentColor" />}
      </button>
    </div>
  )
}

function MiniTrack({ track }: { track: Track }) {
  const playQueue = usePlayer((s) => s.playQueue)
  const navigate = useNavigate()
  return (
    <div className="group flex items-center gap-3 py-1.5">
      <div className="relative w-11 h-11 shrink-0">
        <img src={track.artworkUrl} className="w-full h-full object-cover rounded bg-white/5" />
        <button
          onClick={() => void playQueue([track], 0)}
          className="absolute inset-0 grid place-items-center bg-black/40 opacity-0 group-hover:opacity-100 rounded transition"
          aria-label="Tocar"
        >
          <Play size={14} fill="currentColor" className="text-white" />
        </button>
      </div>
      <button onClick={() => navigate(`/track/${track.id}`)} className="min-w-0 text-left flex-1">
        <div className="text-sm truncate hover:underline">{track.title}</div>
        <div className="text-xs text-[var(--text-dim)] truncate">{track.artist}</div>
      </button>
    </div>
  )
}

export default function HomeView() {
  const t = useT()
  const me = useAsync(() => window.sc.me(), [])
  const history = useAsync(() => window.sc.playHistory(), [])
  const home = useAsync(() => window.sc.home(), [])
  const newTracks = useAsync(() => window.sc.feed(), [])

  const hist: Track[] = history.data ?? []
  const selections: HomeSelection[] = home.data ?? []
  const feed: Track[] = newTracks.data ?? []

  return (
    <section className="p-6">
      <h1 className="display text-3xl mb-5">
        {t(greetKey())}
        {me.data?.username ? `, ${me.data.username}` : ''}
      </h1>

      {/* The right rail floats top-right: rows that start below it reclaim the
          full width instead of the whole page staying in two columns. */}
      <div className="after:block after:clear-both">
        <aside className="float-right w-[200px] ml-5 mb-4 max-[1100px]:hidden">
          {feed.length > 0 && (
            <div>
              <h2 className="text-sm font-bold uppercase tracking-wider text-[var(--text-muted)] mb-2">{t('home.newTracks')}</h2>
              <div className="flex flex-col">
                {feed.slice(0, 9).map((tk, i) => (
                  <MiniTrack key={`${tk.id}-${i}`} track={tk} />
                ))}
              </div>
            </div>
          )}
        </aside>

        {/* Main content flows around the float */}
        <div className="min-w-0">
          {/* Recently played tiles */}
          {hist.length > 0 && (
            <div className="grid grid-cols-1 min-[560px]:grid-cols-2 gap-3 mb-8 stagger-in">
              {hist.slice(0, 6).map((tk, i) => (
                <RecentTile key={`${tk.id}-${i}`} tracks={hist} index={i} />
              ))}
            </div>
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
          {/* Fall back to plain history cards if selections are empty. */}
          {!home.loading && selections.length === 0 && hist.length > 0 && (
            <Row title={t('home.recent')}>
              {hist.slice(0, 12).map((tk, i) => (
                <TrackCard key={`${tk.id}-${i}`} tracks={hist} index={i} />
              ))}
            </Row>
          )}
        </div>
      </div>
    </section>
  )
}
