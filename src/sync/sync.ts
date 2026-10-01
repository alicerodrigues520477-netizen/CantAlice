/**
 * Cloud sync orchestration.
 *
 * On login we pull the user's cloud progress, merge it with what's on this
 * device (so nothing is lost when two devices have diverged), apply the merged
 * result, and push it back. Thereafter every change is debounced and pushed.
 *
 * Merge philosophy: never silently drop a saved song or word. For per-item
 * conflicts we keep whichever copy was touched most recently.
 */
import { useEffect } from 'react'
import {
  useLibrary,
  type SavedSong,
  type VocabWord,
  type CustomPhrase,
  type PhraseCard,
} from '../store/useLibrary'
import type { TargetLang } from '../config'
import { useSession } from '../store/useSession'
import { getValidAccessToken } from '../spotify/auth'
import { IS_CLOUD_CONFIGURED } from '../config'
import { cloudGet, cloudSet } from './cloud'

export interface Snapshot {
  songs: Record<string, SavedSong>
  vocab: Record<string, VocabWord>
  streak: { count: number; lastDate: string | null }
  dailyNewLimit: number
  newStudied: { date: string | null; count: number }
  dailyGoal: number
  reviewedToday: { date: string | null; count: number }
  history: Record<string, number>
  targetLang: TargetLang
  showTranslations: boolean
  largeLyrics: boolean
  wordHintSeen: boolean
  hasOnboarded: boolean
  /** User-created phrases, keyed by target language. */
  customPhrases: Partial<Record<TargetLang, CustomPhrase[]>>
  /** Phrase review cards. Optional: snapshots saved before this field existed lack it. */
  phraseCards?: Record<string, PhraseCard>
  updatedAt: number
}

function getSnapshot(): Snapshot {
  const s = useLibrary.getState()
  return {
    songs: s.songs,
    vocab: s.vocab,
    streak: s.streak,
    dailyNewLimit: s.dailyNewLimit,
    newStudied: s.newStudied,
    dailyGoal: s.dailyGoal,
    reviewedToday: s.reviewedToday,
    history: s.history,
    targetLang: s.targetLang,
    showTranslations: s.showTranslations,
    largeLyrics: s.largeLyrics,
    wordHintSeen: s.wordHintSeen,
    hasOnboarded: s.hasOnboarded,
    customPhrases: s.customPhrases,
    phraseCards: s.phraseCards,
    updatedAt: Date.now(),
  }
}

function applySnapshot(snap: Snapshot): void {
  useLibrary.setState({
    songs: snap.songs,
    vocab: snap.vocab,
    streak: snap.streak,
    dailyNewLimit: snap.dailyNewLimit ?? 20,
    newStudied: snap.newStudied ?? { date: null, count: 0 },
    dailyGoal: snap.dailyGoal ?? 10,
    reviewedToday: snap.reviewedToday ?? { date: null, count: 0 },
    history: snap.history ?? {},
    targetLang: snap.targetLang ?? 'en',
    showTranslations: snap.showTranslations,
    largeLyrics: snap.largeLyrics,
    wordHintSeen: snap.wordHintSeen,
    hasOnboarded: snap.hasOnboarded,
    customPhrases: snap.customPhrases ?? {},
    phraseCards: snap.phraseCards ?? {},
  })
}

/**
 * Union two per-language phrase maps, deduped by id. Never drops a phrase the
 * user created on either device — mirroring the song/vocab merge philosophy, so
 * a localStorage eviction or a second device can't make "Minhas frases" vanish.
 */
function mergeCustomPhrases(
  local: Partial<Record<TargetLang, CustomPhrase[]>> | undefined,
  cloud: Partial<Record<TargetLang, CustomPhrase[]>> | undefined,
): Partial<Record<TargetLang, CustomPhrase[]>> {
  const l = local ?? {}
  const c = cloud ?? {}
  const langs = new Set<TargetLang>([
    ...(Object.keys(l) as TargetLang[]),
    ...(Object.keys(c) as TargetLang[]),
  ])
  const out: Partial<Record<TargetLang, CustomPhrase[]>> = {}
  for (const lang of langs) {
    const byId = new Map<string, CustomPhrase>()
    for (const p of c[lang] ?? []) byId.set(p.id, p)
    for (const p of l[lang] ?? []) byId.set(p.id, p)
    out[lang] = [...byId.values()].sort((a, b) => a.addedAt - b.addedAt)
  }
  return out
}

// Same rule as words: the copy with the most recent review wins, none is dropped.
const phraseTouched = (p: PhraseCard) =>
  Math.max(p.addedAt, p.srs?.fwd?.lastReview ?? 0, p.srs?.rev?.lastReview ?? 0)

function mergePhraseCards(
  local: Record<string, PhraseCard> | undefined,
  cloud: Record<string, PhraseCard> | undefined,
): Record<string, PhraseCard> {
  const out: Record<string, PhraseCard> = { ...(cloud ?? {}) }
  for (const [id, p] of Object.entries(local ?? {})) {
    const other = out[id]
    if (!other || phraseTouched(p) >= phraseTouched(other)) out[id] = p
  }
  return out
}

