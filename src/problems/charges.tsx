/**
 * Moving charges in magnetic fields: F = q v × B.
 * All answers are computed with page-coordinate cross products (physics/vec).
 */
import type { ComponentChildren } from 'preact'
import type { Rng } from '../rng'
import type { Choice, ProblemType } from './types'
import { ROTATION_CHOICES, dirChoices } from './types'
import { Q } from './Q'
import { type Dir, DIRS, DIR_PHRASE, IN_PLANE_DIRS, cross, dot, isInPlane, opposite, scale, sci, toDir, vec } from '../physics/vec'
import { BarMagnet, Diagram, barMagnetPoles } from '../diagram/primitives'
import { type ChargeScene, FieldRegion, MagnetField, REGION, REGION_DIAGRAM_H, layoutCharge } from '../diagram/charges'

// ---------------------------------------------------------------------------
// Particles
// ---------------------------------------------------------------------------

interface Particle {
  sign: 1 | -1
  /** "a proton" */
  article: string
  /** "proton" (diagram label) */
  name: string
  /** |q| in coulombs */
  q: number
  qText: string
}

function pickParticle(rng: Rng, sign?: 1 | -1): Particle {
  const s: 1 | -1 = sign ?? (rng.chance() ? 1 : -1)
  if (s > 0) {
    return rng.pick<Particle>([
      { sign: 1, article: 'a proton', name: 'proton', q: 1.6e-19, qText: '1.6 × 10⁻¹⁹ C' },
      { sign: 1, article: 'a proton', name: 'proton', q: 1.6e-19, qText: '1.6 × 10⁻¹⁹ C' },
      { sign: 1, article: 'a positive charge', name: '+q', q: 2.0e-6, qText: '2.0 × 10⁻⁶ C' },
      { sign: 1, article: 'an alpha particle', name: 'alpha particle', q: 3.2e-19, qText: '3.2 × 10⁻¹⁹ C' },
    ])
  }
  return rng.pick<Particle>([
    { sign: -1, article: 'an electron', name: 'electron', q: 1.6e-19, qText: '1.6 × 10⁻¹⁹ C' },
    { sign: -1, article: 'an electron', name: 'electron', q: 1.6e-19, qText: '1.6 × 10⁻¹⁹ C' },
    { sign: -1, article: 'a negative charge', name: '−q', q: 3.0e-6, qText: '3.0 × 10⁻⁶ C' },
  ])
}

const signChar = (s: 1 | -1): '+' | '-' => (s > 0 ? '+' : '-')

/** F direction for charge sign s: F = s (v × B). null when v ∥ B. */
function forceDir(s: 1 | -1, v: Dir, B: Dir): Dir | null {
  return toDir(scale(cross(vec(v), vec(B)), s))
}

const perpTo = (d: Dir): Dir[] => DIRS.filter((x) => dot(vec(x), vec(d)) === 0)

const ph = (d: Dir) => DIR_PHRASE[d]

const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1)

/** "Point your fingers along v (…), curl toward B (…): thumb points …." */
function curlSentence(v: Dir, B: Dir): ComponentChildren {
  const t = toDir(cross(vec(v), vec(B)))!
  return (
    <>
      Point your fingers along <Q k="v">v</Q> ({ph(v)}) and curl them toward <Q k="B">B</Q> ({ph(B)}): your thumb points {ph(t)}.{' '}
    </>
  )
}

function signSentence(s: 1 | -1, v: Dir, B: Dir): ComponentChildren {
  const t = toDir(cross(vec(v), vec(B)))!
  return s > 0 ? (
    <>
      The charge is positive, so <Q k="F">F</Q> points {ph(t)}.
    </>
  ) : (
    <>
      The charge is negative, so flip it: <Q k="F">F</Q> points {ph(opposite(t))}.
    </>
  )
}

const RHR_HINT: ComponentChildren = (
  <>
    Right hand: fingers along <Q k="v">v</Q>, curl toward <Q k="B">B</Q>, thumb gives <Q k="F">F</Q> for a positive charge. Flip it for a negative charge.
  </>
)

const SIGN_CHOICES: Choice[] = [
  { id: 'positive', label: 'Positive', glyph: '+' },
  { id: 'negative', label: 'Negative', glyph: '−' },
]

