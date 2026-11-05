import { useEffect, useMemo, useRef, useState } from 'preact/hooks'
import { PROBLEM_TYPES } from './problems/index'
import type { JSX } from 'preact'
import type { ProblemType } from './problems/types'
import { CheatSheet } from './ui/CheatSheet'
import { hashHasLink, parseConfig, readHash, randomSeed, shareUrl, writeHash, type PracticeConfig, type ProblemRef } from './ui/hash'
import { answerAllowed, findSeed, generate, isDefault, normalizeSettings, typeAvailable, type PracticeSettings } from './practice/settings'
import { SettingsPicker } from './ui/SettingsPicker'
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

/** Types in the topic selection that can come up under the answer/view settings. */
function poolFor(sel: Selection, settings: PracticeSettings): ProblemType[] {
  const ids = activeIds(sel, TYPES)
  return TYPES.filter((t) => ids.has(t.id) && typeAvailable(t, settings))
}

/** A fresh problem from the pool whose answer the settings allow (null if the pool can't make one). */
function freshRef(pool: ProblemType[], settings: PracticeSettings, avoid?: string): ProblemRef | null {
  let cands = pool
  while (cands.length) {
    const t = choose(cands, avoid)!
    const s = findSeed(t, randomSeed(), settings)
    if (s != null) return { t: t.id, s }
    cands = cands.filter((x) => x !== t)
  }
  return null
}

/** Practice set: an instructor's link wins over what this browser saved (and replaces it). */
function initialConfig(): PracticeConfig {
  const fromUrl = parseConfig(location.hash, TYPES)
  if (fromUrl) {
    save('selection', fromUrl.selection)
    save('settings', fromUrl.settings)
    return fromUrl
  }
  return { selection: load<Selection>('selection', null), settings: normalizeSettings(load('settings', null)) }
}

/** Hash link wins; otherwise a random problem from the selection. */
function initialRef(cfg: PracticeConfig): { ref: ProblemRef | null; badLink: boolean } {
  const h = readHash()
  if (h && typeById(h.t)) return { ref: h, badLink: false }
  return { ref: freshRef(poolFor(cfg.selection, cfg.settings), cfg.settings), badLink: h != null || hashHasLink() }
}

/** Does the problem on screen still fit these settings? (answer kind allowed, coil view switched on) */
function refFits(ref: ProblemRef, settings: PracticeSettings): boolean {
  const t = typeById(ref.t)
  if (!t) return false
  try {
    const p = generate(t, ref.s, settings)
    const view = (p.facts as { view?: string }).view
    return answerAllowed(p.answer, settings) && (!t.views || !view || settings.views.includes(view as never))
  } catch {
    return false
  }
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
  const initCfg = useMemo(initialConfig, [])
  const [selection, setSelection] = useState<Selection>(initCfg.selection)
  const [settings, setSettings] = useState<PracticeSettings>(initCfg.settings)
  const cfg: PracticeConfig = { selection, settings }
  const init = useMemo(() => initialRef(initCfg), [])
  const [ref, setRef] = useState<ProblemRef | null>(init.ref)
  const [notice, setNotice] = useState<string | null>(init.badLink ? 'That problem link isn’t available any more — here’s a fresh one.' : null)
  const [topicsOpen, setTopicsOpen] = useState(false)
  const [setCopied, setSetCopied] = useState<'idle' | 'ok' | 'fail'>('idle')
  const [progress, setProgress] = useState<Progress>(loadProgress)
  const [score, setScore] = useState({ c: 0, n: 0 })
  const [streak, setStreak] = useState(0)
  const streakRef = useRef(0)

  // Keep the URL in sync so any problem can be shared/reloaded exactly.
  useEffect(() => {
    writeHash(ref, cfg, TYPES)
  }, [ref, selection, settings])

  // Pasting a link into the same tab.
  useEffect(() => {
    const onHash = () => {
      const c = parseConfig(location.hash, TYPES)
      if (c) {
        setSelection(c.selection)
        setSettings(c.settings)
        save('selection', c.selection)
        save('settings', c.settings)
      }
      const h = readHash()
      if (h && typeById(h.t) && (h.t !== ref?.t || h.s !== ref?.s)) setRef(h)
      else if (!h && c) setRef(freshRef(poolFor(c.selection, c.settings), c.settings))
    }
    window.addEventListener('hashchange', onHash)
    return () => window.removeEventListener('hashchange', onHash)
  }, [ref])

  useEffect(() => {
    if (!notice) return
    const id = setTimeout(() => setNotice(null), 6000)
    return () => clearTimeout(id)
  }, [notice])

  const settingsKey = `${settings.kinds.join()}|${settings.views.join()}`
  const pool = useMemo(() => poolFor(selection, settings), [selection, settingsKey])
  const unavailable = useMemo(() => new Set(TYPES.filter((t) => !typeAvailable(t, settings)).map((t) => t.id)), [settingsKey])

  const next = () => {
    setRef(freshRef(pool, settings, ref?.t))
    window.scrollTo({ top: 0, behavior: prefersReducedMotion() ? 'auto' : 'smooth' })
  }

  const changeSelection = (s: Selection) => {
    setSelection(s)
    save('selection', s)
    const p = poolFor(s, settings)
    if (!ref || !p.some((t) => t.id === ref.t)) setRef(freshRef(p, settings))
  }

  const changeSettings = (s: PracticeSettings) => {
    setSettings(s)
    save('settings', s)
    const p = poolFor(selection, s)
    // keep the problem on screen if it still fits (e.g. only the button count changed)
    if (!ref || !p.some((t) => t.id === ref.t) || !refFits(ref, s)) setRef(freshRef(p, s))
  }

  const copySetLink = async () => {
    const ok = await copyText(shareUrl(null, cfg, TYPES))
    setSetCopied(ok ? 'ok' : 'fail')
    window.setTimeout(() => setSetCopied('idle'), 1600)
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

  const copyLink = async (): Promise<boolean> => (ref ? copyText(shareUrl(ref, cfg, TYPES)) : false)

  const copyText = async (url: string): Promise<boolean> => {
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
    (pool.length === TYPES.length ? 'All topics' : pool.length === 1 ? pool[0].title : `${pool.length} of ${TYPES.length} topics`) +
    (isDefault(settings) ? '' : ' · custom answers')

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
            <span class="tt-label">Practice</span>
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
          <TopicPicker types={TYPES} selection={selection} onChange={changeSelection} unavailable={unavailable} />
          <SettingsPicker settings={settings} onChange={changeSettings} />
          <div class="set-share">
            <button type="button" class="btn-ghost small" onClick={copySetLink}>
              <span aria-live="polite">{setCopied === 'ok' ? 'Copied!' : setCopied === 'fail' ? 'Copy failed' : 'Copy link to this practice set'}</span>
            </button>
            <span class="muted">Students who open it get these topics and answer settings (they can still change them).</span>
          </div>
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
          <CardBoundary key={`${ref.t}:${ref.s}:${settings.views.join()}`} onNext={next}>
            <ProblemCard type={type} seed={ref.s} settings={settings} onResult={onResult} onNext={next} onCopyLink={copyLink} />
          </CardBoundary>
        ) : (
          <article class="card">
            <div class="empty">
              <p class="empty-title">Pick a topic to start</p>
              <p class="muted">{activeIds(selection, TYPES).size ? "None of the chosen topics fit the answer settings — switch on more answer types or coil views." : "Choose at least one topic above."}</p>
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
