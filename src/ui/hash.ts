/** Shareable problem links: #t=<typeId>&s=<seed> */
export interface ProblemRef {
  t: string
  s: number
}

export function readHash(): ProblemRef | null {
  const p = new URLSearchParams(location.hash.slice(1))
  const t = p.get('t')
  const sRaw = p.get('s')
  if (!t || sRaw == null || !/^\d+$/.test(sRaw)) return null
  return { t, s: Number(sRaw) >>> 0 }
}

/** True when the hash looks like a problem link at all (even a malformed one). */
export function hashHasLink(): boolean {
  const p = new URLSearchParams(location.hash.slice(1))
  return p.has('t') || p.has('s')
}

export function hashFor(ref: ProblemRef): string {
  return `#t=${encodeURIComponent(ref.t)}&s=${ref.s >>> 0}`
}

/** replaceState (not push) so Back doesn't walk through every problem. */
export function writeHash(ref: ProblemRef): void {
  const h = hashFor(ref)
  if (location.hash === h) return
  history.replaceState(null, '', location.pathname + location.search + h)
}

/** Link for teachers. Drops the ?theme= screenshot override so recipients get their own theme. */
export function shareUrl(ref: ProblemRef): string {
  const params = new URLSearchParams(location.search)
  params.delete('theme')
  const q = params.toString()
  return location.origin + location.pathname + (q ? `?${q}` : '') + hashFor(ref)
}

export const randomSeed = () => (Math.random() * 2 ** 32) >>> 0
