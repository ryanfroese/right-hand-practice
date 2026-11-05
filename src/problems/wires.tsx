/**
 * Currents and straight wires.
 *
 * All physics is done in page coords via vec.ts (x right, y up, z out of page).
 *   force on a wire:      F ∝ I × B
 *   field of a long wire: B at P ∝ I × r̂   (r̂ = from the wire toward P)
 */
import type { ComponentChildren } from 'preact'
import type { Rng } from '../rng'
import { type Dir, DIR_PHRASE, cross, crossDir, dot, opposite, vec } from '../physics/vec'
import { COLORS, FONT, STROKE } from '../theme'
import {
  ArrowHead,
  Diagram,
  FieldGrid,
  FieldLines,
  InSymbol,
  Label,
  OutSymbol,
  VecLabel,
  Wire,
  WireEnd,
} from '../diagram/primitives'
import { type Choice, type Problem, type ProblemType, DIR_GLYPH, ROTATION_CHOICES, dirChoices } from './types'
import { Q } from './Q'

type InPlane = 'right' | 'left' | 'up' | 'down'
type Perp = 'in' | 'out'
type Rot = 'cw' | 'ccw'
type Avoid = { x: number; y: number; r: number }

const H_DIRS: InPlane[] = ['right', 'left']
const V_DIRS: InPlane[] = ['up', 'down']
const PLANE: InPlane[] = ['right', 'left', 'up', 'down']
const PERP: Perp[] = ['out', 'in']

const isHoriz = (d: Dir) => d === 'right' || d === 'left'
const ph = (d: Dir) => DIR_PHRASE[d]
/** Where P (or wire 2) sits relative to the wire, as a preposition phrase. */
const SIDE: Record<InPlane, string> = { right: 'to the right of', left: 'to the left of', up: 'above', down: 'below' }
const rotWord = (r: Rot) => (r === 'cw' ? 'clockwise' : 'counterclockwise')

/** Screen offset (dx, dy) for a page-direction step of length k. */
function step(d: InPlane, k: number): [number, number] {
  switch (d) {
    case 'right': return [k, 0]
    case 'left': return [-k, 0]
    case 'up': return [0, -k]
    case 'down': return [0, k]
  }
}

/** Grip rule: B at P = I × r̂ (r̂ from wire toward P). */
function gripField(current: Dir, rHat: Dir): Dir {
  const b = crossDir(current, rHat)
  if (!b) throw new Error('r̂ must be perpendicular to I')
  return b
}

/** Circulation (as seen looking at the page, from +z) of the field of an end-on wire. */
function circulationOf(current: Perp): Rot {
  // Field at a sample point to the right of the wire, then sign of (r × B)·ẑ.
  const r = vec('right')
  const b = cross(vec(current), r)
  return dot(cross(r, b), vec('out')) > 0 ? 'ccw' : 'cw'
}

/** Avoid circles spaced along a straight segment. */
function alongSegment(x1: number, y1: number, x2: number, y2: number, r: number, every = 18): Avoid[] {
  const len = Math.hypot(x2 - x1, y2 - y1)
  const n = Math.max(1, Math.ceil(len / every))
  const out: Avoid[] = []
  for (let i = 0; i <= n; i++) out.push({ x: x1 + ((x2 - x1) * i) / n, y: y1 + ((y2 - y1) * i) / n, r })
  return out
}

/**
 * A straight wire drawn so that current runs (x1,y1) → (x2,y2) in `dir`.
 * Returns the geometry plus the position of the Wire primitive's own I-label.
 */
function wireGeom(dir: InPlane, cx: number, cy: number, half: number, arrowAt = 0.5) {
  const [dx, dy] = step(dir, half)
  const x1 = cx - dx
  const y1 = cy - dy
  const x2 = cx + dx
  const y2 = cy + dy
  const mx = x1 + (x2 - x1) * arrowAt
  const my = y1 + (y2 - y1) * arrowAt
  const len = Math.hypot(x2 - x1, y2 - y1) || 1
  const ux = (x2 - x1) / len
  const uy = (y2 - y1) / len
  return { x1, y1, x2, y2, arrowAt, label: { x: mx - uy * 24, y: my + ux * 24 } }
}

