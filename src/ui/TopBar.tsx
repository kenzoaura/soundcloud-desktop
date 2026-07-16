import { useEffect, useRef, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { ChevronLeft, ChevronRight, Search, Minus, Square, X } from 'lucide-react'
import Logo from './Logo'
import AccountChip from './AccountChip'
import { useT } from './strings'

const noDrag = { WebkitAppRegion: 'no-drag' } as React.CSSProperties

export default function TopBar() {
  const navigate = useNavigate()
  const t = useT()
  const [params] = useSearchParams()
  const urlQ = params.get('q') ?? ''
  const [q, setQ] = useState(urlQ)
  const inputRef = useRef<HTMLInputElement>(null)

  // Keep the box in sync when the URL query changes (e.g. navigating to /search).
  useEffect(() => {
    setQ(urlQ)
  }, [urlQ])

  // Ctrl+K (dispatched by the global shortcut handler) focuses + selects the box.
  useEffect(() => {
    const focus = () => {
      inputRef.current?.focus()
      inputRef.current?.select()
    }
    window.addEventListener('sc:focus-search', focus)
    return () => window.removeEventListener('sc:focus-search', focus)
  }, [])

  // Live search: debounce navigation as the user types (replace, so keystrokes
  // don't flood history). Only navigates when the text actually differs from the
  // URL, so syncing the box from the URL doesn't re-trigger a navigation.
  useEffect(() => {
    const trimmed = q.trim()
    if (trimmed === urlQ) return
    const id = setTimeout(() => {
      if (trimmed) navigate(`/search?q=${encodeURIComponent(trimmed)}`, { replace: true })
    }, 300)
    return () => clearTimeout(id)
  }, [q, urlQ, navigate])

  const submit = (e: React.FormEvent) => {
    e.preventDefault()
    if (q.trim()) navigate(`/search?q=${encodeURIComponent(q.trim())}`)
  }

  return (
    <header
      className="h-14 shrink-0 flex items-center gap-3 pl-3 bg-[var(--bg-titlebar)] border-b border-[var(--border)]"
      style={{ WebkitAppRegion: 'drag' } as React.CSSProperties}
    >
      <button
        onClick={() => navigate('/')}
        className="flex items-center gap-2 select-none rounded-md px-1.5 py-1 -ml-1 hover:bg-white/10 transition-colors"
        style={noDrag}
        aria-label="Início"
      >
        <Logo size={24} className="text-[var(--accent)]" />
        <span className="font-extrabold tracking-tight text-white max-[640px]:hidden">SoundCloud</span>
      </button>

      <div className="flex items-center gap-1.5" style={noDrag}>
        <button
          onClick={() => navigate(-1)}
          className="w-8 h-8 rounded-full bg-black/30 grid place-items-center text-gray-300 hover:text-white hover:bg-black/50 transition"
          aria-label="Voltar"
        >
          <ChevronLeft size={18} />
        </button>
        <button
          onClick={() => navigate(1)}
          className="w-8 h-8 rounded-full bg-black/30 grid place-items-center text-gray-300 hover:text-white hover:bg-black/50 transition"
          aria-label="Avançar"
        >
          <ChevronRight size={18} />
        </button>
      </div>

      {/* centered search */}
      <div className="flex-1 flex justify-center px-4">
        <form onSubmit={submit} className="w-full max-w-lg" style={noDrag}>
          <div className="relative">
            <Search size={17} className="absolute left-4 top-1/2 -translate-y-1/2 text-[var(--text-dim)]" />
            <input
              ref={inputRef}
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder={t('search.placeholder')}
              className="w-full pl-11 pr-4 py-2.5 rounded-full bg-white/[0.04] border border-white/10 text-sm text-white placeholder-[var(--text-dim)] outline-none focus:bg-white/[0.07] focus:border-[var(--accent)] transition-colors"
            />
          </div>
        </form>
      </div>

      <div className="flex items-center" style={noDrag}>
        <AccountChip />
      </div>

      <div className="flex h-full items-stretch" style={noDrag}>
        <button
          onClick={() => window.windowControls.minimize()}
          className="w-11 grid place-items-center text-gray-400 hover:bg-white/10 hover:text-white transition-colors"
          aria-label="Minimizar"
        >
          <Minus size={16} />
        </button>
        <button
          onClick={() => window.windowControls.toggleMaximize()}
          className="w-11 grid place-items-center text-gray-400 hover:bg-white/10 hover:text-white transition-colors"
          aria-label="Maximizar"
        >
          <Square size={12} />
        </button>
        <button
          onClick={() => window.windowControls.close()}
          className="w-11 grid place-items-center text-gray-400 hover:bg-[#E81123] hover:text-white transition-colors"
          aria-label="Fechar"
        >
          <X size={16} />
        </button>
      </div>
    </header>
  )
}
