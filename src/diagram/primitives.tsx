/**
 * Shared SVG building blocks. Every diagram is composed from these so that
 * colors, symbols and stroke weights stay consistent across the whole set.
 *
 * Coordinates are SVG screen coords on a fixed 680-wide canvas (y DOWN).
 * Physics directions (Dir) are converted with screenStep() from physics/vec.
 *
 * Arrowheads are drawn as explicit polygons (no <marker>), so they render
 * identically in every browser, in exported SVG and in rasterizers.
 */
import type { ComponentChildren, JSX } from 'preact'
import { COLORS, FONT, STROKE } from '../theme'
import { type Dir, isInPlane, screenStep } from '../physics/vec'

export const CANVAS_W = 680

// ---------------------------------------------------------------------------
// Root
// ---------------------------------------------------------------------------

export function Diagram(props: {
  height: number
  title: string
  desc: string
  width?: number
  children: ComponentChildren
}) {
  const w = props.width ?? CANVAS_W
  return (
    <svg
      class="diagram"
      width="100%"
      viewBox={`0 0 ${w} ${props.height}`}
      role="img"
      xmlns="http://www.w3.org/2000/svg"
      font-family={FONT.family}
      style={{ display: 'block', maxWidth: '100%', height: 'auto' }}
    >
      <title>{props.title}</title>
      <desc>{props.desc}</desc>
      <rect x={0} y={0} width={w} height={props.height} fill={COLORS.paper} rx={0} />
      {props.children}
    </svg>
  )
}

// ---------------------------------------------------------------------------
// Arrows
// ---------------------------------------------------------------------------

/** Points of a filled arrowhead whose tip is at (x, y) pointing along (ux, uy). */
export function arrowHeadPoints(x: number, y: number, ux: number, uy: number, size = 14): string {
  const len = Math.hypot(ux, uy) || 1
  const dx = ux / len
  const dy = uy / len
  const bx = x - dx * size
  const by = y - dy * size
  const half = size * 0.45
  const px = -dy * half
  const py = dx * half
  return `${x},${y} ${bx + px},${by + py} ${bx - px},${by - py}`
}

export function ArrowHead(props: { x: number; y: number; ux: number; uy: number; color: string; size?: number }) {
  return <polygon points={arrowHeadPoints(props.x, props.y, props.ux, props.uy, props.size)} fill={props.color} />
}

/** Straight arrow from (x1,y1) to (x2,y2); the head's tip lands exactly on (x2,y2). */
export function Arrow(props: {
  x1: number
  y1: number
  x2: number
  y2: number
  color: string
  width?: number
  head?: number
  dashed?: boolean
  opacity?: number
}) {
  const { x1, y1, x2, y2, color } = props
  const head = props.head ?? 14
  const w = props.width ?? STROKE.vector
  const len = Math.hypot(x2 - x1, y2 - y1) || 1
  const ux = (x2 - x1) / len
  const uy = (y2 - y1) / len
  // stop the shaft inside the head so the round/butt cap doesn't poke past the tip
  const sx = x2 - ux * head * 0.7
  const sy = y2 - uy * head * 0.7
  return (
    <g opacity={props.opacity}>
      <line
        x1={x1}
        y1={y1}
        x2={sx}
        y2={sy}
        stroke={color}
        stroke-width={w}
        stroke-linecap="round"
        stroke-dasharray={props.dashed ? '7 6' : undefined}
      />
      <ArrowHead x={x2} y={y2} ux={ux} uy={uy} color={color} size={head} />
    </g>
  )
}

// ---------------------------------------------------------------------------
// Labels
// ---------------------------------------------------------------------------

export function Label(props: {
  x: number
  y: number
  children: ComponentChildren
  color?: string
  size?: number
  anchor?: 'start' | 'middle' | 'end'
  weight?: number | string
  italic?: boolean
}) {
  return (
    <text
      x={props.x}
      y={props.y}
      fill={props.color ?? COLORS.ink}
      font-size={props.size ?? FONT.label}
      text-anchor={props.anchor ?? 'middle'}
      dominant-baseline="central"
      font-weight={props.weight ?? 600}
      font-style={props.italic ? 'italic' : undefined}
    >
      {props.children}
    </text>
  )
}