const ATTRACT_CHOICES: Choice[] = [
  { id: 'attract', label: 'Attract', glyph: '→←' },
  { id: 'repel', label: 'Repel', glyph: '←→' },
]

function legendHeader(y: number, fieldDir: Dir) {
  return (
    <g>
      <VecLabel x={40} y={y} symbol="B" color={COLORS.B} anchor="start" />
      <Label x={64} y={y + 1} size={FONT.small} weight={500} color={COLORS.muted} anchor="start">
        {fieldDir === 'in' ? '× = into the page' : fieldDir === 'out' ? '• = out of the page' : 'uniform field'}
      </Label>
      <VecLabel x={640} y={y} symbol="F" color={COLORS.F} unknown anchor="end" />
    </g>
  )
}

const UnknownWire = (p: { x: number; y: number }) => (
  <g>
    <circle cx={p.x} cy={p.y} r={21} fill={COLORS.wire} opacity={0.25} />
    <circle cx={p.x} cy={p.y} r={18} fill={COLORS.paper} stroke={COLORS.I} stroke-width={3} />
    <text x={p.x} y={p.y + 1} fill={COLORS.I} font-size={20} font-weight={800} text-anchor="middle" dominant-baseline="central">
      ?
    </text>
  </g>
)

function GuideCircles(p: { x: number; y: number; radii: number[] }) {
  return (
    <g>
      {p.radii.map((r) => {
        // Pick a period that divides the circumference exactly so there is no seam where the dash pattern wraps.
        const circ = 2 * Math.PI * r
        const period = circ / Math.round(circ / 12)
        return (
          <circle
            cx={p.x}
            cy={p.y}
            r={r}
            fill="none"
            stroke={COLORS.muted}
            stroke-width={STROKE.guide}
            stroke-dasharray={`${(period * 5) / 12} ${(period * 7) / 12}`}
            opacity={0.7}
          />
        )
      })}
    </g>
  )
}

/** Field-line circles with arrowheads circulating `rot` (as seen looking at the page). */
function CirculatingField(p: { x: number; y: number; radii: number[]; rot: Rot }) {
  const s = p.rot === 'ccw' ? 1 : -1
  const heads: ComponentChildren[] = []
  p.radii.forEach((r, k) => {
    for (let i = 0; i < 4; i++) {
      const th = ((i * 90 + (k % 2 ? 0 : 45)) * Math.PI) / 180
      // page position (cos, sin), page tangent for ccw (-sin, cos); screen y flips.
      const hx = p.x + r * Math.cos(th)
      const hy = p.y - r * Math.sin(th)
      const tx = -Math.sin(th) * s
      const ty = -Math.cos(th) * s
      heads.push(<ArrowHead x={hx + tx * 7} y={hy + ty * 7} ux={tx} uy={ty} color={COLORS.B} size={14} />)
    }
  })
  return (
    <g>
      {p.radii.map((r) => (
        <circle cx={p.x} cy={p.y} r={r} fill="none" stroke={COLORS.B} stroke-width={STROKE.field} opacity={0.85} />
      ))}
      {heads}
    </g>
  )
}

const sym = (d: Dir) => DIR_GLYPH[d]

// ---------------------------------------------------------------------------
// 1. Force on a current-carrying wire in a uniform field
// ---------------------------------------------------------------------------

