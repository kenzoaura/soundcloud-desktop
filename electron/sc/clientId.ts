import { CONFIG } from '../config'

export function extractClientId(bundleJs: string): string | null {
  const m = bundleJs.match(/client_id\s*[:=]\s*["']([a-zA-Z0-9]{16,})["']/)
  return m ? m[1] : null
}

export class ClientId {
  private value: string | null = null

  set(id: string): void {
    if (id) this.value = id
  }

  invalidate(): void {
    this.value = null
  }

  async get(): Promise<string> {
    if (this.value) return this.value
    const scraped = await this.scrape()
    if (scraped) {
      this.value = scraped
      return scraped
    }
    return CONFIG.soundcloudClientId
  }

  private async scrape(): Promise<string | null> {
    const html = await fetchText('https://soundcloud.com/')
    if (!html) return null
    // SoundCloud's client_id lives in one of the later JS chunks. Only absolute
    // http(s) srcs; one failed chunk must not abort the whole scan.
    const scripts = [...html.matchAll(/<script[^>]+src="([^"]+)"/g)]
      .map((m) => m[1])
      .filter((s) => /^https?:\/\//.test(s))
    for (const src of scripts.reverse()) {
      const js = await fetchText(src)
      if (!js) continue
      const id = extractClientId(js)
      if (id) return id
    }
    console.warn('[SoundCloud] client_id not found by scrape; using config fallback')
    return null
  }
}

// Fetch text with an 8s timeout; returns null on any failure so a single bad
// chunk never aborts the caller's loop.
async function fetchText(url: string): Promise<string | null> {
  const ctrl = new AbortController()
  const timer = setTimeout(() => ctrl.abort(), 8000)
  try {
    const res = await fetch(url, { signal: ctrl.signal })
    return res.ok ? await res.text() : null
  } catch {
    return null
  } finally {
    clearTimeout(timer)
  }
}
