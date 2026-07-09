import { Outlet } from 'react-router-dom'
import TopBar from './TopBar'
import Sidebar from './Sidebar'
import PlayerBar from './PlayerBar'
import ViewTransition from './ViewTransition'
import Toaster from './toast/Toaster'
import NowPlaying from './NowPlaying'
import ContextMenu from './contextMenu/ContextMenu'
import { useKeyboardShortcuts } from './useKeyboardShortcuts'
import { usePlayer } from '../player/store'

export default function AppShell() {
  useKeyboardShortcuts()
  const hasTrack = usePlayer((s) => !!s.current)
  return (
    <div className="h-screen grid grid-rows-[auto_1fr_auto] bg-[var(--bg-app)] text-white overflow-hidden">
      <TopBar />
      <div className="grid grid-cols-[auto_1fr] min-h-0 gap-2 p-2">
        <Sidebar />
        <main className="min-w-0 overflow-y-auto rounded-lg bg-[var(--bg-panel)]">
          <ViewTransition>
            <Outlet />
          </ViewTransition>
        </main>
      </div>
      {/* Player slides in/out: only present while a track is loaded. Clip only
          while collapsed/collapsing so the queue popover can overflow upward. */}
      <div
        className={`shrink-0 transition-[height,opacity] duration-300 ease-out ${
          hasTrack ? 'h-20 opacity-100 overflow-visible' : 'h-0 opacity-0 overflow-hidden'
        }`}
      >
        <PlayerBar />
      </div>
      <Toaster />
      <NowPlaying />
      <ContextMenu />
    </div>
  )
}