/** Vector symbol label, e.g. bold "v", "B", "F", optionally with "= ?" */
export function VecLabel(props: {
  x: number
  y: number
  symbol: string
  color: string
  unknown?: boolean
  anchor?: 'start' | 'middle' | 'end'
  size?: number
}) {
  return (
    <text
      x={props.x}
      y={props.y}
      fill={props.color}
      font-size={props.size ?? 22}
      text-anchor={props.anchor ?? 'middle'}
      dominant-baseline="central"
    >
      <tspan font-weight={800}>{props.symbol}</tspan>
      {props.unknown ? <tspan font-weight={600}> = ?</tspan> : null}
    </text>
  )
}

// ---------------------------------------------------------------------------
// Perpendicular-to-page symbols
// ---------------------------------------------------------------------------

/** ⊙ — arrow tip coming toward you (out of the page). */
export function OutSymbol(props: { x: number; y: number; r?: number; color: string; width?: number }) {
  const r = props.r ?? 14
  return (
    <g>
      <circle cx={props.x} cy={props.y} r={r} fill={COLORS.paper} stroke={props.color} stroke-width={props.width ?? 2.5} />
      <circle cx={props.x} cy={props.y} r={r * 0.28} fill={props.color} />
    </g>
  )
}

/** ⊗ — arrow tail going away from you (into the page). */
export function InSymbol(props: { x: number; y: number; r?: number; color: string; width?: number }) {
  const r = props.r ?? 14
  const k = r * 0.62
  const w = props.width ?? 2.5
  return (
    <g>
      <circle cx={props.x} cy={props.y} r={r} fill={COLORS.paper} stroke={props.color} stroke-width={w} />
      <line x1={props.x - k} y1={props.y - k} x2={props.x + k} y2={props.y + k} stroke={props.color} stroke-width={w} stroke-linecap="round" />
      <line x1={props.x - k} y1={props.y + k} x2={props.x + k} y2={props.y - k} stroke={props.color} stroke-width={w} stroke-linecap="round" />
    </g>
  )
}

/** Bare field mark used in grids: × (into) or • (out). */
export function FieldMark(props: { x: number; y: number; dir: 'in' | 'out'; color?: string; size?: number }) {
  const c = props.color ?? COLORS.B
  const s = props.size ?? 7
  if (props.dir === 'out') return <circle cx={props.x} cy={props.y} r={s * 0.45} fill={c} />
  return (
    <g stroke={c} stroke-width={2} stroke-linecap="round">
      <line x1={props.x - s} y1={props.y - s} x2={props.x + s} y2={props.y + s} />
      <line x1={props.x - s} y1={props.y + s} x2={props.x + s} y2={props.y - s} />
    </g>
  )
}

// ---------------------------------------------------------------------------
// Vectors by physics direction
// ---------------------------------------------------------------------------

/**
 * A vector starting at (x, y) pointing in physics direction `dir`.
 * In-plane → arrow of `length`. In/out of page → ⊗/⊙ drawn AT (x, y).
 * The label is placed past the arrow tip (or beside the symbol).
 */
export function Vector(props: {
  x: number
  y: number
  dir: Dir
  color: string
  symbol?: string
  unknown?: boolean
  length?: number
  labelOffset?: number
  /** start the arrow this far from (x, y) — use charge radius + 4 so arrows don't overlap the charge */
  gap?: number
}) {
  const { dir, color } = props
  const g = props.gap ?? 0
  const len = props.length ?? 90
  const off = props.labelOffset ?? 20
  if (!isInPlane(dir)) {
    const { x, y } = props
    return (
      <g>
        {dir === 'out' ? <OutSymbol x={x} y={y} color={color} /> : <InSymbol x={x} y={y} color={color} />}
        {props.symbol ? <VecLabel x={x + 22} y={y - 20} symbol={props.symbol} color={color} unknown={props.unknown} anchor="start" /> : null}
      </g>
    )
  }
  const [sx, sy] = screenStep(dir)
  const x = props.x + sx * g
  const y = props.y + sy * g
  const x2 = x + sx * len
  const y2 = y + sy * len
  // label just beyond the tip
  const lx = x2 + sx * off
  const ly = y2 + sy * off
  const anchor = sx > 0 ? 'start' : sx < 0 ? 'end' : 'middle'
  return (
    <g>
      <Arrow x1={x} y1={y} x2={x2} y2={y2} color={color} />
      {props.symbol ? (
        <VecLabel x={sx !== 0 ? x2 + sx * 8 : lx} y={sy !== 0 ? ly : y2 - 0} symbol={props.symbol} color={color} unknown={props.unknown} anchor={anchor} />
      ) : null}
    </g>
  )
}

