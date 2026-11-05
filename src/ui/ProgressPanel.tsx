import type { ProblemType } from '../problems/types'
import type { Progress } from './progress'
import { groupByCategory } from './TopicPicker'
import { CATEGORY_LABEL } from '../problems/types'

export function ProgressPanel(props: { types: ProblemType[]; progress: Progress; onReset: () => void }) {
  const { perType } = props.progress
  const attempted = props.types.filter((t) => (perType[t.id]?.n ?? 0) > 0)
  const totals = Object.values(perType).reduce((a, s) => ({ c: a.c + s.c, n: a.n + s.n }), { c: 0, n: 0 })
  return (
    <details class="panel progress">
      <summary>
        <span class="panel-icon" aria-hidden="true">▤</span>
        Your progress
        {totals.n > 0 ? <span class="summary-note">{Math.round((100 * totals.c) / totals.n)}% of {totals.n}</span> : null}
      </summary>
      {attempted.length === 0 ? (
        <p class="muted">Answer a few questions and your accuracy per topic shows up here.</p>
      ) : (
        <div class="stats">
          {groupByCategory(attempted).map(([cat, ts]) => (
            <div key={cat} class="stat-group">
              <h4>{CATEGORY_LABEL[cat]}</h4>
              {ts.map((t) => {
                const s = perType[t.id]
                const pct = Math.round((100 * s.c) / s.n)
                return (
                  <div class="stat-row" key={t.id}>
                    <span class="stat-name">{t.title}</span>
                    <span class="bar" aria-hidden="true">
                      <span class={`fill ${pct >= 80 ? 'hi' : pct >= 50 ? 'mid' : 'lo'}`} style={{ width: `${Math.max(pct, 3)}%` }} />
                    </span>
                    <span class="stat-num">
                      {s.c}/{s.n}
                    </span>
                  </div>
                )
              })}
            </div>
          ))}
        </div>
      )}
      <div class="panel-actions">
        <span class="muted">Best streak: {props.progress.best}</span>
        <button
          type="button"
          class="btn-text danger"
          onClick={() => {
            if (confirm('Reset all saved progress (accuracy and best streak)?')) props.onReset()
          }}
        >
          Reset progress
        </button>
      </div>
    </details>
  )
}
