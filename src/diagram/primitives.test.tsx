import { expect, it } from 'vitest'
import { renderToString } from 'preact-render-to-string'
import { Diagram, Charge } from './primitives'

it('renders jsx in tests', () => {
  const s = renderToString(<Diagram height={100} title="t" desc="d"><Charge x={10} y={10} sign="+" /></Diagram>)
  expect(s).toContain('<svg')
})
