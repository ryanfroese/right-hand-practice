/**
 * Coil drawings: a flat current Loop (lying in the page), a side-on Solenoid,
 * and a Compass.
 *
 * SOLENOID VIEW CONVENTION (oblique side view, axis horizontal)
 * ------------------------------------------------------------
 * The coil is a single helix of wire. We look at it from slightly off-axis so
 * every turn projects to a tall narrow ellipse:
 *
 *   - the RIGHT half of each ellipse is the NEAR side (toward the viewer, +z):
 *     drawn SOLID, as two quarter-arcs that meet at the turn's outermost
 *     (rightmost) point, where the tangent is exactly vertical. The current
 *     arrowhead (amber) sits on that join, so near-side current is always
 *     plainly "up the page" or "down the page".
 *   - the LEFT half of each turn is the FAR side (away from the viewer, −z):
 *     drawn DASHED. It is sheared by one pitch so it climbs from the bottom of
 *     turn i to the top of turn i+1 (that's what makes it a helix). Where a far
 *     segment passes behind a near arc, the near arc's paper-colored halo
 *     breaks it, so the near side visibly occludes the far side.
 *   - both lead wires leave horizontally from the same side (top or bottom).
 *   - orient 'v' turns the whole drawing a quarter-turn (see SolenoidOrient).
 *
 * Physics (page coords, near side at +z): if near-side current flows in page
 * direction d, B inside = cross(out, d). Near-side current up → B left;
 * near-side current right (upright coil) → B up.
 * (That math lives in the problem generators; this file only draws.)
 */
import type { JSX } from 'preact'
import { COLORS, FONT, STROKE } from '../theme'
import type { Dir } from '../physics/vec'
import { ArrowHead, Caption, Label, VecLabel } from './primitives'

export const NEAR_FAR_CAPTION = 'Solid = near side (toward you) · dashed = far side'

const f = (n: number) => Math.round(n * 100) / 100

// ---------------------------------------------------------------------------
// Solenoid
// ---------------------------------------------------------------------------

/**
 * 'h' = axis left–right (the classic side view). 'v' = the same drawing turned
 * a quarter-turn clockwise about (cx, cy): the axis runs up–down, the side-view
 * LEFT end is at the TOP, and the side-view top leads come out on the RIGHT.
 * Everything is laid out in side-view coordinates and mapped through `P`, so
 * the two orientations can never disagree about which way the wire goes.
 */
export type SolenoidOrient = 'h' | 'v'

export interface SolenoidProps {
  /** screen center of the coil body */
  cx: number
  /** screen y of the coil center (the axis, for 'h') */
  cy: number
  orient?: SolenoidOrient
  /** number of turns (5–8 looks best) */
  turns: number
  /** half-height of each turn (ellipse ry) */
  radius?: number
  /** half-width of each turn's ellipse (oblique foreshortening) */
  rx?: number
  /** spacing between turns */
  pitch?: number
  /** which side (in side-view terms) the two lead wires leave from */
  leads?: 'top' | 'bottom'
  /** 'forward' = current enters at the side-view LEFT lead and leaves at the right lead */
  current?: 'forward' | 'backward' | 'none'
  /** label for the current on the first lead, e.g. "I"; unknownCurrent adds " = ?" */
  currentLabel?: string
  unknownCurrent?: boolean
  leadLength?: number
  /** draw the near/far caption at this SCREEN y (default: no caption) */
  captionY?: number
  /** caption center x (default: center of the 680 canvas) */
  captionX?: number
  /** short dashed axis stubs just outside each end of the body */
  showAxis?: boolean
  /**
   * Point at the front (near, solid) wire of this turn: tint it in the current
   * color and hang an "I = ?" callout off it on the side away from the leads.
   * Use this instead of `currentLabel` when asking which way the near-side
   * current runs, so the question names one specific piece of wire.
   */
  markTurn?: number
}

