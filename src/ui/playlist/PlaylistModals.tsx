import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { X, Lock, Globe, Plus, Check, ListMusic } from 'lucide-react'
import { usePlaylistUi, notifyPlaylistsChanged, notifyPlaylistCreated } from './store'
import { useAsync } from '../useAsync'
import { pushToast } from '../toast/store'
import type { Playlist } from '../../../electron/sc/types'

function Overlay({ children, onClose }: { children: React.ReactNode; onClose: () => void }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])
  return (
    <div
      className="fixed inset-0 z-50 grid place-items-center bg-black/60 p-4 anim-fade-in"
      onMouseDown={onClose}
    >
      <div
        className="w-full max-w-md rounded-2xl bg-[var(--bg-elevated)] border border-[var(--border)] shadow-2xl anim-pop"
        onMouseDown={(e) => e.stopPropagation()}
      >
        {children}
      </div>
    </div>
  )
}

function Header({ title, onClose }: { title: string; onClose: () => void }) {
  return (
    <div className="flex items-center justify-between px-5 py-4 border-b border-[var(--border)]">
      <h2 className="text-base font-bold">{title}</h2>
      <button onClick={onClose} className="text-[var(--text-dim)] hover:text-white transition-colors" aria-label="Fechar">
        <X size={18} />
      </button>
    </div>
  )
}

const inputCls =
  'w-full px-4 py-2.5 rounded-lg bg-white/10 border border-white/15 text-sm text-white placeholder-[var(--text-dim)] outline-none focus:border-[var(--accent)] transition-colors'

function CreateForm({ seedTrackId }: { seedTrackId?: number }) {
  const close = usePlaylistUi((s) => s.close)
  const navigate = useNavigate()
  const [title, setTitle] = useState('')
  const [isPublic, setIsPublic] = useState(false)
  const [busy, setBusy] = useState(false)
  const ref = useRef<HTMLInputElement>(null)
  useEffect(() => ref.current?.focus(), [])

  const submit = async () => {
    const name = title.trim()
    if (!name || busy) return
    setBusy(true)
    const p = await window.sc.createPlaylist(name, isPublic, seedTrackId ? [seedTrackId] : [])
    setBusy(false)
    if (!p) {
      pushToast('Não consegui criar a playlist', 'error')
      return
    }
    notifyPlaylistCreated(p)
    pushToast(seedTrackId ? 'Playlist criada com a faixa' : 'Playlist criada')
    close()
    navigate(`/playlist/${p.id}`)
  }

  return (
    <>
      <Header title="Nova playlist" onClose={close} />
      <div className="p-5 flex flex-col gap-4">
        <input
          ref={ref}
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && void submit()}
          placeholder="Nome da playlist"
          className={inputCls}
        />
        <div className="grid grid-cols-2 gap-2">
          <Choice active={!isPublic} onClick={() => setIsPublic(false)} icon={<Lock size={16} />} label="Privada" hint="Só você vê" />
          <Choice active={isPublic} onClick={() => setIsPublic(true)} icon={<Globe size={16} />} label="Pública" hint="No seu perfil" />
        </div>
      </div>
      <Footer>
        <button onClick={close} className="px-4 py-2 rounded-full text-sm font-semibold text-[var(--text-dim)] hover:text-white transition-colors">
          Cancelar
        </button>
        <button
          onClick={() => void submit()}
          disabled={!title.trim() || busy}
          className="px-5 py-2 rounded-full text-sm font-bold bg-[var(--accent)] text-white hover:bg-[var(--accent-hover)] disabled:opacity-40 disabled:cursor-not-allowed transition"
        >
          {busy ? 'Criando…' : 'Criar'}
        </button>
      </Footer>
    </>
  )
}

function Choice({
  active,
  onClick,
  icon,
  label,
  hint,
}: {
  active: boolean
  onClick: () => void
  icon: React.ReactNode
  label: string
  hint: string
}) {
  return (
    <button
      onClick={onClick}
      className={`flex flex-col items-start gap-1 px-4 py-3 rounded-lg border text-left transition-colors ${
        active ? 'border-[var(--accent)] bg-[var(--accent)]/10' : 'border-white/15 hover:border-white/30'
      }`}
    >
      <span className={`flex items-center gap-2 text-sm font-semibold ${active ? 'text-[var(--accent)]' : 'text-white'}`}>
        {icon}
        {label}
      </span>
      <span className="text-xs text-[var(--text-dim)]">{hint}</span>
    </button>
  )
}

function Footer({ children }: { children: React.ReactNode }) {
  return <div className="flex items-center justify-end gap-2 px-5 py-4 border-t border-[var(--border)]">{children}</div>
}

