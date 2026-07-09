# SoundCloud Client — Polish / QOL Pass — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking. The final styling task additionally invokes **frontend-design:frontend-design**.

**Goal:** Make the finished client feel premium: loading skeletons, tasteful reduced-motion-aware animations, an expanded "Tocando agora" overlay with a cover-derived gradient, and proper empty/error states plus a toast system.

**Architecture:** Renderer-only (`src/`). Reuse the Phase 3 tokens, the `usePlayer` zustand store, `useAsync`, and existing views/components. Pure logic (color quantization, toast store) is unit-tested; visual work is verified live. No main-process/API/IPC changes.

**Tech Stack:** React 18, zustand, Tailwind 4, lucide-react, TypeScript, vitest. No new dependencies.

**Spec:** `docs/superpowers/specs/2026-07-07-soundcloud-polish-design.md`.

## Global Constraints

- **Renderer-only.** Do NOT touch `electron/**`, auth, API, IPC, or the build.
- **NO git commits or pushes.** Each task ends in a review checkpoint.
- **Respect `prefers-reduced-motion`:** every animation must degrade to no motion.
- **Reuse tokens** (`--bg-app/-panel/-titlebar/-elevated/-hover`, `--accent`,
  `--accent-hover`, `--text/-dim/-muted`, `--border`) and the existing
  `usePlayer` store (`current`, `isPlaying`, `position`, `duration`, `volume`,
  `repeat`, `shuffle`, `toggle`, `next`, `previous`, `seek`, `setVolume`,
  `toggleShuffle`, `cycleRepeat`, `playQueue`). No new npm dependencies.
- **Launch for live checks:** kill any running `SoundCloud.exe`/`electron` first,
  then `env -u ELECTRON_RUN_AS_NODE npm run dev`.

---

## File Structure

New:
- `src/ui/useReducedMotion.ts` — reduced-motion hook.
- `src/ui/Skeleton.tsx`, `src/ui/TrackListSkeleton.tsx` — loading placeholders.
- `src/ui/EmptyState.tsx`, `src/ui/ErrorState.tsx` — empty/error views.
- `src/ui/toast/store.ts`, `src/ui/toast/Toaster.tsx` — toasts.
- `src/ui/ViewTransition.tsx` — route transition wrapper.
- `src/lib/color.ts` + `src/lib/color.test.ts` — cover color extraction.
- `src/ui/NowPlaying.tsx` — expanded now-playing overlay.

Modified:
- `src/index.css` — keyframes (shimmer/fade/slide) gated by reduced-motion.
- `src/ui/useAsync.ts` — add `reload()`.
- `src/ui/views/{LikesView,FeedView,PlaylistView,ArtistView,SearchView}.tsx` — skeletons + empty/error.
- `src/ui/Sidebar.tsx` — playlists skeleton.
- `src/ui/TrackList.tsx` / `src/ui/TrackRow.tsx` — stagger + empty handled by caller.
- `src/ui/PlayerBar.tsx` — bigger art, open NowPlaying, play/pause morph, progress smoothing, tint.
- `src/ui/AppShell.tsx` — mount Toaster + NowPlaying + wrap Outlet in ViewTransition.
- `src/player/store.ts` — `nowPlayingOpen` + toggle; toast on stream failure; expose `coverColor` optional.

---

## Task 1: Motion foundation (reduced-motion + keyframes)

**Files:**
- Create: `src/ui/useReducedMotion.ts`
- Modify: `src/index.css`

**Interfaces produced:**
```ts
export function useReducedMotion(): boolean
```
CSS utility classes available after this task: `.sk-shimmer`, `.anim-fade-in`,
`.anim-slide-up`, all no-ops under `@media (prefers-reduced-motion: reduce)`.

- [ ] **Step 1: `src/ui/useReducedMotion.ts`**

```ts
import { useEffect, useState } from 'react'

export function useReducedMotion(): boolean {
  const [reduced, setReduced] = useState(
    () => typeof matchMedia !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches,
  )
  useEffect(() => {
    const mq = matchMedia('(prefers-reduced-motion: reduce)')
    const on = () => setReduced(mq.matches)
    mq.addEventListener('change', on)
    return () => mq.removeEventListener('change', on)
  }, [])
  return reduced
}
```

