# SoundCloud Desktop — Design

Date: 2026-07-06
Status: Approved

## Goal

Desktop app for SoundCloud that is fully functional and reproducible (anyone
clones the repo and builds a working installer). Windows is the primary target.

## Approach

**Lightweight frame around the real SoundCloud web app.** Electron loads
`soundcloud.com` inside a `BrowserView` filling the window. Real login, full
catalog, real playback. No custom client, no API scraping. On top we add native
desktop features: custom title bar, media keys, System Media Transport Controls
(SMTC), tray, persisted window state, and Discord Rich Presence.

We do **not** replace SoundCloud's own UI (sidebar/player). The only injected
code is a **read-only observer** that reads `navigator.mediaSession.metadata` to
power Discord RPC and the tray tooltip. It never mutates the page DOM or layout,
and the app degrades gracefully if the observer returns nothing.

### Why this approach

- Robust: does not break when SoundCloud changes its DOM (only depends on the
  standard MediaSession API, which SoundCloud populates).
- Real content and playback with zero API-access risk.
- Reproducible: a plain Electron + electron-builder pipeline.

## Architecture

### Processes

- **Main** — window + persisted state, `BrowserView` (soundcloud.com), tray,
  global media shortcuts, Discord RPC client, IPC wiring. Split into modules.
- **BrowserView preload (observer)** — read-only reader of `mediaSession`
  metadata + playback state; sends `track:update` over IPC.
- **Renderer (React)** — thin: custom title bar + window control buttons only.

### Data flow

```
SoundCloud page → mediaSession → observer (preload) → IPC track:update → main
   main fans out → Discord RPC | tray tooltip | (SMTC handled natively by Chromium)
global media key → main → command into BrowserView (mediaSession action)
```

**SMTC / media keys:** Chromium in Electron already registers with Windows
Global Media Controls when a page uses the MediaSession API (SoundCloud does).
So the native media overlay and hardware media keys work largely out of the box.
`globalShortcut` is registered as a fallback for play/pause/next/prev.

## Modules

`electron/`
- `main.ts` — bootstrap: create window, mount BrowserView, wire services + IPC.
- `window.ts` — frameless BrowserWindow, manage BrowserView (resize with window),
  min/max/close handlers.
- `store.ts` — JSON persistence in `app.getPath('userData')`: window bounds,
  maximized flag, Discord on/off. No external dependency. Pure, testable.
- `tray.ts` — tray icon + menu (play/pause, show, quit); close hides to tray.
- `mediaKeys.ts` — register `globalShortcut` play/pause/next/prev; send command
  to the BrowserView.
- `track.ts` — receive `track:update`, hold current track, emit to consumers
  (discord, tray tooltip). Pure metadata parsing/merge logic is unit-testable.
- `discord.ts` — `discord-rpc` client, connect/reconnect, update presence with
  the current track. Silent no-op when Discord is not running.
- `observer.ts` — BrowserView preload. Reads mediaSession on change/interval,
  sends metadata. Read-only.

`src/` (renderer)
- `TitleBar.tsx` — custom title bar: title, min/max/close buttons, draggable
  region (`-webkit-app-region: drag`).
- `App.tsx` — mounts TitleBar only. Fixes the current `<Home />` bug (undefined
  reference).
- Remove `Sidebar.tsx`, `Player.tsx`, `Topbar.tsx` (static mockups).

## Error handling

- Discord not running → `discord.ts` no-ops and retries with backoff. Never
  crashes the app.
- Observer fails (SoundCloud changes behavior) → no metadata; app keeps working,
  site plays normally.
- Offline → SoundCloud shows its own error. No custom error screen.
- Corrupt persisted window state → fall back to defaults.

## Testing

- Unit (vitest) on pure modules: `store` (serialize/merge/defaults), `track`
  (parse/merge metadata).
- Electron UI is not auto-tested. README carries a manual smoke checklist:
  window opens, login works, playback, media keys, tray, RPC visible in Discord.

## Build / reproducibility

- Windows NSIS target via `electron-builder` (already configured).
  `npm install && npm run build` produces an installer.
- Discord `clientId` lives in a versioned config (public id, not a secret).
- README rewritten: prerequisites, dev (`npm run dev`), build, features, smoke
  checklist.

## Out of scope (YAGNI)

- macOS / Linux packaging (Windows-first; not blocked, just not targeted now).
- Custom SoundCloud client / API integration.
- Ad-blocking, download features, custom themes over the site.
