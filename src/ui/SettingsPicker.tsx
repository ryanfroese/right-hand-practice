import type { AnswerKind, CoilView, PadMode, PracticeSettings } from '../practice/settings'
import { ANSWER_KINDS, COIL_VIEWS } from '../practice/settings'

const KIND_OPTS: Record<AnswerKind, { glyph: string; label: string }> = {
  plane: { glyph: '↑↓←→', label: 'In the page' },
  depth: { glyph: '⊙⊗', label: 'Into / out of the page' },
  rot: { glyph: '↻↺', label: 'Clockwise / counterclockwise' },
  zero: { glyph: '0', label: 'Zero / no current' },
}

const VIEW_OPTS: Record<CoilView, { label: string; title: string }> = {
  side: { label: 'Side-on', title: 'Coil axis runs left–right' },
  upright: { label: 'Upright', title: 'Coil axis runs up–down the page' },
  end: { label: 'End-on', title: 'Looking straight down the coil axis (answers can be clockwise / counterclockwise)' },
}

const PAD_OPTS: { id: PadMode; label: string; title: string }[] = [
  { id: 'full', label: 'Every direction', title: 'All six directions (plus rotations where a coil could need one) on every direction question' },
  { id: 'focused', label: 'Only likely answers', title: 'Just the answers the picture leaves open, e.g. up/down for the front of a side-on coil' },
]

/** Toggle `x` in `list`, refusing to empty it; keeps the canonical order of `all`. */
function toggle<T>(list: readonly T[], x: T, all: readonly T[]): T[] {
  const on = list.includes(x)
  if (on && list.length === 1) return [...list]
  return all.filter((y) => (y === x ? !on : list.includes(y)))
}

export function SettingsPicker(props: { settings: PracticeSettings; onChange: (s: PracticeSettings) => void }) {
  const s = props.settings
  return (
    <div class="settings">
      <fieldset class="set-group">
        <legend>Answers that can come up</legend>
        <div class="topic-row">
          {ANSWER_KINDS.map((k) => {
            const on = s.kinds.includes(k)
            const last = on && s.kinds.length === 1
            return (
              <button
                key={k}
                type="button"
                class={`chip chip-kind${on ? ' on' : ''}`}
                aria-pressed={on}
                aria-disabled={last}
                title={last ? 'At least one kind of answer has to stay on' : undefined}
                onClick={() => props.onChange({ ...s, kinds: toggle(s.kinds, k, ANSWER_KINDS) })}
              >
                <span class="kind-glyph" aria-hidden="true">
                  {KIND_OPTS[k].glyph}
                </span>{' '}
                {KIND_OPTS[k].label}
              </button>
            )
          })}
        </div>
        <p class="set-note">Questions whose answer is switched off are skipped, and those buttons are hidden.</p>
      </fieldset>

      <fieldset class="set-group">
        <legend>Answer buttons</legend>
        <div class="segtext" role="radiogroup" aria-label="Answer buttons">
          {PAD_OPTS.map((o) => (
            <button
              key={o.id}
              type="button"
              role="radio"
              aria-checked={s.pad === o.id}
              class={s.pad === o.id ? 'on' : undefined}
              title={o.title}
              onClick={() => props.onChange({ ...s, pad: o.id })}
            >
              {o.label}
            </button>
          ))}
        </div>
      </fieldset>

      <fieldset class="set-group">
        <legend>Coil views</legend>
        <div class="topic-row">
          {COIL_VIEWS.map((v) => {
            const on = s.views.includes(v)
            const last = on && s.views.length === 1
            return (
              <button
                key={v}
                type="button"
                class={`chip${on ? ' on' : ''}`}
                aria-pressed={on}
                aria-disabled={last}
                title={last ? 'At least one view has to stay on' : VIEW_OPTS[v].title}
                onClick={() => props.onChange({ ...s, views: toggle(s.views, v, COIL_VIEWS) })}
              >
                {VIEW_OPTS[v].label}
              </button>
            )
          })}
        </div>
      </fieldset>
    </div>
  )
}
