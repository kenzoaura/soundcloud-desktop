import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { Play, BadgeCheck } from 'lucide-react'
import { useAsync } from '../useAsync'
import { usePlayer } from '../../player/store'
import TrackList from '../TrackList'
import TrackListSkeleton from '../TrackListSkeleton'
import ErrorState from '../ErrorState'
import EmptyState from '../EmptyState'
import { getCoverColor, rgbToCss, type RGB } from '../../lib/color'
import { pushToast } from '../toast/store'
import type { Playlist } from '../../../electron/sc/types'

type Tab = 'tracks' | 'playlists' | 'likes'

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
    <div className="text-center">
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

  const base = color ?? { r: 40, g: 40, b: 40 }
  const location = [u?.city, u?.country].filter(Boolean).join(', ')
  const topTracks = tracks.data ?? []

  const tabCls = (active: boolean) =>
    `px-4 py-2 text-sm font-semibold rounded-full transition-colors ${
      active ? 'bg-white text-black' : 'text-[var(--text-dim)] hover:text-white hover:bg-[var(--bg-hover)]'
    }`

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

      {/* Tabs */}
      <div className="flex gap-2 px-6 py-4">
        <button className={tabCls(tab === 'tracks')} onClick={() => setTab('tracks')}>Faixas</button>
        <button className={tabCls(tab === 'playlists')} onClick={() => setTab('playlists')}>Playlists</button>
        <button className={tabCls(tab === 'likes')} onClick={() => setTab('likes')}>Curtidas</button>
      </div>

      <div className="px-4 pb-4">
        {tab === 'tracks' &&
          (tracks.loading ? (
            <TrackListSkeleton />
          ) : tracks.error ? (
            <ErrorState onRetry={tracks.reload} />
          ) : (tracks.data ?? []).length === 0 ? (
            <EmptyState title="Nenhuma faixa" />
          ) : (
            <TrackList tracks={tracks.data ?? []} header />
          ))}

        {tab === 'likes' &&
          (likes.loading ? (
            <TrackListSkeleton />
          ) : (likes.data ?? []).length === 0 ? (
            <EmptyState title="Nenhuma curtida" />
          ) : (
            <TrackList tracks={likes.data ?? []} header />
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
      </div>
    </section>
  )
}