- [ ] **Step 2: Append keyframes to `src/index.css`**

```css
@keyframes sk-shimmer {
  0% { background-position: -200% 0; }
  100% { background-position: 200% 0; }
}
.sk-shimmer {
  background: linear-gradient(90deg, rgba(255,255,255,0.05) 25%, rgba(255,255,255,0.11) 37%, rgba(255,255,255,0.05) 63%);
  background-size: 200% 100%;
  animation: sk-shimmer 1.4s ease-in-out infinite;
}
@keyframes anim-fade-in { from { opacity: 0; } to { opacity: 1; } }
@keyframes anim-slide-up { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: none; } }
.anim-fade-in { animation: anim-fade-in 160ms ease-out both; }
.anim-slide-up { animation: anim-slide-up 200ms ease-out both; }

@media (prefers-reduced-motion: reduce) {
  .sk-shimmer { animation: none; }
  .anim-fade-in, .anim-slide-up { animation: none; }
}
```

- [ ] **Step 3: Type-check** — `npx tsc --noEmit` (clean).
- [ ] **Step 4: Checkpoint** — review. Do NOT commit.

---

## Task 2: Skeletons

**Files:**
- Create: `src/ui/Skeleton.tsx`, `src/ui/TrackListSkeleton.tsx`
- Modify: `src/ui/Sidebar.tsx`

**Interfaces produced:**
```ts
export function Skeleton(props: { className?: string }): JSX.Element
export default function TrackListSkeleton(props: { rows?: number }): JSX.Element
```

- [ ] **Step 1: `src/ui/Skeleton.tsx`**

```tsx
export function Skeleton({ className = '' }: { className?: string }) {
  return <div className={`sk-shimmer rounded ${className}`} />
}
```

- [ ] **Step 2: `src/ui/TrackListSkeleton.tsx`**

```tsx
import { Skeleton } from './Skeleton'

export default function TrackListSkeleton({ rows = 10 }: { rows?: number }) {
  return (
    <div className="flex flex-col gap-0.5 p-2">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="grid grid-cols-[1.75rem_2.75rem_1fr_auto] items-center gap-3 px-3 py-1.5">
          <Skeleton className="h-3 w-3 justify-self-end" />
          <Skeleton className="h-11 w-11" />
          <div className="flex flex-col gap-1.5">
            <Skeleton className="h-3 w-1/2" />
            <Skeleton className="h-2.5 w-1/3" />
          </div>
          <Skeleton className="h-3 w-8" />
        </div>
      ))}
    </div>
  )
}
```

- [ ] **Step 3: Sidebar playlists skeleton — modify `src/ui/Sidebar.tsx`**

Add a `loading` state (start `true`, set `false` in the `.then/.catch`) and render
skeleton rows while loading:
```tsx
// state
const [loading, setLoading] = useState(true)
useEffect(() => {
  window.sc.playlists().then(setPlaylists).catch(() => {}).finally(() => setLoading(false))
}, [])
// in the playlists section, when loading:
{loading
  ? Array.from({ length: 5 }).map((_, i) => (
      <div key={i} className="flex items-center gap-3 px-3 py-2">
        <Skeleton className="h-6 w-6" />
        <Skeleton className="h-3 flex-1 max-[900px]:hidden" />
      </div>
    ))
  : playlists.map((p) => ( /* existing NavLink */ ))}
```
Import `Skeleton`.

- [ ] **Step 4: Type-check** — `npx tsc --noEmit`.
- [ ] **Step 5: Checkpoint** — review. Do NOT commit.

---

## Task 3: Empty / Error states + `useAsync` reload

**Files:**
- Create: `src/ui/EmptyState.tsx`, `src/ui/ErrorState.tsx`
- Modify: `src/ui/useAsync.ts`

**Interfaces produced:**
```ts
export default function EmptyState(p: { icon?: React.ReactNode; title: string; subtitle?: string }): JSX.Element
export default function ErrorState(p: { message?: string; onRetry?: () => void }): JSX.Element
// useAsync now returns { data, loading, error, reload }
export function useAsync<T>(fn, deps): { data: T|null; loading: boolean; error: string|null; reload: () => void }
```

