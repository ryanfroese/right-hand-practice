import type { ComponentChildren, JSX } from 'preact'
import type { Rng } from '../rng'
import type { Choice, Problem, ProblemType } from './types'
import { ROTATION_CHOICES, dirChoices, ZERO_CHOICE } from './types'
import { Q } from './Q'
import { type Dir, DIR_PHRASE, cross, dot, neg, opposite, scale, screenStep, toDir, vec, crossDir } from '../physics/vec'
import { COLORS } from '../theme'
import { BarMagnet, Caption, Diagram, Label, Vector, Wire, VecLabel } from '../diagram/primitives'
import {
  type KeepOut,
  type Trend,
  CircleLoop,
  MarkField,
  RectLoop,
  SideCoil,
  SubLabel,
  TrendBadge,
  VResistor,
  rectOutline,
  sideCoilRight,
  subLabelBox,
  subLabelW,
  trendBadgeW,
} from '../diagram/lenz'

// ---------------------------------------------------------------------------
// Physics core (page coords, vec.ts only)
// ---------------------------------------------------------------------------

type Change = 1 | -1 | 0
type InPlane = 'right' | 'left' | 'up' | 'down'
type Rot = 'cw' | 'ccw' | 'none'

const TREND: Record<string, Trend> = { '1': 'increasing', '-1': 'decreasing', '0': 'constant' }
const trendOf = (c: Change): Trend => TREND[String(c)]

/** Lenz: the induced field opposes the CHANGE in flux (none if no change). */
function inducedField(flux: Dir, change: Change): Dir | null {
  return toDir(scale(vec(flux), -change))
}

/**
 * Rotation (as seen looking at the page) of a current in a loop lying in the
 * page that produces field `b` at the loop's center. A ccw current flows UP the
 * right-hand side of the loop; its field at the center is dl × (−r̂).
 */
function loopRotation(b: Dir | null): Rot {
  if (!b) return 'none'
  const ccwField = toDir(cross(vec('up'), neg(vec('right'))))
  return b === ccwField ? 'ccw' : 'cw'
}

const ROT_WORD: Record<'cw' | 'ccw', string> = { cw: 'clockwise', ccw: 'counterclockwise' }
const NONE_CHOICE: Choice = { id: 'none', label: 'No current', glyph: '0' }
const ROT_CHOICES: Choice[] = [...ROTATION_CHOICES, NONE_CHOICE]

const fieldWord = (d: 'in' | 'out') => (d === 'in' ? 'into the page' : 'out of the page')

// ---------------------------------------------------------------------------
// Shared explanations
// ---------------------------------------------------------------------------

/** Steps 2–3 of Lenz: induced field, then the curl of the right hand. */
function lenzSteps(flux: Dir, change: Change, end: 'current' | 'field'): ComponentChildren {
  const b = inducedField(flux, change)
  if (!b) return null
  const why = change > 0 ? 'opposite' : 'the same direction as'
  const reason = change > 0 ? 'to fight the growing flux' : 'to prop up the fading flux'
  if (end === 'field') {
    return (
      <>
        {' '}
        The induced current makes its own <Q k="B">B</Q> pointing {why} the original field, {reason}: {DIR_PHRASE[b]}.
      </>
    )
  }
  const rot = loopRotation(b) as 'cw' | 'ccw'
  return (
    <>
      {' '}
      The induced <Q k="B">B</Q> inside the loop must point {why} the original, {reason}: {DIR_PHRASE[b]}. Point your right
      thumb {DIR_PHRASE[b]} and curl your fingers: they go <b>{ROT_WORD[rot]}</b>.
    </>
  )
}

// ---------------------------------------------------------------------------
// Setup A: loop in a changing uniform field
// ---------------------------------------------------------------------------

interface FluxSetup {
  setup: 'flux'
  field: 'in' | 'out'
  changeSign: Change
  change: Trend
  shape: 'circle' | 'rect'
  cx: number
}

function genFluxSetup(rng: Rng): FluxSetup {
  const r = rng.next()
  const changeSign: Change = r < 0.4 ? 1 : r < 0.8 ? -1 : 0
  return {
    setup: 'flux',
    field: rng.pick(['in', 'out'] as const),
    changeSign,
    change: trendOf(changeSign),
    shape: rng.pick(['circle', 'rect'] as const),
    cx: 340 + rng.int(-4, 4) * 10,
  }
}

