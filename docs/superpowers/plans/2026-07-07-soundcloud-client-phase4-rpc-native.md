# SoundCloud Client — Phase 4: Discord "Listening" RPC + Native Controls — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Show a Spotify-style "Listening to SoundCloud" Discord Rich Presence with cover art and a live progress bar driven by the app's own player, and rewire the system tray + global media keys to control that player.

**Architecture:** The renderer player store reports its state (current track, position, duration, isPlaying) to main over IPC. Main feeds that to a Discord presence (`@xhayper/discord-rpc`, ActivityType.Listening + start/end timestamps for the live bar) and to a tray (tooltip + menu). Global media keys and tray menu items send commands back to the renderer player over IPC. The frameless window hides to tray on close.

**Tech Stack:** Electron 30 (globalShortcut, Tray, ipcMain/webContents), `@xhayper/discord-rpc`, React/zustand (Phase 2 store), TypeScript, vitest.

**Spec:** `docs/superpowers/specs/2026-07-07-soundcloud-custom-client-design.md` (build order item 4). **Depends on Phases 1–3.**

## Global Constraints

- **Windows-first.** No macOS/Linux-specific paths.
- **NO git commits or pushes.** Each task ends in a review checkpoint.
- **Electron main is CommonJS** (named electron imports, `node:` builtins); renderer is ESM React.
- **Launch with** `env -u ELECTRON_RUN_AS_NODE npm run dev`. Kill a running packaged `SoundTOP.exe` first (single-instance lock).
- **Graceful degradation:** Discord not running → RPC no-ops + retries, never crashes. Media keys/tray absent-hardware safe.
- **Reuse** the Phase 2/3 store `usePlayer` (`current`, `isPlaying`, `position`, `duration`, `toggle`, `next`, `previous`) and `Track` type; the Phase 3 `mainWindow` in main.ts.
- **Discord copy:** presence must read **"Listening to SoundCloud"** (ActivityType.Listening), `details` = track title, `state` = artist, large image = the track `artworkUrl`, `largeImageText` = `"SoundTOP"` (renamed in Phase 5).
- **Bundle `@xhayper/discord-rpc`** into main (not external) so the packaged app has no runtime node_modules dependency — mirror the ws/native handling: keep only `bufferutil`/`utf-8-validate` external in the main build.

---

## File Structure (Phase 4)

- `electron/discord.ts` — REWRITE: `@xhayper/discord-rpc`, ActivityType.Listening + timestamps.
- `electron/rpcActivity.ts` — CREATE: pure builder mapping player state → activity payload. **Unit-tested.**
- `electron/rpcActivity.test.ts` — CREATE.
- `electron/tray.ts` — REWRITE (or new `electron/trayPlayer.ts`): tray from player state + command callbacks.
- `electron/mediaKeys.ts` — REWRITE: globalShortcut → IPC player command (no BrowserView).
- `electron/ipc.ts` — MODIFY: add `PLAYER_PROGRESS`, `PLAYER_COMMAND`.
- `electron/preload.ts` — MODIFY: expose `window.player` (reportProgress, onCommand).
- `src/vite-env.d.ts` — MODIFY: type `window.player`.
- `src/player/store.ts` — MODIFY: emit progress to main (throttled) + subscribe to commands.
- `src/player/bridge.ts` — CREATE: wires store↔main (progress out, commands in). Imported once at app start.
- `src/main.tsx` — MODIFY: import the bridge.
- `electron/main.ts` — MODIFY: construct DiscordPresence + tray + media keys; route progress → discord+tray; close-to-tray.
- `electron/config.ts` — reuse `discordClientId` (already present).
- `vite.config.mts` — MODIFY: main-build `external` stays `['bufferutil','utf-8-validate']` (already), ensure `@xhayper/discord-rpc` bundles.
- `package.json` — MODIFY: add `@xhayper/discord-rpc` (may remove old `discord-rpc`).

---

## Task 1: Dependencies

**Files:** Modify `package.json`.

- [ ] **Step 1: Install**

Run: `npm install @xhayper/discord-rpc`
Expected: added to dependencies. (Leave `discord-rpc` installed but unused; removal is Phase 5.)

- [ ] **Step 2: Verify existing suite**

Run: `npm test` (30 pass) and `npx tsc --noEmit` (clean).

- [ ] **Step 3: Checkpoint** — review. Do NOT commit.

---

## Task 2: `rpcActivity` builder (pure, TDD)

**Files:**
- Create: `electron/rpcActivity.ts`
- Test: `electron/rpcActivity.test.ts`

