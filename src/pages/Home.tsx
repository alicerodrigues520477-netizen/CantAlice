import { useEffect, useState } from 'react'
import {
  Sparkles,
  GraduationCap,
  BookHeart,
  Search,
  Music2,
  Heart,
  Play,
  Flame,
  Brain,
  Volume2,
  MessagesSquare,
  ChevronRight,
} from 'lucide-react'
import { motion } from 'framer-motion'
import { useShallow } from 'zustand/react/shallow'
import { useSession } from '../store/useSession'
import {
  useLibrary,
  selectSongs,
  selectVocab,
  currentStreak,
  selectReviewCounts,
  selectDailyProgress,
  type SavedSong,
  type VocabWord,
} from '../store/useLibrary'
import { useNav } from '../store/useNav'
import { useUI } from '../store/useUI'
import { beginLogin } from '../spotify/auth'
import { getTrack, type SpotifyTrack } from '../spotify/api'
import { recommendedTracks } from '../spotify/recommend'
import { AlbumArt } from '../components/AlbumArt'
import { GoalRing } from '../components/GoalRing'
import { useLang } from '../lib/useLangName'
import { SpeakableText } from '../components/SpeakableText'
import { SpeechCheck } from '../components/SpeechCheck'
import { speak, canSpeak } from '../lib/speak'
import { IS_SPOTIFY_CONFIGURED } from '../config'
import { greeting, plural } from '../lib/format'
import { SetupNotice } from '../components/States'
import { Brand } from '../components/Brand'
import { ReviewSession } from '../components/ReviewSession'

export function HomePage() {
  const auth = useSession((s) => s.auth)
  const user = useSession((s) => s.user)
  const learner = useLang().learner

  if (!IS_SPOTIFY_CONFIGURED) {
    return (
      <div className="space-y-8 pt-6">
        <Hero name={learner} />
        <SetupNotice />
      </div>
    )
  }

  if (auth !== 'loggedin') {
    return <Welcome />
  }

  return <Dashboard name={user?.displayName?.split(' ')[0] || learner} />
}

// — Logged-out welcome (the "front door") —
function Welcome() {
  const lang = useLang()
  const langName = lang.name
  return (
    <div className="flex min-h-[78vh] flex-col items-center justify-center gap-10 py-10 text-center">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
        className="flex flex-col items-center gap-6"
      >
        <Brand />
        <h1 className="max-w-3xl font-display text-5xl leading-[1.05] sm:text-7xl">
          Aprenda {langName} <span className="text-glow">cantando</span> as músicas que você ama.
        </h1>
        <p className="max-w-xl text-lg text-mist/75">
          Olá, {lang.learner}! 💛 Toque suas músicas favoritas do Spotify, acompanhe a letra
          sincronizada, veja a tradução e guarde as palavras novas — tudo num só lugar.
        </p>
        <button onClick={() => beginLogin()} className="btn-primary text-lg">
          <Music2 size={20} /> Conectar com o Spotify
        </button>
        <div className="flex flex-col items-center gap-1">
          <p className="text-sm text-mist/45">É grátis e seguro — usamos o login oficial do Spotify.</p>
          <button
            onClick={() => useUI.getState().openRequestAccess()}
            className="text-sm text-mist/55 underline-offset-4 transition-colors hover:text-cream hover:underline"
          >
            Não consegue conectar? Pedir acesso
          </button>
        </div>
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2, duration: 0.7 }}
        className="grid w-full max-w-4xl gap-4 sm:grid-cols-3"
      >
        <Feature
          icon={<Music2 />}
          title="Cante junto"
          text="Letras que acompanham a música, linha por linha, como um karaokê."
        />
        <Feature
          icon={<BookHeart />}
          title="Entenda tudo"
          text="Tradução para o português e toque em qualquer palavra para aprender."
        />
        <Feature
          icon={<GraduationCap />}
          title="Acompanhe o progresso"
          text="Guarde o que já sabe, o que quer aprender e seu vocabulário."
        />
      </motion.div>
    </div>
  )
}

function Feature({ icon, title, text }: { icon: React.ReactNode; title: string; text: string }) {
  return (
    <div className="glass rounded-3xl p-6 text-left">
      <div className="mb-3 grid h-11 w-11 place-items-center rounded-2xl bg-rose-400/15 text-rose-300">
        {icon}
      </div>
      <h3 className="font-display text-xl">{title}</h3>
      <p className="mt-1 text-sm text-mist/70">{text}</p>
    </div>
  )
}

