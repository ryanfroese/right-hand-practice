/**
 * Practice settings: what kinds of answers can come up, how many buttons the
 * answer pad shows, and which coil views are drawn. Instructors set these and
 * share them in the URL (see ui/hash.ts); students can change them afterwards.
 *
 * Pure functions only — no DOM, no storage — so it is all unit-tested.
 */
import { makeRng } from '../rng'
import type { Choice, CoilView, Problem, ProblemType } from '../problems/types'
import { dirChoices, ROTATION_CHOICES, ZERO_CHOICE } from '../problems/types'

export type { CoilView }

/** Answer families a student can be asked for. */
export type AnswerKind = 'plane' | 'depth' | 'rot' | 'zero'
export const ANSWER_KINDS: readonly AnswerKind[] = ['plane', 'depth', 'rot', 'zero']

export const COIL_VIEWS: readonly CoilView[] = ['side', 'upright', 'end']

/**
 * 'full'    = every answer in the question's family (all six directions, plus
 *             rotations where a coil could be asking for one) — the default.
 * 'focused' = only the answers the picture leaves open (e.g. just up/down for
 *             the front wire of a side-on coil).
 */
export type PadMode = 'full' | 'focused'

export interface PracticeSettings {
  kinds: AnswerKind[]
  pad: PadMode
  views: CoilView[]
}

export const DEFAULT_SETTINGS: PracticeSettings = { kinds: [...ANSWER_KINDS], pad: 'full', views: [...COIL_VIEWS] }

const KIND_BY_ID: Record<string, AnswerKind> = {
  up: 'plane',
  down: 'plane',
  left: 'plane',
  right: 'plane',
  out: 'depth',
  in: 'depth',
  cw: 'rot',
  ccw: 'rot',
  zero: 'zero',
  none: 'zero',
}

/** Kind of an answer id; null for answers outside these families (charge sign, attract/repel, which end...). */
export const kindOf = (id: string): AnswerKind | null => KIND_BY_ID[id] ?? null

export function answerAllowed(answer: string, s: PracticeSettings): boolean {
  const k = kindOf(answer)
  return k == null || s.kinds.includes(k)
}

const DIR_IDS = new Set(['up', 'down', 'left', 'right', 'out', 'in'])

/**
 * The full pad for a question whose focused choices are `choices`:
 * any direction → all six directions (keeping zero/rotations if offered).
 * Anything else (rotations only, charge sign, …) is already complete.
 */
export function fullChoicesFor(choices: Choice[]): Choice[] {
  const ids = new Set(choices.map((c) => c.id))
  if (![...ids].some((id) => DIR_IDS.has(id))) return choices
  const out = dirChoices()
  if (ids.has('zero')) out.push(ZERO_CHOICE)
  if (ids.has('cw') || ids.has('ccw')) out.push(...ROTATION_CHOICES)
  return out
}

/**
 * Buttons to show for this problem under these settings. Disabled answer kinds
 * are removed; the correct answer is always kept; never fewer than two buttons.
 */
export function padChoices(p: Problem, s: PracticeSettings): Choice[] {
  const base = s.pad === 'full' ? (p.fullChoices ?? fullChoicesFor(p.choices)) : p.choices
  const kept = base.filter((c) => c.id === p.answer || answerAllowed(c.id, s))
  if (kept.length >= 2) return kept
  // e.g. every distractor was a disabled kind: fall back to the focused set unfiltered
  return p.choices
}

/** Coil views this type can draw that are switched on (null = type has no coil views). */
export function viewsFor(t: ProblemType, s: PracticeSettings): CoilView[] | null {
  if (!t.views) return null
  return t.views.filter((v) => s.views.includes(v))
}

export function generate(t: ProblemType, seed: number, s: PracticeSettings): Problem {
  const views = viewsFor(t, s)
  return t.generate(makeRng(seed), { views: views && views.length ? views : (t.views ?? undefined) })
}

/** How many consecutive seeds to try before deciding a type can't satisfy the settings. */
export const SEED_TRIES = 48

/**
 * The first seed at or after `seed` whose problem has an allowed answer, or
 * null if the type can't produce one under these settings (e.g. every answer
 * of coil-loop-center is in/out and in/out is switched off).
 */
export function findSeed(t: ProblemType, seed: number, s: PracticeSettings): number | null {
  const views = viewsFor(t, s)
  if (views && views.length === 0) return null
  for (let k = 0; k < SEED_TRIES; k++) {
    const sd = (seed + k) >>> 0
    if (answerAllowed(generate(t, sd, s).answer, s)) return sd
  }
  return null
}

/** Whether a type can show up at all under these settings (fixed probe so it's stable). */
export const typeAvailable = (t: ProblemType, s: PracticeSettings): boolean => findSeed(t, 0x9e3779b9, s) != null

const sameSet = <T,>(a: readonly T[], b: readonly T[]) => a.length === b.length && a.every((x) => b.includes(x))

export function isDefault(s: PracticeSettings): boolean {
  return s.pad === DEFAULT_SETTINGS.pad && sameSet(s.kinds, ANSWER_KINDS) && sameSet(s.views, COIL_VIEWS)
}

/** Clean up anything loaded from storage or a URL: drop unknown values, keep canonical order, never empty. */
export function normalizeSettings(raw: Partial<Record<keyof PracticeSettings, unknown>> | null | undefined): PracticeSettings {
  const list = <T extends string>(v: unknown, all: readonly T[]): T[] => {
    if (!Array.isArray(v)) return [...all]
    const ok = all.filter((x) => v.includes(x))
    return ok.length ? ok : [...all]
  }
  return {
    kinds: list(raw?.kinds, ANSWER_KINDS),
    pad: raw?.pad === 'focused' ? 'focused' : 'full',
    views: list(raw?.views, COIL_VIEWS),
  }
}
