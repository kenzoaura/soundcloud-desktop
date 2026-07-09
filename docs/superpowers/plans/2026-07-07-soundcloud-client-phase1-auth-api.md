# SoundCloud Client — Phase 1: Auth + API Foundation — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Log the user into their real SoundCloud account, capture the session OAuth token + client_id, and prove end-to-end that the main process can fetch and normalize the user's liked tracks from SoundCloud's internal API v2.

**Architecture:** All API/auth logic lives in the Electron main process (no CORS, token isolated). A hidden login webview loads soundcloud.com and the main process captures the `Authorization: OAuth <token>` header and `client_id` query param off `api-v2.soundcloud.com` requests. An env-gated dev harness proves the slice by fetching likes and logging their titles. No UI yet.

**Tech Stack:** Electron 30 (main, `safeStorage`, `session.webRequest`, `BrowserWindow`), Node global `fetch`, TypeScript, vitest. No new runtime dependencies.

**Spec:** `docs/superpowers/specs/2026-07-07-soundcloud-custom-client-design.md` (build order item 1).

## Global Constraints

- **Windows-first.** No macOS/Linux-specific paths.
- **NO git commits or pushes.** Leave changes in the working tree; each task ends in a review checkpoint.
- **Electron main + preloads are CommonJS** (`type:commonjs`, `vite.config.mts`). Import electron values with named imports (compile to `require`). Node built-ins with the `node:` prefix.
- **Launching the app requires** `env -u ELECTRON_RUN_AS_NODE npm run dev` (the harness shell sets `ELECTRON_RUN_AS_NODE=1`, which otherwise runs electron as plain Node — no GUI).
- **The token never crosses IPC to the renderer.** Main holds it; main returns data only.
- **API base:** `https://api-v2.soundcloud.com`. Every request carries `client_id` (query) and, when authed, `Authorization: OAuth <token>` (header).
- Do NOT remove the current embed window in this phase — the dev harness is gated behind `SC_DEV_HARNESS=1`; normal launch is unchanged. Removal happens in a later phase.

---

## File Structure (Phase 1)

- `electron/sc/types.ts` — CREATE: app-facing types (`Track`, `User`, `Playlist`, `Transcoding`).
- `electron/sc/normalize.ts` — CREATE: pure raw-JSON → app types. **Unit-tested.**
- `electron/sc/normalize.test.ts` — CREATE.
- `electron/sc/clientId.ts` — CREATE: resolve client_id (captured → bundle scrape → config fallback).
- `electron/sc/api.ts` — CREATE: main-process API client (`me`, `likes`).
- `electron/auth/tokenStore.ts` — CREATE: encrypted token persistence (`safeStorage`).
- `electron/auth/tokenStore.test.ts` — CREATE (pure validation helper).
- `electron/auth/loginWindow.ts` — CREATE: hidden login webview + header capture.
- `electron/auth/session.ts` — CREATE: ties tokenStore + loginWindow; `ensureAuth()`.
- `electron/devHarness.ts` — CREATE: env-gated end-to-end proof (login → likes → log).
- `electron/main.ts` — MODIFY: run the harness when `SC_DEV_HARNESS=1`, else current behavior.
- `test/fixtures/` — CREATE: captured real API JSON (added during the verification task).

---

## Task 1: App types + `normalize` (TDD)

**Files:**
- Create: `electron/sc/types.ts`
- Create: `electron/sc/normalize.ts`
- Test: `electron/sc/normalize.test.ts`

**Interfaces produced (later tasks/phases depend on these EXACT names):**
```ts
// types.ts
export interface Transcoding { url: string; protocol: 'progressive' | 'hls'; mimeType: string }
export interface Track {
  id: number
  title: string
  durationMs: number
  artworkUrl?: string
  permalink: string
  artist: string
  artistId: number
  transcodings: Transcoding[]
}
export interface User { id: number; username: string; avatarUrl?: string; permalink: string }
export interface Playlist {
  id: number; title: string; artworkUrl?: string; trackCount: number; user: string; permalink: string
}

// normalize.ts
export function bestArtwork(url: string | null | undefined, fallback?: string | null): string | undefined
export function normalizeTrack(raw: unknown): Track | null
export function normalizeUser(raw: unknown): User | null
export function normalizePlaylist(raw: unknown): Playlist | null
```

