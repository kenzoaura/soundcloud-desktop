import { app, BrowserWindow, ipcMain, shell, session, dialog } from 'electron'
import { autoUpdater } from 'electron-updater'
import path from 'node:path'
import { CONFIG, loadUserConfig } from './config'
import { initSettings, getSettings, setSettings, type Settings } from './settings'
import { IPC, type PlayerCommand } from './ipc'
import { TokenStore } from './auth/tokenStore'
import { AuthSession } from './auth/session'
import { ClientId } from './sc/clientId'
import { ScApi } from './sc/api'
import { warmupWrites } from './sc/webWrite'
import { registerScIpc } from './scIpc'
import { DiscordPresence } from './discord'
import { createTray } from './tray'
import { registerMediaKeys } from './mediaKeys'
import type { PlayerSnapshot } from './rpcActivity'

process.env.APP_ROOT = path.join(__dirname, '..')
const VITE_DEV_SERVER_URL = process.env['VITE_DEV_SERVER_URL']
const RENDERER_DIST = path.join(process.env.APP_ROOT, 'dist')

let mainWindow: BrowserWindow | null = null
let discord: DiscordPresence | null = null
let tray: ReturnType<typeof createTray> | null = null
let unregisterKeys: (() => void) | null = null
let quitting = false

function sendCommand(cmd: PlayerCommand) {
  mainWindow?.webContents.send(IPC.PLAYER_COMMAND, cmd)
}

const userConfigPath = loadUserConfig(app.getPath('userData'))
initSettings(app.getPath('userData'))
console.log('[SoundCloud] config file:', userConfigPath)
app.setLoginItemSettings({ openAtLogin: getSettings().startWithWindows })

// Single instance: a second launch focuses the existing window and exits.
if (!app.requestSingleInstanceLock()) {
  app.quit()
} else {
  app.on('second-instance', () => {
    if (mainWindow) {
      mainWindow.show()
      mainWindow.focus()
    }
  })
}

function createPlayerWindow() {
  const iconPath = VITE_DEV_SERVER_URL
    ? path.join(process.env.APP_ROOT!, 'public', 'icon.png')
    : path.join(RENDERER_DIST, 'icon.png')
  const win = new BrowserWindow({
    width: 1200,
    height: 800,
    minWidth: 720,
    minHeight: 520,
    frame: false,
    icon: iconPath,
    backgroundColor: '#0A0A0A',
    webPreferences: { preload: path.join(__dirname, 'preload.js') },
  })
  mainWindow = win
  const base = VITE_DEV_SERVER_URL ?? `file://${path.join(RENDERER_DIST, 'index.html')}`
  win.loadURL(base)
  win.webContents.on('did-finish-load', () => win.webContents.setZoomFactor(getSettings().zoom))
  // Hide to tray on close (when enabled) instead of quitting.
  win.on('close', (e) => {
    if (!quitting && getSettings().closeToTray) {
      e.preventDefault()
      win.hide()
    }
  })
  win.on('closed', () => {
    mainWindow = null
  })
}

// Window controls for the custom (frameless) title bar.
ipcMain.on(IPC.WINDOW_MINIMIZE, () => mainWindow?.minimize())
ipcMain.on(IPC.WINDOW_MAXIMIZE, () => {
  if (!mainWindow) return
  if (mainWindow.isMaximized()) mainWindow.unmaximize()
  else mainWindow.maximize()
})
ipcMain.on(IPC.WINDOW_CLOSE, () => mainWindow?.close())
ipcMain.handle(IPC.WINDOW_IS_MAXIMIZED, () => mainWindow?.isMaximized() ?? false)

// Player state from the renderer → Discord presence + tray.
ipcMain.on(IPC.PLAYER_PROGRESS, (_e, snap: PlayerSnapshot | null) => {
  discord?.update(snap)
  tray?.update(snap ? snap.title : null, snap ? snap.artist : '')
})

// Settings: read, and write with side effects (zoom, Discord, startup).
ipcMain.handle(IPC.SETTINGS_GET, () => getSettings())
ipcMain.handle(IPC.SETTINGS_SET, (_e, patch: Partial<Settings>) => {
  const s = setSettings(patch)
  if ('zoom' in patch) mainWindow?.webContents.setZoomFactor(s.zoom)
  if ('discordEnabled' in patch) {
    if (s.discordEnabled) discord?.start()
    else discord?.stop()
  }
  if ('startWithWindows' in patch) app.setLoginItemSettings({ openAtLogin: s.startWithWindows })
  return s
})