function fluxDiagram(s: FluxSetup, ask: 'current' | 'field') {
  const cy = 210
  const keep: KeepOut[] = []
  let loop: JSX.Element
  let lx: number
  let ly: number
  if (s.shape === 'circle') {
    const r = 100
    loop = <CircleLoop cx={s.cx} cy={cy} r={r} />
    keep.push({ kind: 'ring', x: s.cx, y: cy, r, pad: 17 })
    lx = s.cx + r * 0.72 + 12
    ly = cy - r * 0.72 - 14
  } else {
    const w = 260
    const h = 170
    loop = <RectLoop x={s.cx - w / 2} y={cy - h / 2} w={w} h={h} />
    keep.push(...rectOutline(s.cx - w / 2, cy - h / 2, w, h, 17))
    lx = s.cx + w / 2 + 12
    ly = cy - h / 2 - 22
  }
  let label: JSX.Element
  if (ask === 'current') {
    const w = subLabelW('I', '', true)
    keep.push(subLabelBox(lx, ly, w, 'start'))
    label = <SubLabel x={lx} y={ly} sym="I" color={COLORS.I} unknown anchor="start" />
  } else {
    const w = subLabelW('B', 'ind', true)
    keep.push(subLabelBox(s.cx, cy, w, 'middle', 26))
    label = <SubLabel x={s.cx} y={cy} sym="B" sub="ind" color={COLORS.B} unknown />
  }
  const H = 372
  return (
    <Diagram
      height={H}
      title="Loop in a uniform magnetic field"
      desc={`A ${s.shape === 'circle' ? 'circular' : 'rectangular'} loop lies in the page in a uniform field pointing ${fieldWord(s.field)}; the field is ${s.change}.`}
    >
      <TrendBadge x={340} y={30} sym="B" trend={s.change} color={COLORS.B} />
      <MarkField x={40} y={72} w={600} h={280} dir={s.field} spacing={56} keep={keep} origin={{ x: s.cx, y: cy }} />
      {loop}
      {label}
    </Diagram>
  )
}

function fluxWhy(s: FluxSetup): ComponentChildren {
  if (s.changeSign === 0)
    return (
      <>
        <Q k="B">B</Q> is constant, so the flux through the loop is not changing. No change in flux means no induced current
        — Lenz's law only cares about the <i>change</i>, not how strong <Q k="B">B</Q> is.
      </>
    )
  return (
    <>
      The flux through the loop points {fieldWord(s.field)} and is {s.change}.
    </>
  )
}

// ---------------------------------------------------------------------------
// Setup B: loop moving into / out of / within a field region
// ---------------------------------------------------------------------------

interface MoveSetup {
  setup: 'moving'
  field: 'in' | 'out'
  /** direction from the boundary toward the field region */
  fieldSide: InPlane
  position: 'straddle' | 'inside' | 'outside'
  v: InPlane
  /** signed distance (px) from the boundary to the loop center, + toward the field */
  u: number
  /** loop half-size measured perpendicular to the boundary (px) */
  half: number
  /** offset of the loop along the boundary (px, horizontal boundaries only) */
  w: number
}

const IN_PLANE: InPlane[] = ['right', 'left', 'up', 'down']
const isHoriz = (d: Dir) => d === 'left' || d === 'right'
const LOOP_W = 170
const LOOP_H = 130

function genMoveSetup(rng: Rng): MoveSetup {
  const fieldSide = rng.pick(IN_PLANE)
  const r = rng.next()
  const position = r < 0.78 ? 'straddle' : r < 0.89 ? 'inside' : 'outside'
  const parallel = IN_PLANE.filter((d) => isHoriz(d) !== isHoriz(fieldSide))
  let v: InPlane
  if (position === 'straddle') {
    v = rng.chance(0.88) ? rng.pick([fieldSide, opposite(fieldSide) as InPlane]) : rng.pick(parallel)
  } else {
    // never toward the boundary: a loop "about to cross" reads as changing flux
    const away = (position === 'inside' ? fieldSide : opposite(fieldSide)) as InPlane
    v = rng.pick([...parallel, away])
  }
  const half = isHoriz(fieldSide) ? LOOP_W / 2 : LOOP_H / 2
  // straddle: bias the loop into the field so the in-field part is big enough to show marks
  const u = position === 'straddle' ? Math.round(half * (isHoriz(fieldSide) ? 0.05 + rng.next() * 0.35 : rng.next() * 0.5 - 0.1)) : position === 'inside' ? half + 40 : -(half + 40)
  const w = isHoriz(fieldSide) ? 0 : rng.int(-10, 10) * 10
  return { setup: 'moving', field: rng.pick(['in', 'out'] as const), fieldSide, position, v, u, half, w }
}

/** Sign of d(flux magnitude)/dt: only a loop straddling the edge changes its overlap with the field. */
function moveChange(s: MoveSetup): Change {
  if (s.position !== 'straddle') return 0
  return Math.sign(dot(vec(s.v), vec(s.fieldSide))) as Change
}

