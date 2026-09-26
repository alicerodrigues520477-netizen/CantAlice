import { useEffect, useRef, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Mic,
  Send,
  Loader2,
  Volume2,
  Lightbulb,
  Music2,
  RotateCcw,
  BookOpen,
  Play,
  MessageCircle,
  TrendingUp,
} from 'lucide-react'
import { useSession } from '../store/useSession'
import { beginLogin } from '../spotify/auth'
import { speak, canSpeak } from '../lib/speak'
import { micBlockedHint } from '../lib/record'
import { useLang } from '../lib/useLangName'
import { applyUpdate } from '../hooks/useAppUpdate'
import { useMicCapture, NOTHING_HEARD_HINT, type CaptureResult } from '../hooks/useMicCapture'
import { playBase64Mp3 } from '../lib/audio'
import {
  converse,
  blobToBase64,
  ConverseError,
  IS_CONVERSE_CONFIGURED,
  type ConverseResult,
  type Turn,
} from '../lib/converse'
import {
  MirrorComposer,
  type MirrorClip,
  type MirrorIntent,
  type MirrorPhrase,
  type MirrorReply,
} from '../components/MirrorComposer'
import { PHRASEBOOKS, type DialogLine } from '../content/phrasebook'

interface Msg {
  role: 'user' | 'assistant'
  content: string
  tip?: string
  /** pt-BR: what the tutor's line means, or what she meant to say. */
  pt?: string
  /** "Modo direto" only: the exact next line to rehearse before her turn. */
  yourTurn?: string
  /** "Modo direto" only: pt-BR progress recap every 10 of her turns. */
  progress?: string
  audio?: string | null
  hidden?: boolean
}

/** How the learner talks to the tutor. */
type Mode = 'direct' | 'mirror'

const MODES: { id: Mode; label: string; hint: (lang: string) => string }[] = [
  {
    id: 'direct',
    label: '💬 Direto',
    hint: (lang) => `Fale ou escreva em ${lang} — o tutor responde em voz e corrige com carinho.`,
  },
  {
    id: 'mirror',
    label: '🪞 Espelho',
    hint: (lang) =>
      `1) você fala em português · 2) ouça e repita em ${lang} (shadowing) · 3) toque em ` +
      `Enviar quando terminar · 4) a resposta chega em ${lang} com a legenda em português ao ` +
      `mesmo tempo — repita ela também antes de continuar.`,
  },
]

const SCENARIOS: { id: string; label: string; context: string | null; phrasebookId?: string }[] = [
  { id: 'free', label: '💬 Conversa livre', context: null },
  { id: 'cafe', label: '☕ Pedir um café', context: 'ordering at a coffee shop like Starbucks; you are the friendly barista', phrasebookId: 'cafe' },
  { id: 'restaurant', label: '🍽️ Restaurante', context: 'dining at a restaurant; you are the waiter', phrasebookId: 'restaurant' },
  { id: 'airport', label: '✈️ Aeroporto', context: 'airport check-in and boarding; you are the airline agent', phrasebookId: 'travel' },
  { id: 'shop', label: '🛍️ Loja', context: 'shopping for clothes; you are the shop assistant', phrasebookId: 'shopping' },
  { id: 'smalltalk', label: '👋 Bate-papo', context: 'casual small talk with a new friend you just met', phrasebookId: 'greetings' },
]

const KICKOFF = '(Begin: greet me in character and ask your first question.)'

const NO_FUNDS_MSG =
  '⚠️ Esta função é movida por IA e os créditos da API acabaram. Fale com o Juninho o quanto antes!'
const NOT_ALLOWED_MSG = 'Este recurso é exclusivo para os membros do app. 🙂'

function messageFromError(e: unknown, fallback: string): string {
  if (e instanceof ConverseError) {
    if (e.code === 'no_funds') return NO_FUNDS_MSG
    if (e.code === 'not_allowed') return NOT_ALLOWED_MSG
    if (e.code === 'not_configured')
      return 'O parceiro de conversa ainda não foi configurado pelo administrador.'
    if (e.code === 'unauthorized') return 'Sua sessão do Spotify expirou. Reconecte para continuar.'
    if (e.code === 'timeout') return 'A resposta demorou demais. Tente de novo.'
  }
  return fallback
}

