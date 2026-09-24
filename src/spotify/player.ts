/**
 * A small singleton controller around the Spotify Web Playback SDK.
 *
 * The SDK gives us an in-browser "device" that can play full tracks for
 * Spotify Premium accounts. We expose a tidy event surface so React can
 * subscribe without juggling the global SDK directly.
 *
 * Performance note: discrete state (play/pause/track/duration) is pushed to
 * subscribers, but the *position* is NOT — it would force a render every
 * frame. Instead callers read `getPosition()` inside their own rAF loop and
 * only re-render when something meaningful (e.g. the active lyric line)
 * actually changes.
 *
 * Free accounts can't stream through the SDK — the UI falls back to 30s
 * preview clips (see PreviewPlayer) so Alice can still practise.
 */
import { getValidAccessToken } from './auth'

export interface PlayerSnapshot {
  ready: boolean
  deviceId: string | null
  isPlaying: boolean
  /** Position at the moment of the last SDK push (ms). Use getPosition() live. */
  positionMs: number
  durationMs: number
  trackUri: string | null
  trackName: string | null
}

type Listener = (snapshot: PlayerSnapshot) => void

class PlayerController {
  private player: SpotifyPlayer | null = null
  private listeners = new Set<Listener>()
  private snapshot: PlayerSnapshot = {
    ready: false,
    deviceId: null,
    isPlaying: false,
    positionMs: 0,
    durationMs: 0,
    trackUri: null,
    trackName: null,
  }
  private lastStateAt = 0
  private initPromise: Promise<void> | null = null

  get current(): PlayerSnapshot {
    return this.snapshot
  }

  /** Live, interpolated playback position in ms. */
  getPosition(): number {
    if (!this.snapshot.isPlaying) return this.snapshot.positionMs
    const elapsed = performance.now() - this.lastStateAt
    return Math.min(this.snapshot.durationMs, this.snapshot.positionMs + elapsed)
  }

  subscribe(fn: Listener): () => void {
    this.listeners.add(fn)
    fn(this.snapshot)
    return () => {
      this.listeners.delete(fn)
    }
  }

  private emit(patch: Partial<PlayerSnapshot>): void {
    this.snapshot = { ...this.snapshot, ...patch }
    this.listeners.forEach((fn) => fn(this.snapshot))
  }

  /** Initialise the SDK once. Safe to call repeatedly. */
  init(): Promise<void> {
    if (this.initPromise) return this.initPromise

    this.initPromise = new Promise<void>((resolve) => {
      const start = () => {
        if (!window.Spotify) {
          resolve()
          return
        }
        const player = new window.Spotify.Player({
          name: 'CantAlice 🎵',
          volume: 0.8,
          getOAuthToken: (cb) => {
            getValidAccessToken().then((t) => t && cb(t))
          },
        })

        player.addListener('ready', ({ device_id }: { device_id: string }) => {
          this.emit({ ready: true, deviceId: device_id })
          resolve()
        })
        player.addListener('not_ready', () => {
          this.emit({ ready: false })
        })
        player.addListener('player_state_changed', (state: SpotifyPlaybackState | null) => {
          if (!state) return
          this.lastStateAt = performance.now()
          this.emit({
            isPlaying: !state.paused,
            positionMs: state.position,
            durationMs: state.duration,
            trackUri: state.track_window.current_track?.uri ?? null,
            trackName: state.track_window.current_track?.name ?? null,
          })
        })
        const noop = () => {}
        player.addListener('initialization_error', noop)
        player.addListener('authentication_error', noop)
        player.addListener('account_error', noop)
        player.addListener('playback_error', noop)

        player.connect()
        this.player = player
      }

      if (window.Spotify) {
        start()
      } else {
        window.onSpotifyWebPlaybackSDKReady = start
        // The script may already be loading; if it never arrives, resolve so
        // the UI can fall back gracefully.
        setTimeout(() => resolve(), 6000)
      }
    })

    return this.initPromise
  }

  async togglePlay(): Promise<void> {
    await this.player?.togglePlay()
  }
  async pause(): Promise<void> {
    await this.player?.pause()
  }
  async resume(): Promise<void> {
    await this.player?.activateElement().catch(() => {})
    await this.player?.resume()
  }
  async seek(ms: number): Promise<void> {
    const clamped = Math.max(0, Math.round(ms))
    await this.player?.seek(clamped)
    // Optimistically reflect the seek so lyric sync jumps immediately.
    this.lastStateAt = performance.now()
    this.emit({ positionMs: clamped })
  }
  async setVolume(v: number): Promise<void> {
    await this.player?.setVolume(Math.min(1, Math.max(0, v)))
  }
  async getVolume(): Promise<number> {
    return (await this.player?.getVolume()) ?? 0.8
  }
  /** Browsers require a user gesture before audio; call from a click handler. */
  async activate(): Promise<void> {
    await this.player?.activateElement().catch(() => {})
  }
}

export const playerController = new PlayerController()
