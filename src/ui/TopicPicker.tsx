import type { Category, ProblemType } from '../problems/types'
import { CATEGORY_LABEL } from '../problems/types'
import type { Selection } from './hash'

export type { Selection }

export function groupByCategory(types: ProblemType[]): [Category, ProblemType[]][] {
  const order = Object.keys(CATEGORY_LABEL) as Category[]
  return order.map((c) => [c, types.filter((t) => t.category === c)] as [Category, ProblemType[]]).filter(([, ts]) => ts.length > 0)
}

/** Selection → the set of type ids actually in play (unknown ids dropped; empty/stale → all). */
export function activeIds(sel: Selection, types: ProblemType[]): Set<string> {
  const all = types.map((t) => t.id)
  if (sel == null) return new Set(all)
  const valid = sel.filter((id) => all.includes(id))
  // A saved selection whose ids have all been renamed/removed falls back to everything
  // (an intentionally empty selection, [], stays empty).
  if (sel.length > 0 && valid.length === 0) return new Set(all)
  return new Set(valid)
}

export function TopicPicker(props: {
  types: ProblemType[]
  selection: Selection
  onChange: (s: Selection) => void
  /** types that can't come up under the current answer/view settings (shown struck through) */
  unavailable?: Set<string>
}) {
  const { types } = props
  const active = activeIds(props.selection, types)
  const isAll = props.selection == null || active.size === types.length

  const commit = (next: Set<string>) => {
    props.onChange(next.size === types.length ? null : [...next])
  }
  const toggleType = (id: string) => {
    const next = new Set(isAll ? [] : active)
    if (isAll) {
      // From "All", tapping a type means "just this one".
      next.add(id)
    } else if (next.has(id)) next.delete(id)
    else next.add(id)
    commit(next)
  }
  const toggleCategory = (ts: ProblemType[]) => {
    const allOn = !isAll && ts.every((t) => active.has(t.id))
    const next = new Set(isAll ? [] : active)
    for (const t of ts) {
      if (allOn) next.delete(t.id)
      else next.add(t.id)
    }
    commit(next)
  }

  return (
    <div class="topics">
      <div class="topic-row">
        <button type="button" class={`chip chip-all${isAll ? ' on' : ''}`} aria-pressed={isAll} onClick={() => props.onChange(null)}>
          All topics
        </button>
      </div>
      {groupByCategory(types).map(([cat, ts]) => {
        const catOn = !isAll && ts.every((t) => active.has(t.id))
        return (
          <div class="topic-group" key={cat}>
            <button type="button" class={`chip chip-cat${catOn ? ' on' : ''}`} aria-pressed={catOn} onClick={() => toggleCategory(ts)}>
              {CATEGORY_LABEL[cat]}
            </button>
            <div class="topic-row">
              {ts.map((t) => {
                const on = !isAll && active.has(t.id)
                const off = props.unavailable?.has(t.id)
                return (
                  <button
                    type="button"
                    key={t.id}
                    class={`chip chip-type${on ? ' on' : ''}${off ? ' unavail' : ''}`}
                    aria-pressed={on}
                    title={off ? `${t.skill} (Not with the answer types / coil views chosen below.)` : t.skill}
                    onClick={() => toggleType(t.id)}
                  >
                    {t.title}
                  </button>
                )
              })}
            </div>
          </div>
        )
      })}
      {active.size === 0 ? <p class="topic-empty">Pick at least one topic to practice.</p> : null}
    </div>
  )
}
