import { describe, it, expect } from 'vitest'
import { buildActivity } from './rpcActivity'

const base = {
  title: 'Song',
  artist: 'Artist',
  artworkUrl: 'https://a/i.jpg',
  durationSec: 200,
  positionSec: 30,
}

describe('buildActivity', () => {
  it('maps title/artist/art and Listening type', () => {
    const a = buildActivity({ ...base, isPlaying: true }, 1_000_000)
    expect(a.type).toBe(2)
    expect(a.details).toBe('Song')
    expect(a.state).toBe('por Artist')
    expect(a.largeImageKey).toBe('https://a/i.jpg')
    expect(a.largeImageText).toBe('SoundCloud')
  })
  it('adds an Open-on-SoundCloud button when a url is present', () => {
    const a = buildActivity({ ...base, url: 'https://soundcloud.com/x/song', isPlaying: true }, 1_000_000)
    expect(a.buttons?.[0]).toEqual({ label: 'Ouvir no SoundCloud', url: 'https://soundcloud.com/x/song' })
  })
  it('omits buttons without a valid url', () => {
    const a = buildActivity({ ...base, isPlaying: true }, 1_000_000)
    expect(a.buttons).toBeUndefined()
  })
  it('sets start/end timestamps when playing (live bar)', () => {
    const now = 1_000_000
    const a = buildActivity({ ...base, isPlaying: true }, now)
    expect(a.startTimestamp).toBe(now - 30 * 1000)
    expect(a.endTimestamp).toBe(now - 30 * 1000 + 200 * 1000)
  })
  it('omits timestamps when paused', () => {
    const a = buildActivity({ ...base, isPlaying: false }, 1_000_000)
    expect(a.startTimestamp).toBeUndefined()
    expect(a.endTimestamp).toBeUndefined()
  })
  it('falls back to a non-empty state', () => {
    const a = buildActivity({ ...base, artist: '', isPlaying: true }, 1_000_000)
    expect(a.state.length).toBeGreaterThan(0)
  })
})
