# SoundCloud Custom Client (Spotify-style) — Design

Date: 2026-07-07
Status: Approved
Supersedes the embed approach of `2026-07-06-soundcloud-desktop-design.md` for the UI.

## Goal

Replace the embedded soundcloud.com wrapper with a **custom desktop client** that
looks and feels like the Spotify app, backed by SoundCloud's internal API v2.
The user logs into their real SoundCloud account and browses/plays their library
(likes, playlists, feed) and any public track/playlist, with its own audio
player. Discord shows a Spotify-style "Listening to SoundCloud" Rich Presence
with cover art, title, artist, and a live progress bar. The app is shareable: a
friend installs it, logs in, and it works with no rebuild and no manual config.

## Naming

The product is named **"SoundCloud"** everywhere (productName, window title,
title-bar text, tray tooltip, Discord `largeImageText`, README, user-data
folder). This replaces all "SoundTOP" strings.

> Trademark note: "SoundCloud" is a registered trademark. Fine for personal use
> and sharing with a friend; do not publish to an app store under this name.

## Honest risk

SoundCloud's API v2 is internal and undocumented. `client_id`, stream
resolution, and HLS handling are the fragile parts — they break when SoundCloud
changes them. All such logic is isolated so it can be fixed in one place. Using
the internal API is a ToS gray area; this is a personal project.

## Architecture

### Processes

- **Main (Node)** — owns the API and the auth token. Calls
  `api-v2.soundcloud.com` (no CORS, attaches `Authorization`), extracts the
  `client_id`, stores the token encrypted, resolves stream URLs. Exposes data to
  the renderer via IPC. Also: window, tray, media keys, window-state, Discord RPC.
- **Renderer (React)** — the Spotify-style UI **and** the audio player (one
  `<audio>` element; hls.js when a track is HLS-only). Requests data from main
  over IPC; plays resolved stream URLs.
- **Login webview (hidden, first run only)** — loads the real
  `soundcloud.com/signin`. Main intercepts the `Authorization: OAuth <token>`
  header (and `client_id` query param) on `api-v2.soundcloud.com` requests to
  capture the token, then the webview closes.

### Data flow

```
login webview → capture OAuth token + client_id → main stores token (encrypted)
UI (renderer) → IPC → main → api-v2.soundcloud.com → data → UI
play: UI asks stream → main resolves transcoding (progressive/HLS) → URL → <audio>
player position → IPC → main → Discord RPC (Listening + live progress bar)
global media keys → IPC → player actions (toggle/next/prev)
```

Security: the token never leaves main. The renderer asks "give me my likes"; main
attaches the token and returns data. IPC exposes data, never the token.

### Reused from the current app

Electron shell, frameless window ([window.ts] adapted), title bar (restyled),
[tray.ts], [mediaKeys.ts] (now drives the player), [store.ts], [config.ts]
(runtime `config.json`), Discord module (rewritten for Listening). Removed: the
site `WebContentsView`, `observer.ts` (no more mediaSession reading), and the
temporary debug logging. Added: a login webview used only for auth.

## Components

### Auth (`electron/auth/`)
- `loginWindow.ts` — opens the login webview, listens on
  `session.webRequest.onBeforeSendHeaders` filtered to `api-v2.soundcloud.com`,
  captures `{ token, clientId }`, resolves and closes.
- `tokenStore.ts` — save/read/clear the token encrypted via Electron
  `safeStorage` in `<userData>/auth.bin`. Pure serialize/parse helper is unit-tested.
- Flow: no token → open login → capture → store → UI. On `401` from any API call,
  clear token and re-open login. Logout clears token + webview session cookies.

### SoundCloud API (`electron/sc/`)
- `clientId.ts` — resolve client_id in cascade: (1) captured at login, (2) fetch
  `soundcloud.com`, regex the JS bundle for `client_id:"..."`, (3) config
  fallback. Cached; re-extract on 401/403.
- `api.ts` — base `https://api-v2.soundcloud.com`, attaches `client_id` +
  `Authorization: OAuth <token>`. Endpoints for the MVP:
  - `GET /search?q=` — tracks/users/playlists
  - `GET /me` — profile
  - `GET /me/track_likes` (or `/me/library/all`) — liked tracks
  - `GET /me/playlists` — the user's playlists
  - `GET /stream` — the user's feed
  - `GET /tracks/{id}`, `/playlists/{id}`, `/users/{id}` — details
  - `GET /resolve?url=` — resolve a SoundCloud URL to an object
  - `GET <transcoding.url>?client_id=` — returns the real stream URL
  - Pagination via SoundCloud's `next_href` cursor.
- `normalize.ts` (pure, unit-tested) — raw SoundCloud JSON → lean app types
  `Track`, `User`, `Playlist` (id, title, user, artworkUrl, durationMs,
  permalink, transcodings). Artwork upgraded `-large` → `-t500x500`.
- IPC handlers (all `ipcMain.handle`, async, data-only): `sc:search`, `sc:me`,
  `sc:likes`, `sc:playlists`, `sc:playlist`, `sc:feed`, `sc:track`, `sc:user`,
  `sc:resolve`, `sc:streamUrl`.

