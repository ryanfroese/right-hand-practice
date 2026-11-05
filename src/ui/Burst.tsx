import { useMemo } from 'preact/hooks'
import { COLORS } from '../theme'

const PALETTE = [COLORS.v, COLORS.B, COLORS.F, COLORS.I]

/** A tiny confetti burst: a dozen DOM spans flying out from the center of the parent. Pure CSS animation. */
export function Burst(props: { count?: number }) {
  const n = props.count ?? 14
  const bits = useMemo(
    () =>
      Array.from({ length: n }, (_, i) => {
        const a = (i / n) * Math.PI * 2 + Math.random() * 0.5
        const d = 46 + Math.random() * 38
        return {
          dx: Math.cos(a) * d,
          dy: Math.sin(a) * d - 10,
          rot: Math.round(Math.random() * 540 - 270),
          color: PALETTE[i % PALETTE.length],
          round: i % 3 === 0,
          delay: Math.round(Math.random() * 60),
        }
      }),
    [n],
  )
  return (
    <span class="burst" aria-hidden="true">
      {bits.map((b, i) => (
        <i
          key={i}
          class={b.round ? 'round' : undefined}
          style={{
            '--dx': `${b.dx.toFixed(1)}px`,
            '--dy': `${b.dy.toFixed(1)}px`,
            '--rot': `${b.rot}deg`,
            background: b.color,
            animationDelay: `${b.delay}ms`,
          }}
        />
      ))}
    </span>
  )
}
