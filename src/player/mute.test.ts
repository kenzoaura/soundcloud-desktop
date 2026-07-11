import { describe, it, expect } from 'vitest'
import { nextMuteState } from './mute'

describe('nextMuteState', () => {
  it('mutes and remembers the current volume', () => {
    expect(nextMuteState(0.7, 1)).toEqual({ volume: 0, lastNonZero: 0.7 })
  })
  it('unmutes back to the remembered volume', () => {
    expect(nextMuteState(0, 0.7)).toEqual({ volume: 0.7, lastNonZero: 0.7 })
  })
  it('unmutes to full when there is no remembered volume', () => {
    expect(nextMuteState(0, 0)).toEqual({ volume: 1, lastNonZero: 0 })
  })
})