// Open an external link (SoundCloud profile) in the OS browser.
ipcMain.on(IPC.OPEN_EXTERNAL, (_e, url: string) => {
  if (typeof url === 'string' && /^https?:\/\//.test(url)) void shell.openExternal(url)
})

// Fetch a cover image from Node (no CORS) and return it as a data URL so the
// renderer can read its pixels on a canvas without tainting it.
ipcMain.handle(IPC.COVER_BYTES, async (_e, url: string): Promise<string | null> => {
  if (typeof url !== 'string' || !/^https?:\/\//.test(url)) return null
  try {
    const res = await fetch(url)
    if (!res.ok) return null
    const type = res.headers.get('content-type') ?? 'image/jpeg'
    const buf = Buffer.from(await res.arrayBuffer())
    return `data:${type};base64,${buf.toString('base64')}`
  } catch {
    return null
  }
})

// Fetch a track's SoundCloud waveform JSON and return normalized peaks (0..1).
ipcMain.handle(IPC.SC_WAVEFORM, async (_e, url: string): Promise<number[] | null> => {
  if (typeof url !== 'string' || !/^https?:\/\//.test(url)) return null
  try {
    const res = await fetch(url)
    if (!res.ok) return null
    const data = (await res.json()) as { samples?: unknown }
    const samples = Array.isArray(data.samples) ? (data.samples as number[]) : null
    if (!samples || samples.length === 0) return null
    const max = samples.reduce((m, v) => (typeof v === 'number' && v > m ? v : m), 1)
    return samples.map((v) => (typeof v === 'number' ? Math.max(0, Math.min(1, v / max)) : 0))
  } catch {
    return null
  }
})

// Log out: clear the stored token + the login webview session, then relaunch so
// the app prompts for login again.
ipcMain.handle(IPC.AUTH_LOGOUT, async () => {
  new TokenStore(path.join(app.getPath('userData'), 'auth.bin')).clear()
  try {
    await session.fromPartition('persist:sc').clearStorageData()
  } catch {
    // best-effort
  }
  app.relaunch()
  app.exit(0)
})

async function setupPlayer() {
  const tokenStore = new TokenStore(path.join(app.getPath('userData'), 'auth.bin'))
  const clientId = new ClientId()
  const authSession = new AuthSession(tokenStore, clientId)
  await authSession.ensureAuth()
  const scApi = new ScApi(authSession, clientId)
  registerScIpc(scApi, clientId, authSession)
  warmupWrites() // pre-load the DataDome window so the first like/follow is fast
  createPlayerWindow()

  discord = new DiscordPresence(CONFIG.discordClientId)
  if (getSettings().discordEnabled) discord.start()
  tray = createTray({
    iconPath: VITE_DEV_SERVER_URL
      ? path.join(process.env.APP_ROOT!, 'public', 'tray.png')
      : path.join(RENDERER_DIST, 'tray.png'),
    onCommand: (cmd) => sendCommand(cmd),
    onShow: () => {
      mainWindow?.show()
      mainWindow?.focus()
    },
    onQuit: () => {
      quitting = true
      app.quit()
    },
  })
  unregisterKeys = registerMediaKeys((cmd) => sendCommand(cmd))
  initAutoUpdate()
}

// Check GitHub Releases for a newer version and install it on quit. Only runs in
// packaged builds (no-op in dev). Prompts the user to restart once downloaded.
function initAutoUpdate() {
  if (!app.isPackaged) return
  autoUpdater.autoDownload = true
  autoUpdater.on('update-downloaded', async (info) => {
    const { response } = await dialog.showMessageBox({
      type: 'info',
      buttons: ['Reiniciar agora', 'Depois'],
      defaultId: 0,
      cancelId: 1,
      title: 'Atualização disponível',
      message: `SoundCloud ${info.version} baixado`,
      detail: 'Reinicie para aplicar a atualização.',
    })
    if (response === 0) {
      quitting = true
      autoUpdater.quitAndInstall()
    }
  })
  autoUpdater.checkForUpdates().catch(() => {
    // offline / no release feed — ignore, try again next launch
  })
}

app.whenReady().then(() => setupPlayer())

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) createPlayerWindow()
  else mainWindow?.show()
})

// Stay alive in the tray when the window is closed; quit is explicit (tray → Quit).
app.on('window-all-closed', () => {
  // no-op: the app lives in the tray.
})

app.on('before-quit', () => {
  quitting = true
})

app.on('will-quit', () => {
  unregisterKeys?.()
  discord?.stop()
  tray?.destroy()
})