// — Logged-in dashboard —
function Dashboard({ name }: { name: string }) {
  const lang = useLang()
  const langName = lang.name
  const sampleArtists = lang.sampleArtists
  const learning = useLibrary(useShallow((s) => selectSongs(s, 'learning')))
  const known = useLibrary(useShallow((s) => selectSongs(s, 'known')))
  const vocab = useLibrary(useShallow(selectVocab))
  const streak = useLibrary(currentStreak)
  const progress = useLibrary(useShallow(selectDailyProgress))
  const counts = useLibrary(useShallow((s) => selectReviewCounts(s)))
  const go = useNav((s) => s.go)
  // "A primeira coisa que ela faça seja revisar": whenever there are cards
  // waiting, the review session itself opens right on the Home dashboard —
  // not just a button to it — every time the app loads. Decided once, from
  // the counts at mount (like ReviewSession snapshots its own queue): grading
  // the last card drops `counts.total` to 0 reactively, and recomputing this
  // from it on every render would swap back to the dashboard before she ever
  // sees the "Revisão concluída" screen. Dismissing it (via "Sair", or via
  // "Continuar" once the queue is empty) falls back to the normal dashboard
  // for the rest of this visit; reopening the app shows it again if cards
  // remain.
  const [reviewing, setReviewing] = useState(() => counts.total > 0)

  const recent = [...learning, ...known]
    .filter((s) => s.lastPracticedAt)
    .sort((a, b) => (b.lastPracticedAt ?? 0) - (a.lastPracticedAt ?? 0))
    .slice(0, 4)

  const hasSongs = learning.length > 0 || known.length > 0

  return (
    <div className="space-y-10 pt-2">
      <Hero name={name} />

      {reviewing ? (
        <div className="glass-strong rounded-3xl p-6 sm:p-7">
          <ReviewSession onExit={() => setReviewing(false)} doneLabel="Continuar" />
        </div>
      ) : (
        <TodayCard
          progress={progress}
          streak={streak}
          due={counts.total}
          onReview={() => go('vocab', 'review')}
          onSing={() => go(recent[0] ? 'song' : 'search', recent[0]?.id)}
          onOpenProgress={() => go('progress')}
        />
      )}

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4">
        <StatCard
          icon={<Sparkles />}
          value={learning.length}
          label="Aprendendo"
          tone="rose"
          onClick={() => go('library')}
        />
        <StatCard
          icon={<GraduationCap />}
          value={known.length}
          label="Já sei cantar"
          tone="gold"
          onClick={() => go('library')}
        />
        <StatCard
          icon={<BookHeart />}
          value={vocab.length}
          label="Palavras"
          tone="aurora"
          onClick={() => go('vocab')}
        />
      </div>

      {/* Practice entries */}
      <div className="grid gap-3 sm:grid-cols-2">
        <motion.button
          whileHover={{ y: -2 }}
          onClick={() => go('conversar')}
          className="glass flex w-full items-center gap-4 rounded-3xl p-5 text-left"
        >
          <span className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-rose-400/20 text-rose-300">
            <Sparkles size={22} />
          </span>
          <div className="min-w-0 flex-1">
            <div className="font-display text-lg">Conversar com IA</div>
            <div className="truncate text-sm text-mist/60">Fale em {langName} e receba resposta em voz.</div>
          </div>
          <ChevronRight size={20} className="shrink-0 text-mist/40" />
        </motion.button>

        <motion.button
          whileHover={{ y: -2 }}
          onClick={() => go('phrases')}
          className="glass flex w-full items-center gap-4 rounded-3xl p-5 text-left"
        >
          <span className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-aurora-2/20 text-aurora-1">
            <MessagesSquare size={22} />
          </span>
          <div className="min-w-0 flex-1">
            <div className="font-display text-lg">Frases do dia a dia</div>
            <div className="truncate text-sm text-mist/60">Pedir um café, viajar, conversar.</div>
          </div>
          <ChevronRight size={20} className="shrink-0 text-mist/40" />
        </motion.button>
      </div>

      {/* Word of the day */}
      {vocab.length > 0 && <WordOfDay words={vocab} />}

      {/* Continue practising */}
      {recent.length > 0 && (
        <section>
          <SectionTitle>Continue de onde parou</SectionTitle>
          <div className="grid gap-3 sm:grid-cols-2">
            {recent.map((s) => (
              <ContinueCard key={s.id} song={s} />
            ))}
          </div>
        </section>
      )}

      {/* Empty / first-run nudge */}
      {!hasSongs && (
        <div className="glass flex flex-col items-center gap-4 rounded-3xl p-10 text-center">
          <div className="grid h-16 w-16 place-items-center rounded-3xl bg-rose-400/15 text-rose-300">
            <Heart size={30} />
          </div>
          <h3 className="font-display text-2xl">Vamos começar?</h3>
          <p className="max-w-md text-mist/70">
            Busque uma música em {langName} que você adora. Que tal {sampleArtists}?
          </p>
          <button onClick={() => go('search')} className="btn-primary">
            <Search size={18} /> Buscar minha primeira música
          </button>
        </div>
      )}

      {/* Recommendations — songs to sing along to */}
      <Recommendations songs={[...learning, ...known]} />
    </div>
  )
}

