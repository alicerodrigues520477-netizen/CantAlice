import { Volume2 } from 'lucide-react'
import { speak, canSpeak } from '../lib/speak'
import { SpeakableText } from './SpeakableText'
import { SpeechCheck } from './SpeechCheck'
import type { PhraseCard, ReviewDir } from '../store/useLibrary'

const ListenButton = ({ text }: { text: string }) =>
  canSpeak ? (
    <button
      onClick={() => speak(text)}
      title="Ouvir a pronúncia"
      className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-white/8 text-aurora-3 hover:bg-white/15"
    >
      <Volume2 size={18} />
    </button>
  ) : null

/**
 * Review card for a phrase (a "Frase do Dia" or one of "Minhas frases").
 * - fwd: read/hear the English phrase, recall what it means (EN → PT).
 * - rev: read the Portuguese phrase, say it in English (PT → EN).
 * Both have audio, a mic to practise the pronunciation with per-word feedback
 * (SpeechCheck), and the "Mostrar resposta" reveal handled by the review shell.
 */
export function PhraseReviewBody({
  phrase,
  dir,
  revealed,
}: {
  phrase: PhraseCard
  dir: ReviewDir
  revealed: boolean
}) {
  const guide = phrase.pronuncia ? (
    <span className="text-sm text-mist/55">/ {phrase.pronuncia} /</span>
  ) : null

  if (dir === 'fwd') {
    return (
      <>
        <div className="flex items-center gap-2">
          <p className="max-w-md font-display text-2xl leading-snug text-cream sm:text-3xl">
            <SpeakableText text={phrase.target} />
          </p>
          <ListenButton text={phrase.target} />
        </div>
        {guide}
        {!revealed ? (
          <span className="text-sm text-mist/45">O que significa a frase?</span>
        ) : (
          <div className="mt-1 flex flex-col items-center gap-1.5 border-t border-white/10 pt-3">
            <span className="max-w-md text-xl italic leading-snug text-rose-300/90">
              {phrase.pt}
            </span>
          </div>
        )}
        <SpeechCheck target={phrase.target} label="Repetir a frase" />
      </>
    )
  }

  return (
    <>
      <p className="max-w-md font-display text-2xl leading-snug text-cream sm:text-3xl">
        {phrase.pt}
      </p>
      {!revealed ? (
        <span className="text-sm text-mist/45">
          Como se diz em inglês? Fale no microfone ou mostre a resposta
        </span>
      ) : (
        <div className="mt-1 flex flex-col items-center gap-1.5 border-t border-white/10 pt-3">
          <div className="flex items-center gap-2">
            <p className="max-w-md font-display text-2xl leading-snug text-cream">
              <SpeakableText text={phrase.target} />
            </p>
            <ListenButton text={phrase.target} />
          </div>
          {guide}
        </div>
      )}
      <SpeechCheck target={phrase.target} label="Falar em inglês" />
    </>
  )
}