const wireForce: ProblemType = {
  id: 'wire-force',
  category: 'wires',
  title: 'Force on a wire',
  skill: 'F = I L × B for a straight wire in a uniform field',
  generate(rng: Rng): Problem {
    const kind = rng.pick(['h', 'h', 'v', 'v', 'end'] as const)
    let current: Dir
    let field: Dir
    if (kind === 'end') {
      current = rng.pick(PERP)
      field = rng.chance(0.85) ? rng.pick(PLANE) : rng.pick(PERP)
    } else {
      current = rng.pick(kind === 'h' ? H_DIRS : V_DIRS)
      const perp: Dir[] = (['right', 'left', 'up', 'down', 'out', 'in'] as Dir[]).filter((d) => crossDir(d, current) !== null)
      field = rng.chance(0.8) ? rng.pick(perp) : rng.pick([current, opposite(current)])
    }
    const f = crossDir(current, field)
    const answer = f ?? 'zero'

    // --- diagram ---
    const H = 340
    const top = 46
    const region = { x: 24, y: top, w: 632, h: H - top - 12 }
    const cx = 340
    const cy = top + region.h / 2
    const avoid: Avoid[] = []
    let wireEl: ComponentChildren
    const endHorizLines = kind === 'end' && isHoriz(field)
    if (endHorizLines) {
      // Odd line count puts one field line straight through the wire (sharing its gap);
      // the I label sits diagonally between rows so it never reads as part of a line.
      wireEl = (
        <>
          <WireEnd x={cx} y={cy} current={current as Perp} />
          <VecLabel x={cx + 30} y={cy + 30} symbol="I" color={COLORS.I} size={18} anchor="start" />
        </>
      )
      avoid.push({ x: cx, y: cy, r: 34 }, { x: cx + 38, y: cy + 30, r: 18 })
    } else if (kind === 'end') {
      wireEl = <WireEnd x={cx} y={cy} current={current as Perp} label="I" />
      avoid.push({ x: cx, y: cy, r: 42 }, { x: cx, y: cy + 40, r: 24 })
    } else {
      const half = kind === 'h' ? 210 : 120
      const g = wireGeom(current as InPlane, cx, cy, half, rng.pick([0.3, 0.5, 0.7]))
      wireEl = <Wire x1={g.x1} y1={g.y1} x2={g.x2} y2={g.y2} arrowAt={g.arrowAt} label="I" />
      avoid.push(...alongSegment(g.x1, g.y1, g.x2, g.y2, 30), { x: g.label.x, y: g.label.y, r: 28 })
    }
    const fieldEl =
      field === 'in' || field === 'out' ? (
        <FieldGrid {...region} dir={field} spacing={56} avoid={avoid} />
      ) : (
        <FieldLines {...region} dir={field as InPlane} count={endHorizLines ? 5 : 4} avoid={avoid.map((a) => ({ ...a, r: a.r - 4 }))} />
      )

    const iText = kind === 'end' ? `${ph(current)} (${sym(current)})` : ph(current)
    return {
      typeId: 'wire-force',
      prompt: (
        <>
          A wire carries current <Q k="I">I</Q> {iText} through a uniform magnetic field <Q k="B">B</Q>. Which way is the
          magnetic force <Q k="F">F</Q> on the wire?
        </>
      ),
      diagram: (
        <Diagram height={H} title="Current-carrying wire in a magnetic field" desc={`Current ${current}, field ${field}`}>
          <rect x={region.x} y={region.y} width={region.w} height={region.h} rx={10} fill="none" stroke={COLORS.muted} stroke-width={1} opacity={0.35} />
          {legendHeader(22, field)}
          {fieldEl}
          {wireEl}
        </Diagram>
      ),
      choices: dirChoices({ zero: true }),
      answer,
      hint: (
        <>
          Use <Q k="F">F</Q> = <Q k="I">I</Q>L × <Q k="B">B</Q>: fingers along the current, curl toward the field, thumb gives the force.
        </>
      ),
      explanation: f ? (
        <>
          Point your fingers along <Q k="I">I</Q> ({ph(current)}) and curl them toward <Q k="B">B</Q> ({ph(field)}). Your thumb points{' '}
          {ph(f)}, so the force <Q k="F">F</Q> on the wire is {ph(f)}. It is always perpendicular to both the wire and the field.
        </>
      ) : (
        <>
          The current ({ph(current)}) {current === opposite(field) ? 'points exactly opposite to' : 'points along'} <Q k="B">B</Q> ({ph(field)}), so <Q k="I">I</Q>L × <Q k="B">B</Q> = 0. A wire feels no
          magnetic force when its current lies along the same line as the field.
        </>
      ),
      facts: { kind, current, field },
    }
  },
}

// ---------------------------------------------------------------------------
// 2. Field at a point beside a long wire in the page (answer: out / in)
// ---------------------------------------------------------------------------

