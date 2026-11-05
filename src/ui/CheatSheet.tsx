import { Q } from '../problems/Q'
import { COLORS } from '../theme'

const Pos = () => <b style={{ color: COLORS.positive }}>positive</b>
const Neg = () => <b style={{ color: COLORS.negative }}>negative</b>

export function CheatSheet() {
  return (
    <details class="panel cheat">
      <summary>
        <span class="panel-icon" aria-hidden="true">✦</span>
        Right-hand rule cheat sheet
      </summary>
      <div class="cheat-grid">
        <section>
          <h3>
            Moving charge: <Q k="F">F</Q> = q<Q k="v">v</Q> × <Q k="B">B</Q>
          </h3>
          <p>
            Fingers along <Q k="v">v</Q>, curl them toward <Q k="B">B</Q> — your thumb points along <Q k="F">F</Q> for a <Pos /> charge. For a <Neg /> charge
            (electron), <Q k="F">F</Q> is reversed. If <Q k="v">v</Q> is parallel to <Q k="B">B</Q>, <Q k="F">F</Q> = 0.
          </p>
        </section>
        <section>
          <h3>
            Current in a field: <Q k="F">F</Q> = <Q k="I">I</Q>L × <Q k="B">B</Q>
          </h3>
          <p>
            Same hand, but fingers point along the current <Q k="I">I</Q>. Current is already the direction positive charge flows, so no flip.
          </p>
        </section>
        <section>
          <h3>Field around a wire (grip rule)</h3>
          <p>
            Grab the wire with your thumb along <Q k="I">I</Q>. Your fingers curl the way <Q k="B">B</Q> circles the wire: it comes <b>out</b> on one side and goes{' '}
            <b>in</b> on the other.
          </p>
        </section>
        <section>
          <h3>Loops &amp; solenoids</h3>
          <p>
            Curl your fingers with the current <Q k="I">I</Q> around the loop. Your thumb points along <Q k="B">B</Q> inside the loop — that end is the{' '}
            <b style={{ color: COLORS.northPole }}>N</b> pole.
          </p>
        </section>
        <section>
          <h3>Lenz’s law</h3>
          <p>
            The induced current makes its own <Q k="B">B</Q> that <b>opposes the change</b> in flux. Flux growing → induced <Q k="B">B</Q> points the opposite
            way. Flux shrinking → induced <Q k="B">B</Q> points the same way. Then use the loop rule to find <Q k="induced">I</Q>.
          </p>
        </section>
        <section>
          <h3>Reading the diagrams</h3>
          <ul class="conv">
            <li>
              <span class="sym" aria-hidden="true">⊙</span> out of the page (arrow tip coming at you)
            </li>
            <li>
              <span class="sym" aria-hidden="true">⊗</span> into the page (arrow tail going away)
            </li>
            <li>
              <span class="line solid" aria-hidden="true" /> solid = near side of a coil (toward you)
            </li>
            <li>
              <span class="line dashed" aria-hidden="true" /> dashed = far side (behind)
            </li>
          </ul>
          <p class="legend">
            Colors: <Q k="v">v velocity</Q> · <Q k="B">B field</Q> · <Q k="F">F force</Q> · <Q k="I">I current</Q>
          </p>
        </section>
      </div>
    </details>
  )
}
