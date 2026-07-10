import { create } from 'zustand'
import { usePlayer } from '../player/store'

export type ThemeId = 'dark' | 'slate' | 'warm' | 'violet' | 'ocean'

export type AppSettings = {
  zoom: number
  theme: ThemeId
  language: 'pt' | 'en'
  discordEnabled: boolean
  closeToTray: boolean
  streamPref: 'progressive' | 'hls'
  startWithWindows: boolean
  notifications: boolean
  reduceMotion: boolean
  volume: number
  autoplay: boolean
}

interface SettingsState {
  settings: AppSettings | null
  load: () => Promise<void>
  update: (patch: Partial<AppSettings>) => Promise<void>
  // Live volume from the player bar: applies immediately + persists (debounced)
  // so it survives restarts and isn't clobbered when other settings change.
  setVolume: (v: number) => void
}

function applyRenderer(s: AppSettings): void {
  document.documentElement.classList.toggle('force-reduce-motion', s.reduceMotion)
  // 'dark' is the default (no attribute); other themes set data-theme on <html>.
  if (s.theme && s.theme !== 'dark') document.documentElement.dataset.theme = s.theme
  else delete document.documentElement.dataset.theme
  // setVolume applies to both the store and the audio engine.
  usePlayer.getState().setVolume(s.volume)
}

let volumeTimer: ReturnType<typeof setTimeout> | null = null

export const useSettings = create<SettingsState>((set, get) => ({
  settings: null,
  load: async () => {
    const s = await window.settings.get()
    set({ settings: s })
    applyRenderer(s)
  },
  update: async (patch) => {
    const s = await window.settings.set(patch)
    set({ settings: s })
    applyRenderer(s)
  },
  setVolume: (v) => {
    usePlayer.getState().setVolume(v) // immediate audio + store
    const cur = get().settings
    if (cur) set({ settings: { ...cur, volume: v } }) // keep settings in sync (no re-apply)
    if (volumeTimer) clearTimeout(volumeTimer)
    volumeTimer = setTimeout(() => {
      volumeTimer = null
      void window.settings.set({ volume: v }) // persist to disk, debounced
    }, 400)
  },
}))

// Read the current settings synchronously (for non-React callers like the player).
export function currentSettings(): AppSettings | null {
  return useSettings.getState().settings
}