const wireFieldPoint: ProblemType = {
  id: 'wire-field-point',
  category: 'wires',
  title: 'Field beside a wire',
  skill: 'Right-hand grip rule: is B into or out of the page at P?',
  generate(rng: Rng): Problem {
    const horiz = rng.chance()
    const current: InPlane = rng.pick(horiz ? H_DIRS : V_DIRS)
    const rHat: InPlane = rng.pick(horiz ? V_DIRS : H_DIRS)
    const b = gripField(current, rHat)

    let H: number
    let wireEl: ComponentChildren
    let px: number
    let py: number
    const arrowAt = rng.pick([0.18, 0.82])
    if (horiz) {
      const wy = rHat === 'up' ? 165 : 55
      py = wy + (rHat === 'up' ? -110 : 110)
      H = Math.max(wy, py) + 50
      px = rng.int(290, 430)
      const g = wireGeom(current, 340, wy, 290, arrowAt)
      wireEl = <Wire x1={g.x1} y1={g.y1} x2={g.x2} y2={g.y2} arrowAt={g.arrowAt} label="I" />
    } else {
      const wx = rng.int(0, 1) ? 250 : 420
      const wxx = rHat === 'right' ? wx - 40 : wx + 40
      px = wxx + (rHat === 'right' ? 150 : -150)
      py = rng.int(140, 180)
      H = 330
      const g = wireGeom(current, wxx, 165, 140, arrowAt)
      wireEl = <Wire x1={g.x1} y1={g.y1} x2={g.x2} y2={g.y2} arrowAt={g.arrowAt} label="I" />
    }

    return {
      typeId: 'wire-field-point',
      prompt: (
        <>
          A long straight wire carries current <Q k="I">I</Q> {ph(current)}. At point P, does the wire's magnetic field <Q k="B">B</Q> point
          into or out of the page?
        </>
      ),
      diagram: (
        <Diagram height={H} title="Long straight wire and a point P" desc={`Current ${current}; P is ${rHat} of the wire`}>
          {wireEl}
          <circle cx={px} cy={py} r={5} fill={COLORS.ink} />
          <Label x={px - 14} y={py} anchor="end">
            P
          </Label>
          <VecLabel x={px + 16} y={py} symbol="B" color={COLORS.B} unknown anchor="start" />
        </Diagram>
      ),
      choices: dirChoices({ only: ['out', 'in'] }),
      answer: b,
      hint: (
        <>
          Grab the wire with your right hand, thumb along <Q k="I">I</Q>. Which way do your fingers go on P's side of the wire?
        </>
      ),
      explanation: (
        <>
          Grip the wire with your right thumb pointing {ph(current)} along <Q k="I">I</Q>. Your fingers curl around the wire, and on the side
          where P is ({SIDE[rHat]} the wire) they point {ph(b)}. So <Q k="B">B</Q> at P is {ph(b)} ({sym(b)}).
        </>
      ),
      facts: { current, rHat },
    }
  },
}

// ---------------------------------------------------------------------------
// 3. Field near an end-on wire (answer: in-plane direction)
// ---------------------------------------------------------------------------

