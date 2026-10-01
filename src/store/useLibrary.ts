/**
 * Alice's library + vocabulary, persisted to localStorage.
 *
 * Two collections of songs ("learning" vs "known"), a personal vocabulary of
 * words she has tapped to learn, and lightweight progress signals. Everything
 * lives on her device — no account, no server.
 */
import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { STORAGE_KEY, DEFAULT_LANG, type TargetLang } from '../config'
import type { SpotifyTrack } from '../spotify/api'
import type { Example } from '../lyrics/examples'
import { type SrsState, type Rating, newCard, isNew, schedule } from '../srs/fsrs'
import { dailyPhrasesFor, dailyPhraseId, minePhraseId } from '../content/dailyPhrases'

/** The two cards generated per word: recognize (EN→PT) and produce (PT→EN). */
export type ReviewDir = 'fwd' | 'rev'
export interface WordCards {
  fwd: SrsState
  rev: SrsState
}

export type SongStatus = 'learning' | 'known'

export interface CustomPhrase {
  id: string
  target: string
  pt: string
  addedAt: number
}

/** Where a phrase card came from: today's "Frases do Dia" or the user's own "Minhas frases". */
export type PhraseSource = 'daily' | 'mine'

/**
 * A phrase enrolled in spaced repetition. It carries the same two FSRS cards as
 * a word (recognize EN→PT, produce PT→EN) so it flows through the same queue.
 * English only for now — the Spanish deck is left untouched.
 */
export interface PhraseCard {
  id: string
  source: PhraseSource
  target: string
  pt: string
  /** Optional phonetic guide shown on the card, e.g. "dís is mai béig". */
  pronuncia?: string
  addedAt: number
  srs: WordCards
  lang: TargetLang
}

export interface SavedSong {
  id: string
  uri: string
  name: string
  artist: string
  album: string
  image: string | null
  durationMs: number
  status: SongStatus
  addedAt: number
  /** Times Alice has opened this song to practise. */
  practiceCount: number
  lastPracticedAt: number | null
  /** Language this song belongs to (defaults to 'en' for older entries). */
  lang?: TargetLang
}

export interface VocabWord {
  word: string
  translation: string
  /** A real-world example phrase (Reverso-Context style) + its translation. */
  example?: Example | null
  songName: string | null
  addedAt: number
  /** FSRS scheduling state for the word's two cards. */
  srs?: WordCards
  /** Language this word belongs to (defaults to 'en' for older entries). */
  lang?: TargetLang
}

interface LibraryState {
  songs: Record<string, SavedSong>
  vocab: Record<string, VocabWord>
  hasOnboarded: boolean
  /** Preference: show Portuguese translation under each lyric line by default. */
  showTranslations: boolean
  /** Whether the "tap any word" hint has been shown in the karaoke view. */
  wordHintSeen: boolean
  /** Preference: larger, higher-contrast karaoke lyrics. */
  largeLyrics: boolean
  /** Daily practice streak. */
  streak: { count: number; lastDate: string | null }
  /** How many brand-new cards to introduce per day in review. */
  dailyNewLimit: number
  /** New cards already introduced today (resets each calendar day). */
  newStudied: { date: string | null; count: number }
  /** Daily review goal (cards) and how many have been reviewed today. */
  dailyGoal: number
  reviewedToday: { date: string | null; count: number }
  /** Cards reviewed per calendar day (YYYY-MM-DD → count), for the activity chart. */
  history: Record<string, number>
  /** The language the user is learning (pt-BR is always the base language). */
  targetLang: TargetLang
  /** Local-only marker for the one-time translation-quality refresh. */
  translationsVersion: number
  /** User-created phrases, keyed by target language. */
  customPhrases: Partial<Record<TargetLang, CustomPhrase[]>>
  /** Phrases enrolled in spaced repetition (Frases do Dia + Minhas frases), by card id. */
  phraseCards: Record<string, PhraseCard>

  // — song actions —
  addSong: (track: SpotifyTrack, status: SongStatus) => void
  removeSong: (id: string) => void
  setStatus: (id: string, status: SongStatus) => void
  markPracticed: (id: string) => void