export interface SolenoidGeometry {
  orient: SolenoidOrient
  /** side-view → screen */
  P: (x: number, y: number) => [number, number]
  /** side-view screen direction → screen direction */
  D: (ux: number, uy: number) => [number, number]
  /** the rest is in SIDE-VIEW coordinates (map with P before drawing) */
  /** x of the vertical-tangent join (rightmost point) of each near arc */
  joinX: number[]
  /** x of the top/bottom points of each turn */
  loopX: number[]
  /** coil body extent along the axis */
  left: number
  right: number
  /** where the coil wire actually crosses the axis line at each end (for things placed on the axis) */
  axisLeft: number
  axisRight: number
  top: number
  bottom: number
  /** y of the lead wires */
  leadY: number
  leftLeadEnd: number
  rightLeadEnd: number
  /** PAGE direction of the current on the near (solid) side, null if no current */
  nearCurrent: Dir | null
  /** PAGE direction from the side-view left end toward the right end (along the axis) */
  axisDir: Dir
  R: number
  rx: number
  pitch: number
}

function defaults(p: SolenoidProps) {
  const R = p.radius ?? 70
  const rx = p.rx ?? Math.round(R * 0.36)
  const pitch = p.pitch ?? 48
  const leads = p.leads ?? 'top'
  const cur = p.current ?? 'forward'
  const L = p.leadLength ?? 62
  return { R, rx, pitch, leads, cur, L }
}

/** Screen direction → page direction (screen y is down). */
export function screenToDir(ux: number, uy: number): Dir {
  if (Math.abs(ux) > Math.abs(uy)) return ux > 0 ? 'right' : 'left'
  return uy > 0 ? 'down' : 'up'
}

/**
 * Geometry of a Solenoid with the same props. The near-side current direction
 * is read off the drawing: with leads on top and forward current, the wire
 * runs down each near arc (top → right → bottom), before orientation.
 */
export function solenoidGeometry(p: SolenoidProps): SolenoidGeometry {
  const { R, rx, pitch, leads, cur, L } = defaults(p)
  const orient = p.orient ?? 'h'
  const { cx, cy } = p
  const P = (x: number, y: number): [number, number] => (orient === 'h' ? [x, y] : [cx - (y - cy), cy + (x - cx)])
  const D = (ux: number, uy: number): [number, number] => (orient === 'h' ? [ux, uy] : [-uy, ux])
  const n = p.turns
  const bodyW = n * pitch
  const x0 = cx - bodyW / 2
  const loopX = Array.from({ length: n }, (_, i) => x0 + i * pitch)
  const left = x0
  const right = x0 + bodyW
  const leadY = leads === 'top' ? cy - R : cy + R
  let nearCurrent: Dir | null = null
  if (cur !== 'none') {
    const downWhenForward = leads === 'top'
    const down = (cur === 'forward') === downWhenForward
    nearCurrent = screenToDir(...D(0, down ? 1 : -1))
  }
  return {
    orient,
    P,
    D,
    joinX: loopX.map((x) => x + rx),
    loopX,
    left,
    right,
    axisLeft: Math.min(x0 + rx, x0 + pitch / 2 - rx),
    axisRight: loopX[n - 1] + rx,
    top: cy - R,
    bottom: cy + R,
    leadY,
    leftLeadEnd: left - L,
    rightLeadEnd: right + L,
    nearCurrent,
    axisDir: screenToDir(...D(1, 0)),
    R,
    rx,
    pitch,
  }
}

