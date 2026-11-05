import type { Rng } from '../rng'
import type { Choice, Problem, ProblemType } from './types'
import { dirChoices, ROTATION_CHOICES } from './types'
import { Q } from './Q'
import { COLORS } from '../theme'
import { type Dir, cross, toDir, vec, DIR_PHRASE } from '../physics/vec'
import { Diagram, OutSymbol, InSymbol, VecLabel, Caption, Label } from '../diagram/primitives'
import { Solenoid, solenoidGeometry, Loop, Compass, PoleLetter, type SolenoidProps } from '../diagram/coils'

type Rot = 'cw' | 'ccw'
type Side = 'left' | 'right'
type InPlane = 'right' | 'up' | 'left' | 'down'
const IN_PLANE: InPlane[] = ['right', 'up', 'left', 'down']

// a point on the loop named as a side of the loop (not a direction)
const SIDE_WORD: Record<InPlane, string> = { right: 'right', left: 'left', up: 'top', down: 'bottom' }
const ROT_WORD: Record<Rot, string> = { cw: 'clockwise', ccw: 'counterclockwise' }

// ---------------------------------------------------------------------------
// Physics (page coords: +x right, +y up, +z out of page)
// ---------------------------------------------------------------------------

/** Direction of the current at position `at` (relative to the loop center) for a loop in the page. */
function loopTangent(rot: Rot, at: InPlane): Dir {
  // ccw seen from +z: ω along +z, velocity = ω × r
  return toDir(cross(vec(rot === 'ccw' ? 'out' : 'in'), vec(at)))!
}

/** B at the center of a loop in the page, from one current element: r × dl (r from center to the element). */
function loopCenterField(rot: Rot, at: InPlane): Dir {
  return toDir(cross(vec(at), vec(loopTangent(rot, at))))!
}

/** B inside a solenoid whose near side (+z) carries current in page direction d. */
function solenoidField(nearCurrent: 'up' | 'down'): Side {
  return toDir(cross(vec('out'), vec(nearCurrent))) as Side
}

// ---------------------------------------------------------------------------
// Layout helpers
// ---------------------------------------------------------------------------

interface CoilLayout {
  sol: SolenoidProps
  height: number
  /** y for a label on the side of the coil away from the leads */
  freeLabelY: number
}

/**
 * Random solenoid placed on the 680 canvas. `endRoom` reserves horizontal
 * space beyond each body end (for pole letters / compass).
 */
function randomSolenoid(rng: Rng, opts: { current: 'forward' | 'backward' | 'none'; label?: string; unknownCurrent?: boolean; freeLabel?: boolean; markTurn?: boolean }): CoilLayout {
  const turns = rng.int(5, 8)
  const R = rng.pick([62, 66, 70])
  const pitch = turns >= 7 ? rng.pick([44, 46, 48]) : rng.pick([48, 52, 56])
  const leads = rng.pick(['top', 'bottom'] as const)
  const bodyW = turns * pitch
  const maxShift = Math.max(0, (680 - bodyW) / 2 - 150)
  const cx = 340 + rng.int(-Math.floor(maxShift), Math.floor(maxShift))
  // vertical stack: [lead label][lead]...coil...[free label][caption]  (mirrored if leads at bottom)
  const leadSide = 52 // lead label sits 24px beyond the lead
  const freeSide = opts.markTurn ? 76 : opts.freeLabel ? 46 : 24
  const top = leads === 'top' ? leadSide : freeSide
  const cy = top + R
  const bottomEdge = cy + R + (leads === 'bottom' ? leadSide - 8 : freeSide)
  const captionY = bottomEdge + 18
  const sol: SolenoidProps = {
    cx,
    cy,
    turns,
    radius: R,
    pitch,
    leads,
    current: opts.current,
    currentLabel: opts.label,
    unknownCurrent: opts.unknownCurrent,
    markTurn: opts.markTurn ? Math.floor((turns - 1) / 2) : undefined,
    captionY,
  }
  const freeLabelY = leads === 'top' ? cy + R + 28 : cy - R - 28
  return { sol, height: captionY + 22, freeLabelY }
}

