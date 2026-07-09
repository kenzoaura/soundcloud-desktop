import { Tray, Menu, nativeImage } from 'electron'

export function createTray(opts: {
  iconPath: string
  onCommand: (cmd: 'toggle' | 'next' | 'previous') => void
  onShow: () => void
  onQuit: () => void
}) {
  const tray = new Tray(nativeImage.createFromPath(opts.iconPath))

  const build = (label: string) => {
    tray.setToolTip(`SoundCloud — ${label}`)
    tray.setContextMenu(
      Menu.buildFromTemplate([
        { label, enabled: false },
        { type: 'separator' },
        { label: 'Play / Pause', click: () => opts.onCommand('toggle') },
        { label: 'Next', click: () => opts.onCommand('next') },
        { label: 'Previous', click: () => opts.onCommand('previous') },
        { type: 'separator' },
        { label: 'Show', click: () => opts.onShow() },
        { label: 'Quit', click: () => opts.onQuit() },
      ]),
    )
  }

  build('Not playing')
  tray.on('click', () => opts.onShow())

  return {
    update: (title: string | null, artist: string) =>
      build(title ? `${title}${artist ? ' — ' + artist : ''}` : 'Not playing'),
    destroy: () => tray.destroy(),
  }
}
