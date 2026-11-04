/**
 * Render sample problems to PNG so diagrams can be eyeballed without a browser.
 *   npx tsx scripts/snapshot.tsx [typeIdFilter] [countPerType]
 * Output: snapshots/<typeId>-<seed>.png  (+ .txt with prompt/answer/facts)
 */
import { renderToString } from 'preact-render-to-string'
import { Resvg } from '@resvg/resvg-js'
import { mkdirSync, writeFileSync, rmSync } from 'node:fs'
import { PROBLEM_TYPES } from '../src/problems/index'
import { makeRng } from '../src/rng'

const filter = process.argv[2] && process.argv[2] !== 'all' ? process.argv[2] : ''
const count = Number(process.argv[3] ?? 3)
const dir = 'snapshots'
if (!filter) rmSync(dir, { recursive: true, force: true })
mkdirSync(dir, { recursive: true })

const stripVars = (s: string) => s.replace(/var\(--[\w-]+,\s*(#[0-9a-fA-F]{3,8})\)/g, '$1')
const text = (html: string) => html.replace(/<[^>]+>/g, '').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&#x27;|&#39;/g, "'").replace(/&quot;/g, '"')

let n = 0
for (const t of PROBLEM_TYPES) {
  if (filter && !t.id.startsWith(filter)) continue
  for (let i = 0; i < count; i++) {
    const seed = 1000 + i * 7919
    const p = t.generate(makeRng(seed))
    const svg = stripVars(renderToString(p.diagram as any))
    const png = new Resvg(svg, { fitTo: { mode: 'width', value: 900 }, font: { loadSystemFonts: true }, background: '#ffffff' }).render().asPng()
    writeFileSync(`${dir}/${t.id}-${seed}.png`, png)
    writeFileSync(`${dir}/${t.id}-${seed}.svg`, svg)
    writeFileSync(
      `${dir}/${t.id}-${seed}.txt`,
      `PROMPT: ${text(renderToString(p.prompt as any))}\nCHOICES: ${p.choices.map((c) => c.id).join(', ')}\nANSWER: ${p.answer}\nEXPLANATION: ${text(renderToString(p.explanation as any))}\nFACTS: ${JSON.stringify(p.facts)}\n`,
    )
    n++
  }
}
console.log(`wrote ${n} snapshots to ${dir}/`)
