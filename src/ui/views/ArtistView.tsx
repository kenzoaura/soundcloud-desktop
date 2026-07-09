import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { useAsync } from '../useAsync'
import TrackList from '../TrackList'
import TrackListSkeleton from '../TrackListSkeleton'
import ErrorState from '../ErrorState'
import EmptyState from '../EmptyState'
import { getCoverColor, rgbToCss, type RGB } from '../../lib/color'
import type { Playlist } from '../../../electron/sc/types'

type Tab = 'tracks' | 'playlists' | 'likes'

function compact(n?: number): string {
  if (!n && n !== 0) return ''
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1).replace('.0', '')}M`
  if (n >= 1_000) return `${(n / 1_000).toFixed(1).replace('.0', '')}K`
  return String(n)
}

export default function ArtistView() {
  const { id } = useParams()
  const uid = Number(id)
  const user = useAsync(() => window.sc.user(uid), [id])
  const [tab, setTab] = useState<Tab>('tracks')
  const [color, setColor] = useState<RGB | null>(null)

  const u = user.data
  useEffect(() => {
    const art = u?.bannerUrl || u?.avatarUrl
    if (art) getCoverColor(art).then(setColor)
  }, [u?.bannerUrl, u?.avatarUrl])

  const tracks = useAsync(() => window.sc.userTracks(uid), [id, tab === 'tracks'])
  const playlists = useAsync(() => (tab === 'playlists' ? window.sc.userPlaylists(uid) : Promise.resolve<Playlist[]>([])), [id, tab])
  const likes = useAsync(() => (tab === 'likes' ? window.sc.userLikes(uid) : Promise.resolve([])), [id, tab])

  const base = color ?? { r: 40, g: 40, b: 40 }
  const meta = [compact(u?.followersCount) && `${compact(u?.followersCount)} seguidores`, u?.city, u?.country]
    .filter(Boolean)
    .join(' · ')

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
        <div className="flex items-end gap-6">
          <img
            src={u?.avatarUrl}
            className="w-40 h-40 max-[900px]:w-28 max-[900px]:h-28 rounded-full object-cover shadow-2xl bg-white/5 shrink-0"
          />
          <div className="min-w-0 pb-1">
            <div className="eyebrow">Perfil</div>
            <h1 className="display text-[clamp(2rem,5vw,4rem)] text-white truncate mt-1">{u?.username ?? '…'}</h1>
            {meta && <div className="text-sm text-[var(--text-dim)] mt-3">{meta}</div>}
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
