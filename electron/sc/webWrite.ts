import { BrowserWindow, net, session } from 'electron'
import log from 'electron-log'

// SoundCloud guards its write endpoints (like/follow/repost) with DataDome, an
// anti-bot that rejects requests lacking a browser's cleared cookie + JS
// fingerprint. A bare fetch or net.request gets a 403 captcha page. To pass, we
// run the write from inside a real (hidden) soundcloud.com page in the logged-in
// session partition, where DataDome has already cleared the browser.
let win: BrowserWindow | null = null
let loading: Promise<void> | null = null

const delay = (ms: number) => new Promise((r) => setTimeout(r, ms))

// Wait until DataDome has actually set its clearance cookie, rather than a fixed
// delay: on slower machines/connections the cookie can take several seconds, and
// writing before it lands gets a 403. Falls back after a generous timeout.
async function waitForClearance(): Promise<void> {
  const ses = session.fromPartition('persist:sc')
  const deadline = Date.now() + 12000
  while (Date.now() < deadline) {
    try {
      const cookies = await ses.cookies.get({ name: 'datadome' })
      if (cookies.length > 0) {
        await delay(400) // small extra beat after it appears
        return
      }
    } catch {
      /* ignore and retry */
    }
    await delay(300)
  }
}

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
      void waitForClearance().then(() => resolve())
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

// One attempt of the actual request. Bodyless writes go through the page's own
// fetch; JSON-body writes go via net.request (DataDome corrupts fetch bodies).
async function sendOnce(
  method: string,
  url: string,
  token: string | null,
  body: unknown,
): Promise<{ status: number; data: unknown }> {
  if (!win || win.isDestroyed()) return { status: -1, data: null }

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

  const ua = win.webContents.getUserAgent()
  const payload = JSON.stringify(body)
  return new Promise((resolve) => {
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

// Like webWrite but sends an optional JSON body and returns the parsed response
// body alongside the status (needed e.g. to read the id of a created playlist).
// Retries once on a transient failure (403/blocked/-1) after re-waiting for the
// DataDome clearance cookie — the common cause of writes failing on some
// machines is the cookie simply not having landed yet.
export async function webRequest(
  method: string,
  url: string,
  token: string | null,
  body?: unknown,
): Promise<{ status: number; data: unknown }> {
  await ensureWindow()
  let res = await sendOnce(method, url, token, body)
  if (res.status === 403 || res.status === -1) {
    log.warn('[webWrite] retry after', res.status, method, url)
    await waitForClearance()
    await delay(600)
    res = await sendOnce(method, url, token, body)
  }
  log.info('[webWrite]', method, url, '->', res.status)
  return res
}
