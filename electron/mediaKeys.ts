import { globalShortcut } from 'electron'

export function registerMediaKeys(
  send: (cmd: 'toggle' | 'next' | 'previous') => void,
): () => void {
  globalShortcut.register('MediaPlayPause', () => send('toggle'))
  globalShortcut.register('MediaNextTrack', () => send('next'))
  globalShortcut.register('MediaPreviousTrack', () => send('previous'))
  return () => globalShortcut.unregisterAll()
}
