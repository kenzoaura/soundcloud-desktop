import { safeStorage } from 'electron'
import fs from 'node:fs'

export function isValidToken(v: unknown): v is string {
  return typeof v === 'string' && v.trim().length > 0
}

export class TokenStore {
  constructor(private filePath: string) {}

  save(token: string): void {
    if (!isValidToken(token)) return
    try {
      const enc = safeStorage.isEncryptionAvailable()
        ? safeStorage.encryptString(token)
        : Buffer.from(token, 'utf-8')
      fs.writeFileSync(this.filePath, enc)
    } catch {
      // best-effort
    }
  }

  load(): string | null {
    try {
      const buf = fs.readFileSync(this.filePath)
      const dec = safeStorage.isEncryptionAvailable()
        ? safeStorage.decryptString(buf)
        : buf.toString('utf-8')
      return isValidToken(dec) ? dec : null
    } catch {
      return null
    }
  }

  clear(): void {
    try {
      fs.unlinkSync(this.filePath)
    } catch {
      // already gone
    }
  }
}
