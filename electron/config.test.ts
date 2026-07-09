import { describe, it, expect } from 'vitest'
import { mergeUserConfig } from './config'

describe('mergeUserConfig', () => {
  it('returns empty object for non-object input', () => {
    expect(mergeUserConfig(undefined)).toEqual({})
    expect(mergeUserConfig('x')).toEqual({})
    expect(mergeUserConfig(null)).toEqual({})
  })

  it('keeps only valid non-empty string fields', () => {
    expect(
      mergeUserConfig({ discordClientId: '123', soundcloudUrl: 'https://x', extra: 'nope' }),
    ).toEqual({ discordClientId: '123', soundcloudUrl: 'https://x' })
  })

  it('drops empty / wrong-type fields and trims', () => {
    expect(mergeUserConfig({ discordClientId: '  456  ', soundcloudUrl: '' })).toEqual({
      discordClientId: '456',
    })
    expect(mergeUserConfig({ discordClientId: 789 })).toEqual({})
  })
})
