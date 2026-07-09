import { useEffect } from 'react'
import { usePlayer } from '../player/store'

export function useKeyboardShortcuts(): void {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement | null
      if (el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.isContentEditable)) return
      const s = usePlayer.getState()
      switch (e.code) {
        case 'Space':
          e.preventDefault()
          s.toggle()
          break
        case 'ArrowRight':
          e.preventDefault()
          if (e.ctrlKey) void s.next()
          else s.seek(Math.min(s.duration || 0, s.position + 5))
          break
        case 'ArrowLeft':
          e.preventDefault()
          if (e.ctrlKey) void s.previous()
          else s.seek(Math.max(0, s.position - 5))
          break
        case 'ArrowUp':
          e.preventDefault()
          s.setVolume(Math.min(1, s.volume + 0.05))
          break
        case 'ArrowDown':
          e.preventDefault()
          s.setVolume(Math.max(0, s.volume - 0.05))
          break
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])
}
