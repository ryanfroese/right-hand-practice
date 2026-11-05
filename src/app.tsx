import { useEffect, useMemo, useRef, useState } from 'preact/hooks'
import { PROBLEM_TYPES } from './problems/index'
import type { JSX } from 'preact'
import type { ProblemType } from './problems/types'
import { CheatSheet } from './ui/CheatSheet'
import { hashHasLink, readHash, randomSeed, shareUrl, writeHash, type ProblemRef } from './ui/hash'
import { correctMessage, wrongMessage } from './ui/messages'
import { CardBoundary } from './ui/CardBoundary'
import { ProblemCard, type Feedback } from './ui/ProblemCard'
import { clearProgress, loadProgress, record, saveProgress, type Progress } from './ui/progress'
import { ProgressPanel } from './ui/ProgressPanel'
import { prefersReducedMotion } from './ui/motion'
import { playBlip } from './ui/sound'
import { load, save } from './ui/storage'
import { useThemeMode, type ThemeMode } from './ui/themeMode'
import { activeIds, TopicPicker, type Selection } from './ui/TopicPicker'

const TYPES: ProblemType[] = PROBLEM_TYPES

const typeById = (id: string) => TYPES.find((t) => t.id === id)

function choose(pool: ProblemType[], avoid?: string): ProblemType | undefined {
  if (pool.length === 0) return undefined
  const cands = pool.length > 1 ? pool.filter((t) => t.id !== avoid) : pool
  return cands[Math.floor(Math.random() * cands.length)]
}

function poolFor(sel: Selection): ProblemType[] {
  const ids = activeIds(sel, TYPES)
  return TYPES.filter((t) => ids.has(t.id))
}

/** Hash link wins; otherwise a random problem from the selection. */
function initialRef(sel: Selection): { ref: ProblemRef | null; badLink: boolean } {
  const h = readHash()
  if (h && typeById(h.t)) return { ref: h, badLink: false }
  const t = choose(poolFor(sel))
  return { ref: t ? { t: t.id, s: randomSeed() } : null, badLink: h != null || hashHasLink() }
}

const THEME_OPTS: { id: ThemeMode; label: string; icon: JSX.Element }[] = [
  {
    id: 'light',
    label: 'Light',
    icon: (
      <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
        <circle cx="12" cy="12" r="4.2" fill="currentColor" />
        <g stroke="currentColor" stroke-width="2" stroke-linecap="round">
          <path d="M12 2.5v2.2M12 19.3v2.2M2.5 12h2.2M19.3 12h2.2M5.3 5.3l1.6 1.6M17.1 17.1l1.6 1.6M5.3 18.7l1.6-1.6M17.1 6.9l1.6-1.6" />
        </g>
      </svg>
    ),
  },
  {
    id: 'dark',
    label: 'Dark',
    icon: (
      <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
        <path d="M20 14.5A8 8 0 0 1 9.5 4a8 8 0 1 0 10.5 10.5Z" fill="currentColor" />
      </svg>
    ),
  },
  {
    id: 'system',
    label: 'System',
    icon: (
      <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
        <rect x="3" y="4.5" width="18" height="12" rx="2" fill="none" stroke="currentColor" stroke-width="2" />
        <path d="M8.5 20h7M12 16.5V20" stroke="currentColor" stroke-width="2" stroke-linecap="round" />
      </svg>
    ),
  },
]

