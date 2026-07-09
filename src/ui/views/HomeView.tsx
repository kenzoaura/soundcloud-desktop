import { Link, useNavigate } from 'react-router-dom'
import { Heart, Play } from 'lucide-react'
import { useAsync } from '../useAsync'
import { usePlayer } from '../../player/store'
import { pushToast } from '../toast/store'
import { translateSelectionTitle } from '../i18n'
import { useT, type StringKey } from '../strings'
import { Skeleton } from '../Skeleton'
import type { Track, User, HomeSelection, HomeItem } from '../../../electron/sc/types'

function greetKey(): StringKey {
  const h = new Date().getHours()
  if (h < 6) return 'greet.dawn'
  if (h < 12) return 'greet.morning'
  if (h < 18) return 'greet.afternoon'
  return 'greet.evening'
}

function compact(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1).replace('.0', '')}M`
  if (n >= 1_000) return `${(n / 1_000).toFixed(1).replace('.0', '')}K`
  return String(n)
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

// Featured "recently played" block: big cover of the last track + a mini list.
function RecentBlock({ tracks }: { tracks: Track[] }) {
  const t = useT()
  const playQueue = usePlayer((s) => s.playQueue)
  const current = usePlayer((s) => s.current)
  const navigate = useNavigate()
  const head = tracks[0]
  return (
    <div className="mb-8 rounded-xl bg-white/[0.04] border border-[var(--border)] p-4 flex gap-5 max-[560px]:flex-col">
      <div className="relative w-44 h-44 shrink-0">
        <img src={head.artworkUrl} className="w-full h-full object-cover rounded-lg bg-white/5 shadow-lg" />
        <button
          onClick={() => void playQueue(tracks, 0)}
          className="absolute bottom-2 right-2 w-12 h-12 rounded-full bg-[var(--accent)] grid place-items-center text-white shadow-xl hover:scale-105 transition"
          aria-label="Tocar"
        >
          <Play size={20} fill="currentColor" />
        </button>
      </div>
      <div className="min-w-0 flex-1">
        <h2 className="text-xl font-bold tracking-tight mb-3">{t('home.recent')}</h2>
        <div className="flex flex-col">
          {tracks.slice(0, 5).map((tk, i) => (
            <div key={`${tk.id}-${i}`} className="group flex items-center gap-3 py-1.5 rounded hover:bg-white/5 px-2 -mx-2">
              <button onClick={() => void playQueue(tracks, i)} className="shrink-0 text-[var(--text-muted)] group-hover:text-[var(--accent)]" aria-label="Tocar">
                <Play size={14} fill="currentColor" />
              </button>
              <button onClick={() => navigate(`/track/${tk.id}`)} className="min-w-0 text-left flex-1">
                <div className={`text-sm truncate ${current?.id === tk.id ? 'text-[var(--accent)]' : ''}`}>{tk.title}</div>
                <div className="text-xs text-[var(--text-dim)] truncate">{tk.artist}</div>
              </button>
            </div>
          ))}
        </div>
      </div>
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

function SuggestedArtist({ user }: { user: User }) {
  return (
    <Link to={`/artist/${user.id}`} className="group flex items-center gap-3 py-1.5">
      <img src={user.avatarUrl} className="w-11 h-11 rounded-full object-cover bg-white/10 shrink-0 group-hover:ring-2 group-hover:ring-[var(--accent)] transition" />
      <div className="min-w-0">
        <div className="text-sm truncate group-hover:underline">{user.username}</div>
        {typeof user.followersCount === 'number' && (
          <div className="text-xs text-[var(--text-dim)] truncate">{compact(user.followersCount)} seguidores</div>
        )}
      </div>
    </Link>
  )
}

export default function HomeView() {
  const t = useT()
  const me = useAsync(() => window.sc.me(), [])
  const playlists = useAsync(() => window.sc.playlists(), [])
  const history = useAsync(() => window.sc.playHistory(), [])
  const home = useAsync(() => window.sc.home(), [])
  const newTracks = useAsync(() => window.sc.feed(), [])
  const suggested = useAsync(async () => {
    const [likes, hist, following] = await Promise.all([
      window.sc.likes(40).catch(() => [] as Track[]),
      window.sc.playHistory().catch(() => [] as Track[]),
      window.sc.followingIds().catch(() => [] as number[]),
    ])
    const follow = new Set(following)
    const seen = new Set<number>()
    const ids: number[] = []
    for (const tk of [...hist, ...likes]) {
      if (tk.artistId && !seen.has(tk.artistId) && !follow.has(tk.artistId)) {
        seen.add(tk.artistId)
        ids.push(tk.artistId)
      }
      if (ids.length >= 6) break
    }
    const users = await Promise.all(ids.map((id) => window.sc.user(id).catch(() => null)))
    return users.filter((u): u is User => u !== null)
  }, [])

  const pls = playlists.data ?? []
  const hist: Track[] = history.data ?? []
  const selections: HomeSelection[] = home.data ?? []
  const feed: Track[] = newTracks.data ?? []
  const artists: User[] = suggested.data ?? []

  return (
    <section className="p-6">
      <h1 className="display text-3xl mb-5">
        {t(greetKey())}
        {me.data?.username ? `, ${me.data.username}` : ''}
      </h1>

      <div className="grid grid-cols-[1fr_300px] max-[1100px]:grid-cols-1 gap-8 items-start">
        {/* Main column */}
        <div className="min-w-0">
          {/* Quick access */}
          <div className="grid grid-cols-1 min-[560px]:grid-cols-2 gap-3 mb-8 stagger-in">
            <Link to="/likes" className="group flex items-center gap-4 h-16 rounded-md bg-white/[0.06] hover:bg-white/[0.12] overflow-hidden transition-colors">
              <div className="h-16 w-16 grid place-items-center shrink-0" style={{ background: 'linear-gradient(135deg, var(--accent), #7a1f00)' }}>
                <Heart size={22} className="text-white" fill="currentColor" />
              </div>
              <span className="font-bold truncate">{t('nav.likes')}</span>
            </Link>
            {playlists.loading
              ? Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-16 rounded-md" />)
              : pls.slice(0, 5).map((p) => (
                  <Link key={p.id} to={`/playlist/${p.id}`} className="group flex items-center gap-4 h-16 rounded-md bg-white/[0.06] hover:bg-white/[0.12] overflow-hidden transition-colors">
                    <img src={p.artworkUrl} className="h-16 w-16 object-cover bg-white/5 shrink-0" />
                    <span className="font-bold truncate pr-3">{p.title}</span>
                  </Link>
                ))}
          </div>

          {/* Featured recently played */}
          {hist.length > 0 && <RecentBlock tracks={hist} />}

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

        {/* Right column */}
        <aside className="max-[1100px]:hidden flex flex-col gap-8">
          {feed.length > 0 && (
            <div>
              <h2 className="text-sm font-bold uppercase tracking-wider text-[var(--text-muted)] mb-2">{t('home.newTracks')}</h2>
              <div className="flex flex-col">
                {feed.slice(0, 5).map((tk, i) => (
                  <MiniTrack key={`${tk.id}-${i}`} track={tk} />
                ))}
              </div>
            </div>
          )}
          {artists.length > 0 && (
            <div>
              <h2 className="text-sm font-bold uppercase tracking-wider text-[var(--text-muted)] mb-2">{t('home.suggestedArtists')}</h2>
              <div className="flex flex-col">
                {artists.map((u) => (
                  <SuggestedArtist key={u.id} user={u} />
                ))}
              </div>
            </div>
          )}
        </aside>
      </div>
    </section>
  )
}
