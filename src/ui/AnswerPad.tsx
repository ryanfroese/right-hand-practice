import type { Choice } from '../problems/types'
import { Burst } from './Burst'

export type PadStage = 'ask' | 'locked' | 'revealed'

const DPAD = new Set(['up', 'down', 'left', 'right', 'zero'])
const DEPTH = new Set(['out', 'in'])

/** Choice ids a key selects. Digits are handled separately (by index). */
export const KEY_TO_ID: Record<string, string> = {
  ArrowUp: 'up',
  ArrowDown: 'down',
  ArrowLeft: 'left',
  ArrowRight: 'right',
  o: 'out',
  i: 'in',
  z: 'zero',
  '0': 'zero',
}

function keyHint(c: Choice, index: number): string {
  const byId: Record<string, string> = { up: '↑', down: '↓', left: '←', right: '→', out: 'O', in: 'I', zero: 'Z' }
  return byId[c.id] ?? String(index + 1)
}

export function AnswerPad(props: {
  choices: Choice[]
  answer: string
  picked: string | null
  stage: PadStage
  showCorrect: boolean
  burst: boolean
  onPick: (id: string) => void
}) {
  const { choices, answer, picked, stage } = props
  const ids = choices.map((c) => c.id)
  // A d-pad only makes sense with both a horizontal and a vertical direction; otherwise use a row.
  const isDirPad =
    ids.every((id) => DPAD.has(id) || DEPTH.has(id)) &&
    ids.some((id) => id === 'left' || id === 'right') &&
    ids.some((id) => id === 'up' || id === 'down')

  const btn = (c: Choice, extraClass = '') => {
    const index = choices.indexOf(c)
    const isPicked = picked === c.id
    const isAnswer = c.id === answer
    const cls = ['choice', extraClass]
    if (stage !== 'ask') {
      if (isPicked && isAnswer) cls.push('is-correct', 'pop')
      else if (isPicked) cls.push('is-wrong', 'shake')
      else if (isAnswer && props.showCorrect) cls.push('is-correct', 'glow')
      else cls.push('is-dim')
    }
    return (
      <button
        key={c.id}
        type="button"
        class={cls.join(' ')}
        style={isDirPad && DPAD.has(c.id) ? { gridArea: c.id } : undefined}
        aria-disabled={stage !== 'ask'}
        aria-pressed={isPicked}
        onClick={() => props.onPick(c.id)}
      >
        {c.glyph ? (
          <span class="glyph" aria-hidden="true">
            {c.glyph}
          </span>
        ) : null}
        <span class="label">{c.label}</span>
        <kbd class="key" aria-hidden="true">
          {keyHint(c, index)}
        </kbd>
        {isPicked && isAnswer && props.burst ? <Burst /> : null}
      </button>
    )
  }

  if (!isDirPad) {
    return (
      <div class={`pad pad-row n${choices.length}`} role="group" aria-label="Answer choices">
        {choices.map((c) => btn(c))}
      </div>
    )
  }

  const flat = choices.filter((c) => DPAD.has(c.id))
  const depth = choices.filter((c) => DEPTH.has(c.id))
  return (
    <div class={`pad pad-dir${depth.length ? '' : ' no-depth'}`} role="group" aria-label="Answer choices">
      <div class="dpad">
        {flat.map((c) => btn(c))}
        {ids.includes('zero') ? null : <span class="dpad-hub" aria-hidden="true" />}
      </div>
      {depth.length ? <div class={`depth n${depth.length}`}>{depth.map((c) => btn(c, 'depth-btn'))}</div> : null}
    </div>
  )
}
