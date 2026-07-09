import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { Play, BadgeCheck, Users } from 'lucide-react'
import { useAsync } from '../useAsync'
import { usePlayer } from '../../player/store'
import TrackList from '../TrackList'
import TrackListSkeleton from '../TrackListSkeleton'
import ErrorState from '../ErrorState'
import EmptyState from '../EmptyState'
import { Skeleton } from '../Skeleton'
import { getCoverColor, rgbToCss, type RGB } from '../../lib/color'
import { pushToast } from '../toast/store'
import type { Playlist, User } from '../../../electron/sc/types'

type Tab = 'tracks' | 'playlists' | 'likes' | 'followers' | 'followings'

function FollowButton({ userId, initial }: { userId: number; initial: boolean }) {
  const [following, setFollowing] = useState(initial)
  const [busy, setBusy] = useState(false)
  useEffect(() => setFollowing(initial), [initial])
  const toggle = async () => {
    if (busy) return
    const next = !following
    setFollowing(next)
    setBusy(true)
    const ok = await window.sc.followUser(userId, next)
    setBusy(false)
    if (!ok) {
      setFollowing(!next)
      pushToast('Não consegui atualizar', 'error')
    }
  }
  return (
    <button
      onClick={() => void toggle()}
      className={`px-6 py-2.5 rounded-full text-sm font-bold transition-transform transition-colors active:scale-95 ${
        following
          ? 'bg-transparent border border-white/40 text-white hover:border-white'
          : 'bg-white text-black hover:scale-105'
      }`}
    >
      {following ? 'Seguindo' : 'Seguir'}
    </button>
  )
}

