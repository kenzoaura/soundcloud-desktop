# SoundCloud Desktop (unofficial)

A custom desktop client for SoundCloud — a Spotify-style UI backed by SoundCloud's
internal API, with its own audio player, system tray, global media keys, and a
Discord "Listening to SoundCloud" Rich Presence (cover art + live progress bar).

## Features

- Log in with your real SoundCloud account (in-app login window; the session
  token is stored encrypted and never leaves the main process).
- Browse and play your **Likes**, **Playlists**, **Feed**, search any track /
  artist / playlist, and open **artist** pages.
- Own audio player: play/pause, next/previous, seek, volume, shuffle, repeat,
  queue. Progressive + HLS streams.
- Frameless custom window, collapsible sidebar, responsive from ~720px to 4K.
- System tray (current track + controls; close hides to tray) and global media
  keys (play/pause/next/previous).
- Discord Rich Presence: "Listening to SoundCloud" with cover art and a live
  progress bar (optional; silent if Discord isn't running).

## Requirements

- Node.js 18+
- Windows 10/11 (primary target)

## Development

    npm install
    npm run dev

> **Running under an Electron-based IDE/terminal:** if your shell inherits
> `ELECTRON_RUN_AS_NODE=1` (e.g. a VS Code integrated terminal), Electron
> launches as plain Node and no window appears. Start with it cleared:
> `env -u ELECTRON_RUN_AS_NODE npm run dev` (bash) or
> `Remove-Item Env:ELECTRON_RUN_AS_NODE; npm run dev` (PowerShell).
> Also close any installed build first — it holds a single-instance lock.

## Build (Windows installer)

    npm run build

The NSIS installer lands in `release/<version>/`, plus a ready-to-run unpacked
app at `release/<version>/win-unpacked/SoundCloud.exe`.

> **First build note:** electron-builder unpacks a `winCodeSign` cache with
> symlinks; the build config sets `signAndEditExecutable: false` so this is
> skipped and the build works without Windows Developer Mode / admin.

## Configuration

On first run the app writes `config.json` into its user-data folder and reads it
on every launch — edit it without rebuilding:

- Windows: `%APPDATA%\soundcloud-desktop\config.json`

```json
{ "discordClientId": "your-discord-app-id" }
```

- `discordClientId` — a Discord application id (create one at
  https://discord.com/developers/applications). Name the app "SoundCloud" and
  upload cover art if you like; the presence shows the track artwork by URL.
- To see the presence, keep Discord → Settings → **Activity Privacy → Share my
  activity** ON. A stray "Playing" line is Discord's own game auto-detection of
  the process — turn it off under **Registered Games** if it bothers you.

Compiled defaults live in `electron/config.ts` (used when `config.json` is
absent); changing those requires a rebuild.

## Architecture

- **Main (Node):** owns the OAuth token and the SoundCloud API v2 calls (no
  CORS), resolves stream URLs, and hosts the window, tray, media keys, and
  Discord presence. Modules under `electron/` (`auth/`, `sc/`, `discord`, `tray`,
  `mediaKeys`, `scIpc`).
- **Renderer (React):** the Spotify-style UI (`src/ui/`) + the audio engine and
  zustand player store (`src/player/`). Talks to main over IPC; the token never
  reaches it.

## Tests

    npm test

Unit tests cover the pure logic: API normalization, token/config sanitizers,
stream selection, the player queue, and the Discord activity builder.

## Manual smoke checklist

1. App opens frameless; log in on first run.
2. Likes list loads and plays; search / playlist / feed / artist all work.
3. Player: play/pause, seek, next/previous, volume, shuffle, repeat.
4. Tray shows the track + controls; closing the window hides to tray; Quit exits.
5. Media keys control playback.
6. Discord shows "Listening to SoundCloud" with art + progress bar.