export function ConversationPage() {
  const lang = useLang()
  const langName = lang.name
  const auth = useSession((s) => s.auth)
  const [scenarioId, setScenarioId] = useState('free')
  const [mode, setMode] = useState<Mode>('direct')
  const [messages, setMessages] = useState<Msg[]>([])
  const [busy, setBusy] = useState(false)
  const [text, setText] = useState('')
  const [error, setError] = useState<string | null>(null)
  // True while the mirror composer has its own mic open — the page-level
  // guards (mode/scenario switches) must respect that capture too.
  const [mirrorCapturing, setMirrorCapturing] = useState(false)

  // Direct-mode microphone (shared engine with the mirror composer).
  const mic = useMicCapture()
  const listening = mic.capturing
  const micActive = listening || mirrorCapturing
  const scrollRef = useRef<HTMLDivElement>(null)

  const scenario = SCENARIOS.find((s) => s.id === scenarioId) ?? SCENARIOS[0]

  // The example dialogue for the chosen scenario (read it before practising),
  // in the language being learned. 'free' chat has none.
  const templateDialog: DialogLine[] | undefined = scenario.phrasebookId
    ? PHRASEBOOKS[lang.code]?.find((s) => s.id === scenario.phrasebookId)?.dialog
    : undefined
  const conversationActive = messages.length > 0 || busy

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' })
  }, [messages, busy])

  const historyTurns = (): Turn[] => messages.map((m) => ({ role: m.role, content: m.content }))

  // Always speak the reply in the natural cloud voice; fall back to the browser
  // voice only if the server couldn't synthesize audio.
  const voiceReply = (r: ConverseResult) => {
    if (r.audio) void playBase64Mp3(r.audio)
    else if (canSpeak) speak(r.reply)
  }

  const send = async (opts: {
    text?: string
    audioBase64?: string
    audioMime?: string
    /** Show this as the user's bubble immediately, before the reply arrives. */
    display?: string
    /** pt-BR sub-line under her bubble (what she meant, in "espelho"). */
    displayPt?: string
    /** Skip the automatic voice playback — "espelho" plays the reply itself,
     * as the shadowing step's own audio, once the caller has it in hand. */
    skipAutoVoice?: boolean
  }): Promise<ConverseResult | null> => {
    setBusy(true)
    setError(null)
    const history = historyTurns()
    if (opts.display)
      setMessages((prev) => [
        ...prev,
        { role: 'user', content: opts.display!, pt: opts.displayPt },
      ])
    try {
      const r = await converse({
        scenario: scenario.context,
        history,
        wantAudio: true,
        text: opts.text,
        audioBase64: opts.audioBase64,
        audioMime: opts.audioMime,
        // In "espelho" she's still learning to follow along — bring the
        // Portuguese of the tutor's line back with it.
        explain: mode === 'mirror',
      })
      setMessages((prev) => {
        const next = [...prev]
        // If we didn't already show the user's message (Whisper path), add it now.
        if (!opts.display) next.push({ role: 'user', content: r.transcript })
        next.push({
          role: 'assistant',
          content: r.reply,
          tip: r.tip,
          pt: r.translation,
          yourTurn: r.yourTurn,
          progress: r.progress,
          audio: r.audio,
        })
        return next
      })
      if (!opts.skipAutoVoice) voiceReply(r)
      return r
    } catch (e) {
      // The turn failed: take the optimistic bubble back and restore the text to
      // the composer so a retry is one tap away (nothing was answered). In
      // "espelho" the composer keeps the sentence instead, so leave it alone.
      if (opts.display) {
        setMessages((prev) => prev.slice(0, -1))
        if (opts.text && mode === 'direct') setText(opts.text)
      }
      setError(messageFromError(e, 'Algo deu errado. Tente de novo.'))
      return null
    } finally {
      setBusy(false)
    }
  }

  const startScenario = async (id: string) => {
    setScenarioId(id)
    setMessages([])
    setError(null)
    const ctx = SCENARIOS.find((s) => s.id === id)?.context ?? null
    setBusy(true)
    try {
      const r = await converse({
        scenario: ctx,
        history: [],
        text: KICKOFF,
        wantAudio: true,
        explain: mode === 'mirror',
      })
      setMessages([
        { role: 'user', content: KICKOFF, hidden: true },
        {
          role: 'assistant',
          content: r.reply,
          tip: r.tip,
          pt: r.translation,
          yourTurn: r.yourTurn,
          progress: r.progress,
          audio: r.audio,
        },
      ])
      voiceReply(r)
    } catch (e) {
      setError(messageFromError(e, 'Não consegui iniciar agora. Tente de novo.'))
    } finally {
      setBusy(false)
    }
  }

  const selectScenario = (id: string) => {
    setScenarioId(id)
    setMessages([])
    setError(null)
  }

  const sendText = () => {
    const t = text.trim()
    // Not while the mic is open: the input is showing the live partial then,
    // and sending the older typed text would race the capture.
    if (!t || busy || listening) return
    setText('')
    void send({ text: t, display: t })
  }

  // The mic is hers to close: tap to open, speak without hurry, tap again to
  // send. The capture engine (held recognition with a recording fallback for
  // browsers that won't listen, like the installed iPhone/iPad app) lives in
  // useMicCapture and is shared with the mirror composer.
  const handleCapture = async (r: CaptureResult) => {
    switch (r.kind) {
      case 'text':
        await send({ text: r.text, display: r.text })
        return
      case 'clip':
        void send({ audioBase64: await blobToBase64(r.blob), audioMime: r.mime })
        return
      case 'empty':
        setError(r.blocked ? micBlockedHint() : NOTHING_HEARD_HINT)
        return
      case 'noop':
        return
    }
  }

  // The auto-stop callback runs from a closure created when the capture
  // started; this ref keeps it pointing at the *current* handler.
  const captureRef = useRef(handleCapture)
  useEffect(() => {
    captureRef.current = handleCapture
  })

  const startListening = async () => {
    if (busy || listening) return
    setError(null)
    const res = await mic.start({ onAutoStop: (r) => void captureRef.current(r) })
    if (!res.ok && res.reason !== 'canceled') {
      setError(
        res.reason === 'unsupported'
          ? micBlockedHint()
          : 'Não consegui acessar o microfone. Você pode digitar em vez disso.',
      )
    }
  }

  /** Second tap — close the mic and send what she said. */
  const stopListening = async () => {
    await handleCapture(await mic.stop())
  }

  const onMic = () => {
    if (listening) void stopListening()
    else void startListening()
  }

  // — "Modo espelho" —

  /** She said it in Portuguese: ask for the sentence to say out loud. */
  const mirrorIntent = async (intent: MirrorIntent): Promise<MirrorPhrase | null> => {
    setError(null)
    try {
      const r = await converse({
        mode: 'say',
        scenario: scenario.context,
        history: historyTurns(),
        wantAudio: true,
        text: intent.text,
        audioBase64: intent.audioBase64,
        audioMime: intent.audioMime,
      })
      if (!r.reply.trim()) {
        setError('Não consegui montar a frase. Tente dizer de outro jeito.')
        return null
      }
      return { pt: r.transcript, say: r.reply, note: r.tip, audio: r.audio }
    } catch (e) {
      setError(messageFromError(e, 'Não consegui montar a frase agora. Tente de novo.'))
      return null
    }
  }

  /**
   * Transcribe a recorded repetition. Only used where the browser won't listen
   * (an installed app on iPhone/iPad), so the practice still works there.
   */
  const mirrorHear = async (clip: MirrorClip): Promise<string | null> => {
    setError(null)
    try {
      const r = await converse({
        mode: 'hear',
        history: [],
        wantAudio: false,
        audioBase64: clip.audioBase64,
        audioMime: clip.audioMime,
      })
      return r.transcript
    } catch (e) {
      setError(messageFromError(e, 'Não consegui ouvir agora. Tente de novo.'))
      return null
    }
  }

  /**
   * She repeated it — now it counts as her turn in the conversation. Hands
   * back the interlocutor's reply so the composer can offer it to shadow
   * next; the reply's own voice plays there, not here.
   */
  const mirrorSend = async (phrase: MirrorPhrase): Promise<MirrorReply | null> => {
    const r = await send({
      text: phrase.say,
      display: phrase.say,
      displayPt: phrase.pt,
      skipAutoVoice: true,
    })
    return r ? { reply: r.reply, audio: r.audio, pt: r.translation } : null
  }

  // — Gates —
  if (!IS_CONVERSE_CONFIGURED) {
    return (
      <Centered title="Parceiro de conversa">
        <p className="text-mist/70">Este recurso precisa do backend configurado (Supabase + chaves de IA).</p>
      </Centered>
    )
  }
  if (auth !== 'loggedin') {
    return (
      <Centered title="Parceiro de conversa">
        <p className="text-mist/70">Conecte sua conta do Spotify para conversar com o tutor de IA.</p>
        <button onClick={() => beginLogin()} className="btn-primary mt-4">
          <Music2 size={18} /> Conectar com o Spotify
        </button>
      </Centered>
    )
  }

  const visible = messages.filter((m) => !m.hidden)

  return (
    // A flat rem guess for the bottom-bar clearance kept working on some
    // phones and not others: notched phones report a real
    // env(safe-area-inset-bottom) for the home-indicator area (tens of px)
    // that a plain iPad browser tab reports as 0, so any single constant is
    // wrong for one side or the other. Compute it instead: top bar (fixed
    // h-16) 4rem + main's own pt-6 1.5rem + the bottom pill (fixed
    // h-[4.5rem]) 4.5rem + its mb-3 0.75rem = 10.75rem of known chrome, plus
    // MobileBar's own pb-safe (max(0.75rem, env(safe-area-inset-bottom))) —
    // the same expression that class applies, kept in sync with it — plus a
    // small fixed cushion for subpixel rounding, since this is now an exact
    // sum rather than a padded guess.
    //
    // overflow-y-auto is the safety net for when that math is still short —
    // e.g. the mic's "ouvindo…" hint wrapping to an extra line on a narrow
    // phone can grow the composer past what's left after the header/mode
    // switch/scenario chips. flex-col with a fixed height doesn't clip
    // overflowing children on its own, so without this the composer's own
    // buttons render past this div's bottom edge — under the fixed nav,
    // unclickable, instead of one scroll away.
    <div className="flex h-[calc(100dvh-11.25rem-max(0.75rem,env(safe-area-inset-bottom)))] flex-col gap-3 overflow-y-auto lg:h-[calc(100dvh-3rem)] lg:gap-4">
      <div className="flex shrink-0 items-start justify-between gap-3">
        <div>
          <h1 className="font-display text-3xl sm:text-4xl">Conversar</h1>
          <p className="mt-1 text-sm text-mist/65">
            {(MODES.find((m) => m.id === mode) ?? MODES[0]).hint(langName)}
          </p>
        </div>
        {/* Escape hatch: if the screen ever freezes, this reloads everything
            fresh so there's no need to close and reopen the app. */}
        <button
          onClick={() => applyUpdate()}
          title="Recarregar a conversa"
          className="flex shrink-0 items-center gap-1.5 rounded-full bg-white/8 px-3 py-1.5 text-xs text-mist/70 transition-colors hover:bg-white/15 hover:text-cream"
        >
          <RotateCcw size={14} /> Recarregar
        </button>
      </div>

      {/* Mode switch — how she talks to the tutor */}
      <div className="flex shrink-0 gap-2">
        {MODES.map((m) => (
          <button
            key={m.id}
            onClick={() => setMode(m.id)}
            // Also blocked while the mic is open: switching now would hide the
            // stop button with the recorder still running, or land the turn
            // that's already on its way in the mode she just left.
            disabled={busy || micActive}
            aria-pressed={m.id === mode}
            className={`rounded-full px-4 py-1.5 text-sm font-medium transition-colors disabled:opacity-50 ${
              m.id === mode ? 'bg-aurora-3/25 text-cream' : 'bg-white/8 text-mist/70 hover:bg-white/15'
            }`}
          >
            {m.label}
          </button>
        ))}
      </div>

      {/* Scenario chips — one scrolling row on a phone, so they can't eat the
          height the conversation and the mic controls need. */}
      <div className="-mx-1 flex shrink-0 gap-2 overflow-x-auto px-1 pb-1 sm:flex-wrap sm:overflow-visible">
        {SCENARIOS.map((s) => (
          <button
            key={s.id}
            onClick={() => selectScenario(s.id)}
            // Also blocked while the mic is open — switching then would wipe
            // the conversation and land the capture in the new scenario.
            disabled={busy || micActive}
            className={`shrink-0 rounded-full px-3 py-1.5 text-sm transition-colors disabled:opacity-50 ${
              s.id === scenarioId ? 'bg-rose-400/25 text-rose-100' : 'bg-white/8 text-mist/70 hover:bg-white/15'
            }`}
          >
            {s.label}
          </button>
        ))}
      </div>

      {/* Conversation */}
      {/* min-h-0 lets this pane give way when the mirror panel grows — without
          it the composer gets pushed under the browser's toolbar. */}
      <div
        ref={scrollRef}
        className="glass min-h-0 flex-1 space-y-3 overflow-y-auto rounded-3xl p-4"
      >
        {!conversationActive && templateDialog && templateDialog.length > 0 ? (
          <TemplateDialogPanel
            dialog={templateDialog}
            onStart={() => startScenario(scenarioId)}
            busy={busy || micActive}
          />
        ) : !conversationActive ? (
          <div className="flex h-full flex-col items-center justify-center gap-3 text-center text-mist/50">
            <Mic size={28} />
            <p>Escolha uma situação acima, ou toque no microfone e diga “{lang.hello}”.</p>
            <button
              onClick={() => startScenario(scenarioId)}
              // Also blocked while the mic is open — a kickoff arriving while
              // the capture is still going would interleave two turns.
              disabled={busy || micActive}
              className="mt-1 flex items-center gap-2 rounded-full bg-rose-400/20 px-5 py-2 text-sm text-rose-100 transition-colors hover:bg-rose-400/30 disabled:opacity-50"
            >
              <Play size={14} /> Começar conversa
            </button>
          </div>
        ) : null}
        {visible.map((m, i) => (
          <Bubble key={i} msg={m} micActive={micActive} />
        ))}
        {busy && (
          <div className="flex items-center gap-2 text-sm text-mist/50">
            <Loader2 size={16} className="animate-spin" /> pensando…
          </div>
        )}
      </div>

      {error && (
        <div className="rounded-2xl bg-rose-500/15 px-4 py-2.5 text-center text-sm font-medium text-rose-100">
          {error}
        </div>
      )}

      {/* Composer — "espelho" swaps in its own say-it-first flow. shrink-0 so
          its controls stay on screen no matter how tall the panel gets. */}
      <div className="shrink-0">
      {mode === 'mirror' ? (
        // Keyed by scenario: changing it wipes the conversation, so a phrase
        // prepared for the old scene must not stay on screen to be sent into
        // the new one.
        <MirrorComposer
          key={scenarioId}
          langName={langName}
          busy={busy}
          onIntent={mirrorIntent}
          onHear={mirrorHear}
          onSend={mirrorSend}
          onCapturingChange={setMirrorCapturing}
        />
      ) : (
      <div className="flex items-center gap-2">
        <button
          onClick={onMic}
          disabled={busy}
          aria-pressed={listening}
          title={listening ? 'Pronto — enviar o que eu disse' : 'Falar'}
          aria-label={listening ? 'Pronto — enviar o que eu disse' : 'Falar'}
          className={`grid h-12 w-12 shrink-0 place-items-center rounded-2xl transition-colors disabled:opacity-50 ${
            listening ? 'bg-rose-500/80 text-white' : 'bg-white/8 text-aurora-3 hover:bg-white/15'
          }`}
        >
          <Mic size={20} className={listening ? 'animate-pulse' : ''} />
        </button>
        <input
          value={listening ? mic.partial : text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && !e.nativeEvent.isComposing && sendText()}
          placeholder={
            listening
              ? 'ouvindo… fale sem pressa e toque no microfone quando terminar'
              : `ou escreva em ${langName}…`
          }
          disabled={listening || busy}
          className="flex-1 rounded-2xl border border-white/12 bg-white/5 px-4 py-3 outline-none placeholder:text-mist/35 focus:border-aurora-3/50 disabled:opacity-50"
        />
        <button
          onClick={sendText}
          disabled={busy || listening || !text.trim()}
          aria-label="Enviar"
          className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-white/8 text-cream hover:bg-white/15 disabled:opacity-40"
        >
          <Send size={18} />
        </button>
      </div>
      )}
      </div>
    </div>
  )
}

