import Hls from 'hls.js'

export interface AudioCallbacks {
  onTime: (positionSec: number, durationSec: number) => void
  onEnded: () => void
}

// 5-band graphic EQ centre frequencies (Hz).
export const EQ_BANDS = [80, 250, 1000, 4000, 12000]

export class AudioEngine {
  private audio = new Audio()
  private hls: Hls | null = null
  private ctx: AudioContext | null = null
  private filters: BiquadFilterNode[] = []
  private eqGains = [0, 0, 0, 0, 0]
  private graphBuilt = false

  constructor(cb: AudioCallbacks) {
    // Needed so the CDN stream can be routed through Web Audio (EQ) without the
    // graph being muted by cross-origin tainting.
    this.audio.crossOrigin = 'anonymous'
    this.audio.addEventListener('timeupdate', () => {
      cb.onTime(this.audio.currentTime, this.audio.duration || 0)
    })
    this.audio.addEventListener('ended', () => cb.onEnded())
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
    this.audio.src = url
  }

  loadHls(url: string): void {
    this.clearHls()
    if (Hls.isSupported()) {
      this.hls = new Hls()
      this.hls.loadSource(url)
      this.hls.attachMedia(this.audio)
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
    this.audio.pause()
    this.audio.src = ''
  }
}