- [ ] **Step 1: `src/ui/EmptyState.tsx`**

```tsx
export default function EmptyState({ icon, title, subtitle }: { icon?: React.ReactNode; title: string; subtitle?: string }) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 py-20 text-center">
      {icon && <div className="text-[var(--text-muted)]">{icon}</div>}
      <div className="text-lg font-semibold text-white">{title}</div>
      {subtitle && <div className="text-sm text-[var(--text-muted)] max-w-sm">{subtitle}</div>}
    </div>
  )
}
```

- [ ] **Step 2: `src/ui/ErrorState.tsx`**

```tsx
import { AlertTriangle } from 'lucide-react'

export default function ErrorState({ message, onRetry }: { message?: string; onRetry?: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 py-20 text-center">
      <AlertTriangle className="text-[var(--text-muted)]" size={28} />
      <div className="text-sm text-[var(--text-dim)]">{message ?? 'Algo deu errado.'}</div>
      {onRetry && (
        <button onClick={onRetry} className="px-4 py-2 rounded-full bg-[var(--bg-hover)] text-white text-sm hover:bg-white/15">
          Tentar de novo
        </button>
      )}
    </div>
  )
}
```

- [ ] **Step 3: Add `reload` to `src/ui/useAsync.ts`**

Add a counter to deps and return `reload`:
```tsx
import { useEffect, useState } from 'react'

export function useAsync<T>(fn: () => Promise<T>, deps: unknown[]) {
  const [data, setData] = useState<T | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [nonce, setNonce] = useState(0)
  useEffect(() => {
    let alive = true
    setLoading(true)
    setError(null)
    fn()
      .then((d) => { if (alive) { setData(d); setLoading(false) } })
      .catch((e) => { if (alive) { setError(String(e)); setLoading(false) } })
    return () => { alive = false }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...deps, nonce])
  return { data, loading, error, reload: () => setNonce((n) => n + 1) }
}
```

- [ ] **Step 4: Type-check** — `npx tsc --noEmit`.
- [ ] **Step 5: Checkpoint** — review. Do NOT commit.

---

## Task 4: Toast system

**Files:**
- Create: `src/ui/toast/store.ts`, `src/ui/toast/Toaster.tsx`
- Test: `src/ui/toast/store.test.ts`
- Modify: `src/ui/AppShell.tsx`, `src/player/store.ts`

**Interfaces produced:**
```ts
// toast/store.ts
export interface Toast { id: number; message: string; kind: 'info' | 'error' }
export const useToasts: <zustand store> // { toasts: Toast[]; push(message, kind?): void; dismiss(id): void }
export function pushToast(message: string, kind?: 'info' | 'error'): void  // imperative helper for non-React callers
```

- [ ] **Step 1: Write the failing test — `src/ui/toast/store.test.ts`**

```ts
import { describe, it, expect, beforeEach } from 'vitest'
import { useToasts } from './store'

beforeEach(() => useToasts.setState({ toasts: [] }))

describe('toast store', () => {
  it('push adds a toast with an id and kind', () => {
    useToasts.getState().push('hi')
    const t = useToasts.getState().toasts
    expect(t).toHaveLength(1)
    expect(t[0].message).toBe('hi')
    expect(t[0].kind).toBe('info')
  })
  it('dismiss removes by id', () => {
    useToasts.getState().push('a', 'error')
    const id = useToasts.getState().toasts[0].id
    useToasts.getState().dismiss(id)
    expect(useToasts.getState().toasts).toHaveLength(0)
  })
})
```

- [ ] **Step 2: Run, confirm FAIL** — `npx vitest run src/ui/toast/store.test.ts`.

- [ ] **Step 3: `src/ui/toast/store.ts`**