const songTouched = (s: SavedSong) => Math.max(s.lastPracticedAt ?? 0, s.addedAt)
// Use the most recent review so a freshly-graded card wins the merge.
const wordTouched = (w: VocabWord) =>
  Math.max(w.addedAt, w.srs?.fwd.lastReview ?? 0, w.srs?.rev.lastReview ?? 0)

/** Merge two snapshots without losing saved items. */
export function mergeSnapshots(local: Snapshot, cloud: Snapshot | null): Snapshot {
  if (!cloud) return local

  const songs: Record<string, SavedSong> = { ...cloud.songs }
  for (const [id, song] of Object.entries(local.songs)) {
    const other = songs[id]
    if (!other || songTouched(song) >= songTouched(other)) songs[id] = song
  }

  const vocab: Record<string, VocabWord> = { ...cloud.vocab }
  for (const [key, w] of Object.entries(local.vocab)) {
    const other = vocab[key]
    if (!other || wordTouched(w) >= wordTouched(other)) vocab[key] = w
  }

  // Streak: keep the entry with the later practice date (max count on a tie).
  const streak =
    (local.streak.lastDate ?? '') > (cloud.streak.lastDate ?? '')
      ? local.streak
      : (cloud.streak.lastDate ?? '') > (local.streak.lastDate ?? '')
        ? cloud.streak
        : { lastDate: local.streak.lastDate, count: Math.max(local.streak.count, cloud.streak.count) }

  // Preferences: take the more recently updated snapshot.
  const newer = local.updatedAt >= cloud.updatedAt ? local : cloud

  // New-cards-studied counter: keep the later day; max count on the same day.
  const ln = local.newStudied ?? { date: null, count: 0 }
  const cn = cloud.newStudied ?? { date: null, count: 0 }
  const newStudied =
    (ln.date ?? '') > (cn.date ?? '')
      ? ln
      : (cn.date ?? '') > (ln.date ?? '')
        ? cn
        : { date: ln.date, count: Math.max(ln.count, cn.count) }

  // Reviewed-today counter: same rule (later day wins; max count on the same day).
  const lr = local.reviewedToday ?? { date: null, count: 0 }
  const cr = cloud.reviewedToday ?? { date: null, count: 0 }
  const reviewedToday =
    (lr.date ?? '') > (cr.date ?? '')
      ? lr
      : (cr.date ?? '') > (lr.date ?? '')
        ? cr
        : { date: lr.date, count: Math.max(lr.count, cr.count) }

  // Activity history: keep the higher count for each day (no double-counting).
  const history: Record<string, number> = { ...(cloud.history ?? {}) }
  for (const [day, n] of Object.entries(local.history ?? {})) {
    history[day] = Math.max(history[day] ?? 0, n)
  }

  return {
    songs,
    vocab,
    streak,
    dailyNewLimit: newer.dailyNewLimit ?? 20,
    newStudied,
    dailyGoal: newer.dailyGoal ?? 10,
    reviewedToday,
    history,
    targetLang: newer.targetLang ?? 'en',
    showTranslations: newer.showTranslations,
    largeLyrics: newer.largeLyrics,
    wordHintSeen: local.wordHintSeen || cloud.wordHintSeen,
    hasOnboarded: local.hasOnboarded || cloud.hasOnboarded,
    customPhrases: mergeCustomPhrases(local.customPhrases, cloud.customPhrases),
    phraseCards: mergePhraseCards(local.phraseCards, cloud.phraseCards),
    updatedAt: Date.now(),
  }
}

// — Debounced push —
let saveTimer: ReturnType<typeof setTimeout> | undefined
let pushEnabled = false

function schedulePush(): void {
  if (!pushEnabled || !IS_CLOUD_CONFIGURED) return
  clearTimeout(saveTimer)
  saveTimer = setTimeout(async () => {
    const token = await getValidAccessToken()
    if (!token) return
    try {
      await cloudSet(token, getSnapshot())
    } catch {
      /* offline or transient — local copy is still saved; will retry on next change */
    }
  }, 1500)
}

/**
 * Hook (mounted once, app-wide): pulls + merges cloud progress on login, then
 * keeps the cloud in sync with local changes.
 */
export function useCloudSync(): void {
  const auth = useSession((s) => s.auth)

  useEffect(() => {
    if (!IS_CLOUD_CONFIGURED || auth !== 'loggedin') return
    let cancelled = false
    let unsub: () => void = () => {}

    ;(async () => {
      const token = await getValidAccessToken()
      if (!token || cancelled) return

      try {
        const cloud = (await cloudGet<Snapshot>(token)) ?? null
        if (cancelled) return
        const merged = mergeSnapshots(getSnapshot(), cloud)
        applySnapshot(merged)
        // Persist the merged result back to the cloud immediately.
        try {
          await cloudSet(token, getSnapshot())
        } catch {
          /* ignore */
        }
      } catch {
        /* couldn't reach cloud — carry on with local data */
      }

      if (cancelled) return
      pushEnabled = true
      unsub = useLibrary.subscribe(() => schedulePush())
    })()

    return () => {
      cancelled = true
      pushEnabled = false
      clearTimeout(saveTimer)
      unsub()
    }
  }, [auth])
}
