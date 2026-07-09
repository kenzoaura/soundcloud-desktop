import { describe, it, expect } from 'vitest'
import { currentTrack, nextIndex, prevIndex } from './queue'
import type { Track } from '../../electron/sc/types'

const mk = (id: number): Track => ({
  id, title: `t${id}`, durationMs: 1000, permalink: '', artist: 'a', artistId: 0, transcodings: [],
})
const q = (index: number) => ({ tracks: [mk(1), mk(2), mk(3)], index })

describe('currentTrack', () => {
  it('returns the track at index or null', () => {
    expect(currentTrack(q(1))?.id).toBe(2)
    expect(currentTrack({ tracks: [], index: 0 })).toBeNull()
  })
})

describe('nextIndex', () => {
  it('advances', () => {
    expect(nextIndex(q(0), 'off')).toBe(1)
  })
  it('stops at end when repeat off', () => {
    expect(nextIndex(q(2), 'off')).toBeNull()
  })
  it('wraps when repeat all', () => {
    expect(nextIndex(q(2), 'all')).toBe(0)
  })
  it('stays when repeat one', () => {
    expect(nextIndex(q(1), 'one')).toBe(1)
  })
})

describe('prevIndex', () => {
  it('goes back, clamped at 0', () => {
    expect(prevIndex(q(2))).toBe(1)
    expect(prevIndex(q(0))).toBe(0)
  })
})
