import fs from 'node:fs'
import path from 'node:path'

export interface Settings {
  zoom: number // 0.8 .. 1.4
  language: 'pt' | 'en'
  discordEnabled: boolean
  closeToTray: boolean
  streamPref: 'progressive' | 'hls'
  startWithWindows: boolean
  notifications: boolean
  reduceMotion: boolean
  volume: number // 0 .. 1
  autoplay: boolean
}

export const DEFAULT_SETTINGS: Settings = {
  zoom: 1,
  language: 'pt',
  discordEnabled: true,
  closeToTray: true,
  streamPref: 'progressive',
  startWithWindows: false,
  notifications: false,
  reduceMotion: false,
  volume: 1,
  autoplay: true,
}

// Pure: merge/sanitize arbitrary JSON into valid Settings.
export function mergeSettings(loaded: unknown): Settings {
  const out = { ...DEFAULT_SETTINGS }
  if (loaded && typeof loaded === 'object') {
    const r = loaded as Record<string, unknown>
    if (typeof r.zoom === 'number' && r.zoom >= 0.5 && r.zoom <= 2) out.zoom = r.zoom
    if (r.language === 'pt' || r.language === 'en') out.language = r.language
    if (typeof r.discordEnabled === 'boolean') out.discordEnabled = r.discordEnabled
    if (typeof r.closeToTray === 'boolean') out.closeToTray = r.closeToTray
    if (r.streamPref === 'progressive' || r.streamPref === 'hls') out.streamPref = r.streamPref
    if (typeof r.startWithWindows === 'boolean') out.startWithWindows = r.startWithWindows
    if (typeof r.notifications === 'boolean') out.notifications = r.notifications
    if (typeof r.reduceMotion === 'boolean') out.reduceMotion = r.reduceMotion
    if (typeof r.volume === 'number' && r.volume >= 0 && r.volume <= 1) out.volume = r.volume
    if (typeof r.autoplay === 'boolean') out.autoplay = r.autoplay
  }
  return out
}

let file = ''
let cache: Settings = { ...DEFAULT_SETTINGS }

export function initSettings(dir: string): Settings {
  file = path.join(dir, 'settings.json')
  try {
    cache = mergeSettings(JSON.parse(fs.readFileSync(file, 'utf-8')))
  } catch {
    cache = { ...DEFAULT_SETTINGS }
  }
  return cache
}

export function getSettings(): Settings {
  return cache
}

export function setSettings(patch: Partial<Settings>): Settings {
  cache = mergeSettings({ ...cache, ...patch })
  try {
    fs.writeFileSync(file, JSON.stringify(cache, null, 2))
  } catch {
    // best-effort
  }
  return cache
}