const sideChoices: Choice[] = [
  { id: 'left', label: 'Left end', glyph: '←' },
  { id: 'right', label: 'Right end', glyph: '→' },
]
const UP_DOWN_CHOICES: Choice[] = dirChoices({ only: ['up', 'down'] })

/** Short sentence describing the right-hand grip for this solenoid. */
function gripSentence(near: 'up' | 'down', b: Side) {
  return (
    <>
      Wrap your right hand around the coil with your fingers following the <Q k="I">current</Q> — {near} the page across the front (solid)
      side, back {near === 'up' ? 'down' : 'up'} behind it. Your thumb points {DIR_PHRASE[b]}: that's <Q k="B">B</Q> inside.
    </>
  )
}

// ---------------------------------------------------------------------------
// 1. coil-loop-center
// ---------------------------------------------------------------------------

function loopLayout(rng: Rng) {
  const r = rng.pick([92, 100, 108, 116])
  const gapAt = rng.pick(IN_PLANE)
  const L = 50
  // reserve room for leads (+terminals) on the gap side and the label on the opposite side
  const padGap = L + 26
  const padLabel = 50
  const padSide = 24
  const top = gapAt === 'up' ? padGap : gapAt === 'down' ? padLabel : padSide
  const bottom = gapAt === 'down' ? padGap : gapAt === 'up' ? padLabel : padSide
  const cy = top + r
  const cx = 340 + rng.int(-90, 90)
  const height = cy + r + bottom + 30
  return { r, gapAt, cx, cy, height, captionY: height - 18, L }
}

const loopCenter: ProblemType = {
  id: 'coil-loop-center',
  category: 'coils',
  title: 'Field at the center of a loop',
  skill: 'Use the right-hand rule to find B at the center of a current loop.',
  generate(rng): Problem {
    const rot: Rot = rng.pick(['cw', 'ccw'] as const)
    const lay = loopLayout(rng)
    const sample = rng.pick(IN_PLANE.filter((d) => d !== lay.gapAt))
    const dl = loopTangent(rot, sample)
    const B = loopCenterField(rot, sample)
    const diagram = (
      <Diagram height={lay.height} title="Current loop in the page" desc={`A circular loop lying in the page carries current ${ROT_WORD[rot]}. Find B at the center.`}>
        <Loop cx={lay.cx} cy={lay.cy} r={lay.r} current={rot} gapAt={lay.gapAt} leadLength={lay.L} currentLabel="I" />
        <circle cx={lay.cx} cy={lay.cy} r={4} fill={COLORS.ink} />
        <VecLabel x={lay.cx} y={lay.cy - 24} symbol="B" color={COLORS.B} unknown />
        <Caption y={lay.captionY}>Loop lies flat in the page</Caption>
      </Diagram>
    )
    return {
      typeId: 'coil-loop-center',
      prompt: (
        <>
          The loop carries a <Q k="I">current</Q> {ROT_WORD[rot]} (as seen looking at the page). Which way does <Q k="B">B</Q> point at the center?
        </>
      ),
      diagram,
      choices: dirChoices(),
      answer: B,
      hint: <>Curl the fingers of your right hand the way the current goes around the loop. Your thumb shows B at the center.</>,
      explanation: (
        <>
          Curl your right-hand fingers {ROT_WORD[rot]} around the loop, following the <Q k="I">current</Q>: your thumb points {DIR_PHRASE[B]}. Check one spot:
          on the {SIDE_WORD[sample]} side the current runs {DIR_PHRASE[dl]}, and grabbing that wire with your thumb along it, your fingers pass through the center going{' '}
          {DIR_PHRASE[B]}. So <Q k="B">B</Q> at the center is {DIR_PHRASE[B]}.
        </>
      ),
      facts: { view: 'page', rotation: rot, gapAt: lay.gapAt, samplePoint: sample, sampleCurrent: dl, drawn: { cx: lay.cx, cy: lay.cy, r: lay.r } },
    }
  },
}

