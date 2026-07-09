import { useEq, EQ_PRESETS, type EqPreset } from '../player/eq'

const BAND_LABELS = ['80', '250', '1k', '4k', '12k']

const PRESET_LABELS: [EqPreset, string][] = [
  ['flat', 'Flat'],
  ['bass', 'Graves'],
  ['treble', 'Agudos'],
  ['vocal', 'Vocal'],
  ['lofi', 'Lo-fi'],
  ['electronic', 'Eletrônica'],
]

function Toggle({ on, onChange }: { on: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      onClick={() => onChange(!on)}
      className={`w-11 h-6 rounded-full transition-colors relative shrink-0 ${on ? 'bg-[var(--accent)]' : 'bg-white/20'}`}
      role="switch"
      aria-checked={on}
    >
      <span className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white transition-transform ${on ? 'translate-x-5' : ''}`} />
    </button>
  )
}

export default function EqualizerPanel() {
  const enabled = useEq((s) => s.enabled)
  const gains = useEq((s) => s.gains)
  const preset = useEq((s) => s.preset)
  const setEnabled = useEq((s) => s.setEnabled)
  const setGain = useEq((s) => s.setGain)
  const applyPreset = useEq((s) => s.applyPreset)

  const pill = (active: boolean) =>
    `px-3 py-1.5 text-xs font-semibold rounded-full transition-colors ${
      active ? 'bg-white text-black' : 'text-[var(--text-dim)] hover:text-white bg-[var(--bg-hover)]'
    }`

  return (
    <div className="rounded-xl border border-[var(--border)] p-4">
      <div className="flex items-center justify-between mb-4">
        <div>
          <div className="text-sm text-white font-medium">Equalizer</div>
          <div className="text-xs text-[var(--text-muted)] mt-0.5">Ajuste o som em 5 bandas</div>
        </div>
        <Toggle on={enabled} onChange={setEnabled} />
      </div>

      {/* Presets */}
      <div className="flex flex-wrap gap-2 mb-5">
        {PRESET_LABELS.map(([key, label]) => (
          <button key={key} className={pill(preset === key)} onClick={() => applyPreset(key)} disabled={!enabled}>
            {label}
          </button>
        ))}
      </div>

      {/* Band sliders */}
      <div className={`flex justify-between gap-2 ${enabled ? '' : 'opacity-40 pointer-events-none'}`}>
        {gains.map((g, i) => (
          <div key={i} className="flex flex-col items-center gap-2 flex-1">
            <span className="text-[10px] tabular-nums text-[var(--text-dim)]">{g > 0 ? `+${g}` : g}</span>
            <input
              type="range"
              min={-15}
              max={15}
              step={1}
              value={g}
              onChange={(e) => setGain(i, Number(e.target.value))}
              className="accent-[var(--accent)] h-28"
              style={{ writingMode: 'vertical-lr', direction: 'rtl' } as React.CSSProperties}
              aria-label={`Banda ${BAND_LABELS[i]} Hz`}
            />
            <span className="text-[10px] text-[var(--text-muted)]">{BAND_LABELS[i]}</span>
          </div>
        ))}
      </div>
      <div className="flex justify-between text-[10px] text-[var(--text-muted)] mt-1 px-1">
        <span>Hz</span>
        <span>{EQ_PRESETS.flat.length}-band</span>
      </div>
    </div>
  )
}
