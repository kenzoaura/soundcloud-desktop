import { BrowserWindow, session } from 'electron'

export interface Captured {
  token: string
  clientId?: string
}

const API_HOST = 'api-v2.soundcloud.com'

export function runLogin(): Promise<Captured> {
  return new Promise<Captured>((resolve, reject) => {
    const win = new BrowserWindow({
      width: 1040,
      height: 820,
      minWidth: 800,
      minHeight: 600,
      center: true,
      title: 'Log in to SoundCloud',
      autoHideMenuBar: true,
      webPreferences: { partition: 'persist:sc', contextIsolation: true, nodeIntegration: false },
    })

    let done = false
    const finish = (result: Captured | null) => {
      if (done) return
      done = true
      session.fromPartition('persist:sc').webRequest.onBeforeSendHeaders(null)
      if (!win.isDestroyed()) win.close()
      if (result) resolve(result)
      else reject(new Error('login cancelled'))
    }

    session
      .fromPartition('persist:sc')
      .webRequest.onBeforeSendHeaders({ urls: [`https://${API_HOST}/*`] }, (details, cb) => {
        const auth = (details.requestHeaders['Authorization'] ||
          details.requestHeaders['authorization']) as string | undefined
        if (auth && /^OAuth\s+/i.test(auth)) {
          const token = auth.replace(/^OAuth\s+/i, '').trim()
          let clientId: string | undefined
          const m = details.url.match(/[?&]client_id=([^&]+)/)
          if (m) clientId = decodeURIComponent(m[1])
          finish({ token, clientId })
        }
        cb({ requestHeaders: details.requestHeaders })
      })

    win.on('closed', () => finish(null))
    win.loadURL('https://soundcloud.com/signin')
  })
}
