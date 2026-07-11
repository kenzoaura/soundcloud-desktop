import { describe, it, expect } from 'vitest'
import { parsePlaybackPrefs } from './prefs'

describe('parsePlaybackPrefs', () => {
  it('defaults when raw is null or garbage', () => {
    expect(parsePlaybackPrefs(null)).toEqual({ shuffle: false, repeat: 'off' })
    expect(parsePlaybackPrefs('not json')).toEqual({ shuffle: false, repeat: 'off' })
  })
  it('reads valid values', () => {
    expect(parsePlaybackPrefs('{"shuffle":true,"repeat":"all"}')).toEqual({ shuffle: true, repeat: 'all' })
    expect(parsePlaybackPrefs('{"shuffle":false,"repeat":"one"}')).toEqual({ shuffle: false, repeat: 'one' })
  })
  it('rejects an invalid repeat value', () => {
    expect(parsePlaybackPrefs('{"shuffle":true,"repeat":"weird"}')).toEqual({ shuffle: true, repeat: 'off' })
  })
})