function moveDiagram(s: MoveSetup, ask: 'current' | 'field') {
  // horiz: field is left/right of a VERTICAL dashed boundary
  const horiz = isHoriz(s.fieldSide)
  const LW = LOOP_W
  const LH = LOOP_H
  const hu = s.half
  const [fx, fy] = screenStep(s.fieldSide)
  // local frame: the boundary passes through (0, 0); n = depth into the field, t = along the boundary
  const P = (n: number, t: number): [number, number] => (horiz ? [fx * n, t] : [t, fy * n])
  const tc = horiz ? 0 : s.w
  const [cx, cy] = P(s.u, tc)
  const keep: KeepOut[] = [...rectOutline(cx - LW / 2, cy - LH / 2, LW, LH, 11)]
  const pts: [number, number][] = [
    [cx - LW / 2, cy - LH / 2],
    [cx + LW / 2, cy + LH / 2],
    // at least one row of field beyond the loop, and a modest field-free strip
    P(Math.max(s.u + hu, 0) + 78, tc),
    P(Math.min(s.u - hu, 0) - 46, tc),
  ]
  // velocity arrow from the loop edge
  const [vx, vy] = screenStep(s.v)
  const half = isHoriz(s.v) ? LW / 2 : LH / 2
  const gap = half + 10
  const vlen = 70
  // v parallel to the boundary on a straddling loop: run the arrow through the field-free part, off the dashed line
  const parallel = isHoriz(s.v) !== horiz
  const [ox, oy] = parallel && s.position === 'straddle' ? P((s.u - hu) / 2, tc) : [cx, cy]
  const ax1 = ox + vx * gap
  const ay1 = oy + vy * gap
  const ax2 = ax1 + vx * vlen
  const ay2 = ay1 + vy * vlen
  keep.push({ kind: 'seg', x1: ax1, y1: ay1, x2: ax2, y2: ay2, pad: 18 })
  const vlx = isHoriz(s.v) ? ax2 + vx * 16 : ax2
  const vly = isHoriz(s.v) ? ay2 : ay2 + vy * 20
  keep.push({ kind: 'circle', x: vlx, y: vly, r: 22 })
  pts.push([vlx - 14, vly - 14], [vlx + 14, vly + 14])
  // unknown label
  let label: JSX.Element
  let box: KeepOut
  if (ask === 'current') {
    // outside a corner of the loop, away from the velocity arrow
    const ly = s.v === 'up' || s.v === 'right' ? cy + LH / 2 + 20 : cy - LH / 2 - 20
    const anchor = s.v === 'right' ? 'end' : 'start'
    const lx = s.v === 'right' ? cx + LW / 2 : cx + LW / 2 + 10
    box = subLabelBox(lx, ly, subLabelW('I', '', true), anchor, 8)
    label = <SubLabel x={lx} y={ly} sym="I" color={COLORS.I} unknown anchor={anchor} halo />
  } else {
    // straddling: keep the boundary off the label. Horizontal boundary → the (blank) field-free part of the loop;
    // vertical boundary → the in-field part (wide enough there), so the field marks still fill the rest of it.
    const [lx, ly] = s.position !== 'straddle' ? [cx, cy] : horiz ? P((s.u + hu) / 2, tc - 28) : P((s.u - hu) / 2, tc)
    box = subLabelBox(lx, ly, subLabelW('B', 'ind', true) * 1.25, 'middle', 10)
    label = <SubLabel x={lx} y={ly} sym="B" sub="ind" color={COLORS.B} unknown halo />
  }
  keep.push(box)
  if (box.kind === 'box') pts.push([box.x - 4, box.y - 4], [box.x + box.w + 4, box.y + box.h + 4])
  // lattice through the middle of the in-field part of the loop (or the loop center)
  const origin = s.position === 'straddle' ? P((s.u + hu) / 2, tc + (horiz && ask === 'field' ? 30 : 0)) : s.position === 'inside' ? [cx, cy] : P(26, tc)
  // straddle: rows at the in-field strip's middle and one spacing beyond must clear the loop's far edge (pad 11)
  const sp = s.position === 'straddle' ? Math.max(52, Math.round((s.u + hu) / 2 + 26)) : 52
  keep.push({ kind: 'seg', ...(horiz ? { x1: 0, y1: -2000, x2: 0, y2: 2000 } : { x1: -2000, y1: 0, x2: 2000, y2: 0 }), pad: 10 })
  // crop to content
  const xs = pts.map((p) => p[0])
  const ys = pts.map((p) => p[1])
  const minY = Math.min(...ys)
  const maxY = Math.max(...ys)
  const pad = 24
  const ty = pad - minY
  const H = Math.round(maxY - minY + 2 * pad)
  const tx = horiz ? 340 - (Math.min(...xs) + Math.max(...xs)) / 2 : 340
  // whole SVG in local coords; the field region runs to the SVG edge on its side
  const X0 = -tx
  const X1 = 680 - tx
  const Y0 = -ty
  const Y1 = H - ty
  const reg =
    s.fieldSide === 'right'
      ? { x: 0, y: Y0, w: X1, h: H }
      : s.fieldSide === 'left'
        ? { x: X0, y: Y0, w: -X0, h: H }
        : s.fieldSide === 'down'
          ? { x: X0, y: 0, w: 680, h: Y1 }
          : { x: X0, y: Y0, w: 680, h: -Y0 }
  const bl = horiz ? { x1: 0, y1: Y0, x2: 0, y2: Y1 } : { x1: X0, y1: 0, x2: X1, y2: 0 }
  const where = s.position === 'straddle' ? 'partly inside' : s.position === 'inside' ? 'fully inside' : 'fully outside'
  return (
    <Diagram
      height={H}
      title="Loop moving near a magnetic field region"
      desc={`A rectangular loop is ${where} a field region (B ${fieldWord(s.field)}) on the ${s.fieldSide} side of a boundary, moving ${DIR_PHRASE[s.v]}.`}
    >
      <g transform={`translate(${tx} ${ty})`}>
        <rect x={reg.x} y={reg.y} width={reg.w} height={reg.h} fill={COLORS.B} opacity={0.07} />
        <line {...bl} stroke={COLORS.B} stroke-width={1.75} stroke-dasharray="8 6" opacity={0.7} />
        <MarkField
          x={reg.x + 14}
          y={reg.y + 14}
          w={reg.w - 28}
          h={reg.h - 28}
          dir={s.field}
          spacing={sp}
          keep={keep}
          origin={{ x: origin[0], y: origin[1] }}
        />
        <RectLoop x={cx - LW / 2} y={cy - LH / 2} w={LW} h={LH} />
        <Vector x={ox} y={oy} dir={s.v} color={COLORS.v} symbol="v" gap={gap} length={vlen} />
        {label}
      </g>
    </Diagram>
  )
}