function regionDiagram(title: string, desc: string, field: Dir | null, scene: ChargeScene) {
  const { el, avoid } = layoutCharge(scene)
  return (
    <Diagram height={REGION_DIAGRAM_H} title={title} desc={desc}>
      <FieldRegion dir={field} avoid={avoid} />
      {el}
    </Diagram>
  )
}

const CX = REGION.x + REGION.w / 2
const CY = REGION.y + REGION.h / 2

/** pick a uniform field: in/out grid or in-plane lines */
const pickField = (rng: Rng): Dir => (rng.chance(0.5) ? rng.pick<Dir>(['in', 'out']) : rng.pick(IN_PLANE_DIRS))

// ---------------------------------------------------------------------------
// 1. charge-force
// ---------------------------------------------------------------------------

const V_MANT = [1.5, 2.0, 3.0, 4.0, 5.0, 6.0, 8.0]
const B_VALS = [0.2, 0.25, 0.4, 0.5, 0.8, 1.2]

const chargeForce: ProblemType = {
  id: 'charge-force',
  category: 'charges',
  title: 'Force on a moving charge',
  skill: 'Find F = qv × B from the charge, v and B',
  generate(rng) {
    const p = pickParticle(rng)
    const B = pickField(rng)
    const parallel = rng.chance(0.1)
    const v: Dir = parallel ? rng.pick<Dir>([B, opposite(B)]) : rng.pick(DIRS.filter((d) => dot(vec(d), vec(B)) === 0))
    const F = forceDir(p.sign, v, B)
    const answer = F ?? 'zero'

    const withNumbers = rng.chance(0.5)
    const vMag = rng.pick(V_MANT) * 10 ** rng.int(4, 6)
    const bMag = rng.pick(B_VALS)
    const fMag = p.q * vMag * bMag
    // generic charges have no "known" q, so state it whenever we compute |F|
    const showQ = withNumbers && (p.name === '+q' || p.name === '−q')

    const prompt = (
      <>
        {cap(p.article)} moves with velocity <Q k="v">v</Q>
        {withNumbers ? <> = {sci(vMag)} m/s</> : null} {ph(v)} through a uniform magnetic field <Q k="B">B</Q>
        {withNumbers ? <> = {bMag.toFixed(2)} T</> : null} pointing {ph(B)}.{showQ ? <> Its charge is q = {p.sign > 0 ? '+' : '−'}{p.qText}.</> : null} Which way is the magnetic force <Q k="F">F</Q>?
      </>
    )
    const explanation = F ? (
      <>
        {curlSentence(v, B)}
        {signSentence(p.sign, v, B)}
        {withNumbers ? (
          <>
            {' '}
            Its size is F = |q|vB = ({p.qText})({sci(vMag)} m/s)({bMag.toFixed(2)} T) ≈ {sci(fMag)} N.
          </>
        ) : null}
      </>
    ) : (
      <>
        <Q k="v">v</Q> points {ph(v)} and <Q k="B">B</Q> points {ph(B)}, so they are parallel (or antiparallel). Then v × B = 0: there is no
        magnetic force{withNumbers ? ', no matter how large v or B are' : ''}.
      </>
    )
    return {
      typeId: 'charge-force',
      prompt,
      diagram: regionDiagram('Moving charge in a magnetic field', `A ${p.name} moving ${ph(v)} in a field ${ph(B)}`, B, {
        x: CX,
        y: CY,
        sign: signChar(p.sign),
        name: p.name,
        vectors: [{ q: 'v', dir: v }],
        unknowns: ['F'],
      }),
      choices: dirChoices({ zero: true }),
      answer,
      explanation,
      hint: parallel ? (
        <>Compare the directions of <Q k="v">v</Q> and <Q k="B">B</Q> first. {RHR_HINT}</>
      ) : (
        RHR_HINT
      ),
      facts: { sign: p.sign, v, B, withNumbers, vMag, bMag, q: p.q },
    }
  },
}

// ---------------------------------------------------------------------------
// 2. charge-find-b
// ---------------------------------------------------------------------------

