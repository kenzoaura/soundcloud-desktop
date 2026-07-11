export type ShortcutAction =
  | { type: 'toggle' }
  | { type: 'next' }
  | { type: 'previous' }
  | { type: 'seek'; delta: number }
  | { type: 'volume'; delta: number }
  | { type: 'like' }
  | { type: 'mute' }
  | null

// Pure mapping from a keyboard event's code (+ ctrl) to a player action, kept
// separate from the DOM handler so it can be unit-tested.
export function shortcutAction(code: string, ctrl: boolean): ShortcutAction {
  switch (code) {
    case 'Space':
      return { type: 'toggle' }
    case 'ArrowRight':
      return ctrl ? { type: 'next' } : { type: 'seek', delta: 5 }
    case 'ArrowLeft':
      return ctrl ? { type: 'previous' } : { type: 'seek', delta: -5 }
    case 'ArrowUp':
      return { type: 'volume', delta: 0.05 }
    case 'ArrowDown':
      return { type: 'volume', delta: -0.05 }
    case 'KeyL':
      return { type: 'like' }
    case 'KeyM':
      return { type: 'mute' }
    default:
      return null
  }
}