function moveWhy(s: MoveSetup): ComponentChildren {
  const c = moveChange(s)
  if (s.position === 'inside')
    return (
      <>
        The loop is completely inside the field, so moving it doesn't change how much flux passes through it. No change in
        flux, no induced current.
      </>
    )
  if (s.position === 'outside')
    return (
      <>
        The loop is completely outside the field, so there is no flux through it — and that's still true as it moves right now. No change in flux, no induced current.
      </>
    )
  if (c === 0)
    return (
      <>
        The loop slides along the edge of the field, so the part of it inside the field stays the same size. The flux is
        constant, so there is no induced current.
      </>
    )
  return (
    <>
      The loop is moving {c > 0 ? 'deeper into' : 'out of'} the field, so more and more of it is {c > 0 ? 'inside' : 'outside'}:
      the flux {fieldWord(s.field)} is {c > 0 ? 'increasing' : 'decreasing'}.
    </>
  )
}

// ---------------------------------------------------------------------------
// 1. lenz-flux-change
// ---------------------------------------------------------------------------

const fluxChange: ProblemType = {
  id: 'lenz-flux-change',
  category: 'induction',
  title: 'Changing field through a loop',
  skill: 'Find the induced current when B through a loop grows, shrinks or stays constant.',
  generate(rng) {
    const s = genFluxSetup(rng)
    const answer = loopRotation(inducedField(s.field, s.changeSign))
    return {
      typeId: 'lenz-flux-change',
      prompt: (
        <>
          The uniform <Q k="B">B</Q> field ({fieldWord(s.field)}) is <b>{s.change}</b>. Which way does the induced current
          flow in the loop, as seen looking at the page?
        </>
      ),
      diagram: fluxDiagram(s, 'current'),
      choices: ROT_CHOICES,
      answer,
      explanation: (
        <>
          {fluxWhy(s)}
          {lenzSteps(s.field, s.changeSign, 'current')}
        </>
      ),
      hint: <>First ask: is the flux through the loop changing? The induced current always opposes the change.</>,
      facts: { setup: 'flux', field: s.field, change: s.change, changeSign: s.changeSign, shape: s.shape },
    }
  },
}

// ---------------------------------------------------------------------------
// 2. lenz-loop-moving
// ---------------------------------------------------------------------------

