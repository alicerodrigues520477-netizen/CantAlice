import { useEffect, useMemo, useRef, useState } from 'react'
import { motion } from 'framer-motion'
import { Volume2, PartyPopper, Eye, Loader2, Mic, RefreshCw } from 'lucide-react'
import {
  useLibrary,
  selectReviewQueue,
  isPhraseItem,
  type QueueItem,
  type VocabWord,
} from '../store/useLibrary'
import { previewIntervals, formatInterval, type Rating } from '../srs/fsrs'
import { fetchExample, fetchExamples } from '../lyrics/examples'
import { speak, canSpeak } from '../lib/speak'
import { canListen, listenOnce, foldForCompare } from '../lib/listen'
import { SpeakableText } from './SpeakableText'
import { PhraseReviewBody } from './PhraseReviewCard'
import { useUI } from '../store/useUI'
import { useLangName } from '../lib/useLangName'

/** Blank out the target word in an example so it can be produced from context. */
function cloze(text: string, word: string) {
  // A capture group instead of \b: the ASCII word boundary never matches
  // before an accent-initial word ("árbol", "él"), which would leave the
  // answer visible on the card.
  const re = new RegExp(`(^|[^\\p{L}])${word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\p{L}*`, 'iu')
  return text.replace(re, '$1_____')
}

