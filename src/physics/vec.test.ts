import { describe, expect, it } from 'vitest'
import { crossDir, opposite, sci, toDir, cross, vec } from './vec'

describe('vec', () => {
  it('is right-handed in page coords', () => {
    expect(crossDir('right', 'up')).toBe('out')
    expect(crossDir('up', 'out')).toBe('right')
    expect(crossDir('out', 'right')).toBe('up')
    expect(crossDir('right', 'in')).toBe('up')
    expect(crossDir('right', 'right')).toBeNull()
  })
  it('opposites and sci', () => {
    expect(opposite('in')).toBe('out')
    expect(toDir(cross(vec('up'), vec('right')))).toBe('in')
    expect(sci(1.6e-14)).toBe('1.6 × 10⁻¹⁴')
  })
})