  // — vocab actions —
  addWord: (
    word: string,
    translation: string,
    songName: string | null,
    example?: Example | null,
  ) => void
  removeWord: (word: string) => void
  hasWord: (word: string) => boolean
  /** Attach an example to a saved word if it doesn't already have one. */
  setWordExample: (word: string, example: Example) => void
  /** Replace a saved word's example outright (e.g. "trocar frase"). */
  replaceWordExample: (word: string, example: Example) => void
  /** Grade one of a word's two cards (1=Again … 4=Easy) and reschedule it. */
  reviewCard: (word: string, dir: ReviewDir, rating: Rating) => void
  setDailyNewLimit: (n: number) => void
  setDailyGoal: (n: number) => void
  setTargetLang: (lang: TargetLang) => void
  /** Replace a saved word's translation (and its example's) after re-translating. */
  refreshWordTranslation: (word: string, translation: string, exampleTranslation?: string) => void
  setTranslationsVersion: (v: number) => void

  // — custom phrases —
  addCustomPhrase: (lang: TargetLang, target: string, pt: string) => void
  removeCustomPhrase: (lang: TargetLang, id: string) => void

  // — phrase deck (spaced repetition) —
  /**
   * Idempotently enroll today's "Frases do Dia" and every "Minha frase" in the
   * review deck. Never touches existing cards, so review progress is kept.
   * No-op outside English.
   */
  syncPhraseDeck: () => void
  /** Grade one of a phrase's two cards (1=Again … 4=Easy) and reschedule it. */
  reviewPhrase: (id: string, dir: ReviewDir, rating: Rating) => void

  // — preferences —
  toggleTranslations: () => void
  toggleLargeLyrics: () => void
  markWordHintSeen: () => void
}