const chargeFindB: ProblemType = {
  id: 'charge-find-b',
  category: 'charges',
  title: 'Find the field from the force',
  skill: 'Work backward from v and F to the direction of B',
  generate(rng) {
    const p = pickParticle(rng)
    const v = rng.pick(DIRS)
    const B = rng.pick(perpTo(v))
    const F = forceDir(p.sign, v, B)!
    const thumb = p.sign > 0 ? F : opposite(F)
    return {
      typeId: 'charge-find-b',
      prompt: (
        <>
          {cap(p.article)} moving {ph(v)} feels a magnetic force <Q k="F">F</Q> {ph(F)}. If <Q k="B">B</Q> is perpendicular to <Q k="v">v</Q>, which way does{' '}
          <Q k="B">B</Q> point?
        </>
      ),
      diagram: regionDiagram('Moving charge with known force', `A ${p.name} moving ${ph(v)} with force ${ph(F)}`, null, {
        x: CX,
        y: CY,
        sign: signChar(p.sign),
        name: p.name,
        vectors: [
          { q: 'v', dir: v },
          { q: 'F', dir: F },
        ],
        unknowns: ['B'],
      }),
      choices: dirChoices(),
      answer: B,
      explanation: (
        <>
          {p.sign > 0 ? (
            <>
              For a positive charge, <Q k="F">F</Q> is along v × B, so v × B must point {ph(thumb)}.{' '}
            </>
          ) : (
            <>
              For a negative charge, <Q k="F">F</Q> is opposite v × B, so v × B must point {ph(thumb)}.{' '}
            </>
          )}
          Fingers along <Q k="v">v</Q> ({ph(v)}): the only way to curl them that sends your thumb {ph(thumb)} is with <Q k="B">B</Q> {ph(B)}. So <Q k="B">B</Q> points {ph(B)}.
        </>
      ),
      hint: (
        <>
          <Q k="B">B</Q> must be perpendicular to both <Q k="v">v</Q> and <Q k="F">F</Q>, which leaves two options. Test each with your right hand.
        </>
      ),
      facts: { sign: p.sign, v, F },
    }
  },
}

// ---------------------------------------------------------------------------
// 3. charge-find-v
// ---------------------------------------------------------------------------

const chargeFindV: ProblemType = {
  id: 'charge-find-v',
  category: 'charges',
  title: 'Find the velocity from the force',
  skill: 'Work backward from B and F to the direction of v',
  generate(rng) {
    const p = pickParticle(rng)
    const B = pickField(rng)
    const v = rng.pick(perpTo(B))
    const F = forceDir(p.sign, v, B)!
    const thumb = p.sign > 0 ? F : opposite(F)
    return {
      typeId: 'charge-find-v',
      prompt: (
        <>
          {cap(p.article)} in a magnetic field <Q k="B">B</Q> pointing {ph(B)} feels a force <Q k="F">F</Q> {ph(F)}. If <Q k="v">v</Q> is perpendicular to{' '}
          <Q k="B">B</Q>, which way is it moving?
        </>
      ),
      diagram: regionDiagram('Charge in a field with known force', `A ${p.name} in a field ${ph(B)} with force ${ph(F)}`, B, {
        x: CX,
        y: CY,
        sign: signChar(p.sign),
        name: p.name,
        vectors: [{ q: 'F', dir: F }],
        unknowns: ['v'],
      }),
      choices: dirChoices(),
      answer: v,
      explanation: (
        <>
          {p.sign > 0 ? (
            <>
              The charge is positive, so v × B points the same way as <Q k="F">F</Q>: {ph(thumb)}.{' '}
            </>
          ) : (
            <>
              The charge is negative, so v × B points opposite to <Q k="F">F</Q>: {ph(thumb)}.{' '}
            </>
          )}
          {curlSentence(v, B)}
          So <Q k="v">v</Q> points {ph(v)}.
        </>
      ),
      hint: (
        <>
          <Q k="v">v</Q> is perpendicular to both <Q k="B">B</Q> and <Q k="F">F</Q>, so there are only two options. Try each: fingers along v, curl toward B.
        </>
      ),
      facts: { sign: p.sign, B, F },
    }
  },
}

// ---------------------------------------------------------------------------
// 4. charge-sign
// ---------------------------------------------------------------------------