function compact(n?: number): string {
  if (!n && n !== 0) return '0'
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1).replace('.0', '')}M`
  if (n >= 1_000) return `${(n / 1_000).toFixed(1).replace('.0', '')}K`
  return String(n)
}

function Stat({ value, label }: { value?: number; label: string }) {
  return (
    <div className="text-center px-4 first:pl-0 border-l border-white/10 first:border-l-0">
      <div className="text-lg font-bold text-white tabular-nums leading-none">{compact(value)}</div>
      <div className="text-[11px] uppercase tracking-wider text-[var(--text-muted)] mt-1">{label}</div>
    </div>
  )
}

export default function ArtistView() {
  const { id } = useParams()
  const uid = Number(id)
  const user = useAsync(() => window.sc.user(uid), [id])
  const me = useAsync(() => window.sc.me(), [])
  const following = useAsync(() => window.sc.followingIds(), [])
  const [tab, setTab] = useState<Tab>('tracks')
  const [color, setColor] = useState<RGB | null>(null)
  const [bioOpen, setBioOpen] = useState(false)
  const playQueue = usePlayer((s) => s.playQueue)

  const u = user.data
  const isSelf = me.data?.id === uid
  useEffect(() => {
    const art = u?.bannerUrl || u?.avatarUrl
    if (art) getCoverColor(art).then(setColor)
  }, [u?.bannerUrl, u?.avatarUrl])

  const tracks = useAsync(() => window.sc.userTracks(uid), [id])
  const playlists = useAsync(() => (tab === 'playlists' ? window.sc.userPlaylists(uid) : Promise.resolve<Playlist[]>([])), [id, tab])
  const likes = useAsync(() => (tab === 'likes' ? window.sc.userLikes(uid) : Promise.resolve([])), [id, tab])
  const followers = useAsync(() => (tab === 'followers' ? window.sc.userFollowers(uid) : Promise.resolve<User[]>([])), [id, tab])
  const followings = useAsync(() => (tab === 'followings' ? window.sc.userFollowings(uid) : Promise.resolve<User[]>([])), [id, tab])

  const base = color ?? { r: 40, g: 40, b: 40 }
  const location = [u?.city, u?.country].filter(Boolean).join(', ')
  const topTracks = tracks.data ?? []

  // Split into all-time "Populares" (by plays) and chronological "Faixas",
  // SoundCloud-style. Only worth splitting when there are enough tracks.
  const popular =
    topTracks.length > 6
      ? [...topTracks].sort((a, b) => (b.playbackCount ?? 0) - (a.playbackCount ?? 0)).slice(0, 5)
      : []
  const popularIds = new Set(popular.map((t) => t.id))
  const recent = popular.length ? topTracks.filter((t) => !popularIds.has(t.id)) : topTracks

  const tabCls = (active: boolean) =>
    `flex items-center gap-2 px-4 py-2 text-sm font-semibold rounded-full transition-colors ${
      active ? 'bg-white text-black' : 'text-[var(--text-dim)] hover:text-white hover:bg-[var(--bg-hover)]'
    }`
  const countCls = (active: boolean) =>
    `text-xs tabular-nums ${active ? 'text-black/50' : 'text-[var(--text-muted)]'}`

  if (user.loading && !u) return <ProfileSkeleton />

  return (
    <section>
      {/* Hero */}
      <div
        className="relative px-6 pt-10 pb-6"
        style={{
          backgroundImage: u?.bannerUrl
            ? `linear-gradient(180deg, ${rgbToCss(base, 0.35)}, var(--bg-panel)), url(${u.bannerUrl})`
            : `linear-gradient(180deg, ${rgbToCss(base, 0.7)}, transparent)`,
          backgroundSize: 'cover',
          backgroundPosition: 'center',
        }}
      >
        <div className="flex items-end gap-6 max-[700px]:flex-col max-[700px]:items-start">
          <img
            src={u?.avatarUrl}
            className="w-40 h-40 max-[900px]:w-28 max-[900px]:h-28 rounded-full object-cover shadow-2xl bg-white/5 shrink-0"
          />
          <div className="min-w-0 pb-1 flex-1">
            <div className="eyebrow">Perfil</div>
            <div className="flex items-center gap-2 mt-1 min-w-0">
              <h1 className="display text-[clamp(2rem,5vw,4rem)] text-white truncate">{u?.username ?? '…'}</h1>
              {u?.verified && <BadgeCheck size={26} className="text-[var(--accent)] shrink-0" />}
            </div>
            {location && <div className="text-sm text-[var(--text-dim)] mt-2">{location}</div>}

            {/* Stats + play */}
            <div className="flex items-center gap-6 mt-4 flex-wrap">
              {topTracks.length > 0 && (
                <button
                  onClick={() => void playQueue(topTracks, 0)}
                  className="w-12 h-12 rounded-full bg-[var(--accent)] hover:bg-[var(--accent-hover)] grid place-items-center text-white shadow-lg hover:scale-105 transition"
                  aria-label="Tocar"
                >
                  <Play size={22} fill="currentColor" className="ml-0.5" />
                </button>
              )}
              {u && !isSelf && !following.loading && (
                <FollowButton userId={uid} initial={(following.data ?? []).includes(uid)} />
              )}
              <Stat value={u?.followersCount} label="Seguidores" />
              <Stat value={u?.followingsCount} label="Seguindo" />
              <Stat value={u?.trackCount} label="Faixas" />
              <Stat value={u?.likesCount} label="Curtidas" />
            </div>

            {/* Bio */}
            {u?.description && (
              <div className="mt-4 max-w-2xl">
                <p className={`text-sm text-[var(--text-dim)] whitespace-pre-line ${bioOpen ? '' : 'line-clamp-2'}`}>
                  {u.description}
                </p>
                {u.description.length > 120 && (
                  <button onClick={() => setBioOpen((v) => !v)} className="text-xs text-white/70 hover:text-white mt-1">
                    {bioOpen ? 'ver menos' : 'ver mais'}
                  </button>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Tabs (sticky under the hero while scrolling) */}
      <div className="sticky top-0 z-10 flex gap-2 px-6 py-4 bg-[var(--bg-panel)]/85 backdrop-blur-md border-b border-[var(--border)]">
        <button className={tabCls(tab === 'tracks')} onClick={() => setTab('tracks')}>
          Faixas
          {u?.trackCount ? <span className={countCls(tab === 'tracks')}>{compact(u.trackCount)}</span> : null}
        </button>
        <button className={tabCls(tab === 'playlists')} onClick={() => setTab('playlists')}>
          Playlists
          {(u?.playlistCount ?? playlists.data?.length) ? (
            <span className={countCls(tab === 'playlists')}>{compact(u?.playlistCount ?? playlists.data?.length)}</span>
          ) : null}
        </button>
        <button className={tabCls(tab === 'likes')} onClick={() => setTab('likes')}>
          Curtidas
          {u?.likesCount ? <span className={countCls(tab === 'likes')}>{compact(u.likesCount)}</span> : null}
        </button>
        <button className={tabCls(tab === 'followers')} onClick={() => setTab('followers')}>
          Seguidores
          {u?.followersCount ? <span className={countCls(tab === 'followers')}>{compact(u.followersCount)}</span> : null}
        </button>
        <button className={tabCls(tab === 'followings')} onClick={() => setTab('followings')}>
          Seguindo
          {u?.followingsCount ? <span className={countCls(tab === 'followings')}>{compact(u.followingsCount)}</span> : null}
        </button>
      </div>

      <div className="px-4 pb-4">
        {tab === 'tracks' &&
          (tracks.loading ? (
            <TrackListSkeleton />
          ) : tracks.error ? (
            <ErrorState onRetry={tracks.reload} />
          ) : topTracks.length === 0 ? (
            <EmptyState title="Nenhuma faixa" />
          ) : popular.length ? (
            <>
              <h2 className="eyebrow px-2 pt-3 pb-1">Populares</h2>
              <TrackList tracks={popular} header />
              <h2 className="eyebrow px-2 pt-5 pb-1">Faixas</h2>
              <TrackList tracks={recent} />
            </>
          ) : (
            <TrackList tracks={topTracks} header />
          ))}

        {tab === 'likes' &&
          (likes.loading ? (
            <TrackListSkeleton />
          ) : (likes.data ?? []).length === 0 ? (
            <EmptyState title="Nenhuma curtida" />
          ) : (
            <TrackList tracks={likes.data ?? []} header liked />
          ))}

        {tab === 'playlists' &&
          (playlists.loading ? (
            <div className="p-6 text-sm text-[var(--text-muted)]">Carregando…</div>
          ) : (playlists.data ?? []).length === 0 ? (
            <EmptyState title="Nenhuma playlist" />
          ) : (
            <div className="grid grid-cols-2 min-[720px]:grid-cols-4 min-[1100px]:grid-cols-6 gap-4 p-2">
              {(playlists.data ?? []).map((p) => (
                <Link key={p.id} to={`/playlist/${p.id}`} className="group">
                  <img src={p.artworkUrl} className="aspect-square w-full object-cover rounded-lg bg-white/5 shadow-lg group-hover:brightness-110 transition" />
                  <div className="text-sm font-semibold truncate mt-2">{p.title}</div>
                  <div className="text-xs text-[var(--text-dim)] truncate">{p.trackCount} faixas</div>
                </Link>
              ))}
            </div>
          ))}

        {tab === 'followers' && <UserGrid state={followers} empty="Nenhum seguidor" />}
        {tab === 'followings' && <UserGrid state={followings} empty="Não segue ninguém" />}
      </div>
    </section>
  )
}

function UserGrid({
  state,
  empty,
}: {
  state: { loading: boolean; data?: User[] | null }
  empty: string
}) {
  if (state.loading) {
    return (
      <div className="grid grid-cols-2 min-[720px]:grid-cols-4 min-[1100px]:grid-cols-6 gap-4 p-2">
        {Array.from({ length: 12 }).map((_, i) => (
          <div key={i} className="flex flex-col items-center gap-2">
            <Skeleton className="aspect-square w-full rounded-full" />
            <Skeleton className="h-3 w-20" />
          </div>
        ))}
      </div>
    )
  }
  const users = state.data ?? []
  if (users.length === 0) return <EmptyState title={empty} />
  return (
    <div className="grid grid-cols-2 min-[720px]:grid-cols-4 min-[1100px]:grid-cols-6 gap-4 p-2">
      {users.map((u) => (
        <Link key={u.id} to={`/artist/${u.id}`} className="group flex flex-col items-center text-center">
          <img
            src={u.avatarUrl}
            className="aspect-square w-full object-cover rounded-full bg-white/5 shadow-lg group-hover:ring-2 group-hover:ring-[var(--accent)] transition"
          />
          <div className="flex items-center gap-1 mt-2 min-w-0 max-w-full">
            <span className="text-sm font-semibold truncate">{u.username}</span>
            {u.verified && <BadgeCheck size={14} className="text-[var(--accent)] shrink-0" />}
          </div>
          <div className="flex items-center gap-1 text-xs text-[var(--text-dim)]">
            <Users size={11} />
            {compact(u.followersCount)} seguidores
          </div>
        </Link>
      ))}
    </div>
  )
}

function ProfileSkeleton() {
  return (
    <section>
      <div className="px-6 pt-10 pb-6 bg-gradient-to-b from-white/5 to-transparent">
        <div className="flex items-end gap-6 max-[700px]:flex-col max-[700px]:items-start">
          <Skeleton className="w-40 h-40 max-[900px]:w-28 max-[900px]:h-28 rounded-full shrink-0" />
          <div className="flex-1 min-w-0 pb-1">
            <Skeleton className="h-3 w-16" />
            <Skeleton className="h-10 w-64 max-w-full mt-3" />
            <div className="flex items-center gap-6 mt-5">
              <Skeleton className="h-12 w-12 rounded-full" />
              <Skeleton className="h-9 w-28 rounded-full" />
              {Array.from({ length: 4 }).map((_, i) => (
                <Skeleton key={i} className="h-8 w-12" />
              ))}
            </div>
          </div>
        </div>
      </div>
      <div className="px-4 pt-4">
        <TrackListSkeleton />
      </div>
    </section>
  )
}
