import { describe, expect, it } from 'vitest'
import { chargesTypes } from './charges'
import { makeRng } from '../rng'
import { type Dir, type Vec3, DIRS, cross, dot, vec } from '../physics/vec'

const N = 300

/** Independent F = q v × B direction, by brute force over the six axis dirs. */
function dirOf(a: Vec3): Dir | 'zero' {
  if (a[0] === 0 && a[1] === 0 && a[2] === 0) return 'zero'
  const hits = DIRS.filter((d) => dot(vec(d), a) > 0 && Math.abs(dot(vec(d), a)) === Math.hypot(...a))
  expect(hits).toHaveLength(1)
  return hits[0]
}
const force = (s: number, v: Dir, B: Dir): Dir | 'zero' => {
  const c = cross(vec(v), vec(B))
  return dirOf([c[0] * s, c[1] * s, c[2] * s])
}

const derive: Record<string, (f: Record<string, any>) => string> = {
  'charge-force': (f) => force(f.sign, f.v, f.B),
  'charge-find-b': (f) => {
    const sols = DIRS.filter((b) => dot(vec(b), vec(f.v)) === 0 && force(f.sign, f.v, b) === f.F)
    expect(sols).toHaveLength(1)
    return sols[0]
  },
  'charge-find-v': (f) => {
    const sols = DIRS.filter((v) => dot(vec(v), vec(f.B)) === 0 && force(f.sign, v, f.B) === f.F)
    expect(sols).toHaveLength(1)
    return sols[0]
  },
  'charge-sign': (f) => {
    const pos = force(1, f.v, f.B)
    const neg = force(-1, f.v, f.B)
    expect(pos).not.toBe('zero')
    if (pos === f.F) return 'positive'
    expect(neg).toBe(f.F)
    return 'negative'
  },
  'charge-circle': (f) => {
    expect(['in', 'out']).toContain(f.B)
    const c = cross(vec(f.v), vec(f.B))
    const F: Vec3 = [c[0] * f.sign, c[1] * f.sign, c[2] * f.sign]
    // position relative to the circle's center is -F; L_z = (r × v)_z
    const r: Vec3 = [-F[0], -F[1], -F[2]]
    const lz = cross(r, vec(f.v))[2]
    expect(lz).not.toBe(0)
    const ans = lz > 0 ? 'ccw' : 'cw'
    // second, v-independent check: a positive charge circles cw when B is out
    // of the page (omega antiparallel to qB), ccw when B is into the page
    expect(ans).toBe(f.sign * vec(f.B)[2] > 0 ? 'cw' : 'ccw')
    return ans
  },
  'charge-magnet': (f) => {
    // the charge sits on the axis on side `chargeOffset` (direction magnet → charge).
    // B leaves N and enters S.
    const away: Dir = f.chargeOffset
    const toward = DIRS.find((d) => dot(vec(d), vec(away)) === -1)!
    // the pole facing the charge is N iff north === chargeOffset
    expect(f.chargeSide === 'N').toBe(f.north === f.chargeOffset)
    const B: Dir = f.chargeSide === 'N' ? away : toward
    return force(f.sign, f.v, B)
  },
}

describe('charges problem types', () => {
  it('exports all six types with charge- ids', () => {
    expect(chargesTypes.map((t) => t.id).sort()).toEqual(
      ['charge-circle', 'charge-find-b', 'charge-find-v', 'charge-force', 'charge-magnet', 'charge-sign'].sort(),
    )
    for (const t of chargesTypes) expect(t.category).toBe('charges')
  })

  for (const t of chargesTypes) {
    it(`${t.id}: answers are valid and independently re-derivable`, () => {
      const seen = new Map<string, number>()
      const reachable = new Set<string>()
      for (let seed = 1; seed <= N; seed++) {
        const p = t.generate(makeRng(seed))
        expect(p.typeId).toBe(t.id)
        const ids = p.choices.map((c) => c.id)
        expect(new Set(ids).size).toBe(ids.length)
        expect(ids).toContain(p.answer)
        ids.forEach((id) => reachable.add(id))
        expect(derive[t.id](p.facts as Record<string, any>)).toBe(p.answer)
        expect(JSON.parse(JSON.stringify(p.facts))).toEqual(p.facts)
        seen.set(p.answer, (seen.get(p.answer) ?? 0) + 1)
      }
      // every possible answer actually shows up
      for (const id of reachable) expect(seen.get(id) ?? 0, `${t.id} never answers ${id}`).toBeGreaterThan(0)
    })
  }

  it('charge-force: zero answers are rare but present (~10%)', () => {
    const t = chargesTypes.find((x) => x.id === 'charge-force')!
    let zero = 0
    for (let seed = 1; seed <= 1000; seed++) if (t.generate(makeRng(seed)).answer === 'zero') zero++
    expect(zero).toBeGreaterThan(40)
    expect(zero).toBeLessThan(200)
  })

  it('charge-sign / charge-find-*: given vectors are mutually perpendicular', () => {
    for (const id of ['charge-sign', 'charge-find-v', 'charge-find-b']) {
      const t = chargesTypes.find((x) => x.id === id)!
      for (let seed = 1; seed <= N; seed++) {
        const f = t.generate(makeRng(seed)).facts as Record<string, Dir>
        const given = [f.v, f.B, f.F].filter(Boolean) as Dir[]
        for (let i = 0; i < given.length; i++) for (let j = i + 1; j < given.length; j++) expect(dot(vec(given[i]), vec(given[j]))).toBe(0)
      }
    }
  })
})