**Interfaces produced:**
```ts
export interface PlayerSnapshot {
  title: string
  artist: string
  artworkUrl?: string
  durationSec: number
  positionSec: number
  isPlaying: boolean
}
export interface RpcActivity {
  type: number               // 2 = Listening
  details: string
  state: string
  largeImageKey?: string
  largeImageText: string
  startTimestamp?: number    // ms epoch
  endTimestamp?: number      // ms epoch
}
// Build the activity for the given snapshot at wall-clock time `nowMs`.
// Playing → include start/end timestamps (Discord draws the live bar).
// Paused → omit timestamps (bar frozen/hidden).
export function buildActivity(s: PlayerSnapshot, nowMs: number): RpcActivity
```

- [ ] **Step 1: Failing test — `electron/rpcActivity.test.ts`**

```ts
import { describe, it, expect } from 'vitest'
import { buildActivity } from './rpcActivity'

const base = { title: 'Song', artist: 'Artist', artworkUrl: 'https://a/i.jpg', durationSec: 200, positionSec: 30 }

describe('buildActivity', () => {
  it('maps title/artist/art and Listening type', () => {
    const a = buildActivity({ ...base, isPlaying: true }, 1_000_000)
    expect(a.type).toBe(2)
    expect(a.details).toBe('Song')
    expect(a.state).toBe('Artist')
    expect(a.largeImageKey).toBe('https://a/i.jpg')
    expect(a.largeImageText).toBe('SoundTOP')
  })
  it('sets start/end timestamps when playing (live bar)', () => {
    const now = 1_000_000
    const a = buildActivity({ ...base, isPlaying: true }, now)
    expect(a.startTimestamp).toBe(now - 30 * 1000)
    expect(a.endTimestamp).toBe(now - 30 * 1000 + 200 * 1000)
  })
  it('omits timestamps when paused', () => {
    const a = buildActivity({ ...base, isPlaying: false }, 1_000_000)
    expect(a.startTimestamp).toBeUndefined()
    expect(a.endTimestamp).toBeUndefined()
  })
  it('falls back to a non-empty state', () => {
    const a = buildActivity({ ...base, artist: '', isPlaying: true }, 1_000_000)
    expect(a.state.length).toBeGreaterThan(0)
  })
})
```

- [ ] **Step 2: Run, confirm FAIL** — `npx vitest run electron/rpcActivity.test.ts`.

- [ ] **Step 3: Implement `electron/rpcActivity.ts`**

```ts
export interface PlayerSnapshot {
  title: string
  artist: string
  artworkUrl?: string
  durationSec: number
  positionSec: number
  isPlaying: boolean
}

export interface RpcActivity {
  type: number
  details: string
  state: string
  largeImageKey?: string
  largeImageText: string
  startTimestamp?: number
  endTimestamp?: number
}

export function buildActivity(s: PlayerSnapshot, nowMs: number): RpcActivity {
  const activity: RpcActivity = {
    type: 2, // Listening
    details: s.title.slice(0, 128) || 'Unknown',
    state: (s.artist || 'SoundCloud').slice(0, 128),
    largeImageKey: s.artworkUrl,
    largeImageText: 'SoundTOP',
  }
  if (s.isPlaying && s.durationSec > 0) {
    const start = nowMs - Math.floor(s.positionSec * 1000)
    activity.startTimestamp = start
    activity.endTimestamp = start + Math.floor(s.durationSec * 1000)
  }
  return activity
}
```

- [ ] **Step 4: Run, confirm PASS** — `npx vitest run electron/rpcActivity.test.ts`.

- [ ] **Step 5: Checkpoint** — review. Do NOT commit.

---

## Task 3: Discord presence (`discord.ts` rewrite)

**Files:** Rewrite `electron/discord.ts`.

**Interfaces produced:**
```ts
export class DiscordPresence {
  constructor(clientId: string)
  start(): void                          // connect + retry, never throws
  update(snapshot: PlayerSnapshot | null): void  // null → clear
  stop(): void
}
```

- [ ] **Step 1: Rewrite `electron/discord.ts`**

