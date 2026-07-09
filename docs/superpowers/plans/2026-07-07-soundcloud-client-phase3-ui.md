# SoundCloud Client — Phase 3: Spotify-style UI — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking. The styling task additionally invokes **frontend-design:frontend-design**.

**Goal:** Turn the working playback slice into a real Spotify-style desktop client: a frameless custom-chrome window (the default launch, no more embed), a left sidebar, routed views (Likes, Search, Playlist, Feed, Artist) built on a shared track list, a full player bar (seek, volume, shuffle, repeat), responsive from ~800px to 4K, and a cohesive dark theme with a SoundCloud-orange accent.

**Architecture:** Main gains SoundCloud API methods (search/playlists/playlist tracks/feed/user/user tracks) exposed over IPC alongside the Phase 2 channels. The default `app.whenReady` path now opens the frameless React player window (the embed `createAppWindow`/observer path is left dormant — removed in Phase 5; tray/media-keys/Discord rewiring is Phase 4). The renderer uses react-router (HashRouter) for navigation, zustand for player state (from Phase 2), and a design system applied with the frontend-design skill.

**Tech Stack:** Electron 30, React 18, react-router-dom, zustand, Tailwind 4, hls.js, TypeScript, vitest.

**Spec:** `docs/superpowers/specs/2026-07-07-soundcloud-custom-client-design.md` (build order item 3). **Depends on Phases 1–2.**

## Global Constraints

- **Windows-first.** No macOS/Linux-specific paths.
- **NO git commits or pushes.** Each task ends in a review checkpoint.
- **Electron main + preloads are CommonJS** (`type:commonjs`, `vite.config.mts`); named electron imports; Node builtins with `node:` prefix. **Renderer is ESM React.**
- **Launch with** `env -u ELECTRON_RUN_AS_NODE npm run dev`. After this phase the DEFAULT launch is the player UI (no `SC_PLAYER` needed); the `SC_DEV_HARNESS=1` path stays.
- **OAuth token stays in main.** IPC returns data/URLs only.
- **Do NOT remove** the embed modules (`window.ts` createAppWindow, `observer.ts`), tray/mediaKeys/Discord wiring, in this phase — just stop calling the embed path by default. Cleanup is Phase 5; Discord/tray/media-keys rewiring is Phase 4.
- **Reuse Phases 1–2 exact names:** `ScApi`, `AuthSession`, `ClientId`, `Track`, `User`, `Playlist`, `normalizeTrack/User/Playlist`, `usePlayer` store (`playQueue`, `toggle`, `next`, `previous`, `seek`), `window.sc` bridge.
- **Theme:** dark, accent SoundCloud orange `#FF5500`. **Responsive:** relative units; sidebar collapses to icons under a width breakpoint; content scrolls vertically only; no horizontal page scroll; card grids `auto-fill`/`minmax`.
- **Naming:** keep existing "SoundTOP" strings for now (renamed to "SoundCloud" in Phase 5) EXCEPT new UI copy, which should be neutral (no product name hardcoded in views).

---

## File Structure (Phase 3)

Main / API:
- `electron/sc/api.ts` — MODIFY: add `search`, `playlists`, `playlist`, `feed`, `user`, `userTracks`.
- `electron/sc/normalize.ts` — MODIFY (if probe shows new shapes): reuse existing normalizers.
- `electron/ipc.ts` — MODIFY: add `SC_SEARCH`, `SC_PLAYLISTS`, `SC_PLAYLIST`, `SC_FEED`, `SC_USER`, `SC_USER_TRACKS`.
- `electron/scIpc.ts` — MODIFY: handlers for the new channels.
- `electron/preload.ts` — MODIFY: extend `window.sc`.
- `src/vite-env.d.ts` — MODIFY: extend `ScBridge`.
- `electron/main.ts` — MODIFY: default launch opens the frameless player window; register sc IPC there.

Renderer / UI:
- `src/ui/AppShell.tsx` — CREATE: frameless layout (title bar + sidebar + routed content + player bar).
- `src/ui/TitleBar.tsx` — MOVE/adapt existing `src/components/TitleBar.tsx` into the shell (window controls).
- `src/ui/Sidebar.tsx` — CREATE: nav + playlists list, collapsible.
- `src/ui/TrackList.tsx` + `src/ui/TrackRow.tsx` — CREATE: shared list/row (play on click).
- `src/ui/views/LikesView.tsx`, `SearchView.tsx`, `PlaylistView.tsx`, `FeedView.tsx`, `ArtistView.tsx` — CREATE.
- `src/ui/PlayerBar.tsx` — MODIFY: full controls (seek, volume, shuffle, repeat).
- `src/player/store.ts` — MODIFY: add `volume`, `setVolume`, `shuffle`, `toggleShuffle`, `cycleRepeat` wired to `queue.shuffled`.
- `src/router.tsx` — CREATE: HashRouter routes.
- `src/App.tsx` — MODIFY: render `<AppShell/>` (player is now default).
- `src/index.css` — MODIFY: theme tokens.
- `package.json` — MODIFY: add `react-router-dom`.

