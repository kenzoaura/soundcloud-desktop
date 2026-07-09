import { X } from 'lucide-react'
import { useToasts } from './store'

export default function Toaster() {
  const toasts = useToasts((s) => s.toasts)
  const dismiss = useToasts((s) => s.dismiss)
  return (
    <div className="fixed right-4 bottom-24 z-50 flex flex-col gap-2 pointer-events-none">
      {toasts.map((t) => (
        <div
          key={t.id}
          className={`anim-slide-up pointer-events-auto flex items-center gap-3 px-4 py-2.5 rounded-lg shadow-xl text-sm text-white border ${
            t.kind === 'error'
              ? 'bg-[#2A1416] border-[#E8112340]'
              : 'bg-[var(--bg-elevated)] border-[var(--border)]'
          }`}
        >
          <span>{t.message}</span>
          <button onClick={() => dismiss(t.id)} className="text-[var(--text-muted)] hover:text-white">
            <X size={14} />
          </button>
        </div>
      ))}
    </div>
  )
}