```ts
import { Client } from '@xhayper/discord-rpc'
import { buildActivity, type PlayerSnapshot } from './rpcActivity'

export class DiscordPresence {
  private client: Client | null = null
  private ready = false
  private pending: PlayerSnapshot | null = null
  private retry: NodeJS.Timeout | null = null

  constructor(private clientId: string) {}

  start(): void {
    if (this.client) return
    const client = new Client({ clientId: this.clientId })
    this.client = client
    client.on('ready', () => {
      this.ready = true
      this.push(this.pending)
    })
    client.login().catch(() => {
      this.ready = false
      this.client = null
      this.scheduleRetry()
    })
  }

  private scheduleRetry(): void {
    if (this.retry) return
    this.retry = setTimeout(() => {
      this.retry = null
      this.start()
    }, 15000)
  }

  update(snapshot: PlayerSnapshot | null): void {
    this.pending = snapshot
    if (this.ready) this.push(snapshot)
  }

  private push(snapshot: PlayerSnapshot | null): void {
    if (!this.client || !this.ready || !this.client.user) return
    if (!snapshot) {
      this.client.user.clearActivity().catch(() => {})
      return
    }
    const a = buildActivity(snapshot, Date.now())
    this.client.user
      .setActivity({
        type: a.type,
        details: a.details,
        state: a.state,
        largeImageKey: a.largeImageKey,
        largeImageText: a.largeImageText,
        startTimestamp: a.startTimestamp,
        endTimestamp: a.endTimestamp,
        instance: false,
      })
      .catch(() => {})
  }

  stop(): void {
    if (this.retry) clearTimeout(this.retry)
    this.retry = null
    this.ready = false
    this.client?.destroy().catch(() => {})
    this.client = null
  }
}
```
Note: if `@xhayper/discord-rpc`'s `setActivity` rejects on the `type` field or an
external `largeImageKey` URL, adjust in Task 8 against live behavior (the fragile
part). The `.catch(() => {})` guarantees no crash meanwhile.

- [ ] **Step 2: Ensure the bundler keeps it in-bundle**

In `vite.config.mts`, confirm the main entry `external` is only
`['bufferutil', 'utf-8-validate']` (already the case) so `@xhayper/discord-rpc`
bundles into `main.js`.

- [ ] **Step 3: Type-check** — `npx tsc --noEmit`.

- [ ] **Step 4: Checkpoint** — review. Do NOT commit.

---

## Task 4: IPC + preload for player↔main

**Files:**
- Modify: `electron/ipc.ts`, `electron/preload.ts`, `src/vite-env.d.ts`

**Interfaces produced:**
```ts
// ipc.ts: PLAYER_PROGRESS: 'player:progress' (renderer→main, send)
//         PLAYER_COMMAND:  'player:command'  (main→renderer, send)
// window.player (renderer):
interface PlayerBridge {
  reportProgress(s: {
    title: string; artist: string; artworkUrl?: string
    durationSec: number; positionSec: number; isPlaying: boolean
  } | null): void
  onCommand(cb: (cmd: 'toggle' | 'next' | 'previous') => void): void
}
```

- [ ] **Step 1: `electron/ipc.ts`** — add:
```ts
  PLAYER_PROGRESS: 'player:progress',
  PLAYER_COMMAND: 'player:command',
```
and `export type PlayerCommand = 'toggle' | 'next' | 'previous'`.

- [ ] **Step 2: `electron/preload.ts`** — add a `window.player` bridge:
```ts
import { IPC, type PlayerCommand } from './ipc'
// ...
contextBridge.exposeInMainWorld('player', {
  reportProgress: (s: unknown) => ipcRenderer.send(IPC.PLAYER_PROGRESS, s),
  onCommand: (cb: (cmd: PlayerCommand) => void) =>
    ipcRenderer.on(IPC.PLAYER_COMMAND, (_e, cmd: PlayerCommand) => cb(cmd)),
})
```

- [ ] **Step 3: `src/vite-env.d.ts`** — add:
```ts
interface PlayerBridge {
  reportProgress(s: {
    title: string; artist: string; artworkUrl?: string
    durationSec: number; positionSec: number; isPlaying: boolean
  } | null): void
  onCommand(cb: (cmd: 'toggle' | 'next' | 'previous') => void): void
}
```
and add `player: PlayerBridge` to `interface Window`.

- [ ] **Step 4: Type-check** — `npx tsc --noEmit`.
- [ ] **Step 5: Checkpoint** — review. Do NOT commit.

---

## Task 5: Store bridge (renderer)

**Files:**
- Create: `src/player/bridge.ts`
- Modify: `src/main.tsx`

**Interfaces:** none new. Wires `usePlayer` ↔ `window.player`.

- [ ] **Step 1: `src/player/bridge.ts`**

