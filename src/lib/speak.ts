import { langConfig } from './lang'
import { stopSpokenAudio } from './audio'

/**
 * Speech synthesis for short phrases, in the user's target language
 * (English/Spanish) by default. Must be called from a user gesture on iOS.
 * No-ops gracefully where unsupported.
 */

export const canSpeak = typeof window !== 'undefined' && 'speechSynthesis' in window

// English only: a soft-spoken, warm, calm reading voice for pronunciation
// practice. Spanish is untouched — same pace/pitch and locale-prefix voice
// match as before. The Web Speech API has no cloud voice catalog to pick
// from (that's OpenAI/ElevenLabs territory) — the engine is whatever the
// device ships — so the best the app can do is prefer an exact en-US voice
// over any English dialect, favor a voice commonly recognized as a warmer,
// female-leaning read where the device offers a choice, and slow the pace
// down with rate/pitch.
const EN_FEMALE_VOICE_HINTS = [
  'samantha', 'victoria', 'ava', 'allison', 'susan', 'karen', 'moira', 'tessa',
  'zira', 'female', 'woman', 'google us english',
]

/** Build a ready-to-speak utterance, preferring a voice in the target locale. */
function makeUtterance(text: string, lang?: string): SpeechSynthesisUtterance {
  const locale = lang ?? langConfig().speech
  const utter = new SpeechSynthesisUtterance(text)
  utter.lang = locale
  const isEnglish = locale.toLowerCase().startsWith('en')
  utter.rate = isEnglish ? 0.8 : 0.92
  utter.pitch = isEnglish ? 0.95 : 1
  const voices = window.speechSynthesis.getVoices()
  const prefix = locale.slice(0, 2).toLowerCase()
  const pool = isEnglish
    ? voices.filter((v) => v.lang?.toLowerCase() === locale.toLowerCase())
    : voices.filter((v) => v.lang?.toLowerCase().startsWith(prefix))
  const warm = isEnglish
    ? pool.find((v) => EN_FEMALE_VOICE_HINTS.some((hint) => v.name.toLowerCase().includes(hint)))
    : undefined
  const match =
    warm ??
    pool[0] ??
    (isEnglish ? voices.find((v) => v.lang?.toLowerCase().startsWith(prefix)) : undefined)
  if (match) utter.voice = match
  return utter
}

/** Speak a short phrase aloud, cancelling anything already speaking. */
export function speak(text: string, lang?: string): void {
  const clean = text.trim()
  if (!clean) return
  const synth = window.speechSynthesis
  if (!synth) return
  try {
    stopSpokenAudio() // never talk over a cloud-voice clip
    synth.cancel() // stop anything already speaking
    synth.speak(makeUtterance(clean, lang))
  } catch {
    /* unsupported — ignore */
  }
}

/**
 * Like speak(), but returns a Promise that resolves when the utterance ends.
 * Falls back to a word-count ceiling so it always resolves on mobile where
 * the speechSynthesis `onend` event is unreliable. The ceiling is generous —
 * at rate 0.92 speech runs at roughly 350 ms per word, and resolving early
 * would let the next step start while the voice is still talking. English's
 * slower 0.8 rate (see `makeUtterance`) stretches that further, so the
 * per-word budget scales with the same rate the utterance actually uses.
 */
export function speakAndWait(text: string, lang?: string): Promise<void> {
  return new Promise((resolve) => {
    const clean = text.trim()
    if (!clean) { resolve(); return }
    const synth = typeof window !== 'undefined' ? window.speechSynthesis : null
    if (!synth) { resolve(); return }
    try {
      stopSpokenAudio()
      synth.cancel()
      const utter = makeUtterance(clean, lang)
      const wordCount = clean.split(/\s+/).length
      const msPerWord = Math.round(450 * (0.92 / utter.rate))
      const ceiling = setTimeout(resolve, wordCount * msPerWord + 2000)
      utter.onend = () => { clearTimeout(ceiling); resolve() }
      utter.onerror = () => { clearTimeout(ceiling); resolve() }
      synth.speak(utter)
    } catch {
      resolve()
    }
  })
}
