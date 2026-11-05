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

/** Solid near-side arcs: wire-colored paths made of elliptical arcs. Returns [startY, endY] (screen). */
function nearArcs(svg: string): { x0: number; y0: number; y1: number }[] {
  const re = new RegExp(`<path d="(M [^"]*A [^"]*)" fill="none" stroke="${attrEsc(COLORS.wire)}"`, 'g')
  const out: { x0: number; y0: number; y1: number }[] = []
  for (const m of svg.matchAll(re)) {
    const nums = m[1].match(/-?\d+(\.\d+)?/g)!.map(Number)
    out.push({ x0: nums[0], y0: nums[1], y1: nums[nums.length - 1] })
  }
  return out
}

/**
 * Near-side current direction derived purely from the drawing: the left lead
 * joins the start of the leftmost near arc, so if the left lead's arrow points
 * right (into the coil) the current runs along that arc from its start to its end.
 */
function nearFromDrawing(svg: string): { fromLeads: Dir; fromHeads: Dir[] } {
  const heads = currentHeads(svg)
  const horiz = heads.filter((h) => Math.abs(h.dir[0]) > 0.99)
  const vert = heads.filter((h) => Math.abs(h.dir[1]) > 0.99)
  const leftLead = horiz.reduce((a, b) => (b.x < a.x ? b : a))
  const arcs = nearArcs(svg)
  const first = arcs.reduce((a, b) => (b.x0 < a.x0 ? b : a))
  const entering = leftLead.dir[0] > 0
  // screen dy along the arc in the direction the current travels
  const screenDy = (first.y1 - first.y0) * (entering ? 1 : -1)
  return { fromLeads: screenDy > 0 ? 'down' : 'up', fromHeads: vert.map((h) => toDir(h.dir)!) }
}

/** Original formula for the generator's leads/flow layout (kept as a cross-check of the facts). */
function nearFromLeads(leads: 'top' | 'bottom', flow: 'forward' | 'backward'): Dir {
  // leads on top + current entering on the left: wire runs top → (near) → bottom on each turn
  const down = (leads === 'top') === (flow === 'forward')
  return down ? 'down' : 'up'
}

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

for (const id of ['coil-solenoid-field', 'coil-solenoid-poles', 'coil-compass']) {
  describe(id, () => {
    const ps = gen(byId(id))
    it('choices and answer', () => commonChecks(ps))
    it('answer matches Biot–Savart on the axis', () => {
      for (const p of ps) {
        const f = p.facts as { nearSide: Dir; nearCurrent: Dir; leads: 'top' | 'bottom'; flow: 'forward' | 'backward' }
        expect(f.nearSide).toBe('out')
        expect(f.nearCurrent).toBe(nearFromLeads(f.leads, f.flow))
        // field inside = field on the axis just outside (compass) = toward the N end (poles)
        expect(p.answer).toBe(solenoidB(f.nearCurrent))
      }
    })
    it('drawn arrows (near arcs + leads) agree with the stated near-side current', () => {
      for (const p of ps) {
        const f = p.facts as { nearCurrent: Dir }
        const { fromLeads, fromHeads } = nearFromDrawing(renderToString(p.diagram as never))
        expect(fromHeads.length).toBeGreaterThanOrEqual(5)
        for (const d of fromHeads) expect(d).toBe(fromLeads)
        expect(fromLeads).toBe(f.nearCurrent)
        expect(p.answer).toBe(solenoidB(fromLeads))
      }
    })
    it('distribution', () => expectAll(ps, ['left', 'right']))
  })
}

describe('coil-compass extras', () => {
  it('compass appears at both ends', () => {
    const ends = new Set(gen(byId('coil-compass')).map((p) => (p.facts as { compassEnd: string }).compassEnd))
    expect([...ends].sort()).toEqual(['left', 'right'])
  })
})

describe('coil-solenoid-current', () => {
  const ps = gen(byId('coil-solenoid-current'))
  it('choices and answer', () => commonChecks(ps))
  it('answer matches Biot–Savart', () => {
    for (const p of ps) {
      const f = p.facts as { north: Dir }
      const ok = (['up', 'down'] as const).filter((d) => solenoidB(d) === f.north)
      expect(ok).toHaveLength(1)
      expect(p.answer).toBe(ok[0])
    }
  })
  it('distribution', () => expectAll(ps, ['up', 'down']))
})

describe('all coil types', () => {
  it('ids are prefixed and unique', () => {
    const ids = coilsTypes.map((t) => t.id)
    expect(new Set(ids).size).toBe(ids.length)
    for (const id of ids) expect(id.startsWith('coil-')).toBe(true)
    expect(ids).toHaveLength(6)
  })
})