```ts
import { create } from 'zustand'

export interface Toast {
  id: number
  message: string
  kind: 'info' | 'error'
}

interface ToastState {
  toasts: Toast[]
  push: (message: string, kind?: 'info' | 'error') => void
  dismiss: (id: number) => void
}

let seq = 1

export const useToasts = create<ToastState>((set) => ({
  toasts: [],
  push: (message, kind = 'info') => {
    const id = seq++
    set((s) => ({ toasts: [...s.toasts, { id, message, kind }] }))
    setTimeout(() => set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })), 4000)
  },
  dismiss: (id) => set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })),
}))

export function pushToast(message: string, kind: 'info' | 'error' = 'info'): void {
  useToasts.getState().push(message, kind)
}
```

- [ ] **Step 4: Run, confirm PASS** — `npx vitest run src/ui/toast/store.test.ts`.

- [ ] **Step 5: `src/ui/toast/Toaster.tsx`**

```tsx
import { X } from 'lucide-react'
import { useToasts } from './store'

export default function Toaster() {
  const toasts = useToasts((s) => s.toasts)
  const dismiss = useToasts((s) => s.dismiss)
  return (
    <div className="fixed right-4 bottom-24 z-50 flex flex-col gap-2 pointer-events-none">
      {toasts.map((t) => (
        <div
          key={t.id}
          className={`anim-slide-up pointer-events-auto flex items-center gap-3 px-4 py-2.5 rounded-lg shadow-xl text-sm text-white border ${
            t.kind === 'error' ? 'bg-[#2A1416] border-[#E8112340]' : 'bg-[var(--bg-elevated)] border-[var(--border)]'
          }`}
        >
          <span>{t.message}</span>
          <button onClick={() => dismiss(t.id)} className="text-[var(--text-muted)] hover:text-white">
            <X size={14} />
          </button>
        </div>
      ))}
    </div>
  )
}
```

- [ ] **Step 6: Mount in `src/ui/AppShell.tsx`**

Import `Toaster` and render it once, inside the root div (after `<PlayerBar/>`):
```tsx
      <PlayerBar />
      <Toaster />
```

- [ ] **Step 7: Toast on stream failure — modify `src/player/store.ts`**

Import `pushToast` and, in `loadAndPlay` where `resolved` is falsy, toast:
```ts
import { pushToast } from '../ui/toast/store'
// inside loadAndPlay, replace `if (!resolved) { set({ isPlaying: false }); return }`
if (!resolved) {
  set({ isPlaying: false })
  pushToast('Faixa indisponível', 'error')
  return
}
```

- [ ] **Step 8: Full suite** — `npx tsc --noEmit && npm test` (toast test passes).
- [ ] **Step 9: Checkpoint** — review. Do NOT commit.

---

## Task 5: Wire skeletons + empty/error into the views

**Files:** Modify `src/ui/views/{LikesView,FeedView,PlaylistView,ArtistView,SearchView}.tsx`.

**Interfaces:** consumes `TrackListSkeleton`, `EmptyState`, `ErrorState`, `useAsync` (with `reload`).

- [ ] **Step 1: LikesView**

```tsx
import { Heart } from 'lucide-react'
import { useAsync } from '../useAsync'
import TrackList from '../TrackList'
import TrackListSkeleton from '../TrackListSkeleton'
import EmptyState from '../EmptyState'
import ErrorState from '../ErrorState'

export default function LikesView() {
  const { data, loading, error, reload } = useAsync(() => window.sc.likes(50), [])
  return (
    <section className="p-4">
      <h1 className="px-2 pt-2 pb-3 text-3xl font-bold tracking-tight">Curtidas</h1>
      {loading ? (
        <TrackListSkeleton />
      ) : error ? (
        <ErrorState onRetry={reload} />
      ) : (data ?? []).length === 0 ? (
        <EmptyState icon={<Heart size={28} />} title="Sem curtidas ainda" subtitle="As faixas que você curtir no SoundCloud aparecem aqui." />
      ) : (
        <TrackList tracks={data ?? []} />
      )}
    </section>
  )
}
```

- [ ] **Step 2: FeedView** — same shape, `window.sc.feed()`, title "Feed", empty:
`icon={<Rss size={28} />} title="Feed vazio" subtitle="Novidades de quem você segue aparecem aqui."` (import `Rss`).