// Accent-folded so "esta" counts for "está" — she is recalling the word, not
// taking a spelling test (and the mic answer never comes back accented right).
const tokenize = (s: string): string[] => foldForCompare(s).match(/[a-z']+/g) ?? []

/**
 * Lenient answer check for the production card: the learner is "right" if what
 * they typed/said contains the target word(s) as whole tokens — so writing or
 * speaking the full phrase ("Stand still") counts, not just the bare word.
 */
function answerMatches(typed: string, target: string): boolean {
  const said = tokenize(typed)
  const want = tokenize(target)
  if (!want.length || !said.length) return false
  for (let i = 0; i + want.length <= said.length; i++) {
    if (want.every((w, j) => said[i + j] === w)) return true
  }
  return false
}

const RATINGS: { rating: Rating; label: string; cls: string }[] = [
  { rating: 1, label: 'Errei', cls: 'bg-rose-500/25 text-rose-200 hover:bg-rose-500/35' },
  { rating: 2, label: 'Difícil', cls: 'bg-amber-500/20 text-amber-200 hover:bg-amber-500/30' },
  { rating: 3, label: 'Bom', cls: 'bg-emerald-500/20 text-emerald-200 hover:bg-emerald-500/30' },
  { rating: 4, label: 'Fácil', cls: 'bg-sky-500/20 text-sky-200 hover:bg-sky-500/30' },
]

export function ReviewSession({ onExit }: { onExit: () => void }) {
  const reviewCard = useLibrary((s) => s.reviewCard)
  const reviewPhrase = useLibrary((s) => s.reviewPhrase)
  const setWordExample = useLibrary((s) => s.setWordExample)
  const replaceWordExample = useLibrary((s) => s.replaceWordExample)

  // Snapshot the queue at session start; "Errei" cards are re-queued in-session.
  const [queue, setQueue] = useState<QueueItem[]>(() => selectReviewQueue(useLibrary.getState()))
  const [pos, setPos] = useState(0)
  const [swapping, setSwapping] = useState(false)
  const [revealed, setRevealed] = useState(false)
  const [typed, setTyped] = useState('')
  const [reviewed, setReviewed] = useState(0)
  const [fetchingPhrase, setFetchingPhrase] = useState(false)

  const item = queue[pos]
  const curKey = item?.key
  const phraseItem = item && isPhraseItem(item) ? item : null
  // Read the live word so freshly-graded SRS state and lazily-fetched example
  // phrases are reflected immediately.
  const liveWord = useLibrary((s) => (curKey && !phraseItem ? s.vocab[curKey] : undefined))
  const livePhrase = useLibrary((s) => (phraseItem ? s.phraseCards?.[phraseItem.key] : undefined))

  // Every card must show a real English phrase. If an older saved word has none,
  // fetch one on the fly (e.g. words saved before example phrases existed).
  useEffect(() => {
    if (!liveWord || liveWord.example?.text) {
      setFetchingPhrase(false)
      return
    }
    let alive = true
    setFetchingPhrase(true)
    fetchExample(liveWord.word).then((ex) => {
      if (!alive) return
      if (ex) setWordExample(liveWord.word, ex)
      setFetchingPhrase(false)
    })
    return () => {
      alive = false
    }
  }, [liveWord, setWordExample])

  const liveState = !item
    ? undefined
    : phraseItem
      ? livePhrase?.srs[item.dir]
      : liveWord?.srs?.[item.dir]
  const intervals = useMemo(
    () => (item ? previewIntervals(liveState ?? item.state) : null),
    [item, liveState],
  )

  // Keyboard shortcuts: Space/Enter reveals, 1–4 grades. A ref holds the latest
  // handlers so the listener (mounted once) always calls the current card's.
  const keyApi = useRef<{
    revealed: boolean
    reveal: () => void
    grade: (r: Rating) => void
  } | null>(null)
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const api = keyApi.current
      if (!api) return
      const tag = (document.activeElement?.tagName ?? '').toLowerCase()
      const typing = tag === 'input' || tag === 'textarea'
      if (!api.revealed) {
        if (!typing && (e.key === ' ' || e.key === 'Enter')) {
          e.preventDefault()
          api.reveal()
        }
      } else if (e.key >= '1' && e.key <= '4') {
        e.preventDefault()
        api.grade(Number(e.key) as Rating)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  if (!item) {
    keyApi.current = null
    return (
      <motion.div
        initial={{ opacity: 0, scale: 0.96 }}
        animate={{ opacity: 1, scale: 1 }}
        className="mx-auto flex max-w-md flex-col items-center gap-5 py-10 text-center"
      >
        <span className="grid h-20 w-20 place-items-center rounded-full bg-emerald-400/15 text-emerald-300">
          <PartyPopper size={36} />
        </span>
        <h2 className="font-display text-3xl">
          {reviewed > 0 ? 'Revisão concluída! 🎉' : 'Nada para revisar agora'}
        </h2>
        <p className="text-mist/70">
          {reviewed > 0
            ? `Você revisou ${reviewed} ${reviewed === 1 ? 'cartão' : 'cartões'} hoje. Volte amanhã para fixar de vez. 💛`
            : 'Guarde palavras nas músicas e elas aparecem aqui para revisar no momento certo.'}
        </p>
        <button onClick={onExit} className="btn-primary">
          Voltar ao vocabulário
        </button>
      </motion.div>
    )
  }

  const word: VocabWord | undefined = isPhraseItem(item) ? undefined : (liveWord ?? item.word)
  const { dir } = item

  const grade = (rating: Rating) => {
    if (isPhraseItem(item)) reviewPhrase(item.key, dir, rating)
    else reviewCard(item.key, dir, rating)
    // Celebrate the moment she reaches today's goal (fires once, on crossing).
    const { reviewedToday, dailyGoal } = useLibrary.getState()
    if (reviewedToday.count === dailyGoal) {
      useUI.getState().celebrate(`Meta de hoje concluída! ${dailyGoal} revisões 🎉`)
    }
    setRevealed(false)
    setTyped('')
    if (rating === 1) {
      // Re-queue the missed card a few positions later in this session.
      setQueue((q) => {
        const next = [...q]
        const [cur] = next.splice(pos, 1)
        next.splice(Math.min(next.length, pos + 5), 0, cur)
        return next
      })
      // pos now points at the following card already.
    } else {
      setReviewed((n) => n + 1)
      setPos((p) => p + 1)
    }
  }

  const reveal = () => setRevealed(true)
  const typedCorrect = revealed && dir === 'rev' && !!word && answerMatches(typed, word.word)

  // Fetch a fresh example for this word (e.g. when the current one is an
  // obscure or awkward sentence) and replace it.
  const swapExample = async () => {
    if (swapping || !word) return
    setSwapping(true)
    try {
      const list = await fetchExamples(word.word, 6)
      const current = word.example?.text
      const others = list.filter((e) => e.text !== current)
      const next = others.length ? others[Math.floor(Math.random() * others.length)] : list[0]
      if (next) replaceWordExample(word.word, next)
    } catch {
      /* offline / no results — keep the current example */
    }
    setSwapping(false)
  }

  // Keep the keyboard handler pointed at the current card's actions.
  keyApi.current = { revealed, reveal, grade }

  const remaining = queue.length - pos
  const progress = queue.length ? (pos / queue.length) * 100 : 0

  return (
    <div className="mx-auto flex max-w-xl flex-col gap-5">
      {/* Progress */}
      <div className="flex items-center justify-between text-sm text-mist/55">
        <span>{remaining} restantes</span>
        <button onClick={onExit} className="hover:text-cream">
          Sair
        </button>
      </div>
      <div className="h-1.5 overflow-hidden rounded-full bg-white/10">
        <motion.div
          className="h-full rounded-full"
          style={{ background: 'linear-gradient(90deg,#b478ff,#ff8fb1)' }}
          animate={{ width: `${progress}%` }}
          transition={{ type: 'spring', stiffness: 200, damping: 30 }}
        />
      </div>

      <motion.div
        key={`${item.key}:${dir}:${pos}`}
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.22 }}
        className="glass-strong flex min-h-[20rem] flex-col items-center justify-center gap-4 rounded-3xl p-7 text-center"
      >
        <span className="rounded-full bg-white/8 px-3 py-1 text-[0.65rem] uppercase tracking-[0.2em] text-mist/55">
          {phraseItem
            ? dir === 'fwd'
              ? `${phraseItem.phrase.source === 'daily' ? 'Frase do dia' : 'Minha frase'} · EN → PT`
              : 'Diga em inglês · PT → EN'
            : dir === 'fwd'
              ? 'Entenda a frase · EN → PT'
              : 'Complete a frase · PT → EN'}
        </span>

        {phraseItem ? (
          <PhraseReviewBody
            phrase={livePhrase ?? phraseItem.phrase}
            dir={dir}
            revealed={revealed}
          />
        ) : word ? (
          dir === 'fwd' ? (
            <FwdCard word={word} revealed={revealed} fetching={fetchingPhrase} />
          ) : (
            <RevCard
              word={word}
              revealed={revealed}
              fetching={fetchingPhrase}
              typed={typed}
              setTyped={setTyped}
              typedCorrect={typedCorrect}
              onEnter={reveal}
            />
          )
        ) : null}
      </motion.div>

      {word?.example?.text && (
        <button
          onClick={swapExample}
          disabled={swapping}
          className="mx-auto flex items-center gap-1.5 text-xs text-mist/40 transition-colors hover:text-mist/80 disabled:opacity-50"
        >
          <RefreshCw size={12} className={swapping ? 'animate-spin' : ''} />
          {swapping ? 'buscando outra frase…' : 'trocar frase de exemplo'}
        </button>
      )}

      {/* Actions */}
      {!revealed ? (
        <button onClick={reveal} className="btn-primary justify-center py-3 text-base">
          <Eye size={18} /> Mostrar resposta
        </button>
      ) : (
        <div className="grid grid-cols-4 gap-2">
          {RATINGS.map(({ rating, label, cls }) => (
            <button
              key={rating}
              onClick={() => grade(rating)}
              className={`flex flex-col items-center gap-0.5 rounded-2xl px-2 py-3 text-sm font-semibold transition-colors ${cls}`}
            >
              {label}
              <span className="text-[0.65rem] font-normal opacity-80">
                {intervals ? formatInterval(intervals[rating]) : ''}
              </span>
            </button>
          ))}
        </div>
      )}

      <p className="hidden text-center text-xs text-mist/35 sm:block">
        {revealed ? 'Atalhos: 1–4 para responder' : 'Atalho: espaço ou enter para mostrar'}
      </p>
    </div>
  )
}

/** A small loader shown while a word's example phrase is being fetched. */
function PhraseLoading() {
  return (
    <span className="flex items-center gap-2 text-sm text-mist/50">
      <Loader2 size={16} className="animate-spin" /> buscando uma frase…
    </span>
  )
}

/** Speak your answer instead of typing it (fills the input via recognition). */
function MicAnswerButton({ onResult }: { onResult: (text: string) => void }) {
  const [listening, setListening] = useState(false)
  if (!canListen) return null
  const run = async () => {
    setListening(true)
    try {
      const said = await listenOnce()
      if (said) onResult(said)
    } catch {
      /* permission denied / nothing heard — ignore, she can type */
    }
    setListening(false)
  }
  return (
    <button
      onClick={run}
      disabled={listening}
      title="Falar a resposta"
      className={`grid h-11 w-11 shrink-0 place-items-center rounded-2xl transition-colors ${
        listening ? 'bg-rose-500/30 text-rose-100' : 'bg-white/8 text-aurora-3 hover:bg-white/15'
      }`}
    >
      <Mic size={18} className={listening ? 'animate-pulse' : ''} />
    </button>
  )
}

const SpeakButton = ({ text, size = 18 }: { text: string; size?: number }) =>
  canSpeak ? (
    <button
      onClick={() => speak(text)}
      title="Ouvir"
      className="grid h-9 w-9 place-items-center rounded-full bg-white/8 text-aurora-3 hover:bg-white/15"
    >
      <Volume2 size={size} />
    </button>
  ) : null

// — Recognition: read the English phrase, recall what it means (EN→PT) —
function FwdCard({
  word,
  revealed,
  fetching,
}: {
  word: VocabWord
  revealed: boolean
  fetching: boolean
}) {
  const phrase = word.example?.text
  return (
    <>
      {phrase ? (
        <div className="flex items-center gap-2">
          <p className="max-w-md font-display text-2xl leading-snug text-cream sm:text-3xl">
            <SpeakableText text={phrase} highlight={word.word} />
          </p>
          <SpeakButton text={phrase} />
        </div>
      ) : fetching ? (
        <PhraseLoading />
      ) : (
        <div className="flex items-center gap-2">
          <span className="font-display text-4xl text-glow">{word.word}</span>
          <SpeakButton text={word.word} />
        </div>
      )}

      {!revealed ? (
        <span className="text-sm text-mist/45">
          O que significa{phrase ? ' a palavra em destaque' : ''}?
        </span>
      ) : (
        <div className="mt-1 flex flex-col items-center gap-1.5 border-t border-white/10 pt-3">
          {word.example?.translation && (
            <span className="max-w-md text-lg italic leading-snug text-rose-300/90">
              {word.example.translation}
            </span>
          )}
          <span className="text-base text-rose-300">
            <strong className="text-cream">{word.word}</strong> = {word.translation}
          </span>
        </div>
      )}
    </>
  )
}

// — Production: read the Portuguese phrase, complete the English one (PT→EN) —
function RevCard({
  word,
  revealed,
  fetching,
  typed,
  setTyped,
  typedCorrect,
  onEnter,
}: {
  word: VocabWord
  revealed: boolean
  fetching: boolean
  typed: string
  setTyped: (v: string) => void
  typedCorrect: boolean
  onEnter: () => void
}) {
  const langName = useLangName()
  const en = word.example?.text
  const pt = word.example?.translation
  return (
    <>
      {/* Portuguese prompt — the whole phrase when we have it. */}
      {pt ? (
        <p className="max-w-md font-display text-2xl leading-snug text-cream sm:text-3xl">{pt}</p>
      ) : (
        <span className="font-display text-4xl text-cream">{word.translation}</span>
      )}

      {!revealed ? (
        <>
          {en ? (
            <p className="max-w-md text-lg leading-snug text-mist/60">{cloze(en, word.word)}</p>
          ) : fetching ? (
            <PhraseLoading />
          ) : null}
          <div className="mt-1 flex items-center gap-2">
            <input
              autoFocus
              value={typed}
              onChange={(e) => setTyped(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && onEnter()}
              placeholder="palavra que falta…"
              className="w-60 rounded-2xl border border-white/12 bg-white/5 px-4 py-2.5 text-center text-lg outline-none placeholder:text-mist/35 focus:border-aurora-3/50"
            />
            <MicAnswerButton
              onResult={(t) => {
                setTyped(t)
                onEnter()
              }}
            />
          </div>
          <span className="text-sm text-mist/45">
            {en ? `Complete a frase em ${langName}` : `Como se diz em ${langName}?`}
            {canListen && ' — ou toque no microfone e fale'}
          </span>
        </>
      ) : (
        <div className="mt-1 flex flex-col items-center gap-2 border-t border-white/10 pt-3">
          {en ? (
            <div className="flex items-center gap-2">
              <p className="max-w-md font-display text-2xl leading-snug text-cream">
                <SpeakableText text={en} highlight={word.word} />
              </p>
              <SpeakButton text={en} size={16} />
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <span className="font-display text-4xl text-glow">{word.word}</span>
              <SpeakButton text={word.word} size={16} />
            </div>
          )}
          {typed.trim() && (
            <span className={`text-sm ${typedCorrect ? 'text-emerald-300' : 'text-rose-300/80'}`}>
              {typedCorrect ? 'Você acertou! 🎉' : `Você escreveu: ${typed}`}
            </span>
          )}
        </div>
      )}
    </>
  )
}
