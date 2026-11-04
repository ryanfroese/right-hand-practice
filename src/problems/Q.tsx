import type { ComponentChildren } from 'preact'
import { COLORS } from '../theme'

/** Inline colored quantity in prompt/explanation text, matching the diagram color code. */
export function Q(props: { k: 'v' | 'B' | 'F' | 'I' | 'induced'; children: ComponentChildren }) {
  const color = props.k === 'induced' ? COLORS.I : COLORS[props.k]
  return (
    <b class="q" style={{ color }}>
      {props.children}
    </b>
  )
}