// — "Today" hub: daily goal ring + streak + one clear next step —
function TodayCard({
  progress,
  streak,
  due,
  onReview,
  onSing,
  onOpenProgress,
}: {
  progress: { done: number; goal: number; met: boolean }
  streak: number
  due: number
  onReview: () => void
  onSing: () => void
  onOpenProgress: () => void
}) {
  const { done, goal, met } = progress

  const title = met
    ? 'Meta de hoje concluída! 🎉'
    : due > 0
      ? 'Hora de revisar'
      : 'Pronta para praticar?'
  const subtitle = met
    ? 'Você arrasou hoje. Que tal cantar uma música para comemorar?'
    : due > 0
      ? `${due} ${plural(due, 'palavra', 'palavras')} te esperando para hoje.`
      : 'Cante uma música e guarde palavras novas para revisar.'

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
      className="glass-strong rounded-3xl p-6 sm:p-7"
    >
      <div className="flex flex-col gap-6 sm:flex-row sm:items-center sm:justify-between">
        <button
          onClick={onOpenProgress}
          title="Ver seu progresso"
          className="-m-2 flex items-center gap-5 rounded-2xl p-2 text-left transition-colors hover:bg-white/5"
        >
          <GoalRing done={done} goal={goal} met={met} />
          <div className="min-w-0">
            <div className="flex items-center gap-1.5 text-sm font-medium text-peach">
              <Flame size={16} />
              {streak > 0
                ? `${streak} ${plural(streak, 'dia', 'dias')} seguidos`
                : 'Comece sua sequência hoje'}
            </div>
            <h2 className="mt-1 font-display text-2xl sm:text-3xl">{title}</h2>
            <p className="mt-1 text-sm text-mist/70">{subtitle}</p>
          </div>
        </button>

        <div className="flex shrink-0 gap-2">
          {due > 0 ? (
            <>
              <button onClick={onReview} className="btn-primary">
                <Brain size={18} /> Revisar {due}
              </button>
              {met && (
                <button
                  onClick={onSing}
                  className="grid place-items-center rounded-2xl bg-white/8 px-4 text-cream hover:bg-white/15"
                  title="Cantar uma música"
                >
                  <Music2 size={18} />
                </button>
              )}
            </>
          ) : (
            <button onClick={onSing} className="btn-primary">
              <Music2 size={18} /> Cantar uma música
            </button>
          )}
        </div>
      </div>
    </motion.div>
  )
}

// — Word of the day: a saved word resurfaced, chosen deterministically by date —
function WordOfDay({ words }: { words: VocabWord[] }) {
  const today = new Date()
  const seed = today.getFullYear() * 10000 + (today.getMonth() + 1) * 100 + today.getDate()
  const w = words[seed % words.length]
  if (!w) return null

  return (
    <section>
      <SectionTitle>Palavra do dia</SectionTitle>
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="glass rounded-3xl p-6"
      >
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <span className="font-display text-3xl text-cream">{w.word}</span>
            {canSpeak && (
              <button
                onClick={() => speak(w.word)}
                title="Ouvir pronúncia"
                className="grid h-9 w-9 place-items-center rounded-full bg-white/8 text-aurora-3 hover:bg-white/15"
              >
                <Volume2 size={16} />
              </button>
            )}
            <span className="ml-1 font-display text-2xl text-rose-300">{w.translation}</span>
          </div>
          <SpeechCheck target={w.word} label="Falar" />
        </div>
        {w.example?.text && (
          <div className="mt-3 border-t border-white/10 pt-3">
            <p className="leading-snug text-cream">
              <SpeakableText text={w.example.text} highlight={w.word} />
            </p>
            {w.example.translation && (
              <p className="mt-0.5 text-sm italic text-rose-300/80">{w.example.translation}</p>
            )}
          </div>
        )}
      </motion.div>
    </section>
  )
}

