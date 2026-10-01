import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import { AuroraBackground } from './components/AuroraBackground'
import { FloatingNotes } from './components/FloatingNotes'
import { Sidebar, MobileBar, MobileTopBar } from './components/Nav'
import { UpdatePrompt } from './components/UpdatePrompt'
import { Help } from './components/Help'
import { Celebration } from './components/Celebration'
import { InstallPrompt } from './components/InstallPrompt'
import { VersionBadge } from './components/VersionBadge'
import { RequestAccess } from './components/RequestAccess'
import { ErrorBoundary } from './components/ErrorBoundary'
import { useUI } from './store/useUI'
import { HomePage } from './pages/Home'
import { SearchPage } from './pages/Search'
import { LibraryPage } from './pages/Library'
import { VocabularyPage } from './pages/Vocabulary'
import { TranslatePage } from './pages/Translate'
import { KaraokePage } from './pages/Karaoke'
import { ProgressPage } from './pages/Progress'
import { PhrasesPage } from './pages/Phrases'
import { ConversationPage } from './pages/Conversation'
import { useNav } from './store/useNav'
import { useSession } from './store/useSession'
import {
  handleRedirectCallback,
  isLoggedIn,
  getValidAccessToken,
  logout,
} from './spotify/auth'
import { getCurrentUser } from './spotify/api'
import { playerController } from './spotify/player'
import { useCloudSync } from './sync/sync'
import { usePhraseDeck } from './hooks/usePhraseDeck'
import { useRefreshTranslations } from './lyrics/refreshTranslations'
import { IS_SPOTIFY_CONFIGURED } from './config'

export function App() {
  const view = useNav((s) => s.view)
  const setAuth = useSession((s) => s.setAuth)
  const setUser = useSession((s) => s.setUser)
  const [authError, setAuthError] = useState<{ message: string; requestable?: boolean } | null>(
    null,
  )

  // Cloud sync (no-op until Supabase is configured): pulls + merges progress on
  // login and keeps it synced across devices, tied to the Spotify account.
  useCloudSync()

  // Frases do Dia + Minhas frases enter the review deck automatically (English).
  usePhraseDeck()

  // One-time re-translation of saved words when the translator improves.
  useRefreshTranslations()

  // — Bootstrap: handle OAuth return, restore session, init player —
  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        await handleRedirectCallback()
      } catch (e) {
        // Connection refusals are usually the Development-Mode allow-list, so
        // offer "Pedir acesso" alongside the message.
        if (!cancelled) setAuthError({ message: (e as Error).message, requestable: true })
      }

      if (!isLoggedIn()) {
        if (!cancelled) setAuth('loggedout')
        return
      }

      // Validate the token & load the profile.
      const token = await getValidAccessToken()
      if (!token) {
        if (!cancelled) setAuth('loggedout')
        return
      }
      try {
        const user = await getCurrentUser()
        if (cancelled) return
        setUser(user)
        setAuth('loggedin')
        // Premium accounts get the full Web Playback SDK device.
        if (user.product === 'premium') playerController.init()
      } catch (e) {
        if (cancelled) return
        // We have a token but the profile call failed. The most common cause
        // is the Spotify app being in "Development Mode": only accounts added
        // to the app's allow-list can use it. Surface that clearly instead of
        // silently bouncing back to the connect screen.
        setAuth('loggedout')
        logout()
        const msg = (e as Error).message
        if (/\b403\b/.test(msg)) {
          setAuthError({
            message:
              'Esta conta do Spotify ainda não tem acesso ao app. Toque em “Pedir acesso” ' +
              'para enviar seu e-mail e ser liberado.',
            requestable: true,
          })
        } else {
          setAuthError({
            message: 'Não consegui carregar seu perfil do Spotify. Tente conectar novamente.',
          })
        }
      }
    })()
    return () => {
      cancelled = true
    }
  }, [setAuth, setUser])

  return (
    <>
      <AuroraBackground />
      <FloatingNotes />

      {authError && (
        <ErrorBanner
          message={authError.message}
          requestable={authError.requestable}
          onClose={() => setAuthError(null)}
        />
      )}

      <div className="mx-auto flex min-h-dvh w-full max-w-[1400px]">
        <Sidebar />
        <div className="flex min-w-0 flex-1 flex-col">
          <MobileTopBar />
          <main className="flex-1 px-5 pb-28 pt-6 sm:px-8 lg:px-10 lg:pb-12 lg:pt-10">
            {/* Keyed (not AnimatePresence) so navigating always mounts the next
                page immediately — a "wait" exit could otherwise deadlock and
                leave the new tab blank. */}
            <motion.div
              key={view}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
            >
              <ErrorBoundary resetKey={view}>
                <Page view={view} />
              </ErrorBoundary>
            </motion.div>
          </main>
        </div>
      </div>

      <MobileBar />

      <UpdatePrompt />
      <InstallPrompt />
      <Help />
      <RequestAccess />
      <Celebration />
      <VersionBadge />

      {!IS_SPOTIFY_CONFIGURED && <ConfigBadge />}
    </>
  )
}

function Page({ view }: { view: ReturnType<typeof useNav.getState>['view'] }) {
  switch (view) {
    case 'home':
      return <HomePage />
    case 'search':
      return <SearchPage />
    case 'library':
      return <LibraryPage />
    case 'vocab':
      return <VocabularyPage />
    case 'translate':
      return <TranslatePage />
    case 'progress':
      return <ProgressPage />
    case 'phrases':
      return <PhrasesPage />
    case 'conversar':
      return <ConversationPage />
    case 'song':
      return <KaraokePage />
    default:
      return <HomePage />
  }
}

function ErrorBanner({
  message,
  requestable,
  onClose,
}: {
  message: string
  requestable?: boolean
  onClose: () => void
}) {
  const openRequestAccess = useUI((s) => s.openRequestAccess)
  return (
    <motion.div
      initial={{ opacity: 0, y: -20 }}
      animate={{ opacity: 1, y: 0 }}
      className="pt-safe fixed inset-x-0 top-3 z-[90] mx-auto w-[92vw] max-w-md px-1"
    >
      <div className="glass-strong rounded-2xl px-5 py-4 text-sm shadow-2xl">
        <div className="flex items-start gap-3">
          <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-rose-400/20 text-rose-300">
            !
          </span>
          <span className="flex-1 leading-relaxed">{message}</span>
          <button
            onClick={onClose}
            aria-label="Fechar"
            className="shrink-0 text-mist/60 hover:text-cream"
          >
            ✕
          </button>
        </div>
        {requestable && (
          <button
            onClick={() => {
              onClose()
              openRequestAccess()
            }}
            className="btn-primary mt-3 w-full justify-center py-2 text-sm"
          >
            Pedir acesso
          </button>
        )}
      </div>
    </motion.div>
  )
}

function ConfigBadge() {
  return (
    <div className="fixed bottom-4 right-4 z-50 hidden rounded-full bg-gold/20 px-4 py-2 text-xs text-gold lg:block">
      ⚙︎ Configure o Spotify Client ID — veja o README
    </div>
  )
}
