/**
 * Client for the `converse` Edge Function — the AI conversation partner.
 * Sends a typed message or a recorded audio clip plus the recent history, and
 * gets back a transcript, the tutor's reply, an optional pt-BR correction, and
 * the reply spoken as audio.
 */
import { SUPABASE_URL, SUPABASE_ANON_KEY, IS_CLOUD_CONFIGURED } from '../config'
import { getValidAccessToken } from '../spotify/auth'
import { activeLang } from './lang'

export interface Turn {
  role: 'user' | 'assistant'
  content: string
}

export interface ConverseResult {
  /** What the user said (in the target language, or in pt-BR for mode 'say'). */
  transcript: string
  /** The tutor's reply — or, in mode 'say', the sentence for the user to say. */
  reply: string
  tip: string
  /** pt-BR translation of `reply`, when `explain` was asked for. */
  translation: string
  /** The exact next line to rehearse out loud, from "modo direto"'s coaching routine. */
  yourTurn: string
  /** pt-BR progress recap every 10 learner turns (direct mode only), or "". */
  progress: string
  /** Base64 mp3 of the spoken reply, or null. */
  audio: string | null
  /**
   * Which step of the shadowing flow this answers: 'shadow' — `reply`/`audio`
   * are the sentence to repeat (mode 'say'); 'reply' — the interlocutor's next
   * line, with `translation` as its simultaneous pt-BR subtitle (mode 'chat');
   * 'hear' — transcript only (mode 'hear').
   */
  stage: 'shadow' | 'reply' | 'hear' | ''
}

export const IS_CONVERSE_CONFIGURED = IS_CLOUD_CONFIGURED

function endpoint(): string {
  return `${SUPABASE_URL.replace(/\/$/, '')}/functions/v1/converse`
}

export class ConverseError extends Error {
  constructor(
    public code:
      | 'not_configured'
      | 'unauthorized'
      | 'not_allowed'
      | 'no_funds'
      | 'timeout'
      | 'failed',
  ) {
    super(code)
  }
}

export async function converse(input: {
  scenario?: string | null
  history: Turn[]
  text?: string
  audioBase64?: string
  audioMime?: string
  /** Ask the server to also synthesize the reply (cloud "natural" voice). */
  wantAudio?: boolean
  /**
   * 'chat' (default) — talk to the tutor in the language being learned.
   * 'say' — tell it in Portuguese what you want to say and get the sentence
   * back in the target language ("modo espelho").
   * 'hear' — just transcribe the clip (used where the browser won't listen).
   */
  mode?: 'chat' | 'say' | 'hear'
  /** Also return a pt-BR translation of the reply (chat mode only). */
  explain?: boolean
}): Promise<ConverseResult> {
  const token = await getValidAccessToken()
  if (!token) throw new ConverseError('unauthorized')

  // Don't let a turn hang forever — fail fast with a clear message. Audio
  // turns get longer: uploading a clip on a slow connection plus Whisper,
  // Claude and TTS can legitimately take a while.
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), input.audioBase64 ? 75_000 : 40_000)

  let res: Response
  try {
    res = await fetch(endpoint(), {
      method: 'POST',
      headers: {
        apikey: SUPABASE_ANON_KEY,
        Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
        'x-spotify-token': token,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        scenario: input.scenario ?? null,
        history: input.history,
        text: input.text,
        audio: input.audioBase64,
        audioMime: input.audioMime,
        speak: input.wantAudio === true,
        lang: activeLang(),
        mode: input.mode ?? 'chat',
        explain: input.explain === true,
      }),
      signal: controller.signal,
    })
  } catch (e) {
    throw new ConverseError((e as Error)?.name === 'AbortError' ? 'timeout' : 'failed')
  } finally {
    clearTimeout(timer)
  }

  if (res.status === 503) throw new ConverseError('not_configured')
  if (res.status === 401) throw new ConverseError('unauthorized')
  if (res.status === 403) throw new ConverseError('not_allowed')
  if (res.status === 402) throw new ConverseError('no_funds')
  if (!res.ok) throw new ConverseError('failed')
  // Normalize: a function deployed before "modo espelho"/`stage` won't send
  // `translation`/`stage`.
  const data = (await res.json()) as Partial<ConverseResult>
  return {
    transcript: data.transcript ?? '',
    reply: data.reply ?? '',
    tip: data.tip ?? '',
    translation: data.translation ?? '',
    yourTurn: data.yourTurn ?? '',
    progress: data.progress ?? '',
    audio: data.audio ?? null,
    stage: data.stage ?? '',
  }
}

/** Read a recorded Blob as a bare base64 string (no data: prefix). */
export function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onloadend = () => {
      const result = reader.result as string
      resolve(result.slice(result.indexOf(',') + 1))
    }
    reader.onerror = reject
    reader.readAsDataURL(blob)
  })
}
