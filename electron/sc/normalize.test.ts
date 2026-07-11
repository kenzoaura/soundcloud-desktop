import { describe, it, expect } from 'vitest'
import { bestArtwork, normalizeTrack, normalizeUser, normalizePlaylist } from './normalize'
import fixture from '../../test/fixtures/track_likes.sample.json'

describe('bestArtwork', () => {
  it('upgrades -large to -t500x500', () => {
    expect(bestArtwork('https://i1.sndcdn.com/artworks-abc-large.jpg')).toBe(
      'https://i1.sndcdn.com/artworks-abc-t500x500.jpg',
    )
  })
  it('falls back to avatar when artwork missing', () => {
    expect(bestArtwork(null, 'https://a/av-large.jpg')).toBe('https://a/av-t500x500.jpg')
  })
  it('returns undefined when nothing usable', () => {
    expect(bestArtwork(null, null)).toBeUndefined()
  })
})

const rawTrack = {
  id: 123,
  title: 'Song',
  duration: 185000,
  artwork_url: 'https://i1.sndcdn.com/artworks-x-large.jpg',
  permalink_url: 'https://soundcloud.com/artist/song',
  user: { id: 9, username: 'Artist', permalink_url: 'https://soundcloud.com/artist', avatar_url: null },
  media: {
    transcodings: [
      { url: 'https://api-v2/prog', format: { protocol: 'progressive', mime_type: 'audio/mpeg' } },
      { url: 'https://api-v2/hls', format: { protocol: 'hls', mime_type: 'audio/mpeg' } },
    ],
  },
}

describe('normalizeTrack', () => {
  it('returns null for non-track input', () => {
    expect(normalizeTrack(null)).toBeNull()
    expect(normalizeTrack({ id: 1 })).toBeNull() // no title
  })
  it('maps a full track', () => {
    const t = normalizeTrack(rawTrack)!
    expect(t.id).toBe(123)
    expect(t.title).toBe('Song')
    expect(t.durationMs).toBe(185000)
    expect(t.artworkUrl).toBe('https://i1.sndcdn.com/artworks-x-t500x500.jpg')
    expect(t.artist).toBe('Artist')
    expect(t.artistId).toBe(9)
    expect(t.transcodings).toHaveLength(2)
    expect(t.transcodings[0]).toEqual({
      url: 'https://api-v2/prog', protocol: 'progressive', mimeType: 'audio/mpeg',
    })
  })
})

describe('normalizeUser', () => {
  it('maps a user or returns null', () => {
    expect(normalizeUser({ id: 9, username: 'A', permalink_url: 'https://soundcloud.com/a' })).toMatchObject({
      id: 9, username: 'A', permalink: 'https://soundcloud.com/a', verified: false,
    })
    expect(normalizeUser({ id: 9 })).toBeNull()
  })
})

describe('normalizePlaylist', () => {
  it('maps a playlist', () => {
    const p = normalizePlaylist({
      id: 5, title: 'Mix', track_count: 12, artwork_url: null,
      user: { username: 'A' }, permalink_url: 'https://soundcloud.com/a/sets/mix',
    })!
    expect(p).toEqual({
      id: 5, title: 'Mix', artworkUrl: undefined, trackCount: 12, user: 'A',
      permalink: 'https://soundcloud.com/a/sets/mix',
    })
  })
})

describe('normalizePlaylist userId', () => {
  it('populates userId from the nested user', () => {
    const p = normalizePlaylist({ id: 5, title: 'Mix', user: { id: 99, username: 'kenzo' } })
    expect(p?.userId).toBe(99)
    expect(p?.user).toBe('kenzo')
  })
  it('leaves userId undefined when the user id is missing', () => {
    const p = normalizePlaylist({ id: 5, title: 'Mix', user: { username: 'kenzo' } })
    expect(p?.userId).toBeUndefined()
  })
})

describe('normalizeTrack against real fixture', () => {
  it('maps each collection item to a valid Track', () => {
    const items = (fixture as { collection: unknown[] }).collection
    expect(items.length).toBeGreaterThan(0)
    for (const it of items) {
      const track = (it as Record<string, unknown>).track ?? it
      const t = normalizeTrack(track)
      expect(t).not.toBeNull()
      expect(t!.title.length).toBeGreaterThan(0)
      expect(t!.durationMs).toBeGreaterThan(0)
      expect(t!.artist.length).toBeGreaterThan(0)
    }
  })
})