function AddForm({ trackId }: { trackId: number }) {
  const close = usePlaylistUi((s) => s.close)
  const openCreate = usePlaylistUi((s) => s.openCreate)
  const own = useAsync(() => window.sc.playlists(), [])
  const [doneId, setDoneId] = useState<number | null>(null)
  const [busyId, setBusyId] = useState<number | null>(null)

  const add = async (p: Playlist) => {
    if (busyId) return
    setBusyId(p.id)
    const ok = await window.sc.addToPlaylist(p.id, trackId)
    setBusyId(null)
    if (ok) {
      setDoneId(p.id)
      notifyPlaylistsChanged()
      pushToast(`Adicionada a "${p.title}"`)
    } else {
      pushToast('Não consegui adicionar', 'error')
    }
  }

  return (
    <>
      <Header title="Adicionar à playlist" onClose={close} />
      <div className="max-h-[50vh] overflow-y-auto p-2">
        <button
          onClick={() => openCreate(trackId)}
          className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-[var(--bg-hover)] transition-colors text-left"
        >
          <span className="w-11 h-11 rounded-md grid place-items-center bg-white/10 shrink-0">
            <Plus size={20} />
          </span>
          <span className="text-sm font-semibold">Nova playlist</span>
        </button>
        {own.loading && <div className="px-3 py-4 text-sm text-[var(--text-muted)]">Carregando…</div>}
        {(own.data ?? []).map((p) => (
          <button
            key={p.id}
            onClick={() => void add(p)}
            className="w-full flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-[var(--bg-hover)] transition-colors text-left"
          >
            {p.artworkUrl ? (
              <img src={p.artworkUrl} className="w-11 h-11 rounded-md object-cover bg-white/5 shrink-0" />
            ) : (
              <span className="w-11 h-11 rounded-md grid place-items-center bg-white/5 shrink-0">
                <ListMusic size={18} className="text-[var(--text-dim)]" />
              </span>
            )}
            <span className="min-w-0 flex-1">
              <span className="block truncate text-sm font-semibold">{p.title}</span>
              <span className="block truncate text-xs text-[var(--text-dim)]">{p.trackCount} faixas</span>
            </span>
            {doneId === p.id ? (
              <Check size={18} className="text-[var(--accent)] shrink-0" />
            ) : busyId === p.id ? (
              <span className="text-xs text-[var(--text-dim)] shrink-0">…</span>
            ) : null}
          </button>
        ))}
      </div>
    </>
  )
}

function RenameForm({ playlist }: { playlist: Playlist }) {
  const close = usePlaylistUi((s) => s.close)
  const [title, setTitle] = useState(playlist.title)
  const [busy, setBusy] = useState(false)
  const ref = useRef<HTMLInputElement>(null)
  useEffect(() => {
    ref.current?.focus()
    ref.current?.select()
  }, [])

  const submit = async () => {
    const name = title.trim()
    if (!name || busy) return
    setBusy(true)
    const ok = await window.sc.renamePlaylist(playlist.id, name)
    setBusy(false)
    if (ok) {
      notifyPlaylistsChanged()
      window.dispatchEvent(new CustomEvent('sc:playlist-renamed', { detail: { id: playlist.id, title: name } }))
      pushToast('Playlist renomeada')
      close()
    } else {
      pushToast('Não consegui renomear', 'error')
    }
  }

  return (
    <>
      <Header title="Renomear playlist" onClose={close} />
      <div className="p-5">
        <input
          ref={ref}
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && void submit()}
          placeholder="Nome da playlist"
          className={inputCls}
        />
      </div>
      <Footer>
        <button onClick={close} className="px-4 py-2 rounded-full text-sm font-semibold text-[var(--text-dim)] hover:text-white transition-colors">
          Cancelar
        </button>
        <button
          onClick={() => void submit()}
          disabled={!title.trim() || busy}
          className="px-5 py-2 rounded-full text-sm font-bold bg-[var(--accent)] text-white hover:bg-[var(--accent-hover)] disabled:opacity-40 transition"
        >
          {busy ? 'Salvando…' : 'Salvar'}
        </button>
      </Footer>
    </>
  )
}

export default function PlaylistModals() {
  const modal = usePlaylistUi((s) => s.modal)
  const close = usePlaylistUi((s) => s.close)
  if (!modal) return null
  return (
    <Overlay onClose={close}>
      {modal.kind === 'create' && <CreateForm seedTrackId={modal.seedTrackId} />}
      {modal.kind === 'add' && <AddForm trackId={modal.track.id} />}
      {modal.kind === 'rename' && <RenameForm playlist={modal.playlist} />}
    </Overlay>
  )
}
