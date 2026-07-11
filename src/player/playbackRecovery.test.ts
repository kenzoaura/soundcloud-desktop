import { describe, it, expect } from 'vitest'
import { decideHlsError, shouldStopAfterFailure, MAX_CONSECUTIVE_FAILURES } from './playbackRecovery'

describe('decideHlsError', () => {
  it('ignores non-fatal errors (hls.js recovers on its own)', () => {
    expect(decideHlsError(false, 'networkError', false)).toBe('ignore')
    expect(decideHlsError(false, 'mediaError', false)).toBe('ignore')
  })
  it('restarts loading on a fatal network error', () => {
    expect(decideHlsError(true, 'networkError', false)).toBe('restart-load')
  })
  it('recovers a fatal media error the first time', () => {
    expect(decideHlsError(true, 'mediaError', false)).toBe('recover-media')
  })
  it('gives up on a fatal media error after media recovery was already tried', () => {
    expect(decideHlsError(true, 'mediaError', true)).toBe('give-up')
  })
  it('gives up on any other fatal error', () => {
    expect(decideHlsError(true, 'otherError', false)).toBe('give-up')
  })
  it('restarts loading on a fatal network error until retries are exhausted', () => {
    expect(decideHlsError(true, 'networkError', false, false)).toBe('restart-load')
    expect(decideHlsError(true, 'networkError', false, true)).toBe('give-up')
  })
})

describe('shouldStopAfterFailure', () => {
  it('keeps skipping while under the limit', () => {
    expect(shouldStopAfterFailure(1)).toBe(false)
    expect(shouldStopAfterFailure(MAX_CONSECUTIVE_FAILURES - 1)).toBe(false)
  })
  it('stops once consecutive failures reach the limit', () => {
    expect(shouldStopAfterFailure(MAX_CONSECUTIVE_FAILURES)).toBe(true)
    expect(shouldStopAfterFailure(MAX_CONSECUTIVE_FAILURES + 1)).toBe(true)
  })
})
