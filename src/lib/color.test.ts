import { describe, it, expect } from 'vitest'
import { quantizeDominant, rgbToCss } from './color'

function px(...quads: number[]): Uint8ClampedArray {
  return new Uint8ClampedArray(quads)
}

describe('quantizeDominant', () => {
  it('returns the average of opaque pixels', () => {
    const c = quantizeDominant(px(255, 0, 0, 255, 255, 0, 0, 255))
    expect(c).toEqual({ r: 255, g: 0, b: 0 })
  })
  it('skips near-transparent pixels', () => {
    const c = quantizeDominant(px(0, 0, 0, 0, 10, 20, 30, 255))
    expect(c).toEqual({ r: 10, g: 20, b: 30 })
  })
  it('falls back to a neutral color when nothing opaque', () => {
    const c = quantizeDominant(px(0, 0, 0, 0))
    expect(c).toEqual({ r: 40, g: 40, b: 40 })
  })
})

describe('rgbToCss', () => {
  it('formats rgb and rgba', () => {
    expect(rgbToCss({ r: 1, g: 2, b: 3 })).toBe('rgb(1, 2, 3)')
    expect(rgbToCss({ r: 1, g: 2, b: 3 }, 0.5)).toBe('rgba(1, 2, 3, 0.5)')
  })
})