Field names come from SoundCloud's public API v2 shape (as used by yt-dlp/scdl):
a track has `id` (number), `title` (string), `duration` (ms, number),
`artwork_url` (string|null, e.g. `.../artworks-xxx-large.jpg`), `permalink_url`
(string), `user` (`{ id, username, permalink_url, avatar_url }`), and
`media.transcodings` (array of `{ url, format: { protocol, mime_type } }`).
`bestArtwork` upgrades `-large.jpg` → `-t500x500.jpg` and falls back to the
user avatar when the track artwork is null.

- [ ] **Step 1: Write the failing test — `electron/sc/normalize.test.ts`**

```ts
import { describe, it, expect } from 'vitest'
import { bestArtwork, normalizeTrack, normalizeUser, normalizePlaylist } from './normalize'

describe('bestArtwork', () => {
  it('upgrades -large to -t500x500', () => {
    expect(bestArtwork('https://i1.sndcdn.com/artworks-abc-large.jpg')).toBe(
      'https://i1.sndcdn.com/artworks-abc-t500x500.jpg',
    )
  })
  it('falls back to avatar when artwork missing', () => {
    expect(bestArtwork(null, 'https://a/av-large.jpg')).toBe('https://a/av-t500x500.jpg')
  })
  it('returns undefined when nothing usable', () => {
    expect(bestArtwork(null, null)).toBeUndefined()
  })
})

const rawTrack = {
  id: 123,
  title: 'Song',
  duration: 185000,
  artwork_url: 'https://i1.sndcdn.com/artworks-x-large.jpg',
  permalink_url: 'https://soundcloud.com/artist/song',
  user: { id: 9, username: 'Artist', permalink_url: 'https://soundcloud.com/artist', avatar_url: null },
  media: {
    transcodings: [
      { url: 'https://api-v2/prog', format: { protocol: 'progressive', mime_type: 'audio/mpeg' } },
      { url: 'https://api-v2/hls', format: { protocol: 'hls', mime_type: 'audio/mpeg' } },
    ],
  },
}

describe('normalizeTrack', () => {
  it('returns null for non-track input', () => {
    expect(normalizeTrack(null)).toBeNull()
    expect(normalizeTrack({ id: 1 })).toBeNull() // no title
  })
  it('maps a full track', () => {
    const t = normalizeTrack(rawTrack)!
    expect(t.id).toBe(123)
    expect(t.title).toBe('Song')
    expect(t.durationMs).toBe(185000)
    expect(t.artworkUrl).toBe('https://i1.sndcdn.com/artworks-x-t500x500.jpg')
    expect(t.artist).toBe('Artist')
    expect(t.artistId).toBe(9)
    expect(t.transcodings).toHaveLength(2)
    expect(t.transcodings[0]).toEqual({
      url: 'https://api-v2/prog', protocol: 'progressive', mimeType: 'audio/mpeg',
    })
  })
})

describe('normalizeUser', () => {
  it('maps a user or returns null', () => {
    expect(normalizeUser({ id: 9, username: 'A', permalink_url: 'https://soundcloud.com/a' })).toEqual({
      id: 9, username: 'A', avatarUrl: undefined, permalink: 'https://soundcloud.com/a',
    })
    expect(normalizeUser({ id: 9 })).toBeNull()
  })
})

describe('normalizePlaylist', () => {
  it('maps a playlist', () => {
    const p = normalizePlaylist({
      id: 5, title: 'Mix', track_count: 12, artwork_url: null,
      user: { username: 'A' }, permalink_url: 'https://soundcloud.com/a/sets/mix',
    })!
    expect(p).toEqual({
      id: 5, title: 'Mix', artworkUrl: undefined, trackCount: 12, user: 'A',
      permalink: 'https://soundcloud.com/a/sets/mix',
    })
  })
})
```

- [ ] **Step 2: Run the test, confirm FAIL**

Run: `npx vitest run electron/sc/normalize.test.ts`
Expected: FAIL (cannot import from `./normalize`).

- [ ] **Step 3: Implement `electron/sc/types.ts`** (exact content from the Interfaces block above).

