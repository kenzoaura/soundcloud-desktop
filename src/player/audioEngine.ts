import Hls from 'hls.js'
import { decideHlsError } from './playbackRecovery'

export interface AudioCallbacks {
  onTime: (positionSec: number, durationSec: number) => void
  onEnded: () => void
  // Playback died and could not recover (element error, fatal HLS fault, or a
  // stall that never cleared). The store skips the dead track from here.
  onError: () => void
}

// A stall (buffering with no progress) this long is treated as a dead stream —
// long enough to ride out a normal rebuffer, short enough not to look frozen.
const STALL_TIMEOUT_MS = 20000

// 5-band graphic EQ centre frequencies (Hz).
export const EQ_BANDS = [80, 250, 1000, 4000, 12000]

export class AudioEngine {
  private audio = new Audio()
  private hls: Hls | null = null
  private ctx: AudioContext | null = null
  private filters: BiquadFilterNode[] = []
  private eqGains = [0, 0, 0, 0, 0]
  private graphBuilt = false
  private cb: AudioCallbacks
  private stallTimer: ReturnType<typeof setTimeout> | null = null
  // Set to true once we hand off to onError so the follow-on `error`/`emptied`
  // events from tearing down the source don't fire a second skip.
  private failing = false

  constructor(cb: AudioCallbacks) {
    this.cb = cb
    // Needed so the CDN stream can be routed through Web Audio (EQ) without the
    // graph being muted by cross-origin tainting.
    this.audio.crossOrigin = 'anonymous'
    this.audio.addEventListener('timeupdate', () => {
      this.clearStall()
      cb.onTime(this.audio.currentTime, this.audio.duration || 0)
    })
    this.audio.addEventListener('playing', () => this.clearStall())
    this.audio.addEventListener('ended', () => {
      this.clearStall()
      cb.onEnded()
    })
    // A hard element error (network drop, unsupported/expired source) stops
    // playback silently otherwise. Ignore the spurious error from clearing the
    // source (empty src) and any error after we've already reported one.
    this.audio.addEventListener('error', () => {
      if (this.failing || !this.audio.src) return
      this.fail()
    })
    // Buffering with no progress: arm a watchdog, cleared by playing/timeupdate.
    this.audio.addEventListener('waiting', () => this.armStall())
  }

  private armStall(): void {
    if (this.stallTimer || this.failing) return
    this.stallTimer = setTimeout(() => {
      this.stallTimer = null
      this.fail()
    }, STALL_TIMEOUT_MS)
  }

  private clearStall(): void {
    if (this.stallTimer) {
      clearTimeout(this.stallTimer)
      this.stallTimer = null
    }
  }

  private fail(): void {
    if (this.failing) return
    this.failing = true
    this.clearStall()
    this.cb.onError()
  }

  // Lazily route the element through a BiquadFilter chain the first time we play.
  // MediaElementSource can only be created once per element, so this is guarded.
  private ensureGraph(): void {
    if (this.graphBuilt) return
    try {
      const Ctx = window.AudioContext
      if (!Ctx) return
      this.ctx = new Ctx()
      const source = this.ctx.createMediaElementSource(this.audio)
      let node: AudioNode = source
      this.filters = EQ_BANDS.map((freq, i) => {
        const b = this.ctx!.createBiquadFilter()
        b.type = i === 0 ? 'lowshelf' : i === EQ_BANDS.length - 1 ? 'highshelf' : 'peaking'
        b.frequency.value = freq
        // Wider peaks (low Q) so each band makes an audible tonal change.
        b.Q.value = 0.7
        b.gain.value = this.eqGains[i] ?? 0
        node.connect(b)
        node = b
        return b
      })
      node.connect(this.ctx.destination)
      this.graphBuilt = true
    } catch {
      // Web Audio unavailable or source already created — play normally.
    }
  }

  setEq(gains: number[]): void {
    this.eqGains = EQ_BANDS.map((_, i) => gains[i] ?? 0)
    this.filters.forEach((f, i) => {
      f.gain.value = this.eqGains[i] ?? 0
    })
  }

  private clearHls(): void {
    if (this.hls) {
      this.hls.destroy()
      this.hls = null
    }
  }

  loadProgressive(url: string): void {
    this.clearHls()
    this.failing = false
    this.clearStall()
    this.audio.src = url
  }

  loadHls(url: string): void {
    this.clearHls()
    this.failing = false
    this.clearStall()
    if (Hls.isSupported()) {
      const hls = new Hls()
      this.hls = hls
      // hls.js swallows stream faults into its own ERROR event instead of the
      // media element's; without this a fatal fault stalls playback forever.
      let mediaRecoveryUsed = false
      let networkRetries = 0
      const MAX_HLS_NETWORK_RETRIES = 3
      hls.on(Hls.Events.ERROR, (_evt, data) => {
        const action = decideHlsError(
          data.fatal,
          data.type,
          mediaRecoveryUsed,
          networkRetries >= MAX_HLS_NETWORK_RETRIES,
        )
        if (action === 'restart-load') {
          networkRetries += 1
          hls.startLoad()
        } else if (action === 'recover-media') {
          mediaRecoveryUsed = true
          hls.recoverMediaError()
        } else if (action === 'give-up') this.fail()
      })
      hls.loadSource(url)
      hls.attachMedia(this.audio)
    } else {
      // Safari-style native HLS fallback (unlikely in Electron/Chromium).
      this.audio.src = url
    }
  }

  play(): Promise<void> {
    this.ensureGraph()
    if (this.ctx?.state === 'suspended') void this.ctx.resume()
    return this.audio.play()
  }
  pause(): void {
    this.clearStall()
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
    this.clearStall()
    this.audio.pause()
    this.audio.src = ''
  }
}
