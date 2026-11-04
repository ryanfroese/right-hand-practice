import type { ComponentChildren } from 'preact'
import type { Rng } from '../rng'
import { type Dir, DIR_LABEL } from '../physics/vec'

export type Category = 'charges' | 'wires' | 'coils' | 'induction'

export const CATEGORY_LABEL: Record<Category, string> = {
  charges: 'Moving charges',
  wires: 'Currents & wires',
  coils: 'Loops & solenoids',
  induction: "Lenz's law",
}

export interface Choice {
  /** stable id; the Problem.answer is one of these */
  id: string
  /** text shown on the button */
  label: string
  /** optional big glyph shown above the label: → ← ↑ ↓ ⊙ ⊗ 0 ↻ ↺ */
  glyph?: string
}

export interface Problem {
  typeId: string
  /** One or two sentences. May use <b>, <i>, colored spans via <Q k="v">v</Q>. */
  prompt: ComponentChildren
  /** A <Diagram> element */
  diagram: ComponentChildren
  choices: Choice[]
  /** id of the correct Choice */
  answer: string
  /** Shown after the student answers: how the rule gives the answer (2–4 short sentences). */
  explanation: ComponentChildren
  /** Optional nudge shown on request before answering */
  hint?: ComponentChildren
  /**
   * Structured givens, used by tests to independently re-derive the answer.
   * Must be plain JSON data (directions as Dir strings, signs as +1/-1, etc).
   */
  facts: Record<string, unknown>
}

export interface ProblemType {
  id: string
  category: Category
  /** short name shown in the topic picker */
  title: string
  /** the skill being practiced, one line */
  skill: string
  generate(rng: Rng): Problem
}

// ---------------------------------------------------------------------------
// Choice helpers
// ---------------------------------------------------------------------------

export const DIR_GLYPH: Record<Dir, string> = {
  right: '→',
  left: '←',
  up: '↑',
  down: '↓',
  out: '⊙',
  in: '⊗',
}

export const ZERO_CHOICE: Choice = { id: 'zero', label: 'Zero', glyph: '0' }

/** The standard six-direction answer pad (optionally plus "zero"). Answer id = the Dir. */
export function dirChoices(opts: { zero?: boolean; only?: readonly Dir[] } = {}): Choice[] {
  const dirs: Dir[] = (opts.only as Dir[]) ?? ['up', 'down', 'left', 'right', 'out', 'in']
  const out: Choice[] = dirs.map((d) => ({ id: d, label: DIR_LABEL[d], glyph: DIR_GLYPH[d] }))
  if (opts.zero) out.push(ZERO_CHOICE)
  return out
}

export const ROTATION_CHOICES: Choice[] = [
  { id: 'cw', label: 'Clockwise', glyph: '↻' },
  { id: 'ccw', label: 'Counterclockwise', glyph: '↺' },
]
