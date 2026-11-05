/**
 * Category-specific SVG parts for the moving-charges problems.
 *
 * Layout model: everything around a charge is placed in "slots" so nothing
 * overlaps. In-plane vectors use the four axis slots (arrows leave the charge
 * along their direction); ⊙/⊗ vectors, "X = ?" labels and the particle name
 * use the four diagonal slots. The layout also returns `avoid` circles so the
 * field grid / field lines drawn underneath skip everything placed here.
 */
import type { JSX } from 'preact'
import { COLORS, FONT, STROKE } from '../theme'
import { type Dir, isInPlane, screenStep } from '../physics/vec'
import { Arrow, ArrowHead, FieldGrid, FieldLines, InSymbol, Label, OutSymbol, VecLabel } from './primitives'

/** `bridge` marks filler circles that only exist to stop short orphan field-line stubs */
/** `gridOnly` avoids are honored by the × / • grid but not by field lines. */
export type Avoid = { x: number; y: number; r: number; bridge?: boolean; gridOnly?: boolean }
export type QKey = 'v' | 'B' | 'F'

export const CHARGE_R = 17
const GAP = CHARGE_R + 4
const ARROW_LEN = 90

type Diag = 'UR' | 'UL' | 'DR' | 'DL'
const DIAG_OFF: Record<Diag, [number, number]> = {
  UR: [74, -62],
  UL: [-74, -62],
  DR: [74, 62],
  DL: [-74, 62],
}

export interface ChargeScene {
  x: number
  y: number
  /** '+' / '-' draws a signed charge; '?' draws a neutral grey particle */
  sign: '+' | '-' | '?'
  /** short name shown near the particle (e.g. "electron") */
  name?: string
  /** known vectors drawn at the charge */
  vectors: { q: QKey; dir: Dir }[]
  /** unknown quantities shown as "X = ?" */
  unknowns: QKey[]
  arrowLen?: number
  /** diagonal slots that must not be used (e.g. they'd hit a magnet) */
  blockedDiag?: Diag[]
}

/** Particle: signed charge or a neutral grey "?" circle. */
export function Particle(props: { x: number; y: number; sign: '+' | '-' | '?' }) {
  const { x, y } = props
  const r = CHARGE_R
  if (props.sign === '?') {
    return (
      <g>
        <circle cx={x} cy={y} r={r} fill={COLORS.paper} stroke={COLORS.muted} stroke-width={3} />
        <Label x={x} y={y + 1} size={20} weight={800} color={COLORS.muted}>
          ?
        </Label>
      </g>
    )
  }
  const c = props.sign === '+' ? COLORS.positive : COLORS.negative
  return (
    <g>
      <circle cx={x} cy={y} r={r} fill={COLORS.paper} stroke={c} stroke-width={3} />
      <line x1={x - r * 0.5} y1={y} x2={x + r * 0.5} y2={y} stroke={c} stroke-width={3} stroke-linecap="round" />
      {props.sign === '+' ? <line x1={x} y1={y - r * 0.5} x2={x} y2={y + r * 0.5} stroke={c} stroke-width={3} stroke-linecap="round" /> : null}
    </g>
  )
}

/** Rough text-width estimate for avoid circles. */
const textW = (s: string, size: number) => s.length * size * 0.56

function textAvoid(x: number, y: number, w: number, anchor: 'start' | 'middle' | 'end', h = 24): Avoid[] {
  const x0 = anchor === 'start' ? x : anchor === 'end' ? x - w : x - w / 2
  const out: Avoid[] = []
  const r = h / 2 + 12
  for (let t = x0; t <= x0 + w + 1; t += 6) out.push({ x: t, y, r })
  out.push({ x: x0 + w, y, r })
  return out
}