const wireFieldEndon: ProblemType = {
  id: 'wire-field-endon',
  category: 'wires',
  title: 'Field around an end-on wire',
  skill: 'Grip rule for a wire perpendicular to the page',
  generate(rng: Rng): Problem {
    const current: Perp = rng.pick(PERP)
    const rHat: InPlane = rng.pick(PLANE)
    const b = gripField(current, rHat)
    const cx = rng.pick([300, 340, 380])
    const cy = 165
    const R = 120
    const [dx, dy] = step(rHat, R)
    const px = cx + dx
    const py = cy + dy
    // "P" sits just inside the circle, "B = ?" just outside, so neither crosses the dashed guide.
    const [ix, iy] = step(rHat, -24)
    const [ox, oy] = step(rHat, 28)
    const outAnchor = rHat === 'right' ? 'start' : rHat === 'left' ? 'end' : 'middle'
    return {
      typeId: 'wire-field-endon',
      prompt: (
        <>
          A long wire perpendicular to the page carries current <Q k="I">I</Q> {ph(current)} ({sym(current)}). Which way does its magnetic
          field <Q k="B">B</Q> point at P?
        </>
      ),
      diagram: (
        <Diagram height={rHat === 'down' ? 330 : 300} title="End-on wire and a point P" desc={`Current ${current}; P is ${rHat} of the wire`}>
          <GuideCircles x={cx} y={cy} radii={[62, R]} />
          <WireEnd x={cx} y={cy} current={current} label="I" />
          <circle cx={px} cy={py} r={5} fill={COLORS.ink} />
          <Label x={px + ix} y={py + iy}>
            P
          </Label>
          <VecLabel x={px + (rHat === 'left' || rHat === 'right' ? ox * 0.6 : 0)} y={py + oy} symbol="B" color={COLORS.B} unknown anchor={outAnchor} />
        </Diagram>
      ),
      choices: dirChoices({ only: ['up', 'down', 'left', 'right'] }),
      answer: b,
      hint: (
        <>
          Point your right thumb {ph(current)}. Your fingers curl around the wire — which way are they moving as they pass P?
        </>
      ),
      explanation: (
        <>
          Point your right thumb {ph(current)} along <Q k="I">I</Q>; your fingers curl {rotWord(circulationOf(current))} as seen looking at the
          page. At P ({SIDE[rHat]} the wire) that circle is heading {ph(b)}, so <Q k="B">B</Q> at P points {ph(b)}. The field is always tangent
          to the circle, never toward or away from the wire.
        </>
      ),
      facts: { current, rHat },
    }
  },
}

// ---------------------------------------------------------------------------
// 4. Circulation of the field around an end-on wire (and the reverse)
// ---------------------------------------------------------------------------

const wireCirculation: ProblemType = {
  id: 'wire-circulation',
  category: 'wires',
  title: 'Field circulation',
  skill: 'Which way do the field lines around a wire circulate?',
  generate(rng: Rng): Problem {
    const ask = rng.pick(['circulation', 'current'] as const)
    const current: Perp = rng.pick(PERP)
    const circulation = circulationOf(current)
    const cx = 340
    const cy = 155
    const radii = [72, 125]
    const H = 305

    if (ask === 'circulation') {
      const lx = cx + 125 * Math.cos(Math.PI / 4) + 16
      const ly = cy - 125 * Math.sin(Math.PI / 4) - 16
      return {
        typeId: 'wire-circulation',
        prompt: (
          <>
            A long wire carries current <Q k="I">I</Q> {ph(current)} ({sym(current)}). As seen looking at the page, do its magnetic field lines
            circulate clockwise or counterclockwise?
          </>
        ),
        diagram: (
          <Diagram height={H} title="End-on wire with circular field lines" desc={`Current ${current}`}>
            <GuideCircles x={cx} y={cy} radii={radii} />
            <WireEnd x={cx} y={cy} current={current} label="I" />
            <VecLabel x={lx} y={ly} symbol="B" color={COLORS.B} unknown anchor="start" />
          </Diagram>
        ),
        choices: ROTATION_CHOICES,
        answer: circulation,
        hint: <>Point your right thumb along the current. Your curled fingers show the field's direction around the wire.</>,
        explanation: (
          <>
            Point your right thumb {ph(current)} (the direction of <Q k="I">I</Q>). Looking at the page, your fingers curl {rotWord(circulation)}.
            {current === 'out'
              ? ' Current toward you always gives counterclockwise field lines.'
              : ' Current away from you always gives clockwise field lines.'}
          </>
        ),
        facts: { ask, current, circulation },
      }
    }

    return {
      typeId: 'wire-circulation',
      prompt: (
        <>
          The magnetic field lines around a long wire circulate {rotWord(circulation)} as seen looking at the page. Is the current{' '}
          <Q k="I">I</Q> out of the page or into the page?
        </>
      ),
      diagram: (
        <Diagram height={H} title="Circular field lines around a wire" desc={`Field circulates ${circulation}`}>
          <CirculatingField x={cx} y={cy} radii={radii} rot={circulation} />
          <UnknownWire x={cx} y={cy} />
          <VecLabel x={cx} y={cy + 40} symbol="I" color={COLORS.I} unknown size={18} />
          <VecLabel x={cx + 125 * Math.cos(Math.PI / 4) + 18} y={cy - 125 * Math.sin(Math.PI / 4) - 18} symbol="B" color={COLORS.B} anchor="start" />
        </Diagram>
      ),
      choices: dirChoices({ only: ['out', 'in'] }),
      answer: current,
      hint: <>Curl the fingers of your right hand along the field arrows. Your thumb points along the current.</>,
      explanation: (
        <>
          Curl your right fingers {rotWord(circulation)}, following the <Q k="B">B</Q> arrows. Your thumb points {ph(current)}, so the current{' '}
          <Q k="I">I</Q> is {ph(current)} ({sym(current)}).
        </>
      ),
      facts: { ask, circulation, current },
    }
  },
}