---

## Task 1: Dependencies + design system direction

**Files:** Modify `package.json`.

- [ ] **Step 1: Install router**

Run: `npm install react-router-dom`
Expected: added to dependencies.

- [ ] **Step 2: Establish the visual system**

Invoke **frontend-design:frontend-design** and record, in this task's report, the
concrete decisions to apply across all UI tasks: exact background layers (e.g.
`#0A0A0A` app / `#121212` panels / `#181818` bars), text colors, the orange
`#FF5500` accent usage, type scale, spacing, radius, hover/active states, and the
row/card/button specs. Later UI tasks MUST follow these tokens.

- [ ] **Step 3: Add theme tokens to `src/index.css`**

Add CSS variables under `:root` for the recorded palette + a base dark background
on `html,body,#root`. (Exact values from Step 2.)

- [ ] **Step 4: Verify**

Run: `npm test` (existing 30 pass) and `npx tsc --noEmit` (clean).

- [ ] **Step 5: Checkpoint** — review. Do NOT commit.

---

## Task 2: API expansion (`ScApi`) + probe

**Files:**
- Modify: `electron/sc/api.ts`

**Interfaces produced:**
```ts
// added to ScApi:
async search(q: string, limit?: number): Promise<{ tracks: Track[]; users: User[]; playlists: Playlist[] }>
async playlists(userId: number): Promise<Playlist[]>          // the user's own/liked playlists
async playlist(id: number): Promise<{ playlist: Playlist; tracks: Track[] } | null>
async feed(limit?: number): Promise<Track[]>                  // /stream, tracks only
async user(id: number): Promise<User | null>
async userTracks(id: number, limit?: number): Promise<Track[]>
```
Endpoint guesses (to be confirmed by the probe, mirroring Phase 1's likes fix):
- search: `/search?q=&limit=` (mixed `collection` with `kind`); split by `kind`.
- user playlists: `/users/{id}/playlists` or `/me/library/all?type=playlist`.
- playlist detail: `/playlists/{id}` (has `tracks[]`, some are stubs needing a
  `/tracks?ids=` hydrate).
- feed: `/stream?limit=` (collection of activities; each has `.track` or
  `.playlist`; take tracks).
- user: `/users/{id}`. user tracks: `/users/{id}/tracks`.

- [ ] **Step 1: Implement the methods in `electron/sc/api.ts`**

```ts
// (append to the ScApi class; reuse the private get() and normalizers)
async search(q: string, limit = 20): Promise<{ tracks: Track[]; users: User[]; playlists: Playlist[] }> {
  const data = (await this.get('/search', { q, limit })) as { collection?: unknown[] }
  const tracks: Track[] = []
  const users: User[] = []
  const playlists: Playlist[] = []
  for (const raw of Array.isArray(data.collection) ? data.collection : []) {
    const kind = (raw as Record<string, unknown>)?.kind
    if (kind === 'track') { const t = normalizeTrack(raw); if (t) tracks.push(t) }
    else if (kind === 'user') { const u = normalizeUser(raw); if (u) users.push(u) }
    else if (kind === 'playlist') { const p = normalizePlaylist(raw); if (p) playlists.push(p) }
  }
  return { tracks, users, playlists }
}

async playlists(userId: number): Promise<Playlist[]> {
  const data = (await this.get(`/users/${userId}/playlists`, { limit: 50 })) as { collection?: unknown[] }
  const out: Playlist[] = []
  for (const raw of Array.isArray(data.collection) ? data.collection : []) {
    const p = normalizePlaylist(raw); if (p) out.push(p)
  }
  return out
}

async playlist(id: number): Promise<{ playlist: Playlist; tracks: Track[] } | null> {
  const raw = (await this.get(`/playlists/${id}`)) as Record<string, unknown>
  const playlist = normalizePlaylist(raw)
  if (!playlist) return null
  const list = Array.isArray(raw.tracks) ? (raw.tracks as unknown[]) : []
  const tracks: Track[] = []
  for (const t of list) { const n = normalizeTrack(t); if (n) tracks.push(n) }
  return { playlist, tracks }
}

async feed(limit = 40): Promise<Track[]> {
  const data = (await this.get('/stream', { limit })) as { collection?: unknown[] }
  const out: Track[] = []
  for (const it of Array.isArray(data.collection) ? data.collection : []) {
    const t = normalizeTrack((it as Record<string, unknown>)?.track)
    if (t) out.push(t)
  }
  return out
}

async user(id: number): Promise<User | null> {
  return normalizeUser(await this.get(`/users/${id}`))
}

async userTracks(id: number, limit = 40): Promise<Track[]> {
  const data = (await this.get(`/users/${id}/tracks`, { limit })) as { collection?: unknown[] }
  const out: Track[] = []
  for (const raw of Array.isArray(data.collection) ? data.collection : []) {
    const t = normalizeTrack(raw); if (t) out.push(t)
  }
  return out
}
```
Add the imports at the top of `api.ts`: `normalizeUser, normalizePlaylist` (join
the existing `normalizeTrack` import).

- [ ] **Step 2: Type-check**

Run: `npx tsc --noEmit`
Expected: clean.

- [ ] **Step 3: Probe the endpoints (interactive)**

Temporarily extend the dev harness (`electron/devHarness.ts`) to call each new
method after login and `dlog` the counts + first item, e.g.:
```ts
const s = await api.search('lofi'); dlog('search', s.tracks.length, s.users.length, s.playlists.length)
const pls = await api.playlists(me.id); dlog('playlists', pls.length, pls[0]?.title)
if (pls[0]) { const pd = await api.playlist(pls[0].id); dlog('playlist detail', pd?.tracks.length) }
const fd = await api.feed(); dlog('feed', fd.length, fd[0]?.title)
const ut = await api.userTracks(me.id); dlog('userTracks', ut.length)
```
Run: `SC_DEV_HARNESS=1 env -u ELECTRON_RUN_AS_NODE npm run dev`; read
`%APPDATA%\soundcloud-desktop\soundtop-debug.log`. For any endpoint returning
404/empty, adjust the path/shape (as with the Phase 1 `/users/{id}/track_likes`
fix) until each returns data. Remove the temporary harness probe afterward.

- [ ] **Step 4: Checkpoint** — review. Do NOT commit.

---

## Task 3: IPC + preload for the new endpoints

**Files:**
- Modify: `electron/ipc.ts`, `electron/scIpc.ts`, `electron/preload.ts`, `src/vite-env.d.ts`

**Interfaces produced (added to `window.sc`):**
```ts
search(q: string): Promise<{ tracks: Track[]; users: User[]; playlists: Playlist[] }>
playlists(): Promise<Playlist[]>
playlist(id: number): Promise<{ playlist: Playlist; tracks: Track[] } | null>
feed(): Promise<Track[]>
user(id: number): Promise<User | null>
userTracks(id: number): Promise<Track[]>
```

- [ ] **Step 1: Add channels to `electron/ipc.ts`**

```ts
  SC_SEARCH: 'sc:search',
  SC_PLAYLISTS: 'sc:playlists',
  SC_PLAYLIST: 'sc:playlist',
  SC_FEED: 'sc:feed',
  SC_USER: 'sc:user',
  SC_USER_TRACKS: 'sc:userTracks',
```

- [ ] **Step 2: Handlers in `electron/scIpc.ts`**

Inside `registerScIpc`, add (reuse the cached `userId` from Phase 2; fetch `me`
if null for `playlists`):
```ts
ipcMain.handle(IPC.SC_SEARCH, (_e, q: string) => api.search(q))
ipcMain.handle(IPC.SC_PLAYLISTS, async () => {
  if (userId === null) { const me = await api.me(); userId = me ? me.id : null }
  return userId === null ? [] : api.playlists(userId)
})
ipcMain.handle(IPC.SC_PLAYLIST, (_e, id: number) => api.playlist(id))
ipcMain.handle(IPC.SC_FEED, () => api.feed())
ipcMain.handle(IPC.SC_USER, (_e, id: number) => api.user(id))
ipcMain.handle(IPC.SC_USER_TRACKS, (_e, id: number) => api.userTracks(id))
```

- [ ] **Step 3: Extend `window.sc` in `electron/preload.ts`**

```ts
  search: (q: string) => ipcRenderer.invoke(IPC.SC_SEARCH, q),
  playlists: () => ipcRenderer.invoke(IPC.SC_PLAYLISTS),
  playlist: (id: number) => ipcRenderer.invoke(IPC.SC_PLAYLIST, id),
  feed: () => ipcRenderer.invoke(IPC.SC_FEED),
  user: (id: number) => ipcRenderer.invoke(IPC.SC_USER, id),
  userTracks: (id: number) => ipcRenderer.invoke(IPC.SC_USER_TRACKS, id),
```

- [ ] **Step 4: Extend `ScBridge` in `src/vite-env.d.ts`** with the six signatures
(using `import('../electron/sc/types')` inline types as the existing entries do).

- [ ] **Step 5: Type-check**

Run: `npx tsc --noEmit`
Expected: clean.

- [ ] **Step 6: Checkpoint** — review. Do NOT commit.

---

## Task 4: Default to the frameless player window

**Files:**
- Modify: `electron/main.ts`

**Interfaces:** none new.

- [ ] **Step 1: Make the default path open the player window**

Extract the `SC_PLAYER` window-creation into the default path. In the
`app.whenReady().then(async () => { ... })` callback, after the `SC_DEV_HARNESS`
branch, REPLACE the remaining default body (`createWindow(); if (discordEnabled)
discord.start()`) with the player setup (the same code the `SC_PLAYER` branch
used), and make the window frameless:
```ts
  const tokenStore = new TokenStore(path.join(app.getPath('userData'), 'auth.bin'))
  const clientId = new ClientId()
  const authSession = new AuthSession(tokenStore, clientId)
  await authSession.ensureAuth()
  const scApi = new ScApi(authSession, clientId)
  registerScIpc(scApi, clientId, authSession)

  const win = new BrowserWindow({
    width: 1200,
    height: 800,
    minWidth: 720,
    minHeight: 520,
    frame: false,
    backgroundColor: '#0A0A0A',
    webPreferences: { preload: path.join(__dirname, 'preload.js') },
  })
  const base = VITE_DEV_SERVER_URL ?? `file://${path.join(RENDERER_DIST, 'index.html')}`
  win.loadURL(base)

  // Window controls for the custom title bar.
  ipcMain.on(IPC.WINDOW_MINIMIZE, () => win.minimize())
  ipcMain.on(IPC.WINDOW_MAXIMIZE, () => (win.isMaximized() ? win.unmaximize() : win.maximize()))
  ipcMain.on(IPC.WINDOW_CLOSE, () => win.close())
  ipcMain.handle(IPC.WINDOW_IS_MAXIMIZED, () => win.isMaximized())
```
Keep the old `SC_PLAYER` branch too (harmless) OR delete it (its logic is now the
default). Leave `createAppWindow`, tray, discord, mediaKeys imports/functions in
the file (dormant — Phase 4/5). If TypeScript flags them as unused, add a
`void createWindow` reference or leave them wired behind a disabled `if (false)`
is NOT allowed — instead simply keep the functions defined and unreferenced is
fine (they are top-level function declarations, not unused locals).

- [ ] **Step 2: Remove the now-duplicate window-control IPC** at module top if it
conflicts (the old `ipcMain.on(IPC.WINDOW_MINIMIZE, () => appWindow?...)`
handlers reference the embed `appWindow`; since two handlers on the same channel
both fire, delete the old embed window-control handlers to avoid double-invoke).

- [ ] **Step 3: Type-check + run**

Run: `npx tsc --noEmit`, then `env -u ELECTRON_RUN_AS_NODE npm run dev`.
Expected: the app opens frameless (no OS title bar/menu) and loads the renderer.
(The renderer still shows the Phase 2 UI until Task 5+ replace it.)

- [ ] **Step 4: Checkpoint** — review. Do NOT commit.

---

## Task 5: Router + AppShell + TitleBar

**Files:**
- Create: `src/router.tsx`, `src/ui/AppShell.tsx`, `src/ui/TitleBar.tsx`
- Modify: `src/App.tsx`

**Interfaces produced:**
- `AppShell` renders: `<TitleBar/>` (drag region + min/max/close via
  `window.windowControls`), `<Sidebar/>` (Task 6), `<Outlet/>` for routed views,
  `<PlayerBar/>` (Task 9). Grid layout: title bar row (fixed height), middle row
  (sidebar + content), player bar row (fixed height).

- [ ] **Step 1: `src/ui/TitleBar.tsx`** — frameless controls

```tsx
import { Minus, Square, X } from 'lucide-react'

export default function TitleBar() {
  return (
    <header
      className="h-9 shrink-0 flex items-center justify-between bg-[var(--bg-titlebar)] select-none"
      style={{ WebkitAppRegion: 'drag' } as React.CSSProperties}
    >
      <div className="px-4 text-xs font-semibold text-gray-300">SoundTOP</div>
      <div className="flex h-full" style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}>
        <button onClick={() => window.windowControls.minimize()} className="w-11 h-full grid place-items-center text-gray-400 hover:bg-white/10"><Minus size={16} /></button>
        <button onClick={() => window.windowControls.toggleMaximize()} className="w-11 h-full grid place-items-center text-gray-400 hover:bg-white/10"><Square size={13} /></button>
        <button onClick={() => window.windowControls.close()} className="w-11 h-full grid place-items-center text-gray-400 hover:bg-[#E81123] hover:text-white"><X size={16} /></button>
      </div>
    </header>
  )
}
```

- [ ] **Step 2: `src/ui/AppShell.tsx`**

```tsx
import { Outlet } from 'react-router-dom'
import TitleBar from './TitleBar'
import Sidebar from './Sidebar'
import PlayerBar from './PlayerBar'

