/**
 * Diagram pieces specific to Lenz's law / induction problems.
 * All coordinates are SVG screen coords (y DOWN). No physics happens here.
 */
import type { JSX } from 'preact'
import { COLORS, FONT, STROKE } from '../theme'
import { FieldMark } from './primitives'

// ---------------------------------------------------------------------------
// Keep-out shapes for field-mark grids
// ---------------------------------------------------------------------------

export type KeepOut =
  | { kind: 'circle'; x: number; y: number; r: number }
  /** segment with a padding radius (distance from the segment) */
  | { kind: 'seg'; x1: number; y1: number; x2: number; y2: number; pad: number }
  /** filled box (e.g. a label's bounding box), grown by pad */
  | { kind: 'box'; x: number; y: number; w: number; h: number; pad?: number }
  /** ring: keeps marks away from a circle's outline only */
  | { kind: 'ring'; x: number; y: number; r: number; pad: number }

function segDist(px: number, py: number, x1: number, y1: number, x2: number, y2: number): number {
  const dx = x2 - x1
  const dy = y2 - y1
  const L2 = dx * dx + dy * dy
  const t = L2 === 0 ? 0 : Math.max(0, Math.min(1, ((px - x1) * dx + (py - y1) * dy) / L2))
  return Math.hypot(px - (x1 + t * dx), py - (y1 + t * dy))
}

export function blocked(x: number, y: number, keep: readonly KeepOut[]): boolean {
  return keep.some((k) => {
    switch (k.kind) {
      case 'circle':
        return Math.hypot(x - k.x, y - k.y) < k.r
      case 'seg':
        return segDist(x, y, k.x1, k.y1, k.x2, k.y2) < k.pad
      case 'box': {
        const p = k.pad ?? 8
        return x > k.x - p && x < k.x + k.w + p && y > k.y - p && y < k.y + k.h + p
      }
      case 'ring':
        return Math.abs(Math.hypot(x - k.x, y - k.y) - k.r) < k.pad
    }
  })
}

/** Segments of a rectangle's outline, as keep-outs. */
export function rectOutline(x: number, y: number, w: number, h: number, pad: number): KeepOut[] {
  return [
    { kind: 'seg', x1: x, y1: y, x2: x + w, y2: y, pad },
    { kind: 'seg', x1: x + w, y1: y, x2: x + w, y2: y + h, pad },
    { kind: 'seg', x1: x + w, y1: y + h, x2: x, y2: y + h, pad },
    { kind: 'seg', x1: x, y1: y + h, x2: x, y2: y, pad },
  ]
}

/**
 * × / • grid inside a rectangle, centered, skipping any mark that falls in a
 * keep-out shape. Unlike FieldGrid this can avoid outlines (loops, rails).
 */
export function MarkField(props: {
  x: number
  y: number
  w: number
  h: number
  dir: 'in' | 'out'
  spacing?: number
  keep?: readonly KeepOut[]
  /** if given, the lattice passes through this point (e.g. a loop's center) */
  origin?: { x: number; y: number }
}) {
  const sp = props.spacing ?? 54
  let ox: number
  let oy: number
  if (props.origin) {
    ox = props.origin.x - Math.floor((props.origin.x - props.x) / sp) * sp
    oy = props.origin.y - Math.floor((props.origin.y - props.y) / sp) * sp
  } else {
    ox = props.x + (props.w - Math.floor(props.w / sp) * sp) / 2
    oy = props.y + (props.h - Math.floor(props.h / sp) * sp) / 2
  }
  const marks: JSX.Element[] = []
  for (let i = 0; ox + i * sp <= props.x + props.w + 0.01; i++) {
    for (let j = 0; oy + j * sp <= props.y + props.h + 0.01; j++) {
      const mx = ox + i * sp
      const my = oy + j * sp
      if (blocked(mx, my, props.keep ?? [])) continue
      marks.push(<FieldMark key={`${i}-${j}`} x={mx} y={my} dir={props.dir} />)
    }
  }
  return <g opacity={0.8}>{marks}</g>
}

// ---------------------------------------------------------------------------
// Labels
// ---------------------------------------------------------------------------

/** Rough text width for layout (system sans, semi-bold). */
export const textW = (s: string, size: number) => s.length * size * 0.58

/**
 * Symbol with a small subscript, e.g. I_ind = ?  (bold symbol, smaller sub).
 * Returns approx width via `subLabelW` for keep-out boxes.
 */