// — "Songs at your level" / discovery row —
function Recommendations({ songs }: { songs: SavedSong[] }) {
  const [tracks, setTracks] = useState<SpotifyTrack[] | null>(null)
  const lang = useLang()
  // The language is part of the signature: with no saved songs in either
  // language the id list is identical (''), and without it a language switch
  // would keep showing recommendations for the previous language.
  const sig = lang.code + '|' + songs.map((s) => s.id).join(',')

  useEffect(() => {
    let alive = true
    recommendedTracks(songs)
      .then((t) => alive && setTracks(t))
      .catch(() => alive && setTracks([]))
    return () => {
      alive = false
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sig])

  // Hide entirely if we tried and found nothing (e.g. offline / search blocked).
  if (tracks && tracks.length === 0) return null

  return (
    <section>
      <SectionTitle>Para você cantar</SectionTitle>
      {!tracks ? (
        <div className="grid gap-3 sm:grid-cols-2">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="glass h-[4.75rem] animate-pulse rounded-2xl" />
          ))}
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {tracks.map((t) => (
            <RecCard key={t.id} track={t} />
          ))}
        </div>
      )}
    </section>
  )
}

function RecCard({ track }: { track: SpotifyTrack }) {
  const go = useNav((s) => s.go)
  const setActiveTrack = useSession((s) => s.setActiveTrack)
  const image = track.album.images[1]?.url ?? track.album.images[0]?.url ?? null

  const open = () => {
    go('song', track.id)
    setActiveTrack(track)
  }

  return (
    <motion.button
      whileHover={{ y: -2 }}
      onClick={open}
      className="glass group flex items-center gap-4 rounded-2xl p-3 text-left"
    >
      <div className="h-14 w-14 shrink-0 overflow-hidden rounded-xl">
        <AlbumArt src={image} alt={`Capa de ${track.name}`} fallbackIcon={<Music2 />} />
      </div>
      <div className="min-w-0 flex-1">
        <div className="truncate font-medium">{track.name}</div>
        <div className="truncate text-sm text-mist/60">
          {track.artists.map((a) => a.name).join(', ')}
        </div>
      </div>
      <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-white/10 text-cream transition-colors group-hover:bg-rose-400 group-hover:text-night-900">
        <Play size={18} className="ml-0.5" fill="currentColor" />
      </span>
    </motion.button>
  )
}

function Hero({ name }: { name: string }) {
  return (
    <div>
      <motion.p
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="text-sm uppercase tracking-[0.25em] text-mist/50"
      >
        {greeting(name)}
      </motion.p>
      <motion.h1
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6 }}
        className="mt-2 font-display text-4xl sm:text-5xl"
      >
        Pronta para <span className="text-glow">cantar</span>?
      </motion.h1>
    </div>
  )
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return <h2 className="mb-4 font-display text-2xl">{children}</h2>
}

const TONES = {
  rose: 'from-rose-400/25 to-rose-400/5 text-rose-300',
  gold: 'from-gold/25 to-gold/5 text-gold',
  aurora: 'from-aurora-1/25 to-aurora-1/5 text-aurora-1',
  flame: 'from-peach/25 to-peach/5 text-peach',
} as const

function StatCard({
  icon,
  value,
  label,
  tone,
  onClick,
}: {
  icon: React.ReactNode
  value: number
  label: string
  tone: keyof typeof TONES
  onClick: () => void
}) {
  return (
    <motion.button
      whileHover={{ y: -3 }}
      onClick={onClick}
      className={`glass flex flex-col gap-2 rounded-3xl bg-gradient-to-br p-5 text-left ${TONES[tone]}`}
    >
      <div className="flex items-center justify-between">
        <span className="grid h-10 w-10 place-items-center rounded-2xl bg-white/10">{icon}</span>
      </div>
      <div className="mt-1 font-display text-4xl text-cream">{value}</div>
      <div className="text-sm text-mist/70">{label}</div>
    </motion.button>
  )
}

function ContinueCard({ song }: { song: SavedSong }) {
  const go = useNav((s) => s.go)
  const setActiveTrack = useSession((s) => s.setActiveTrack)

  const open = async () => {
    go('song', song.id)
    try {
      setActiveTrack(await getTrack(song.id))
    } catch {
      /* page will refetch */
    }
  }

  return (
    <motion.button
      whileHover={{ y: -2 }}
      onClick={open}
      className="glass group flex items-center gap-4 rounded-2xl p-3 text-left"
    >
      <div className="h-14 w-14 shrink-0 overflow-hidden rounded-xl">
        <AlbumArt src={song.image} alt={`Capa de ${song.name}`} fallbackIcon={<Music2 />} />
      </div>
      <div className="min-w-0 flex-1">
        <div className="truncate font-medium">{song.name}</div>
        <div className="truncate text-sm text-mist/60">{song.artist}</div>
      </div>
      <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-white/10 text-cream transition-colors group-hover:bg-rose-400 group-hover:text-night-900">
        <Play size={18} className="ml-0.5" fill="currentColor" />
      </span>
    </motion.button>
  )
}