/** Unknown quantity marker: a dashed circle with "?" — use when the asked vector has no drawn direction. */
export function Unknown(props: { x: number; y: number; symbol: string; color: string }) {
  return <VecLabel x={props.x} y={props.y} symbol={props.symbol} color={props.color} unknown />
}

// ---------------------------------------------------------------------------
// Charges, points
// ---------------------------------------------------------------------------

export function Charge(props: { x: number; y: number; sign: '+' | '-'; r?: number; label?: string }) {
  const r = props.r ?? 17
  const c = props.sign === '+' ? COLORS.positive : COLORS.negative
  return (
    <g>
      <circle cx={props.x} cy={props.y} r={r} fill={COLORS.paper} stroke={c} stroke-width={3} />
      <line x1={props.x - r * 0.5} y1={props.y} x2={props.x + r * 0.5} y2={props.y} stroke={c} stroke-width={3} stroke-linecap="round" />
      {props.sign === '+' ? (
        <line x1={props.x} y1={props.y - r * 0.5} x2={props.x} y2={props.y + r * 0.5} stroke={c} stroke-width={3} stroke-linecap="round" />
      ) : null}
      {props.label ? (
        <Label x={props.x} y={props.y + r + 16} size={FONT.small} color={COLORS.ink}>
          {props.label}
        </Label>
      ) : null}
    </g>
  )
}

/** A labeled point, e.g. "P". */
export function PointMarker(props: { x: number; y: number; label?: string; labelDx?: number; labelDy?: number }) {
  return (
    <g>
      <circle cx={props.x} cy={props.y} r={5} fill={COLORS.ink} />
      {props.label ? (
        <Label x={props.x + (props.labelDx ?? 14)} y={props.y + (props.labelDy ?? -14)} anchor="start">
          {props.label}
        </Label>
      ) : null}
    </g>
  )
}

// ---------------------------------------------------------------------------
// Uniform fields
// ---------------------------------------------------------------------------

type Avoid = { x: number; y: number; r: number }

/**
 * Grid of × or • marks filling a rectangle. Marks within `avoid` circles are
 * skipped so nothing overlaps charges, arrows or labels.
 */
export function FieldGrid(props: {
  x: number
  y: number
  w: number
  h: number
  dir: 'in' | 'out'
  spacing?: number
  avoid?: Avoid[]
  color?: string
  label?: boolean
}) {
  const sp = props.spacing ?? 60
  const cols = Math.max(1, Math.floor(props.w / sp))
  const rows = Math.max(1, Math.floor(props.h / sp))
  const ox = props.x + (props.w - (cols - 1) * sp) / 2
  const oy = props.y + (props.h - (rows - 1) * sp) / 2
  const marks: JSX.Element[] = []
  for (let i = 0; i < cols; i++) {
    for (let j = 0; j < rows; j++) {
      const mx = ox + i * sp
      const my = oy + j * sp
      if (props.avoid?.some((a) => Math.hypot(a.x - mx, a.y - my) < a.r)) continue
      marks.push(<FieldMark key={`${i}-${j}`} x={mx} y={my} dir={props.dir} color={props.color} />)
    }
  }
  return <g opacity={0.8}>{marks}</g>
}

/**
 * Parallel uniform field lines across a rectangle, pointing `dir` (in-plane),
 * each with an arrowhead. Lines are broken around `avoid` circles.
 */