- [ ] **Step 3: PlaylistView** — replace the loading/`TrackList` block:
```tsx
  {loading ? (
    <TrackListSkeleton />
  ) : error ? (
    <ErrorState onRetry={reload} />
  ) : (
    <TrackList tracks={data?.tracks ?? []} />
  )}
```
(keep the existing header; destructure `error, reload` from `useAsync`.)

- [ ] **Step 4: ArtistView** — use `tracks.loading ? <TrackListSkeleton/> : tracks.error ? <ErrorState onRetry={tracks.reload}/> : <TrackList .../>`.

- [ ] **Step 5: SearchView** — when `res` is set and `res.tracks.length === 0 && res.users.length === 0`, show `<EmptyState icon={<Search size={28}/>} title={"Nada encontrado"} subtitle={`Sem resultados para "${q}"`} />`; keep the loading text as a `TrackListSkeleton` while searching.

- [ ] **Step 6: Type-check** — `npx tsc --noEmit`.
- [ ] **Step 7: Checkpoint** — review. Do NOT commit.

---

## Task 6: Motion — view transition, list stagger, play/pause morph, progress smoothing

**Files:**
- Create: `src/ui/ViewTransition.tsx`
- Modify: `src/ui/AppShell.tsx`, `src/ui/TrackRow.tsx`, `src/ui/PlayerBar.tsx`

- [ ] **Step 1: `src/ui/ViewTransition.tsx`**

```tsx
import { useLocation } from 'react-router-dom'
import { useReducedMotion } from './useReducedMotion'

export default function ViewTransition({ children }: { children: React.ReactNode }) {
  const location = useLocation()
  const reduced = useReducedMotion()
  return (
    <div key={location.pathname} className={reduced ? '' : 'anim-fade-in'}>
      {children}
    </div>
  )
}
```

- [ ] **Step 2: Wrap the Outlet in `src/ui/AppShell.tsx`**

```tsx
import { Outlet } from 'react-router-dom'
import ViewTransition from './ViewTransition'
// ...
        <main className="min-w-0 overflow-y-auto rounded-lg bg-[var(--bg-panel)]">
          <ViewTransition><Outlet /></ViewTransition>
        </main>
```

- [ ] **Step 3: List stagger — modify `src/ui/TrackRow.tsx`**

Add a subtle mount animation, capped to the first 15 rows (avoid delaying long lists):
```tsx
  // add to the row's outer div className and style:
  className={`... anim-slide-up ...`}
  style={index < 15 ? { animationDelay: `${index * 25}ms` } : undefined}
```
Under reduced-motion the `.anim-slide-up` keyframe is disabled by CSS, so no JS gate needed.

- [ ] **Step 4: Play/pause morph + progress smoothing — modify `src/ui/PlayerBar.tsx`**

- Add `transition` to the play button: `className="... transition-transform active:scale-95 ..."`.
- Smooth the progress fill: the seek `<input type=range>` value jumps ~1/s; wrap
  it so the visual fill uses a CSS transition. Simplest: add `className="... transition-[background] duration-1000 ease-linear"`? Range inputs don't
  transition their thumb. Instead render a custom track: keep the native input for
  interaction but overlay a `<div>` fill with `style={{ width }}` and
  `className="transition-[width] duration-1000 ease-linear"`, disabling the
  transition while dragging (`onMouseDown`/`onMouseUp` toggles a `dragging` state
  that removes the duration class). Provide the concrete markup:
```tsx
// progress area:
const [dragging, setDragging] = useState(false)
const pct = s.duration ? (s.position / s.duration) * 100 : 0
// ...
<div className="flex-1 relative h-1 group">
  <div className="absolute inset-0 rounded-full bg-white/15" />
  <div
    className={`absolute inset-y-0 left-0 rounded-full bg-[var(--accent)] ${dragging ? '' : 'transition-[width] duration-1000 ease-linear'}`}
    style={{ width: `${pct}%` }}
  />
  <input
    type="range" min={0} max={s.duration || 0} value={s.position}
    onMouseDown={() => setDragging(true)}
    onMouseUp={() => setDragging(false)}
    onChange={(e) => s.seek(Number(e.target.value))}
    className="absolute inset-0 w-full opacity-0 cursor-pointer"
  />
</div>
```

