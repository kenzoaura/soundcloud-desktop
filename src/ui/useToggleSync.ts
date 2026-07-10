import { useEffect, useRef, useState } from 'react'

// Optimistic on/off toggle whose network write is debounced and coalesced:
// clicks flip the UI instantly, but only the final desired state is written
// (never more than one request in flight). Spam-clicking a like/repost button
// therefore fires at most one request instead of a burst of like/unlike calls
// that SoundCloud rate-limits into errors.
export function useToggleSync(
  initial: boolean,
  write: (next: boolean) => Promise<boolean>,
  opts: { delay?: number; onChange?: (on: boolean) => void; onFail?: () => void } = {},
) {
  const { delay = 500, onChange, onFail } = opts
  const [on, setOn] = useState(initial)
  const desired = useRef(initial)
  const server = useRef(initial)
  const inFlight = useRef(false)
  const timer = useRef<ReturnType<typeof setTimeout>>()

  // Adopt a new confirmed state when the source data (re)loads.
  useEffect(() => {
    setOn(initial)
    desired.current = initial
    server.current = initial
  }, [initial])

  const sync = async () => {
    if (inFlight.current || desired.current === server.current) return
    inFlight.current = true
    const target = desired.current
    const ok = await write(target).catch(() => false)
    inFlight.current = false
    if (ok) {
      server.current = target
    } else {
      // Revert UI to the last confirmed state and report the failure once.
      desired.current = server.current
      setOn(server.current)
      onChange?.(server.current)
      onFail?.()
      return
    }
    // The user may have toggled again while the request was in flight.
    if (desired.current !== server.current) void sync()
  }

  const toggle = () => {
    const next = !desired.current
    desired.current = next
    setOn(next)
    onChange?.(next)
    clearTimeout(timer.current)
    timer.current = setTimeout(() => void sync(), delay)
  }

  return { on, toggle }
}
