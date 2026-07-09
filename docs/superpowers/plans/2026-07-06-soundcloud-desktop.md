# SoundCloud Desktop Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A Windows desktop app that wraps the real SoundCloud web app in an Electron window and adds native features (custom title bar, media keys, tray, persisted window state, Discord Rich Presence).

**Architecture:** Electron main process hosts a frameless `BrowserWindow` whose content area is filled by a `BrowserView` loading `soundcloud.com`. A thin React renderer draws only a custom title bar strip at the top. A read-only preload observer on the BrowserView reads `navigator.mediaSession.metadata` and forwards it via IPC to main, which fans it out to Discord RPC and the tray tooltip. SMTC/media keys are handled by Chromium natively, with `globalShortcut` as fallback.

**Tech Stack:** Electron 30, Vite 5, React 18, TypeScript 5, Tailwind 4, electron-builder (NSIS), vitest (unit tests), discord-rpc.

## Global Constraints

- **Windows-first.** Primary target is Windows x64 NSIS. Do not add macOS/Linux-specific code paths.
- **No git commits or pushes.** The user asked not to commit or push. Treat each task boundary as a manual review checkpoint — verify the deliverable, do NOT run `git commit`/`git push`.
- **Observer is read-only.** The BrowserView observer MUST NOT mutate the SoundCloud DOM or layout. Read `navigator.mediaSession` only.
- **Graceful degradation.** Every native feature (Discord, observer, tray, media keys) must no-op silently on failure and never crash the app.
- **Electron version floor:** `electron@^30`. **Node built-ins** imported with `node:` prefix (matches existing `electron/main.ts`).
- Discord `clientId` is a public value stored in a versioned config file — never treated as a secret.

---

## File Structure

Created / modified:

- `electron/main.ts` — MODIFY: bootstrap, mount BrowserView, wire services + IPC.
- `electron/window.ts` — CREATE: frameless window + BrowserView management.
- `electron/store.ts` — CREATE: JSON persistence (window bounds, config). Pure.
- `electron/track.ts` — CREATE: current-track state + metadata parsing. Pure core.
- `electron/tray.ts` — CREATE: tray icon + menu.
- `electron/mediaKeys.ts` — CREATE: global media shortcuts.
- `electron/discord.ts` — CREATE: Discord RPC presence.
- `electron/observer.ts` — CREATE: BrowserView preload, read-only mediaSession reader.
- `electron/preload.ts` — MODIFY: window's renderer preload; expose title-bar control API.
- `electron/ipc.ts` — CREATE: shared IPC channel-name constants (used by both processes).
- `electron/config.ts` — CREATE: static config (SoundCloud URL, Discord clientId).
- `src/App.tsx` — MODIFY: render only `<TitleBar/>`, fix `<Home/>` bug.
- `src/components/TitleBar.tsx` — CREATE: custom title bar + window controls.
- `src/components/Sidebar.tsx`, `src/components/Player.tsx`, `src/components/Topbar.tsx` — DELETE (mockups).
- `src/vite-env.d.ts` — MODIFY: type the exposed window-control API.
- `vite.config.ts` — MODIFY: build two preloads (renderer + observer).
- `electron-builder.json5` — MODIFY: real appId/productName; Windows-only files.
- `package.json` — MODIFY: add deps (`discord-rpc`), devDeps (`vitest`, `@types/discord-rpc`), `test` script.
- `vitest.config.ts` — CREATE.
- `README.md` — MODIFY: rewrite for this project + smoke checklist.

---

## Task 1: Dependencies, test runner, and build config

**Files:**
- Modify: `package.json`
- Create: `vitest.config.ts`
- Modify: `electron-builder.json5`
- Modify: `vite.config.ts`
- Create: `electron/config.ts`
- Create: `electron/ipc.ts`

**Interfaces:**
- Produces: `electron/config.ts` exports `const CONFIG = { soundcloudUrl: string; discordClientId: string; titleBarHeight: number }`.
- Produces: `electron/ipc.ts` exports `const IPC` channel-name constants:
  `TRACK_UPDATE = 'track:update'`, `MEDIA_COMMAND = 'media:command'`,
  `WINDOW_MINIMIZE = 'window:minimize'`, `WINDOW_MAXIMIZE = 'window:maximize'`,
  `WINDOW_CLOSE = 'window:close'`, `WINDOW_IS_MAXIMIZED = 'window:isMaximized'`.

- [ ] **Step 1: Add dependencies**

Run:
```bash
npm install discord-rpc
npm install -D vitest @types/discord-rpc
```
Expected: installs succeed, `package.json` gains `discord-rpc` in dependencies and `vitest` + `@types/discord-rpc` in devDependencies.

- [ ] **Step 2: Add `test` script to `package.json`**

In `package.json` `scripts`, add:
```json
"test": "vitest run"
```

- [ ] **Step 3: Create `vitest.config.ts`**