- [ ] **Step 5: Type-check + run** — `npx tsc --noEmit`, then live-check the app.
- [ ] **Step 6: Checkpoint** — review. Do NOT commit.

---

## Task 7: Cover color extraction (`lib/color.ts`) — TDD for the pure part

**Files:**
- Create: `src/lib/color.ts`, `src/lib/color.test.ts`

**Interfaces produced:**
```ts
export interface RGB { r: number; g: number; b: number }
export function quantizeDominant(pixels: Uint8ClampedArray): RGB   // pure
export function getCoverColor(url: string): Promise<RGB | null>    // canvas + cache
export function rgbToCss(c: RGB, alpha?: number): string
```

- [ ] **Step 1: Failing test — `src/lib/color.test.ts`**

```ts
import { describe, it, expect } from 'vitest'
import { quantizeDominant, rgbToCss } from './color'

// RGBA quads
function px(...quads: number[]): Uint8ClampedArray {
  return new Uint8ClampedArray(quads)
}

describe('quantizeDominant', () => {
  it('returns the average of opaque pixels', () => {
    const c = quantizeDominant(px(255, 0, 0, 255, 255, 0, 0, 255))
    expect(c).toEqual({ r: 255, g: 0, b: 0 })
  })
  it('skips near-transparent pixels', () => {
    const c = quantizeDominant(px(0, 0, 0, 0, 10, 20, 30, 255))
    expect(c).toEqual({ r: 10, g: 20, b: 30 })
  })
  it('falls back to a neutral color when nothing opaque', () => {
    const c = quantizeDominant(px(0, 0, 0, 0))
    expect(c).toEqual({ r: 40, g: 40, b: 40 })
  })
})

describe('rgbToCss', () => {
  it('formats rgb and rgba', () => {
    expect(rgbToCss({ r: 1, g: 2, b: 3 })).toBe('rgb(1, 2, 3)')
    expect(rgbToCss({ r: 1, g: 2, b: 3 }, 0.5)).toBe('rgba(1, 2, 3, 0.5)')
  })
})
```

- [ ] **Step 2: Run, confirm FAIL** — `npx vitest run src/lib/color.test.ts`.

- [ ] **Step 3: `src/lib/color.ts`**

```ts
export interface RGB { r: number; g: number; b: number }

export function quantizeDominant(pixels: Uint8ClampedArray): RGB {
  let r = 0, g = 0, b = 0, n = 0
  for (let i = 0; i + 3 < pixels.length; i += 4) {
    if (pixels[i + 3] < 200) continue // skip near-transparent
    r += pixels[i]; g += pixels[i + 1]; b += pixels[i + 2]; n++
  }
  if (n === 0) return { r: 40, g: 40, b: 40 }
  return { r: Math.round(r / n), g: Math.round(g / n), b: Math.round(b / n) }
}

export function rgbToCss(c: RGB, alpha?: number): string {
  return alpha === undefined ? `rgb(${c.r}, ${c.g}, ${c.b})` : `rgba(${c.r}, ${c.g}, ${c.b}, ${alpha})`
}

const cache = new Map<string, RGB | null>()

export function getCoverColor(url: string): Promise<RGB | null> {
  if (!url) return Promise.resolve(null)
  const hit = cache.get(url)
  if (hit !== undefined) return Promise.resolve(hit)
  return new Promise((resolve) => {
    const img = new Image()
    img.crossOrigin = 'anonymous'
    img.onload = () => {
      try {
        const canvas = document.createElement('canvas')
        canvas.width = 24; canvas.height = 24
        const ctx = canvas.getContext('2d')!
        ctx.drawImage(img, 0, 0, 24, 24)
        const data = ctx.getImageData(0, 0, 24, 24).data
        const c = quantizeDominant(data)
        cache.set(url, c)
        resolve(c)
      } catch {
        cache.set(url, null) // tainted (CORS) → fallback
        resolve(null)
      }
    }
    img.onerror = () => { cache.set(url, null); resolve(null) }
    img.src = url
  })
}
```

