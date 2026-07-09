// A stylized SoundCloud-style mark: waveform bars rising into a cloud lobe.
// Uses currentColor so callers set the color (SoundCloud orange).
export default function Logo({ size = 22, className = '' }: { size?: number; className?: string }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 32 24"
      fill="currentColor"
      className={className}
      aria-label="SoundCloud"
      role="img"
    >
      {/* waveform bars */}
      <rect x="1" y="14" width="2" height="7" rx="1" />
      <rect x="5" y="10" width="2" height="11" rx="1" />
      <rect x="9" y="6" width="2" height="15" rx="1" />
      <rect x="13" y="9" width="2" height="12" rx="1" />
      {/* cloud lobe */}
      <path d="M18 21h9a4 4 0 0 0 .3-7.98A6 6 0 0 0 16 12v9h2z" />
    </svg>
  )
}