export default function AppShell() {
  return (
    <div className="h-screen grid grid-rows-[auto_1fr_auto] bg-[var(--bg-app)] text-white overflow-hidden">
      <TitleBar />
      <div className="grid grid-cols-[auto_1fr] min-h-0">
        <Sidebar />
        <main className="min-w-0 overflow-y-auto">
          <Outlet />
        </main>
      </div>
      <PlayerBar />
    </div>
  )
}
```

- [ ] **Step 3: `src/router.tsx`**

```tsx
import { createHashRouter } from 'react-router-dom'
import AppShell from './ui/AppShell'
import LikesView from './ui/views/LikesView'
import SearchView from './ui/views/SearchView'
import PlaylistView from './ui/views/PlaylistView'
import FeedView from './ui/views/FeedView'
import ArtistView from './ui/views/ArtistView'

export const router = createHashRouter([
  {
    path: '/',
    element: <AppShell />,
    children: [
      { index: true, element: <LikesView /> },
      { path: 'search', element: <SearchView /> },
      { path: 'playlist/:id', element: <PlaylistView /> },
      { path: 'feed', element: <FeedView /> },
      { path: 'artist/:id', element: <ArtistView /> },
    ],
  },
])
```

- [ ] **Step 4: `src/App.tsx`**

```tsx
import { RouterProvider } from 'react-router-dom'
import { router } from './router'