export function SubLabel(props: {
  x: number
  y: number
  sym: string
  sub?: string
  color: string
  unknown?: boolean
  anchor?: 'start' | 'middle' | 'end'
  size?: number
  /** paint a background-colored outline behind the glyphs so lines under the label are broken */
  halo?: boolean
}) {
  const size = props.size ?? 22
  const halo = props.halo ? { stroke: COLORS.paper, 'stroke-width': 6, 'stroke-linejoin': 'round' as const, 'paint-order': 'stroke' } : {}
  return (
    <text
      x={props.x}
      y={props.y}
      fill={props.color}
      font-size={size}
      text-anchor={props.anchor ?? 'middle'}
      dominant-baseline="central"
      {...halo}
    >
      <tspan font-weight={800}>{props.sym}</tspan>
      {props.sub ? (
        <tspan font-size={size * 0.62} font-weight={700} dy={size * 0.28}>
          {props.sub}
        </tspan>
      ) : null}
      {props.unknown ? (
        <tspan font-weight={600} dy={props.sub ? -size * 0.28 : 0}>
          {' = ?'}
        </tspan>
      ) : null}
    </text>
  )
}

export function subLabelW(sym: string, sub = '', unknown = false, size = 22): number {
  return sym.length * size * 0.62 + sub.length * size * 0.62 * 0.6 + (unknown ? size * 1.6 : 0)
}

/** Keep-out box for a SubLabel drawn with the given anchor. */
export function subLabelBox(x: number, y: number, w: number, anchor: 'start' | 'middle' | 'end', pad = 10, size = 22): KeepOut {
  const x0 = anchor === 'start' ? x : anchor === 'end' ? x - w : x - w / 2
  return { kind: 'box', x: x0, y: y - size * 0.6, w, h: size * 1.3, pad }
}

// ---------------------------------------------------------------------------
// "B increasing" badge with a trend sparkline
// ---------------------------------------------------------------------------

export type Trend = 'increasing' | 'decreasing' | 'constant'

/**
 * Small trend graph (about 30 × 20) centered at (x, y): two muted axes plus a
 * line that rises, falls or stays flat. Deliberately NO arrowhead and NOT in a
 * quantity color, so it can never be mistaken for a direction vector.
 */
export function TrendIcon(props: { x: number; y: number; trend: Trend }) {
  const { x, y } = props
  const w = 30
  const h = 20
  const x0 = x - w / 2
  const x1 = x + w / 2
  const yBot = y + h / 2
  const yTop = y - h / 2
  // plot area inside the axes
  const px0 = x0 + 5
  const px1 = x1
  const pyTop = yTop + 1
  const pyBot = yBot - 5
  const pyMid = (pyTop + pyBot) / 2
  let pts: [number, number][]
  if (props.trend === 'increasing') pts = [[px0, pyBot], [px0 + 9, pyBot - 4], [px0 + 15, pyBot - 3], [px1, pyTop]]
  else if (props.trend === 'decreasing') pts = [[px0, pyTop], [px0 + 9, pyTop + 4], [px0 + 15, pyTop + 3], [px1, pyBot]]
  else pts = [[px0, pyMid], [px1, pyMid]]
  return (
    <g>
      <polyline
        points={`${x0},${yTop - 1} ${x0},${yBot} ${x1 + 1},${yBot}`}
        fill="none"
        stroke={COLORS.muted}
        stroke-width={1.5}
        stroke-linejoin="round"
        stroke-linecap="round"
      />
      <polyline points={pts.map((p) => p.join(',')).join(' ')} fill="none" stroke={COLORS.ink} stroke-width={2.25} stroke-linejoin="round" stroke-linecap="round" />
    </g>
  )
}

/** Width of a TrendBadge, for layout. */
export function trendBadgeW(sym: string, trend: Trend): number {
  return 18 + textW(sym, 20) + 8 + textW(trend, FONT.small + 1) + 12 + 30 + 16
}