export function App() {
  const [mode, setMode] = useThemeMode()
  const [sound, setSound] = useState<boolean>(() => load('sound', false))
  const [selection, setSelection] = useState<Selection>(() => load<Selection>('selection', null))
  const init = useMemo(() => initialRef(selection), [])
  const [ref, setRef] = useState<ProblemRef | null>(init.ref)
  const [notice, setNotice] = useState<string | null>(init.badLink ? 'That problem link isn’t available any more — here’s a fresh one.' : null)
  const [topicsOpen, setTopicsOpen] = useState(false)
  const [progress, setProgress] = useState<Progress>(loadProgress)
  const [score, setScore] = useState({ c: 0, n: 0 })
  const [streak, setStreak] = useState(0)
  const streakRef = useRef(0)

  // Keep the URL in sync so any problem can be shared/reloaded exactly.
  useEffect(() => {
    if (ref) writeHash(ref)
  }, [ref])

  // Pasting a link into the same tab.
  useEffect(() => {
    const onHash = () => {
      const h = readHash()
      if (h && typeById(h.t) && (h.t !== ref?.t || h.s !== ref?.s)) setRef(h)
    }
    window.addEventListener('hashchange', onHash)
    return () => window.removeEventListener('hashchange', onHash)
  }, [ref])

  useEffect(() => {
    if (!notice) return
    const id = setTimeout(() => setNotice(null), 6000)
    return () => clearTimeout(id)
  }, [notice])

  const pool = useMemo(() => poolFor(selection), [selection])

  const next = () => {
    const t = choose(pool, ref?.t)
    setRef(t ? { t: t.id, s: randomSeed() } : null)
    window.scrollTo({ top: 0, behavior: prefersReducedMotion() ? 'auto' : 'smooth' })
  }

  const changeSelection = (s: Selection) => {
    setSelection(s)
    save('selection', s)
    const p = poolFor(s)
    if (!ref || !p.some((t) => t.id === ref.t)) {
      const t = choose(p)
      setRef(t ? { t: t.id, s: randomSeed() } : null)
    }
  }

  const onResult = (ok: boolean): Feedback => {
    const prevStreak = streakRef.current
    const s = ok ? prevStreak + 1 : 0
    streakRef.current = s
    setStreak(s)
    setScore((sc) => ({ c: sc.c + (ok ? 1 : 0), n: sc.n + 1 }))
    if (ref) {
      setProgress((p) => {
        const np = record(p, ref.t, ok, s)
        saveProgress(np)
        return np
      })
    }
    if (ok) {
      const [text, callout] = correctMessage(s)
      if (sound) playBlip(callout ? 'streak' : 'right')
      return { text, streakCallout: callout }
    }
    if (sound) playBlip('wrong')
    return { text: wrongMessage(prevStreak), streakCallout: false }
  }

  const copyLink = async (): Promise<boolean> => {
    if (!ref) return false
    const url = shareUrl(ref)
    try {
      await navigator.clipboard.writeText(url)
      return true
    } catch {
      // Fallback for http / older browsers
      const ta = document.createElement('textarea')
      ta.value = url
      ta.style.position = 'fixed'
      ta.style.opacity = '0'
      document.body.appendChild(ta)
      ta.select()
      let ok = false
      try {
        ok = document.execCommand('copy')
      } catch {
        ok = false
      }
      ta.remove()
      return ok
    }
  }

  const toggleSound = () => {
    const v = !sound
    setSound(v)
    save('sound', v)
    if (v) playBlip('right')
  }

  const resetProgress = () => {
    clearProgress()
    setProgress({ best: 0, perType: {} })
    setScore({ c: 0, n: 0 })
    setStreak(0)
    streakRef.current = 0
  }

  const themeOpt = THEME_OPTS.find((o) => o.id === mode) ?? THEME_OPTS[2]
  const type = ref ? typeById(ref.t) : undefined
  const topicSummary =
    selection == null || pool.length === TYPES.length ? 'All topics' : pool.length === 1 ? pool[0].title : `${pool.length} of ${TYPES.length} topics`

  return (
    <div class="shell">
      <header class="top">
        <div class="brand">
          <svg class="logo" viewBox="0 0 32 32" width="30" height="30" aria-hidden="true">
            <circle cx="16" cy="16" r="12.5" fill="none" stroke="currentColor" stroke-width="3" />
            <circle cx="16" cy="16" r="4" fill="currentColor" />
          </svg>
          <h1>Right-Hand Rule Practice</h1>
        </div>
        <div class="controls">
          <div class="seg" role="radiogroup" aria-label="Color theme">
            {THEME_OPTS.map((o) => (
              <button
                key={o.id}
                type="button"
                role="radio"
                aria-checked={mode === o.id}
                class={mode === o.id ? 'on' : undefined}
                title={`${o.label} theme`}
                aria-label={`${o.label} theme`}
                onClick={() => setMode(o.id)}
              >
                {o.icon}
              </button>
            ))}
          </div>
          <button
            type="button"
            class="icon-btn theme-cycle"
            title={`Theme: ${themeOpt.label} (tap to change)`}
            aria-label={`Theme: ${themeOpt.label}. Change theme`}
            onClick={() => setMode(THEME_OPTS[(THEME_OPTS.indexOf(themeOpt) + 1) % THEME_OPTS.length].id)}
          >
            {themeOpt.icon}
          </button>
          <button
            type="button"
            class={`icon-btn${sound ? ' on' : ''}`}
            aria-pressed={sound}
            title={sound ? 'Sound on' : 'Sound off'}
            aria-label="Sound effects"
            onClick={toggleSound}
          >
            <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
              <path d="M4 9.5h3.5L12 5.5v13l-4.5-4H4z" fill="currentColor" />
              {sound ? (
                <path d="M15.5 9a4 4 0 0 1 0 6M18 6.5a7.5 7.5 0 0 1 0 11" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" />
              ) : (
                <path d="M16 9.5l5 5M21 9.5l-5 5" stroke="currentColor" stroke-width="2" stroke-linecap="round" />
              )}
            </svg>
          </button>
        </div>
      </header>

      {TYPES.length > 0 ? (
        <div class="bar-row">
          <button type="button" class={`topic-toggle${topicsOpen ? ' open' : ''}`} aria-expanded={topicsOpen} onClick={() => setTopicsOpen(!topicsOpen)}>
            <span class="tt-label">Topics</span>
            <span class="tt-value">{topicSummary}</span>
            <span class="chev" aria-hidden="true">
              ▾
            </span>
          </button>
          <div class="pills" aria-label="Session stats">
            <span class="pill" title="Correct this session">
              <b>{score.c}</b>/{score.n}
            </span>
            <span key={streak} class={`pill streak${streak >= 3 ? ' hot' : ''}${streak > 0 ? ' bump' : ''}`} title="Current streak">
              <span aria-hidden="true">⚡</span> <b>{streak}</b>
            </span>
            <span class="pill best" title="Best streak (saved)">
              <span aria-hidden="true">★</span> <b>{Math.max(progress.best, streak)}</b>
            </span>
          </div>
        </div>
      ) : null}

      {topicsOpen && TYPES.length > 0 ? (
        <div class="panel topics-panel">
          <TopicPicker types={TYPES} selection={selection} onChange={changeSelection} />
        </div>
      ) : null}

      {notice ? (
        <div class="notice" role="status">
          {notice}
        </div>
      ) : null}

      <main>
        {TYPES.length === 0 ? (
          <article class="card">
            <div class="empty">
              <svg viewBox="0 0 64 64" width="64" height="64" aria-hidden="true" class="empty-art">
                <circle cx="32" cy="32" r="24" fill="none" stroke="currentColor" stroke-width="4" />
                <circle cx="32" cy="32" r="7" fill="currentColor" />
              </svg>
              <p class="empty-title">No topics yet</p>
              <p class="muted">Practice problems are on their way. Check back soon!</p>
            </div>
          </article>
        ) : type && ref ? (
          <CardBoundary key={`${ref.t}:${ref.s}`} onNext={next}>
            <ProblemCard type={type} seed={ref.s} onResult={onResult} onNext={next} onCopyLink={copyLink} />
          </CardBoundary>
        ) : (
          <article class="card">
            <div class="empty">
              <p class="empty-title">Pick a topic to start</p>
              <p class="muted">Choose at least one topic above.</p>
              <button type="button" class="btn-primary" onClick={() => setTopicsOpen(true)}>
                Choose topics
              </button>
            </div>
          </article>
        )}

        <CheatSheet />
        {TYPES.length > 0 ? <ProgressPanel types={TYPES} progress={progress} onReset={resetProgress} /> : null}
      </main>

      <footer class="foot">
        <p>Diagrams are generated — infinite practice.</p>
        <p class="keys">
          Keys:{' '}
          <span class="nw">
            <kbd>←</kbd>
            <kbd>↑</kbd>
            <kbd>→</kbd>
            <kbd>↓</kbd> directions
          </span>{' '}
          · <span class="nw"><kbd>O</kbd> out</span> · <span class="nw"><kbd>I</kbd> in</span> ·{' '}
          <span class="nw"><kbd>Z</kbd> zero</span> ·{' '}
          <span class="nw">
            <kbd>1</kbd>–<kbd>9</kbd> choice
          </span>{' '}
          · <span class="nw"><kbd>H</kbd> hint</span> · <span class="nw"><kbd>Enter</kbd> next</span>
        </p>
      </footer>
    </div>
  )
}
