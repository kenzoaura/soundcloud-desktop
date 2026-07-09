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

export default function Waveform({
  url,
  progress,
  onSeek,
  bars = 100,
  className = '',
}: {
  url?: string
  progress: number
  onSeek: (fraction: number) => void
  bars?: number
  className?: string
}) {
  const peaks = useWaveform(url)
  const ref = useRef<HTMLDivElement>(null)
  const data = peaks ? downsample(peaks, bars) : Array.from({ length: bars }, () => 0.18)

  const seekAt = (clientX: number) => {
    const el = ref.current
    if (!el) return
    const r = el.getBoundingClientRect()
    onSeek(Math.max(0, Math.min(1, (clientX - r.left) / r.width)))
  }

  return (
    <div
      ref={ref}
      onClick={(e) => seekAt(e.clientX)}
      className={`group flex items-center gap-[2px] cursor-pointer ${className}`}
    >
      {data.map((v, i) => {
        const played = (i + 0.5) / data.length <= progress
        return (
          <div
            key={i}
            style={{ height: `${Math.max(10, v * 100)}%` }}
            className={`flex-1 rounded-full transition-colors ${
              played ? 'bg-[var(--accent)]' : 'bg-white/20 group-hover:bg-white/30'
            }`}
          />
        )
      })}
    </div>
  )
}
