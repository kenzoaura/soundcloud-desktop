import { create } from 'zustand'
import type { Track } from '../../electron/sc/types'
import { AudioEngine } from './audioEngine'
import { currentTrack, nextIndex, prevIndex, shuffled, type Repeat, type QueueState } from './queue'
import { pushToast } from '../ui/toast/store'
import { addRecent } from './recents'
import { currentSettings } from '../settings/store'
import type { SavedSession } from './session'

interface PlayerState {
  queue: QueueState
  current: Track | null
  isPlaying: boolean
  position: number
  duration: number
  repeat: Repeat
  volume: number
  shuffle: boolean
  playQueue: (tracks: Track[], startIndex: number) => Promise<void>
  toggle: () => void
  next: () => Promise<void>
  previous: () => Promise<void>
  seek: (sec: number) => void
  setVolume: (v: number) => void
  toggleShuffle: () => void
  cycleRepeat: () => void
  nowPlayingOpen: boolean
  setNowPlaying: (open: boolean) => void
  enqueue: (track: Track) => void
  restore: (s: SavedSession) => void
  jumpTo: (index: number) => Promise<void>
  removeFromQueue: (index: number) => void
  clearQueue: () => void
  setEq: (gains: number[]) => void
}

// Perceived loudness is roughly logarithmic, so a linear slider feels like most
// of the change happens in the bottom half. Map the slider position (0..1) to an
// exponential audio gain so each part of the slider sounds proportional.
function perceptualGain(pos: number): number {
  const p = Math.max(0, Math.min(1, pos))
  return p * p
}