- [ ] **Step 4: Implement `electron/sc/normalize.ts`**

```ts
import type { Track, User, Playlist, Transcoding } from './types'

export function bestArtwork(
  url: string | null | undefined,
  fallback?: string | null,
): string | undefined {
  const src = (url && typeof url === 'string' ? url : '') || (fallback ?? '')
  if (!src) return undefined
  return src.replace(/-large(\.\w+)(\?.*)?$/, '-t500x500$1')
}

function str(v: unknown): string | undefined {
  return typeof v === 'string' && v ? v : undefined
}
function num(v: unknown): number | undefined {
  return typeof v === 'number' && Number.isFinite(v) ? v : undefined
}

export function normalizeUser(raw: unknown): User | null {
  if (!raw || typeof raw !== 'object') return null
  const r = raw as Record<string, unknown>
  const id = num(r.id)
  const username = str(r.username)
  if (id === undefined || !username) return null
  return {
    id,
    username,
    avatarUrl: bestArtwork(str(r.avatar_url)),
    permalink: str(r.permalink_url) ?? '',
  }
}

function normalizeTranscodings(raw: unknown): Transcoding[] {
  const media = (raw as Record<string, unknown>)?.media as Record<string, unknown> | undefined
  const list = Array.isArray(media?.transcodings) ? (media!.transcodings as unknown[]) : []
  const out: Transcoding[] = []
  for (const t of list) {
    if (!t || typeof t !== 'object') continue
    const tr = t as Record<string, unknown>
    const fmt = (tr.format ?? {}) as Record<string, unknown>
    const url = str(tr.url)
    const protocol = fmt.protocol === 'hls' ? 'hls' : fmt.protocol === 'progressive' ? 'progressive' : undefined
    if (!url || !protocol) continue
    out.push({ url, protocol, mimeType: str(fmt.mime_type) ?? 'audio/mpeg' })
  }
  return out
}

export function normalizeTrack(raw: unknown): Track | null {
  if (!raw || typeof raw !== 'object') return null
  const r = raw as Record<string, unknown>
  const id = num(r.id)
  const title = str(r.title)
  if (id === undefined || !title) return null
  const user = (r.user ?? {}) as Record<string, unknown>
  return {
    id,
    title,
    durationMs: num(r.duration) ?? 0,
    artworkUrl: bestArtwork(str(r.artwork_url), str(user.avatar_url)),
    permalink: str(r.permalink_url) ?? '',
    artist: str(user.username) ?? 'Unknown',
    artistId: num(user.id) ?? 0,
    transcodings: normalizeTranscodings(r),
  }
}

export function normalizePlaylist(raw: unknown): Playlist | null {
  if (!raw || typeof raw !== 'object') return null
  const r = raw as Record<string, unknown>
  const id = num(r.id)
  const title = str(r.title)
  if (id === undefined || !title) return null
  const user = (r.user ?? {}) as Record<string, unknown>
  return {
    id,
    title,
    artworkUrl: bestArtwork(str(r.artwork_url), str(user.avatar_url)),
    trackCount: num(r.track_count) ?? 0,
    user: str(user.username) ?? 'Unknown',
    permalink: str(r.permalink_url) ?? '',
  }
}
```

- [ ] **Step 5: Run the test, confirm PASS**

Run: `npx vitest run electron/sc/normalize.test.ts`
Expected: PASS.

- [ ] **Step 6: Checkpoint** — review. Do NOT commit.

---

## Task 2: `tokenStore` — encrypted token persistence

**Files:**
- Create: `electron/auth/tokenStore.ts`
- Test: `electron/auth/tokenStore.test.ts`

**Interfaces produced:**
```ts
export function isValidToken(v: unknown): v is string  // non-empty string, plausible token
export class TokenStore {
  constructor(filePath: string)
  save(token: string): void      // encrypts via safeStorage, writes filePath
  load(): string | null          // decrypts; null if absent/invalid
  clear(): void                  // deletes filePath
}
```
`isValidToken` is the pure, unit-tested part. `TokenStore` uses Electron
`safeStorage` (`encryptString`/`decryptString`) and `node:fs`; it is verified via
the dev harness, not unit tests (safeStorage needs the Electron runtime).