export default function App() {
  return <RouterProvider router={router} />
}
```

- [ ] **Step 5: Type-check** — `npx tsc --noEmit` (will fail until Task 6–9 create
Sidebar/PlayerBar/views; create empty stubs if needed to compile incrementally,
then fill them). Note: to keep this task independently checkable, create minimal
stub components returning `null` for Sidebar, PlayerBar, and each view, replaced
in later tasks.

- [ ] **Step 6: Checkpoint** — review. Do NOT commit.

---

## Task 6: Sidebar (nav + playlists, collapsible)

**Files:** Create `src/ui/Sidebar.tsx`.

- [ ] **Step 1: Implement**

```tsx
import { useEffect, useState } from 'react'
import { NavLink } from 'react-router-dom'
import { Search, Rss, Heart } from 'lucide-react'
import type { Playlist } from '../../electron/sc/types'

export default function Sidebar() {
  const [playlists, setPlaylists] = useState<Playlist[]>([])
  useEffect(() => { window.sc.playlists().then(setPlaylists).catch(() => {}) }, [])

  const link = 'flex items-center gap-3 px-3 py-2 rounded text-sm text-gray-300 hover:text-white hover:bg-white/5'
  const active = ({ isActive }: { isActive: boolean }) =>
    `${link} ${isActive ? 'text-white bg-white/10' : ''}`

  return (
    <nav className="w-60 max-[900px]:w-16 shrink-0 bg-[var(--bg-panel)] flex flex-col gap-1 p-2 overflow-y-auto">
      <NavLink to="/search" className={active}><Search size={18} /><span className="max-[900px]:hidden">Buscar</span></NavLink>
      <NavLink to="/feed" className={active}><Rss size={18} /><span className="max-[900px]:hidden">Feed</span></NavLink>
      <NavLink to="/" end className={active}><Heart size={18} /><span className="max-[900px]:hidden">Curtidas</span></NavLink>
      <div className="mt-3 border-t border-white/10 pt-2 max-[900px]:hidden">
        <div className="px-3 pb-1 text-xs uppercase tracking-wide text-gray-500">Playlists</div>
        {playlists.map((p) => (
          <NavLink key={p.id} to={`/playlist/${p.id}`} className={active}>
            <img src={p.artworkUrl} className="w-6 h-6 rounded object-cover bg-white/5" />
            <span className="truncate">{p.title}</span>
          </NavLink>
        ))}
      </div>
    </nav>
  )
}
```

- [ ] **Step 2: Type-check** — `npx tsc --noEmit` clean (given other stubs exist).
- [ ] **Step 3: Checkpoint** — review. Do NOT commit.

---

## Task 7: Shared `TrackList` / `TrackRow`

**Files:** Create `src/ui/TrackList.tsx`, `src/ui/TrackRow.tsx`.

- [ ] **Step 1: `src/ui/TrackRow.tsx`**

```tsx
import type { Track } from '../../electron/sc/types'
import { usePlayer } from '../player/store'