- [ ] **Step 4: Run, confirm PASS** — `npx vitest run src/lib/color.test.ts`.
- [ ] **Step 5: Full suite** — `npm test`.
- [ ] **Step 6: Checkpoint** — review. Do NOT commit.

---

## Task 8: Now-playing overlay + player-bar integration

**Files:**
- Create: `src/ui/NowPlaying.tsx`
- Modify: `src/player/store.ts` (add `nowPlayingOpen` + `setNowPlaying`), `src/ui/PlayerBar.tsx`, `src/ui/AppShell.tsx`

**Interfaces produced (store additions):**
```ts
nowPlayingOpen: boolean
setNowPlaying: (open: boolean) => void
```

- [ ] **Step 1: Add open-state to `src/player/store.ts`**

Add to the interface + defaults + actions:
```ts
  nowPlayingOpen: false,
  setNowPlaying: (open) => set({ nowPlayingOpen: open }),
```
(and the two lines in the `PlayerState` interface).

- [ ] **Step 2: Open from `src/ui/PlayerBar.tsx`**

Make the artwork + title clickable to open Now-playing, and enlarge the artwork:
```tsx
const setNowPlaying = usePlayer((s) => s.setNowPlaying)
// artwork/title wrapper:
<button onClick={() => setNowPlaying(true)} className="flex items-center gap-3 min-w-0 text-left">
  <img src={s.current.artworkUrl} className="w-14 h-14 rounded object-cover bg-white/5" />
  <div className="min-w-0"> ... title/artist ... </div>
</button>
```

- [ ] **Step 3: `src/ui/NowPlaying.tsx`**

```tsx
import { useEffect, useState } from 'react'
import { ChevronDown, SkipBack, SkipForward, Play, Pause, Shuffle, Repeat, Repeat1 } from 'lucide-react'
import { usePlayer } from '../player/store'
import { getCoverColor, rgbToCss, type RGB } from '../lib/color'

function fmt(sec: number): string {
  if (!Number.isFinite(sec)) return '0:00'
  return `${Math.floor(sec / 60)}:${String(Math.floor(sec % 60)).padStart(2, '0')}`
}

export default function NowPlaying() {
  const s = usePlayer()
  const open = usePlayer((st) => st.nowPlayingOpen)
  const setNowPlaying = usePlayer((st) => st.setNowPlaying)
  const [color, setColor] = useState<RGB | null>(null)

  useEffect(() => {
    if (!s.current?.artworkUrl) { setColor(null); return }
    getCoverColor(s.current.artworkUrl).then(setColor)
  }, [s.current?.artworkUrl])

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setNowPlaying(false) }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, setNowPlaying])

  if (!open || !s.current) return null
  const base = color ?? { r: 40, g: 40, b: 40 }
  const bg = `linear-gradient(180deg, ${rgbToCss(base, 0.55)} 0%, var(--bg-app) 70%)`

  return (
    <div className="anim-slide-up fixed inset-0 z-40 flex flex-col" style={{ background: bg, backgroundColor: 'var(--bg-app)' }}>
      <div className="h-9 flex items-center px-4">
        <button onClick={() => setNowPlaying(false)} className="text-gray-300 hover:text-white"><ChevronDown size={22} /></button>
      </div>
      <div className="flex-1 flex flex-col items-center justify-center gap-6 px-6 min-h-0">
        <img src={s.current.artworkUrl} className="w-72 h-72 max-h-[45vh] rounded-xl object-cover shadow-2xl bg-white/5" />
        <div className="text-center max-w-lg">
          <div className="text-2xl font-bold truncate">{s.current.title}</div>
          <div className="text-[var(--text-dim)] truncate">{s.current.artist}</div>
        </div>
        <div className="w-full max-w-xl flex items-center gap-2">
          <span className="text-xs text-[var(--text-muted)] w-10 text-right tabular-nums">{fmt(s.position)}</span>
          <input type="range" min={0} max={s.duration || 0} value={s.position} onChange={(e) => s.seek(Number(e.target.value))} className="flex-1 h-1 accent-[var(--accent)] cursor-pointer" />
          <span className="text-xs text-[var(--text-muted)] w-10 tabular-nums">{fmt(s.duration)}</span>
        </div>
        <div className="flex items-center gap-6">
          <button onClick={s.toggleShuffle} className={s.shuffle ? 'text-[var(--accent)]' : 'text-[var(--text-dim)] hover:text-white'}><Shuffle size={20} /></button>
          <button onClick={() => void s.previous()} className="text-gray-200 hover:text-white"><SkipBack size={26} fill="currentColor" /></button>
          <button onClick={s.toggle} className="w-14 h-14 rounded-full bg-white text-black grid place-items-center hover:scale-105 transition">
            {s.isPlaying ? <Pause size={24} fill="currentColor" /> : <Play size={24} fill="currentColor" />}
          </button>
          <button onClick={() => void s.next()} className="text-gray-200 hover:text-white"><SkipForward size={26} fill="currentColor" /></button>
          <button onClick={s.cycleRepeat} className={s.repeat !== 'off' ? 'text-[var(--accent)]' : 'text-[var(--text-dim)] hover:text-white'}>{s.repeat === 'one' ? <Repeat1 size={20} /> : <Repeat size={20} />}</button>
        </div>
      </div>
    </div>
  )
}
```

