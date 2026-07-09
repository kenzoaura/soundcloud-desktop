import fs from 'node:fs'

export interface WindowState {
  width: number
  height: number
  x?: number
  y?: number
  maximized: boolean
}

export interface PersistedState {
  window: WindowState
  discordEnabled: boolean
}

export const DEFAULT_STATE: PersistedState = {
  window: { width: 1200, height: 800, maximized: false },
  discordEnabled: true,
}

function num(v: unknown, fallback: number): number {
  return typeof v === 'number' && Number.isFinite(v) && v > 0 ? v : fallback
}

export function mergeState(loaded: unknown): PersistedState {
  if (!loaded || typeof loaded !== 'object') return { ...DEFAULT_STATE, window: { ...DEFAULT_STATE.window } }
  const src = loaded as Record<string, unknown>
  const w = (src.window && typeof src.window === 'object' ? src.window : {}) as Record<string, unknown>
  return {
    window: {
      width: num(w.width, DEFAULT_STATE.window.width),
      height: num(w.height, DEFAULT_STATE.window.height),
      x: typeof w.x === 'number' && Number.isFinite(w.x) ? w.x : undefined,
      y: typeof w.y === 'number' && Number.isFinite(w.y) ? w.y : undefined,
      maximized: w.maximized === true,
    },
    discordEnabled: src.discordEnabled === false ? false : DEFAULT_STATE.discordEnabled,
  }
}

export class Store {
  private state: PersistedState
  constructor(private filePath: string) {
    let raw: unknown
    try {
      raw = JSON.parse(fs.readFileSync(this.filePath, 'utf-8'))
    } catch {
      raw = undefined
    }
    this.state = mergeState(raw)
  }
  get(): PersistedState {
    return this.state
  }
  set(patch: Partial<PersistedState>): void {
    this.state = mergeState({ ...this.state, ...patch })
    try {
      fs.writeFileSync(this.filePath, JSON.stringify(this.state, null, 2))
    } catch {
      // best-effort; ignore write failures
    }
  }
}
