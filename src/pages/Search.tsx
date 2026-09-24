import { useEffect, useRef, useState } from 'react'
import { Search as SearchIcon, X, Sparkles, AlertCircle } from 'lucide-react'
import { AnimatePresence, motion } from 'framer-motion'
import { searchTracks, type SpotifyTrack } from '../spotify/api'
import { useSession } from '../store/useSession'
import { beginLogin } from '../spotify/auth'
import { TrackCard } from '../components/TrackCard'
import { ConnectGate, EmptyState } from '../components/States'
import { useLang } from '../lib/useLangName'

export function SearchPage() {
  const lang = useLang()
  const langName = lang.name
  // A few gentle starting points in the language being learned.
  const suggestions = lang.suggestions
  const auth = useSession((s) => s.auth)
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<SpotifyTrack[]>([])
  const [loading, setLoading] = useState(false)
  const [touched, setTouched] = useState(false)
  const [error, setError] = useState<{ message: string; detail: string } | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  // Debounced search.
  useEffect(() => {
    if (auth !== 'loggedin') return
    const q = query.trim()
    if (!q) {
      setResults([])
      setLoading(false)
      setError(null)
      return
    }
    setLoading(true)
    setError(null)
    const handle = setTimeout(async () => {
      try {
        const r = await searchTracks(q)
        setResults(r)
      } catch (e) {
        const detail = (e as Error).message || 'erro desconhecido'
        setResults([])
        setError({ message: friendlyError(detail), detail })
        // Also log for debugging in the browser console.
        console.error('[CantAlice] Falha na busca do Spotify:', e)
      } finally {
        setLoading(false)
      }
    }, 380)
    return () => clearTimeout(handle)
  }, [query, auth])

  useEffect(() => {
    if (auth === 'loggedin') inputRef.current?.focus()
  }, [auth])

  if (auth !== 'loggedin') {
    return <ConnectGate feature="buscar e tocar músicas" />
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="font-display text-4xl sm:text-5xl">
          O que vamos <span className="text-glow">cantar</span> hoje?
        </h1>
        <p className="mt-2 text-mist/70">Busque qualquer música em {langName} e comece a praticar.</p>
      </div>

      {/* Search bar */}
      <div className="glass flex items-center gap-3 rounded-2xl px-5 py-4">
        <SearchIcon className="shrink-0 text-mist/60" size={22} />
        <input
          ref={inputRef}
          value={query}
          onChange={(e) => {
            setQuery(e.target.value)
            setTouched(true)
          }}
          aria-label="Buscar músicas"
          placeholder={lang.searchPlaceholder}
          className="w-full bg-transparent text-lg outline-none placeholder:text-mist/40"
        />
        {query && (
          <button
            onClick={() => {
              setQuery('')
              inputRef.current?.focus()
            }}
            aria-label="Limpar busca"
            className="rounded-full p-1 text-mist/60 hover:text-cream"
          >
            <X size={20} />
          </button>
        )}
      </div>

      {/* Suggestions before any search */}
      {!touched && !query && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
          <p className="mb-3 flex items-center gap-2 text-sm text-mist/60">
            <Sparkles size={16} /> Sugestões para começar
          </p>
          <div className="flex flex-wrap gap-2">
            {suggestions.map((s) => (
              <button
                key={s}
                onClick={() => {
                  setQuery(s)
                  setTouched(true)
                }}
                className="btn-ghost text-sm"
              >
                {s}
              </button>
            ))}
          </div>
        </motion.div>
      )}

      {/* Results */}
      {loading && <ResultsSkeleton />}

      {!loading && error && <SearchError error={error} />}

      {!loading && !error && results.length > 0 && (
        <motion.div
          layout
          className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5"
        >
          <AnimatePresence>
            {results.map((t) => (
              <TrackCard key={t.id} track={t} />
            ))}
          </AnimatePresence>
        </motion.div>
      )}

      {!loading && !error && touched && query && results.length === 0 && (
        <EmptyState
          icon={<SearchIcon size={32} />}
          title="Nada encontrado"
          description="Tente outro nome de música ou artista."
        />
      )}
    </div>
  )
}

/** Turn a raw API error into a friendly Portuguese explanation. */
function friendlyError(detail: string): string {
  if (/401|NOT_AUTHENTICATED|expired/i.test(detail)) {
    return 'Sua conexão com o Spotify expirou. Conecte novamente.'
  }
  if (/403/.test(detail)) {
    return 'O Spotify recusou o acesso (403). Provavelmente o app está em "Development Mode" e sua conta precisa ser adicionada na lista de usuários do app no painel do Spotify.'
  }
  if (/429/.test(detail)) {
    return 'Muitas buscas em pouco tempo. Espere alguns segundos e tente de novo.'
  }
  if (/Failed to fetch|NetworkError|network/i.test(detail)) {
    return 'Não consegui falar com o Spotify. Verifique sua conexão com a internet.'
  }
  return 'Não consegui buscar no Spotify agora.'
}

function SearchError({ error }: { error: { message: string; detail: string } }) {
  const isAuth = /401|NOT_AUTHENTICATED|expired/i.test(error.detail)
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className="glass mx-auto max-w-xl rounded-3xl p-6"
    >
      <div className="flex items-start gap-3">
        <div className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-rose-400/15 text-rose-300">
          <AlertCircle size={22} />
        </div>
        <div className="min-w-0">
          <h3 className="font-display text-xl">Ops…</h3>
          <p className="mt-1 text-mist/80">{error.message}</p>
          {isAuth && (
            <button onClick={() => beginLogin()} className="btn-primary mt-4">
              Reconectar Spotify
            </button>
          )}
          <details className="mt-4 text-xs text-mist/45">
            <summary className="cursor-pointer">Detalhes técnicos</summary>
            <code className="mt-1 block break-all rounded bg-black/30 p-2">{error.detail}</code>
          </details>
        </div>
      </div>
    </motion.div>
  )
}

function ResultsSkeleton() {
  return (
    <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
      {Array.from({ length: 10 }).map((_, i) => (
        <div key={i} className="glass rounded-3xl p-3">
          <div className="skeleton aspect-square w-full rounded-2xl" />
          <div className="skeleton mt-3 h-4 w-3/4 rounded" />
          <div className="skeleton mt-2 h-3 w-1/2 rounded" />
        </div>
      ))}
    </div>
  )
}
