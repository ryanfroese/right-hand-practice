/**
 * The color code students learn. NEVER use a different color for a quantity.
 *
 * Each value is a CSS variable with a fixed hex fallback, so:
 *  - in the app, diagrams re-theme for light/dark mode (vars set in index.css)
 *  - exported / standalone SVG (Canvas, print) falls back to the light hex.
 *
 *   v = green, B = purple, F = coral, I = amber
 */
export const COLORS = {
  v: 'var(--c-v, #1D9E75)',
  B: 'var(--c-B, #7F56D9)',
  F: 'var(--c-F, #E8613C)',
  I: 'var(--c-I, #D99400)',
  ink: 'var(--c-ink, #1F2937)', // labels, outlines
  muted: 'var(--c-muted, #9CA3AF)', // grid marks, guides, far-side dashed lines
  positive: 'var(--c-pos, #DC2626)',
  negative: 'var(--c-neg, #2563EB)',
  northPole: 'var(--c-north, #DC2626)',
  southPole: 'var(--c-south, #2563EB)',
  wire: 'var(--c-wire, #6B7280)',
  paper: 'var(--c-paper, #FFFFFF)', // diagram background (also used to "break" lines)
} as const

export const STROKE = {
  vector: 3,
  wire: 4,
  field: 1.75,
  guide: 1.25,
} as const

export const FONT = {
  family: "ui-sans-serif, system-ui, -apple-system, 'Segoe UI', sans-serif",
  label: 20,
  small: 15,
} as const
