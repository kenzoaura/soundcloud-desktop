# SoundCloud Client — Polish / QOL Pass — Design

Date: 2026-07-07
Status: Approved
Builds on the finished client (Phases 1–5). Renderer-only; no main-process or API changes.

## Goal

Make the app feel finished and premium: loading skeletons instead of "Carregando…",
tasteful animations/micro-interactions (reduced-motion aware), an expanded
"Tocando agora" (now-playing) screen with a cover-derived gradient, and proper
empty/error states plus a toast system for transient feedback.

## Principles

- Renderer-only (`src/`); no changes to auth/API/IPC/main.
- Subtle and intentional motion — not "AI-generated" flashiness. **Respect
  `prefers-reduced-motion`**: every animation degrades to no-motion.
- Reuse the Phase 3 design tokens (`--bg-*`, `--accent`, `--text-*`), the
  `usePlayer` store, `useAsync`, and the existing views/components. DRY.

## 1. Feedback layer

### Skeletons
- `src/ui/Skeleton.tsx` — a shimmer block primitive (CSS gradient sweep,
  reduced-motion → static muted block).
- `src/ui/TrackListSkeleton.tsx` — N ghost rows matching `TrackRow` layout.
- Replace every `"Carregando…"` (Likes/Playlist/Feed/Artist/Search views) and the
  sidebar playlists load with the appropriate skeleton.

### Empty states
- `src/ui/EmptyState.tsx` — centered icon + title + optional subtitle/action.
- Used for: no likes yet, no search results for "X", empty playlist, empty feed.
  Replaces the generic "Nada aqui ainda."

### Error states + retry
- `useAsync` already returns `error`. Add a small `src/ui/ErrorState.tsx`
  (message + "Tentar de novo" button) and a `reload()` from `useAsync`
  (bump an internal counter to refetch). Views render ErrorState on `error`.

### Toasts
- `src/ui/toast/store.ts` — zustand store: `toasts[]`, `push(msg, kind?)`,
  auto-dismiss (~4s), `dismiss(id)`. `kind: 'info' | 'error'`.
- `src/ui/toast/Toaster.tsx` — stacked, bottom-right, above the player bar,
  fade/slide in-out (reduced-motion → instant). Mounted once in `AppShell`.
- Wire into the player store: `loadAndPlay` currently swallows a failed stream
  resolve; on failure push a toast "Faixa indisponível". A logout/network error
  can also toast. (The store imports the toast store's `push` directly.)

## 2. Motion

- `src/ui/useReducedMotion.ts` — hook reading `matchMedia('(prefers-reduced-motion: reduce)')`.
- **Route transition:** wrap the routed content in a fade+slide (~150ms) keyed on
  the pathname (`src/ui/ViewTransition.tsx` around `<Outlet/>`). Reduced-motion → none.
- **List stagger:** rows fade-in with a small per-index delay, capped (e.g. only
  the first ~15 rows animate; the rest appear instantly) to keep big lists snappy.
  Pure CSS (animation + inline `animationDelay`).
- **Play/pause morph:** the main play button scales briefly and cross-fades the
  Play/Pause icon.
- **Progress bar smoothing:** CSS transition on the fill so it glides between the
  ~1s position updates instead of stepping. Disabled during an active seek drag.
- **Micro-hovers:** consistent color/scale transitions on sidebar links and
  controls, driven by the tokens. No new dependency.

## 3. Now-playing + cover gradient

### Cover color
- `src/lib/color.ts`:
  - `quantizeDominant(pixels: Uint8ClampedArray): { r; g; b }` — **pure**, unit-tested
    (average / most-frequent bucket over sampled pixels, skipping near-transparent).
  - `getCoverColor(url: string): Promise<{ r; g; b } | null>` — load the image with
    `crossOrigin='anonymous'`, draw to a small (e.g. 24×24) canvas, read pixels,
    call `quantizeDominant`. On taint/CORS/load failure → `null`. Cache by URL.
  - Fallback when `null`: a neutral dark gradient (no crash, still looks good).
- Honest risk: `sndcdn` may not send CORS headers → canvas taints → we use the
  fallback. **Plan B (only if needed):** proxy the image bytes through main
  (`app:coverBytes` IPC → Node fetch → data URL) to bypass CORS. Not built unless
  the direct path fails in verification.

### Player bar
- Larger artwork; clicking the artwork/title toggles the Now-playing overlay.
- Subtle background tint from the current cover color, transitioning on track change.

### "Tocando agora" overlay
- `src/ui/NowPlaying.tsx` — a full-panel overlay (not a route) that slides up over
  the content, closes with an X button or `Esc`. Contains: large centered cover,
  large title/artist, full controls (seek + times, prev/play/next, shuffle,
  repeat, volume), on a background gradient built from the cover color (fallback
  gradient otherwise). Open state lives in a tiny UI store or `usePlayer`
  (`nowPlayingOpen` + toggle) so the player bar and Esc handler share it.

## Components / files

New: `Skeleton`, `TrackListSkeleton`, `EmptyState`, `ErrorState`,
`toast/{store,Toaster}`, `useReducedMotion`, `ViewTransition`, `NowPlaying`,
`lib/color.ts` (+ `color.test.ts`).
Modified: the five views (skeleton/empty/error), `useAsync` (reload), `Sidebar`
(playlist skeleton), `PlayerBar` (bigger art, open NP, tint), `TrackList`/`TrackRow`
(stagger, progress interplay), `AppShell` (Toaster + NowPlaying mount + view
transition), `player/store.ts` (toast on stream failure; `nowPlayingOpen`),
`index.css` (keyframes for shimmer/fade/slide, gated by reduced-motion).

## Testing

- Unit (vitest): `quantizeDominant` (pure color quantization over mock pixels);
  toast store (push/auto-dismiss/dismiss) if made pure; `useAsync` reload counter
  logic if extractable. Rest is visual — manual smoke checklist.
- Manual: skeletons show while loading; empty/error states render; toast on a
  known-unplayable track; route/list animations; reduced-motion kills motion;
  Now-playing opens/closes (X + Esc) with gradient (or fallback).

## Out of scope (YAGNI)

- Global app-wide gradient (only the Now-playing overlay + a subtle player-bar
  tint use the color).
- Queue/lyrics panels, equalizer, theming options.
- Any main-process/API/RPC changes.