// ---------------------------------------------------------------------------
// 5. Two parallel wires
// ---------------------------------------------------------------------------

const wireParallel: ProblemType = {
  id: 'wire-parallel',
  category: 'wires',
  title: 'Parallel wires',
  skill: 'Do parallel currents attract or repel? Force on one wire from the other',
  generate(rng: Rng): Problem {
    const layout = rng.pick(['endon', 'inpage'] as const)
    const ask = rng.pick(['attract', 'force'] as const)
    const r12: InPlane = rng.pick(PLANE) // direction from wire 1 to wire 2
    let I1: Dir
    let I2: Dir
    if (layout === 'endon') {
      I1 = rng.pick(PERP)
      I2 = rng.pick(PERP)
    } else {
      const axis = isHoriz(r12) ? V_DIRS : H_DIRS
      I1 = rng.pick(axis)
      I2 = rng.pick(axis)
    }
    const same = I1 === I2
    const b12 = gripField(I1, r12) // field of wire 1 at wire 2
    const f2 = crossDir(I2, b12)
    if (!f2) throw new Error('unexpected zero force')
    const attract = f2 === opposite(r12)
    const answer = ask === 'attract' ? (attract ? 'attract' : 'repel') : f2

    // --- diagram ---
    const s1 = '₁'
    const s2 = '₂'
    let H: number
    let body: ComponentChildren
    const showF = ask === 'force'
    if (layout === 'endon') {
      if (isHoriz(r12)) {
        const y = 110
        const x1 = r12 === 'right' ? 230 : 450
        const x2 = r12 === 'right' ? 450 : 230
        H = 214
        body = (
          <>
            <WireEnd x={x1} y={y} current={I1 as Perp} label={`I${s1}`} />
            <WireEnd x={x2} y={y} current={I2 as Perp} label={`I${s2}`} />
            <Label x={x1} y={y + 70} size={FONT.small} color={COLORS.ink}>
              wire 1
            </Label>
            <Label x={x2} y={y + 70} size={FONT.small} color={COLORS.ink}>
              wire 2
            </Label>
            {showF ? <VecLabel x={x2} y={y - 48} symbol={`F${s2}`} color={COLORS.F} unknown /> : null}
          </>
        )
      } else {
        const x = 340
        const y1 = r12 === 'down' ? 70 : 230
        const y2 = r12 === 'down' ? 230 : 70
        H = 300
        body = (
          <>
            <WireEnd x={x} y={y1} current={I1 as Perp} />
            <WireEnd x={x} y={y2} current={I2 as Perp} />
            <VecLabel x={x + 34} y={y1 - 10} symbol={`I${s1}`} color={COLORS.I} size={18} anchor="start" />
            <VecLabel x={x + 34} y={y2 - 10} symbol={`I${s2}`} color={COLORS.I} size={18} anchor="start" />
            <Label x={x + 34} y={y1 + 14} size={FONT.small} color={COLORS.ink} anchor="start">
              wire 1
            </Label>
            <Label x={x + 34} y={y2 + 14} size={FONT.small} color={COLORS.ink} anchor="start">
              wire 2
            </Label>
            {showF ? <VecLabel x={x - 36} y={y2} symbol={`F${s2}`} color={COLORS.F} unknown anchor="end" /> : null}
          </>
        )
      }
    } else if (isHoriz(r12)) {
      // vertical wires side by side
      const x1 = r12 === 'right' ? 250 : 430
      const x2 = r12 === 'right' ? 430 : 250
      const top = 50
      const bot = 290
      const g1 = wireGeom(I1 as InPlane, x1, (top + bot) / 2, (bot - top) / 2, rng.pick([0.35, 0.65]))
      const g2 = wireGeom(I2 as InPlane, x2, (top + bot) / 2, (bot - top) / 2, rng.pick([0.35, 0.65]))
      H = showF ? 340 : 320
      body = (
        <>
          <Label x={x1} y={26} size={FONT.small} color={COLORS.ink}>
            wire 1
          </Label>
          <Label x={x2} y={26} size={FONT.small} color={COLORS.ink}>
            wire 2
          </Label>
          <Wire x1={g1.x1} y1={g1.y1} x2={g1.x2} y2={g1.y2} arrowAt={g1.arrowAt} label={`I${s1}`} />
          <Wire x1={g2.x1} y1={g2.y1} x2={g2.x2} y2={g2.y2} arrowAt={g2.arrowAt} label={`I${s2}`} />
          {showF ? <VecLabel x={x2} y={316} symbol={`F${s2}`} color={COLORS.F} unknown /> : null}
        </>
      )
    } else {
      // horizontal wires stacked
      const y1 = r12 === 'down' ? 60 : 190
      const y2 = r12 === 'down' ? 190 : 60
      const g1 = wireGeom(I1 as InPlane, 320, y1, 220, rng.pick([0.35, 0.65]))
      const g2 = wireGeom(I2 as InPlane, 320, y2, 220, rng.pick([0.35, 0.65]))
      H = 250
      body = (
        <>
          <Label x={70} y={y1} size={FONT.small} color={COLORS.ink} anchor="end">
            wire 1
          </Label>
          <Label x={70} y={y2} size={FONT.small} color={COLORS.ink} anchor="end">
            wire 2
          </Label>
          <Wire x1={g1.x1} y1={g1.y1} x2={g1.x2} y2={g1.y2} arrowAt={g1.arrowAt} label={`I${s1}`} />
          <Wire x1={g2.x1} y1={g2.y1} x2={g2.x2} y2={g2.y2} arrowAt={g2.arrowAt} label={`I${s2}`} />
          {showF ? <VecLabel x={566} y={y2} symbol={`F${s2}`} color={COLORS.F} unknown anchor="start" /> : null}
        </>
      )
    }

    const curText = (d: Dir) => (layout === 'endon' ? `${ph(d)} (${sym(d)})` : ph(d))
    const prompt =
      ask === 'attract' ? (
        <>
          Two long parallel wires carry currents <Q k="I">I₁</Q> {curText(I1)} and <Q k="I">I₂</Q> {curText(I2)}. Do the wires attract or
          repel each other?
        </>
      ) : (
        <>
          Two long parallel wires carry currents <Q k="I">I₁</Q> {curText(I1)} and <Q k="I">I₂</Q> {curText(I2)}. Which way is the magnetic
          force <Q k="F">F₂</Q> on wire 2 (the one carrying <Q k="I">I₂</Q>)?
        </>
      )
    return {
      typeId: 'wire-parallel',
      prompt,
      diagram: (
        <Diagram height={H} title="Two parallel current-carrying wires" desc={`I1 ${I1}, I2 ${I2}; wire 2 is ${r12} of wire 1`}>
          {body}
        </Diagram>
      ),
      choices: ask === 'attract' ? ATTRACT_CHOICES : dirChoices({ only: ['up', 'down', 'left', 'right', 'out', 'in'] }),
      answer,
      hint: (
        <>
          First find wire 1's field <Q k="B">B</Q> at wire 2 (grip rule), then use <Q k="F">F</Q> = <Q k="I">I₂</Q>L × <Q k="B">B</Q>.
        </>
      ),
      explanation: (
        <>
          Grip wire 1 with your thumb along <Q k="I">I₁</Q> ({ph(I1)}): at wire 2 ({SIDE[r12]} wire 1) its field <Q k="B">B</Q> points{' '}
          {ph(b12)}. Then fingers along <Q k="I">I₂</Q> ({ph(I2)}), curl toward <Q k="B">B</Q>: your thumb points {ph(f2)}, so{' '}
          <Q k="F">F₂</Q> is {ph(f2)} — {attract ? 'toward' : 'away from'} wire 1. {same ? 'Same-direction currents attract.' : 'Opposite currents repel.'}
        </>
      ),
      facts: { layout, ask, I1, I2, r12 },
    }
  },
}