let engine: AudioEngine | null = null
// Monotonic token: guards against out-of-order stream resolution when the user
// switches tracks faster than streamUrl() resolves.
let loadToken = 0
// Which track the audio engine currently holds. null after a session restore,
// where we show the track but defer loading until the user presses play.
let loadedId: number | null = null
// Position to seek to on the next load (used to resume a restored session).
let pendingSeek: number | null = null
// Pre-resolved stream URL for the upcoming track, so advancing is instant.
let preloaded: { id: number; resolved: { url: string; protocol: 'progressive' | 'hls' } } | null = null

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

  // Resolve the upcoming track's stream URL ahead of time so a skip / natural
  // advance starts instantly instead of waiting on a round-trip.
  const prefetchNext = () => {
    const { queue, repeat } = get()
    const ni = nextIndex(queue, repeat)
    if (ni === null) return
    const nt = queue.tracks[ni]
    if (!nt || preloaded?.id === nt.id) return
    void window.sc
      .streamUrl(nt)
      .then((r) => {
        if (r) preloaded = { id: nt.id, resolved: r }
      })
      .catch(() => {})
  }

  const loadAndPlay = async (track: Track) => {
    const eng = ensureEngine()
    eng.setVolume(perceptualGain(get().volume))
    const myToken = ++loadToken
    // Show the new track immediately; reset both position and duration.
    set({ current: track, position: 0, duration: 0 })
    const resolved = preloaded?.id === track.id ? preloaded.resolved : await window.sc.streamUrl(track)
    preloaded = null
    if (myToken !== loadToken) return // a newer track was requested; abandon this
    if (!resolved) {
      set({ isPlaying: false })
      pushToast('Faixa indisponível', 'error')
      return
    }
    if (resolved.protocol === 'hls') eng.loadHls(resolved.url)
    else eng.loadProgressive(resolved.url)
    loadedId = track.id
    try {
      await eng.play()
      if (myToken !== loadToken) return
      if (pendingSeek != null && pendingSeek > 0) {
        eng.seek(pendingSeek)
        set({ position: pendingSeek })
      }
      pendingSeek = null
      set({ isPlaying: true })
      addRecent(track)
      prefetchNext()
      const st = currentSettings()
      if (st?.notifications && typeof Notification !== 'undefined') {
        try {
          new Notification(track.title, { body: track.artist, silent: true })
        } catch {
          // ignore
        }
      }
    } catch {
      // play() aborted by a newer load, or blocked — never crash playback.
    }
  }

  return {
    queue: { tracks: [], index: 0 },
    current: null,
    isPlaying: false,
    position: 0,
    duration: 0,
    repeat: 'off',
    volume: 1,
    shuffle: false,
    nowPlayingOpen: false,
    setNowPlaying: (open) => set({ nowPlayingOpen: open }),
    enqueue: (track) => {
      const { queue, current } = get()
      // If nothing is playing yet, start this track; otherwise append to the queue.
      if (!current) {
        void get().playQueue([track], 0)
        return
      }
      set({ queue: { ...queue, tracks: [...queue.tracks, track] } })
    },

    playQueue: async (tracks, startIndex) => {
      pendingSeek = null // explicit user action; don't resume a restored position
      set({ queue: { tracks, index: startIndex } })
      const t = currentTrack({ tracks, index: startIndex })
      if (t) await loadAndPlay(t)
    },
    toggle: () => {
      const { isPlaying, current } = get()
      if (isPlaying) {
        ensureEngine().pause()
        set({ isPlaying: false })
        return
      }
      // Session was restored but the engine hasn't loaded the track yet: load it
      // now (and resume the saved position via pendingSeek).
      if (current && loadedId !== current.id) {
        void loadAndPlay(current)
        return
      }
      ensureEngine()
        .play()
        .catch(() => {}) // ignore play() rejection (e.g. AbortError)
      set({ isPlaying: true })
    },
    next: async () => {
      const { queue, repeat } = get()
      const ni = nextIndex(queue, repeat)
      if (ni === null) {
        // Autoplay/radio: when the queue ends, keep going with related tracks.
        if (currentSettings()?.autoplay !== false && queue.tracks.length > 0) {
          const cur = get().current ?? currentTrack(queue)
          if (cur) {
            const related = await window.sc.trackRelated(cur.id).catch(() => [])
            const fresh = related.filter((r) => !queue.tracks.some((t) => t.id === r.id))
            if (fresh.length) {
              const nq = { tracks: [...queue.tracks, ...fresh], index: queue.tracks.length }
              set({ queue: nq })
              const t = currentTrack(nq)
              if (t) await loadAndPlay(t)
              return
            }
          }
        }
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
    setVolume: (v) => {
      const pos = Math.max(0, Math.min(1, v))
      ensureEngine().setVolume(perceptualGain(pos))
      set({ volume: pos })
    },
    toggleShuffle: () => {
      const { shuffle, queue } = get()
      if (!shuffle) set({ shuffle: true, queue: shuffled(queue.tracks, queue.index) })
      else set({ shuffle: false })
    },
    cycleRepeat: () => {
      const order: Repeat[] = ['off', 'all', 'one']
      set({ repeat: order[(order.indexOf(get().repeat) + 1) % order.length] })
    },
    restore: (s) => {
      loadedId = null // engine empty until the user presses play
      pendingSeek = s.position
      set({
        queue: { tracks: s.tracks, index: s.index },
        current: s.current,
        position: s.position,
        duration: s.duration,
        isPlaying: false,
      })
    },
    jumpTo: async (index) => {
      const { queue } = get()
      if (index < 0 || index >= queue.tracks.length) return
      const nq = { ...queue, index }
      set({ queue: nq })
      const t = currentTrack(nq)
      if (t) await loadAndPlay(t)
    },
    removeFromQueue: (index) => {
      const { queue } = get()
      if (index < 0 || index >= queue.tracks.length || index === queue.index) return
      const tracks = queue.tracks.filter((_, i) => i !== index)
      // Keep the current track pointed at the same item after the splice.
      const newIndex = index < queue.index ? queue.index - 1 : queue.index
      set({ queue: { tracks, index: newIndex } })
    },
    clearQueue: () => {
      const { queue } = get()
      // Keep the current track; drop everything queued after it.
      set({ queue: { tracks: queue.tracks.slice(0, queue.index + 1), index: queue.index } })
    },
    setEq: (gains) => {
      ensureEngine().setEq(gains)
    },
  }
})