/** Pill badge: "B  increasing  ↗" centered at (x, y). */
export function TrendBadge(props: { x: number; y: number; sym: string; trend: Trend; color: string }) {
  const w = trendBadgeW(props.sym, props.trend)
  const h = 36
  const x0 = props.x - w / 2
  const symX = x0 + 18
  const wordX = symX + textW(props.sym, 20) + 8
  const iconX = x0 + w - 16 - 15
  return (
    <g>
      <rect x={x0} y={props.y - h / 2} width={w} height={h} rx={h / 2} fill={COLORS.paper} stroke={props.color} stroke-width={1.75} />
      <text x={symX} y={props.y} fill={props.color} font-size={20} font-weight={800} dominant-baseline="central">
        {props.sym}
      </text>
      <text x={wordX} y={props.y} fill={COLORS.ink} font-size={FONT.small + 1} font-weight={600} dominant-baseline="central">
        {props.trend}
      </text>
      <TrendIcon x={iconX} y={props.y} trend={props.trend} />
    </g>
  )
}

// ---------------------------------------------------------------------------
// Loops, rails, resistor
// ---------------------------------------------------------------------------

export function RectLoop(props: { x: number; y: number; w: number; h: number }) {
  return (
    <rect x={props.x} y={props.y} width={props.w} height={props.h} rx={6} fill="none" stroke={COLORS.wire} stroke-width={STROKE.wire} />
  )
}

export function CircleLoop(props: { cx: number; cy: number; r: number }) {
  return <circle cx={props.cx} cy={props.cy} r={props.r} fill="none" stroke={COLORS.wire} stroke-width={STROKE.wire} />
}

/** Vertical resistor zig-zag between (x, y1) and (x, y2), with straight leads. */
export function VResistor(props: { x: number; y1: number; y2: number; zig?: number }) {
  const { x, y1, y2 } = props
  const zig = props.zig ?? 50
  const mid = (y1 + y2) / 2
  const za = mid - zig / 2
  const n = 6
  const step = zig / n
  const pts: string[] = [`${x},${y1}`, `${x},${za}`]
  for (let i = 0; i < n; i++) pts.push(`${x + (i % 2 === 0 ? 11 : -11)},${za + step * (i + 0.5)}`)
  pts.push(`${x},${za + zig}`, `${x},${y2}`)
  return <polyline points={pts.join(' ')} fill="none" stroke={COLORS.wire} stroke-width={STROKE.wire} stroke-linejoin="round" stroke-linecap="round" />
}

// ---------------------------------------------------------------------------
// Side-view loop / coil (axis horizontal on the page)
// ---------------------------------------------------------------------------

/**
 * A loop (or several turns) whose plane is perpendicular to the page and whose
 * axis runs left–right. Each turn is drawn as its own ellipse: the RIGHT half is
 * solid (near side, toward the viewer, +z) and the LEFT half dashed (far side).
 * Turns are drawn as separate closed rings (no helix connectors) so every solid
 * arc is unambiguously a near side.
 */
export function SideCoil(props: { cx: number; cy: number; rx?: number; ry?: number; turns?: number; pitch?: number }) {
  const rx = props.rx ?? 24
  const ry = props.ry ?? 86
  const n = props.turns ?? 1
  const pitch = props.pitch ?? 26
  const { cy } = props
  const first = props.cx - ((n - 1) * pitch) / 2
  const out: JSX.Element[] = []
  for (let i = 0; i < n; i++) {
    const cx = first + i * pitch
    out.push(
      <path
        key={`f${i}`}
        d={`M ${cx} ${cy - ry} A ${rx} ${ry} 0 0 0 ${cx} ${cy + ry}`}
        fill="none"
        stroke={COLORS.muted}
        stroke-width={2.5}
        stroke-dasharray="7 6"
      />,
    )
  }
  // near (solid) halves last, so they sit on top of the far (dashed) halves
  for (let i = 0; i < n; i++) {
    const cx = first + i * pitch
    out.push(
      <path key={`n${i}`} d={`M ${cx} ${cy - ry} A ${rx} ${ry} 0 0 1 ${cx} ${cy + ry}`} fill="none" stroke={COLORS.wire} stroke-width={STROKE.wire} stroke-linecap="round" />,
    )
  }
  return <g>{out}</g>
}

/** Screen x of the right-most point of the coil's near (solid) side. */
export function sideCoilRight(p: { cx: number; rx?: number; turns?: number; pitch?: number }): number {
  const n = p.turns ?? 1
  return p.cx + ((n - 1) * (p.pitch ?? 26)) / 2 + (p.rx ?? 24)
}
export function sideCoilLeft(p: { cx: number; rx?: number; turns?: number; pitch?: number }): number {
  const n = p.turns ?? 1
  return p.cx - ((n - 1) * (p.pitch ?? 26)) / 2 - (p.rx ?? 24)
}