const loopMoving: ProblemType = {
  id: 'lenz-loop-moving',
  category: 'induction',
  title: 'Loop moving through a field edge',
  skill: 'Decide whether a moving loop gains or loses flux, then find the induced current.',
  generate(rng) {
    const s = genMoveSetup(rng)
    const c = moveChange(s)
    const answer = loopRotation(inducedField(s.field, c))
    return {
      typeId: 'lenz-loop-moving',
      prompt: (
        <>
          The loop moves with constant velocity <Q k="v">v</Q> near a region of magnetic field <Q k="B">B</Q> (
          {fieldWord(s.field)}). At this instant, which way is the induced current, as seen looking at the page?
        </>
      ),
      diagram: moveDiagram(s, 'current'),
      choices: ROT_CHOICES,
      answer,
      explanation: (
        <>
          {moveWhy(s)}
          {lenzSteps(s.field, c, 'current')}
        </>
      ),
      hint: <>Is the part of the loop inside the field getting bigger, smaller, or staying the same?</>,
      facts: { setup: 'moving', field: s.field, fieldSide: s.fieldSide, position: s.position, v: s.v, u: s.u, half: s.half },
    }
  },
}

// ---------------------------------------------------------------------------
// 3. lenz-sliding-rod
// ---------------------------------------------------------------------------

const slidingRod: ProblemType = {
  id: 'lenz-sliding-rod',
  category: 'induction',
  title: 'Sliding rod on rails',
  skill: 'Use the changing circuit area to find the induced current and the magnetic drag on the rod.',
  generate(rng) {
    const field = rng.pick(['in', 'out'] as const)
    const closedSide = rng.pick(['left', 'right'] as const)
    const v = rng.pick(['left', 'right'] as const)
    const ask = rng.chance(0.55) ? 'current' : 'force'
    // circuit area grows when the rod moves away from the closed end
    const change = Math.sign(dot(vec(v), vec(opposite(closedSide)))) as Change
    const bInd = inducedField(field, change)!
    // the rod is the side of the circuit farthest from the closed end
    const rodSide = opposite(closedSide)
    // current along a loop side at r̂ from the center that makes field bInd at the center: dl = bInd × r̂
    const iRod = crossDir(bInd, rodSide)!
    // force on the rod: F = I L × B
    const force = crossDir(iRod, field)!
    const answer = ask === 'current' ? iRod : force

    // ---- diagram (canonical: closed end on the LEFT, then mirror) ----
    const mx = (x: number) => (closedSide === 'left' ? x : 680 - x)
    const yT = 110
    const yB = 270
    const xC = 72
    const xO = 632
    const rodX = rng.int(30, 46) * 10
    const rx = mx(rodX)
    const keep: KeepOut[] = [
      { kind: 'seg', x1: mx(xC), y1: yT, x2: mx(xO), y2: yT, pad: 17 },
      { kind: 'seg', x1: mx(xC), y1: yB, x2: mx(xO), y2: yB, pad: 17 },
      { kind: 'seg', x1: mx(xC), y1: yT, x2: mx(xC), y2: yB, pad: 26 },
      { kind: 'circle', x: mx(xC) + (closedSide === 'left' ? -30 : 30), y: (yT + yB) / 2, r: 18 },
      { kind: 'seg', x1: rx, y1: yT - 20, x2: rx, y2: yB + 20, pad: 20 },
    ]
    const [vx] = screenStep(v)
    const vy = (yT + yB) / 2
    const vgap = 12
    const vlen = 80
    keep.push({ kind: 'seg', x1: rx + vx * vgap, y1: vy, x2: rx + vx * (vgap + vlen + 26), y2: vy, pad: 20 })
    const ly = yT - 44
    const sym = ask === 'current' ? 'I' : 'F'
    const lcolor = ask === 'current' ? COLORS.I : COLORS.F
    keep.push(subLabelBox(rx, ly, subLabelW(sym, '', true), 'middle'))
    const diagram = (
      <Diagram
        height={346}
        title="Rod sliding on conducting rails"
        desc={`A rod slides ${DIR_PHRASE[v]} on two rails joined by a resistor on the ${closedSide}, in a uniform field ${fieldWord(field)}.`}
      >
        <MarkField x={30} y={30} w={620} h={290} dir={field} spacing={54} keep={keep} origin={{ x: 340, y: (yT + yB) / 2 }} />
        <line x1={mx(xC)} y1={yT} x2={mx(xO)} y2={yT} stroke={COLORS.wire} stroke-width={4} stroke-linecap="round" />
        <line x1={mx(xC)} y1={yB} x2={mx(xO)} y2={yB} stroke={COLORS.wire} stroke-width={4} stroke-linecap="round" />
        <VResistor x={mx(xC)} y1={yT} y2={yB} />
        <Label x={mx(xC) + (closedSide === 'left' ? -30 : 30)} y={(yT + yB) / 2} size={17} color={COLORS.ink}>
          R
        </Label>
        <line x1={rx} y1={yT - 18} x2={rx} y2={yB + 18} stroke={COLORS.ink} stroke-width={9} stroke-linecap="round" />
        <Vector x={rx} y={vy} dir={v} color={COLORS.v} symbol="v" gap={vgap} length={vlen} />
        <SubLabel x={rx} y={ly} sym={sym} color={lcolor} unknown />
      </Diagram>
    )
    const grows = change > 0
    const rot = loopRotation(bInd) as 'cw' | 'ccw'
    const explanation = (
      <>
        The rod moves {grows ? 'away from' : 'toward'} the resistor, so the circuit's area — and the flux{' '}
        {fieldWord(field)} through it — is {grows ? 'increasing' : 'decreasing'}. The induced <Q k="B">B</Q> inside the
        circuit points {DIR_PHRASE[bInd]} ({grows ? 'opposing' : 'supporting'} the original). Point your right thumb{' '}
        {DIR_PHRASE[bInd]}: your fingers curl {ROT_WORD[rot]}. The rod is the {rodSide} side of the circuit, so the current
        runs <Q k="I">{DIR_PHRASE[iRod]}</Q> through the rod.
        {ask === 'force' ? (
          <>
            {' '}
            Then <Q k="F">F</Q> = <Q k="I">I</Q>L × <Q k="B">B</Q>: fingers {DIR_PHRASE[iRod]}, curl {fieldWord(field)}, thumb{' '}
            {DIR_PHRASE[force]}. The force always opposes <Q k="v">v</Q> — a magnetic drag.
          </>
        ) : null}
      </>
    )
    return {
      typeId: 'lenz-sliding-rod',
      prompt:
        ask === 'current' ? (
          <>
            The rod slides {DIR_PHRASE[v]} along the rails in a field <Q k="B">B</Q> {fieldWord(field)}. Which way does the
            induced current <Q k="I">I</Q> flow through the rod?
          </>
        ) : (
          <>
            The rod slides {DIR_PHRASE[v]} along the rails in a field <Q k="B">B</Q> {fieldWord(field)}. What is the direction
            of the magnetic force <Q k="F">F</Q> on the rod from its induced current?
          </>
        ),
      diagram,
      choices: ask === 'current' ? dirChoices({ only: ['up', 'down'] }) : dirChoices(),
      answer,
      explanation,
      hint:
        ask === 'current' ? (
          <>Is the area enclosed by the rails, rod and resistor growing or shrinking?</>
        ) : (
          <>Lenz's law says the induced effects fight the motion that causes them.</>
        ),
      facts: { field, closedSide, v, ask, currentInRod: iRod, force },
    }
  },
}