// ---------------------------------------------------------------------------
// 2. coil-loop-current
// ---------------------------------------------------------------------------

const loopCurrent: ProblemType = {
  id: 'coil-loop-current',
  category: 'coils',
  title: 'Current from the field of a loop',
  skill: 'Given B at the center of a loop, find which way the current circulates.',
  generate(rng): Problem {
    const B = rng.pick(['out', 'in'] as const)
    const lay = loopLayout(rng)
    const sample = rng.pick(IN_PLANE.filter((d) => d !== lay.gapAt))
    // find the rotation whose field at the center matches B
    const rot = (['cw', 'ccw'] as const).find((r) => loopCenterField(r, sample) === B)!
    const diagram = (
      <Diagram height={lay.height} title="Current loop in the page" desc={`A circular loop lies in the page. The field at its center points ${B} of the page.`}>
        <Loop cx={lay.cx} cy={lay.cy} r={lay.r} current="none" gapAt={lay.gapAt} leadLength={lay.L} currentLabel="I" unknownCurrent />
        {B === 'out' ? <OutSymbol x={lay.cx} y={lay.cy} r={16} color={COLORS.B} /> : <InSymbol x={lay.cx} y={lay.cy} r={16} color={COLORS.B} />}
        <VecLabel x={lay.cx + 26} y={lay.cy - 22} symbol="B" color={COLORS.B} anchor="start" />
        <Caption y={lay.captionY}>Loop lies flat in the page</Caption>
      </Diagram>
    )
    return {
      typeId: 'coil-loop-current',
      prompt: (
        <>
          At the center of the loop, <Q k="B">B</Q> points {DIR_PHRASE[B]}. Which way does the <Q k="I">current</Q> flow around the loop, as seen looking at the page?
        </>
      ),
      diagram,
      choices: ROTATION_CHOICES,
      answer: rot,
      hint: <>Point your right thumb along B at the center. Your curled fingers show the way the current goes around.</>,
      explanation: (
        <>
          Point your right thumb {DIR_PHRASE[B]} ({B === 'out' ? 'toward you' : 'away from you'}). Your fingers curl {ROT_WORD[rot]} as you
          look at the page, so the <Q k="I">current</Q> flows {ROT_WORD[rot]}. Check: on the {SIDE_WORD[sample]} side the current runs{' '}
          {DIR_PHRASE[loopTangent(rot, sample)]}, which makes B {DIR_PHRASE[B]} at the center.
        </>
      ),
      facts: { view: 'page', B, gapAt: lay.gapAt, samplePoint: sample },
    }
  },
}

// ---------------------------------------------------------------------------
// 3. coil-solenoid-field
// ---------------------------------------------------------------------------

const solenoidFieldType: ProblemType = {
  id: 'coil-solenoid-field',
  category: 'coils',
  title: 'Field inside a solenoid',
  skill: 'Use the right-hand grip rule to find B inside a solenoid.',
  generate(rng): Problem {
    const flow = rng.pick(['forward', 'backward'] as const)
    const lay = randomSolenoid(rng, { current: flow, label: 'I', freeLabel: true })
    const g = solenoidGeometry(lay.sol)
    const near = g.nearCurrent!
    const B = solenoidField(near)
    const diagram = (
      <Diagram height={lay.height} title="Solenoid carrying current" desc={`Solenoid seen from the side; current flows ${near} on the near side.`}>
        <Solenoid {...lay.sol} />
        <VecLabel x={(g.left + g.right) / 2} y={lay.freeLabelY} symbol="B inside" color={COLORS.B} unknown />
      </Diagram>
    )
    return {
      typeId: 'coil-solenoid-field',
      prompt: (
        <>
          A <Q k="I">current</Q> flows through the solenoid as shown. Which way does <Q k="B">B</Q> point inside the coil?
        </>
      ),
      diagram,
      choices: dirChoices(),
      answer: B,
      hint: <>Look at the solid (near) side: is the current going up or down there? Curl your right fingers that way around the coil.</>,
      explanation: (
        <>
          On the solid (near) side the <Q k="I">current</Q> runs {DIR_PHRASE[near]}. {gripSentence(near, B)}
        </>
      ),
      facts: { nearSide: 'out', nearCurrent: near, leads: lay.sol.leads, flow, turns: lay.sol.turns },
    }
  },
}

