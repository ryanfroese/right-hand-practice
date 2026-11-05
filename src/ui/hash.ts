/**
 * Everything shareable lives in the URL hash:
 *
 *   #t=<typeId>&s=<seed>            the problem on screen (omitted on a practice-set link)
 *    &topics=coils,wire-force       topic selection: category ids and/or type ids (omitted = all)
 *    &ans=plane,depth,rot,zero      answer kinds that can come up (omitted = all)
 *    &pad=focused                   answer buttons: focused | full (omitted = full)
 *    &views=side,upright,end        coil views (omitted = all)
 *
 * If a URL carries ANY of topics/ans/pad/views it defines the whole practice
 * set (missing keys mean the defaults), so an instructor's link gives every
 * student the same set regardless of what they had saved. Students can change
 * it afterwards; the hash follows their changes.
 */
import {
  ANSWER_KINDS,
  COIL_VIEWS,
  DEFAULT_SETTINGS,
  normalizeSettings,
  type AnswerKind,
  type CoilView,
  type PracticeSettings,
} from '../practice/settings'
import type { Category, ProblemType } from '../problems/types'
import { CATEGORY_LABEL } from '../problems/types'

/** null = "All" (so types added later are included automatically). */
export type Selection = string[] | null

export interface ProblemRef {
  t: string
  s: number
}

export interface PracticeConfig {
  selection: Selection
  settings: PracticeSettings
}

const CONFIG_KEYS = ['topics', 'ans', 'pad', 'views'] as const
const CATEGORIES = Object.keys(CATEGORY_LABEL) as Category[]

const params = (hash: string) => new URLSearchParams(hash.replace(/^#/, ''))
const list = (v: string | null) => (v ?? '').split(',').map((x) => x.trim()).filter(Boolean)

export function parseRef(hash: string): ProblemRef | null {
  const p = params(hash)
  const t = p.get('t')
  const sRaw = p.get('s')
  if (!t || sRaw == null || !/^\d+$/.test(sRaw)) return null
  return { t, s: Number(sRaw) >>> 0 }
}

/** The practice set in a hash, or null when the hash doesn't specify one. */
export function parseConfig(hash: string, types: ProblemType[]): PracticeConfig | null {
  const p = params(hash)
  if (!CONFIG_KEYS.some((k) => p.has(k))) return null
  let selection: Selection = null
  if (p.has('topics')) {
    const ids = new Set<string>()
    for (const tok of list(p.get('topics'))) {
      if ((CATEGORIES as string[]).includes(tok)) types.filter((t) => t.category === tok).forEach((t) => ids.add(t.id))
      else if (types.some((t) => t.id === tok)) ids.add(tok)
    }
    // nothing recognisable → everything (a typo shouldn't leave a student with an empty page)
    selection = ids.size === 0 || ids.size === types.length ? null : types.map((t) => t.id).filter((id) => ids.has(id))
  }
  const settings = normalizeSettings({
    kinds: p.has('ans') ? list(p.get('ans')) : undefined,
    pad: p.get('pad') ?? undefined,
    views: p.has('views') ? list(p.get('views')) : undefined,
  })
  return { selection, settings }
}

/** Topic selection → URL tokens, using a category id wherever a whole category is on. */
export function topicTokens(sel: Selection, types: ProblemType[]): string[] | null {
  if (sel == null) return null
  const on = new Set(sel)
  if (types.every((t) => on.has(t.id))) return null
  const out: string[] = []
  for (const c of CATEGORIES) {
    const ts = types.filter((t) => t.category === c)
    if (ts.length && ts.every((t) => on.has(t.id))) out.push(c)
    else out.push(...ts.filter((t) => on.has(t.id)).map((t) => t.id))
  }
  return out
}

const sameAs = <T,>(a: readonly T[], all: readonly T[]) => a.length === all.length && all.every((x) => a.includes(x))

/** Hash for a problem (or, with ref null, for the practice set alone). Defaults are left out. */
export function hashFor(ref: ProblemRef | null, cfg: PracticeConfig, types: ProblemType[]): string {
  const parts: string[] = []
  if (ref) parts.push(`t=${encodeURIComponent(ref.t)}`, `s=${ref.s >>> 0}`)
  const topics = topicTokens(cfg.selection, types)
  // an explicitly empty selection can't be shared meaningfully; leave it out (= all)
  if (topics && topics.length) parts.push(`topics=${topics.join(',')}`)
  const s = cfg.settings
  if (!sameAs<AnswerKind>(s.kinds, ANSWER_KINDS)) parts.push(`ans=${s.kinds.join(',')}`)
  if (s.pad !== DEFAULT_SETTINGS.pad) parts.push(`pad=${s.pad}`)
  if (!sameAs<CoilView>(s.views, COIL_VIEWS)) parts.push(`views=${s.views.join(',')}`)
  return parts.length ? `#${parts.join('&')}` : ''
}

// ---------------------------------------------------------------------------
// Browser glue
// ---------------------------------------------------------------------------

export const readHash = (): ProblemRef | null => parseRef(location.hash)

/** True when the hash looks like a problem link at all (even a malformed one). */
export function hashHasLink(): boolean {
  const p = params(location.hash)
  return p.has('t') || p.has('s')
}

/** replaceState (not push) so Back doesn't walk through every problem. */
export function writeHash(ref: ProblemRef | null, cfg: PracticeConfig, types: ProblemType[]): void {
  const h = hashFor(ref, cfg, types)
  if (location.hash === h || (!h && !location.hash)) return
  history.replaceState(null, '', location.pathname + location.search + h)
}

/** Link for teachers. Drops the ?theme= screenshot override so recipients get their own theme. ref null = practice-set link. */
export function shareUrl(ref: ProblemRef | null, cfg: PracticeConfig, types: ProblemType[]): string {
  const q = new URLSearchParams(location.search)
  q.delete('theme')
  const qs = q.toString()
  return location.origin + location.pathname + (qs ? `?${qs}` : '') + hashFor(ref, cfg, types)
}

export const randomSeed = () => (Math.random() * 2 ** 32) >>> 0