```ts
import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    environment: 'node',
    include: ['electron/**/*.test.ts'],
  },
})
```

- [ ] **Step 4: Create `electron/config.ts`**

```ts
export const CONFIG = {
  soundcloudUrl: 'https://soundcloud.com/discover',
  // Public Discord application client id. Replace with your own app's id
  // from https://discord.com/developers/applications. Not a secret.
  discordClientId: '000000000000000000',
  titleBarHeight: 36,
}
```

- [ ] **Step 5: Create `electron/ipc.ts`**

```ts
export const IPC = {
  TRACK_UPDATE: 'track:update',
  MEDIA_COMMAND: 'media:command',
  WINDOW_MINIMIZE: 'window:minimize',
  WINDOW_MAXIMIZE: 'window:maximize',
  WINDOW_CLOSE: 'window:close',
  WINDOW_IS_MAXIMIZED: 'window:isMaximized',
} as const

export type MediaCommand = 'playpause' | 'next' | 'previous'
```

- [ ] **Step 6: Update `vite.config.ts` to build two preloads**

Replace the `electron({...})` plugin block with the array form so both preloads build:
```ts
import { defineConfig } from 'vite'
import path from 'node:path'
import electron from 'vite-plugin-electron'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    electron([
      {
        entry: 'electron/main.ts',
      },
      {
        entry: 'electron/preload.ts',
        onstart(args) {
          args.reload()
        },
      },
      {
        entry: 'electron/observer.ts',
        vite: {
          build: {
            rollupOptions: { output: { entryFileNames: 'observer.mjs' } },
          },
        },
      },
    ]),
  ],
})
```
Note: `electron/observer.ts` is created in Task 4 — this config references it ahead of time. Until Task 4 exists, `npm run dev` will fail to build the observer entry; that is expected and resolved by Task 4.

- [ ] **Step 7: Fix `electron-builder.json5` identity + Windows files**

Change:
```json5
"appId": "com.soundtop.desktop",
"productName": "SoundTOP",
```
Leave `mac`/`linux` blocks in place (harmless; Windows-first build uses only `win`).

- [ ] **Step 8: Verify test runner works (empty pass)**

Run: `npm test`
Expected: vitest runs, reports "No test files found" or 0 tests, exit code 0. (If exit code is nonzero because no tests exist yet, that is acceptable — the next task adds the first test.)

- [ ] **Step 9: Checkpoint** — review changes. Do NOT commit.

---

## Task 2: `store.ts` — persisted window state + config (TDD)

**Files:**
- Create: `electron/store.ts`
- Test: `electron/store.test.ts`

**Interfaces:**
- Produces:
  ```ts
  interface WindowState { width: number; height: number; x?: number; y?: number; maximized: boolean }
  interface PersistedState { window: WindowState; discordEnabled: boolean }
  const DEFAULT_STATE: PersistedState
  function mergeState(loaded: unknown): PersistedState  // sanitizes partial/corrupt input
  class Store { constructor(filePath: string); get(): PersistedState; set(patch: Partial<PersistedState>): void }
  ```
- `mergeState` is pure and the unit-test target. `Store` reads/writes JSON via `node:fs`.

- [ ] **Step 1: Write the failing test**

`electron/store.test.ts`:
```ts
import { describe, it, expect } from 'vitest'
import { mergeState, DEFAULT_STATE } from './store'

describe('mergeState', () => {
  it('returns defaults for undefined', () => {
    expect(mergeState(undefined)).toEqual(DEFAULT_STATE)
  })

  it('returns defaults for corrupt (non-object) input', () => {
    expect(mergeState('garbage')).toEqual(DEFAULT_STATE)
  })

  it('keeps valid window bounds and fills missing fields', () => {
    const r = mergeState({ window: { width: 800, height: 600, maximized: true } })
    expect(r.window.width).toBe(800)
    expect(r.window.height).toBe(600)
    expect(r.window.maximized).toBe(true)
    expect(r.discordEnabled).toBe(DEFAULT_STATE.discordEnabled)
  })

  it('rejects non-numeric bounds and falls back to default width', () => {
    const r = mergeState({ window: { width: 'x', height: -5, maximized: 'no' } })
    expect(r.window.width).toBe(DEFAULT_STATE.window.width)
    expect(r.window.height).toBe(DEFAULT_STATE.window.height)
    expect(r.window.maximized).toBe(false)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run electron/store.test.ts`
Expected: FAIL — cannot import `mergeState` / `DEFAULT_STATE` from `./store`.

- [ ] **Step 3: Write minimal implementation**