function TemplateDialogPanel({
  dialog,
  onStart,
  busy,
}: {
  dialog: DialogLine[]
  onStart: () => void
  busy: boolean
}) {
  return (
    <div className="flex h-full flex-col">
      <div className="mb-4 flex items-center gap-2 text-sm font-medium text-mist/60">
        <BookOpen size={15} />
        <span>Leia o diálogo de exemplo antes de praticar</span>
      </div>
      <div className="flex-1 space-y-2 overflow-y-auto">
        {dialog.map((line, i) => {
          const isYou = line.who === 'you'
          return (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.04 }}
              className={`flex ${isYou ? 'justify-end' : 'justify-start'}`}
            >
              <div className={`max-w-[85%] space-y-0.5 ${isYou ? 'items-end' : 'items-start'}`}>
                <p className={`text-[10px] font-medium uppercase tracking-wide ${isYou ? 'text-right text-rose-300/60' : 'text-mist/40'}`}>
                  {isYou ? 'você' : 'eles'}
                </p>
                <div className={`rounded-2xl px-3.5 py-2.5 ${isYou ? 'bg-rose-400/20 text-cream' : 'bg-white/8 text-cream'}`}>
                  <p className="leading-snug">{line.en}</p>
                  <p className="mt-0.5 text-xs text-mist/50">{line.pt}</p>
                </div>
              </div>
            </motion.div>
          )
        })}
      </div>
      <div className="pt-4 text-center">
        <button
          onClick={onStart}
          disabled={busy}
          className="inline-flex items-center gap-2 rounded-full bg-rose-400/25 px-6 py-2.5 text-sm font-medium text-rose-100 transition-colors hover:bg-rose-400/35 disabled:opacity-50"
        >
          <Play size={14} /> Começar a praticar
        </button>
      </div>
    </div>
  )
}