- [ ] **Step 1: Write the failing test — `electron/auth/tokenStore.test.ts`**

```ts
import { describe, it, expect } from 'vitest'
import { isValidToken } from './tokenStore'

describe('isValidToken', () => {
  it('accepts a non-empty string', () => {
    expect(isValidToken('2-12345-abcdef')).toBe(true)
  })
  it('rejects empty / non-string', () => {
    expect(isValidToken('')).toBe(false)
    expect(isValidToken('   ')).toBe(false)
    expect(isValidToken(null)).toBe(false)
    expect(isValidToken(123)).toBe(false)
  })
})
```

- [ ] **Step 2: Run, confirm FAIL**

Run: `npx vitest run electron/auth/tokenStore.test.ts`
Expected: FAIL (cannot import `isValidToken`).

- [ ] **Step 3: Implement `electron/auth/tokenStore.ts`**

```ts
import { safeStorage } from 'electron'
import fs from 'node:fs'

export function isValidToken(v: unknown): v is string {
  return typeof v === 'string' && v.trim().length > 0
}

export class TokenStore {
  constructor(private filePath: string) {}

  save(token: string): void {
    if (!isValidToken(token)) return
    try {
      const enc = safeStorage.isEncryptionAvailable()
        ? safeStorage.encryptString(token)
        : Buffer.from(token, 'utf-8')
      fs.writeFileSync(this.filePath, enc)
    } catch {
      // best-effort
    }
  }

  load(): string | null {
    try {
      const buf = fs.readFileSync(this.filePath)
      const dec = safeStorage.isEncryptionAvailable()
        ? safeStorage.decryptString(buf)
        : buf.toString('utf-8')
      return isValidToken(dec) ? dec : null
    } catch {
      return null
    }
  }

  clear(): void {
    try {
      fs.unlinkSync(this.filePath)
    } catch {
      // already gone
    }
  }
}
```

- [ ] **Step 4: Run, confirm PASS**

Run: `npx vitest run electron/auth/tokenStore.test.ts`
Expected: PASS.

- [ ] **Step 5: Checkpoint** — review. Do NOT commit.

---

## Task 3: `loginWindow` — hidden login webview + capture

**Files:**
- Create: `electron/auth/loginWindow.ts`

**Interfaces produced:**
```ts
export interface Captured { token: string; clientId?: string }
// Opens a login BrowserWindow at soundcloud.com/signin, intercepts the first
// api-v2 request carrying `Authorization: OAuth <token>`, resolves with it and
// closes the window. Rejects if the user closes the window first.
export function runLogin(): Promise<Captured>
```

- [ ] **Step 1: Implement `electron/auth/loginWindow.ts`**

```ts
import { BrowserWindow, session } from 'electron'

export interface Captured {
  token: string
  clientId?: string
}

const API_HOST = 'api-v2.soundcloud.com'

export function runLogin(): Promise<Captured> {
  return new Promise<Captured>((resolve, reject) => {
    const win = new BrowserWindow({
      width: 460,
      height: 680,
      title: 'Log in to SoundCloud',
      autoHideMenuBar: true,
      webPreferences: { partition: 'persist:sc', contextIsolation: true, nodeIntegration: false },
    })

    let done = false
    const finish = (result: Captured | null) => {
      if (done) return
      done = true
      session.fromPartition('persist:sc').webRequest.onBeforeSendHeaders(null)
      if (!win.isDestroyed()) win.close()
      if (result) resolve(result)
      else reject(new Error('login cancelled'))
    }

    session
      .fromPartition('persist:sc')
      .webRequest.onBeforeSendHeaders({ urls: [`https://${API_HOST}/*`] }, (details, cb) => {
        const auth = (details.requestHeaders['Authorization'] ||
          details.requestHeaders['authorization']) as string | undefined
        if (auth && /^OAuth\s+/i.test(auth)) {
          const token = auth.replace(/^OAuth\s+/i, '').trim()
          let clientId: string | undefined
          const m = details.url.match(/[?&]client_id=([^&]+)/)
          if (m) clientId = decodeURIComponent(m[1])
          finish({ token, clientId })
        }
        cb({ requestHeaders: details.requestHeaders })
      })

    win.on('closed', () => finish(null))
    win.loadURL('https://soundcloud.com/signin')
  })
}
```

- [ ] **Step 2: Type-check**

Run: `npx tsc --noEmit`
Expected: no errors originating in `loginWindow.ts`.

- [ ] **Step 3: Checkpoint** — review. Do NOT commit. (Runtime login is exercised in Task 6.)

---

## Task 4: `clientId` resolver

**Files:**
- Create: `electron/sc/clientId.ts`

**Interfaces produced:**
```ts
export function extractClientId(bundleJs: string): string | null   // pure, regex
export class ClientId {
  set(id: string): void
  // returns a usable client_id: captured value, else scraped from soundcloud.com, else CONFIG fallback
  async get(): Promise<string>
  invalidate(): void
}
```

- [ ] **Step 1: Implement `electron/sc/clientId.ts`**

```ts
import { CONFIG } from '../config'