```ts
import { usePlayer } from './store'

// Push player state to main (throttled to ~1/sec so Discord/tray update without
// spamming). Runs once, at app start.
export function initPlayerBridge(): void {
  let last = 0
  const send = () => {
    const s = usePlayer.getState()
    if (!s.current) {
      window.player.reportProgress(null)
      return
    }
    window.player.reportProgress({
      title: s.current.title,
      artist: s.current.artist,
      artworkUrl: s.current.artworkUrl,
      durationSec: s.duration,
      positionSec: s.position,
      isPlaying: s.isPlaying,
    })
  }

  usePlayer.subscribe((state, prev) => {
    const now = Date.now()
    const trackChanged = state.current?.id !== prev.current?.id
    const playChanged = state.isPlaying !== prev.isPlaying
    // Always send immediately on track/play change; otherwise throttle position.
    if (trackChanged || playChanged || now - last > 1000) {
      last = now
      send()
    }
  })

  // Commands from main (media keys / tray) drive the store.
  window.player.onCommand((cmd) => {
    const s = usePlayer.getState()
    if (cmd === 'toggle') s.toggle()
    else if (cmd === 'next') void s.next()
    else if (cmd === 'previous') void s.previous()
  })
}
```

- [ ] **Step 2: Call it in `src/main.tsx`**

Add `import { initPlayerBridge } from './player/bridge'` and call
`initPlayerBridge()` before `ReactDOM.createRoot(...).render(...)`.

- [ ] **Step 3: Type-check** — `npx tsc --noEmit`.
- [ ] **Step 4: Checkpoint** — review. Do NOT commit.

---

## Task 6: Tray (rewrite, player-driven)

**Files:** Rewrite `electron/tray.ts`.

**Interfaces produced:**
```ts
export function createTray(opts: {
  iconPath: string
  onCommand: (cmd: 'toggle' | 'next' | 'previous') => void
  onShow: () => void
  onQuit: () => void
}): { update(title: string | null, artist: string): void; destroy(): void }
```

- [ ] **Step 1: Rewrite `electron/tray.ts`**

```ts
import { Tray, Menu, nativeImage } from 'electron'

export function createTray(opts: {
  iconPath: string
  onCommand: (cmd: 'toggle' | 'next' | 'previous') => void
  onShow: () => void
  onQuit: () => void
}) {
  const tray = new Tray(nativeImage.createFromPath(opts.iconPath))
  const build = (label: string) => {
    tray.setToolTip(`SoundTOP — ${label}`)
    tray.setContextMenu(
      Menu.buildFromTemplate([
        { label, enabled: false },
        { type: 'separator' },
        { label: 'Play / Pause', click: () => opts.onCommand('toggle') },
        { label: 'Next', click: () => opts.onCommand('next') },
        { label: 'Previous', click: () => opts.onCommand('previous') },
        { type: 'separator' },
        { label: 'Show', click: () => opts.onShow() },
        { label: 'Quit', click: () => opts.onQuit() },
      ]),
    )
  }
  build('Not playing')
  tray.on('click', () => opts.onShow())
  return {
    update: (title: string | null, artist: string) =>
      build(title ? `${title}${artist ? ' — ' + artist : ''}` : 'Not playing'),
    destroy: () => tray.destroy(),
  }
}
```

- [ ] **Step 2: Type-check** — `npx tsc --noEmit`.
- [ ] **Step 3: Checkpoint** — review. Do NOT commit.

---

## Task 7: Media keys (rewrite → IPC command)

**Files:** Rewrite `electron/mediaKeys.ts`.

**Interfaces produced:**
```ts
import type { WebContents } from 'electron'
export function registerMediaKeys(send: (cmd: 'toggle' | 'next' | 'previous') => void): () => void
```

- [ ] **Step 1: Rewrite `electron/mediaKeys.ts`**

```ts
import { globalShortcut } from 'electron'

export function registerMediaKeys(send: (cmd: 'toggle' | 'next' | 'previous') => void): () => void {
  globalShortcut.register('MediaPlayPause', () => send('toggle'))
  globalShortcut.register('MediaNextTrack', () => send('next'))
  globalShortcut.register('MediaPreviousTrack', () => send('previous'))
  return () => globalShortcut.unregisterAll()
}
```

- [ ] **Step 2: Type-check** — `npx tsc --noEmit`.
- [ ] **Step 3: Checkpoint** — review. Do NOT commit.

---

## Task 8: Wire into `main.ts` + end-to-end verification

**Files:** Modify `electron/main.ts`.

- [ ] **Step 1: Wire discord + tray + media keys + progress routing**