/** Lay out a charge with its vectors/labels. Returns the elements and avoid circles. */
export function layoutCharge(s: ChargeScene): { el: JSX.Element; avoid: Avoid[] } {
  const { x, y } = s
  const len = s.arrowLen ?? ARROW_LEN
  // the wider ring covers the charge plus half a grid mark so × / • never crowd
  // its outline; field lines only need the tighter one
  const avoid: Avoid[] = [
    { x, y, r: CHARGE_R + 14 },
    { x, y, r: CHARGE_R + 24, gridOnly: true },
  ]
  const els: JSX.Element[] = [<Particle key="p" x={x} y={y} sign={s.sign} />]
  const usedAxis = new Set<Dir>()

  // in-plane arrows
  for (const v of s.vectors) {
    if (!isInPlane(v.dir)) continue
    usedAxis.add(v.dir)
    const [sx, sy] = screenStep(v.dir)
    const x1 = x + sx * GAP
    const y1 = y + sy * GAP
    const x2 = x1 + sx * len
    const y2 = y1 + sy * len
    els.push(<Arrow key={`a-${v.q}`} x1={x1} y1={y1} x2={x2} y2={y2} color={COLORS[v.q]} />)
    // label just past the tip
    const lx = sx !== 0 ? x2 + sx * 10 : x2
    const ly = sy !== 0 ? y2 + sy * 18 : y2
    const anchor = sx > 0 ? 'start' : sx < 0 ? 'end' : 'middle'
    els.push(<VecLabel key={`l-${v.q}`} x={lx} y={ly} symbol={v.q} color={COLORS[v.q]} anchor={anchor} />)
    for (let t = 0; t <= len; t += 14) avoid.push({ x: x1 + sx * t, y: y1 + sy * t, r: 21 })
    avoid.push(...textAvoid(lx, ly, 14, anchor))
  }

  // diagonal slots, preferring the side away from used arrows
  const free: Diag[] = (['UR', 'UL', 'DR', 'DL'] as Diag[]).filter((d) => !s.blockedDiag?.includes(d))
  const takeDiag = (): Diag => {
    const d = free.shift()
    if (!d) throw new Error('layoutCharge: out of diagonal slots')
    return d
  }

  for (const v of s.vectors) {
    if (isInPlane(v.dir)) continue
    const d = takeDiag()
    const [ox, oy] = DIAG_OFF[d]
    const cx = x + ox
    const cy = y + oy
    const c = COLORS[v.q]
    els.push(v.dir === 'out' ? <OutSymbol key={`s-${v.q}`} x={cx} y={cy} color={c} /> : <InSymbol key={`s-${v.q}`} x={cx} y={cy} color={c} />)
    const right = ox > 0
    const lx = cx + (right ? 22 : -22)
    els.push(<VecLabel key={`sl-${v.q}`} x={lx} y={cy} symbol={v.q} color={c} anchor={right ? 'start' : 'end'} />)
    avoid.push({ x: cx, y: cy, r: 30 }, { x: x + ox * 0.5, y: y + oy * 0.5, r: 30, bridge: true }, { x, y: y + oy * 0.6, r: 26, bridge: true }, ...textAvoid(lx, cy, 14, right ? 'start' : 'end'))
  }

  for (const q of s.unknowns) {
    const d = takeDiag()
    const [ox, oy] = DIAG_OFF[d]
    const right = ox > 0
    const lx = x + ox + (right ? -18 : 18)
    const ly = y + oy
    els.push(<VecLabel key={`u-${q}`} x={lx} y={ly} symbol={q} color={COLORS[q]} unknown anchor={right ? 'start' : 'end'} />)
    avoid.push({ x: x + ox * 0.5, y: y + oy * 0.5, r: 30, bridge: true }, { x, y: y + oy * 0.6, r: 26, bridge: true }, ...textAvoid(lx, ly, textW(`${q} = ?`, 22), right ? 'start' : 'end'))
  }

  if (s.name) {
    const w = textW(s.name, FONT.small)
    let nx: number
    let ny: number
    let anchor: 'start' | 'middle' | 'end' = 'middle'
    if (!usedAxis.has('down')) {
      nx = x
      ny = y + CHARGE_R + 18
    } else if (!usedAxis.has('up')) {
      nx = x
      ny = y - CHARGE_R - 18
    } else if (!usedAxis.has('left')) {
      nx = x - CHARGE_R - 10
      ny = y + CHARGE_R + 12
      anchor = 'end'
    } else {
      const d = takeDiag()
      const [ox, oy] = DIAG_OFF[d]
      nx = x + ox
      ny = y + oy
    }
    els.push(
      <Label key="name" x={nx} y={ny} size={FONT.small} weight={600} color={COLORS.ink} anchor={anchor}>
        {s.name}
      </Label>,
    )
    avoid.push(...textAvoid(nx, ny, w, anchor, 18))
  }

  return { el: <g>{els}</g>, avoid }
}