// ---------------------------------------------------------------------------
// 4. lenz-magnet-coil
// ---------------------------------------------------------------------------

const magnetCoil: ProblemType = {
  id: 'lenz-magnet-coil',
  category: 'induction',
  title: 'Magnet and loop',
  skill: 'Find the induced current in a loop as a bar magnet approaches or recedes.',
  generate(rng) {
    const magnetSide = rng.pick(['left', 'right'] as const)
    const facingPole = rng.pick(['N', 'S'] as const)
    const motion = rng.pick(['toward', 'away'] as const)
    const turns = rng.pick([1, 3] as const)
    const toCoil = opposite(magnetSide) as 'left' | 'right'
    // field lines leave N and enter S: at the coil, B points away from a facing N, toward a facing S
    const flux: Dir = facingPole === 'N' ? toCoil : magnetSide
    const change: Change = motion === 'toward' ? 1 : -1
    const bInd = inducedField(flux, change)!
    // near side is +z: current d there gives axial field cross(out, d)
    const near = (['up', 'down'] as const).find((d) => crossDir('out', d) === bInd)!

    // ---- diagram ----
    const mx = (x: number) => (magnetSide === 'left' ? x : 680 - x)
    const cy = 152
    const coilCx = mx(470)
    const magCx = mx(196)
    const L = 176
    const T = 50
    const north = facingPole === 'N' ? toCoil : magnetSide
    const vDir: 'left' | 'right' = motion === 'toward' ? toCoil : magnetSide
    const [vx] = screenStep(vDir)
    const vlen = 84
    const coil = { cx: coilCx, rx: 24, turns, pitch: 32 }
    const ixx = sideCoilRight(coil) + 12
    const loopWord = turns === 1 ? 'loop' : 'coil'
    const diagram = (
      <Diagram
        height={300}
        title="Bar magnet near a loop"
        desc={`A bar magnet on the ${magnetSide} with its ${facingPole} pole facing a ${loopWord}, moving ${motion === 'toward' ? 'toward' : 'away from'} it.`}
      >
        <line x1={20} y1={cy} x2={660} y2={cy} stroke={COLORS.muted} stroke-width={1.25} stroke-dasharray="2 6" />
        <BarMagnet cx={magCx} cy={cy} length={L} thickness={T} north={north} />
        <Vector x={magCx - (vx * vlen) / 2} y={cy - T / 2 - 34} dir={vDir} color={COLORS.v} symbol="v" length={vlen} />
        <SideCoil cx={coilCx} cy={cy} rx={24} ry={86} turns={turns} pitch={32} />
        <SubLabel x={ixx} y={cy - 44} sym="I" color={COLORS.I} unknown anchor="start" />
        <Caption y={276}>Solid = near side of the {loopWord} (toward you) · dashed = far side</Caption>
      </Diagram>
    )
    const pole = facingPole
    // like pole faces an approaching magnet (repel); unlike pole faces a retreating one (attract)
    const facePole = motion === 'toward' ? facingPole : facingPole === 'N' ? 'S' : 'N'
    return {
      typeId: 'lenz-magnet-coil',
      prompt: (
        <>
          The magnet moves {motion === 'toward' ? 'toward' : 'away from'} the {loopWord} with its <b>{pole}</b> pole facing it.
          Which way does the induced current flow on the near (solid) side of the {loopWord}?
        </>
      ),
      diagram,
      choices: dirChoices({ only: ['up', 'down'] }),
      answer: near,
      explanation: (
        <>
          Field lines leave N and enter S, so at the {loopWord} the magnet's <Q k="B">B</Q> points {DIR_PHRASE[flux]}, and it
          is getting {change > 0 ? 'stronger as the magnet approaches' : 'weaker as the magnet leaves'}. The induced{' '}
          <Q k="B">B</Q> points {DIR_PHRASE[bInd]} along the axis ({change > 0 ? 'opposing' : 'supporting'} it) — the{' '}
          {loopWord}'s face toward the magnet becomes {facePole === 'N' ? 'an N' : 'an S'} pole to{' '}
          {change > 0 ? 'repel' : 'attract'} it. Point your right thumb {DIR_PHRASE[bInd]} along the axis and curl your
          fingers: on the near (solid) side, the side toward you, they point <Q k="I">{DIR_PHRASE[near]}</Q>.
        </>
      ),
      hint: (
        <>
          {change > 0 ? 'An approaching' : 'A retreating'} magnet: the {loopWord} {change > 0 ? 'repels it' : 'pulls it back'}.
          Which pole must the {loopWord}'s face become?
        </>
      ),
      facts: { magnetSide, facingPole, motion, turns, nearCurrent: near },
    }
  },
}

