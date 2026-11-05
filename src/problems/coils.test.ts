import { describe, expect, it } from 'vitest'
import { makeRng } from '../rng'
import { type Dir, type Vec3, add, cross, neg, toDir, vec } from '../physics/vec'
import type { Problem, ProblemType } from './types'
import { coilsTypes } from './coils'
import { renderToString } from 'preact-render-to-string'
import { COLORS } from '../theme'

const N = 300

function gen(t: ProblemType): Problem[] {
  return Array.from({ length: N }, (_, seed) => t.generate(makeRng(seed)))
}
const byId = (id: string) => {
  const t = coilsTypes.find((x) => x.id === id)
  if (!t) throw new Error(`missing type ${id}`)
  return t
}

// ---------------------------------------------------------------------------
// Independent physics (Biot–Savart, element-by-element), page coords +z = out
// ---------------------------------------------------------------------------

/** Rotate an in-plane vector by +90° (ccw seen from +z) or −90°. */
const rot90 = (a: Vec3, ccw: boolean): Vec3 => (ccw ? [-a[1], a[0], 0] : [a[1], -a[0], 0])

/** B at the center of a loop in the page: sum dl × r̂ (r̂ from element to center) over 4 elements. */
function loopB(rotation: 'cw' | 'ccw'): Dir {
  let sum: Vec3 = [0, 0, 0]
  for (const p of [vec('right'), vec('up'), vec('left'), vec('down')]) {
    const dl = rot90(p, rotation === 'ccw')
    sum = add(sum, cross(dl, neg(p)))
  }
  return toDir(sum)!
}

/**
 * B on the axis of a solenoid (axis along x). One turn: near element at +z
 * carrying current `near`, far element at −z carrying the opposite current.
 * Sum dl × r̂ with r̂ from element to the axis.
 */
function solenoidB(near: Dir): Dir {
  const zHat = vec('out')
  const nearPart = cross(vec(near), neg(zHat))
  const farPart = cross(neg(vec(near)), zHat)
  return toDir(add(nearPart, farPart))!
}

function commonChecks(ps: Problem[]) {
  for (const p of ps) {
    const ids = p.choices.map((c) => c.id)
    expect(new Set(ids).size).toBe(ids.length)
    expect(ids).toContain(p.answer)
  }
}

function expectAll(ps: Problem[], reachable: string[]) {
  const seen = new Set(ps.map((p) => p.answer))
  for (const a of reachable) expect(seen.has(a), `answer ${a} never generated`).toBe(true)
  for (const a of seen) expect(reachable).toContain(a)
}

/** Drawing consistency: near-side current read off the lead layout. */
// ---------------------------------------------------------------------------
// Reading the RENDERED SVG (independent of the generator's geometry helpers)
// ---------------------------------------------------------------------------

interface Head {
  /** tip, screen coords */
  x: number
  y: number
  /** unit direction, PAGE coords (+y up) */
  dir: Vec3
}

const attrEsc = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

/** Amber (current) arrowheads in the rendered diagram. Tip = first polygon point. */
function currentHeads(svg: string): Head[] {
  const re = new RegExp(`<polygon points="([^"]+)" fill="${attrEsc(COLORS.I)}"`, 'g')
  const out: Head[] = []
  for (const m of svg.matchAll(re)) {
    const pts = m[1].trim().split(/\s+/).map((p) => p.split(',').map(Number))
    const [tip, b1, b2] = pts
    const dx = tip[0] - (b1[0] + b2[0]) / 2
    const dy = tip[1] - (b1[1] + b2[1]) / 2
    const len = Math.hypot(dx, dy)
    out.push({ x: tip[0], y: tip[1], dir: [dx / len, -dy / len, 0] })
  }
  return out
}