Add imports:
```ts
import { CONFIG } from './config'
import { DiscordPresence } from './discord'
import { createTray } from './tray'
import { registerMediaKeys } from './mediaKeys'
import type { PlayerCommand } from './ipc'
import type { PlayerSnapshot } from './rpcActivity'
```
Add module state:
```ts
let discord: DiscordPresence | null = null
let tray: ReturnType<typeof createTray> | null = null
let unregisterKeys: (() => void) | null = null
let quitting = false
```
In `createPlayerWindow()`, make close hide to tray:
```ts
  win.on('close', (e) => {
    if (!quitting) {
      e.preventDefault()
      win.hide()
    }
  })
```
Helper to send a command to the renderer:
```ts
function sendCommand(cmd: PlayerCommand) {
  mainWindow?.webContents.send(IPC.PLAYER_COMMAND, cmd)
}
```
Route progress from the renderer to discord + tray:
```ts
ipcMain.on(IPC.PLAYER_PROGRESS, (_e, snap: PlayerSnapshot | null) => {
  discord?.update(snap)
  tray?.update(snap ? snap.title : null, snap ? snap.artist : '')
})
```
In `setupPlayer()`, after `createPlayerWindow()`, start the native pieces:
```ts
  discord = new DiscordPresence(CONFIG.discordClientId)
  discord.start()
  tray = createTray({
    iconPath: VITE_DEV_SERVER_URL
      ? path.join(process.env.APP_ROOT!, 'public', 'tray.png')
      : path.join(RENDERER_DIST, 'tray.png'),
    onCommand: (cmd) => sendCommand(cmd),
    onShow: () => { mainWindow?.show(); mainWindow?.focus() },
    onQuit: () => { quitting = true; app.quit() },
  })
  unregisterKeys = registerMediaKeys((cmd) => sendCommand(cmd))
```
Add cleanup:
```ts
app.on('before-quit', () => { quitting = true })
app.on('will-quit', () => {
  unregisterKeys?.()
  discord?.stop()
  tray?.destroy()
})
```
Because the window now hides instead of closing, remove/adjust the
`window-all-closed → quit` so the app stays in the tray. Change it to:
```ts
app.on('window-all-closed', () => {
  // Stay alive in the tray; quit is explicit (tray menu). booted guard still
  // covers the login transient on macOS-less platforms.
})
```
(The single-instance `second-instance` handler already re-shows the window.)

- [ ] **Step 2: Type-check + unit suite**

Run: `npx tsc --noEmit && npm test`
Expected: tsc clean; all unit tests pass (incl. rpcActivity).

- [ ] **Step 3: End-to-end verification (manual, needs Discord running)**

Run: `env -u ELECTRON_RUN_AS_NODE npm run dev` (kill any packaged `SoundTOP.exe` first).
Verify:
1. Play a track → Discord profile shows **"Listening to SoundCloud"**, the track
   title + artist, cover art, and a **progress bar that advances**.
2. Pause → the bar stops; play → it resumes; skip → it updates to the new track.
3. Tray icon present; menu shows the current track + Play/Pause/Next/Previous/
   Show/Quit; the commands control playback; closing the window hides to tray;
   Quit exits.
4. Hardware media keys (or keyboard media keys) toggle/skip playback.

If the Discord presence shows "Playing" instead of "Listening", or the cover art
doesn't appear, adjust `discord.ts`/`rpcActivity.ts` against the live behavior of
`@xhayper/discord-rpc` (the fragile part) until it reads "Listening to SoundCloud"
with art + bar.

- [ ] **Step 4: Checkpoint** — review. Do NOT commit.

---

## Self-Review Notes

- **Spec coverage (Phase 4 = build-order item 4):** Listening RPC + live progress
  → Tasks 2, 3, 8; cover art + title/artist → Tasks 2, 3; player→main state feed
  → Tasks 4, 5, 8; tray driven by player + commands → Tasks 6, 8; media keys →
  player commands → Tasks 7, 8; close-to-tray → Task 8. Rename + embed removal is
  Phase 5.
- **Type consistency:** `PlayerSnapshot`/`RpcActivity`/`buildActivity` (Task 2)
  consumed by `discord.ts` (Task 3) and `main.ts` (Task 8); `PlayerCommand`
  (Task 4) consumed by preload, bridge, tray, media keys, main; the bridge (Task 5)
  reuses the Phase 2/3 `usePlayer` store shape.
- **Fragility:** `@xhayper/discord-rpc`'s Listening type + external image URL is the
  uncertain part; Task 8 Step 3 locks it to live behavior.
- **No git commits** — review checkpoints only.
