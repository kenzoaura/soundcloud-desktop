import { describe, it, expect, beforeEach } from 'vitest'
import { useToasts } from './store'

beforeEach(() => useToasts.setState({ toasts: [] }))

describe('toast store', () => {
  it('push adds a toast with an id and kind', () => {
    useToasts.getState().push('hi')
    const t = useToasts.getState().toasts
    expect(t).toHaveLength(1)
    expect(t[0].message).toBe('hi')
    expect(t[0].kind).toBe('info')
  })
  it('dismiss removes by id', () => {
    useToasts.getState().push('a', 'error')
    const id = useToasts.getState().toasts[0].id
    useToasts.getState().dismiss(id)
    expect(useToasts.getState().toasts).toHaveLength(0)
  })
})