// ---------------------------------------------------------------------------
// 4. coil-solenoid-poles
// ---------------------------------------------------------------------------

const solenoidPoles: ProblemType = {
  id: 'coil-solenoid-poles',
  category: 'coils',
  title: 'Poles of a solenoid',
  skill: 'Find which end of a current-carrying solenoid is its north pole.',
  generate(rng): Problem {
    const flow = rng.pick(['forward', 'backward'] as const)
    const lay = randomSolenoid(rng, { current: flow, label: 'I' })
    const g = solenoidGeometry(lay.sol)
    const near = g.nearCurrent!
    const B = solenoidField(near)
    const cy = lay.sol.cy
    const diagram = (
      <Diagram height={lay.height} title="Solenoid carrying current" desc={`Solenoid seen from the side; current flows ${near} on the near side. Which end is north?`}>
        <Solenoid {...lay.sol} />
        <PoleLetter x={g.axisLeft - 46} y={cy} pole="?" />
        <PoleLetter x={g.axisRight + 46} y={cy} pole="?" />
      </Diagram>
    )
    return {
      typeId: 'coil-solenoid-poles',
      prompt: (
        <>
          A <Q k="I">current</Q> flows through the solenoid as shown. Which end acts as the <b>north</b> pole?
        </>
      ),
      diagram,
      choices: sideChoices,
      answer: B,
      hint: <>Find the direction of B inside first. Field lines leave a magnet from its north end.</>,
      explanation: (
        <>
          On the solid (near) side the <Q k="I">current</Q> runs {DIR_PHRASE[near]}. {gripSentence(near, B)} Field lines come out of the north end, so the{' '}
          <b>{B} end</b> is N.
        </>
      ),
      facts: { nearSide: 'out', nearCurrent: near, leads: lay.sol.leads, flow, turns: lay.sol.turns },
    }
  },
}

// ---------------------------------------------------------------------------
// 5. coil-solenoid-current
// ---------------------------------------------------------------------------

const solenoidCurrent: ProblemType = {
  id: 'coil-solenoid-current',
  category: 'coils',
  title: 'Current from the poles',
  skill: 'Given the north pole of a solenoid, find the current direction.',
  generate(rng): Problem {
    const north = rng.pick(['left', 'right'] as const)
    const lay = randomSolenoid(rng, { current: 'none', markTurn: true })
    const g = solenoidGeometry(lay.sol)
    const cy = lay.sol.cy
    // which near-side direction produces B inside pointing toward north?
    const near = (['up', 'down'] as const).find((d) => solenoidField(d) === north)!
    const diagram = (
      <Diagram height={lay.height} title="Solenoid with marked poles" desc={`Solenoid seen from the side; the ${north} end is the north pole.`}>
        <Solenoid {...lay.sol} />
        <PoleLetter x={g.axisLeft - 46} y={cy} pole={north === 'left' ? 'N' : 'S'} />
        <PoleLetter x={g.axisRight + 46} y={cy} pole={north === 'right' ? 'N' : 'S'} />
      </Diagram>
    )
    return {
      typeId: 'coil-solenoid-current',
      prompt: (
        <>
          The {north} end of this solenoid is its north pole. Look at the <b>front</b> of the coil — the solid wire, the part closest to you
          (highlighted). Is the <Q k="I">current</Q> there flowing up or down the page?
        </>
      ),
      diagram,
      choices: UP_DOWN_CHOICES,
      answer: near,
      hint: (
        <>
          Inside the coil, B points toward the N end. Point your right thumb that way and see which way your fingers go as they cross the front of the coil,
          the side facing you.
        </>
      ),
      explanation: (
        <>
          Inside a solenoid <Q k="B">B</Q> points toward its north end, so <Q k="B">B</Q> inside points {DIR_PHRASE[north]}. Point your right thumb{' '}
          {DIR_PHRASE[north]} and wrap your fingers around the coil: across the front (solid) side, closest to you, they go {DIR_PHRASE[near]}. So
          the <Q k="I">current</Q> in the front wire flows {DIR_PHRASE[near]} (and back {near === 'up' ? 'down' : 'up'} along the dashed wire behind).
        </>
      ),
      facts: { nearSide: 'out', north, leads: lay.sol.leads, turns: lay.sol.turns },
    }
  },
}

