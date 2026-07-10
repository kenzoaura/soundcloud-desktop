import { create } from 'zustand'
import { usePlayer } from './store'

// Gains (dB, -12..+12) for the 5 EQ bands [60, 230, 910, 3600, 14000] Hz.
export type EqPreset = 'flat' | 'bass' | 'treble' | 'vocal' | 'lofi' | 'electronic' | 'custom'

export const EQ_PRESETS: Record<Exclude<EqPreset, 'custom'>, number[]> = {
  flat: [0, 0, 0, 0, 0],
  bass: [12, 7, 1, 0, 0],
  treble: [0, 0, 1, 7, 12],
  vocal: [-4, -1, 6, 4, 0],
  lofi: [7, 3, -3, -9, -13],
  electronic: [9, 4, 0, 5, 8],
}

const KEY = 'sc:eq'

interface EqState {
  enabled: boolean
  gains: number[]
  preset: EqPreset
  setEnabled: (v: boolean) => void
  setGain: (band: number, value: number) => void
  applyPreset: (p: EqPreset) => void
}

function load(): { enabled: boolean; gains: number[]; preset: EqPreset } {
  try {
    const raw = localStorage.getItem(KEY)
    if (raw) {
      const s = JSON.parse(raw)
      if (Array.isArray(s.gains) && s.gains.length === 5) {
        return { enabled: !!s.enabled, gains: s.gains.map(Number), preset: s.preset ?? 'custom' }
      }
    }
  } catch {
    // ignore
  }
  return { enabled: false, gains: [0, 0, 0, 0, 0], preset: 'flat' }
}

// Push the effective gains (flat when disabled) to the audio engine.
function apply(enabled: boolean, gains: number[]): void {
  usePlayer.getState().setEq(enabled ? gains : [0, 0, 0, 0, 0])
}

function persist(s: { enabled: boolean; gains: number[]; preset: EqPreset }): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(s))
  } catch {
    // ignore
  }
}

const initial = load()
// Apply the saved EQ once the engine exists (on first play it re-reads via store).
apply(initial.enabled, initial.gains)

export const useEq = create<EqState>((set, get) => ({
  enabled: initial.enabled,
  gains: initial.gains,
  preset: initial.preset,
  setEnabled: (v) => {
    set({ enabled: v })
    const s = get()
    apply(v, s.gains)
    persist({ enabled: v, gains: s.gains, preset: s.preset })
  },
  setGain: (band, value) => {
    const gains = get().gains.slice()
    gains[band] = value
    set({ gains, preset: 'custom' })
    const s = get()
    apply(s.enabled, gains)
    persist({ enabled: s.enabled, gains, preset: 'custom' })
  },
  applyPreset: (p) => {
    const gains = p === 'custom' ? get().gains : EQ_PRESETS[p].slice()
    set({ gains, preset: p })
    const s = get()
    apply(s.enabled, gains)
    persist({ enabled: s.enabled, gains, preset: p })
  },
}))

// The audio graph is (re)built lazily on play, so re-assert the saved EQ whenever
// a new track starts — this is what makes the equalizer survive an app restart.
let lastTrackId: number | null = null
usePlayer.subscribe((state) => {
  const id = state.current?.id ?? null
  if (id !== lastTrackId) {
    lastTrackId = id
    const s = useEq.getState()
    apply(s.enabled, s.gains)
  }
})
