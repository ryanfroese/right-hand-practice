import { describe, expect, it } from 'vitest'
import { lenzTypes } from './lenz'
import { makeRng } from '../rng'
import { type Dir, type Vec3, add, cross, dot, neg, scale, vec } from '../physics/vec'
import type { Problem } from './types'

const N = 300

function gen(id: string): Problem[] {
  const t = lenzTypes.find((x) => x.id === id)
  if (!t) throw new Error(`missing type ${id}`)
  return Array.from({ length: N }, (_, seed) => t.generate(makeRng(seed)))
}

function basicChecks(ps: Problem[]) {
  for (const p of ps) {
    const ids = p.choices.map((c) => c.id)
    expect(new Set(ids).size).toBe(ids.length)
    expect(ids).toContain(p.answer)
  }
}

/** Field at the center of a square loop with a ccw current (page view): sum of dl × (−r) over the four sides. */
const CCW_SIDES: [Dir, Dir][] = [
  ['right', 'up'],
  ['up', 'left'],
  ['left', 'down'],
  ['down', 'right'],
]
const ccwCenterField: Vec3 = CCW_SIDES.reduce<Vec3>((acc, [r, dl]) => add(acc, cross(vec(dl), neg(vec(r)))), [0, 0, 0])

const sgn = (x: number) => (Math.abs(x) < 1e-12 ? 0 : Math.sign(x))

/** Induced field vector given the external field vector and d|flux|/dt sign. */
const induced = (field: Vec3, changeSign: number): Vec3 => scale(field, -changeSign)

function rotationOf(b: Vec3): string {
  const s = sgn(dot(b, ccwCenterField))
  return s > 0 ? 'ccw' : s < 0 ? 'cw' : 'none'
}

const zDir = (b: Vec3): string => (b[2] > 0 ? 'out' : b[2] < 0 ? 'in' : 'zero')

interface MoveFacts {
  fieldSide: Dir
  position: string
  v: Dir
  u: number
  half: number
}

/** Flux sign change for a moving loop: simulate the overlap of the loop's span [u − half, u + half] with the field half-line n ≥ 0. */
function movingChange(f: MoveFacts): number {
  const overlap = (u: number) => Math.max(0, u + f.half - Math.max(u - f.half, 0))
  const du = 1e-3 * dot(vec(f.v), vec(f.fieldSide))
  return sgn(overlap(f.u + du) - overlap(f.u))
}

/** The drawn geometry must agree with the stated position, and v must never head toward the boundary off a non-straddling loop. */
function checkMoveGeometry(f: MoveFacts) {
  if (f.position === 'straddle') {
    expect(Math.abs(f.u)).toBeLessThan(f.half)
    // the in-field part is deep enough to show field marks
    expect(f.u + f.half).toBeGreaterThanOrEqual(50)
  } else {
    expect(Math.abs(f.u)).toBeGreaterThan(f.half)
    expect(f.position === 'inside' ? f.u > 0 : f.u < 0).toBe(true)
    const towardBoundary = f.position === 'inside' ? -1 : 1
    expect(dot(vec(f.v), vec(f.fieldSide))).not.toBe(towardBoundary)
  }
}

function expectAll(ps: Problem[], answers: string[]) {
  const seen = new Set(ps.map((p) => p.answer))
  for (const a of answers) expect(seen, `answer ${a} never generated`).toContain(a)
}

describe('lenz-flux-change', () => {
  const ps = gen('lenz-flux-change')
  it('valid choices', () => basicChecks(ps))
  it('answer re-derived from facts', () => {
    for (const p of ps) {
      const f = p.facts as { field: Dir; changeSign: number; change: string }
      expect({ increasing: 1, decreasing: -1, constant: 0 }[f.change]).toBe(f.changeSign)
      expect(p.answer).toBe(rotationOf(induced(vec(f.field), f.changeSign)))
    }
  })
  it('distribution', () => expectAll(ps, ['cw', 'ccw', 'none']))
  it('hand-verified fixtures', () => {
    // B into the page and growing → induced B out → ccw;  B out and shrinking → induced B out → ccw
    const cases: [string, number, string][] = [
      ['in', 1, 'ccw'],
      ['out', -1, 'ccw'],
      ['out', 1, 'cw'],
      ['in', -1, 'cw'],
      ['in', 0, 'none'],
    ]
    for (const [field, changeSign, want] of cases) {
      const hits = ps.filter((p) => p.facts.field === field && p.facts.changeSign === changeSign)
      expect(hits.length, `${field}/${changeSign}`).toBeGreaterThan(0)
      for (const p of hits) expect(p.answer).toBe(want)
    }
  })
})

describe('lenz-loop-moving', () => {
  const ps = gen('lenz-loop-moving')
  it('valid choices', () => basicChecks(ps))
  it('answer re-derived from facts', () => {
    for (const p of ps) {
      const f = p.facts as unknown as MoveFacts & { field: Dir }
      checkMoveGeometry(f)
      expect(p.answer).toBe(rotationOf(induced(vec(f.field), movingChange(f))))
    }
  })
  it('distribution', () => expectAll(ps, ['cw', 'ccw', 'none']))
  it('includes every position', () => {
    const pos = new Set(ps.map((p) => (p.facts as { position: string }).position))
    expect([...pos].sort()).toEqual(['inside', 'outside', 'straddle'])
  })
})

