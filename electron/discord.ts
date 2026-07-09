import { Client } from '@xhayper/discord-rpc'
import { buildActivity, type PlayerSnapshot } from './rpcActivity'

export class DiscordPresence {
  private client: Client | null = null
  private ready = false
  private pending: PlayerSnapshot | null = null
  private retry: NodeJS.Timeout | null = null

  constructor(private clientId: string) {}

  start(): void {
    if (this.client) return
    const client = new Client({ clientId: this.clientId })
    this.client = client
    client.on('ready', () => {
      this.ready = true
      this.push(this.pending)
    })
    client.login().catch(() => {
      // Discord not running / not installed — retry later, never crash.
      this.ready = false
      this.client = null
      this.scheduleRetry()
    })
  }

  private scheduleRetry(): void {
    if (this.retry) return
    this.retry = setTimeout(() => {
      this.retry = null
      this.start()
    }, 15000)
  }

  update(snapshot: PlayerSnapshot | null): void {
    this.pending = snapshot
    if (this.ready) this.push(snapshot)
  }

  private push(snapshot: PlayerSnapshot | null): void {
    if (!this.client || !this.ready || !this.client.user) return
    // Nothing playing OR paused → clear the presence entirely.
    if (!snapshot || !snapshot.isPlaying) {
      this.client.user.clearActivity().catch(() => {})
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
      .catch(() => {})
  }

  stop(): void {
    if (this.retry) clearTimeout(this.retry)
    this.retry = null
    this.ready = false
    this.client?.destroy().catch(() => {})
    this.client = null
  }
}
