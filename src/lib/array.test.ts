import { describe, it, expect } from 'vitest'
import { moveItem } from './array'

describe('moveItem', () => {
  it('moves an element forward', () => {
    expect(moveItem(['a', 'b', 'c', 'd'], 0, 2)).toEqual(['b', 'c', 'a', 'd'])
  })
  it('moves an element backward', () => {
    expect(moveItem(['a', 'b', 'c', 'd'], 3, 1)).toEqual(['a', 'd', 'b', 'c'])
  })
  it('returns an unchanged copy for equal indices', () => {
    const input = ['a', 'b', 'c']
    const out = moveItem(input, 1, 1)
    expect(out).toEqual(['a', 'b', 'c'])
    expect(out).not.toBe(input)
  })
  it('returns an unchanged copy for out-of-range indices', () => {
    expect(moveItem(['a', 'b'], -1, 0)).toEqual(['a', 'b'])
    expect(moveItem(['a', 'b'], 0, 5)).toEqual(['a', 'b'])
  })
})
