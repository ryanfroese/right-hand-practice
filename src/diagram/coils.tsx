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
 *
 * Physics (page coords, near side at +z): if near-side current flows in page
 * direction d (up/down), B inside = cross(out, d). Near-side current up → B left.
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

export interface SolenoidProps {
  /** center x of the coil body */
  cx: number
  /** y of the coil axis */
  cy: number
  /** number of turns (5–8 looks best) */
  turns: number
  /** half-height of each turn (ellipse ry) */
  radius?: number
  /** half-width of each turn's ellipse (oblique foreshortening) */
  rx?: number
  /** spacing between turns */
  pitch?: number
  /** which side the two lead wires leave from */
  leads?: 'top' | 'bottom'
  /** 'forward' = current enters at the LEFT lead and leaves at the right lead */
  current?: 'forward' | 'backward' | 'none'
  /** label for the current on the left lead, e.g. "I"; unknownCurrent adds " = ?" */
  currentLabel?: string
  unknownCurrent?: boolean
  leadLength?: number
  /** draw the near/far caption this far below the lowest coil element (default: no caption) */
  captionY?: number
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
  /** page direction of the current on the near (solid) side, null if no current */
  nearCurrent: 'up' | 'down' | null
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

/**
 * Geometry of a Solenoid with the same props. The near-side current direction
 * is read off the drawing: with leads on top and forward current, the wire
 * runs down each near arc (top → right → bottom).
 */
export function solenoidGeometry(p: SolenoidProps): SolenoidGeometry {
  const { R, rx, pitch, leads, cur, L } = defaults(p)
  const n = p.turns
  const bodyW = n * pitch
  const x0 = p.cx - bodyW / 2
  const loopX = Array.from({ length: n }, (_, i) => x0 + i * pitch)
  const left = x0
  const right = x0 + bodyW
  const leadY = leads === 'top' ? p.cy - R : p.cy + R
  let nearCurrent: 'up' | 'down' | null = null
  if (cur !== 'none') {
    const downWhenForward = leads === 'top'
    nearCurrent = (cur === 'forward') === downWhenForward ? 'down' : 'up'
  }
  return {
    joinX: loopX.map((x) => x + rx),
    loopX,
    left,
    right,
    axisLeft: Math.min(x0 + rx, x0 + pitch / 2 - rx),
    axisRight: loopX[n - 1] + rx,
    top: p.cy - R,
    bottom: p.cy + R,
    leadY,
    leftLeadEnd: left - L,
    rightLeadEnd: right + L,
    nearCurrent,
    R,
    rx,
    pitch,
  }
}

export function Solenoid(props: SolenoidProps) {
  const { R, rx, pitch, leads, cur } = defaults(props)
  const g = solenoidGeometry(props)
  const { cy } = props
  // reflect about the axis when the leads are at the bottom
  const flip = leads === 'bottom'
  const Y = (y: number) => (flip ? 2 * cy - y : y)
  const sweep = flip ? 0 : 1
  const wireW = STROKE.wire
  const near: JSX.Element[] = []
  const halos: JSX.Element[] = []
  const far: JSX.Element[] = []
  const heads: JSX.Element[] = []
  const marks: JSX.Element[] = []

  g.loopX.forEach((x, i) => {
    // near half: two quarter arcs, top → join → bottom (before reflection)
    const d = `M ${f(x)} ${f(Y(cy - R))} A ${rx} ${R} 0 0 ${sweep} ${f(x + rx)} ${f(cy)} A ${rx} ${R} 0 0 ${sweep} ${f(x)} ${f(Y(cy + R))}`
    halos.push(<path key={`h${i}`} d={d} fill="none" stroke={COLORS.paper} stroke-width={wireW + 7} stroke-linecap="butt" />)
    if (i === props.markTurn) {
      marks.push(<path key="mk" d={d} fill="none" stroke={COLORS.I} stroke-opacity={0.35} stroke-width={wireW + 9} stroke-linecap="round" />)
      // leader from the callout (free side) to a point low on the front arc
      const t = 2.45
      const ax = x + rx * Math.sin(t)
      const ay = Y(cy - R * Math.cos(t))
      const ty = Y(cy + R + 34)
      marks.push(
        <line key="ml" x1={f(ax)} y1={f(ay + (flip ? -6 : 6))} x2={f(ax + 26)} y2={f(ty + (flip ? 12 : -12))} stroke={COLORS.I} stroke-width={2} />,
      )
      marks.push(<VecLabel key="mt" x={ax + 26} y={ty} symbol="I" color={COLORS.I} unknown anchor="start" />)
      marks.push(
        <Label key="ms" x={ax + 26} y={ty + (flip ? -24 : 24)} size={FONT.small} weight={500} color={COLORS.ink} anchor="start">
          front wire (closest to you)
        </Label>,
      )
    }
    near.push(<path key={`n${i}`} d={d} fill="none" stroke={COLORS.wire} stroke-width={wireW} stroke-linecap="round" />)
    // far half: sheared half-ellipse from bottom of turn i to top of turn i+1
    const pts: string[] = []
    const steps = 28
    for (let k = 0; k <= steps; k++) {
      const u = (Math.PI * k) / steps
      const px = x + (pitch * u) / Math.PI - rx * Math.sin(u)
      const py = cy + R * Math.cos(u)
      pts.push(`${f(px)},${f(Y(py))}`)
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
    if (g.nearCurrent) {
      const uy = g.nearCurrent === 'down' ? 1 : -1
      const size = 17
      heads.push(<ArrowHead key={`a${i}`} x={x + rx} y={cy + uy * size * 0.5} ux={0} uy={uy} color={COLORS.I} size={size} />)
    }
  })

  // lead wires (horizontal), with terminals
  const ly = g.leadY
  const leadEls = [
    <line key="ll" x1={g.leftLeadEnd} y1={ly} x2={g.left} y2={ly} stroke={COLORS.wire} stroke-width={wireW} stroke-linecap="round" />,
    <line key="rl" x1={g.right} y1={ly} x2={g.rightLeadEnd} y2={ly} stroke={COLORS.wire} stroke-width={wireW} stroke-linecap="round" />,
    <circle key="lt" cx={g.leftLeadEnd} cy={ly} r={5} fill={COLORS.paper} stroke={COLORS.wire} stroke-width={2.5} />,
    <circle key="rt" cx={g.rightLeadEnd} cy={ly} r={5} fill={COLORS.paper} stroke={COLORS.wire} stroke-width={2.5} />,
  ]
  if (cur !== 'none') {
    const ux = cur === 'forward' ? 1 : -1
    const size = 17
    const lm = (g.leftLeadEnd + g.left) / 2
    const rm = (g.right + g.rightLeadEnd) / 2
    leadEls.push(<ArrowHead key="la" x={lm + ux * size * 0.5} y={ly} ux={ux} uy={0} color={COLORS.I} size={size} />)
    leadEls.push(<ArrowHead key="ra" x={rm + ux * size * 0.5} y={ly} ux={ux} uy={0} color={COLORS.I} size={size} />)
  }
  const labelY = ly + (flip ? 24 : -24)
  const labelX = (g.leftLeadEnd + g.left) / 2

  return (
    <g>
      {props.showAxis ? (
        <g stroke={COLORS.muted} stroke-width={STROKE.guide} stroke-dasharray="3 5">
          <line x1={g.axisLeft - 34} y1={cy} x2={g.axisLeft - 6} y2={cy} />
          <line x1={g.axisRight + 6} y1={cy} x2={g.axisRight + 34} y2={cy} />
        </g>
      ) : null}
      {far}
      {halos}
      {marks.filter((m) => m.key === 'mk')}
      {near}
      {leadEls}
      {heads}
      {props.currentLabel ? (
        <VecLabel x={labelX} y={labelY} symbol={props.currentLabel} color={COLORS.I} unknown={props.unknownCurrent} />
      ) : null}
      {marks.filter((m) => m.key !== 'mk')}
      {props.captionY !== undefined ? <Caption y={props.captionY}>{NEAR_FAR_CAPTION}</Caption> : null}
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
