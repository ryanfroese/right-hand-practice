/**
 * 3D vector math in "page" coordinates.
 *
 *   +x = right on the page
 *   +y = up the page
 *   +z = OUT of the page (toward the viewer)
 *
 * This is a right-handed system: x̂ × ŷ = ẑ (right × up = out).
 * NOTE: SVG screen y points DOWN. Never do physics in screen coords —
 * use these page coords and convert with `toScreen` only when drawing.
 */

export type Vec3 = readonly [number, number, number]

/** The six axis directions a student can answer with. */
export type Dir = 'right' | 'left' | 'up' | 'down' | 'out' | 'in'

export const DIRS: readonly Dir[] = ['right', 'left', 'up', 'down', 'out', 'in']
export const IN_PLANE_DIRS: readonly Dir[] = ['right', 'left', 'up', 'down']

const DIR_VEC: Record<Dir, Vec3> = {
  right: [1, 0, 0],
  left: [-1, 0, 0],
  up: [0, 1, 0],
  down: [0, -1, 0],
  out: [0, 0, 1],
  in: [0, 0, -1],
}

export const DIR_LABEL: Record<Dir, string> = {
  right: 'Right',
  left: 'Left',
  up: 'Up the page',
  down: 'Down the page',
  out: 'Out of the page',
  in: 'Into the page',
}

/** Short phrase used inside sentences: "points ___". */
export const DIR_PHRASE: Record<Dir, string> = {
  right: 'to the right',
  left: 'to the left',
  up: 'up the page',
  down: 'down the page',
  out: 'out of the page',
  in: 'into the page',
}

export const vec = (d: Dir): Vec3 => DIR_VEC[d]

export const cross = (a: Vec3, b: Vec3): Vec3 => [
  a[1] * b[2] - a[2] * b[1],
  a[2] * b[0] - a[0] * b[2],
  a[0] * b[1] - a[1] * b[0],
]

export const dot = (a: Vec3, b: Vec3): number => a[0] * b[0] + a[1] * b[1] + a[2] * b[2]
export const scale = (a: Vec3, k: number): Vec3 => [a[0] * k, a[1] * k, a[2] * k]
export const add = (a: Vec3, b: Vec3): Vec3 => [a[0] + b[0], a[1] + b[1], a[2] + b[2]]
export const neg = (a: Vec3): Vec3 => scale(a, -1)
export const norm = (a: Vec3): number => Math.hypot(a[0], a[1], a[2])
export const isZero = (a: Vec3, eps = 1e-9): boolean => norm(a) < eps

/**
 * Convert an axis-aligned vector back to a Dir. Returns null for the zero
 * vector. Throws if the vector is not along an axis (a generator bug).
 */
export function toDir(a: Vec3): Dir | null {
  if (isZero(a)) return null
  const n = norm(a)
  for (const d of DIRS) {
    if (dot(scale(a, 1 / n), DIR_VEC[d]) > 1 - 1e-9) return d
  }
  throw new Error(`Vector [${a.join(', ')}] is not axis-aligned`)
}

export const opposite = (d: Dir): Dir => toDir(neg(vec(d)))!

/** Cross product of two directions, as a direction (null when parallel). */
export const crossDir = (a: Dir, b: Dir): Dir | null => toDir(cross(vec(a), vec(b)))

export const isInPlane = (d: Dir): boolean => d !== 'in' && d !== 'out'
export const areParallel = (a: Dir, b: Dir): boolean => crossDir(a, b) === null

/** Unit step in SVG screen coords for an in-plane Dir (screen y is down). */
export function screenStep(d: Dir): [number, number] {
  switch (d) {
    case 'right': return [1, 0]
    case 'left': return [-1, 0]
    case 'up': return [0, -1]
    case 'down': return [0, 1]
    default: throw new Error(`${d} is not an in-plane direction`)
  }
}

/** Format a number in scientific notation with unicode superscripts: 1.6 × 10⁻¹⁴ */
export function sci(x: number, sig = 2): string {
  if (x === 0) return '0'
  const exp = Math.floor(Math.log10(Math.abs(x)))
  const mant = x / 10 ** exp
  if (exp === 0) return mant.toPrecision(sig)
  const sup = String(exp).replace(/[-0-9]/g, (c) => '⁻⁰¹²³⁴⁵⁶⁷⁸⁹'['-0123456789'.indexOf(c)])
  return `${mant.toPrecision(sig)} × 10${sup}`
}
