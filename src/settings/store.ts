import { create } from 'zustand'
import { usePlayer } from '../player/store'

export type AppSettings = {
  zoom: number
  language: 'pt' | 'en'
  discordEnabled: boolean
  closeToTray: boolean
  streamPref: 'progressive' | 'hls'
  startWithWindows: boolean
  notifications: boolean
  reduceMotion: boolean
  volume: number
}

interface SettingsState {
  settings: AppSettings | null
  load: () => Promise<void>
  update: (patch: Partial<AppSettings>) => Promise<void>
}

function applyRenderer(s: AppSettings): void {
  document.documentElement.classList.toggle('force-reduce-motion', s.reduceMotion)
  usePlayer.setState({ volume: s.volume })
}

export const useSettings = create<SettingsState>((set) => ({
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
}))

// Read the current settings synchronously (for non-React callers like the player).
export function currentSettings(): AppSettings | null {
  return useSettings.getState().settings
}
