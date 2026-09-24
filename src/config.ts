/**
 * Central configuration for CantAlice.
 *
 * The Spotify Client ID is PUBLIC by design — the Authorization Code with PKCE
 * flow never exposes a client secret, so it is safe to ship in a static site.
 * Replace the placeholder below with the Client ID from your own Spotify app
 * (https://developer.spotify.com/dashboard). Setup instructions live in README.md.
 *
 * You can also override it at build time with the VITE_SPOTIFY_CLIENT_ID env var,
 * which is what the GitHub Actions deploy uses if a repository secret is set.
 */
export const SPOTIFY_CLIENT_ID: string =
  (import.meta.env.VITE_SPOTIFY_CLIENT_ID as string | undefined)?.trim() ||
  'd5d938d0fe3e4f38aa84eb3a65554ea7'

/**
 * The OAuth redirect URI must EXACTLY match one registered in your Spotify app
 * settings. We compute it from the current page so it works both locally
 * (http://127.0.0.1:5173/...) and on GitHub Pages
 * (https://<user>.github.io/CantAlice/). Register BOTH there.
 *
 * Note: Spotify requires 127.0.0.1 rather than "localhost" for loopback.
 */
export function getRedirectUri(): string {
  const { origin, pathname } = window.location
  // Strip any trailing file (e.g. index.html) but keep the app base path.
  const base = pathname.replace(/\/[^/]*$/, '/')
  return `${origin}${base}`
}

/** Scopes we request from Spotify. */
export const SPOTIFY_SCOPES = [
  'streaming', // Web Playback SDK
  'user-read-email',
  'user-read-private',
  'user-read-playback-state',
  'user-modify-playback-state',
  'user-read-currently-playing',
].join(' ')

export const IS_SPOTIFY_CONFIGURED = SPOTIFY_CLIENT_ID !== 'PASTE_YOUR_SPOTIFY_CLIENT_ID_HERE'

/**
 * Optional cloud sync (Supabase). When configured, progress is saved to the
 * cloud keyed by the user's Spotify account, so it survives cache clears and
 * syncs across devices. Leave empty to run purely on-device (localStorage).
 *
 * Set these as build-time env vars (or GitHub Actions repository variables):
 *   VITE_SUPABASE_URL       e.g. https://abcdefgh.supabase.co
 *   VITE_SUPABASE_ANON_KEY  the project's public anon key
 */
export const SUPABASE_URL = (import.meta.env.VITE_SUPABASE_URL as string | undefined)?.trim() || ''
export const SUPABASE_ANON_KEY =
  (import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined)?.trim() || ''
export const IS_CLOUD_CONFIGURED = Boolean(SUPABASE_URL && SUPABASE_ANON_KEY)

export const APP_NAME = 'CantAlice'

/**
 * Target language — the language the user is learning. Portuguese (pt-BR) stays
 * the base/UI language. Each user picks one; English is the default so existing
 * users are unaffected.
 */
export type TargetLang = 'en' | 'es'
export const DEFAULT_LANG: TargetLang = 'en'

export interface LangConfig {
  code: TargetLang
  /** pt-BR name of the language, for UI copy ("inglês" / "espanhol"). */
  name: string
  /** Brand wordmark shown in the app. */
  brand: string
  /** Short tagline under the brand. */
  tagline: string
  /** BCP-47 locale for browser TTS + speech recognition. */
  speech: string
  /** DeepL source language code. */
  deepl: string
  /** Tatoeba ISO-639-3 code. */
  tatoeba: string
  /** OpenAI Whisper language code. */
  whisper: string
  /** Google Translate source code. */
  google: string
  /** MyMemory source code (paired with pt-BR). */
  myMemory: string
  /** English name of the language, for AI prompts. */
  englishName: string
  /** A sample greeting in the target language, for UI hints ("Hi!" / "¡Hola!"). */
  hello: string
  /** The learner this edition is made for, used in UI copy. */
  learner: string
  /** Example artists in the target language, for the "search a song" hint. */
  sampleArtists: string
  /** Artist suggestions for the empty search screen, in the target language. */
  suggestions: string[]
  /** Placeholder for the search box, with song examples in the target language. */
  searchPlaceholder: string
}

export const LANGUAGES: Record<TargetLang, LangConfig> = {
  en: {
    code: 'en',
    name: 'inglês',
    brand: 'CantAlice',
    tagline: 'Inglês cantando',
    speech: 'en-US',
    deepl: 'EN',
    tatoeba: 'eng',
    whisper: 'en',
    google: 'en',
    myMemory: 'en',
    englishName: 'English',
    hello: 'Hi!',
    learner: 'Alice',
    sampleArtists: 'um clássico dos Beatles ou da Adele',
    suggestions: [
      'The Beatles',
      'Adele',
      'Ed Sheeran',
      'Coldplay',
      'Frank Sinatra',
      'Taylor Swift',
      'John Legend',
      'ABBA',
    ],
    searchPlaceholder: 'Ex.: Yesterday, Someone Like You, Perfect…',
  },
  es: {
    code: 'es',
    name: 'espanhol',
    brand: 'Canta, Lohanne',
    tagline: 'Espanhol cantando',
    speech: 'es-ES',
    deepl: 'ES',
    tatoeba: 'spa',
    whisper: 'es',
    google: 'es',
    myMemory: 'es',
    englishName: 'Spanish (Castilian, from Spain)',
    hello: '¡Hola!',
    learner: 'Lohanne',
    sampleArtists: 'um sucesso da Shakira ou do Bad Bunny',
    suggestions: [
      'Shakira',
      'Bad Bunny',
      'Rosalía',
      'Luis Fonsi',
      'Maná',
      'Juanes',
      'Enrique Iglesias',
      'Álvaro Soler',
    ],
    searchPlaceholder: 'Ex.: La Tortura, Despacito, Sofía…',
  },
}

/**
 * Owner contact, used by the in-app "Pedir acesso" (request access) flow so a
 * blocked user can send you their Spotify email to be added to the app's
 * allow-list. All optional — set via env (VITE_OWNER_EMAIL / VITE_OWNER_WHATSAPP)
 * or edit here. WhatsApp must be digits only, with country code (e.g. 5511999998888).
 * If both are empty, the flow still offers "copy message".
 */
export const OWNER = {
  name: 'Jean',
  email: (import.meta.env.VITE_OWNER_EMAIL as string | undefined)?.trim() || '',
  whatsapp: (import.meta.env.VITE_OWNER_WHATSAPP as string | undefined)?.trim() || '',
}


/** LRClib — free, open, no-key synced-lyrics API. */
export const LRCLIB_BASE = 'https://lrclib.net/api'

/**
 * Translation endpoint (MyMemory) — free, CORS-friendly, no key required for
 * modest volume. Used to translate English lyric lines and words to Portuguese.
 */
export const TRANSLATE_BASE = 'https://api.mymemory.translated.net/get'

export const STORAGE_KEY = 'canta-alice:v1'
