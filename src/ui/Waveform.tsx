import { useEffect, useRef, useState } from 'react'

const cache = new Map<string, number[] | null>()

export function clearWaveformCache(): void {
  cache.clear()
}

function useWaveform(url?: string): number[] | null {
  const [peaks, setPeaks] = useState<number[] | null>(url ? cache.get(url) ?? null : null)
  useEffect(() => {
    if (!url) {
      setPeaks(null)
      return
    }
    if (cache.has(url)) {
      setPeaks(cache.get(url)!)
      return
    }
    let alive = true
    window.sc
      .waveform(url)
      .then((p) => {
        cache.set(url, p)
        if (alive) setPeaks(p)
      })
      .catch(() => {
        cache.set(url, null)
        if (alive) setPeaks(null)
      })
    return () => {
      alive = false
    }
  }, [url])
  return peaks
}

function downsample(peaks: number[], n: number): number[] {
  const size = peaks.length / n
  const out: number[] = []
  for (let i = 0; i < n; i++) {
    const start = Math.floor(i * size)
    const end = Math.max(start + 1, Math.floor((i + 1) * size))
    let sum = 0
    let c = 0
    for (let j = start; j < end && j < peaks.length; j++) {
      sum += peaks[j]
      c++
    }
    out.push(c ? sum / c : 0)
  }
  // Rescale to 0..1 and apply a slight curve so quiet/loud parts read clearly.
  const max = out.reduce((m, v) => (v > m ? v : m), 0.0001)
  return out.map((v) => Math.pow(v / max, 0.85))
}

export interface WaveMarker {
  fraction: number
  avatar?: string
  name: string
  body: string
}

export default function Waveform({
  url,
  progress,
  onSeek,
  bars = 100,
  className = '',
  markers,
}: {
  url?: string
  progress: number
  onSeek: (fraction: number) => void
  bars?: number
  className?: string
  markers?: WaveMarker[]
}) {
  const peaks = useWaveform(url)
  const ref = useRef<HTMLDivElement>(null)
  const [hover, setHover] = useState<number | null>(null)
  const data = peaks ? downsample(peaks, bars) : Array.from({ length: bars }, () => 0.18)

  const fractionAt = (clientX: number): number => {
    const el = ref.current
    if (!el) return 0
    const r = el.getBoundingClientRect()
    return Math.max(0, Math.min(1, (clientX - r.left) / r.width))
  }

  return (
    <div
      ref={ref}
      onClick={(e) => onSeek(fractionAt(e.clientX))}
      onMouseMove={(e) => setHover(fractionAt(e.clientX))}
      onMouseLeave={() => setHover(null)}
      className={`group relative flex items-center gap-[2px] cursor-pointer ${className}`}
    >
      {data.map((v, i) => {
        const at = (i + 0.5) / data.length
        const played = at <= progress
        // Bars between the playhead and the cursor preview the seek target.
        const previewed = hover !== null && at <= hover && !played
        return (
          <div
            key={i}
            style={{ height: `${Math.max(10, v * 100)}%` }}
            className={`flex-1 rounded-full transition-colors duration-75 ${
              played
                ? 'bg-[var(--accent)]'
                : previewed
                  ? 'bg-[var(--accent)]/50'
                  : 'bg-white/20 group-hover:bg-white/30'
            }`}
          />
        )
      })}

      {/* Comment markers along the timeline (SoundCloud-style) */}
      {markers?.map((m, i) => {
        // Anchor the tooltip so it never overflows the waveform edges.
        const tip =
          m.fraction < 0.2
            ? 'left-0'
            : m.fraction > 0.8
              ? 'right-0'
              : 'left-1/2 -translate-x-1/2'
        return (
          <div
            key={i}
            className="absolute -bottom-1 -translate-x-1/2 z-10 group/mk"
            style={{ left: `${m.fraction * 100}%` }}
            onClick={(e) => {
              e.stopPropagation()
              onSeek(m.fraction)
            }}
          >
            <img
              src={m.avatar}
              className="w-4 h-4 rounded-full object-cover bg-white/10 ring-1 ring-black/60 hover:scale-125 transition-transform"
            />
            <div
              className={`absolute bottom-full mb-2 ${tip} w-max max-w-[220px] px-2.5 py-1.5 rounded-lg bg-[var(--bg-elevated)] border border-[var(--border)] shadow-xl opacity-0 group-hover/mk:opacity-100 transition-opacity pointer-events-none z-20`}
            >
              <div className="flex items-center gap-1.5 mb-0.5">
                <img src={m.avatar} className="w-4 h-4 rounded-full object-cover bg-white/10" />
                <span className="text-xs font-semibold text-white truncate">{m.name}</span>
              </div>
              <div className="text-xs text-[var(--text-dim)] break-words">{m.body}</div>
            </div>
          </div>
        )
      })}
    </div>
  )
}
