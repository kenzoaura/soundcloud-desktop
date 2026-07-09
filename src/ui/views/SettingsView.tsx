import { useSettings, type AppSettings } from '../../settings/store'
import EqualizerPanel from '../EqualizerPanel'
import { useT } from '../strings'
import { pushToast } from '../toast/store'
import { clearColorCache } from '../../lib/color'
import { clearWaveformCache } from '../Waveform'

const APP_VERSION = '0.1.0'

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

function Row({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-6 py-3 border-b border-[var(--border)]">
      <div className="min-w-0">
        <div className="text-sm text-white">{label}</div>
        {hint && <div className="text-xs text-[var(--text-muted)] mt-0.5">{hint}</div>}
      </div>
      <div className="shrink-0">{children}</div>
    </div>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="mb-8">
      <h2 className="eyebrow mb-1">{title}</h2>
      <div>{children}</div>
    </div>
  )
}

export default function SettingsView() {
  const s = useSettings((st) => st.settings)
  const update = useSettings((st) => st.update)
  const t = useT()
  if (!s) return <div className="p-6 text-sm text-[var(--text-muted)]">{t('common.loading')}</div>

  const set = <K extends keyof AppSettings>(k: K, v: AppSettings[K]) => void update({ [k]: v } as Partial<AppSettings>)

  return (
    <section className="p-6 max-w-2xl">
      <h1 className="display text-3xl mb-6">{t('set.title')}</h1>

      <Section title={t('set.appearance')}>
        <Row label={t('set.zoom')}>
          <div className="flex items-center gap-3">
            <button
              onClick={() => set('zoom', Math.max(0.8, Math.round((s.zoom - 0.1) * 10) / 10))}
              className="w-8 h-8 rounded-full bg-[var(--bg-hover)] grid place-items-center text-lg leading-none hover:bg-white/15 disabled:opacity-40"
              disabled={s.zoom <= 0.8}
              aria-label="Diminuir zoom"
            >
              −
            </button>
            <span className="w-12 text-center text-sm tabular-nums">{Math.round(s.zoom * 100)}%</span>
            <button
              onClick={() => set('zoom', Math.min(1.4, Math.round((s.zoom + 0.1) * 10) / 10))}
              className="w-8 h-8 rounded-full bg-[var(--bg-hover)] grid place-items-center text-lg leading-none hover:bg-white/15 disabled:opacity-40"
              disabled={s.zoom >= 1.4}
              aria-label="Aumentar zoom"
            >
              +
            </button>
          </div>
        </Row>
        <Row label={t('set.language')}>
          <select value={s.language} onChange={(e) => set('language', e.target.value as 'pt' | 'en')} className="bg-[var(--bg-elevated)] rounded-md px-3 py-1.5 text-sm outline-none">
            <option value="pt">Português</option>
            <option value="en">English</option>
          </select>
        </Row>
        <Row label={t('set.reduceMotion')}>
          <Toggle on={s.reduceMotion} onChange={(v) => set('reduceMotion', v)} />
        </Row>
      </Section>

      <Section title={t('set.playback')}>
        <Row label={t('set.streamPref')}>
          <select value={s.streamPref} onChange={(e) => set('streamPref', e.target.value as 'progressive' | 'hls')} className="bg-[var(--bg-elevated)] rounded-md px-3 py-1.5 text-sm outline-none">
            <option value="progressive">{t('set.streamProg')}</option>
            <option value="hls">{t('set.streamHls')}</option>
          </select>
        </Row>
        <Row label={t('set.volume')} hint={`${Math.round(s.volume * 100)}%`}>
          <input type="range" min={0} max={1} step={0.01} value={s.volume} onChange={(e) => set('volume', Number(e.target.value))} className="w-40 accent-[var(--accent)]" />
        </Row>
        <Row label={t('set.autoplay')} hint={t('set.autoplayHint')}>
          <Toggle on={s.autoplay} onChange={(v) => set('autoplay', v)} />
        </Row>
        <Row label={t('set.notifications')}>
          <Toggle on={s.notifications} onChange={(v) => set('notifications', v)} />
        </Row>
      </Section>

      <Section title="Equalizer">
        <EqualizerPanel />
      </Section>

      <Section title={t('set.integration')}>
        <Row label={t('set.discord')}>
          <Toggle on={s.discordEnabled} onChange={(v) => set('discordEnabled', v)} />
        </Row>
        <Row label={t('set.closeToTray')}>
          <Toggle on={s.closeToTray} onChange={(v) => set('closeToTray', v)} />
        </Row>
        <Row label={t('set.startup')}>
          <Toggle on={s.startWithWindows} onChange={(v) => set('startWithWindows', v)} />
        </Row>
      </Section>

      <Section title={t('set.data')}>
        <Row label={t('set.clearCache')}>
          <button
            onClick={() => {
              clearColorCache()
              clearWaveformCache()
              pushToast('Cache limpo')
            }}
            className="px-4 py-1.5 rounded-full bg-[var(--bg-hover)] text-sm hover:bg-white/15"
          >
            {t('set.clearCacheBtn')}
          </button>
        </Row>
        <Row label={t('set.clearRecents')}>
          <button
            onClick={() => {
              try {
                localStorage.removeItem('sc:recents')
              } catch {
                // ignore
              }
              pushToast('Histórico local limpo')
            }}
            className="px-4 py-1.5 rounded-full bg-[var(--bg-hover)] text-sm hover:bg-white/15"
          >
            {t('set.clearCacheBtn')}
          </button>
        </Row>
        <Row label={t('set.logout')}>
          <button onClick={() => void window.sc.logout()} className="px-4 py-1.5 rounded-full bg-[#3a1a1a] text-[#ff8a8a] text-sm hover:bg-[#4a2020]">
            {t('set.logout')}
          </button>
        </Row>
      </Section>

      <Section title={t('set.about')}>
        <div className="text-sm text-[var(--text-dim)]">SoundCloud Desktop (unofficial) · v{APP_VERSION}</div>
      </Section>
    </section>
  )
}