// ---------------------------------------------------------------------------
// Uniform field region
// ---------------------------------------------------------------------------

export const REGION = { x: 50, y: 24, w: 580, h: 320 }

/** Uniform field region: × / • grid for in/out, parallel lines for in-plane, or dashed "unknown" box. */
export function FieldRegion(props: { dir: Dir | null; avoid: Avoid[] }) {
  const { x, y, w, h } = REGION
  const box = (
    <rect
      x={x}
      y={y}
      width={w}
      height={h}
      rx={14}
      fill={COLORS.B}
      fill-opacity={0.04}
      stroke={COLORS.B}
      stroke-opacity={0.35}
      stroke-width={1.5}
      stroke-dasharray={props.dir === null ? '8 7' : undefined}
    />
  )
  const legendY = y + h + 24
  if (props.dir === null) {
    return (
      <g>
        {box}
        <FieldLegend y={legendY} text="uniform field, direction unknown" />
      </g>
    )
  }
  if (props.dir === 'in' || props.dir === 'out') {
    return (
      <g>
        {box}
        <FieldGrid x={x + 10} y={y + 10} w={w - 20} h={h - 20} dir={props.dir} spacing={56} avoid={props.avoid} />
        <FieldLegend y={legendY} text={props.dir === 'in' ? 'into the page (×)' : 'out of the page (•)'} />
      </g>
    )
  }
  const horizontal = props.dir === 'left' || props.dir === 'right'
  const count = horizontal ? 4 : 6
  return (
    <g>
      {box}
      <FieldLines x={x + 6} y={y} w={w - 12} h={h} dir={props.dir} count={count} avoid={props.avoid.filter((a) => !a.gridOnly)} />
      <FieldLegend y={legendY} text={`uniform, ${props.dir === 'up' ? 'up the page' : props.dir === 'down' ? 'down the page' : `to the ${props.dir}`}`} />
    </g>
  )
}

function FieldLegend(props: { y: number; text: string }) {
  return (
    <text x={REGION.x + REGION.w / 2} y={props.y} text-anchor="middle" dominant-baseline="central" font-size={FONT.small} fill={COLORS.muted} font-weight={500}>
      <tspan fill={COLORS.B} font-weight={800} font-size={18}>
        B
      </tspan>
      <tspan> {props.text}</tspan>
    </text>
  )
}

export const REGION_DIAGRAM_H = REGION.y + REGION.h + 44

// ---------------------------------------------------------------------------
// Bar magnet field lines
// ---------------------------------------------------------------------------

/** Cubic Bézier point/tangent */
function bez(p: number[][], t: number): [number, number, number, number] {
  const u = 1 - t
  const x = u * u * u * p[0][0] + 3 * u * u * t * p[1][0] + 3 * u * t * t * p[2][0] + t * t * t * p[3][0]
  const y = u * u * u * p[0][1] + 3 * u * u * t * p[1][1] + 3 * u * t * t * p[2][1] + t * t * t * p[3][1]
  const dx = 3 * u * u * (p[1][0] - p[0][0]) + 6 * u * t * (p[2][0] - p[1][0]) + 3 * t * t * (p[3][0] - p[2][0])
  const dy = 3 * u * u * (p[1][1] - p[0][1]) + 6 * u * t * (p[2][1] - p[1][1]) + 3 * t * t * (p[3][1] - p[2][1])
  return [x, y, dx, dy]
}

