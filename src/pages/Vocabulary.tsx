import { useState } from 'react'
import { BookHeart, Trash2, List, Volume2, Brain } from 'lucide-react'
import { AnimatePresence, motion } from 'framer-motion'
import { useShallow } from 'zustand/react/shallow'
import {
  useLibrary,
  selectVocab,
  selectReviewCounts,
  selectPhraseCardCount,
  type VocabWord,
} from '../store/useLibrary'
import { EmptyState } from '../components/States'
import { ReviewSession } from '../components/ReviewSession'
import { speak, canSpeak } from '../lib/speak'
import { useNav } from '../store/useNav'

export function VocabularyPage() {
  const words = useLibrary(useShallow(selectVocab))
  const counts = useLibrary(useShallow((s) => selectReviewCounts(s)))
  // Phrase cards (English) are reviewable even before any word is saved. For any
  // other language this is 0, so the page behaves exactly as before.
  const phraseCount = useLibrary(selectPhraseCardCount)
  const hasCards = words.length > 0 || phraseCount > 0
  // Deep link: arriving at #/vocab/review (e.g. the home CTA) opens review.
  const deepLinkReview = useNav((s) => s.trackId) === 'review'
  const [mode, setMode] = useState<'list' | 'review'>(deepLinkReview ? 'review' : 'list')

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-4xl sm:text-5xl">Vocabulário</h1>
          <p className="mt-2 text-mist/70">
            {words.length === 0
              ? 'As palavras que você guardar das músicas aparecem aqui.'
              : `${words.length} ${words.length === 1 ? 'palavra guardada' : 'palavras guardadas'}.`}
          </p>
        </div>

        {hasCards && (
          <div className="glass inline-flex rounded-2xl p-1.5">
            <ModeButton active={mode === 'list'} onClick={() => setMode('list')} icon={List}>
              Lista
            </ModeButton>
            <ModeButton active={mode === 'review'} onClick={() => setMode('review')} icon={Brain}>
              Revisar
              {counts.total > 0 && (
                <span className="ml-1 rounded-full bg-rose-400/90 px-1.5 text-[0.7rem] font-bold text-night-900">
                  {counts.total}
                </span>
              )}
            </ModeButton>
          </div>
        )}
      </div>

      {!hasCards ? (
        <EmptyState
          icon={<BookHeart size={32} />}
          title="Seu caderninho está vazio"
          description="Enquanto canta, toque em qualquer palavra da letra para ver a tradução, uma frase de exemplo e guardá-la aqui."
        />
      ) : mode === 'list' ? (
        <>
          {counts.total > 0 && (
            <ReviewBanner
              due={counts.due}
              fresh={counts.fresh}
              onStart={() => setMode('review')}
            />
          )}
          <WordList words={words} />
        </>
      ) : (
        <ReviewSession onExit={() => setMode('list')} />
      )}
    </div>
  )
}

function ReviewBanner({
  due,
  fresh,
  onStart,
}: {
  due: number
  fresh: number
  onStart: () => void
}) {
  const parts = [
    due > 0 ? `${due} para revisar` : '',
    fresh > 0 ? `${fresh} ${fresh === 1 ? 'nova' : 'novas'}` : '',
  ].filter(Boolean)
  return (
    <motion.button
      onClick={onStart}
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className="glass-strong flex w-full items-center gap-4 rounded-2xl p-4 text-left transition-transform hover:scale-[1.01]"
    >
      <span className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-gradient-to-br from-aurora-1/30 to-rose-400/30 text-cream">
        <Brain size={24} />
      </span>
      <div className="min-w-0 flex-1">
        <div className="font-display text-lg">Hora de revisar 🧠</div>
        <div className="truncate text-sm text-mist/65">{parts.join(' · ')}</div>
      </div>
      <span className="btn-primary shrink-0 px-4 py-2 text-sm">Começar</span>
    </motion.button>
  )
}

function ModeButton({
  active,
  onClick,
  icon: Icon,
  children,
}: {
  active: boolean
  onClick: () => void
  icon: typeof List
  children: React.ReactNode
}) {
  return (
    <button
      onClick={onClick}
      className={`relative flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-semibold transition-colors ${
        active ? 'text-night-900' : 'text-mist/70 hover:text-cream'
      }`}
    >
      {active && (
        <motion.span
          layoutId="vocab-mode"
          className="absolute inset-0 -z-10 rounded-xl"
          style={{ background: 'linear-gradient(105deg, #b478ff, #ff8fb1)' }}
          transition={{ type: 'spring', stiffness: 400, damping: 32 }}
        />
      )}
      <Icon size={16} />
      {children}
    </button>
  )
}

function WordList({ words }: { words: VocabWord[] }) {
  const removeWord = useLibrary((s) => s.removeWord)
  return (
    <motion.div layout className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
      <AnimatePresence>
        {words.map((w) => (
          <motion.div
            key={w.word.toLowerCase()}
            layout
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.9 }}
            className="glass group flex items-start gap-3 rounded-2xl p-4"
          >
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <span className="font-display text-xl text-cream">{w.word}</span>
                {canSpeak && (
                  <button
                    onClick={() => speak(w.word)}
                    title="Ouvir pronúncia"
                    className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-white/8 text-aurora-3 transition-colors hover:bg-white/15"
                  >
                    <Volume2 size={14} />
                  </button>
                )}
              </div>
              <div className="text-rose-300">{w.translation}</div>
              {w.example?.text && (
                <div className="mt-1.5 border-l-2 border-white/10 pl-2 text-xs leading-snug text-mist/55">
                  “{w.example.text}”
                </div>
              )}
              {w.songName && (
                <div className="mt-1 truncate text-xs text-mist/40">de “{w.songName}”</div>
              )}
            </div>
            <button
              onClick={() => removeWord(w.word)}
              className="rounded-lg p-1.5 text-mist/40 opacity-0 transition-all hover:bg-white/10 hover:text-rose-300 group-hover:opacity-100"
              title="Remover palavra"
            >
              <Trash2 size={16} />
            </button>
          </motion.div>
        ))}
      </AnimatePresence>
    </motion.div>
  )
}