function Bubble({ msg, micActive }: { msg: Msg; micActive: boolean }) {
  const mine = msg.role === 'user'
  const replay = () => {
    if (msg.audio) void playBase64Mp3(msg.audio)
    else if (canSpeak) speak(msg.content)
  }
  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      className={`flex ${mine ? 'justify-end' : 'justify-start'}`}
    >
      <div className={`max-w-[85%] ${mine ? 'items-end' : 'items-start'}`}>
        <div
          className={`flex items-start gap-2 rounded-2xl px-3.5 py-2.5 ${
            mine ? 'bg-rose-400/20 text-cream' : 'bg-white/8 text-cream'
          }`}
        >
          {!mine && (canSpeak || msg.audio) && (
            <button
              onClick={replay}
              // While a mic is open, replaying an old line would feed its
              // audio right back into the recognizer.
              disabled={micActive}
              title="Ouvir de novo"
              className="mt-0.5 shrink-0 text-aurora-3 hover:text-cream disabled:opacity-40"
            >
              <Volume2 size={15} />
            </button>
          )}
          <div className="space-y-0.5">
            <p className="leading-snug">{msg.content}</p>
            {/* In "espelho": for the tutor, this is the pt-BR subtitle running
                simultaneously with her line (step 4); for the learner's own
                bubble, it's what she meant to say. */}
            {msg.pt && (
              <p className="text-xs italic text-mist/55">
                {!mine && <span className="not-italic">🇧🇷 </span>}
                {msg.pt}
              </p>
            )}
          </div>
        </div>
        <AnimatePresence>
          {msg.yourTurn && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              className="mt-1 flex items-start gap-1.5 rounded-xl bg-aurora-3/10 px-3 py-1.5 text-xs text-aurora-3"
            >
              <MessageCircle size={13} className="mt-0.5 shrink-0" />
              <span>
                Sua vez: <span className="italic">“{msg.yourTurn}”</span>
              </span>
            </motion.div>
          )}
          {msg.tip && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              className="mt-1 flex items-start gap-1.5 rounded-xl bg-gold/10 px-3 py-1.5 text-xs text-gold/90"
            >
              <Lightbulb size={13} className="mt-0.5 shrink-0" />
              <span>{msg.tip}</span>
            </motion.div>
          )}
          {msg.progress && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              className="mt-1 flex items-start gap-1.5 rounded-xl bg-rose-400/10 px-3 py-1.5 text-xs text-rose-200"
            >
              <TrendingUp size={13} className="mt-0.5 shrink-0" />
              <span>{msg.progress}</span>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </motion.div>
  )
}

function Centered({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="space-y-6">
      <h1 className="font-display text-4xl sm:text-5xl">{title}</h1>
      <div className="glass flex flex-col items-center gap-2 rounded-3xl p-10 text-center">{children}</div>
    </div>
  )
}
