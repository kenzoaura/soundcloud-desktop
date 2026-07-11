import { useSettings } from '../settings/store'
import { usePlayer } from './store'

// Pure: given the current volume and the last non-zero volume, return the next
// (volume, lastNonZero) after toggling mute.
export function nextMuteState(
  volume: number,
  lastNonZero: number,
): { volume: number; lastNonZero: number } {
  if (volume > 0) return { volume: 0, lastNonZero: volume }
  return { volume: lastNonZero > 0 ? lastNonZero : 1, lastNonZero }
}

let lastNonZero = 1

// Shared mute toggle used by both the volume control and the M shortcut. Routes
// through useSettings.setVolume so the change persists like any volume change.
export function toggleMute(): void {
  const volume = usePlayer.getState().volume
  const nextState = nextMuteState(volume, lastNonZero)
  lastNonZero = nextState.lastNonZero
  useSettings.getState().setVolume(nextState.volume)
}