/** Local date as YYYY-MM-DD (so streaks follow the user's calendar day). */
export function todayKey(d = new Date()): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(
    d.getDate(),
  ).padStart(2, '0')}`
}
function yesterdayKey(): string {
  const d = new Date()
  d.setDate(d.getDate() - 1)
  return todayKey(d)
}

/** Advance the daily streak (idempotent within the same calendar day). */
function advanceStreak(streak: { count: number; lastDate: string | null }): {
  count: number
  lastDate: string | null
} {
  const today = todayKey()
  if (streak.lastDate === today) return streak
  const continuing = streak.lastDate === yesterdayKey()
  return { count: continuing ? streak.count + 1 : 1, lastDate: today }
}

function freshCards(): WordCards {
  return { fwd: newCard(), rev: newCard() }
}

function trackToSong(track: SpotifyTrack, status: SongStatus, lang: TargetLang): SavedSong {
  return {
    id: track.id,
    uri: track.uri,
    name: track.name,
    artist: track.artists.map((a) => a.name).join(', '),
    album: track.album.name,
    image: track.album.images?.[0]?.url ?? null,
    durationMs: track.durationMs,
    status,
    addedAt: Date.now(),
    practiceCount: 0,
    lastPracticedAt: null,
    lang,
  }
}

// The à-ö/ø-ÿ split skips U+00F7 (÷), the one non-letter in Latin-1's à-ÿ run.
// Deliberately conservative: these keys index the saved vocabulary, so the
// mapping must stay stable for every word already stored.
const normWord = (w: string) => w.toLowerCase().replace(/[^a-zà-öø-ÿ'-]/gi, '')

export const useLibrary = create<LibraryState>()(
  persist(
    (set, get) => ({
      songs: {},
      vocab: {},
      hasOnboarded: false,
      showTranslations: true,
      wordHintSeen: false,
      largeLyrics: false,
      streak: { count: 0, lastDate: null },
      dailyNewLimit: 20,
      newStudied: { date: null, count: 0 },
      dailyGoal: 10,
      reviewedToday: { date: null, count: 0 },
      history: {},
      targetLang: DEFAULT_LANG,
      translationsVersion: 0,
      customPhrases: {},
      phraseCards: {},

      addSong: (track, status) =>
        set((s) => ({
          songs: {
            ...s.songs,
            // Saving (or re-saving) claims the song for the language currently
            // being studied, so it shows up in the library the user is viewing.
            [track.id]: s.songs[track.id]
              ? { ...s.songs[track.id], status, lang: s.targetLang ?? 'en' }
              : trackToSong(track, status, s.targetLang ?? 'en'),
          },
        })),

      removeSong: (id) =>
        set((s) => {
          const next = { ...s.songs }
          delete next[id]
          return { songs: next }
        }),

      setStatus: (id, status) =>
        set((s) =>
          s.songs[id]
            ? { songs: { ...s.songs, [id]: { ...s.songs[id], status } } }
            : s,
        ),

      markPracticed: (id) =>
        set((s) => {
          const streak = advanceStreak(s.streak)
          const song = s.songs[id]
          return {
            streak,
            songs: song
              ? {
                  ...s.songs,
                  [id]: {
                    ...song,
                    practiceCount: song.practiceCount + 1,
                    lastPracticedAt: Date.now(),
                  },
                }
              : s.songs,
          }
        }),

      addWord: (word, translation, songName, example) => {
        const key = normWord(word)
        if (!key) return
        set((s) => {
          const existing = s.vocab[key]
          return {
            vocab: {
              ...s.vocab,
              [key]: {
                word: word.trim(),
                translation,
                // Keep an example we already have if a new one wasn't provided.
                example: example ?? existing?.example ?? null,
                songName,
                addedAt: existing?.addedAt ?? Date.now(),
                // Never reset review progress when re-saving a word.
                srs: existing?.srs ?? freshCards(),
                lang: existing?.lang ?? (s.targetLang ?? 'en'),
              },
            },
          }
        })
      },

      removeWord: (word) =>
        set((s) => {
          const next = { ...s.vocab }
          delete next[normWord(word)]
          return { vocab: next }
        }),

      hasWord: (word) => Boolean(get().vocab[normWord(word)]),

      setWordExample: (word, example) =>
        set((s) => {
          const key = normWord(word)
          const w = s.vocab[key]
          if (!w || w.example) return s
          return { vocab: { ...s.vocab, [key]: { ...w, example } } }
        }),

      replaceWordExample: (word, example) =>
        set((s) => {
          const key = normWord(word)
          const w = s.vocab[key]
          if (!w) return s
          return { vocab: { ...s.vocab, [key]: { ...w, example } } }
        }),

      reviewCard: (word, dir, rating) =>
        set((s) => {
          const key = normWord(word)
          const w = s.vocab[key]
          if (!w) return s
          const cards = w.srs ?? freshCards()
          const wasNew = isNew(cards[dir])
          const { state } = schedule(cards[dir], rating)
          const today = todayKey()
          const studied =
            s.newStudied.date === today ? s.newStudied.count : 0
          const reviewed = s.reviewedToday.date === today ? s.reviewedToday.count : 0
          return {
            streak: advanceStreak(s.streak),
            newStudied: wasNew
              ? { date: today, count: studied + 1 }
              : { date: today, count: studied },
            reviewedToday: { date: today, count: reviewed + 1 },
            history: { ...s.history, [today]: (s.history[today] ?? 0) + 1 },
            vocab: {
              ...s.vocab,
              [key]: { ...w, srs: { ...cards, [dir]: state } },
            },
          }
        }),

      setDailyNewLimit: (n) => set({ dailyNewLimit: Math.max(0, Math.round(n)) }),

      setDailyGoal: (n) => set({ dailyGoal: Math.max(1, Math.round(n)) }),

      setTargetLang: (lang) => set({ targetLang: lang }),

      refreshWordTranslation: (word, translation, exampleTranslation) =>
        set((s) => {
          const key = normWord(word)
          const w = s.vocab[key]
          if (!w) return s
          return {
            vocab: {
              ...s.vocab,
              [key]: {
                ...w,
                translation,
                example:
                  w.example && exampleTranslation
                    ? { ...w.example, translation: exampleTranslation }
                    : w.example,
              },
            },
          }
        }),

      setTranslationsVersion: (v) => set({ translationsVersion: v }),

      addCustomPhrase: (lang, target, pt) =>
        set((s) => {
          const existing = s.customPhrases[lang] ?? []
          // The id doubles as the cross-device merge key, so make it unique
          // even for two phrases created in the same millisecond.
          const phrase: CustomPhrase = {
            id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
            target,
            pt,
            addedAt: Date.now(),
          }
          return { customPhrases: { ...s.customPhrases, [lang]: [...existing, phrase] } }
        }),

      removeCustomPhrase: (lang, id) =>
        set((s) => {
          const customPhrases = {
            ...s.customPhrases,
            [lang]: (s.customPhrases[lang] ?? []).filter((p) => p.id !== id),
          }
          // Deleting a phrase on purpose also drops its review card. Only English
          // has phrase cards, so every other language takes the original path.
          const cardId = minePhraseId(id)
          if (lang !== 'en' || !s.phraseCards?.[cardId]) return { customPhrases }
          const phraseCards = { ...s.phraseCards }
          delete phraseCards[cardId]
          return { customPhrases, phraseCards }
        }),

      syncPhraseDeck: () =>
        set((s) => {
          // English only: Spanish keeps its own phrasebook and review deck as-is.
          if ((s.targetLang ?? 'en') !== 'en') return s
          const next = { ...(s.phraseCards ?? {}) }
          let changed = false
          const enroll = (
            id: string,
            source: PhraseSource,
            target: string,
            pt: string,
            addedAt: number,
            pronuncia?: string,
          ) => {
            // Never overwrite: an existing card keeps its review history.
            if (next[id]) return
            next[id] = {
              id,
              source,
              target,
              pt,
              ...(pronuncia ? { pronuncia } : {}),
              addedAt,
              srs: freshCards(),
              lang: 'en',
            }
            changed = true
          }
          for (const p of dailyPhrasesFor(todayKey())) {
            enroll(dailyPhraseId(p), 'daily', p.en, p.pt, Date.now(), p.pronuncia)
          }
          for (const p of s.customPhrases.en ?? []) {
            enroll(minePhraseId(p.id), 'mine', p.target, p.pt, p.addedAt)
          }
          return changed ? { phraseCards: next } : s
        }),

      reviewPhrase: (id, dir, rating) =>
        set((s) => {
          const phrase = s.phraseCards?.[id]
          if (!phrase) return s
          const wasNew = isNew(phrase.srs[dir])
          const { state } = schedule(phrase.srs[dir], rating)
          const today = todayKey()
          const studied = s.newStudied.date === today ? s.newStudied.count : 0
          const reviewed = s.reviewedToday.date === today ? s.reviewedToday.count : 0
          return {
            streak: advanceStreak(s.streak),
            newStudied: { date: today, count: wasNew ? studied + 1 : studied },
            reviewedToday: { date: today, count: reviewed + 1 },
            history: { ...s.history, [today]: (s.history[today] ?? 0) + 1 },
            phraseCards: {
              ...s.phraseCards,
              [id]: { ...phrase, srs: { ...phrase.srs, [dir]: state } },
            },
          }
        }),

      toggleTranslations: () => set((s) => ({ showTranslations: !s.showTranslations })),
      toggleLargeLyrics: () => set((s) => ({ largeLyrics: !s.largeLyrics })),
      markWordHintSeen: () => set({ wordHintSeen: true }),
    }),
    { name: STORAGE_KEY,
      // Existing users have persisted state from before some fields existed
      // (e.g. targetLang). Merge over the defaults so those are never undefined.
      merge: (persisted, current) => {
        const p = (persisted ?? {}) as Partial<LibraryState>
        // Guard against corrupt/foreign values (e.g. an old cloud blob): an
        // unknown targetLang would make every language-filtered selector and
        // langConfig() misbehave.
        const raw = p.targetLang ?? current.targetLang ?? 'en'
        const targetLang: TargetLang = raw === 'en' || raw === 'es' ? raw : 'en'
        // One-time migration: songs saved before they were per-language have no
        // `lang`. Stamp them with the current language so they don't vanish from
        // the (now language-filtered) library. Idempotent — only untagged songs
        // are touched, so later loads leave already-tagged songs alone.
        let songs = p.songs
        if (songs && Object.values(songs).some((s) => s && s.lang === undefined)) {
          const stamped: Record<string, SavedSong> = {}
          for (const [id, s] of Object.entries(songs)) {
            stamped[id] = s && s.lang === undefined ? { ...s, lang: targetLang } : s
          }
          songs = stamped
        }
        return { ...current, ...p, ...(songs ? { songs } : {}), targetLang }
      },
    },
  ),
)

// Enroll today's phrases as soon as the persisted state is loaded — before the
// first render — so a cold start straight into review (e.g. the home CTA's deep
// link, or a reload on #/vocab/review) already has them in the queue. The
// usePhraseDeck hook keeps it current afterwards (new day, language switch,
// phrases arriving from another device). No-op outside English.
useLibrary.getState().syncPhraseDeck()

// — Selectors / helpers —
export function selectSongs(state: LibraryState, status: SongStatus): SavedSong[] {
  return Object.values(state.songs)
    .filter((s) => s.status === status && (s.lang ?? 'en') === (state.targetLang ?? 'en'))
    .sort((a, b) => b.addedAt - a.addedAt)
}

export function selectVocab(state: LibraryState): VocabWord[] {
  return Object.values(state.vocab)
    .filter((w) => (w.lang ?? 'en') === (state.targetLang ?? 'en'))
    .sort((a, b) => b.addedAt - a.addedAt)
}

/** Look up a saved word by its (normalized) text. */
export function selectWord(state: LibraryState, word: string): VocabWord | undefined {
  return state.vocab[normWord(word)]
}

/** The streak count, but only if it's still "alive" (practised today/yesterday). */
export function currentStreak(state: LibraryState): number {
  const { count, lastDate } = state.streak
  if (!lastDate) return 0
  return lastDate === todayKey() || lastDate === yesterdayKey() ? count : 0
}

/** Today's review-goal progress: cards reviewed vs the daily goal. */
export function selectDailyProgress(state: LibraryState): {
  done: number
  goal: number
  met: boolean
} {
  const rt = state.reviewedToday ?? { date: null, count: 0 }
  const done = rt.date === todayKey() ? rt.count : 0
  const goal = state.dailyGoal ?? 10
  return { done, goal, met: done >= goal }
}

/**
 * Pure builder for the activity chart (cards reviewed on each of the last
 * `days` calendar days, oldest first). A pure function rather than a selector
 * so callers can memoize on the stable `history` reference — selecting the
 * freshly built array directly would return a new reference every render and,
 * under useSyncExternalStore, loop ("getSnapshot should be cached").
 */
export function buildActivity(
  hist: Record<string, number>,
  days = 14,
): { date: string; label: string; count: number }[] {
  const out: { date: string; label: string; count: number }[] = []
  const d = new Date()
  d.setDate(d.getDate() - (days - 1))
  for (let i = 0; i < days; i++) {
    const key = todayKey(d)
    out.push({ date: key, label: String(d.getDate()), count: hist[key] ?? 0 })
    d.setDate(d.getDate() + 1)
  }
  return out
}

/** A word counts as "mastered" once both its cards are stable (~3+ weeks). */
const MASTERED_STABILITY_DAYS = 21
export function selectMasteredCount(state: LibraryState): number {
  let n = 0
  for (const word of Object.values(state.vocab)) {
    if ((word.lang ?? 'en') !== (state.targetLang ?? 'en')) continue
    const cards = word.srs
    if (
      cards?.fwd &&
      cards?.rev &&
      !isNew(cards.fwd) &&
      !isNew(cards.rev) &&
      cards.fwd.stability >= MASTERED_STABILITY_DAYS &&
      cards.rev.stability >= MASTERED_STABILITY_DAYS
    ) {
      n++
    }
  }
  return n
}

// — Spaced-repetition selectors —

export interface ReviewItem {
  key: string
  word: VocabWord
  dir: ReviewDir
  state: SrsState
}

/** A phrase card in the review queue (a "Frase do Dia" or one of "Minhas frases"). */
export interface PhraseReviewItem {
  kind: 'phrase'
  key: string
  phrase: PhraseCard
  dir: ReviewDir
  state: SrsState
}

export type QueueItem = ReviewItem | PhraseReviewItem
export const isPhraseItem = (i: QueueItem): i is PhraseReviewItem =>
  (i as PhraseReviewItem).kind === 'phrase'

const cardsOf = (w: VocabWord): WordCards => w.srs ?? { fwd: newCard(), rev: newCard() }

/** Phrase cards of the language being studied (always empty outside English). */
function phraseCardsOf(state: LibraryState): PhraseCard[] {
  const lang = state.targetLang ?? 'en'
  return Object.values(state.phraseCards ?? {}).filter((p) => (p.lang ?? 'en') === lang)
}

/** How many phrase cards the current language has — gates the review UI. */
export function selectPhraseCardCount(state: LibraryState): number {
  return phraseCardsOf(state).length
}

function remainingNewToday(state: LibraryState): number {
  const studied = state.newStudied.date === todayKey() ? state.newStudied.count : 0
  return Math.max(0, state.dailyNewLimit - studied)
}

/**
 * Build today's review queue: every card that's due (oldest first), followed by
 * new cards up to the remaining daily allowance. Recognition (fwd) cards lead
 * the new ones so a word is recognized before it must be produced.
 */
export function selectReviewQueue(state: LibraryState, now = Date.now()): QueueItem[] {
  const due: QueueItem[] = []
  const newFwd: ReviewItem[] = []
  const newRev: ReviewItem[] = []
  const newPhraseFwd: PhraseReviewItem[] = []
  const newPhraseRev: PhraseReviewItem[] = []
  for (const [key, word] of Object.entries(state.vocab)) {
    if ((word.lang ?? 'en') !== (state.targetLang ?? 'en')) continue
    const cards = cardsOf(word)
    for (const dir of ['fwd', 'rev'] as const) {
      const card = cards[dir]
      if (isNew(card)) (dir === 'fwd' ? newFwd : newRev).push({ key, word, dir, state: card })
      else if (card.due <= now) due.push({ key, word, dir, state: card })
    }
  }
  for (const phrase of phraseCardsOf(state)) {
    for (const dir of ['fwd', 'rev'] as const) {
      const card = phrase.srs[dir]
      const item: PhraseReviewItem = { kind: 'phrase', key: phrase.id, phrase, dir, state: card }
      if (isNew(card)) (dir === 'fwd' ? newPhraseFwd : newPhraseRev).push(item)
      else if (card.due <= now) due.push(item)
    }
  }
  due.sort((a, b) => a.state.due - b.state.due)
  newFwd.sort((a, b) => a.word.addedAt - b.word.addedAt)
  newRev.sort((a, b) => a.word.addedAt - b.word.addedAt)
  newPhraseFwd.sort((a, b) => a.phrase.addedAt - b.phrase.addedAt)
  newPhraseRev.sort((a, b) => a.phrase.addedAt - b.phrase.addedAt)
  // Phrases lead each group so the day's phrases are never starved by a long
  // backlog of words; recognition still comes before production.
  const fresh = [...newPhraseFwd, ...newFwd, ...newPhraseRev, ...newRev].slice(
    0,
    remainingNewToday(state),
  )
  return [...due, ...fresh]
}

/** Counts for badges/summaries: cards due now and new cards available today. */
export function selectReviewCounts(
  state: LibraryState,
  now = Date.now(),
): { due: number; fresh: number; total: number } {
  let due = 0
  let newAvailable = 0
  for (const word of Object.values(state.vocab)) {
    if ((word.lang ?? 'en') !== (state.targetLang ?? 'en')) continue
    const cards = cardsOf(word)
    for (const dir of ['fwd', 'rev'] as const) {
      const card = cards[dir]
      if (isNew(card)) newAvailable += 1
      else if (card.due <= now) due += 1
    }
  }
  for (const phrase of phraseCardsOf(state)) {
    for (const dir of ['fwd', 'rev'] as const) {
      const card = phrase.srs[dir]
      if (isNew(card)) newAvailable += 1
      else if (card.due <= now) due += 1
    }
  }
  const fresh = Math.min(newAvailable, remainingNewToday(state))
  return { due, fresh, total: due + fresh }
}
