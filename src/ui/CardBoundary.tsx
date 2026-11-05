import { Component } from 'preact'
import type { ComponentChildren } from 'preact'

/**
 * Catches render-time errors from a problem's diagram/prompt JSX (which runs after
 * generate()), so one bad seed shows a friendly card instead of blanking the app.
 * Keyed by problem in app.tsx, so it resets for every new problem.
 */
export class CardBoundary extends Component<{ children: ComponentChildren; onNext: () => void }, { failed: boolean }> {
  state = { failed: false }

  static getDerivedStateFromError() {
    return { failed: true }
  }

  componentDidCatch(err: unknown) {
    console.error(err)
  }

  render() {
    if (!this.state.failed) return this.props.children
    return (
      <article class="card">
        <div class="empty">
          <p class="empty-title">Oops — this problem didn’t build.</p>
          <p class="muted">Let’s try a different one.</p>
          <button type="button" class="btn-primary" onClick={this.props.onNext}>
            Try another
          </button>
        </div>
      </article>
    )
  }
}
