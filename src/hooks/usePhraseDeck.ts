import { useEffect } from 'react'
import { useLibrary } from '../store/useLibrary'

/**
 * Mounted once, app-wide: keeps the phrase review deck in step with the app.
 * Enrolls today's "Frases do Dia" and every "Minha frase" (also ones that arrive
 * from another device via cloud sync). Idempotent and English-only — see
 * `syncPhraseDeck`.
 */
export function usePhraseDeck(): void {
  const sync = useLibrary((s) => s.syncPhraseDeck)
  const targetLang = useLibrary((s) => s.targetLang)
  const myPhrases = useLibrary((s) => s.customPhrases.en)

  useEffect(() => {
    sync()
  }, [sync, targetLang, myPhrases])

  // A new calendar day can start while the app sits in the background.
  useEffect(() => {
    const onVisible = () => {
      if (document.visibilityState === 'visible') sync()
    }
    document.addEventListener('visibilitychange', onVisible)
    return () => document.removeEventListener('visibilitychange', onVisible)
  }, [sync])
}
