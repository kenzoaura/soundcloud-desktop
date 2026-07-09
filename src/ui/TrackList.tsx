import type { Track } from '../../electron/sc/types'
import TrackRow from './TrackRow'

export default function TrackList({
  tracks,
  header = false,
  liked = false,
  playlistId,
}: {
  tracks: Track[]
  header?: boolean
  liked?: boolean
  playlistId?: number
}) {
  if (tracks.length === 0) {
    return <div className="p-6 text-sm text-[var(--text-muted)]">Nada aqui ainda.</div>
  }
  return (
    <div className="px-2 pb-4">
      {header && (
        <div className="grid grid-cols-[1.75rem_2.75rem_1fr_auto] items-center gap-3 px-3 py-2 mb-1 border-b border-[var(--border)] text-[11px] font-semibold uppercase tracking-wider text-[var(--text-muted)]">
          <span className="text-right">#</span>
          <span />
          <span>Título</span>
          <span />
        </div>
      )}
      <div className="flex flex-col gap-0.5">
        {tracks.map((t, i) => (
          <TrackRow key={`${t.id}-${i}`} tracks={tracks} index={i} liked={liked} playlistId={playlistId} />
        ))}
      </div>
    </div>
  )
}