const chargeSign: ProblemType = {
  id: 'charge-sign',
  category: 'charges',
  title: 'Positive or negative?',
  skill: 'Use the observed force to find the sign of the charge',
  generate(rng) {
    const sign: 1 | -1 = rng.chance() ? 1 : -1
    const B = pickField(rng)
    const v = rng.pick(perpTo(B))
    const F = forceDir(sign, v, B)!
    const t = toDir(cross(vec(v), vec(B)))!
    return {
      typeId: 'charge-sign',
      prompt: (
        <>
          A mystery particle moves {ph(v)} through a magnetic field <Q k="B">B</Q> pointing {ph(B)}, and the force <Q k="F">F</Q> on it points {ph(F)}. Is the charge positive or
          negative?
        </>
      ),
      diagram: regionDiagram('Mystery charge', `A particle of unknown sign moving ${ph(v)} in a field ${ph(B)} with force ${ph(F)}`, B, {
        x: CX,
        y: CY,
        sign: '?',
        vectors: [
          { q: 'v', dir: v },
          { q: 'F', dir: F },
        ],
        unknowns: [],
      }),
      choices: SIGN_CHOICES,
      answer: sign > 0 ? 'positive' : 'negative',
      explanation: (
        <>
          {curlSentence(v, B)}
          That is the force a positive charge would feel. The actual <Q k="F">F</Q> points {ph(F)}, which is{' '}
          {F === t ? 'the same direction, so the charge is positive.' : 'the opposite direction, so the charge is negative.'}
        </>
      ),
      hint: (
        <>
          Work out the force a <i>positive</i> charge would feel. If the real force matches, it's positive; if it's reversed, it's negative.
        </>
      ),
      facts: { v, B, F },
    }
  },
}

// ---------------------------------------------------------------------------
// 5. charge-circle
// ---------------------------------------------------------------------------

const chargeCircle: ProblemType = {
  id: 'charge-circle',
  category: 'charges',
  title: 'Circular motion in a field',
  skill: 'Find which way a charge circles in a uniform field',
  generate(rng) {
    const p = pickParticle(rng)
    const B = rng.pick<Dir>(['in', 'out'])
    const v = rng.pick(IN_PLANE_DIRS)
    const F = forceDir(p.sign, v, B)!
    // position of the charge relative to the circle's center is opposite to F
    const r = scale(vec(F), -1)
    const z = cross(r, vec(v))[2]
    const answer = z > 0 ? 'ccw' : 'cw'
    // horizontal offset chosen independently of F (a whole number of grid
    // spacings), so the charge's position never hints at where the center is
    const x = CX + rng.pick([-112, 0, 112])
    const y = CY
    return {
      typeId: 'charge-circle',
      prompt: (
        <>
          {cap(p.article)} moves {ph(v)} in a uniform magnetic field <Q k="B">B</Q> {ph(B)}. As seen looking at the page, does it circle clockwise or counterclockwise?
        </>
      ),
      diagram: regionDiagram('Charge circling in a uniform field', `A ${p.name} moving ${ph(v)} in a field ${ph(B)}`, B, {
        x,
        y,
        sign: signChar(p.sign),
        name: p.name,
        vectors: [{ q: 'v', dir: v }],
        unknowns: [],
      }),
      choices: ROTATION_CHOICES,
      answer,
      explanation: (
        <>
          The magnetic force always points toward the center of the circle. {curlSentence(v, B)}
          {signSentence(p.sign, v, B)} Moving {ph(v)} while being pulled {ph(F)}, the charge turns{' '}
          {answer === 'cw' ? 'clockwise' : 'counterclockwise'} as seen looking at the page.
        </>
      ),
      hint: (
        <>
          First find the force <Q k="F">F</Q> = qv × B right now. The charge always turns toward <Q k="F">F</Q>.
        </>
      ),
      facts: { sign: p.sign, v, B },
    }
  },
}

// ---------------------------------------------------------------------------
// 6. charge-magnet
// ---------------------------------------------------------------------------

type Side = 'left' | 'right' | 'up' | 'down'