`electron/store.ts`:
```ts
import fs from 'node:fs'

export interface WindowState {
  width: number
  height: number
  x?: number
  y?: number
  maximized: boolean
}

export interface PersistedState {
  window: WindowState
  discordEnabled: boolean
}

export const DEFAULT_STATE: PersistedState = {
  window: { width: 1200, height: 800, maximized: false },
  discordEnabled: true,
}

function num(v: unknown, fallback: number): number {
  return typeof v === 'number' && Number.isFinite(v) && v > 0 ? v : fallback
}

export function mergeState(loaded: unknown): PersistedState {
  if (!loaded || typeof loaded !== 'object') return { ...DEFAULT_STATE, window: { ...DEFAULT_STATE.window } }
  const src = loaded as Record<string, unknown>
  const w = (src.window && typeof src.window === 'object' ? src.window : {}) as Record<string, unknown>
  return {
    window: {
      width: num(w.width, DEFAULT_STATE.window.width),
      height: num(w.height, DEFAULT_STATE.window.height),
      x: typeof w.x === 'number' && Number.isFinite(w.x) ? w.x : undefined,
      y: typeof w.y === 'number' && Number.isFinite(w.y) ? w.y : undefined,
      maximized: w.maximized === true,
    },
    discordEnabled: src.discordEnabled === false ? false : DEFAULT_STATE.discordEnabled,
  }
}

export class Store {
  private state: PersistedState
  constructor(private filePath: string) {
    let raw: unknown
    try {
      raw = JSON.parse(fs.readFileSync(this.filePath, 'utf-8'))
    } catch {
      raw = undefined
    }
    this.state = mergeState(raw)
  }
  get(): PersistedState {
    return this.state
  }
  set(patch: Partial<PersistedState>): void {
    this.state = mergeState({ ...this.state, ...patch })
    try {
      fs.writeFileSync(this.filePath, JSON.stringify(this.state, null, 2))
    } catch {
      // best-effort; ignore write failures
    }
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run electron/store.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 5: Checkpoint** — review. Do NOT commit.

---

## Task 3: `track.ts` — current track state + metadata parsing (TDD)

**Files:**
- Create: `electron/track.ts`
- Test: `electron/track.test.ts`

**Interfaces:**
- Consumes: nothing.
- Produces:
  ```ts
  interface TrackInfo { title: string; artist: string; artwork?: string; playing: boolean }
  function parseMediaMetadata(raw: unknown): TrackInfo | null
  class TrackState {
    update(info: TrackInfo | null): boolean  // returns true if changed
    get(): TrackInfo | null
    onChange(cb: (info: TrackInfo | null) => void): void
  }
  ```
  `parseMediaMetadata` accepts the raw payload the observer sends
  (`{ title, artist, artwork, playing }`) and returns a normalized `TrackInfo`
  or `null` when there is no usable title.

- [ ] **Step 1: Write the failing test**

`electron/track.test.ts`:
```ts
import { describe, it, expect, vi } from 'vitest'
import { parseMediaMetadata, TrackState } from './track'

describe('parseMediaMetadata', () => {
  it('returns null when no title', () => {
    expect(parseMediaMetadata({ artist: 'x', playing: true })).toBeNull()
    expect(parseMediaMetadata(null)).toBeNull()
  })
  it('normalizes a full payload', () => {
    const r = parseMediaMetadata({ title: 'Song', artist: 'Artist', artwork: 'http://a/i.jpg', playing: true })
    expect(r).toEqual({ title: 'Song', artist: 'Artist', artwork: 'http://a/i.jpg', playing: true })
  })
  it('defaults missing artist and playing', () => {
    const r = parseMediaMetadata({ title: 'Song' })
    expect(r).toEqual({ title: 'Song', artist: '', artwork: undefined, playing: false })
  })
})

