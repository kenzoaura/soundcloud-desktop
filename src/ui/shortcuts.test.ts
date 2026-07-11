import { describe, it, expect } from 'vitest'
import { shortcutAction } from './shortcuts'

describe('shortcutAction', () => {
  it('maps space to toggle', () => {
    expect(shortcutAction('Space', false)).toEqual({ type: 'toggle' })
  })
  it('arrows seek without ctrl and skip with ctrl', () => {
    expect(shortcutAction('ArrowRight', false)).toEqual({ type: 'seek', delta: 5 })
    expect(shortcutAction('ArrowLeft', false)).toEqual({ type: 'seek', delta: -5 })
    expect(shortcutAction('ArrowRight', true)).toEqual({ type: 'next' })
    expect(shortcutAction('ArrowLeft', true)).toEqual({ type: 'previous' })
  })
  it('up/down change volume', () => {
    expect(shortcutAction('ArrowUp', false)).toEqual({ type: 'volume', delta: 0.05 })
    expect(shortcutAction('ArrowDown', false)).toEqual({ type: 'volume', delta: -0.05 })
  })
  it('adds like and mute', () => {
    expect(shortcutAction('KeyL', false)).toEqual({ type: 'like' })
    expect(shortcutAction('KeyM', false)).toEqual({ type: 'mute' })
  })
  it('returns null for unmapped keys', () => {
    expect(shortcutAction('KeyZ', false)).toBeNull()
  })
})