export function Solenoid(props: SolenoidProps) {
  const { R, rx, pitch, leads, cur } = defaults(props)
  const g = solenoidGeometry(props)
  const { cy } = props
  const { P, D } = g
  const vert = g.orient === 'v'
  // reflect about the axis when the leads are at the bottom
  const flip = leads === 'bottom'
  const Y = (y: number) => (flip ? 2 * cy - y : y)
  const sweep = flip ? 0 : 1
  const arcRot = vert ? 90 : 0
  const pt = (x: number, y: number) => P(x, y).map(f).join(' ')
  const wireW = STROKE.wire
  const near: JSX.Element[] = []
  const halos: JSX.Element[] = []
  const far: JSX.Element[] = []
  const heads: JSX.Element[] = []
  const tint: JSX.Element[] = []
  const callout: JSX.Element[] = []
  const head = (key: string, x: number, y: number, ux: number, uy: number, size: number) => {
    const [sx, sy] = P(x, y)
    const [dx, dy] = D(ux, uy)
    return <ArrowHead key={key} x={sx} y={sy} ux={dx} uy={dy} color={COLORS.I} size={size} />
  }

  g.loopX.forEach((x, i) => {
    // near half: two quarter arcs, top → join → bottom (before reflection)
    const d = `M ${pt(x, Y(cy - R))} A ${rx} ${R} ${arcRot} 0 ${sweep} ${pt(x + rx, cy)} A ${rx} ${R} ${arcRot} 0 ${sweep} ${pt(x, Y(cy + R))}`
    halos.push(<path key={`h${i}`} d={d} fill="none" stroke={COLORS.paper} stroke-width={wireW + 7} stroke-linecap="butt" />)
    if (i === props.markTurn) {
      tint.push(<path key="mk" d={d} fill="none" stroke={COLORS.I} stroke-opacity={0.35} stroke-width={wireW + 9} stroke-linecap="round" />)
      // leader from the callout (free side, away from the leads) to a point low on the front arc
      const t = 2.45
      const [ax, ay] = P(x + rx * Math.sin(t), Y(cy - R * Math.cos(t)))
      const [tx, ty] = P(x + rx * Math.sin(t) + 26, Y(cy + R + 34))
      if (!vert) {
        const s = flip ? -1 : 1
        callout.push(<line key="ml" x1={f(ax)} y1={f(ay + 6 * s)} x2={f(tx)} y2={f(ty - 12 * s)} stroke={COLORS.I} stroke-width={2} />)
        callout.push(<VecLabel key="mt" x={tx} y={ty} symbol="I" color={COLORS.I} unknown anchor="start" />)
        callout.push(
          <Label key="ms" x={tx} y={ty + 24 * s} size={FONT.small} weight={500} color={COLORS.ink} anchor="start">
            front wire (closest to you)
          </Label>,
        )
      } else {
        // free side is left or right of the upright coil; text reads away from the coil
        const s = tx > props.cx ? 1 : -1
        const anchor = s > 0 ? 'start' : 'end'
        callout.push(<line key="ml" x1={f(ax + 6 * s)} y1={f(ay)} x2={f(tx - 6 * s)} y2={f(ty)} stroke={COLORS.I} stroke-width={2} />)
        callout.push(<VecLabel key="mt" x={tx} y={ty - 12} symbol="I" color={COLORS.I} unknown anchor={anchor} />)
        callout.push(
          <Label key="ms" x={tx} y={ty + 14} size={FONT.small} weight={500} color={COLORS.ink} anchor={anchor}>
            front wire
          </Label>,
        )
        callout.push(
          <Label key="ms2" x={tx} y={ty + 33} size={FONT.small} weight={500} color={COLORS.ink} anchor={anchor}>
            (closest to you)
          </Label>,
        )
      }
    }
    near.push(<path key={`n${i}`} d={d} fill="none" stroke={COLORS.wire} stroke-width={wireW} stroke-linecap="round" />)
    // far half: sheared half-ellipse from bottom of turn i to top of turn i+1
    const pts: string[] = []
    const steps = 28
    for (let k = 0; k <= steps; k++) {
      const u = (Math.PI * k) / steps
      const px = x + (pitch * u) / Math.PI - rx * Math.sin(u)
      const py = cy + R * Math.cos(u)
      pts.push(P(px, Y(py)).map(f).join(','))
    }
    far.push(
      <polyline
        key={`f${i}`}
        points={pts.join(' ')}
        fill="none"
        stroke={COLORS.muted}
        stroke-width={2.5}
        stroke-dasharray="7 6"
        stroke-linecap="round"
      />,
    )
    if (cur !== 'none') {
      // arrow along the near arc at its join, in the direction the current runs there (side view: up/down)
      const down = (cur === 'forward') === (leads === 'top')
      const uy = down ? 1 : -1
      const size = 17
      heads.push(head(`a${i}`, x + rx, cy + uy * size * 0.5, 0, uy, size))
    }
  })

  // lead wires (along the axis), with terminals
  const ly = g.leadY
  const seg = (key: string, x1: number, x2: number) => {
    const [a, b] = P(x1, ly)
    const [c, d] = P(x2, ly)
    return <line key={key} x1={f(a)} y1={f(b)} x2={f(c)} y2={f(d)} stroke={COLORS.wire} stroke-width={wireW} stroke-linecap="round" />
  }
  const term = (key: string, x: number) => {
    const [a, b] = P(x, ly)
    return <circle key={key} cx={f(a)} cy={f(b)} r={5} fill={COLORS.paper} stroke={COLORS.wire} stroke-width={2.5} />
  }
  const leadEls = [seg('ll', g.leftLeadEnd, g.left), seg('rl', g.right, g.rightLeadEnd), term('lt', g.leftLeadEnd), term('rt', g.rightLeadEnd)]
  if (cur !== 'none') {
    const ux = cur === 'forward' ? 1 : -1
    const size = 17
    const lm = (g.leftLeadEnd + g.left) / 2
    const rm = (g.right + g.rightLeadEnd) / 2
    leadEls.push(head('la', lm + ux * size * 0.5, ly, ux, 0, size))
    leadEls.push(head('ra', rm + ux * size * 0.5, ly, ux, 0, size))
  }
  let label: JSX.Element | null = null
  if (props.currentLabel) {
    const lx = (g.leftLeadEnd + g.left) / 2
    if (!vert) {
      label = <VecLabel x={lx} y={ly + (flip ? 24 : -24)} symbol={props.currentLabel} color={COLORS.I} unknown={props.unknownCurrent} />
    } else {
      // beside the (now vertical) lead, on the side away from the coil
      const [sx, sy] = P(lx, ly + (flip ? 14 : -14))
      label = <VecLabel x={sx} y={sy} symbol={props.currentLabel} color={COLORS.I} unknown={props.unknownCurrent} anchor={sx > props.cx ? 'start' : 'end'} />
    }
  }
  const stub = (x1: number, x2: number) => {
    const [a, b] = P(x1, cy)
    const [c, d] = P(x2, cy)
    return <line x1={f(a)} y1={f(b)} x2={f(c)} y2={f(d)} />
  }

  return (
    <g>
      {props.showAxis ? (
        <g stroke={COLORS.muted} stroke-width={STROKE.guide} stroke-dasharray="3 5">
          {stub(g.axisLeft - 34, g.axisLeft - 6)}
          {stub(g.axisRight + 6, g.axisRight + 34)}
        </g>
      ) : null}
      {far}
      {halos}
      {tint}
      {near}
      {leadEls}
      {heads}
      {label}
      {callout}
      {props.captionY !== undefined ? <Caption x={props.captionX} y={props.captionY}>{NEAR_FAR_CAPTION}</Caption> : null}
    </g>
  )
}

