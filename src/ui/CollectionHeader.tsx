import { useEffect, useState } from 'react'
import { Play } from 'lucide-react'
import { getCoverColor, rgbToCss, type RGB } from '../lib/color'

export default function CollectionHeader({
  artworkUrl,
  eyebrow,
  title,
  meta,
  rounded = 'rounded-lg',
  onPlay,
}: {
  artworkUrl?: string
  eyebrow: string
  title: string
  meta?: string
  rounded?: string
  onPlay?: () => void
}) {
  const [color, setColor] = useState<RGB | null>(null)
  useEffect(() => {
    if (!artworkUrl) {
      setColor(null)
      return
    }
    getCoverColor(artworkUrl).then(setColor)
  }, [artworkUrl])

  const base = color ?? { r: 60, g: 40, b: 20 }
  const bg = `linear-gradient(180deg, ${rgbToCss(base, 0.7)} 0%, ${rgbToCss(base, 0.15)} 60%, transparent 100%)`

  return (
    <div className="relative px-6 pt-8 pb-5" style={{ backgroundImage: bg }}>
      <div className="flex items-end gap-6">
        {artworkUrl ? (
          <img
            src={artworkUrl}
            className={`w-44 h-44 max-[900px]:w-32 max-[900px]:h-32 object-cover shadow-2xl shrink-0 ${rounded}`}
          />
        ) : (
          <div className={`w-44 h-44 max-[900px]:w-32 max-[900px]:h-32 shrink-0 grid place-items-center shadow-2xl ${rounded}`} style={{ background: `linear-gradient(135deg, var(--accent), var(--accent-deep))` }}>
            <Play size={48} className="text-white/90" fill="currentColor" />
          </div>
        )}
        <div className="min-w-0 pb-1">
          <div className="eyebrow">{eyebrow}</div>
          <h1 className="display text-[clamp(2rem,5vw,4.25rem)] text-white truncate mt-1">{title}</h1>
          {meta && <div className="text-sm text-[var(--text-dim)] mt-3">{meta}</div>}
          {onPlay && (
            <button
              onClick={onPlay}
              className="mt-5 inline-flex items-center gap-2 pl-4 pr-5 py-2.5 rounded-full bg-[var(--accent)] hover:bg-[var(--accent-hover)] text-white font-bold shadow-lg hover:scale-[1.03] active:scale-95 transition"
            >
              <Play size={18} fill="currentColor" /> Tocar
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
