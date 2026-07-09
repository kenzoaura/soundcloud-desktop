import { Client } from '@xhayper/discord-rpc'
import { buildActivity, type PlayerSnapshot } from './rpcActivity'

// True for errors that mean the IPC pipe dropped (Discord restarted/closed).
function isConnectionError(e: unknown): boolean {
  return /clos|connection|reset|epipe|write after end|not connected|destroyed/i.test(String(e))
}

export class DiscordPresence {
  private client: Client | null = null
  private ready = false
  private pending: PlayerSnapshot | null = null
  private retry: NodeJS.Timeout | null = null
  private enabled = false

  constructor(private clientId: string) {}

  start(): void {
    this.enabled = true
    this.connect()
  }

  private connect(): void {
    if (this.client) return
    const client = new Client({ clientId: this.clientId })
    this.client = client
    client.on('ready', () => {
      this.ready = true
      this.push(this.pending)
    })
    // Recover when the connection drops (Discord restart / IPC close) instead of
    // silently dying until the app is restarted.
    const onLost = () => this.handleLost()
    client.on('disconnected', onLost)
    client.on('close', onLost)
    client.on('error', onLost)
    try {
      const transport = (client as unknown as { transport?: { on?: (e: string, cb: () => void) => void } }).transport
      transport?.on?.('close', onLost)
    } catch {
      // transport not exposed on this version — the events above still cover it
    }
    client.login().catch(() => this.handleLost())
  }

  // Tear down the dead client and schedule a reconnect (while still enabled).
  private handleLost(): void {
    if (!this.ready && !this.client) return
    this.ready = false
    const dead = this.client
    this.client = null
    dead?.destroy().catch(() => {})
    if (this.enabled) this.scheduleRetry()
  }

  private scheduleRetry(): void {
    if (this.retry || !this.enabled) return
    this.retry = setTimeout(() => {
      this.retry = null
      this.connect()
    }, 10000)
  }

  update(snapshot: PlayerSnapshot | null): void {
    this.pending = snapshot
    if (this.ready) this.push(snapshot)
  }

  private push(snapshot: PlayerSnapshot | null): void {
    if (!this.client || !this.ready || !this.client.user) return
    const onErr = (e: unknown) => {
      if (isConnectionError(e)) this.handleLost()
    }
    // Nothing playing OR paused → clear the presence entirely.
    if (!snapshot || !snapshot.isPlaying) {
      this.client.user.clearActivity().catch(onErr)
      return
    }
    const a = buildActivity(snapshot, Date.now())
    this.client.user
      .setActivity({
        type: a.type,
        name: a.name,
        details: a.details,
        state: a.state,
        largeImageKey: a.largeImageKey,
        largeImageText: a.largeImageText,
        startTimestamp: a.startTimestamp,
        endTimestamp: a.endTimestamp,
        buttons: a.buttons,
        instance: false,
      })
      .catch(onErr)
  }

  stop(): void {
    this.enabled = false
    if (this.retry) clearTimeout(this.retry)
    this.retry = null
    this.ready = false
    this.client?.destroy().catch(() => {})
    this.client = null
  }
}
