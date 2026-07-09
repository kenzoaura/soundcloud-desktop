# SoundCloud Client — Phase 2: Playback Engine — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Actually play SoundCloud audio in the app: resolve a track's stream URL, play it (progressive MP3 or HLS), with a queue (play/pause/seek/next/previous), driven by a minimal functional player UI that lists the user's likes.

**Architecture:** Main resolves stream URLs from track transcodings (has the token + client_id from Phase 1) and serves data over IPC. The renderer holds one `<audio>` element (hls.js for HLS), a zustand player store with pure queue logic, and a minimal likes-list + player-bar UI. This whole slice is gated behind `SC_PLAYER=1`, leaving the existing embed app untouched; Phase 3 promotes it to the default UI.

**Tech Stack:** Electron 30 (main IPC, `ipcMain.handle`), Node `fetch`, React 18, zustand, hls.js, TypeScript, vitest.

**Spec:** `docs/superpowers/specs/2026-07-07-soundcloud-custom-client-design.md`. **Depends on Phase 1** (auth/session/api/clientId/normalize/types — already built and verified).

## Global Constraints

- **Windows-first.** No macOS/Linux-specific paths.
- **NO git commits or pushes.** Each task ends in a review checkpoint.
- **Electron main + preloads are CommonJS** (`type:commonjs`, `vite.config.mts`); named electron imports; Node builtins with `node:` prefix. The **renderer** (`src/**`) is normal ESM React (import from 'hls.js', 'zustand', 'react' normally).
- **Launch with** `env -u ELECTRON_RUN_AS_NODE npm run dev` (and `SC_PLAYER=1` for this phase's UI).
- **The OAuth token stays in main.** IPC returns data/URLs only; the renderer never sees the token.
- **Do NOT touch the embed path** (observer.ts, the WebContentsView in window.ts, discord/tray/mediaKeys wiring). Player mode is a separate `SC_PLAYER=1` branch. Default launch behavior is unchanged.
- **Reuse Phase 1** exact names: `AuthSession`, `ScApi` (`me()`, `likes(userId, limit)`), `ClientId`, `TokenStore`, `Track`, `Transcoding` (`{ url, protocol: 'progressive'|'hls', mimeType }`).

---

## File Structure (Phase 2)

- `electron/sc/stream.ts` — CREATE: `pickTranscoding` (pure) + `resolveStreamUrl` (main).
- `electron/sc/stream.test.ts` — CREATE (pickTranscoding).
- `electron/ipc.ts` — MODIFY: add `SC_ME`, `SC_LIKES`, `SC_STREAM_URL` channel names.
- `electron/scIpc.ts` — CREATE: registers the `ipcMain.handle` handlers using a persistent `ScApi`.
- `electron/preload.ts` — MODIFY: expose `window.sc` (me/likes/streamUrl) + type in `src/vite-env.d.ts`.
- `electron/main.ts` — MODIFY: `SC_PLAYER=1` branch — ensure auth, register sc IPC, open a plain React window (`?player=1`), no embed view.
- `src/player/queue.ts` — CREATE: pure queue logic (next/prev/shuffle/repeat). **Unit-tested.**
- `src/player/queue.test.ts` — CREATE.
- `src/player/store.ts` — CREATE: zustand store wrapping queue + playback state.
- `src/player/audioEngine.ts` — CREATE: `<audio>` + hls.js controller.
- `src/ui/PlayerApp.tsx` — CREATE: minimal likes list + player bar (temporary; Phase 3 restyles).
- `src/ui/LikesList.tsx`, `src/ui/PlayerBar.tsx` — CREATE.
- `src/App.tsx` — MODIFY: render `PlayerApp` when `?player=1`, else the existing `TitleBar`.
- `package.json` — MODIFY: add `hls.js`, `zustand`.

---

## Task 1: Dependencies

**Files:** Modify `package.json`.

- [ ] **Step 1: Install**

Run:
```bash
npm install hls.js zustand
```
Expected: `hls.js` and `zustand` added to `dependencies`.

- [ ] **Step 2: Verify install + existing suite**

Run: `npm test`
Expected: existing 21 tests still pass.

- [ ] **Step 3: Checkpoint** — review. Do NOT commit.

---

## Task 2: Stream resolution (`sc/stream.ts`) — TDD for the pure part

**Files:**
- Create: `electron/sc/stream.ts`
- Test: `electron/sc/stream.test.ts`

**Interfaces produced:**
```ts
import type { Track, Transcoding } from './types'
// Pure: choose the transcoding to play. Prefer progressive MP3, else first HLS.
export function pickTranscoding(track: Track): Transcoding | null
// Main: resolve the transcoding to a playable URL. GET transcoding.url with
// client_id (+ OAuth) → SoundCloud returns { url: "<stream>" }.
export interface ResolvedStream { url: string; protocol: 'progressive' | 'hls' }
export async function resolveStreamUrl(
  track: Track,
  clientId: string,
  token: string | null,
): Promise<ResolvedStream | null>
```

- [ ] **Step 1: Write the failing test — `electron/sc/stream.test.ts`**

```ts
import { describe, it, expect } from 'vitest'
import { pickTranscoding } from './stream'
import type { Track } from './types'

function track(transcodings: Track['transcodings']): Track {
  return {
    id: 1, title: 't', durationMs: 1000, permalink: '', artist: 'a', artistId: 2, transcodings,
  }
}

describe('pickTranscoding', () => {
  it('prefers progressive over hls', () => {
    const t = track([
      { url: 'h', protocol: 'hls', mimeType: 'audio/mpeg' },
      { url: 'p', protocol: 'progressive', mimeType: 'audio/mpeg' },
    ])
    expect(pickTranscoding(t)?.url).toBe('p')
  })
  it('falls back to hls when no progressive', () => {
    const t = track([{ url: 'h', protocol: 'hls', mimeType: 'audio/mpeg' }])
    expect(pickTranscoding(t)?.protocol).toBe('hls')
  })
  it('returns null when no transcodings', () => {
    expect(pickTranscoding(track([]))).toBeNull()
  })
})
```

- [ ] **Step 2: Run, confirm FAIL**

Run: `npx vitest run electron/sc/stream.test.ts`
Expected: FAIL (cannot import).

- [ ] **Step 3: Implement `electron/sc/stream.ts`**

```ts
import type { Track, Transcoding } from './types'

export function pickTranscoding(track: Track): Transcoding | null {
  const progressive = track.transcodings.find((t) => t.protocol === 'progressive')
  if (progressive) return progressive
  const hls = track.transcodings.find((t) => t.protocol === 'hls')
  return hls ?? null
}

export interface ResolvedStream {
  url: string
  protocol: 'progressive' | 'hls'
}

export async function resolveStreamUrl(
  track: Track,
  clientId: string,
  token: string | null,
): Promise<ResolvedStream | null> {
  const tc = pickTranscoding(track)
  if (!tc) return null
  const u = new URL(tc.url)
  u.searchParams.set('client_id', clientId)
  try {
    const res = await fetch(u.toString(), {
      headers: token ? { Authorization: `OAuth ${token}` } : {},
    })
    if (!res.ok) return null
    const data = (await res.json()) as { url?: string }
    if (!data.url) return null
    return { url: data.url, protocol: tc.protocol }
  } catch {
    return null
  }
}
```

- [ ] **Step 4: Run, confirm PASS**

Run: `npx vitest run electron/sc/stream.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 5: Checkpoint** — review. Do NOT commit.

---

## Task 3: IPC layer + persistent main wiring (player mode)

**Files:**
- Modify: `electron/ipc.ts`
- Create: `electron/scIpc.ts`
- Modify: `electron/preload.ts`
- Modify: `src/vite-env.d.ts`
- Modify: `electron/main.ts`

**Interfaces produced:**
```ts
// ipc.ts additions to IPC:
//   SC_ME: 'sc:me', SC_LIKES: 'sc:likes', SC_STREAM_URL: 'sc:streamUrl'
// window.sc (renderer), typed in vite-env.d.ts:
interface ScBridge {
  me(): Promise<User | null>
  likes(limit?: number): Promise<Track[]>
  streamUrl(track: Track): Promise<{ url: string; protocol: 'progressive' | 'hls' } | null>
}
```
`registerScIpc(api, clientId, session)` wires `ipcMain.handle` for the three
channels. `likes()` first calls `me()` to get the user id (Phase 1's
`likes(userId, limit)` needs it), caching the id.

- [ ] **Step 1: Add channels to `electron/ipc.ts`**

Add to the `IPC` object:
```ts
  SC_ME: 'sc:me',
  SC_LIKES: 'sc:likes',
  SC_STREAM_URL: 'sc:streamUrl',
```

- [ ] **Step 2: Create `electron/scIpc.ts`**

```ts
import { ipcMain } from 'electron'
import { IPC } from './ipc'
import type { ScApi } from './sc/api'
import type { ClientId } from './sc/clientId'
import type { AuthSession } from './auth/session'
import type { Track } from './sc/types'
import { resolveStreamUrl } from './sc/stream'

export function registerScIpc(api: ScApi, clientId: ClientId, session: AuthSession): void {
  let userId: number | null = null

  ipcMain.handle(IPC.SC_ME, async () => {
    const me = await api.me()
    if (me) userId = me.id
    return me
  })

  ipcMain.handle(IPC.SC_LIKES, async (_e, limit?: number) => {
    if (userId === null) {
      const me = await api.me()
      userId = me ? me.id : null
    }
    if (userId === null) return []
    return api.likes(userId, limit ?? 50)
  })

  ipcMain.handle(IPC.SC_STREAM_URL, async (_e, track: Track) => {
    const cid = await clientId.get()
    return resolveStreamUrl(track, cid, session.token())
  })
}
```

- [ ] **Step 3: Expose `window.sc` in `electron/preload.ts`**

Add (keep the existing `windowControls` block):
```ts
import type { Track } from './sc/types'
// ... after the existing contextBridge.exposeInMainWorld('windowControls', {...})
contextBridge.exposeInMainWorld('sc', {
  me: () => ipcRenderer.invoke(IPC.SC_ME),
  likes: (limit?: number) => ipcRenderer.invoke(IPC.SC_LIKES, limit),
  streamUrl: (track: Track) => ipcRenderer.invoke(IPC.SC_STREAM_URL, track),
})
```

- [ ] **Step 4: Type `window.sc` in `src/vite-env.d.ts`**

Append:
```ts
import type { Track, User } from '../electron/sc/types'

interface ScBridge {
  me(): Promise<User | null>
  likes(limit?: number): Promise<Track[]>
  streamUrl(track: Track): Promise<{ url: string; protocol: 'progressive' | 'hls' } | null>
}
interface Window {
  sc: ScBridge
}
```

- [ ] **Step 5: Wire the `SC_PLAYER=1` branch in `electron/main.ts`**

Add imports near the top (with the other imports):
```ts
import { TokenStore } from './auth/tokenStore'
import { AuthSession } from './auth/session'
import { ClientId } from './sc/clientId'
import { ScApi } from './sc/api'
import { registerScIpc } from './scIpc'
```
Then, inside the `app.whenReady().then(async () => { ... })` callback, add a
branch BEFORE the existing `createWindow()` (and after the `SC_DEV_HARNESS`
branch):
```ts
  if (process.env.SC_PLAYER === '1') {
    const tokenStore = new TokenStore(path.join(app.getPath('userData'), 'auth.bin'))
    const clientId = new ClientId()
    const authSession = new AuthSession(tokenStore, clientId)
    await authSession.ensureAuth()
    const scApi = new ScApi(authSession, clientId)
    registerScIpc(scApi, clientId, authSession)

    const win = new BrowserWindow({
      width: 1100,
      height: 780,
      backgroundColor: '#121212',
      webPreferences: { preload: path.join(__dirname, 'preload.js') },
    })
    const base = VITE_DEV_SERVER_URL ?? `file://${path.join(RENDERER_DIST, 'index.html')}`
    win.loadURL(`${base}${base.includes('?') ? '&' : '?'}player=1`)
    return
  }
```

- [ ] **Step 6: Type-check**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 7: Checkpoint** — review. Do NOT commit.

---

## Task 4: Player queue logic (`src/player/queue.ts`) — TDD

**Files:**
- Create: `src/player/queue.ts`
- Test: `src/player/queue.test.ts`

**Interfaces produced:**
```ts
import type { Track } from '../../electron/sc/types'
export type Repeat = 'off' | 'all' | 'one'
export interface QueueState { tracks: Track[]; index: number }
export function currentTrack(q: QueueState): Track | null
export function nextIndex(q: QueueState, repeat: Repeat): number | null   // null = stop
export function prevIndex(q: QueueState): number
export function shuffled(tracks: Track[], keepIndex: number): QueueState   // keeps current first
```

- [ ] **Step 1: Failing test — `src/player/queue.test.ts`**

```ts
import { describe, it, expect } from 'vitest'
import { currentTrack, nextIndex, prevIndex } from './queue'
import type { Track } from '../../electron/sc/types'

const mk = (id: number): Track => ({
  id, title: `t${id}`, durationMs: 1000, permalink: '', artist: 'a', artistId: 0, transcodings: [],
})
const q = (index: number) => ({ tracks: [mk(1), mk(2), mk(3)], index })

describe('currentTrack', () => {
  it('returns the track at index or null', () => {
    expect(currentTrack(q(1))?.id).toBe(2)
    expect(currentTrack({ tracks: [], index: 0 })).toBeNull()
  })
})

describe('nextIndex', () => {
  it('advances', () => {
    expect(nextIndex(q(0), 'off')).toBe(1)
  })
  it('stops at end when repeat off', () => {
    expect(nextIndex(q(2), 'off')).toBeNull()
  })
  it('wraps when repeat all', () => {
    expect(nextIndex(q(2), 'all')).toBe(0)
  })
  it('stays when repeat one', () => {
    expect(nextIndex(q(1), 'one')).toBe(1)
  })
})

describe('prevIndex', () => {
  it('goes back, clamped at 0', () => {
    expect(prevIndex(q(2))).toBe(1)
    expect(prevIndex(q(0))).toBe(0)
  })
})
```

- [ ] **Step 2: Run, confirm FAIL**

Run: `npx vitest run src/player/queue.test.ts`
Expected: FAIL.

- [ ] **Step 3: Implement `src/player/queue.ts`**

```ts
import type { Track } from '../../electron/sc/types'

export type Repeat = 'off' | 'all' | 'one'
export interface QueueState {
  tracks: Track[]
  index: number
}

export function currentTrack(q: QueueState): Track | null {
  return q.tracks[q.index] ?? null
}

export function nextIndex(q: QueueState, repeat: Repeat): number | null {
  if (q.tracks.length === 0) return null
  if (repeat === 'one') return q.index
  if (q.index < q.tracks.length - 1) return q.index + 1
  return repeat === 'all' ? 0 : null
}

export function prevIndex(q: QueueState): number {
  return q.index > 0 ? q.index - 1 : 0
}

export function shuffled(tracks: Track[], keepIndex: number): QueueState {
  const current = tracks[keepIndex]
  const rest = tracks.filter((_, i) => i !== keepIndex)
  for (let i = rest.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[rest[i], rest[j]] = [rest[j], rest[i]]
  }
  return { tracks: current ? [current, ...rest] : rest, index: 0 }
}
```

- [ ] **Step 4: Run, confirm PASS**

Run: `npx vitest run src/player/queue.test.ts`
Expected: PASS.

- [ ] **Step 5: Checkpoint** — review. Do NOT commit.

---

## Task 5: Audio engine (`src/player/audioEngine.ts`)

**Files:**
- Create: `src/player/audioEngine.ts`

**Interfaces produced:**
```ts
export interface AudioCallbacks {
  onTime: (positionSec: number, durationSec: number) => void
  onEnded: () => void
}
export class AudioEngine {
  constructor(cb: AudioCallbacks)
  loadProgressive(url: string): void
  loadHls(url: string): void
  play(): Promise<void>
  pause(): void
  seek(sec: number): void
  setVolume(v: number): void   // 0..1
  destroy(): void
}
```

- [ ] **Step 1: Implement `src/player/audioEngine.ts`**

```ts
import Hls from 'hls.js'

export interface AudioCallbacks {
  onTime: (positionSec: number, durationSec: number) => void
  onEnded: () => void
}

export class AudioEngine {
  private audio = new Audio()
  private hls: Hls | null = null

  constructor(cb: AudioCallbacks) {
    this.audio.addEventListener('timeupdate', () => {
      cb.onTime(this.audio.currentTime, this.audio.duration || 0)
    })
    this.audio.addEventListener('ended', () => cb.onEnded())
  }

  private clearHls(): void {
    if (this.hls) {
      this.hls.destroy()
      this.hls = null
    }
  }

  loadProgressive(url: string): void {
    this.clearHls()
    this.audio.src = url
  }

  loadHls(url: string): void {
    this.clearHls()
    if (Hls.isSupported()) {
      this.hls = new Hls()
      this.hls.loadSource(url)
      this.hls.attachMedia(this.audio)
    } else {
      // Safari-style native HLS fallback (unlikely in Electron/Chromium).
      this.audio.src = url
    }
  }

  play(): Promise<void> {
    return this.audio.play()
  }
  pause(): void {
    this.audio.pause()
  }
  seek(sec: number): void {
    this.audio.currentTime = sec
  }
  setVolume(v: number): void {
    this.audio.volume = Math.min(1, Math.max(0, v))
  }
  destroy(): void {
    this.clearHls()
    this.audio.pause()
    this.audio.src = ''
  }
}
```

- [ ] **Step 2: Type-check**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 3: Checkpoint** — review. Do NOT commit.

---

## Task 6: Player store + minimal UI

**Files:**
- Create: `src/player/store.ts`
- Create: `src/ui/PlayerApp.tsx`
- Create: `src/ui/LikesList.tsx`
- Create: `src/ui/PlayerBar.tsx`
- Modify: `src/App.tsx`

**Interfaces:**
- Consumes: `queue.ts`, `AudioEngine`, `window.sc`.
- Produces: a working player: load likes, click a track to play the list from
  there, play/pause/seek/next/previous.

- [ ] **Step 1: Create the zustand store `src/player/store.ts`**

```ts
import { create } from 'zustand'
import type { Track } from '../../electron/sc/types'
import { AudioEngine } from './audioEngine'
import { currentTrack, nextIndex, prevIndex, type Repeat, type QueueState } from './queue'

interface PlayerState {
  queue: QueueState
  current: Track | null
  isPlaying: boolean
  position: number
  duration: number
  repeat: Repeat
  playQueue: (tracks: Track[], startIndex: number) => Promise<void>
  toggle: () => void
  next: () => Promise<void>
  previous: () => Promise<void>
  seek: (sec: number) => void
}

let engine: AudioEngine | null = null

export const usePlayer = create<PlayerState>((set, get) => {
  const ensureEngine = () => {
    if (!engine) {
      engine = new AudioEngine({
        onTime: (p, d) => set({ position: p, duration: d }),
        onEnded: () => void get().next(),
      })
    }
    return engine
  }

  const loadAndPlay = async (track: Track) => {
    const eng = ensureEngine()
    const resolved = await window.sc.streamUrl(track)
    if (!resolved) {
      set({ isPlaying: false })
      return
    }
    if (resolved.protocol === 'hls') eng.loadHls(resolved.url)
    else eng.loadProgressive(resolved.url)
    await eng.play()
    set({ current: track, isPlaying: true, position: 0 })
  }

  return {
    queue: { tracks: [], index: 0 },
    current: null,
    isPlaying: false,
    position: 0,
    duration: 0,
    repeat: 'off',

    playQueue: async (tracks, startIndex) => {
      set({ queue: { tracks, index: startIndex } })
      const t = currentTrack({ tracks, index: startIndex })
      if (t) await loadAndPlay(t)
    },
    toggle: () => {
      const eng = ensureEngine()
      if (get().isPlaying) {
        eng.pause()
        set({ isPlaying: false })
      } else {
        void eng.play()
        set({ isPlaying: true })
      }
    },
    next: async () => {
      const { queue, repeat } = get()
      const ni = nextIndex(queue, repeat)
      if (ni === null) {
        set({ isPlaying: false })
        return
      }
      const nq = { ...queue, index: ni }
      set({ queue: nq })
      const t = currentTrack(nq)
      if (t) await loadAndPlay(t)
    },
    previous: async () => {
      const { queue } = get()
      const nq = { ...queue, index: prevIndex(queue) }
      set({ queue: nq })
      const t = currentTrack(nq)
      if (t) await loadAndPlay(t)
    },
    seek: (sec) => {
      ensureEngine().seek(sec)
      set({ position: sec })
    },
  }
})
```

- [ ] **Step 2: Create `src/ui/LikesList.tsx`**

```tsx
import type { Track } from '../../electron/sc/types'

export default function LikesList({ tracks }: { tracks: Track[] }) {
  const play = (i: number) => void usePlay(tracks, i)
  return (
    <ul className="flex-1 overflow-y-auto">
      {tracks.map((t, i) => (
        <li
          key={t.id}
          onClick={() => play(i)}
          className="flex items-center gap-3 px-4 py-2 hover:bg-white/10 cursor-pointer"
        >
          <img src={t.artworkUrl} className="w-10 h-10 rounded" />
          <div className="min-w-0">
            <div className="text-sm text-white truncate">{t.title}</div>
            <div className="text-xs text-gray-400 truncate">{t.artist}</div>
          </div>
        </li>
      ))}
    </ul>
  )
}

import { usePlayer } from '../player/store'
function usePlay(tracks: Track[], i: number) {
  return usePlayer.getState().playQueue(tracks, i)
}
```

- [ ] **Step 3: Create `src/ui/PlayerBar.tsx`**

```tsx
import { usePlayer } from '../player/store'

function fmt(sec: number): string {
  if (!Number.isFinite(sec)) return '0:00'
  const m = Math.floor(sec / 60)
  const s = Math.floor(sec % 60)
  return `${m}:${String(s).padStart(2, '0')}`
}

export default function PlayerBar() {
  const { current, isPlaying, position, duration, toggle, next, previous, seek } = usePlayer()
  if (!current) return null
  return (
    <footer className="h-20 shrink-0 bg-[#181818] border-t border-white/10 flex items-center gap-4 px-4">
      <img src={current.artworkUrl} className="w-12 h-12 rounded" />
      <div className="min-w-0 w-48">
        <div className="text-sm text-white truncate">{current.title}</div>
        <div className="text-xs text-gray-400 truncate">{current.artist}</div>
      </div>
      <div className="flex items-center gap-3">
        <button onClick={() => void previous()} className="text-gray-300">⏮</button>
        <button onClick={toggle} className="text-white text-xl">{isPlaying ? '⏸' : '▶'}</button>
        <button onClick={() => void next()} className="text-gray-300">⏭</button>
      </div>
      <div className="flex-1 flex items-center gap-2">
        <span className="text-xs text-gray-400 w-10 text-right">{fmt(position)}</span>
        <input
          type="range"
          min={0}
          max={duration || 0}
          value={position}
          onChange={(e) => seek(Number(e.target.value))}
          className="flex-1 accent-[#FF5500]"
        />
        <span className="text-xs text-gray-400 w-10">{fmt(duration)}</span>
      </div>
    </footer>
  )
}
```

- [ ] **Step 4: Create `src/ui/PlayerApp.tsx`**

```tsx
import { useEffect, useState } from 'react'
import type { Track } from '../../electron/sc/types'
import LikesList from './LikesList'
import PlayerBar from './PlayerBar'

export default function PlayerApp() {
  const [tracks, setTracks] = useState<Track[]>([])
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    window.sc
      .likes(50)
      .then(setTracks)
      .catch((e) => setError(String(e)))
  }, [])

  return (
    <div className="h-screen flex flex-col bg-[#121212] text-white">
      <header className="px-4 py-3 text-lg font-bold">Curtidas</header>
      {error && <div className="px-4 text-red-400 text-sm">{error}</div>}
      <LikesList tracks={tracks} />
      <PlayerBar />
    </div>
  )
}
```

- [ ] **Step 5: Branch `src/App.tsx` on `?player=1`**

```tsx
import TitleBar from './components/TitleBar'
import PlayerApp from './ui/PlayerApp'

