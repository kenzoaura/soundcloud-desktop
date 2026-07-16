import { useEffect } from 'react'
import { usePlayer } from '../player/store'
import { shortcutAction } from './shortcuts'
import { toggleMute } from '../player/mute'
import { toggleCurrentLike } from '../lib/likeActions'

export function useKeyboardShortcuts(): void {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const action = shortcutAction(e.code, e.ctrlKey)
      if (!action) return
      // Ctrl+K must work even while typing (including inside the search box).
      if (action.type === 'focus-search') {
        e.preventDefault()
        window.dispatchEvent(new CustomEvent('sc:focus-search'))
        return
      }
      const el = e.target as HTMLElement | null
      if (el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.isContentEditable)) return
      e.preventDefault()
      const s = usePlayer.getState()
      switch (action.type) {
        case 'toggle':
          s.toggle()
          break
        case 'next':
          void s.next()
          break
        case 'previous':
          void s.previous()
          break
        case 'seek':
          s.seek(Math.max(0, Math.min(s.duration || 0, s.position + action.delta)))
          break
        case 'volume':
          s.setVolume(Math.max(0, Math.min(1, s.volume + action.delta)))
          break
        case 'like':
          void toggleCurrentLike()
          break
        case 'mute':
          toggleMute()
          break
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])
}