// ---------------------------------------------------------------------------
// 6. coil-compass
// ---------------------------------------------------------------------------

const coilCompass: ProblemType = {
  id: 'coil-compass',
  category: 'coils',
  title: 'Compass near a solenoid',
  skill: 'Predict which way a compass points on the axis of a solenoid.',
  generate(rng): Problem {
    const flow = rng.pick(['forward', 'backward'] as const)
    const end = rng.pick(['left', 'right'] as const)
    const lay = randomSolenoid(rng, { current: flow, label: 'I' })
    const g = solenoidGeometry(lay.sol)
    const near = g.nearCurrent!
    const B = solenoidField(near)
    const cy = lay.sol.cy
    const compassX = end === 'left' ? g.axisLeft - 62 : g.axisRight + 62
    const towardCoil = (end === 'left' && B === 'right') || (end === 'right' && B === 'left')
    const diagram = (
      <Diagram height={lay.height} title="Solenoid and compass" desc={`Solenoid seen from the side with a compass on its axis at the ${end} end.`}>
        <Solenoid {...lay.sol} showAxis />
        <Compass x={compassX} y={cy} r={25} />
        {/* label goes on the side away from the lead terminals so it doesn't read as naming one */}
        <Label x={compassX} y={lay.sol.leads === 'bottom' ? cy - 25 - 10 : cy + 25 + 16} size={15} weight={500}>
          compass
        </Label>
      </Diagram>
    )
    return {
      typeId: 'coil-compass',
      prompt: (
        <>
          A compass sits on the axis just outside the {end} end of the solenoid. Which way does the needle's <b>north</b> tip point?
        </>
      ),
      diagram,
      choices: dirChoices({ only: ['up', 'down', 'left', 'right'] }),
      answer: B,
      hint: <>A compass's north tip lines up with B. On the axis just outside the coil, B keeps going the same way it does inside.</>,
      explanation: (
        <>
          On the solid (near) side the <Q k="I">current</Q> runs {DIR_PHRASE[near]}, so by the right-hand grip rule <Q k="B">B</Q> inside points{' '}
          {DIR_PHRASE[B]}. On the axis just outside the {end} end, the field continues {DIR_PHRASE[B]} ({towardCoil ? 'into the coil at its S end' : 'out of the coil from its N end'}
          ). The north tip lines up with <Q k="B">B</Q>, so it points {DIR_PHRASE[B]}.
        </>
      ),
      facts: { nearSide: 'out', nearCurrent: near, compassEnd: end, leads: lay.sol.leads, flow, turns: lay.sol.turns },
    }
  },
}

export const coilsTypes: ProblemType[] = [loopCenter, loopCurrent, solenoidFieldType, solenoidPoles, solenoidCurrent, coilCompass]
