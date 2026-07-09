import { usePlayer } from './store'

// Wires the player store to the main process: pushes state out (throttled to
// ~1/sec so Discord/tray update without spamming) and applies commands coming
// from media keys / tray. Call once at app start.
export function initPlayerBridge(): void {
  const send = () => {
    const s = usePlayer.getState()
    if (!s.current) {
      window.player.reportProgress(null)
      return
    }
    window.player.reportProgress({
      title: s.current.title,
      artist: s.current.artist,
      artworkUrl: s.current.artworkUrl,
      url: s.current.permalink,
      durationSec: s.duration,
      positionSec: s.position,
      isPlaying: s.isPlaying,
    })
  }

  // Discord RPC is rate-limited (~5 SET_ACTIVITY / 20s ≈ 1 per 4s sustained).
  // Coalesce bursts (a manual skip fires track-change + position-jump events in
  // ~300ms) behind a leading+trailing throttle so we never exceed the limit and
  // the FINAL state (paused / new track) always lands. `send()` reads the latest
  // state at fire time.
  const MIN_INTERVAL = 1500
  let lastSent = 0
  let timer: ReturnType<typeof setTimeout> | null = null
  const flush = () => {
    timer = null
    lastSent = Date.now()
    send()
  }
  const schedule = () => {
    if (timer) return // a trailing flush is already queued; it will read latest state
    const elapsed = Date.now() - lastSent
    if (elapsed >= MIN_INTERVAL) flush()
    else timer = setTimeout(flush, MIN_INTERVAL - elapsed)
  }

  // Settle confirmation: 1.5s after the LAST change, always push the final state
  // again. Guarantees the settled track/state is correct even if an intermediate
  // update was dropped by Discord's rate limit during rapid switching.
  let settleTimer: ReturnType<typeof setTimeout> | null = null
  const scheduleSettle = () => {
    if (settleTimer) clearTimeout(settleTimer)
    settleTimer = setTimeout(() => {
      settleTimer = null
      flush()
    }, 1500)
  }

  usePlayer.subscribe((state, prev) => {
    const trackChanged = state.current?.id !== prev.current?.id
    const playChanged = state.isPlaying !== prev.isPlaying
    // A seek is a position jump on the SAME track (not the reset from a skip).
    const seeked = !trackChanged && Math.abs(state.position - prev.position) > 3
    // On a skip the first send has duration 0 (no timestamps → no bar); re-send
    // once the metadata arrives so Discord gets the start/end and draws the bar.
    const durationReady = prev.duration <= 0 && state.duration > 0
    if (trackChanged || playChanged || seeked || durationReady) {
      schedule()
      scheduleSettle()
    }
  })

  window.player.onCommand((cmd) => {
    const s = usePlayer.getState()
    if (cmd === 'toggle') s.toggle()
    else if (cmd === 'next') void s.next()
    else if (cmd === 'previous') void s.previous()
  })
}