// ---------------------------------------------------------------------------
// Flat loop in the page
// ---------------------------------------------------------------------------

const ANGLE: Record<'right' | 'up' | 'left' | 'down', number> = { right: 0, up: 90, left: 180, down: 270 }

/** Page angle (deg, ccw from +x) → screen point on a circle (screen y is down). */
const onCircle = (cx: number, cy: number, r: number, deg: number): [number, number] => {
  const t = (deg * Math.PI) / 180
  return [cx + r * Math.cos(t), cy - r * Math.sin(t)]
}

export interface LoopProps {
  cx: number
  cy: number
  r: number
  /** circulation as seen looking at the page */
  current: 'cw' | 'ccw' | 'none'
  /** where the lead gap is; leads run outward from there */
  gapAt?: 'right' | 'up' | 'left' | 'down'
  leadLength?: number
  /** label for the current; placed outside the loop opposite the gap */
  currentLabel?: string
  unknownCurrent?: boolean
}

/** Screen position + text anchor for the current label: just outside the loop, opposite the gap. */
export function loopLabelPos(p: { cx: number; cy: number; r: number; gapAt?: LoopProps['gapAt'] }): { x: number; y: number; anchor: 'start' | 'middle' | 'end' } {
  const side = OPPOSITE[p.gapAt ?? 'down']
  const [x, y] = onCircle(p.cx, p.cy, p.r + (side === 'up' || side === 'down' ? 30 : 24), ANGLE[side])
  return { x, y, anchor: side === 'right' ? 'start' : side === 'left' ? 'end' : 'middle' }
}