// ---------------------------------------------------------------------------
// 5. lenz-wire-nearby
// ---------------------------------------------------------------------------

const wireNearby: ProblemType = {
  id: 'lenz-wire-nearby',
  category: 'induction',
  title: 'Loop next to a wire',
  skill: 'Use the grip rule for a wire, then Lenz’s law as its current changes.',
  generate(rng) {
    const wireAxis = rng.pick(['horizontal', 'vertical'] as const)
    const current: InPlane = wireAxis === 'horizontal' ? rng.pick(['left', 'right'] as const) : rng.pick(['up', 'down'] as const)
    const loopSide: InPlane = wireAxis === 'horizontal' ? rng.pick(['up', 'down'] as const) : rng.pick(['left', 'right'] as const)
    const changeSign: Change = rng.pick([1, -1] as const)
    // grip rule: B at a point displaced r̂ from the wire is along I × r̂
    const flux = toDir(cross(vec(current), vec(loopSide)))!
    const answer = loopRotation(inducedField(flux, changeSign))
    const trend = trendOf(changeSign)

    // ---- diagram ----
    let body: JSX.Element
    let H: number
    if (wireAxis === 'horizontal') {
      // canonical: wire on top, loop below
      H = 320
      const fy = (y: number) => (loopSide === 'down' ? y : H - y)
      const wy = fy(84)
      const loopTop = fy(140)
      const loopBot = fy(290)
      const ly = Math.min(loopTop, loopBot)
      const farY = loopSide === 'down' ? wy - 30 : wy + 30
      body = (
        <>
          <Wire x1={24} y1={wy} x2={656} y2={wy} current={current === 'right' ? 'forward' : 'backward'} arrowAt={0.4} />
          <VecLabel x={260} y={farY} symbol="I" color={COLORS.I} />
          <TrendBadge x={470} y={loopSide === 'down' ? wy - 40 : wy + 40} sym="I" trend={trend} color={COLORS.I} />
          <RectLoop x={220} y={ly} w={240} h={150} />
          <SubLabel x={474} y={ly + 75} sym="I" sub="ind" color={COLORS.I} unknown anchor="start" />
        </>
      )
    } else {
      // canonical: wire on the left, loop on the right
      H = 380
      const fx = (x: number) => (loopSide === 'right' ? x : 680 - x)
      const wx = fx(150)
      const lx = Math.min(fx(220), fx(440))
      const bw = trendBadgeW('I', trend)
      const badgeX = loopSide === 'right' ? 620 - bw / 2 : 60 + bw / 2
      body = (
        <>
          <Wire x1={wx} y1={22} x2={wx} y2={H - 22} current={current === 'down' ? 'forward' : 'backward'} arrowAt={0.5} />
          <VecLabel x={wx + (loopSide === 'right' ? -30 : 30)} y={H / 2} symbol="I" color={COLORS.I} />
          <TrendBadge x={badgeX} y={42} sym="I" trend={trend} color={COLORS.I} />
          <RectLoop x={lx} y={100} w={220} h={190} />
          <SubLabel
            x={loopSide === 'right' ? lx + 234 : lx - 14}
            y={195}
            sym="I"
            sub="ind"
            color={COLORS.I}
            unknown
            anchor={loopSide === 'right' ? 'start' : 'end'}
          />
        </>
      )
    }
    const diagram = (
      <Diagram
        height={H}
        title="Loop beside a long straight wire"
        desc={`A long straight wire carries current ${DIR_PHRASE[current]} that is ${trend}; a rectangular loop lies ${DIR_PHRASE[loopSide]} from it.`}
      >
        {body}
      </Diagram>
    )
    const rot = answer as 'cw' | 'ccw'
    return {
      typeId: 'lenz-wire-nearby',
      prompt: (
        <>
          The current <Q k="I">I</Q> in the long wire is <b>{trend}</b>. Which way does the induced current flow in the loop, as
          seen looking at the page?
        </>
      ),
      diagram,
      choices: ROTATION_CHOICES,
      answer,
      explanation: (
        <>
          Grip the wire with your right thumb along <Q k="I">I</Q> ({DIR_PHRASE[current]}): on the loop's side your fingers
          point {fieldWord(flux as 'in' | 'out')}. As <Q k="I">I</Q> is {trend}, that flux is {trend} too, so the induced{' '}
          <Q k="B">B</Q> points {DIR_PHRASE[inducedField(flux, changeSign)!]}. Thumb that way and curl: <b>{ROT_WORD[rot]}</b>.
        </>
      ),
      hint: <>First find the wire's field at the loop with the right-hand grip rule — is it into or out of the page there?</>,
      facts: { wireAxis, current, loopSide, change: trend, changeSign },
    }
  },
}