/** Solid near-side arcs: wire-colored paths made of elliptical arcs. Start and end points (screen). */
function nearArcs(svg: string): { x0: number; y0: number; x1: number; y1: number }[] {
  const re = new RegExp(`<path d="(M [^"]*A [^"]*)" fill="none" stroke="${attrEsc(COLORS.wire)}"`, 'g')
  const out: { x0: number; y0: number; x1: number; y1: number }[] = []
  for (const m of svg.matchAll(re)) {
    const nums = m[1].match(/-?\d+(\.\d+)?/g)!.map(Number)
    out.push({ x0: nums[0], y0: nums[1], x1: nums[nums.length - 2], y1: nums[nums.length - 1] })
  }
  return out
}

/**
 * An upright coil is the side view turned a quarter-turn clockwise. To read it
 * with the side-view logic, turn the drawing back: screen point (X, Y) → (Y, −X),
 * page direction (x, y) → (−y, x). `fwd` maps a side-view page direction to upright.
 */
const unturnPt = (X: number, Y: number): [number, number] => [Y, -X]
const unturnDir = (d: Vec3): Vec3 => [-d[1], d[0], 0]
const turnDir = (d: Vec3): Vec3 => [d[1], -d[0], 0]

/**
 * Near-side current direction derived purely from the drawing: the first
 * (side-view left) lead joins the start of the first near arc, so if that
 * lead's arrow points into the coil the current runs along the arc from its
 * start to its end.
 */
function nearFromDrawing(svg: string, upright: boolean): { fromLeads: Dir; fromHeads: Dir[] } {
  let heads = currentHeads(svg)
  let arcs = nearArcs(svg)
  if (upright) {
    heads = heads.map((h) => {
      const [x, y] = unturnPt(h.x, h.y)
      return { x, y, dir: unturnDir(h.dir) }
    })
    arcs = arcs.map((a) => {
      const [x0, y0] = unturnPt(a.x0, a.y0)
      const [x1, y1] = unturnPt(a.x1, a.y1)
      return { x0, y0, x1, y1 }
    })
  }
  const horiz = heads.filter((h) => Math.abs(h.dir[0]) > 0.99)
  const vert = heads.filter((h) => Math.abs(h.dir[1]) > 0.99)
  const leftLead = horiz.reduce((a, b) => (b.x < a.x ? b : a))
  const first = arcs.reduce((a, b) => (b.x0 < a.x0 ? b : a))
  const entering = leftLead.dir[0] > 0
  // screen dy along the arc in the direction the current travels
  const screenDy = (first.y1 - first.y0) * (entering ? 1 : -1)
  const side: Vec3 = screenDy > 0 ? vec('down') : vec('up')
  const back = (d: Vec3) => toDir(upright ? turnDir(d) : d)!
  return { fromLeads: back(side), fromHeads: vert.map((h) => back(h.dir)) }
}

const DIR_END: Record<string, string> = { left: 'end-left', right: 'end-right', up: 'end-top', down: 'end-bottom' }

describe('coils sanity of the physics helpers', () => {
  it('ccw loop gives B out, near-side current up gives B left', () => {
    expect(loopB('ccw')).toBe('out')
    expect(loopB('cw')).toBe('in')
    expect(solenoidB('up')).toBe('left')
    expect(solenoidB('down')).toBe('right')
  })
})

