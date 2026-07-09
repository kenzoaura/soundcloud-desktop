export default function EmptyState({
  icon,
  title,
  subtitle,
}: {
  icon?: React.ReactNode
  title: string
  subtitle?: string
}) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 py-20 text-center">
      {icon && <div className="text-[var(--text-muted)]">{icon}</div>}
      <div className="text-lg font-semibold text-white">{title}</div>
      {subtitle && <div className="text-sm text-[var(--text-muted)] max-w-sm">{subtitle}</div>}
    </div>
  )
}
