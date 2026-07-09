import fs from 'node:fs'
import path from 'node:path'

// Compiled defaults. Overridable at runtime via config.json (see below) so the
// user can change them without rebuilding the app.
export const CONFIG = {
  soundcloudUrl: 'https://soundcloud.com/discover',
  // Public Discord application client id from
  // https://discord.com/developers/applications. Not a secret.
  discordClientId: '1523871016299008081',
  titleBarHeight: 36,
  // Fallback SoundCloud API client_id (may expire; the app re-extracts one at
  // runtime when this fails).
  soundcloudClientId: 'a3e059563d7fd3372b49b37f00a00bcf',
}

// Fields a user may override at runtime.
export interface UserConfig {
  soundcloudUrl?: string
  discordClientId?: string
}

// Pure: pick the valid, non-empty string overrides from arbitrary JSON.
export function mergeUserConfig(loaded: unknown): UserConfig {
  const out: UserConfig = {}
  if (loaded && typeof loaded === 'object') {
    const r = loaded as Record<string, unknown>
    if (typeof r.soundcloudUrl === 'string' && r.soundcloudUrl.trim()) {
      out.soundcloudUrl = r.soundcloudUrl.trim()
    }
    if (typeof r.discordClientId === 'string' && r.discordClientId.trim()) {
      out.discordClientId = r.discordClientId.trim()
    }
  }
  return out
}

// Read <userDataDir>/config.json, apply valid overrides onto CONFIG, and seed a
// template file on first run. Returns the config file path. Best-effort: any IO
// failure leaves the compiled defaults in place. Call once at startup, before
// anything reads CONFIG.
export function loadUserConfig(userDataDir: string): string {
  const file = path.join(userDataDir, 'config.json')
  let loaded: unknown
  try {
    loaded = JSON.parse(fs.readFileSync(file, 'utf-8'))
  } catch {
    loaded = undefined
  }
  const overrides = mergeUserConfig(loaded)
  if (overrides.soundcloudUrl) CONFIG.soundcloudUrl = overrides.soundcloudUrl
  if (overrides.discordClientId) CONFIG.discordClientId = overrides.discordClientId

  // First run (no readable file): write a template the user can edit.
  if (loaded === undefined) {
    try {
      fs.writeFileSync(
        file,
        JSON.stringify(
          { soundcloudUrl: CONFIG.soundcloudUrl, discordClientId: CONFIG.discordClientId },
          null,
          2,
        ),
      )
    } catch {
      // best-effort
    }
  }
  return file
}