export function extractClientId(bundleJs: string): string | null {
  const m = bundleJs.match(/client_id\s*[:=]\s*["']([a-zA-Z0-9]{16,})["']/)
  return m ? m[1] : null
}

export class ClientId {
  private value: string | null = null

  set(id: string): void {
    if (id) this.value = id
  }

  invalidate(): void {
    this.value = null
  }

  async get(): Promise<string> {
    if (this.value) return this.value
    const scraped = await this.scrape()
    if (scraped) {
      this.value = scraped
      return scraped
    }
    return CONFIG.soundcloudClientId
  }

  private async scrape(): Promise<string | null> {
    try {
      const html = await (await fetch('https://soundcloud.com/')).text()
      const scripts = [...html.matchAll(/<script[^>]+src="([^"]+)"/g)].map((m) => m[1])
      // SoundCloud's client_id lives in one of the later JS chunks.
      for (const src of scripts.reverse()) {
        const js = await (await fetch(src)).text()
        const id = extractClientId(js)
        if (id) return id
      }
    } catch {
      // network/parse failure -> fall back to config
    }
    return null
  }
}
```

- [ ] **Step 2: Add the config fallback field**

In `electron/config.ts`, add to `CONFIG`:
```ts
  // Fallback SoundCloud API client_id (may expire; the app re-extracts one at
  // runtime when this fails).
  soundcloudClientId: 'a3e059563d7fd3372b49b37f00a00bcf',
```
(That is a long-published public SoundCloud web client_id used as a last resort;
runtime extraction supersedes it.)

- [ ] **Step 3: Type-check**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 4: Checkpoint** — review. Do NOT commit.

---

## Task 5: `api` client (`me`, `likes`) + `session.ensureAuth`

**Files:**
- Create: `electron/sc/api.ts`
- Create: `electron/auth/session.ts`

**Interfaces:**
- Consumes: `TokenStore` (Task 2), `runLogin` (Task 3), `ClientId` (Task 4),
  `normalizeTrack`, `normalizeUser` (Task 1).
- Produces:
  ```ts
  // session.ts
  export class AuthSession {
    constructor(store: TokenStore, clientId: ClientId)
    token(): string | null
    async ensureAuth(): Promise<void>   // loads token, or runs login + persists token + captured client_id
    onUnauthorized(): void              // clears token so next ensureAuth re-logs in
  }
  // api.ts
  export class ScApi {
    constructor(session: AuthSession, clientId: ClientId)
    async me(): Promise<User | null>
    async likes(limit?: number): Promise<Track[]>
  }
  ```

- [ ] **Step 1: Implement `electron/auth/session.ts`**

```ts
import type { TokenStore } from './tokenStore'
import type { ClientId } from '../sc/clientId'
import { runLogin } from './loginWindow'

export class AuthSession {
  private tok: string | null = null

  constructor(private store: TokenStore, private clientId: ClientId) {}

  token(): string | null {
    return this.tok
  }

  async ensureAuth(): Promise<void> {
    if (this.tok) return
    const existing = this.store.load()
    if (existing) {
      this.tok = existing
      return
    }
    const captured = await runLogin()
    this.tok = captured.token
    this.store.save(captured.token)
    if (captured.clientId) this.clientId.set(captured.clientId)
  }

  onUnauthorized(): void {
    this.tok = null
    this.store.clear()
  }
}
```

- [ ] **Step 2: Implement `electron/sc/api.ts`**

```ts
import type { AuthSession } from '../auth/session'
import type { ClientId } from './clientId'
import type { Track, User } from './types'
import { normalizeTrack, normalizeUser } from './normalize'

const BASE = 'https://api-v2.soundcloud.com'

export class ScApi {
  constructor(private session: AuthSession, private clientId: ClientId) {}

  private async get(path: string, params: Record<string, string | number> = {}): Promise<unknown> {
    const cid = await this.clientId.get()
    const url = new URL(BASE + path)
    url.searchParams.set('client_id', cid)
    for (const [k, v] of Object.entries(params)) url.searchParams.set(k, String(v))
    const token = this.session.token()
    const res = await fetch(url.toString(), {
      headers: token ? { Authorization: `OAuth ${token}` } : {},
    })
    if (res.status === 401) {
      this.session.onUnauthorized()
      throw new Error('unauthorized')
    }
    if (res.status === 403) {
      this.clientId.invalidate()
      throw new Error('forbidden (client_id?)')
    }
    if (!res.ok) throw new Error(`api ${res.status}`)
    return res.json()
  }

  async me(): Promise<User | null> {
    return normalizeUser(await this.get('/me'))
  }

  async likes(limit = 50): Promise<Track[]> {
    const data = (await this.get('/me/track_likes', { limit })) as { collection?: unknown[] }
    const items = Array.isArray(data.collection) ? data.collection : []
    const out: Track[] = []
    for (const it of items) {
      const track = (it as Record<string, unknown>)?.track ?? it
      const t = normalizeTrack(track)
      if (t) out.push(t)
    }
    return out
  }
}
```

- [ ] **Step 3: Type-check**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 4: Checkpoint** — review. Do NOT commit.

---

## Task 6: dev harness + main wiring (end-to-end proof)

**Files:**
- Create: `electron/devHarness.ts`
- Modify: `electron/main.ts`

**Interfaces:**
- Consumes: everything above; `initDebug`/`dlog` from `electron/debug.ts`.
- Produces: on `SC_DEV_HARNESS=1`, the app logs in (if needed), fetches `me` +
  `likes`, and writes the count and first 10 titles to the debug log and console.

- [ ] **Step 1: Implement `electron/devHarness.ts`**

```ts
import path from 'node:path'
import { app } from 'electron'
import { TokenStore } from './auth/tokenStore'
import { AuthSession } from './auth/session'
import { ClientId } from './sc/clientId'
import { ScApi } from './sc/api'
import { dlog } from './debug'

export async function runDevHarness(): Promise<void> {
  const store = new TokenStore(path.join(app.getPath('userData'), 'auth.bin'))
  const clientId = new ClientId()
  const session = new AuthSession(store, clientId)
  const api = new ScApi(session, clientId)

  try {
    await session.ensureAuth()
    const me = await api.me()
    dlog('harness: logged in as', me ? me.username : '(unknown)')
    const likes = await api.likes(50)
    dlog('harness: likes count =', likes.length)
    likes.slice(0, 10).forEach((t, i) => dlog(`  ${i + 1}. ${t.title} — ${t.artist}`))
    console.log(`[SoundCloud] harness OK: ${me?.username}, ${likes.length} likes`)
  } catch (err) {
    dlog('harness ERROR:', err instanceof Error ? err.message : String(err))
    console.error('[SoundCloud] harness error:', err)
  }
}
```

- [ ] **Step 2: Wire it into `electron/main.ts`**

At the top of the `app.whenReady().then(...)` callback, before `createWindow()`,
add the harness branch. Replace:
```ts
app.whenReady().then(() => {
  createWindow()
  if (store.get().discordEnabled) discord.start()
})
```
with:
```ts
app.whenReady().then(async () => {
  if (process.env.SC_DEV_HARNESS === '1') {
    const { runDevHarness } = await import('./devHarness')
    await runDevHarness()
    return
  }
  createWindow()
  if (store.get().discordEnabled) discord.start()
})
```

- [ ] **Step 3: Type-check + unit suite**

Run: `npx tsc --noEmit && npm test`
Expected: tsc clean; all unit tests pass (normalize + tokenStore + existing).

- [ ] **Step 4: Run the harness end-to-end (manual)**

Run (PowerShell):
```
$env:SC_DEV_HARNESS='1'; Remove-Item Env:ELECTRON_RUN_AS_NODE -ErrorAction SilentlyContinue; npm run dev
```
Or (bash): `SC_DEV_HARNESS=1 env -u ELECTRON_RUN_AS_NODE npm run dev`

Expected:
1. A small "Log in to SoundCloud" window opens. Log in.
2. After login the window closes and the debug log
   (`%APPDATA%\soundcloud-desktop\soundtop-debug.log`) shows
   `harness: logged in as <you>` and `harness: likes count = N` with a list of
   the first 10 liked track titles.
3. Console prints `[SoundCloud] harness OK: ...`.

If the likes list is empty or titles are wrong, capture the raw response in the
next task and adjust `normalize`/`api` field names.

- [ ] **Step 5: Checkpoint** — review. Do NOT commit.

---

## Task 7: Capture a real fixture; verify normalize against live data

**Files:**
- Create: `test/fixtures/track_likes.sample.json` (trimmed real response)
- Modify (if needed): `electron/sc/normalize.ts`, `electron/sc/api.ts`

**Interfaces:** none new.

- [ ] **Step 1: Dump the raw likes response**

Temporarily add to `devHarness.ts` after `ensureAuth()`:
```ts
import fs from 'node:fs'
// TEMP: dump raw
const cid = await clientId.get()
const raw = await (await fetch(
  `https://api-v2.soundcloud.com/me/track_likes?limit=5&client_id=${cid}`,
  { headers: { Authorization: `OAuth ${session.token()}` } },
)).text()
fs.writeFileSync(path.join(app.getPath('userData'), 'likes-raw.json'), raw)
```
Run the harness once, then copy `%APPDATA%\soundcloud-desktop\likes-raw.json`
into `test/fixtures/track_likes.sample.json` (trim to 2 items). Remove the TEMP
block afterward.

- [ ] **Step 2: Add a fixture-backed test**

Append to `electron/sc/normalize.test.ts`:
```ts
import fixture from '../../test/fixtures/track_likes.sample.json'

describe('normalizeTrack against real fixture', () => {
  it('maps each collection item to a valid Track', () => {
    const items = (fixture as { collection: unknown[] }).collection
    for (const it of items) {
      const track = (it as Record<string, unknown>).track ?? it
      const t = normalizeTrack(track)
      expect(t).not.toBeNull()
      expect(t!.title.length).toBeGreaterThan(0)
      expect(typeof t!.durationMs).toBe('number')
    }
  })
})
```
Ensure `resolveJsonModule` is enabled in `tsconfig.json` (it is).

- [ ] **Step 3: Run and reconcile**

Run: `npx vitest run electron/sc/normalize.test.ts`
Expected: PASS. If it fails, the live field names differ from the assumed v2
shape — adjust `normalizeTrack`/`likes()` to match the real fixture, then re-run
until green. This is the whole point of the task: lock `normalize` to reality.

- [ ] **Step 4: Full verification**

Run: `npx tsc --noEmit && npm test`
Expected: tsc clean; all tests pass.

- [ ] **Step 5: Checkpoint** — review. Do NOT commit.

---

## Self-Review Notes

- **Spec coverage (Phase 1 = build-order item 1):** auth/login webview + token
  capture → Tasks 3, 5, 6; encrypted token store → Task 2; client_id cascade →
  Task 4; API client (me, likes) → Task 5; normalization → Tasks 1, 7; end-to-end
  "provably fetch likes" → Task 6. Later phases (playback, UI, RPC, rename+
  migration) are out of scope for this plan and get their own.
- **No git commits** — every task ends in a review checkpoint.
- **Type consistency:** `Track`/`User`/`Playlist`/`Transcoding` defined in Task 1
  and consumed unchanged by Tasks 5–7; `AuthSession`/`ScApi`/`ClientId`/
  `TokenStore` signatures match across Tasks 2–6.
- **Fragility isolation:** all SoundCloud-shape assumptions live in `normalize.ts`
  and `api.ts`; Task 7 locks them to a real captured response.