const OPPOSITE = { right: 'left', left: 'right', up: 'down', down: 'up' } as const

export function Loop(props: LoopProps) {
  const { cx, cy, r } = props
  const gapDir = props.gapAt ?? 'down'
  const gap = ANGLE[gapDir]
  const L = props.leadLength ?? 56
  const halfSep = 11
  const delta = (Math.asin(halfSep / r) * 180) / Math.PI
  const [ax, ay] = onCircle(cx, cy, r, gap + delta) // arc start (ccw side of the gap)
  const [bx, by] = onCircle(cx, cy, r, gap - delta) // arc end
  // big arc from gap+δ all the way round (ccw on the page = sweep 0 in screen coords) to gap−δ
  const d = `M ${f(ax)} ${f(ay)} A ${r} ${r} 0 1 0 ${f(bx)} ${f(by)}`
  const ut = (gap * Math.PI) / 180
  const ux = Math.cos(ut)
  const uy = -Math.sin(ut) // outward unit (screen)
  const wireW = STROKE.wire
  const els: JSX.Element[] = [
    <path key="arc" d={d} fill="none" stroke={COLORS.wire} stroke-width={wireW} stroke-linecap="round" />,
    <line key="la" x1={ax} y1={ay} x2={ax + ux * L} y2={ay + uy * L} stroke={COLORS.wire} stroke-width={wireW} stroke-linecap="round" />,
    <line key="lb" x1={bx} y1={by} x2={bx + ux * L} y2={by + uy * L} stroke={COLORS.wire} stroke-width={wireW} stroke-linecap="round" />,
    <circle key="ta" cx={ax + ux * L} cy={ay + uy * L} r={5} fill={COLORS.paper} stroke={COLORS.wire} stroke-width={2.5} />,
    <circle key="tb" cx={bx + ux * L} cy={by + uy * L} r={5} fill={COLORS.paper} stroke={COLORS.wire} stroke-width={2.5} />,
  ]
  if (props.current !== 'none') {
    const s = props.current === 'ccw' ? 1 : -1
    const size = 18
    // arrowheads at the three axis points away from the gap, tangent to the loop
    for (const k of [1, 2, 3]) {
      const deg = gap + 90 * k
      const [px, py] = onCircle(cx, cy, r, deg)
      const t = (deg * Math.PI) / 180
      // page tangent for ccw: (−sin, cos) → screen (−sin, −cos)
      const tx = -Math.sin(t) * s
      const ty = -Math.cos(t) * s
      els.push(<ArrowHead key={`h${k}`} x={px + tx * size * 0.5} y={py + ty * size * 0.5} ux={tx} uy={ty} color={COLORS.I} size={size} />)
    }
    // lead arrows: ccw current enters on the gap+δ lead (inward) and leaves on the other
    const inX = s > 0 ? ax : bx
    const inY = s > 0 ? ay : by
    const outX = s > 0 ? bx : ax
    const outY = s > 0 ? by : ay
    const m = L * 0.55
    els.push(<ArrowHead key="li" x={inX + ux * (m - 8)} y={inY + uy * (m - 8)} ux={-ux} uy={-uy} color={COLORS.I} size={15} />)
    els.push(<ArrowHead key="lo" x={outX + ux * (m + 8)} y={outY + uy * (m + 8)} ux={ux} uy={uy} color={COLORS.I} size={15} />)
  }
  if (props.currentLabel) {
    const lp = loopLabelPos(props)
    els.push(<VecLabel key="lbl" x={lp.x} y={lp.y} anchor={lp.anchor} symbol={props.currentLabel} color={COLORS.I} unknown={props.unknownCurrent} />)
  }
  return <g>{els}</g>
}

