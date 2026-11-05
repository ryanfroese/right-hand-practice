import { useEffect, useMemo, useRef, useState } from 'preact/hooks'
import type { ProblemType } from '../problems/types'
import { CATEGORY_LABEL } from '../problems/types'
import { makeRng } from '../rng'
import { AnswerPad, KEY_TO_ID, type PadStage } from './AnswerPad'
import { prefersReducedMotion } from './motion'

export interface Feedback {
  text: string
  streakCallout: boolean
}

function isTyping(el: Element | null) {
  return !!el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.tagName === 'SELECT' || (el as HTMLElement).isContentEditable)
}

export function ProblemCard(props: {
  type: ProblemType
  seed: number
  onResult: (correct: boolean) => Feedback
  onNext: () => void
  onCopyLink: () => Promise<boolean>
}) {
  const { type, seed } = props
  const gen = useMemo(() => {
    try {
      return { problem: type.generate(makeRng(seed)), error: null }
    } catch (e) {
      console.error(e)
      return { problem: null, error: e }
    }
  }, [type, seed])

  const [picked, setPicked] = useState<string | null>(null)
  const [stage, setStage] = useState<PadStage>('ask')
  const [showCorrect, setShowCorrect] = useState(false)
  const [feedback, setFeedback] = useState<Feedback | null>(null)
  const [hint, setHint] = useState(false)
  const [copied, setCopied] = useState<'idle' | 'ok' | 'fail'>('idle')
  const timers = useRef<number[]>([])
  const nextRef = useRef<HTMLButtonElement>(null)
  const reduced = useMemo(prefersReducedMotion, [])

  useEffect(() => () => timers.current.forEach((t) => clearTimeout(t)), [])
  const later = (ms: number, fn: () => void) => {
    timers.current.push(window.setTimeout(fn, reduced ? Math.min(ms, 120) : ms))
  }

  const problem = gen.problem
  const correct = problem != null && picked === problem.answer

  const pick = (id: string) => {
    if (!problem || stage !== 'ask') return
    setPicked(id)
    setStage('locked')
    const ok = id === problem.answer
    setFeedback(props.onResult(ok))
    if (ok) {
      later(500, () => setStage('revealed'))
    } else {
      later(450, () => setShowCorrect(true))
      later(800, () => setStage('revealed'))
    }
  }


  useEffect(() => {
    if (stage === 'revealed') nextRef.current?.focus({ preventScroll: true })
    if (stage === 'revealed') nextRef.current?.scrollIntoView({ block: 'nearest', behavior: reduced ? 'auto' : 'smooth' })
  }, [stage])

  // Keyboard: arrows/O/I/Z/digits choose; Enter/Space = next (only when focus isn't on a control).
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey || isTyping(document.activeElement)) return
      const onBody = document.activeElement === document.body || document.activeElement === document.documentElement || document.activeElement == null
      if (e.key === 'Enter' || e.key === ' ') {
        if (onBody && (stage === 'revealed' || !problem)) {
          e.preventDefault()
          props.onNext()
        }
        return
      }
      if (!problem || stage !== 'ask') return
      // Answer keys only when focus is on the page itself or on the answer pad, so arrow keys
      // still work normally inside the theme radiogroup, topic chips, etc.
      const ae = document.activeElement
      if (!onBody && !(ae instanceof Element && ae.closest('.pad'))) return
      const k = e.key.length === 1 ? e.key.toLowerCase() : e.key
      let id: string | undefined = KEY_TO_ID[k]
      if (id && !problem.choices.some((c) => c.id === id)) id = undefined
      if (!id && /^[1-9]$/.test(k)) id = problem.choices[Number(k) - 1]?.id
      if (id) {
        e.preventDefault()
        pick(id)
      } else if (k === 'h' && problem.hint) setHint(true)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  })

  const copy = async () => {
    const ok = await props.onCopyLink()
    setCopied(ok ? 'ok' : 'fail')
    timers.current.push(window.setTimeout(() => setCopied('idle'), 1600))
  }

  const head = (
    <div class="card-head">
      <span class="tag">
        <span class="tag-cat">{CATEGORY_LABEL[type.category]}</span>
        <span class="tag-title">{type.title}</span>
      </span>
      <button type="button" class="btn-ghost small" onClick={copy} title="Copy a link to this exact problem">
        <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true">
          <path
            d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
            stroke-linecap="round"
          />
        </svg>
        <span aria-live="polite">{copied === 'ok' ? 'Copied!' : copied === 'fail' ? 'Copy failed' : 'Copy link'}</span>
      </button>
    </div>
  )

  if (!problem) {
    return (
      <article class="card">
        {head}
        <div class="empty">
          <p class="empty-title">Oops — this problem didn’t build.</p>
          <p class="muted">Let’s try a different one.</p>
          <button type="button" class="btn-primary" onClick={props.onNext}>
            Try another
          </button>
        </div>
      </article>
    )
  }

  const answered = stage !== 'ask'
  return (
    <article class={`card${answered ? (correct ? ' card-ok' : ' card-bad') : ''}`}>
      {head}
      <div class="diagram-wrap">{problem.diagram}</div>
      <div class="prompt">{problem.prompt}</div>

      {problem.hint && !answered ? (
        hint ? (
          <div class="hint" role="note">
            <span class="hint-label">Hint</span> {problem.hint}
          </div>
        ) : (
          <button type="button" class="btn-text hint-btn" onClick={() => setHint(true)}>
            Need a hint?
          </button>
        )
      ) : null}

      <AnswerPad
        choices={problem.choices}
        answer={problem.answer}
        picked={picked}
        stage={stage}
        showCorrect={showCorrect}
        burst={!reduced}
        onPick={pick}
      />

      <div class="feedback-slot" aria-live="polite">
        {feedback ? (
          <div class={`feedback ${correct ? 'ok' : 'bad'}${feedback.streakCallout ? ' streak' : ''}`}>
            <span class="fb-icon" aria-hidden="true">
              {correct ? '✓' : '✗'}
            </span>
            {feedback.text}
          </div>
        ) : null}
      </div>

      {stage === 'revealed' ? (
        <div class={`explain ${correct ? 'ok' : 'bad'}`}>
          <h3>{correct ? 'Why it works:' : 'Here’s how the rule works:'}</h3>
          <div class="explain-body">{problem.explanation}</div>
          <div class="next-row">
            <button type="button" ref={nextRef} class="btn-primary next" onClick={props.onNext}>
              Next problem <span aria-hidden="true">→</span>
            </button>
            <span class="kbd-tip">
              or press <kbd>Enter</kbd>
            </span>
          </div>
        </div>
      ) : !answered ? (
        <div class="skip-row">
          <button type="button" class="btn-text" onClick={props.onNext}>
            Skip
          </button>
        </div>
      ) : null}
    </article>
  )
}
