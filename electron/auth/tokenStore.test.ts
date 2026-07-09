import { describe, it, expect } from 'vitest'
import { isValidToken } from './tokenStore'

describe('isValidToken', () => {
  it('accepts a non-empty string', () => {
    expect(isValidToken('2-12345-abcdef')).toBe(true)
  })
  it('rejects empty / non-string', () => {
    expect(isValidToken('')).toBe(false)
    expect(isValidToken('   ')).toBe(false)
    expect(isValidToken(null)).toBe(false)
    expect(isValidToken(123)).toBe(false)
  })
})
