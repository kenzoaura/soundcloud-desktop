import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { useContextMenu } from './store'

export default function ContextMenu() {
  const { open, x, y, items, close } = useContextMenu()
  const ref = useRef<HTMLDivElement>(null)
  const [pos, setPos] = useState({ x, y })
  // Grow the pop animation from the corner anchored at the cursor, so a menu
  // flipped near an edge doesn't appear to stretch from the opposite corner.
  const [origin, setOrigin] = useState('top left')

  // Position + flip happens in the layout effect below (before paint) so the
  // menu never flashes at the raw click point near an edge.
  useLayoutEffect(() => {
    if (!open || !ref.current) return
    // Use offset* (layout box), not getBoundingClientRect, so the pop-in scale
    // animation doesn't shrink the measured size and defeat the edge check.
    const w = ref.current.offsetWidth
    const h = ref.current.offsetHeight
    const flipX = x + w > window.innerWidth
    const flipY = y + h > window.innerHeight
    // Flip toward the cursor near an edge, then clamp so it's always on-screen.
    const nx = Math.min(Math.max(8, flipX ? x - w : x), window.innerWidth - w - 8)
    const ny = Math.min(Math.max(8, flipY ? y - h : y), window.innerHeight - h - 8)
    setPos({ x: nx, y: ny })
    setOrigin(`${flipY ? 'bottom' : 'top'} ${flipX ? 'right' : 'left'}`)
  }, [open, x, y])

  useEffect(() => {
    if (!open) return
    const onDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) close()
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') close()
    }
    window.addEventListener('mousedown', onDown)
    window.addEventListener('keydown', onKey)
    window.addEventListener('scroll', close, true)
    return () => {
      window.removeEventListener('mousedown', onDown)
      window.removeEventListener('keydown', onKey)
      window.removeEventListener('scroll', close, true)
    }
  }, [open, close])

  if (!open) return null
  return (
    <div
      ref={ref}
      style={{ left: pos.x, top: pos.y, transformOrigin: origin }}
      className="fixed z-[60] min-w-52 py-1 rounded-lg bg-[var(--bg-elevated)] border border-[var(--border)] shadow-2xl text-sm anim-pop"
    >
      {items.map((it, i) => (
        <button
          key={i}
          onClick={() => {
            it.onClick()
            close()
          }}
          className={`w-full text-left px-3 py-2 hover:bg-[var(--bg-hover)] ${
            it.danger ? 'text-[#ff6b6b]' : 'text-gray-200'
          }`}
        >
          {it.label}
        </button>
      ))}
    </div>
  )
}