describe('TrackState', () => {
  it('reports change only when content differs', () => {
    const s = new TrackState()
    const cb = vi.fn()
    s.onChange(cb)
    expect(s.update({ title: 'A', artist: '', playing: true })).toBe(true)
    expect(s.update({ title: 'A', artist: '', playing: true })).toBe(false)
    expect(s.update({ title: 'A', artist: '', playing: false })).toBe(true)
    expect(cb).toHaveBeenCalledTimes(2)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run electron/track.test.ts`
Expected: FAIL — cannot import from `./track`.

- [ ] **Step 3: Write minimal implementation**

`electron/track.ts`:
```ts
export interface TrackInfo {
  title: string
  artist: string
  artwork?: string
  playing: boolean
}

export function parseMediaMetadata(raw: unknown): TrackInfo | null {
  if (!raw || typeof raw !== 'object') return null
  const r = raw as Record<string, unknown>
  const title = typeof r.title === 'string' ? r.title.trim() : ''
  if (!title) return null
  return {
    title,
    artist: typeof r.artist === 'string' ? r.artist.trim() : '',
    artwork: typeof r.artwork === 'string' && r.artwork ? r.artwork : undefined,
    playing: r.playing === true,
  }
}

export class TrackState {
  private current: TrackInfo | null = null
  private listeners: ((info: TrackInfo | null) => void)[] = []

  update(info: TrackInfo | null): boolean {
    if (sameTrack(this.current, info)) return false
    this.current = info
    for (const cb of this.listeners) cb(info)
    return true
  }
  get(): TrackInfo | null {
    return this.current
  }
  onChange(cb: (info: TrackInfo | null) => void): void {
    this.listeners.push(cb)
  }
}

function sameTrack(a: TrackInfo | null, b: TrackInfo | null): boolean {
  if (a === b) return true
  if (!a || !b) return false
  return a.title === b.title && a.artist === b.artist && a.artwork === b.artwork && a.playing === b.playing
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run electron/track.test.ts`
Expected: PASS.

- [ ] **Step 5: Run full suite**

Run: `npm test`
Expected: PASS (store + track).

- [ ] **Step 6: Checkpoint** — review. Do NOT commit.

---

## Task 4: `observer.ts` — read-only BrowserView preload

**Files:**
- Create: `electron/observer.ts`

**Interfaces:**
- Consumes: `IPC.TRACK_UPDATE`, `IPC.MEDIA_COMMAND` from `electron/ipc.ts`.
- Produces: sends `{ title, artist, artwork, playing }` (or `null`) on
  `IPC.TRACK_UPDATE`; listens on `IPC.MEDIA_COMMAND` and invokes the matching
  `navigator.mediaSession` action / falls back to nothing.

- [ ] **Step 1: Implement observer preload**

`electron/observer.ts`:
```ts
import { ipcRenderer } from 'electron'
import { IPC, type MediaCommand } from './ipc'

// Read-only. Never mutate the page. Poll mediaSession + playback state.
function readTrack(): unknown {
  const md = navigator.mediaSession?.metadata
  if (!md || !md.title) return null
  const artwork = md.artwork && md.artwork.length ? md.artwork[md.artwork.length - 1].src : undefined
  const playing = navigator.mediaSession.playbackState === 'playing'
  return { title: md.title, artist: md.artist ?? '', artwork, playing }
}

let last = ''
function tick() {
  let payload: unknown = null
  try {
    payload = readTrack()
  } catch {
    payload = null
  }
  const key = JSON.stringify(payload)
  if (key !== last) {
    last = key
    ipcRenderer.send(IPC.TRACK_UPDATE, payload)
  }
}

setInterval(tick, 1000)
window.addEventListener('DOMContentLoaded', tick)

// Media command from main → drive the page's own controls via MediaSession.
ipcRenderer.on(IPC.MEDIA_COMMAND, (_e, cmd: MediaCommand) => {
  // MediaSession action handlers are registered by SoundCloud; we cannot call
  // them directly. Dispatch the corresponding hardware media key instead by
  // relying on Chromium's built-in handling — no-op fallback if unavailable.
  // The reliable path (globalShortcut → webContents.sendInputEvent) lives in
  // main; this handler is a placeholder kept for symmetry and future use.
  void cmd
})
```
Note: playback control is driven from main via `globalShortcut` +
`webContents.sendInputEvent` (Task 8). The observer's command handler is
intentionally a no-op placeholder — do not add DOM manipulation here (violates
the read-only constraint).

- [ ] **Step 2: Verify it builds**

Run: `npm run dev`
Expected: Vite + electron build with no errors for `observer.ts` (the app window will still be incomplete until later tasks; you can close it). If the dev app fails for reasons unrelated to `observer.ts` compilation, that is acceptable at this stage.

- [ ] **Step 3: Checkpoint** — review. Do NOT commit.

---

## Task 5: `window.ts` — frameless window + BrowserView

**Files:**
- Create: `electron/window.ts`

**Interfaces:**
- Consumes: `Store` (Task 2), `CONFIG` (Task 1), `IPC` (Task 1).
- Produces:
  ```ts
  interface AppWindow {
    win: BrowserWindow
    view: BrowserView   // hosts soundcloud.com
    destroy(): void
  }
  function createAppWindow(opts: {
    store: Store
    preloadPath: string      // window renderer preload (dist-electron/preload.mjs)
    observerPath: string     // BrowserView preload (dist-electron/observer.mjs)
    rendererUrl?: string     // VITE_DEV_SERVER_URL when present
    rendererFile: string     // built index.html path for production
  }): AppWindow
  ```
- The BrowserView is inset below the title bar by `CONFIG.titleBarHeight` and
  resizes with the window.

- [ ] **Step 1: Implement window module**

`electron/window.ts`:
```ts
import { BrowserWindow, BrowserView } from 'electron'
import { CONFIG } from './config'
import type { Store } from './store'

export interface AppWindow {
  win: BrowserWindow
  view: BrowserView
  destroy(): void
}

export function createAppWindow(opts: {
  store: Store
  preloadPath: string
  observerPath: string
  rendererUrl?: string
  rendererFile: string
}): AppWindow {
  const s = opts.store.get().window
  const win = new BrowserWindow({
    width: s.width,
    height: s.height,
    x: s.x,
    y: s.y,
    frame: false,
    backgroundColor: '#0D0D0D',
    webPreferences: { preload: opts.preloadPath },
  })
  if (s.maximized) win.maximize()

  const view = new BrowserView({
    webPreferences: { preload: opts.observerPath },
  })
  win.setBrowserView(view)

  const layout = () => {
    const [w, h] = win.getContentSize()
    view.setBounds({ x: 0, y: CONFIG.titleBarHeight, width: w, height: Math.max(0, h - CONFIG.titleBarHeight) })
  }
  layout()
  win.on('resize', layout)
  view.setAutoResize({ width: true, height: true })
  view.webContents.loadURL(CONFIG.soundcloudUrl)

  // Load the thin renderer (title bar).
  if (opts.rendererUrl) {
    win.loadURL(opts.rendererUrl)
  } else {
    win.loadFile(opts.rendererFile)
  }

  const persist = () => {
    if (win.isDestroyed()) return
    const b = win.getBounds()
    opts.store.set({
      window: { width: b.width, height: b.height, x: b.x, y: b.y, maximized: win.isMaximized() },
    })
  }
  win.on('resize', persist)
  win.on('move', persist)

  return {
    win,
    view,
    destroy() {
      win.removeBrowserView(view)
      ;(view.webContents as unknown as { destroy?: () => void }).destroy?.()
    },
  }
}
```
Note: `win.getContentSize()` excludes the frame; since the window is frameless
it equals the client area. The title bar is drawn by the renderer over the top
`CONFIG.titleBarHeight` pixels, and the BrowserView starts below it.

- [ ] **Step 2: Type-check**

Run: `npx tsc --noEmit`
Expected: no errors in `window.ts` (unused-import/param errors elsewhere are addressed in their own tasks).

- [ ] **Step 3: Checkpoint** — review. Do NOT commit.

---

## Task 6: `TitleBar.tsx` + renderer preload + `App.tsx` cleanup

**Files:**
- Modify: `electron/preload.ts`
- Modify: `src/vite-env.d.ts`
- Create: `src/components/TitleBar.tsx`
- Modify: `src/App.tsx`
- Delete: `src/components/Sidebar.tsx`, `src/components/Player.tsx`, `src/components/Topbar.tsx`
- Modify: `src/main.tsx` (remove the demo `main-process-message` listener)

**Interfaces:**
- Consumes: `IPC` window channels.
- Produces: `window.windowControls` API in the renderer:
  ```ts
  interface WindowControls {
    minimize(): void
    toggleMaximize(): void
    close(): void
    isMaximized(): Promise<boolean>
  }
  ```

- [ ] **Step 1: Expose window controls in `electron/preload.ts`**

Replace the file contents with:
```ts
import { ipcRenderer, contextBridge } from 'electron'
import { IPC } from './ipc'

contextBridge.exposeInMainWorld('windowControls', {
  minimize: () => ipcRenderer.send(IPC.WINDOW_MINIMIZE),
  toggleMaximize: () => ipcRenderer.send(IPC.WINDOW_MAXIMIZE),
  close: () => ipcRenderer.send(IPC.WINDOW_CLOSE),
  isMaximized: () => ipcRenderer.invoke(IPC.WINDOW_IS_MAXIMIZED),
})
```

- [ ] **Step 2: Type the API in `src/vite-env.d.ts`**

Append:
```ts
interface WindowControls {
  minimize(): void
  toggleMaximize(): void
  close(): void
  isMaximized(): Promise<boolean>
}
interface Window {
  windowControls: WindowControls
}
```

- [ ] **Step 3: Create `src/components/TitleBar.tsx`**

```tsx
import { Minus, Square, X } from 'lucide-react'

export default function TitleBar() {
  return (
    <header
      className="h-9 shrink-0 bg-[#0D0D0D] flex items-center justify-between select-none"
      style={{ WebkitAppRegion: 'drag' } as React.CSSProperties}
    >
      <div className="px-4 text-xs font-semibold text-gray-300">SoundTOP</div>
      <div className="flex h-full" style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}>
        <button
          onClick={() => window.windowControls.minimize()}
          className="w-11 h-full flex items-center justify-center text-gray-400 hover:bg-[#222]"
        >
          <Minus size={16} />
        </button>
        <button
          onClick={() => window.windowControls.toggleMaximize()}
          className="w-11 h-full flex items-center justify-center text-gray-400 hover:bg-[#222]"
        >
          <Square size={13} />
        </button>
        <button
          onClick={() => window.windowControls.close()}
          className="w-11 h-full flex items-center justify-center text-gray-400 hover:bg-[#E81123] hover:text-white"
        >
          <X size={16} />
        </button>
      </div>
    </header>
  )
}
```

- [ ] **Step 4: Rewrite `src/App.tsx`**

```tsx
import TitleBar from './components/TitleBar'

function App() {
  return <TitleBar />
}

export default App
```

- [ ] **Step 5: Simplify `src/main.tsx`**

Replace the file with:
```tsx
import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.tsx'
import './index.css'

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)
```

- [ ] **Step 6: Delete mockup components**

Run:
```bash
rm src/components/Sidebar.tsx src/components/Player.tsx src/components/Topbar.tsx
```

- [ ] **Step 7: Make the renderer background transparent-friendly**

In `src/index.css`, ensure the body has no default margin and the root fills:
add (or confirm) at the top:
```css
html, body, #root { margin: 0; height: 100%; background: #0D0D0D; }
```

- [ ] **Step 8: Type-check**

Run: `npx tsc --noEmit`
Expected: no errors. (`WebkitAppRegion` is typed via the `as React.CSSProperties` cast.)

- [ ] **Step 9: Checkpoint** — review. Do NOT commit.

---

## Task 7: `tray.ts` — system tray + hide-to-tray

**Files:**
- Create: `electron/tray.ts`
- Add: `public/tray.png` (16×16 or 32×32 icon)

**Interfaces:**
- Consumes: `BrowserWindow`, a `sendMediaCommand(cmd)` callback, `TrackState`.
- Produces:
  ```ts
  function createTray(opts: {
    win: BrowserWindow
    getTrack: () => import('./track').TrackInfo | null
    onCommand: (cmd: import('./ipc').MediaCommand) => void
    onQuit: () => void
  }): { update(): void; destroy(): void }
  ```

- [ ] **Step 1: Add a tray icon asset**

Place a small PNG at `public/tray.png` (any 16–32px monochrome/glyph icon).
If none is available, generate a solid 16×16 orange square PNG as a placeholder.

- [ ] **Step 2: Implement `electron/tray.ts`**

```ts
import { Tray, Menu, nativeImage, BrowserWindow } from 'electron'
import path from 'node:path'
import type { TrackInfo } from './track'
import type { MediaCommand } from './ipc'

export function createTray(opts: {
  win: BrowserWindow
  iconPath: string
  getTrack: () => TrackInfo | null
  onCommand: (cmd: MediaCommand) => void
  onQuit: () => void
}) {
  const tray = new Tray(nativeImage.createFromPath(opts.iconPath))
  tray.setToolTip('SoundTOP')

  const rebuild = () => {
    const t = opts.getTrack()
    const label = t ? `${t.title}${t.artist ? ' — ' + t.artist : ''}` : 'Not playing'
    tray.setToolTip(`SoundTOP — ${label}`)
    tray.setContextMenu(
      Menu.buildFromTemplate([
        { label: label, enabled: false },
        { type: 'separator' },
        { label: 'Play / Pause', click: () => opts.onCommand('playpause') },
        { label: 'Next', click: () => opts.onCommand('next') },
        { label: 'Previous', click: () => opts.onCommand('previous') },
        { type: 'separator' },
        { label: 'Show', click: () => { opts.win.show(); opts.win.focus() } },
        { label: 'Quit', click: () => opts.onQuit() },
      ]),
    )
  }
  rebuild()
  tray.on('click', () => {
    if (opts.win.isVisible()) opts.win.focus()
    else opts.win.show()
  })

  return {
    update: rebuild,
    destroy: () => tray.destroy(),
  }
}
```

- [ ] **Step 3: Type-check**

Run: `npx tsc --noEmit`
Expected: no errors in `tray.ts`.

- [ ] **Step 4: Checkpoint** — review. Do NOT commit.

---

## Task 8: `mediaKeys.ts` — global media shortcuts

**Files:**
- Create: `electron/mediaKeys.ts`

**Interfaces:**
- Consumes: `BrowserView` whose `webContents` receives the key, `MediaCommand`.
- Produces:
  ```ts
  function registerMediaKeys(view: import('electron').BrowserView): () => void
  // returns an unregister function
  ```
  Uses `globalShortcut` for `MediaPlayPause`, `MediaNextTrack`,
  `MediaPreviousTrack` and forwards them into the BrowserView's web contents via
  `sendInputEvent`, so SoundCloud's own key handling responds.

- [ ] **Step 1: Implement `electron/mediaKeys.ts`**

```ts
import { globalShortcut, BrowserView } from 'electron'

const KEYS: Record<string, string> = {
  MediaPlayPause: 'MediaPlayPause',
  MediaNextTrack: 'MediaTrackNext',
  MediaPreviousTrack: 'MediaTrackPrev',
}

export function registerMediaKeys(view: BrowserView): () => void {
  for (const accelerator of Object.keys(KEYS)) {
    const keyCode = KEYS[accelerator]
    globalShortcut.register(accelerator, () => {
      const wc = view.webContents
      wc.sendInputEvent({ type: 'keyDown', keyCode })
      wc.sendInputEvent({ type: 'keyUp', keyCode })
    })
  }
  return () => globalShortcut.unregisterAll()
}
```
Note: Chromium already routes hardware media keys and shows the Windows SMTC
overlay when SoundCloud sets MediaSession. `globalShortcut` here is the explicit
fallback so keys work even when the app is not focused.

- [ ] **Step 2: Type-check**

Run: `npx tsc --noEmit`
Expected: no errors in `mediaKeys.ts`.

- [ ] **Step 3: Checkpoint** — review. Do NOT commit.

---

## Task 9: `discord.ts` — Discord Rich Presence

**Files:**
- Create: `electron/discord.ts`

**Interfaces:**
- Consumes: `CONFIG.discordClientId`, `TrackInfo`.
- Produces:
  ```ts
  class DiscordPresence {
    constructor(clientId: string)
    start(): void                     // connect + retry with backoff; never throws
    setTrack(info: TrackInfo | null): void
    stop(): void
  }
  ```

- [ ] **Step 1: Implement `electron/discord.ts`**

```ts
import RPC from 'discord-rpc'
import type { TrackInfo } from './track'

export class DiscordPresence {
  private client: RPC.Client | null = null
  private ready = false
  private pending: TrackInfo | null = null
  private retry: NodeJS.Timeout | null = null

  constructor(private clientId: string) {}

  start(): void {
    if (this.client) return
    const client = new RPC.Client({ transport: 'ipc' })
    this.client = client
    client.on('ready', () => {
      this.ready = true
      this.push(this.pending)
    })
    client.login({ clientId: this.clientId }).catch(() => {
      // Discord not running / not installed — retry later, never crash.
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

  setTrack(info: TrackInfo | null): void {
    this.pending = info
    if (this.ready) this.push(info)
  }

  private push(info: TrackInfo | null): void {
    if (!this.client || !this.ready) return
    if (!info) {
      this.client.clearActivity().catch(() => {})
      return
    }
    this.client
      .setActivity({
        details: info.title.slice(0, 128),
        state: (info.artist || 'SoundCloud').slice(0, 128),
        largeImageKey: 'soundcloud',
        largeImageText: 'SoundTOP',
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
Note: `largeImageKey: 'soundcloud'` must match an art asset uploaded to the
Discord application; if absent, Discord simply shows no image — still no crash.

- [ ] **Step 2: Type-check**

Run: `npx tsc --noEmit`
Expected: no errors in `discord.ts`.

- [ ] **Step 3: Checkpoint** — review. Do NOT commit.

---

## Task 10: `main.ts` — wire everything together

**Files:**
- Modify: `electron/main.ts`

**Interfaces:**
- Consumes: all modules above.
- Produces: the running application.

- [ ] **Step 1: Rewrite `electron/main.ts`**

```ts
import { app, BrowserWindow, ipcMain, globalShortcut } from 'electron'
import { fileURLToPath } from 'node:url'
import path from 'node:path'
import { CONFIG } from './config'
import { IPC, type MediaCommand } from './ipc'
import { Store } from './store'
import { TrackState, parseMediaMetadata } from './track'
import { createAppWindow, type AppWindow } from './window'
import { createTray } from './tray'
import { registerMediaKeys } from './mediaKeys'
import { DiscordPresence } from './discord'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
process.env.APP_ROOT = path.join(__dirname, '..')
const VITE_DEV_SERVER_URL = process.env['VITE_DEV_SERVER_URL']
const RENDERER_DIST = path.join(process.env.APP_ROOT, 'dist')

let appWindow: AppWindow | null = null
let tray: ReturnType<typeof createTray> | null = null
let unregisterKeys: (() => void) | null = null
let quitting = false

const store = new Store(path.join(app.getPath('userData'), 'state.json'))
const trackState = new TrackState()
const discord = new DiscordPresence(CONFIG.discordClientId)

function sendMediaCommand(cmd: MediaCommand) {
  if (!appWindow) return
  const map: Record<MediaCommand, string> = {
    playpause: 'MediaPlayPause',
    next: 'MediaTrackNext',
    previous: 'MediaTrackPrev',
  }
  const wc = appWindow.view.webContents
  wc.sendInputEvent({ type: 'keyDown', keyCode: map[cmd] })
  wc.sendInputEvent({ type: 'keyUp', keyCode: map[cmd] })
}

function createWindow() {
  appWindow = createAppWindow({
    store,
    preloadPath: path.join(__dirname, 'preload.mjs'),
    observerPath: path.join(__dirname, 'observer.mjs'),
    rendererUrl: VITE_DEV_SERVER_URL,
    rendererFile: path.join(RENDERER_DIST, 'index.html'),
  })

  // Hide to tray on close instead of quitting.
  appWindow.win.on('close', (e) => {
    if (!quitting) {
      e.preventDefault()
      appWindow?.win.hide()
    }
  })

  tray = createTray({
    win: appWindow.win,
    iconPath: path.join(process.env.APP_ROOT!, VITE_DEV_SERVER_URL ? 'public/tray.png' : 'tray.png'),
    getTrack: () => trackState.get(),
    onCommand: (cmd) => sendMediaCommand(cmd),
    onQuit: () => { quitting = true; app.quit() },
  })

  unregisterKeys = registerMediaKeys(appWindow.view)
}

// IPC: track updates from the observer.
ipcMain.on(IPC.TRACK_UPDATE, (_e, raw) => {
  const info = parseMediaMetadata(raw)
  if (trackState.update(info)) {
    discord.setTrack(info)
    tray?.update()
  }
})

// IPC: window controls from the renderer title bar.
ipcMain.on(IPC.WINDOW_MINIMIZE, () => appWindow?.win.minimize())
ipcMain.on(IPC.WINDOW_MAXIMIZE, () => {
  const w = appWindow?.win
  if (!w) return
  if (w.isMaximized()) w.unmaximize()
  else w.maximize()
})
ipcMain.on(IPC.WINDOW_CLOSE, () => appWindow?.win.close())
ipcMain.handle(IPC.WINDOW_IS_MAXIMIZED, () => appWindow?.win.isMaximized() ?? false)

app.whenReady().then(() => {
  createWindow()
  if (store.get().discordEnabled) discord.start()
})

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow()
  else appWindow?.win.show()
})

app.on('before-quit', () => {
  quitting = true
})

app.on('will-quit', () => {
  globalShortcut.unregisterAll()
  unregisterKeys?.()
  discord.stop()
  tray?.destroy()
})

// Single instance: focus existing window instead of opening a second.
if (!app.requestSingleInstanceLock()) {
  app.quit()
} else {
  app.on('second-instance', () => {
    appWindow?.win.show()
    appWindow?.win.focus()
  })
}
```

- [ ] **Step 2: Type-check the whole project**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 3: Run unit tests**

Run: `npm test`
Expected: PASS (store + track).

- [ ] **Step 4: Manual smoke run**

Run: `npm run dev`
Verify in order:
1. App opens frameless with a dark title bar reading "SoundTOP".
2. SoundCloud loads below the title bar; you can log in and play a track.
3. Title bar min / max / close buttons work (close hides to tray).
4. Tray icon present; right-click shows current track + Play/Pause/Show/Quit.
5. Hardware media keys (or keyboard media keys) toggle playback.
6. If Discord desktop is running with a matching app id, presence shows the track.

Record any failures and debug before proceeding. (Discord/media-key/tray issues that stem from environment — no Discord installed, keyboard without media keys — are acceptable and noted, not blockers.)

- [ ] **Step 5: Checkpoint** — review. Do NOT commit.

---

## Task 11: Production build + README

**Files:**
- Modify: `README.md`
- Modify: `index.html` (title)

**Interfaces:** none.

- [ ] **Step 1: Set the document title in `index.html`**

Change `<title>Vite + React + TS</title>` to `<title>SoundTOP</title>`.

- [ ] **Step 2: Rewrite `README.md`**

```markdown
# SoundTOP — SoundCloud Desktop

Unofficial desktop wrapper for SoundCloud with native window controls, media
keys, system tray, persisted window state, and Discord Rich Presence.

## Requirements

- Node.js 18+
- Windows 10/11 (primary target)

## Development

    npm install
    npm run dev

## Build (Windows installer)

    npm run build

The NSIS installer is written to `release/<version>/`.

## Configuration

Edit `electron/config.ts`:
- `soundcloudUrl` — start page.
- `discordClientId` — your Discord application id (create one at
  https://discord.com/developers/applications). Upload an art asset named
  `soundcloud` for the presence image.

## Features

- Frameless custom title bar (minimize / maximize / close).
- Real SoundCloud web app in an embedded view (real login + playback).
- Global media keys + Windows System Media Transport Controls.
- System tray with current track and playback controls; close hides to tray.
- Remembers window size / position / maximized state.
- Discord Rich Presence showing the current track (optional; silent if Discord
  is not running).

## Tests

    npm test

Unit tests cover the pure logic modules (`store`, `track`).

## Manual smoke checklist

1. App opens frameless; title bar reads "SoundTOP".
2. SoundCloud loads; login and playback work.
3. Title bar buttons work; close hides to tray.
4. Tray menu shows the current track + controls.
5. Media keys toggle playback.
6. Discord presence shows the track (when Discord is running).
```

- [ ] **Step 3: Full production build**

Run: `npm run build`
Expected: `tsc` passes, Vite builds renderer + electron, electron-builder emits an NSIS installer under `release/`. Launch the installed app and re-run the smoke checklist.

- [ ] **Step 4: Checkpoint** — review. Do NOT commit.

---

## Self-Review Notes

- **Spec coverage:** frame/title bar → Task 6; BrowserView wrapper → Task 5;
  observer/read-only metadata → Task 4; SMTC/media keys → Task 8; tray → Task 7;
  persisted window state → Task 2 + Task 5; Discord RPC → Task 9; wiring →
  Task 10; build/repro + README → Task 1 + Task 11; `<Home/>` bug fix → Task 6.
- **Two-preload build requirement** → Task 1 Step 6.
- **No git commits** honored: every task ends in a review checkpoint, not a commit.
