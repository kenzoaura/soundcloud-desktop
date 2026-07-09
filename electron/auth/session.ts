import type { TokenStore } from './tokenStore'
import type { ClientId } from '../sc/clientId'
import { runLogin } from './loginWindow'

export class AuthSession {
  private tok: string | null = null

  constructor(private store: TokenStore, private clientId: ClientId) {}

  token(): string | null {
    return this.tok
  }

  async ensureAuth(): Promise<void> {
    if (this.tok) return
    const existing = this.store.load()
    if (existing) {
      this.tok = existing
      return
    }
    const captured = await runLogin()
    this.tok = captured.token
    this.store.save(captured.token)
    if (captured.clientId) this.clientId.set(captured.clientId)
  }

  onUnauthorized(): void {
    this.tok = null
    this.store.clear()
  }
}
