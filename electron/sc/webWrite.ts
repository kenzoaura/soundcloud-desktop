import { BrowserWindow, net, session } from 'electron'

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
  const { status } = await webRequest(method, url, token)
  return status
}

// Like webWrite but sends an optional JSON body and returns the parsed response
// body alongside the status (needed e.g. to read the id of a created playlist).
export async function webRequest(
  method: string,
  url: string,
  token: string | null,
  body?: unknown,
): Promise<{ status: number; data: unknown }> {
  await ensureWindow()
  if (!win || win.isDestroyed()) return { status: -1, data: null }

  // Bodyless writes (like/follow/repost) pass fine through the page's fetch.
  if (body === undefined) {
    const hdr = token ? `{ 'Authorization': 'OAuth ' + ${JSON.stringify(token)} }` : '{}'
    const js = `fetch(${JSON.stringify(url)}, { method: ${JSON.stringify(
      method,
    )}, headers: ${hdr}, credentials: 'include' })
      .then(async (r) => ({ status: r.status, data: await r.json().catch(() => null) }))
      .catch(() => ({ status: -1, data: null }))`
    try {
      return (await win.webContents.executeJavaScript(js, true)) as { status: number; data: unknown }
    } catch {
      return { status: -1, data: null }
    }
  }

  // JSON-body writes (playlist create/edit) can't go through the page: DataDome
  // wraps fetch/XHR and corrupts the body. Send them via net.request on the same
  // session so no page JS touches the body; the DataDome clearance cookie set by
  // the hidden window rides along automatically via useSessionCookies.
  const ua = win.webContents.getUserAgent()
  const payload = JSON.stringify(body)
  return new Promise<{ status: number; data: unknown }>((resolve) => {
    const req = net.request({
      method,
      url,
      session: session.fromPartition('persist:sc'),
      useSessionCookies: true,
    })
    if (token) req.setHeader('Authorization', 'OAuth ' + token)
    req.setHeader('Content-Type', 'application/json')
    req.setHeader('Accept', 'application/json, text/json, */*')
    req.setHeader('Origin', 'https://soundcloud.com')
    req.setHeader('Referer', 'https://soundcloud.com/')
    req.setHeader('User-Agent', ua)
    let data = ''
    req.on('response', (r) => {
      r.on('data', (c) => (data += c.toString()))
      r.on('end', () => {
        let parsed: unknown = null
        try {
          parsed = JSON.parse(data)
        } catch {
          /* non-JSON body */
        }
        resolve({ status: r.statusCode ?? -1, data: parsed })
      })
    })
    req.on('error', () => resolve({ status: -1, data: null }))
    req.write(payload)
    req.end()
  })
}
