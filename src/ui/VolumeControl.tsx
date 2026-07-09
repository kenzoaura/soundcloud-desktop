import { useState } from 'react'
import { Volume2, Volume1, VolumeX } from 'lucide-react'
import { usePlayer } from '../player/store'

export default function VolumeControl() {
  const volume = usePlayer((s) => s.volume)
  const setVolume = usePlayer((s) => s.setVolume)
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

  return (
    <div className="flex items-center gap-2">
      <button onClick={toggleMute} className="text-[var(--text-dim)] hover:text-white transition-colors" aria-label="Mudo">
        <Icon size={18} />
      </button>
      <div className="relative w-28 h-1 group">
        <div className="absolute inset-0 rounded-full bg-white/15" />
        <div
          className="absolute inset-y-0 left-0 rounded-full bg-white group-hover:bg-[var(--accent)] transition-colors"
          style={{ width: `${volume * 100}%` }}
        />
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
