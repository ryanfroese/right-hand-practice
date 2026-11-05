import { describe, expect, it } from 'vitest'
import { PROBLEM_TYPES } from '../problems/index'
import { makeRng } from '../rng'
import { DEFAULT_SETTINGS, findSeed, fullChoicesFor, generate, kindOf, padChoices, typeAvailable, type PracticeSettings } from './settings'
import { hashFor, parseConfig, topicTokens } from '../ui/hash'
import { dirChoices } from '../problems/types'

const S = (o: Partial<PracticeSettings>): PracticeSettings => ({ ...DEFAULT_SETTINGS, ...o })
const ids = (cs: { id: string }[]) => cs.map((c) => c.id)
const byId = (id: string) => PROBLEM_TYPES.find((t) => t.id === id)!

describe('answer pad', () => {
  it('full pad: any direction question gets all six directions', () => {
    expect(ids(fullChoicesFor(dirChoices({ only: ['up', 'down'] })))).toEqual(['up', 'down', 'left', 'right', 'out', 'in'])
    expect(ids(fullChoicesFor(dirChoices({ zero: true })))).toContain('zero')
  })
  it('every problem: the answer is always on the pad, in every mode, never fewer than two buttons', () => {
    const modes: PracticeSettings[] = [S({}), S({ pad: 'focused' }), S({ kinds: ['plane'] }), S({ kinds: ['depth'], pad: 'focused' }), S({ kinds: ['rot'] })]
    for (const t of PROBLEM_TYPES) {
      for (let seed = 0; seed < 60; seed++) {
        const p = t.generate(makeRng(seed))
        for (const m of modes) {
          const c = ids(padChoices(p, m))
          expect(c, `${t.id} ${seed}`).toContain(p.answer)
          expect(c.length).toBeGreaterThanOrEqual(2)
          expect(new Set(c).size).toBe(c.length)
        }
      }
    }
  })
  it('disabled kinds are hidden (except the answer itself)', () => {
    const p = byId('coil-solenoid-current').generate(makeRng(3), { views: ['side'] })
    const c = ids(padChoices(p, S({ kinds: ['plane'] })))
    expect(c).toEqual(['up', 'down', 'left', 'right'])
    expect(ids(padChoices(p, S({ pad: 'focused' })))).toEqual(['up', 'down'])
    expect(ids(padChoices(p, S({})))).toEqual(['up', 'down', 'left', 'right', 'out', 'in', 'cw', 'ccw'])
  })
})

describe('answer kinds filter problems', () => {
  it('findSeed only returns problems whose answer kind is on', () => {
    for (const kinds of [['plane'], ['depth'], ['rot'], ['plane', 'zero']] as PracticeSettings['kinds'][]) {
      const s = S({ kinds })
      for (const t of PROBLEM_TYPES) {
        const seed = findSeed(t, 12345, s)
        if (seed == null) continue
        const k = kindOf(generate(t, seed, s).answer)
        expect(k == null || kinds.includes(k), `${t.id} → ${k}`).toBe(true)
      }
    }
  })
  it('types that can never fit are unavailable; mixed types stay available', () => {
    // field at the centre of a flat loop is always in/out
    expect(typeAvailable(byId('coil-loop-center'), S({ kinds: ['plane'] }))).toBe(false)
    // a solenoid field can be in-plane (side/upright) or in/out (end-on)
    expect(typeAvailable(byId('coil-solenoid-field'), S({ kinds: ['plane'] }))).toBe(true)
    expect(typeAvailable(byId('coil-solenoid-field'), S({ kinds: ['depth'] }))).toBe(true)
    expect(typeAvailable(byId('coil-solenoid-field'), S({ kinds: ['depth'], views: ['side'] }))).toBe(false)
    // coil current with rotations only → end-on only
    const s = S({ kinds: ['rot'] })
    const seed = findSeed(byId('coil-solenoid-current'), 1, s)!
    expect((generate(byId('coil-solenoid-current'), seed, s).facts as { view: string }).view).toBe('end')
  })
  it('views setting is honored', () => {
    const t = byId('coil-compass')
    expect(typeAvailable(t, S({ views: ['end'] }))).toBe(false)
    for (let seed = 0; seed < 30; seed++) expect((generate(t, seed, S({ views: ['upright'] })).facts as { view: string }).view).toBe('upright')
  })
})

describe('URL practice set', () => {
  const types = PROBLEM_TYPES
  it('defaults produce no config, and no config is read back', () => {
    expect(hashFor(null, { selection: null, settings: DEFAULT_SETTINGS }, types)).toBe('')
    expect(parseConfig('#t=coil-compass&s=5', types)).toBeNull()
  })
  it('round-trips a curated set', () => {
    const cfg = {
      selection: [...types.filter((t) => t.category === 'coils').map((t) => t.id), 'wire-force'],
      settings: S({ kinds: ['plane', 'rot'], pad: 'focused', views: ['side', 'end'] }),
    }
    const h = hashFor({ t: 'coil-compass', s: 42 }, cfg, types)
    expect(h).toBe('#t=coil-compass&s=42&topics=wire-force,coils&ans=plane,rot&pad=focused&views=side,end')
    const back = parseConfig(h, types)!
    expect(new Set(back.selection)).toEqual(new Set(cfg.selection))
    expect(back.settings).toEqual(cfg.settings)
  })
  it('missing keys mean defaults; junk is ignored', () => {
    const c = parseConfig('#topics=coils,nope&ans=rot,bogus', types)!
    expect(c.selection).toEqual(types.filter((t) => t.category === 'coils').map((t) => t.id))
    expect(c.settings).toEqual(S({ kinds: ['rot'] }))
    expect(parseConfig('#topics=nope', types)!.selection).toBeNull()
    expect(parseConfig('#ans=bogus', types)!.settings).toEqual(DEFAULT_SETTINGS)
  })
  it('whole categories collapse to the category id', () => {
    expect(topicTokens(types.map((t) => t.id), types)).toBeNull()
    expect(topicTokens(['coil-compass'], types)).toEqual(['coil-compass'])
  })
})
