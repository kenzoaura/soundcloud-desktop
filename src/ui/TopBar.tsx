import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ChevronLeft, ChevronRight, Search, Minus, Square, X } from 'lucide-react'
import Logo from './Logo'
import AccountChip from './AccountChip'
import { useT } from './strings'

const noDrag = { WebkitAppRegion: 'no-drag' } as React.CSSProperties

export default function TopBar() {
  const navigate = useNavigate()
  const t = useT()
  const [q, setQ] = useState('')

  const submit = (e: React.FormEvent) => {
    e.preventDefault()
    if (q.trim()) navigate(`/search?q=${encodeURIComponent(q.trim())}`)
  }

  return (
    <header
      className="h-14 shrink-0 flex items-center gap-3 pl-3 bg-[var(--bg-titlebar)] border-b border-[var(--border)]"
      style={{ WebkitAppRegion: 'drag' } as React.CSSProperties}
    >
      <div className="flex items-center gap-2 select-none" style={noDrag}>
        <Logo size={24} className="text-[var(--accent)]" />
        <span className="font-extrabold tracking-tight text-white max-[640px]:hidden">SoundCloud</span>
      </div>

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
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder={t('search.placeholder')}
              className="w-full pl-11 pr-4 py-2.5 rounded-full bg-white/10 border border-white/15 text-sm text-white placeholder-[var(--text-dim)] outline-none focus:bg-white/15 focus:border-[var(--accent)] transition-colors"
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
