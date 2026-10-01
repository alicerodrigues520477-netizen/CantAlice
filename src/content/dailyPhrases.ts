/**
 * "Frases do Dia" — a few phrases a day, drawn from the curated English
 * "Frases do dia a dia" set. The pick depends only on the calendar date, so every
 * device shows (and enrolls in review) the same phrases without any storage.
 * English only: the Spanish phrasebook is deliberately not part of this.
 */
import { PHRASEBOOKS, type Phrase } from './phrasebook'

const DAILY_POOL_ID = 'dia-a-dia'
export const DAILY_COUNT = 5

/** Today's phrases for a local date key (YYYY-MM-DD): a window that advances each day. */
export function dailyPhrasesFor(dateKey: string): Phrase[] {
  const pool = PHRASEBOOKS.en.find((s) => s.id === DAILY_POOL_ID)?.phrases ?? []
  if (!pool.length) return []
  const [y, m, d] = dateKey.split('-').map(Number)
  const day = Math.floor(Date.UTC(y, m - 1, d) / 86_400_000)
  const n = Math.min(DAILY_COUNT, pool.length)
  const start = (day * n) % pool.length
  return Array.from({ length: n }, (_, i) => pool[(start + i) % pool.length])
}

/** Stable ids: a daily phrase is keyed by its text, a user phrase by its own id. */
export const dailyPhraseId = (p: Phrase): string =>
  `daily:${p.en.toLowerCase().replace(/\s+/g, ' ').trim()}`
export const minePhraseId = (customId: string): string => `mine:${customId}`