### Playback (`src/player/`)
- `audioEngine.ts` — one `<audio>`. Progressive → `audio.src = url`. HLS →
  attach `hls.js`. Emits `timeupdate` (position), `ended`, `loadedmetadata`
  (duration). API: `load(track, streamUrl)`, `play`, `pause`, `seek`, `setVolume`.
- `store.ts` — **zustand** store: `queue`, `index`, `current`, `isPlaying`,
  `position`, `duration`, `volume`, `repeat`, `shuffle`. Actions: `playTrack`,
  `playQueue(tracks, startIndex)`, `next`, `previous`, `toggle`, `seek`,
  `setVolume`. Auto-advances on `ended` honoring repeat/shuffle. The
  queue/next/previous/shuffle/repeat logic is a pure module, unit-tested.
- Emits `player:progress` (position, duration, isPlaying, current track) over IPC
  to main for Discord.

### UI (`src/ui/`)
Frameless window, custom title bar on top, layout:

```
┌─────────────────────────────────────────────┐
│ [SoundCloud                     _  □  ✕ ]    │  title bar
├────────────┬────────────────────────────────┤
│ SIDEBAR    │  ROUTED VIEW                     │
│ Search     │                                 │
│ Feed       │                                 │
│ ── Library │                                 │
│ ♥ Likes    │                                 │
│ playlists… │                                 │
├────────────┴────────────────────────────────┤
│ cover title/artist ⏮⏯⏭  ▬▬●▬▬ 1:06/3:07 🔊 │  player bar
└─────────────────────────────────────────────┘
```

- Views: `SearchView`, `LikesView`, `PlaylistView`, `FeedView`, `ArtistView`.
- Components: `Sidebar`, `PlayerBar`, `TrackList`/`TrackRow`, `TitleBar` (reused).
- Navigation: `react-router-dom` HashRouter (works under `file://`), gives
  back/forward.
- Theme: Spotify-style dark, accent SoundCloud orange `#FF5500`. Tailwind.
- **Responsive:** flex/grid with relative units; sidebar collapses to icons on
  narrow widths; content areas scroll vertically (`overflow-y:auto`), never
  horizontal page scroll; player bar shrinks/reflows; card grids use
  `auto-fill`/`minmax`. Target ~800px up to 4K.
- The polished UI pass uses the frontend-design skill (implementation-time).

### Discord RPC (`electron/discord.ts`, rewritten)
- Use **`@xhayper/discord-rpc`** (maintained; supports `ActivityType.Listening`;
  the old `discord-rpc` only does "Playing").
- `setActivity`: `type: 2` (Listening → "Listening to SoundCloud"),
  `details: title`, `state: artist`, `largeImageKey: <cover URL>` (external URL
  asset shows the real cover), `startTimestamp = now − position`,
  `endTimestamp = start + duration` → Discord draws the live progress bar.
- Updates on: track change, play/pause, seek (recompute timestamps). Paused →
  clear timestamps. Position source: `player:progress` IPC (native, no DOM hack).
- Connect/retry/silent-fail behavior as today.

## Error handling

- API `401` → token dead → clear + reopen login.
- `403` / dead `client_id` → re-extract client_id, retry once.
- Track has no playable stream / region-locked → skip with a UI notice.
- HLS fails → try progressive; if none, mark the track errored.
- Offline → offline state in UI, never crash.
- Discord closed → RPC no-op (unchanged).

## Testing

- Unit (vitest) on pure modules: `normalize` (raw JSON → types), `tokenStore`
  (serialize/parse), player queue logic (next/prev/shuffle/repeat), RPC timestamp
  math.
- API / streaming / UI: not auto-tested; manual smoke checklist in README.

## Build / distribution

- `productName: "SoundCloud"`; runtime `config.json` already exists; installer
  already builds without Developer Mode (`signAndEditExecutable: false`).
- `client_id` and token are NOT compiled — client_id is extracted at runtime,
  token via login. A friend installs, logs in, and it works. Zero rebuild, zero
  manual config.
- The default `discordClientId` (bundled) makes RPC work for the friend with no
  setup; it appears as "SoundCloud".

## Build order (for the plan)

Vertical MVP, hard/fragile parts first:
1. Auth (login webview + token capture + encrypted store) + client_id + API
   client + IPC — provably fetch the user's likes as JSON.
2. Playback engine (stream resolution + `<audio>` + HLS + queue store) — play,
   seek, next/prev.
3. Spotify-style UI (shell + Search/Likes/Playlist/Feed/Artist + player bar),
   responsive.
4. Discord Listening RPC with live progress.
5. Rename SoundTOP → SoundCloud, migration cleanup (remove site view, observer,
   debug logs), README + smoke checklist.

## Out of scope (YAGNI, later versions)

- Upload, comments, reposts, messaging.
- Downloads / offline caching of audio.
- Multi-account.
- Playlist editing / liking from within the app (view + play first; write
  actions later).