describe('coil-loop-center', () => {
  const ps = gen(byId('coil-loop-center'))
  it('choices and answer', () => commonChecks(ps))
  it('answer matches Biot–Savart', () => {
    for (const p of ps) {
      const f = p.facts as { rotation: 'cw' | 'ccw'; samplePoint: Dir; sampleCurrent: Dir; gapAt: Dir }
      expect(p.answer).toBe(loopB(f.rotation))
      // the sample element's current direction is consistent with the rotation
      expect(toDir(rot90(vec(f.samplePoint), f.rotation === 'ccw'))).toBe(f.sampleCurrent)
      expect(f.samplePoint).not.toBe(f.gapAt)
    }
  })
  it('drawn tangent arrowheads circulate the stated way', () => {
    for (const p of ps) {
      const f = p.facts as { rotation: 'cw' | 'ccw'; drawn: { cx: number; cy: number; r: number } }
      const heads = currentHeads(renderToString(p.diagram as never))
      let tangent = 0
      for (const h of heads) {
        const rv: Vec3 = [h.x - f.drawn.cx, -(h.y - f.drawn.cy), 0]
        const dist = Math.hypot(rv[0], rv[1])
        const radial = (rv[0] * h.dir[0] + rv[1] * h.dir[1]) / dist
        if (Math.abs(dist - f.drawn.r) > 14 || Math.abs(radial) > 0.5) continue // lead arrows etc.
        tangent++
        const z = cross(rv, h.dir)[2]
        expect(z > 0 ? 'ccw' : 'cw').toBe(f.rotation)
      }
      expect(tangent).toBeGreaterThanOrEqual(2)
    }
  })
  it('distribution', () => expectAll(ps, ['out', 'in']))
})

describe('coil-loop-current', () => {
  const ps = gen(byId('coil-loop-current'))
  it('choices and answer', () => commonChecks(ps))
  it('answer matches Biot–Savart', () => {
    for (const p of ps) {
      const f = p.facts as { B: Dir }
      const rot = (['cw', 'ccw'] as const).filter((r) => loopB(r) === f.B)
      expect(rot).toHaveLength(1)
      expect(p.answer).toBe(rot[0])
    }
  })
  it('distribution', () => expectAll(ps, ['cw', 'ccw']))
})

type SolFacts = { view: 'side' | 'upright' | 'end'; nearSide: Dir; nearCurrent: Dir; leads: 'top' | 'bottom'; flow: 'forward' | 'backward' }

/** The physics answer for each solenoid type, from its stated near-side current. */
const SOL_ANSWER: Record<string, (near: Dir) => string> = {
  'coil-solenoid-field': (near) => solenoidB(near),
  'coil-solenoid-poles': (near) => DIR_END[solenoidB(near)],
  'coil-compass': (near) => solenoidB(near),
}

for (const id of ['coil-solenoid-field', 'coil-solenoid-poles', 'coil-compass']) {
  describe(id, () => {
    const ps = gen(byId(id))
    const sideOn = ps.filter((p) => (p.facts as SolFacts).view !== 'end')
    it('choices and answer', () => commonChecks(ps))
    it('answer matches Biot–Savart on the axis', () => {
      for (const p of sideOn) {
        const f = p.facts as SolFacts
        expect(f.nearSide).toBe('out')
        // field inside = field on the axis just outside (compass) = toward the N end (poles)
        expect(p.answer).toBe(SOL_ANSWER[id](f.nearCurrent))
      }
    })
    it('drawn arrows (near arcs + leads) agree with the stated near-side current', () => {
      for (const p of sideOn) {
        const f = p.facts as SolFacts
        const { fromLeads, fromHeads } = nearFromDrawing(renderToString(p.diagram as never), f.view === 'upright')
        expect(fromHeads.length).toBeGreaterThanOrEqual(5)
        for (const d of fromHeads) expect(d).toBe(fromLeads)
        expect(fromLeads).toBe(f.nearCurrent)
        expect(p.answer).toBe(SOL_ANSWER[id](fromLeads))
      }
    })
  })
}

describe('coil-solenoid-field', () => {
  const ps = gen(byId('coil-solenoid-field'))
  it('end-on: B from the drawn circulation', () => {
    const ends = ps.filter((p) => (p.facts as SolFacts).view === 'end')
    expect(ends.length).toBeGreaterThan(20)
    for (const p of ends) {
      const f = p.facts as { rotation: 'cw' | 'ccw'; drawn: { cx: number; cy: number; r: number } }
      expect(p.answer).toBe(loopB(f.rotation))
      for (const h of currentHeads(renderToString(p.diagram as never))) {
        const rv: Vec3 = [h.x - f.drawn.cx, -(h.y - f.drawn.cy), 0]
        const dist = Math.hypot(rv[0], rv[1])
        if (Math.abs(dist - f.drawn.r) > 14 || Math.abs((rv[0] * h.dir[0] + rv[1] * h.dir[1]) / dist) > 0.5) continue
        expect(cross(rv, h.dir)[2] > 0 ? 'ccw' : 'cw').toBe(f.rotation)
      }
    }
  })
  it('distribution', () => expectAll(ps, ['left', 'right', 'up', 'down', 'out', 'in']))
})

