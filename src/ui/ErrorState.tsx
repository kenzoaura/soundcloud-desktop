import { AlertTriangle } from 'lucide-react'

export default function ErrorState({ message, onRetry }: { message?: string; onRetry?: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 py-20 text-center">
      <AlertTriangle className="text-[var(--text-muted)]" size={28} />
      <div className="text-sm text-[var(--text-dim)]">{message ?? 'Algo deu errado.'}</div>
      {onRetry && (
        <button
          onClick={onRetry}
          className="px-4 py-2 rounded-full bg-[var(--bg-hover)] text-white text-sm hover:bg-white/15"
        >
          Tentar de novo
        </button>
      )}
    </div>
  )
}