function fmt(ms: number): string {
  const s = Math.floor(ms / 1000)
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`
}

export default function TrackRow({ tracks, index }: { tracks: Track[]; index: number }) {
  const t = tracks[index]
  const current = usePlayer((s) => s.current)
  const playQueue = usePlayer((s) => s.playQueue)
  const isCurrent = current?.id === t.id
  return (
    <div
      onDoubleClick={() => void playQueue(tracks, index)}
      onClick={() => void playQueue(tracks, index)}
      className={`group grid grid-cols-[2rem_2.5rem_1fr_auto] items-center gap-3 px-3 py-2 rounded hover:bg-white/10 cursor-pointer ${isCurrent ? 'text-[var(--accent)]' : 'text-white'}`}
    >
      <span className="text-sm text-gray-400 text-right">{index + 1}</span>
      <img src={t.artworkUrl} className="w-10 h-10 rounded object-cover bg-white/5" />
      <div className="min-w-0">
        <div className="text-sm truncate">{t.title}</div>
        <div className="text-xs text-gray-400 truncate">{t.artist}</div>
      </div>
      <span className="text-xs text-gray-400">{fmt(t.durationMs)}</span>
    </div>
  )
}
```

- [ ] **Step 2: `src/ui/TrackList.tsx`**

```tsx
import type { Track } from '../../electron/sc/types'
import TrackRow from './TrackRow'

export default function TrackList({ tracks }: { tracks: Track[] }) {
  if (tracks.length === 0) return <div className="p-6 text-gray-500 text-sm">Nada aqui ainda.</div>
  return (
    <div className="flex flex-col gap-0.5 p-2">
      {tracks.map((_, i) => (
        <TrackRow key={`${tracks[i].id}-${i}`} tracks={tracks} index={i} />
      ))}
    </div>
  )
}
```

- [ ] **Step 3: Type-check + checkpoint** — `npx tsc --noEmit` clean. Do NOT commit.

---

## Task 8: Views (Likes / Search / Playlist / Feed / Artist)

**Files:** Create `src/ui/views/{LikesView,SearchView,PlaylistView,FeedView,ArtistView}.tsx`.

- [ ] **Step 1: A small data hook** — create `src/ui/useAsync.ts`

```tsx
import { useEffect, useState } from 'react'

export function useAsync<T>(fn: () => Promise<T>, deps: unknown[]): { data: T | null; loading: boolean; error: string | null } {
  const [data, setData] = useState<T | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  useEffect(() => {
    let alive = true
    setLoading(true); setError(null)
    fn().then((d) => { if (alive) { setData(d); setLoading(false) } })
      .catch((e) => { if (alive) { setError(String(e)); setLoading(false) } })
    return () => { alive = false }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps)
  return { data, loading, error }
}
```

- [ ] **Step 2: `LikesView.tsx`**

```tsx
import { useAsync } from '../useAsync'
import TrackList from '../TrackList'

export default function LikesView() {
  const { data, loading } = useAsync(() => window.sc.likes(50), [])
  return (
    <section>
      <h1 className="px-4 pt-5 pb-2 text-2xl font-bold">Curtidas</h1>
      {loading ? <div className="p-6 text-gray-500 text-sm">Carregando…</div> : <TrackList tracks={data ?? []} />}
    </section>
  )
}
```

- [ ] **Step 3: `FeedView.tsx`** (same shape, `window.sc.feed()`, title "Feed").

```tsx
import { useAsync } from '../useAsync'
import TrackList from '../TrackList'

export default function FeedView() {
  const { data, loading } = useAsync(() => window.sc.feed(), [])
  return (
    <section>
      <h1 className="px-4 pt-5 pb-2 text-2xl font-bold">Feed</h1>
      {loading ? <div className="p-6 text-gray-500 text-sm">Carregando…</div> : <TrackList tracks={data ?? []} />}
    </section>
  )
}
```

- [ ] **Step 4: `SearchView.tsx`**

```tsx
import { useState } from 'react'
import { Link } from 'react-router-dom'
import TrackList from '../TrackList'
import type { Track, User, Playlist } from '../../../electron/sc/types'

export default function SearchView() {
  const [q, setQ] = useState('')
  const [res, setRes] = useState<{ tracks: Track[]; users: User[]; playlists: Playlist[] } | null>(null)
  const run = async (e: React.FormEvent) => {
    e.preventDefault()
    if (q.trim()) setRes(await window.sc.search(q.trim()))
  }
  return (
    <section className="flex flex-col">
      <form onSubmit={run} className="p-4">
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Buscar no SoundCloud…"
          className="w-full max-w-md px-4 py-2 rounded-full bg-white/10 text-white placeholder-gray-400 outline-none focus:bg-white/15"
        />
      </form>
      {res && (
        <>
          {res.users.length > 0 && (
            <div className="px-4 pb-2">
              <h2 className="text-lg font-bold mb-2">Artistas</h2>
              <div className="flex gap-4 flex-wrap">
                {res.users.map((u) => (
                  <Link key={u.id} to={`/artist/${u.id}`} className="w-28 text-center">
                    <img src={u.avatarUrl} className="w-24 h-24 rounded-full object-cover bg-white/5 mx-auto" />
                    <div className="text-sm truncate mt-1">{u.username}</div>
                  </Link>
                ))}
              </div>
            </div>
          )}
          <h2 className="text-lg font-bold px-4 pt-2">Faixas</h2>
          <TrackList tracks={res.tracks} />
        </>
      )}
    </section>
  )
}
```

- [ ] **Step 5: `PlaylistView.tsx`**

```tsx
import { useParams } from 'react-router-dom'
import { useAsync } from '../useAsync'
import TrackList from '../TrackList'

export default function PlaylistView() {
  const { id } = useParams()
  const { data, loading } = useAsync(() => window.sc.playlist(Number(id)), [id])
  return (
    <section>
      <h1 className="px-4 pt-5 pb-2 text-2xl font-bold">{data?.playlist.title ?? 'Playlist'}</h1>
      {loading ? <div className="p-6 text-gray-500 text-sm">Carregando…</div> : <TrackList tracks={data?.tracks ?? []} />}
    </section>
  )
}
```

- [ ] **Step 6: `ArtistView.tsx`**

```tsx
import { useParams } from 'react-router-dom'
import { useAsync } from '../useAsync'
import TrackList from '../TrackList'

export default function ArtistView() {
  const { id } = useParams()
  const user = useAsync(() => window.sc.user(Number(id)), [id])
  const tracks = useAsync(() => window.sc.userTracks(Number(id)), [id])
  return (
    <section>
      <div className="flex items-center gap-4 px-4 pt-5 pb-2">
        <img src={user.data?.avatarUrl} className="w-20 h-20 rounded-full object-cover bg-white/5" />
        <h1 className="text-2xl font-bold">{user.data?.username ?? 'Artista'}</h1>
      </div>
      {tracks.loading ? <div className="p-6 text-gray-500 text-sm">Carregando…</div> : <TrackList tracks={tracks.data ?? []} />}
    </section>
  )
}
```

- [ ] **Step 7: Type-check** — `npx tsc --noEmit` clean.
- [ ] **Step 8: Checkpoint** — review. Do NOT commit.

---

## Task 9: Full PlayerBar + store extensions

**Files:**
- Modify: `src/player/store.ts`
- Modify: `src/ui/PlayerBar.tsx`

**Interfaces produced (store additions):**
```ts
volume: number            // 0..1, default 1
setVolume: (v: number) => void
shuffle: boolean
toggleShuffle: () => void
cycleRepeat: () => void   // off -> all -> one -> off
```

- [ ] **Step 1: Extend `src/player/store.ts`**

Add to state defaults: `volume: 1, shuffle: false`. Add actions:
```ts
setVolume: (v) => { ensureEngine().setVolume(v); set({ volume: v }) },
toggleShuffle: () => {
  const { shuffle, queue } = get()
  if (!shuffle) set({ shuffle: true, queue: shuffled(queue.tracks, queue.index) })
  else set({ shuffle: false })
},
cycleRepeat: () => {
  const order: Repeat[] = ['off', 'all', 'one']
  set({ repeat: order[(order.indexOf(get().repeat) + 1) % order.length] })
},
```
Import `shuffled` from `./queue`. (This wires the previously-unused `shuffled`.)

- [ ] **Step 2: Rewrite `src/ui/PlayerBar.tsx`** with the full controls
(prev/play/next, shuffle, repeat, seek with live time, volume slider), using
lucide-react icons, `var(--accent)` for active states, responsive (hide the
volume/секondary controls under a width breakpoint with `max-[720px]:hidden`).
Use the store selectors `volume/setVolume/shuffle/toggleShuffle/repeat/cycleRepeat`
plus the Phase 2 `current/isPlaying/position/duration/toggle/next/previous/seek`.

```tsx
import { SkipBack, SkipForward, Play, Pause, Shuffle, Repeat, Repeat1, Volume2 } from 'lucide-react'
import { usePlayer } from '../player/store'

function fmt(sec: number): string {
  if (!Number.isFinite(sec)) return '0:00'
  return `${Math.floor(sec / 60)}:${String(Math.floor(sec % 60)).padStart(2, '0')}`
}

export default function PlayerBar() {
  const s = usePlayer()
  if (!s.current) return <footer className="h-20 shrink-0 bg-[var(--bg-titlebar)] border-t border-white/10" />
  return (
    <footer className="h-20 shrink-0 bg-[var(--bg-titlebar)] border-t border-white/10 grid grid-cols-[1fr_2fr_1fr] items-center px-4 gap-4">
      <div className="flex items-center gap-3 min-w-0">
        <img src={s.current.artworkUrl} className="w-12 h-12 rounded object-cover bg-white/5" />
        <div className="min-w-0">
          <div className="text-sm truncate">{s.current.title}</div>
          <div className="text-xs text-gray-400 truncate">{s.current.artist}</div>
        </div>
      </div>
      <div className="flex flex-col items-center gap-1">
        <div className="flex items-center gap-4">
          <button onClick={s.toggleShuffle} className={s.shuffle ? 'text-[var(--accent)]' : 'text-gray-400'}><Shuffle size={16} /></button>
          <button onClick={() => void s.previous()} className="text-gray-300"><SkipBack size={18} /></button>
          <button onClick={s.toggle} className="w-8 h-8 rounded-full bg-white text-black grid place-items-center">{s.isPlaying ? <Pause size={16} /> : <Play size={16} />}</button>
          <button onClick={() => void s.next()} className="text-gray-300"><SkipForward size={18} /></button>
          <button onClick={s.cycleRepeat} className={s.repeat !== 'off' ? 'text-[var(--accent)]' : 'text-gray-400'}>{s.repeat === 'one' ? <Repeat1 size={16} /> : <Repeat size={16} />}</button>
        </div>
        <div className="w-full flex items-center gap-2">
          <span className="text-xs text-gray-400 w-9 text-right">{fmt(s.position)}</span>
          <input type="range" min={0} max={s.duration || 0} value={s.position} onChange={(e) => s.seek(Number(e.target.value))} className="flex-1 accent-[var(--accent)]" />
          <span className="text-xs text-gray-400 w-9">{fmt(s.duration)}</span>
        </div>
      </div>
      <div className="flex items-center justify-end gap-2 max-[720px]:hidden">
        <Volume2 size={16} className="text-gray-400" />
        <input type="range" min={0} max={1} step={0.01} value={s.volume} onChange={(e) => s.setVolume(Number(e.target.value))} className="w-24 accent-[var(--accent)]" />
      </div>
    </footer>
  )
}
```

- [ ] **Step 3: Type-check + unit suite** — `npx tsc --noEmit && npm test` (30 pass).
- [ ] **Step 4: Checkpoint** — review. Do NOT commit.

---

## Task 10: Styling pass (frontend-design) + responsive verification

**Files:** Modify `src/index.css` + touch-ups across `src/ui/**` as needed.

- [ ] **Step 1: Apply the design system**

Using the tokens recorded in Task 1 (frontend-design), refine spacing, contrast,
hover/active, focus rings, empty/loading states, and the accent usage across the
shell, sidebar, rows, and player bar so it reads as an intentional Spotify-class
UI (not the placeholder). Keep it DRY (shared classes/tokens).

- [ ] **Step 2: Responsive check**

Run the app; resize from ~720px to maximized. Verify: sidebar collapses to icons
under 900px; content scrolls vertically only (no horizontal page scroll); player
bar secondary controls hide under 720px; nothing overlaps or clips.

- [ ] **Step 3: Full build**

Run: `npx tsc --noEmit && npm test && npx vite build`
Expected: all clean.

- [ ] **Step 4: Checkpoint** — review. Do NOT commit.

---

## Task 11: End-to-end verification (manual)

- [ ] **Step 1: Drive the app**

Run: `env -u ELECTRON_RUN_AS_NODE npm run dev`
Verify: frameless window; sidebar with playlists; Curtidas plays; Search returns
tracks/artists and plays; a playlist opens and plays; Feed lists tracks; clicking
an artist opens their page; player bar seek/volume/shuffle/repeat work; window
min/max/close work; responsive as above.

- [ ] **Step 2: If any view is empty/errors**, re-probe that endpoint (Task 2
Step 3 method) and adjust `api.ts`/`normalize.ts`. Remove any temp logging after.

- [ ] **Step 3: Checkpoint** — review. Do NOT commit.

---

## Self-Review Notes

- **Spec coverage (Phase 3 = build-order item 3):** frameless custom chrome →
  Tasks 4, 5; sidebar → Task 6; routed views (Likes/Search/Playlist/Feed/Artist)
  → Tasks 5, 8; shared track list → Task 7; full player bar (seek/volume/shuffle/
  repeat) → Task 9; API+IPC for the views → Tasks 2, 3; player mode as default →
  Task 4; responsive + orange accent + dark theme → Tasks 1, 6–10; styling via
  frontend-design → Tasks 1, 10. Discord/tray/media-key rewiring and embed removal
  are Phases 4–5 (explicitly out of scope).
- **Type consistency:** reuses `Track/User/Playlist` and `usePlayer`; new `ScApi`
  methods (Task 2) are consumed by `scIpc` (Task 3), `window.sc` (Task 3), and the
  views (Task 8); store additions (Task 9) consumed by PlayerBar (Task 9).
- **Fragility:** the new endpoints (Task 2) are the fragile SoundCloud-shape parts;
  Task 2 Step 3 and Task 11 Step 2 lock them to live behavior.
- **No git commits** — review checkpoints only.