export function FieldLines(props: {
  x: number
  y: number
  w: number
  h: number
  dir: 'right' | 'left' | 'up' | 'down'
  count?: number
  avoid?: Avoid[]
  color?: string
}) {
  const c = props.color ?? COLORS.B
  const n = props.count ?? 4
  const horizontal = props.dir === 'right' || props.dir === 'left'
  const span = horizontal ? props.h : props.w
  const gap = span / n
  const lines: JSX.Element[] = []
  for (let i = 0; i < n; i++) {
    const off = gap * (i + 0.5)
    // Build the line as segments, splitting around avoid circles.
    const a0 = horizontal ? props.x : props.y
    const a1 = horizontal ? props.x + props.w : props.y + props.h
    const fixed = horizontal ? props.y + off : props.x + off
    const cuts: [number, number][] = []
    for (const av of props.avoid ?? []) {
      const d = Math.abs((horizontal ? av.y : av.x) - fixed)
      if (d < av.r) {
        const half = Math.sqrt(av.r * av.r - d * d)
        const center = horizontal ? av.x : av.y
        cuts.push([center - half, center + half])
      }
    }
    cuts.sort((p, q) => p[0] - q[0])
    const segs: [number, number][] = []
    let cur = a0
    for (const [s, e] of cuts) {
      if (s > cur) segs.push([cur, Math.min(s, a1)])
      cur = Math.max(cur, e)
    }
    if (cur < a1) segs.push([cur, a1])
    const [sx, sy] = screenStep(props.dir)
    segs.forEach(([s, e], k) => {
      const p = (t: number) => (horizontal ? [t, fixed] : [fixed, t])
      const [x1, y1] = p(s)
      const [x2, y2] = p(e)
      lines.push(<line key={`${i}-${k}-l`} x1={x1} y1={y1} x2={x2} y2={y2} stroke={c} stroke-width={STROKE.field} opacity={0.85} />)
      if (e - s > 60) {
        const mid = (s + e) / 2 + (horizontal ? sx : sy) * 7
        const [hx, hy] = p(mid)
        lines.push(<ArrowHead key={`${i}-${k}-h`} x={hx} y={hy} ux={sx} uy={sy} color={c} size={12} />)
      }
    })
  }
  return <g>{lines}</g>
}

// ---------------------------------------------------------------------------
// Wires
// ---------------------------------------------------------------------------

/** Straight wire segment carrying current from (x1,y1) toward (x2,y2), with a current arrow at its middle. */
export function Wire(props: {
  x1: number
  y1: number
  x2: number
  y2: number
  current?: 'forward' | 'backward' | 'none'
  label?: string
  arrowAt?: number // 0..1 along the wire, default 0.5
}) {
  const { x1, y1, x2, y2 } = props
  const cur = props.current ?? 'forward'
  const t = props.arrowAt ?? 0.5
  const mx = x1 + (x2 - x1) * t
  const my = y1 + (y2 - y1) * t
  const sgn = cur === 'backward' ? -1 : 1
  const ux = (x2 - x1) * sgn
  const uy = (y2 - y1) * sgn
  const len = Math.hypot(ux, uy) || 1
  return (
    <g>
      <line x1={x1} y1={y1} x2={x2} y2={y2} stroke={COLORS.wire} stroke-width={STROKE.wire} stroke-linecap="round" />
      {cur !== 'none' ? (
        <ArrowHead x={mx + (ux / len) * 10} y={my + (uy / len) * 10} ux={ux} uy={uy} color={COLORS.I} size={18} />
      ) : null}
      {props.label ? (
        <VecLabel x={mx + (-uy / len) * 24} y={my + (ux / len) * 24} symbol={props.label} color={COLORS.I} />
      ) : null}
    </g>
  )
}

/** Cross-section of a wire perpendicular to the page carrying current in/out. */
export function WireEnd(props: { x: number; y: number; current: 'in' | 'out'; r?: number; label?: string }) {
  const r = props.r ?? 18
  return (
    <g>
      <circle cx={props.x} cy={props.y} r={r + 3} fill={COLORS.wire} opacity={0.25} />
      {props.current === 'out' ? (
        <OutSymbol x={props.x} y={props.y} r={r} color={COLORS.I} width={3} />
      ) : (
        <InSymbol x={props.x} y={props.y} r={r} color={COLORS.I} width={3} />
      )}
      {props.label ? (
        <VecLabel x={props.x} y={props.y + r + 22} symbol={props.label} color={COLORS.I} size={18} />
      ) : null}
    </g>
  )
}

/** Caption line inside the diagram (e.g. the solid = near / dashed = far convention). */
export function Caption(props: { x?: number; y: number; children: ComponentChildren }) {
  return (
    <Label x={props.x ?? CANVAS_W / 2} y={props.y} size={FONT.small} weight={500} color={COLORS.muted}>
      {props.children}
    </Label>
  )
}