function App() {
  if (new URLSearchParams(window.location.search).get('player') === '1') {
    return <PlayerApp />
  }
  return <TitleBar />
}

export default App
```

- [ ] **Step 6: Type-check + unit suite**

Run: `npx tsc --noEmit && npm test`
Expected: tsc clean; all unit tests pass (Phase 1 + stream + queue).

- [ ] **Step 7: Checkpoint** — review. Do NOT commit.

---

## Task 7: End-to-end verification (manual)

**Files:** none (may add a probe if stream resolution fails).

- [ ] **Step 1: Run the player**

Run (bash): `SC_PLAYER=1 env -u ELECTRON_RUN_AS_NODE npm run dev`
(Token is already stored from Phase 1, so no login prompt; if it does prompt, log in.)

Expected:
1. A window opens listing your liked tracks (artwork + title + artist).
2. Click a track → audio plays within ~1–2s.
3. Play/pause toggles; the seek bar advances; dragging it seeks; ⏭/⏮ change tracks; a track ending auto-advances.

- [ ] **Step 2: If a track does not play**

Add a temporary log in `resolveStreamUrl` (before `return`) dumping the resolved
`data` and the transcoding used, run once, inspect
`%APPDATA%\soundcloud-desktop\` output / devtools console (open with
`win.webContents.openDevTools()` temporarily in the `SC_PLAYER` branch). Common
causes: the chosen transcoding needs the `Authorization` header (already sent);
progressive URL is a redirect (fetch follows by default); HLS needs hls.js (it
does). Adjust `pickTranscoding`/`resolveStreamUrl` to match reality, then re-run.
Remove temporary logging/devtools afterward.

- [ ] **Step 3: Full verification**

Run: `npx tsc --noEmit && npm test`
Expected: tsc clean; all tests pass.

- [ ] **Step 4: Checkpoint** — review. Do NOT commit.

---

## Self-Review Notes

- **Spec coverage (Phase 2 = build-order item 2):** stream resolution → Task 2;
  `<audio>` + HLS engine → Task 5; queue/next/prev/repeat/shuffle store → Tasks 4, 6;
  play/seek → Task 6; IPC data layer → Task 3; minimal UI to exercise it → Task 6;
  end-to-end proof → Task 7. Full Spotify UI, media-key/tray/RPC rewiring, and
  embed removal are later phases.
- **Isolation:** everything is gated behind `SC_PLAYER=1`; the embed path
  (observer/WebContentsView/discord/tray/mediaKeys) is untouched.
- **Type consistency:** `Track`/`Transcoding` reused from Phase 1;
  `pickTranscoding`/`resolveStreamUrl`/`ResolvedStream` (Task 2) consumed by
  `scIpc` (Task 3) and the store (Task 6); `QueueState`/`Repeat`/`nextIndex`/
  `prevIndex`/`currentTrack` (Task 4) consumed by the store (Task 6).
- **No git commits** — review checkpoints only.
- **Fragility:** stream resolution (Task 2) is the fragile SoundCloud-shape part;
  Task 7 locks it to live behavior.