const chargeMagnet: ProblemType = {
  id: 'charge-magnet',
  category: 'charges',
  title: 'Charge near a bar magnet',
  skill: 'Read B from a magnet, then use F = qv × B',
  generate(rng) {
    const p = pickParticle(rng)
    // which side of the magnet the charge sits on, and which pole faces it
    const chargeOffset = rng.pick<Side>(['left', 'right', 'up', 'down'])
    const chargeSide: 'N' | 'S' = rng.chance() ? 'N' : 'S'
    const north: Side = chargeSide === 'N' ? chargeOffset : (opposite(chargeOffset) as Side)
    // B outside points away from N and toward S; on the axis that is along S→N
    const B: Dir = chargeSide === 'N' ? chargeOffset : opposite(chargeOffset)
    const roll = rng.next()
    const v: Dir = roll < 0.15 ? rng.pick<Dir>([B, opposite(B)]) : roll < 0.55 ? rng.pick<Dir>(['in', 'out']) : rng.pick(perpTo(B).filter(isInPlane))
    const F = forceDir(p.sign, v, B)
    const answer = F ?? 'zero'

    // ---- layout (screen coords) ----
    const horizontal = chargeOffset === 'left' || chargeOffset === 'right'
    const L = 180
    const D = 165 // pole face → charge
    let H: number
    let mx: number
    let my: number
    if (horizontal) {
      H = 380
      my = 190
      mx = chargeOffset === 'right' ? 220 : 460
    } else {
      H = 560
      mx = 340
      my = chargeOffset === 'up' ? 120 + D + L / 2 : H - 120 - D - L / 2
    }
    const poles = barMagnetPoles({ cx: mx, cy: my, length: L, north })
    const face = chargeSide === 'N' ? poles.N : poles.S
    const [ox, oy] = [{ left: -1, right: 1, up: 0, down: 0 }[chargeOffset], { left: 0, right: 0, up: -1, down: 1 }[chargeOffset]]
    const x = face.x + ox * D
    const y = face.y + oy * D
    const towardMagnet = { right: ['UL', 'DL'], left: ['UR', 'DR'], up: ['DL', 'DR'], down: ['UL', 'UR'] }[chargeOffset] as ('UL' | 'DL' | 'UR' | 'DR')[]
    const { el, avoid } = layoutCharge({
      x,
      y,
      sign: signChar(p.sign),
      name: p.name,
      vectors: [{ q: 'v', dir: v }],
      unknowns: ['F'],
      arrowLen: 66,
      // keep labels off the magnet side when v doesn't need the slots
      blockedDiag: isInPlane(v) ? towardMagnet : [towardMagnet[0]],
    })
    // axial line reach beyond each face
    const edge = (pt: { x: number; y: number }, dir: number) => {
      // distance from pt to the canvas edge (minus margin) along ±axis
      if (horizontal) return dir > 0 ? 680 - 24 - pt.x : pt.x - 24
      return dir > 0 ? H - 16 - pt.y : pt.y - 16
    }
    // axis unit S→N in screen coords
    const aS = horizontal ? (poles.N.x > poles.S.x ? 1 : -1) : poles.N.y > poles.S.y ? 1 : -1
    const reachN = edge(poles.N, aS)
    const reachS = edge(poles.S, -aS)
    const where = chargeSide === 'N' ? 'just beyond the north pole' : 'just beyond the south pole'

    return {
      typeId: 'charge-magnet',
      prompt: (
        <>
          {cap(p.article)} sits on the axis of a bar magnet, {where}, moving {ph(v)}. Which way is the magnetic force <Q k="F">F</Q> on it?
        </>
      ),
      diagram: (
        <Diagram height={H} title="Charge near a bar magnet" desc={`A ${p.name} beyond the ${chargeSide} pole moving ${ph(v)}`}>
          <MagnetField N={poles.N} S={poles.S} reach={{ N: reachN, S: reachS }} avoid={avoid.filter((a) => !a.bridge && !a.gridOnly)} />
          <BarMagnet cx={mx} cy={my} length={L} north={north} />
          {el}
        </Diagram>
      ),
      choices: dirChoices({ zero: true }),
      answer,
      explanation: (
        <>
          Outside a magnet, <Q k="B">B</Q> points away from N and toward S, so at the charge <Q k="B">B</Q> points {ph(B)}.{' '}
          {F ? (
            <>
              {curlSentence(v, B)}
              {signSentence(p.sign, v, B)}
            </>
          ) : (
            <>
              <Q k="v">v</Q> is along <Q k="B">B</Q> ({ph(v)}), so v × B = 0 and there is no magnetic force.
            </>
          )}
        </>
      ),
      hint: (
        <>
          First find <Q k="B">B</Q> at the charge: field lines leave N and enter S. Then use the right-hand rule.
        </>
      ),
      facts: { sign: p.sign, v, chargeOffset, chargeSide, north },
    }
  },
}

export const chargesTypes: ProblemType[] = [chargeForce, chargeFindB, chargeFindV, chargeSign, chargeCircle, chargeMagnet]