// ---------------------------------------------------------------------------
// 6. Given the field at P, find the current in the wire
// ---------------------------------------------------------------------------

const wireFindCurrent: ProblemType = {
  id: 'wire-find-current',
  category: 'wires',
  title: 'Find the current',
  skill: 'Work the grip rule backwards: field at P → current direction',
  generate(rng: Rng): Problem {
    const horiz = rng.chance()
    const axis = horiz ? H_DIRS : V_DIRS
    const rHat: InPlane = rng.pick(horiz ? V_DIRS : H_DIRS)
    const field: Perp = rng.pick(PERP)
    // Try each current direction along the wire; keep the one whose grip field at P matches.
    const current = axis.find((c) => gripField(c, rHat) === field)!
    const other = opposite(current)

    let H: number
    let wireEl: ComponentChildren
    let px: number
    let py: number
    let iLabel: { x: number; y: number; anchor: 'start' | 'middle' | 'end' }
    if (horiz) {
      const wy = rHat === 'up' ? 190 : 70
      py = wy + (rHat === 'up' ? -110 : 110)
      H = Math.max(wy, py) + 50
      px = rng.int(300, 430)
      wireEl = <Wire x1={50} y1={wy} x2={630} y2={wy} current="none" />
      iLabel = { x: 110, y: wy + (rHat === 'up' ? 28 : -28), anchor: 'middle' }
    } else {
      const wx = rHat === 'right' ? rng.pick([180, 250]) : rng.pick([430, 500])
      px = wx + (rHat === 'right' ? 150 : -150)
      py = rng.int(140, 190)
      H = 330
      wireEl = <Wire x1={wx} y1={25} x2={wx} y2={305} current="none" />
      iLabel = rHat === 'right' ? { x: wx - 18, y: 60, anchor: 'end' } : { x: wx + 18, y: 60, anchor: 'start' }
    }
    return {
      typeId: 'wire-find-current',
      prompt: (
        <>
          The magnetic field <Q k="B">B</Q> of a long straight wire points {ph(field)} at point P. Which way is the current <Q k="I">I</Q> in
          the wire?
        </>
      ),
      diagram: (
        <Diagram height={H} title="Long wire with known field at P" desc={`B at P is ${field}; P is ${rHat} of the wire`}>
          {wireEl}
          <VecLabel x={iLabel.x} y={iLabel.y} symbol="I" color={COLORS.I} unknown anchor={iLabel.anchor} />
          {field === 'out' ? <OutSymbol x={px} y={py} color={COLORS.B} /> : <InSymbol x={px} y={py} color={COLORS.B} />}
          <VecLabel x={px + 22} y={py - 20} symbol="B" color={COLORS.B} anchor="start" />
          <Label x={px - 22} y={py + 18} anchor="end">
            P
          </Label>
        </Diagram>
      ),
      choices: dirChoices({ only: axis }),
      answer: current,
      hint: <>Try each direction: grip the wire with your thumb along it and see which way your fingers point at P.</>,
      explanation: (
        <>
          Try <Q k="I">I</Q> {ph(current)}: with your right thumb {ph(current)}, your fingers on P's side ({SIDE[rHat]} the wire) point{' '}
          {ph(field)} — that matches <Q k="B">B</Q>. A current {ph(other)} would give a field {ph(opposite(field))} at P, so{' '}
          <Q k="I">I</Q> is {ph(current)}.
        </>
      ),
      facts: { field, rHat, axis: horiz ? 'horizontal' : 'vertical' },
    }
  },
}

export const wiresTypes: ProblemType[] = [wireForce, wireFieldPoint, wireFieldEndon, wireCirculation, wireParallel, wireFindCurrent]
