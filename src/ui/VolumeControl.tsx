import { useState } from 'react'
import { Volume2, Volume1, VolumeX } from 'lucide-react'
import { usePlayer } from '../player/store'
import { useSettings } from '../settings/store'

export default function VolumeControl() {
  const volume = usePlayer((s) => s.volume)
  const setVolume = useSettings((s) => s.setVolume) // applies live + persists
  const [last, setLast] = useState(volume || 1)

  const Icon = volume === 0 ? VolumeX : volume < 0.5 ? Volume1 : Volume2
  const toggleMute = () => {
    if (volume > 0) {
      setLast(volume)
      setVolume(0)
    } else {
      setVolume(last || 1)
    }
  }
  // Mouse wheel over the control nudges the volume (Spotify/YouTube style).
  const onWheel = (e: React.WheelEvent) => {
    const step = 0.05
    const next = e.deltaY < 0 ? volume + step : volume - step
    setVolume(Math.round(Math.max(0, Math.min(1, next)) * 100) / 100)
  }

  return (
    <div className="flex items-center gap-2" onWheel={onWheel}>
      <button
        onClick={toggleMute}
        className="w-8 h-8 grid place-items-center rounded-full text-[var(--text-dim)] hover:text-white hover:bg-white/5 transition-colors shrink-0"
        aria-label="Mudo"
      >
        <Icon size={18} />
      </button>
      <div className="relative w-28 h-1 group">
        <div className="absolute inset-0 rounded-full bg-white/15" />
        <div
          className="absolute inset-y-0 left-0 rounded-full bg-white group-hover:bg-[var(--accent)] transition-colors"
          style={{ width: `${volume * 100}%` }}
        />
        {/* Draggable thumb, revealed on hover */}
        <div
          className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 w-3 h-3 rounded-full bg-white shadow scale-0 opacity-0 group-hover:scale-100 group-hover:opacity-100 transition-[transform,opacity] duration-150 ease-out pointer-events-none"
          style={{ left: `${volume * 100}%` }}
        />
        {/* Floating % tooltip, revealed on hover */}
        <div
          className="absolute bottom-full mb-2 -translate-x-1/2 translate-y-1 px-1.5 py-0.5 rounded-md bg-black/85 text-white text-[10px] tabular-nums whitespace-nowrap opacity-0 group-hover:translate-y-0 group-hover:opacity-100 transition-[transform,opacity] duration-150 ease-out pointer-events-none"
          style={{ left: `${volume * 100}%` }}
        >
          {Math.round(volume * 100)}%
        </div>
        <input
          type="range"
          min={0}
          max={1}
          step={0.01}
          value={volume}
          onChange={(e) => setVolume(Number(e.target.value))}
          className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
          aria-label="Volume"
        />
      </div>
    </div>
  )
}
