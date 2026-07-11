// Decision logic for recovering from playback failures, kept pure so it can be
// unit-tested without a DOM / hls.js instance. The audio engine and player store
// wire these decisions to the actual side effects.

export type HlsErrorAction = 'ignore' | 'restart-load' | 'recover-media' | 'give-up'

// hls.js `Hls.ErrorTypes` string values.
const NETWORK_ERROR = 'networkError'
const MEDIA_ERROR = 'mediaError'

// Non-fatal hls.js errors are self-healing, so ignore them. Fatal ones need an
// explicit recovery: reload the stream for network faults (until retries are
// exhausted), rebuild the media buffer once for media faults. If media recovery
// was already spent, network retries are exhausted, or the fault is anything
// else, the track is dead — give up so the store can skip it.
export function decideHlsError(
  fatal: boolean,
  type: string,
  mediaRecoveryUsed: boolean,
  networkRetriesExhausted = false,
): HlsErrorAction {
  if (!fatal) return 'ignore'
  if (type === NETWORK_ERROR) return networkRetriesExhausted ? 'give-up' : 'restart-load'
  if (type === MEDIA_ERROR) return mediaRecoveryUsed ? 'give-up' : 'recover-media'
  return 'give-up'
}

// After this many failed tracks in a row (no successful play between them), stop
// instead of skipping forever — otherwise an expired session would race through
// the whole queue silently.
export const MAX_CONSECUTIVE_FAILURES = 3

export function shouldStopAfterFailure(
  consecutive: number,
  max = MAX_CONSECUTIVE_FAILURES,
): boolean {
  return consecutive >= max
}