/**
 * Field lines of a bar magnet: curved loops from the N face to the S face
 * (outside the magnet), plus the straight axial line on both ends, broken
 * around `avoid` circles. `N`, `S` are pole-face centers in screen coords.
 */
export function MagnetField(props: {
  N: { x: number; y: number }
  S: { x: number; y: number }
  /** how far the axial lines extend past each pole face */
  reach: { N: number; S: number }
  avoid: Avoid[]
}) {
  const { N, S } = props
  const L = Math.hypot(N.x - S.x, N.y - S.y)
  const ax = (N.x - S.x) / L // unit S→N (screen)
  const ay = (N.y - S.y) / L
  const px = -ay
  const py = ax
  const c = COLORS.B
  const els: JSX.Element[] = []
  const loops = [
    { s: 16, h: 62, k: 40 },
    { s: 6, h: 112, k: 85 },
  ]
  for (const side of [1, -1]) {
    for (const [i, lp] of loops.entries()) {
      const pts = [
        [N.x + px * lp.s * side, N.y + py * lp.s * side],
        [N.x + ax * lp.k + px * lp.h * 1.33 * side, N.y + ay * lp.k + py * lp.h * 1.33 * side],
        [S.x - ax * lp.k + px * lp.h * 1.33 * side, S.y - ay * lp.k + py * lp.h * 1.33 * side],
        [S.x + px * lp.s * side, S.y + py * lp.s * side],
      ]
      const d = `M ${pts[0][0]} ${pts[0][1]} C ${pts[1][0]} ${pts[1][1]}, ${pts[2][0]} ${pts[2][1]}, ${pts[3][0]} ${pts[3][1]}`
      els.push(<path key={`c${side}${i}`} d={d} fill="none" stroke={c} stroke-width={STROKE.field} opacity={0.85} />)
      const [hx, hy, dx, dy] = bez(pts, 0.5)
      els.push(<ArrowHead key={`h${side}${i}`} x={hx + (dx / Math.hypot(dx, dy)) * 6} y={hy + (dy / Math.hypot(dx, dy)) * 6} ux={dx} uy={dy} color={c} size={12} />)
    }
  }
  // straight axial lines: beyond N (pointing away) and beyond S (pointing toward S) — both along +a
  const axial = (fx: number, fy: number, t0: number, t1: number, key: string) => {
    // param t along +a from the face point
    const cuts: [number, number][] = []
    for (const av of props.avoid) {
      const rx = av.x - fx
      const ry = av.y - fy
      const along = rx * ax + ry * ay
      const perp = Math.abs(rx * px + ry * py)
      if (perp < av.r) {
        const half = Math.sqrt(av.r * av.r - perp * perp)
        cuts.push([along - half, along + half])
      }
    }
    cuts.sort((p, q) => p[0] - q[0])
    const segs: [number, number][] = []
    let cur = t0
    for (const [s, e] of cuts) {
      if (s > cur) segs.push([cur, Math.min(s, t1)])
      cur = Math.max(cur, e)
    }
    if (cur < t1) segs.push([cur, t1])
    segs.forEach(([s, e], k) => {
      if (e - s < 4) return
      els.push(
        <line key={`${key}${k}`} x1={fx + ax * s} y1={fy + ay * s} x2={fx + ax * e} y2={fy + ay * e} stroke={c} stroke-width={STROKE.field} opacity={0.85} />,
      )
      if (e - s > 46) {
        const m = (s + e) / 2 + 6
        els.push(<ArrowHead key={`${key}${k}h`} x={fx + ax * m} y={fy + ay * m} ux={ax} uy={ay} color={c} size={12} />)
      }
    })
  }
  axial(N.x, N.y, 2, props.reach.N, 'aN')
  axial(S.x, S.y, -props.reach.S, -2, 'aS')
  return <g>{els}</g>
}
