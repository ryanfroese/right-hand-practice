import { describe, expect, it } from 'vitest'
import { makeRng } from '../rng'
import { type Dir, type Vec3, cross, dot, toDir, vec } from '../physics/vec'
import type { Problem } from './types'
import { wiresTypes } from './wires'

const N = 300
const get = (id: string) => {
  const t = wiresTypes.find((x) => x.id === id)
  if (!t) throw new Error(`missing type ${id}`)
  return t
}
const gen = (id: string): Problem[] => Array.from({ length: N }, (_, i) => get(id).generate(makeRng(i * 7 + 1)))

/** Grip rule, independently: B at P ∝ I × r̂. */
const grip = (I: Dir, r: Dir): Vec3 => cross(vec(I), vec(r))
const sameDir = (a: Vec3, b: Vec3) => dot(a, b) > 0 && toDir(a) === toDir(b)

/** Circulation (seen from +z) of the field of a wire along ±z, via the z-component of r × B at a sample r. */
function circ(I: Dir): 'cw' | 'ccw' {
  const r = vec('up')
  const B = cross(vec(I), r)
  return cross(r, B)[2] > 0 ? 'ccw' : 'cw'
}

function common(ps: Problem[]) {
  for (const p of ps) {
    const ids = p.choices.map((c) => c.id)
    expect(new Set(ids).size).toBe(ids.length)
    expect(ids).toContain(p.answer)
    expect(p.facts).toBeTruthy()
  }
}

const answers = (ps: Problem[]) => new Set(ps.map((p) => p.answer))

describe('wires', () => {
  it('exports the six wire types with wire- prefixes', () => {
    expect(wiresTypes.map((t) => t.id).sort()).toEqual(
      ['wire-circulation', 'wire-field-endon', 'wire-field-point', 'wire-find-current', 'wire-force', 'wire-parallel'].sort(),
    )
    for (const t of wiresTypes) expect(t.category).toBe('wires')
  })

  it('wire-force: F = I × B (zero when parallel)', () => {
    const ps = gen('wire-force')
    common(ps)
    for (const p of ps) {
      const { current, field } = p.facts as { current: Dir; field: Dir }
      const f = toDir(cross(vec(current), vec(field)))
      expect(p.answer).toBe(f ?? 'zero')
      expect(p.choices.map((c) => c.id)).toContain('zero')
    }
    expect(answers(ps)).toEqual(new Set(['up', 'down', 'left', 'right', 'in', 'out', 'zero']))
  })

  it('wire-field-point: B = I × r̂ is in/out', () => {
    const ps = gen('wire-field-point')
    common(ps)
    for (const p of ps) {
      const { current, rHat } = p.facts as { current: Dir; rHat: Dir }
      expect(dot(vec(current), vec(rHat))).toBe(0)
      expect(p.answer).toBe(toDir(grip(current, rHat)))
    }
    expect(answers(ps)).toEqual(new Set(['in', 'out']))
  })

  it('wire-field-endon: in-plane B = I × r̂', () => {
    const ps = gen('wire-field-endon')
    common(ps)
    for (const p of ps) {
      const { current, rHat } = p.facts as { current: Dir; rHat: Dir }
      expect(['in', 'out']).toContain(current)
      expect(p.answer).toBe(toDir(grip(current, rHat)))
    }
    expect(answers(ps)).toEqual(new Set(['up', 'down', 'left', 'right']))
  })

  it('wire-circulation: out ↔ ccw, in ↔ cw (seen looking at the page)', () => {
    const ps = gen('wire-circulation')
    common(ps)
    const asks = new Set<string>()
    for (const p of ps) {
      const f = p.facts as { ask: 'circulation' | 'current'; current: Dir; circulation: 'cw' | 'ccw' }
      asks.add(f.ask)
      if (f.ask === 'circulation') {
        expect(p.answer).toBe(circ(f.current))
      } else {
        // derive the current from the given circulation only
        const I = (['out', 'in'] as Dir[]).filter((d) => circ(d) === f.circulation)
        expect(I).toHaveLength(1)
        expect(p.answer).toBe(I[0])
      }
    }
    expect(asks).toEqual(new Set(['circulation', 'current']))
    expect(answers(ps)).toEqual(new Set(['cw', 'ccw', 'in', 'out']))
    expect(circ('out')).toBe('ccw')
  })

  it('wire-parallel: field of 1 at 2, then F₂ = I₂ × B', () => {
    const ps = gen('wire-parallel')
    common(ps)
    const forceAns = new Set<string>()
    const attractAns = new Set<string>()
    for (const p of ps) {
      const { ask, I1, I2, r12 } = p.facts as { ask: 'attract' | 'force'; I1: Dir; I2: Dir; r12: Dir }
      const B = cross(vec(I1), vec(r12))
      const F = cross(vec(I2), B)
      const attract = dot(F, vec(r12)) < 0
      // physics sanity: parallel currents attract
      expect(attract).toBe(I1 === I2)
      if (ask === 'attract') {
        expect(p.answer).toBe(attract ? 'attract' : 'repel')
        attractAns.add(p.answer)
      } else {
        expect(p.answer).toBe(toDir(F))
        // out/in offered as distractors so students can't just eliminate by geometry
        expect(p.choices.map((c) => c.id).sort()).toEqual(['down', 'in', 'left', 'out', 'right', 'up'])
        forceAns.add(p.answer)
      }
    }
    expect(attractAns).toEqual(new Set(['attract', 'repel']))
    expect(forceAns).toEqual(new Set(['up', 'down', 'left', 'right']))
    const layouts = new Set(ps.map((p) => p.facts.layout))
    expect(layouts).toEqual(new Set(['endon', 'inpage']))
  })

  it('wire-find-current: the current along the wire whose grip field at P matches', () => {
    const ps = gen('wire-find-current')
    common(ps)
    for (const p of ps) {
      const { field, rHat, axis } = p.facts as { field: Dir; rHat: Dir; axis: 'horizontal' | 'vertical' }
      const candidates: Dir[] = axis === 'horizontal' ? ['right', 'left'] : ['up', 'down']
      expect(p.choices.map((c) => c.id).sort()).toEqual([...candidates].sort())
      const ok = candidates.filter((I) => sameDir(grip(I, rHat), vec(field)))
      expect(ok).toHaveLength(1)
      expect(p.answer).toBe(ok[0])
    }
    expect(answers(ps)).toEqual(new Set(['up', 'down', 'left', 'right']))
  })
})