/**
 * A solenoid seen END-ON: looking straight down its axis, so every turn lines
 * up into one circle. The near end is the solid Loop (with its current
 * arrows); the far end shows through as a smaller dashed circle (perspective),
 * which is what tells the student this is a tube coming at them.
 */
export function EndOnCoil(props: LoopProps) {
  return (
    <g>
      <circle cx={props.cx} cy={props.cy} r={props.r * 0.66} fill="none" stroke={COLORS.muted} stroke-width={2.5} stroke-dasharray="7 6" />
      <Loop {...props} />
    </g>
  )
}

export const END_ON_CAPTION = 'Looking straight down the coil · solid = near end · dashed = far end'

// ---------------------------------------------------------------------------
// Compass
// ---------------------------------------------------------------------------

/**
 * A small compass. With `dir` the needle (diamond, red = north tip) points that
 * in-plane direction; without it the housing shows "?".
 */
export function Compass(props: { x: number; y: number; r?: number; dir?: Dir | null; label?: string }) {
  const r = props.r ?? 24
  const { x, y } = props
  const ticks: JSX.Element[] = []
  for (let k = 0; k < 8; k++) {
    const t = (k * Math.PI) / 4
    const a = k % 2 === 0 ? r - 6 : r - 4
    ticks.push(
      <line
        key={k}
        x1={x + Math.cos(t) * a}
        y1={y + Math.sin(t) * a}
        x2={x + Math.cos(t) * (r - 1.5)}
        y2={y + Math.sin(t) * (r - 1.5)}
        stroke={COLORS.muted}
        stroke-width={1.5}
      />,
    )
  }
  let needle: JSX.Element | null = null
  const d = props.dir
  if (d && d !== 'in' && d !== 'out') {
    const [sx, sy] = d === 'right' ? [1, 0] : d === 'left' ? [-1, 0] : d === 'up' ? [0, -1] : [0, 1]
    const len = r - 7
    const w = 5.5
    const px = -sy
    const py = sx
    const tip = `${x + sx * len},${y + sy * len}`
    const tail = `${x - sx * len},${y - sy * len}`
    const s1 = `${x + px * w},${y + py * w}`
    const s2 = `${x - px * w},${y - py * w}`
    needle = (
      <g>
        <polygon points={`${tip} ${s1} ${s2}`} fill={COLORS.northPole} />
        <polygon points={`${tail} ${s1} ${s2}`} fill={COLORS.paper} stroke={COLORS.ink} stroke-width={1.25} stroke-linejoin="round" />
        <circle cx={x} cy={y} r={2} fill={COLORS.ink} />
      </g>
    )
  }
  return (
    <g>
      <circle cx={x} cy={y} r={r} fill={COLORS.paper} stroke={COLORS.ink} stroke-width={2} />
      {ticks}
      {needle ?? (
        <Label x={x} y={y + 1} size={FONT.label} color={COLORS.ink} weight={700}>
          ?
        </Label>
      )}
      {props.label ? (
        <Label x={x} y={y + r + 16} size={FONT.small} weight={500} color={COLORS.ink}>
          {props.label}
        </Label>
      ) : null}
    </g>
  )
}

/** Big pole letter (N red / S blue) used to mark the ends of a solenoid. */
export function PoleLetter(props: { x: number; y: number; pole: 'N' | 'S' | '?' }) {
  const c = props.pole === 'N' ? COLORS.northPole : props.pole === 'S' ? COLORS.southPole : COLORS.ink
  return (
    <Label x={props.x} y={props.y} size={28} weight={800} color={c}>
      {props.pole}
    </Label>
  )
}
