import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { Play, Pause, Heart, Repeat2, MessageCircle } from 'lucide-react'
import { useAsync } from '../useAsync'
import Waveform from '../Waveform'
import TrackList from '../TrackList'
import { usePlayer } from '../../player/store'
import { getCoverColor, rgbToCss, type RGB } from '../../lib/color'
import type { Track } from '../../../electron/sc/types'

function compact(n?: number): string {
  if (!n && n !== 0) return '0'
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1).replace('.0', '')}M`
  if (n >= 1_000) return `${(n / 1_000).toFixed(1).replace('.0', '')}K`
  return String(n)
}

function relative(iso?: string): string {
  if (!iso) return ''
  const d = new Date(iso).getTime()
  if (Number.isNaN(d)) return ''
  const days = Math.floor((Date.now() - d) / 86_400_000)
  if (days < 1) return 'hoje'
  if (days < 30) return `há ${days}d`
  const months = Math.floor(days / 30)
  if (months < 12) return `há ${months} ${months === 1 ? 'mês' : 'meses'}`
  const years = Math.floor(months / 12)
  return `há ${years} ${years === 1 ? 'ano' : 'anos'}`
}

function Stat({ icon, value }: { icon: React.ReactNode; value: string }) {
  return (
    <span className="inline-flex items-center gap-1.5 text-sm text-[var(--text-dim)]">
      {icon}
      {value}
    </span>
  )
}

export default function TrackView() {
  const { id } = useParams()
  const tid = Number(id)
  const track = useAsync(() => window.sc.track(tid), [id])
  const related = useAsync(() => window.sc.trackRelated(tid), [id])
  const comments = useAsync(() => window.sc.trackComments(tid), [id])
  const likers = useAsync(() => window.sc.trackLikers(tid), [id])

  const current = usePlayer((s) => s.current)
  const isPlaying = usePlayer((s) => s.isPlaying)
  const position = usePlayer((s) => s.position)
  const duration = usePlayer((s) => s.duration)
  const playQueue = usePlayer((s) => s.playQueue)
  const toggle = usePlayer((s) => s.toggle)
  const seek = usePlayer((s) => s.seek)

  const t: Track | null = track.data
  const isCurrent = current?.id === tid
  const [color, setColor] = useState<RGB | null>(null)
  useEffect(() => {
    if (t?.artworkUrl) getCoverColor(t.artworkUrl).then(setColor)
  }, [t?.artworkUrl])

  const base = color ?? { r: 40, g: 40, b: 40 }
  const onPlay = () => {
    if (isCurrent) toggle()
    else if (t) void playQueue([t], 0)
  }

  return (
    <section>
      {/* Hero */}
      <div
        className="p-6"
        style={{ backgroundImage: `linear-gradient(180deg, ${rgbToCss(base, 0.6)}, transparent)` }}
      >
        <div className="flex gap-5">
          <button
            onClick={onPlay}
            className="w-16 h-16 shrink-0 rounded-full bg-[var(--accent)] hover:bg-[var(--accent-hover)] grid place-items-center text-white shadow-lg hover:scale-105 transition"
            aria-label={isCurrent && isPlaying ? 'Pausar' : 'Tocar'}
          >
            {isCurrent && isPlaying ? <Pause size={26} fill="currentColor" /> : <Play size={26} fill="currentColor" />}
          </button>
          <div className="flex-1 min-w-0">
            <h1 className="display text-3xl truncate">{t?.title ?? '…'}</h1>
            {t && (
              <Link to={`/artist/${t.artistId}`} className="text-[var(--text-dim)] hover:text-white hover:underline">
                {t.artist}
              </Link>
            )}
          </div>
          {t?.artworkUrl && (
            <img src={t.artworkUrl} className="w-56 h-56 max-[1000px]:w-40 max-[1000px]:h-40 rounded-xl object-cover shadow-2xl shrink-0" />
          )}
        </div>

        {t?.waveformUrl && (
          <div className="mt-5">
            <Waveform
              url={t.waveformUrl}
              progress={isCurrent && duration ? position / duration : 0}
              onSeek={(f) => {
                if (isCurrent) seek(f * duration)
                else if (t) void playQueue([t], 0)
              }}
              bars={200}
              className="h-16"
            />
          </div>
        )}

        <div className="flex items-center gap-5 mt-4">
          <Stat icon={<Play size={14} />} value={compact(t?.playbackCount)} />
          <Stat icon={<Heart size={14} />} value={compact(t?.likesCount)} />
          <Stat icon={<Repeat2 size={14} />} value={compact(t?.repostsCount)} />
          <Stat icon={<MessageCircle size={14} />} value={compact(t?.commentCount)} />
          <span className="text-sm text-[var(--text-muted)] ml-auto">{relative(t?.createdAt)}</span>
        </div>
      </div>

      <div className="grid grid-cols-[1fr_320px] max-[1000px]:grid-cols-1 gap-6 p-6">
        {/* Comments */}
        <div className="min-w-0">
          <h2 className="text-lg font-bold mb-3">{compact(t?.commentCount)} comentários</h2>
          {comments.loading && <div className="text-sm text-[var(--text-muted)]">Carregando…</div>}
          <div className="flex flex-col gap-4">
            {(comments.data ?? []).map((c) => (
              <div key={c.id} className="flex gap-3">
                <img src={c.userAvatar} className="w-9 h-9 rounded-full object-cover bg-white/10 shrink-0" />
                <div className="min-w-0">
                  <div className="text-sm">
                    <span className="font-semibold text-white">{c.userName}</span>
                    <span className="text-[var(--text-muted)]"> · {Math.floor(c.atMs / 60000)}:{String(Math.floor((c.atMs % 60000) / 1000)).padStart(2, '0')}</span>
                  </div>
                  <div className="text-sm text-[var(--text-dim)] break-words">{c.body}</div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Sidebar: fans + related */}
        <div className="min-w-0">
          {(likers.data ?? []).length > 0 && (
            <div className="mb-6">
              <h2 className="eyebrow mb-2">Curtido por</h2>
              <div className="flex flex-wrap gap-2">
                {(likers.data ?? []).slice(0, 18).map((u) => (
                  <Link key={u.id} to={`/artist/${u.id}`} title={u.username}>
                    <img
                      src={u.avatarUrl}
                      className="w-9 h-9 rounded-full object-cover bg-white/10 hover:ring-2 hover:ring-[var(--accent)] transition"
                    />
                  </Link>
                ))}
              </div>
            </div>
          )}
          <h2 className="eyebrow mb-2">Faixas relacionadas</h2>
          <TrackList tracks={related.data ?? []} />
        </div>
      </div>
    </section>
  )
}
