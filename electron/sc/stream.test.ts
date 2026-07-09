import { describe, it, expect } from 'vitest'
import { pickTranscoding } from './stream'
import type { Track } from './types'

function track(transcodings: Track['transcodings']): Track {
  return {
    id: 1, title: 't', durationMs: 1000, permalink: '', artist: 'a', artistId: 2, transcodings,
  }
}

describe('pickTranscoding', () => {
  it('prefers progressive over hls', () => {
    const t = track([
      { url: 'h', protocol: 'hls', mimeType: 'audio/mpeg' },
      { url: 'p', protocol: 'progressive', mimeType: 'audio/mpeg' },
    ])
    expect(pickTranscoding(t)?.url).toBe('p')
  })
  it('falls back to hls when no progressive', () => {
    const t = track([{ url: 'h', protocol: 'hls', mimeType: 'audio/mpeg' }])
    expect(pickTranscoding(t)?.protocol).toBe('hls')
  })
  it('returns null when no transcodings', () => {
    expect(pickTranscoding(track([]))).toBeNull()
  })
})
