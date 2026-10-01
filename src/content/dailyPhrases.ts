/**
 * "Frases do Dia" — a few phrases a day, drawn from every English scenario in
 * the phrasebook (café, aeroporto, médico, dia a dia, ...) so review material
 * grows into the whole phrasebook over time, not just one scenario. The pick
 * depends only on the calendar date, so every device shows (and enrolls in
 * review) the same phrases without any storage. English only: the Spanish
 * phrasebook is deliberately not part of this.
 */
import { PHRASEBOOKS, type Phrase } from './phrasebook'

export const DAILY_COUNT = 5

function allPhrases(): Phrase[] {
  return PHRASEBOOKS.en.flatMap((s) => s.phrases)
}

/** Today's phrases for a local date key (YYYY-MM-DD): a window that advances each day. */
export function dailyPhrasesFor(dateKey: string): Phrase[] {
  const pool = allPhrases()
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