describe('coil-solenoid-poles', () => {
  it('distribution', () => expectAll(gen(byId('coil-solenoid-poles')), ['end-left', 'end-right', 'end-top', 'end-bottom']))
})

describe('coil-compass extras', () => {
  const ps = gen(byId('coil-compass'))
  it('compass appears at every end', () => {
    const ends = new Set(ps.map((p) => (p.facts as { compassEnd: string }).compassEnd))
    expect([...ends].sort()).toEqual(['down', 'left', 'right', 'up'])
  })
  it('distribution', () => expectAll(ps, ['left', 'right', 'up', 'down']))
})

describe('coil-solenoid-current', () => {
  const ps = gen(byId('coil-solenoid-current'))
  it('choices and answer', () => commonChecks(ps))
  it('answer matches Biot–Savart', () => {
    for (const p of ps) {
      const f = p.facts as { view: string; north: Dir }
      if (f.view === 'end') {
        const ok = (['cw', 'ccw'] as const).filter((r) => loopB(r) === f.north)
        expect(ok).toHaveLength(1)
        expect(p.answer).toBe(ok[0])
        expect(p.choices.map((c) => c.id)).toEqual(['cw', 'ccw'])
      } else {
        const ok = (['up', 'down', 'left', 'right'] as const).filter((d) => solenoidB(d) === f.north)
        expect(ok).toHaveLength(1)
        expect(p.answer).toBe(ok[0])
        // focused pad: the two directions across the coil, never along its axis
        expect(p.choices.map((c) => c.id)).toContain(p.answer)
        expect(p.choices.map((c) => c.id)).not.toContain(f.north)
      }
      // full pad: every direction and both rotations
      expect(p.fullChoices!.map((c) => c.id).sort()).toEqual(['ccw', 'cw', 'down', 'in', 'left', 'out', 'right', 'up'])
    }
  })
  it('distribution', () => expectAll(ps, ['up', 'down', 'left', 'right', 'cw', 'ccw']))
  it('names one front (solid) wire, not a lead', () => {
    for (const p of ps) {
      if ((p.facts as SolFacts).view === 'end') continue
      const svg = renderToString(p.diagram as never)
      // exactly one tinted near arc, one "I = ?" callout, and it says which wire
      expect(svg.match(new RegExp(`stroke="${attrEsc(COLORS.I)}" stroke-opacity`, 'g'))).toHaveLength(1)
      expect(svg.match(/ = \?/g)).toHaveLength(1)
      expect(svg).toContain('front wire')
    }
  })
})

describe('coil views', () => {
  for (const t of coilsTypes.filter((x) => x.views)) {
    it(`${t.id} draws every view it lists, and only the views asked for`, () => {
      const seen = new Set(gen(t).map((p) => (p.facts as { view: string }).view))
      expect([...seen].sort()).toEqual([...t.views!].sort())
      for (const v of t.views!) {
        for (let seed = 0; seed < 40; seed++) {
          expect((t.generate(makeRng(seed), { views: [v] }).facts as { view: string }).view).toBe(v)
        }
      }
    })
  }
})

describe('all coil types', () => {
  it('ids are prefixed and unique', () => {
    const ids = coilsTypes.map((t) => t.id)
    expect(new Set(ids).size).toBe(ids.length)
    for (const id of ids) expect(id.startsWith('coil-')).toBe(true)
    expect(ids).toHaveLength(6)
  })
})
