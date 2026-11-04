/** Small seeded PRNG (mulberry32) so problems are reproducible from a seed. */
export interface Rng {
  /** float in [0, 1) */
  next(): number
  /** integer in [min, max] inclusive */
  int(min: number, max: number): number
  pick<T>(items: readonly T[]): T
  chance(p?: number): boolean
  shuffle<T>(items: readonly T[]): T[]
  readonly seed: number
}

export function makeRng(seed: number = (Math.random() * 2 ** 32) >>> 0): Rng {
  let a = seed >>> 0
  const next = () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
  const rng: Rng = {
    seed,
    next,
    int: (min, max) => min + Math.floor(next() * (max - min + 1)),
    pick: (items) => items[Math.floor(next() * items.length)],
    chance: (p = 0.5) => next() < p,
    shuffle: (items) => {
      const out = [...items]
      for (let i = out.length - 1; i > 0; i--) {
        const j = Math.floor(next() * (i + 1))
        ;[out[i], out[j]] = [out[j], out[i]]
      }
      return out
    },
  }
  return rng
}