- [ ] **Step 4: Mount in `src/ui/AppShell.tsx`**

```tsx
import NowPlaying from './NowPlaying'
// after <Toaster />:
      <NowPlaying />
```

- [ ] **Step 5: Type-check + full suite** — `npx tsc --noEmit && npm test`.
- [ ] **Step 6: Checkpoint** — review. Do NOT commit.

---

## Task 9: frontend-design polish pass + live verification

**Files:** touch-ups across `src/ui/**`, `src/index.css`.

- [ ] **Step 1: Apply frontend-design**

Invoke **frontend-design:frontend-design**. Refine spacing/contrast/timing across
the new pieces (skeleton contrast, toast styling, Now-playing composition, the
cover-tint on the player bar) so it reads as one intentional system. Add a subtle
player-bar background tint from the current cover color (reuse `getCoverColor` +
`rgbToCss(color, 0.12)` behind the bar, transitioning on track change; fallback
none). Keep everything reduced-motion aware and DRY (shared classes/tokens).

- [ ] **Step 2: Verify the cover-gradient CORS path (live)**

Run the app, open Now-playing on a track. If the gradient shows the cover color →
done. If it's always the neutral fallback, `sndcdn` is tainting the canvas —
implement **Plan B**: add `app:coverBytes` IPC (main: `fetch(url)` → return a
base64 data URL) and have `getCoverColor` load that data URL (same-origin, no
taint). Only build Plan B if the direct path fails.

- [ ] **Step 3: Full smoke (live)**

`env -u ELECTRON_RUN_AS_NODE npm run dev` and verify: skeletons while loading;
empty state on an empty search; error+retry by going offline; toast on an
unplayable track; route/list/play-button/progress animations; `prefers-reduced-motion`
(temporarily force via devtools rendering) disables motion; Now-playing opens from
the player bar, closes with X and Esc, shows gradient (or fallback).

- [ ] **Step 4: Final checks** — `npx tsc --noEmit && npm test && npx vite build`.
- [ ] **Step 5: Checkpoint** — review. Do NOT commit.

---

## Self-Review Notes

- **Spec coverage:** skeletons → Tasks 2, 5; empty/error + retry → Tasks 3, 5;
  toasts + stream-failure wiring → Task 4; motion (reduced-motion, route, stagger,
  play/pause, progress) → Tasks 1, 6; cover color (pure + canvas + cache + fallback)
  → Task 7; Now-playing overlay + player-bar open/tint → Tasks 8, 9; frontend-design
  polish + CORS Plan B → Task 9.
- **Type consistency:** `useAsync` gains `reload` (Task 3) used by views (Task 5);
  `quantizeDominant`/`getCoverColor`/`rgbToCss`/`RGB` (Task 7) used by NowPlaying
  (Task 8) and the tint (Task 9); `nowPlayingOpen`/`setNowPlaying` (Task 8) used by
  PlayerBar + NowPlaying; `pushToast` (Task 4) used by the player store.
- **Renderer-only, no new deps, reduced-motion honored, no git commits.**