// ---------------------------------------------------------------------------
// 6. lenz-induced-field
// ---------------------------------------------------------------------------

const inducedFieldType: ProblemType = {
  id: 'lenz-induced-field',
  category: 'induction',
  title: 'Direction of the induced field',
  skill: 'Decide whether the induced field opposes, supports, or is zero.',
  generate(rng): Problem {
    const choices = [...dirChoices({ only: ['out', 'in'] }), ZERO_CHOICE]
    if (rng.chance(0.5)) {
      const s = genFluxSetup(rng)
      const b = inducedField(s.field, s.changeSign)
      return {
        typeId: 'lenz-induced-field',
        prompt: (
          <>
            The uniform <Q k="B">B</Q> field ({fieldWord(s.field)}) is <b>{s.change}</b>. What is the direction of the{' '}
            <i>induced</i> magnetic field at the center of the loop?
          </>
        ),
        diagram: fluxDiagram(s, 'field'),
        choices,
        answer: b ?? 'zero',
        explanation: (
          <>
            {fluxWhy(s)}
            {lenzSteps(s.field, s.changeSign, 'field')}
            {b ? null : ' So the induced field is zero.'}
          </>
        ),
        hint: <>The induced field opposes the <i>change</i> in flux — not necessarily the field itself.</>,
        facts: { setup: 'flux', field: s.field, change: s.change, changeSign: s.changeSign, shape: s.shape },
      }
    }
    const s = genMoveSetup(rng)
    const c = moveChange(s)
    const b = inducedField(s.field, c)
    return {
      typeId: 'lenz-induced-field',
      prompt: (
        <>
          The loop moves with velocity <Q k="v">v</Q> near a region of field <Q k="B">B</Q> ({fieldWord(s.field)}). At this
          instant, what is the direction of the <i>induced</i> magnetic field inside the loop?
        </>
      ),
      diagram: moveDiagram(s, 'field'),
      choices,
      answer: b ?? 'zero',
      explanation: (
        <>
          {moveWhy(s)}
          {lenzSteps(s.field, c, 'field')}
          {b ? null : ' So the induced field is zero.'}
        </>
      ),
      hint: <>Is the flux through the loop growing, shrinking, or staying the same?</>,
      facts: { setup: 'moving', field: s.field, fieldSide: s.fieldSide, position: s.position, v: s.v, u: s.u, half: s.half },
    }
  },
}

export const lenzTypes: ProblemType[] = [fluxChange, loopMoving, slidingRod, magnetCoil, wireNearby, inducedFieldType]
