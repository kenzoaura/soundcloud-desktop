import { describe, it, expect } from 'vitest'
import { mergeState, DEFAULT_STATE } from './store'

describe('mergeState', () => {
  it('returns defaults for undefined', () => {
    expect(mergeState(undefined)).toEqual(DEFAULT_STATE)
  })

  it('returns defaults for corrupt (non-object) input', () => {
    expect(mergeState('garbage')).toEqual(DEFAULT_STATE)
  })

  it('keeps valid window bounds and fills missing fields', () => {
    const r = mergeState({ window: { width: 800, height: 600, maximized: true } })
    expect(r.window.width).toBe(800)
    expect(r.window.height).toBe(600)
    expect(r.window.maximized).toBe(true)
    expect(r.discordEnabled).toBe(DEFAULT_STATE.discordEnabled)
  })

  it('rejects non-numeric bounds and falls back to default width', () => {
    const r = mergeState({ window: { width: 'x', height: -5, maximized: 'no' } })
    expect(r.window.width).toBe(DEFAULT_STATE.window.width)
    expect(r.window.height).toBe(DEFAULT_STATE.window.height)
    expect(r.window.maximized).toBe(false)
  })
})
