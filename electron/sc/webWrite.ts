import { BrowserWindow } from 'electron'

// SoundCloud guards its write endpoints (like/follow/repost) with DataDome, an
// anti-bot that rejects requests lacking a browser's cleared cookie + JS
// fingerprint. A bare fetch or net.request gets a 403 captcha page. To pass, we
// run the write from inside a real (hidden) soundcloud.com page in the logged-in
// session partition, where DataDome has already cleared the browser.
let win: BrowserWindow | null = null
let loading: Promise<void> | null = null

function ensureWindow(): Promise<void> {
  if (win && !win.isDestroyed()) return Promise.resolve()
  if (loading) return loading
  loading = new Promise((resolve, reject) => {
    const w = new BrowserWindow({
      show: false,
      webPreferences: { partition: 'persist:sc' },
    })
    win = w
    const done = () => {
      w.webContents.off('did-fail-load', fail)
      resolve()
    }
    const fail = () => {
      // Even a partial load leaves the origin usable for same-origin fetch.
      resolve()
    }
    w.webContents.once('did-finish-load', done)
    w.webContents.once('did-fail-load', fail)
    w.loadURL('https://soundcloud.com/discover').catch(reject)
  })
  loading.finally(() => {
    loading = null
  })
  return loading
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
