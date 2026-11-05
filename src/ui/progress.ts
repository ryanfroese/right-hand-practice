import { load, removeKey, save } from './storage'

export interface TypeStat {
  c: number // correct
  n: number // attempts
}

export interface Progress {
  best: number
  perType: Record<string, TypeStat>
}

const KEY = 'progress'

export function loadProgress(): Progress {
  const p = load<Partial<Progress>>(KEY, {})
  return { best: typeof p.best === 'number' ? p.best : 0, perType: p.perType && typeof p.perType === 'object' ? p.perType : {} }
}

export function saveProgress(p: Progress) {
  save(KEY, p)
}

export function clearProgress() {
  removeKey(KEY)
}

export function record(p: Progress, typeId: string, correct: boolean, streak: number): Progress {
  const prev = p.perType[typeId] ?? { c: 0, n: 0 }
  return {
    best: Math.max(p.best, streak),
    perType: { ...p.perType, [typeId]: { c: prev.c + (correct ? 1 : 0), n: prev.n + 1 } },
  }
}
