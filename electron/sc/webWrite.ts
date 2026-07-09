import { BrowserWindow } from 'electron'

// SoundCloud guards its write endpoints (like/follow/repost) with DataDome, an
// anti-bot that rejects requests lacking a browser's cleared cookie + JS
// fingerprint. A bare fetch or net.request gets a 403 captcha page. To pass, we
// run the write from inside a real (hidden) soundcloud.com page in the logged-in
// session partition, where DataDome has already cleared the browser.
let win: BrowserWindow | null = null
let loading: Promise<void> | null = null

// DataDome sets its clearance cookie via JS a moment after the page loads, so we
// wait a beat after load before considering the window write-ready.
const SETTLE_MS = 1800

function ensureWindow(): Promise<void> {
  if (win && !win.isDestroyed() && loading) return loading
  loading = new Promise((resolve) => {
    const w = new BrowserWindow({
      show: false,
      webPreferences: { partition: 'persist:sc' },
    })
    win = w
    let settled = false
    const finish = () => {
      if (settled) return
      settled = true
      setTimeout(resolve, SETTLE_MS)
    }
    w.webContents.once('did-finish-load', finish)
    w.webContents.once('did-fail-load', finish) // partial load still clears DataDome
    w.loadURL('https://soundcloud.com/discover').catch(finish)
  })
  return loading
}

// Pre-load the hidden window at startup so the first write isn't slow.
export function warmupWrites(): void {
  void ensureWindow()
}

export async function webWrite(method: string, url: string, token: string | null): Promise<number> {
  await ensureWindow()
  if (!win || win.isDestroyed()) return -1
  const headers = token ? `{ 'Authorization': 'OAuth ' + ${JSON.stringify(token)} }` : '{}'
  const js = `fetch(${JSON.stringify(url)}, { method: ${JSON.stringify(
    method,
  )}, headers: ${headers}, credentials: 'include' }).then(r => r.status).catch(() => -1)`
  try {
    return (await win.webContents.executeJavaScript(js, true)) as number
  } catch {
    return -1
  }
}
