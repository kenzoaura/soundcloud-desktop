import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { useContextMenu } from './store'

export default function ContextMenu() {
  const { open, x, y, items, close } = useContextMenu()
  const ref = useRef<HTMLDivElement>(null)
  const [pos, setPos] = useState({ x, y })

  useEffect(() => setPos({ x, y }), [x, y])

  // Keep the menu inside the viewport.
  useLayoutEffect(() => {
    if (!open || !ref.current) return
    const r = ref.current.getBoundingClientRect()
    let nx = x
    let ny = y
    if (x + r.width > window.innerWidth) nx = window.innerWidth - r.width - 8
    if (y + r.height > window.innerHeight) ny = window.innerHeight - r.height - 8
    setPos({ x: nx, y: ny })
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
      style={{ left: pos.x, top: pos.y }}
      className="fixed z-[60] min-w-52 py-1 rounded-lg bg-[var(--bg-elevated)] border border-[var(--border)] shadow-2xl text-sm anim-pop origin-top-left"
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
