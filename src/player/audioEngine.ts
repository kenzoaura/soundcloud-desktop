import Hls from 'hls.js'

export interface AudioCallbacks {
  onTime: (positionSec: number, durationSec: number) => void
  onEnded: () => void
}

export class AudioEngine {
  private audio = new Audio()
  private hls: Hls | null = null

  constructor(cb: AudioCallbacks) {
    this.audio.addEventListener('timeupdate', () => {
      cb.onTime(this.audio.currentTime, this.audio.duration || 0)
    })
    this.audio.addEventListener('ended', () => cb.onEnded())
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