describe('lenz-sliding-rod', () => {
  const ps = gen('lenz-sliding-rod')
  it('valid choices', () => basicChecks(ps))
  it('current from motional emf (v × B) and force opposes v', () => {
    for (const p of ps) {
      const f = p.facts as { field: Dir; v: Dir; ask: string; currentInRod: Dir; force: Dir }
      // independent route: force on positive carriers in the rod is q v × B
      const iVec = cross(vec(f.v), vec(f.field))
      const fVec = cross(iVec, vec(f.field))
      expect(dot(iVec, vec(f.currentInRod))).toBe(1)
      expect(dot(fVec, vec(f.force))).toBe(1)
      // magnetic drag always opposes the motion
      expect(dot(vec(f.force), vec(f.v))).toBe(-1)
      expect(p.answer).toBe(f.ask === 'current' ? f.currentInRod : f.force)
    }
  })
  it('distribution', () => {
    expectAll(ps.filter((p) => p.facts.ask === 'current'), ['up', 'down'])
    expectAll(ps.filter((p) => p.facts.ask === 'force'), ['left', 'right'])
  })
})

describe('lenz-magnet-coil', () => {
  const ps = gen('lenz-magnet-coil')
  it('valid choices', () => basicChecks(ps))
  it('answer from the "coil face becomes a pole" route', () => {
    for (const p of ps) {
      const f = p.facts as { magnetSide: Dir; facingPole: 'N' | 'S'; motion: 'toward' | 'away' }
      // approaching → like pole faces the magnet (repel); receding → unlike pole (attract)
      const coilFacePole = f.motion === 'toward' ? f.facingPole : f.facingPole === 'N' ? 'S' : 'N'
      // a coil's own B inside points toward its N face
      const towardMagnet = vec(f.magnetSide)
      const bInd = coilFacePole === 'N' ? towardMagnet : neg(towardMagnet)
      // near side sits at +z; current d there satisfies B = d × (−z)  ⇒  d = B × z
      const d = cross(bInd, vec('out'))
      expect(dot(d, vec(p.answer as Dir))).toBe(1)
    }
  })
  it('distribution', () => expectAll(ps, ['up', 'down']))
})

describe('lenz-wire-nearby', () => {
  const ps = gen('lenz-wire-nearby')
  it('valid choices', () => basicChecks(ps))
  it('answer re-derived from facts', () => {
    for (const p of ps) {
      const f = p.facts as { current: Dir; loopSide: Dir; changeSign: number }
      // Biot–Savart: dB ∝ I dl × r̂ (r̂ from the wire to the loop)
      const b = cross(vec(f.current), vec(f.loopSide))
      expect(Math.abs(b[2])).toBe(1)
      expect(p.answer).toBe(rotationOf(induced(b, f.changeSign)))
    }
  })
  it('distribution', () => expectAll(ps, ['cw', 'ccw']))
  it('hand-verified fixtures', () => {
    // I up, loop to its right: B there is into the page; increasing → induced out → ccw
    // I right, loop above it: B there is out of the page; increasing → induced in → cw
    const cases: [string, string, number, string][] = [
      ['up', 'right', 1, 'ccw'],
      ['up', 'right', -1, 'cw'],
      ['right', 'up', 1, 'cw'],
      ['right', 'down', 1, 'ccw'],
      ['down', 'left', -1, 'cw'],
    ]
    for (const [current, loopSide, changeSign, want] of cases) {
      const hits = ps.filter((p) => p.facts.current === current && p.facts.loopSide === loopSide && p.facts.changeSign === changeSign)
      expect(hits.length, `${current}/${loopSide}/${changeSign}`).toBeGreaterThan(0)
      for (const p of hits) expect(p.answer).toBe(want)
    }
  })
})

describe('lenz-induced-field', () => {
  const ps = gen('lenz-induced-field')
  it('valid choices', () => basicChecks(ps))
  it('answer re-derived from facts', () => {
    for (const p of ps) {
      const f = p.facts as unknown as MoveFacts & { setup: string; field: Dir; changeSign?: number }
      if (f.setup === 'moving') checkMoveGeometry(f)
      const c = f.setup === 'flux' ? f.changeSign! : movingChange(f)
      expect(p.answer).toBe(zDir(induced(vec(f.field), c)))
    }
  })
  it('distribution', () => {
    expectAll(ps, ['out', 'in', 'zero'])
    expect(new Set(ps.map((p) => p.facts.setup))).toEqual(new Set(['flux', 'moving']))
  })
})

it('exports all six lenz types', () => {
  expect(lenzTypes.map((t) => t.id).sort()).toEqual(
    ['lenz-flux-change', 'lenz-induced-field', 'lenz-loop-moving', 'lenz-magnet-coil', 'lenz-sliding-rod', 'lenz-wire-nearby'].sort(),
  )
})
