import type { Rng } from '../rng'
import type { Choice, CoilView, GenOptions, Problem, ProblemType } from './types'
import { dirChoices, ROTATION_CHOICES } from './types'
import { Q } from './Q'
import { COLORS } from '../theme'
import { type Dir, cross, opposite, toDir, vec, DIR_PHRASE } from '../physics/vec'
import { Diagram, OutSymbol, InSymbol, VecLabel, Caption, Label } from '../diagram/primitives'
import {
  Solenoid,
  solenoidGeometry,
  Loop,
  EndOnCoil,
  END_ON_CAPTION,
  Compass,
  PoleLetter,
  type SolenoidGeometry,
  type SolenoidOrient,
  type SolenoidProps,
} from '../diagram/coils'

type Rot = 'cw' | 'ccw'
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

/** B inside a solenoid whose near side (+z) carries current in in-plane page direction d. */
function solenoidField(nearCurrent: Dir): Dir {
  return toDir(cross(vec('out'), vec(nearCurrent)))!
}

// ---------------------------------------------------------------------------
// Layout helpers
// ---------------------------------------------------------------------------

/** The coil views a solenoid problem can use, honoring the settings (falls back to all it supports). */
function pickView(rng: Rng, supported: CoilView[], opts?: GenOptions): CoilView {
  const ok = supported.filter((v) => !opts?.views || opts.views.includes(v))
  return rng.pick(ok.length ? ok : supported)
}

interface CoilLayout {
  sol: SolenoidProps
  g: SolenoidGeometry
  height: number
  /** canvas width: upright coils use a narrower canvas so they scale up on phones */
  width: number
  /** where to put a label on the free side of the coil (away from the leads), screen coords */
  free: { x: number; y: number; anchor: 'start' | 'middle' | 'end' }
}

/** Screen position + anchor for a label at side-view point (x, y), pushed outward along side-view ±y. */
function sideLabel(g: SolenoidGeometry, x: number, y: number, cx: number): { x: number; y: number; anchor: 'start' | 'middle' | 'end' } {
  const [sx, sy] = g.P(x, y)
  if (g.orient === 'h') return { x: sx, y: sy, anchor: 'middle' }
  return { x: sx, y: sy, anchor: sx > cx ? 'start' : sx < cx ? 'end' : 'middle' }
}

const UPRIGHT_W = 520

/**
 * Random solenoid placed on the 680 canvas, side-on ('h') or upright ('v').
 * `endRoom` reserves space beyond each end of the body along the axis (for
 * pole letters / a compass).
 */
function randomSolenoid(
  rng: Rng,
  orient: SolenoidOrient,
  opts: { current: 'forward' | 'backward' | 'none'; label?: string; unknownCurrent?: boolean; freeLabel?: boolean; markTurn?: boolean; endRoom?: number },
): CoilLayout {
  const vert = orient === 'v'
  const turns = vert ? rng.int(5, 6) : rng.int(5, 8)
  const R = rng.pick([62, 66, 70])
  const pitch = vert ? rng.pick([40, 42, 44]) : turns >= 7 ? rng.pick([44, 46, 48]) : rng.pick([48, 52, 56])
  const leads = rng.pick(['top', 'bottom'] as const)
  const bodyW = turns * pitch
  let cx: number
  let cy: number
  let height: number
  let captionY: number
  if (!vert) {
    const maxShift = Math.max(0, (680 - bodyW) / 2 - 150)
    cx = 340 + rng.int(-Math.floor(maxShift), Math.floor(maxShift))
    // vertical stack: [lead label][lead]...coil...[free label][caption]  (mirrored if leads at bottom)
    const leadSide = 52 // lead label sits 24px beyond the lead
    const freeSide = opts.markTurn ? 76 : opts.freeLabel ? 46 : 24
    const top = leads === 'top' ? leadSide : freeSide
    cy = top + R
    const bottomEdge = cy + R + (leads === 'bottom' ? leadSide - 8 : freeSide)
    captionY = bottomEdge + 18
    height = captionY + 22
  } else {
    // the axis runs down the page; leads (side-view top) come out on the right, or the left if 'bottom'
    const half = bodyW / 2 + Math.max(74, opts.endRoom ?? 0)
    cx = UPRIGHT_W / 2 + rng.int(-30, 30)
    cy = 16 + half
    captionY = cy + half + 20
    height = captionY + 22
  }
  const sol: SolenoidProps = {
    cx,
    cy,
    orient,
    turns,
    radius: R,
    pitch,
    leads,
    current: opts.current,
    currentLabel: opts.label,
    unknownCurrent: opts.unknownCurrent,
    markTurn: opts.markTurn ? Math.floor((turns - 1) / 2) : undefined,
    captionY,
    captionX: vert ? UPRIGHT_W / 2 : undefined,
  }
  const g = solenoidGeometry(sol)
  const freeY = leads === 'top' ? cy + R + 28 : cy - R - 28
  return { sol, g, height, width: vert ? UPRIGHT_W : 680, free: sideLabel(g, (g.left + g.right) / 2, freeY, cx) }
}

/** Screen point on the axis, `gap` beyond the side-view left (-1) or right (+1) end. */
function beyondEnd(g: SolenoidGeometry, cy: number, end: -1 | 1, gap: number): [number, number] {
  return g.P(end < 0 ? g.axisLeft - gap : g.axisRight + gap, cy)
}

const END_WORD: Record<Dir, string> = { left: 'left', right: 'right', up: 'top', down: 'bottom', out: 'near', in: 'far' }

const VIEW_CAPTION: Record<SolenoidOrient, string> = { h: 'side', v: 'upright' }

/** Short sentence describing the right-hand grip for this solenoid. */
function gripSentence(near: Dir, b: Dir) {
  return (
    <>
      Wrap your right hand around the coil with your fingers following the <Q k="I">current</Q> — {DIR_PHRASE[near]} across the front (solid)
      side, back {DIR_PHRASE[opposite(near)]} behind it. Your thumb points {DIR_PHRASE[b]}: that's <Q k="B">B</Q> inside.
    </>
  )
}

/** Answers for a coil current question: focused = what the view leaves open; full = every direction and both rotations. */
const COIL_CURRENT_FULL: Choice[] = [...dirChoices(), ...ROTATION_CHOICES]

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
  views: ['side', 'upright', 'end'],
  generate(rng, opts): Problem {
    const view = pickView(rng, ['side', 'upright', 'end'], opts)
    if (view === 'end') {
      const rot: Rot = rng.pick(['cw', 'ccw'] as const)
      const lay = loopLayout(rng)
      const B = loopCenterField(rot, 'right')
      const diagram = (
        <Diagram height={lay.height} title="Solenoid seen end-on" desc={`Looking straight down a solenoid's axis; current circulates ${ROT_WORD[rot]}.`}>
          <EndOnCoil cx={lay.cx} cy={lay.cy} r={lay.r} current={rot} gapAt={lay.gapAt} leadLength={lay.L} currentLabel="I" />
          <VecLabel x={lay.cx} y={lay.cy} symbol="B" color={COLORS.B} unknown />
          <Caption y={lay.captionY}>{END_ON_CAPTION}</Caption>
        </Diagram>
      )
      return {
        typeId: 'coil-solenoid-field',
        prompt: (
          <>
            You're looking straight down the axis of a solenoid. Its <Q k="I">current</Q> circulates {ROT_WORD[rot]} as you see it. Which way does{' '}
            <Q k="B">B</Q> point inside the coil?
          </>
        ),
        diagram,
        choices: dirChoices({ only: ['out', 'in'] }),
        fullChoices: dirChoices(),
        answer: B,
        hint: <>Curl the fingers of your right hand {ROT_WORD[rot]}, the way the current goes around. Your thumb shows B inside.</>,
        explanation: (
          <>
            Curl your right-hand fingers {ROT_WORD[rot]} around the coil, following the <Q k="I">current</Q>: your thumb points {DIR_PHRASE[B]}
            {B === 'out' ? ' (toward you)' : ' (away from you)'}. Inside a solenoid every turn adds its field the same way, so <Q k="B">B</Q> inside points{' '}
            {DIR_PHRASE[B]}.
          </>
        ),
        facts: { view, rotation: rot, drawn: { cx: lay.cx, cy: lay.cy, r: lay.r } },
      }
    }
    const flow = rng.pick(['forward', 'backward'] as const)
    const lay = randomSolenoid(rng, view === 'upright' ? 'v' : 'h', { current: flow, label: 'I', freeLabel: true })
    const near = lay.g.nearCurrent!
    const B = solenoidField(near)
    const diagram = (
      <Diagram height={lay.height} width={lay.width} title="Solenoid carrying current" desc={`Solenoid seen from the ${VIEW_CAPTION[lay.g.orient]}; current flows ${near} on the near side.`}>
        <Solenoid {...lay.sol} />
        <VecLabel x={lay.free.x} y={lay.free.y} anchor={lay.free.anchor} symbol="B inside" color={COLORS.B} unknown />
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
      choices: dirChoices({ only: [lay.g.axisDir, opposite(lay.g.axisDir)].sort((a, b) => ORDER.indexOf(a) - ORDER.indexOf(b)) }),
      answer: B,
      hint: (
        <>
          Look at the front (solid) wire: which way is the current going there? Curl your right fingers that way around the coil.
        </>
      ),
      explanation: (
        <>
          On the front (solid) side the <Q k="I">current</Q> runs {DIR_PHRASE[near]}. {gripSentence(near, B)}
        </>
      ),
      facts: { view, nearSide: 'out', nearCurrent: near, leads: lay.sol.leads, flow, turns: lay.sol.turns },
    }
  },
}

/** dirChoices order, so focused pads list e.g. up before down */
const ORDER: Dir[] = ['up', 'down', 'left', 'right', 'out', 'in']

// ---------------------------------------------------------------------------
// 4. coil-solenoid-poles
// ---------------------------------------------------------------------------

const END_CHOICES: Record<SolenoidOrient, Choice[]> = {
  h: [
    { id: 'end-left', label: 'Left end', glyph: '←' },
    { id: 'end-right', label: 'Right end', glyph: '→' },
  ],
  v: [
    { id: 'end-top', label: 'Top end', glyph: '↑' },
    { id: 'end-bottom', label: 'Bottom end', glyph: '↓' },
  ],
}

const solenoidPoles: ProblemType = {
  id: 'coil-solenoid-poles',
  category: 'coils',
  title: 'Poles of a solenoid',
  skill: 'Find which end of a current-carrying solenoid is its north pole.',
  views: ['side', 'upright'],
  generate(rng, opts): Problem {
    const view = pickView(rng, ['side', 'upright'], opts)
    const flow = rng.pick(['forward', 'backward'] as const)
    const lay = randomSolenoid(rng, view === 'upright' ? 'v' : 'h', { current: flow, label: 'I', endRoom: 60 })
    const g = lay.g
    const near = g.nearCurrent!
    const B = solenoidField(near)
    const cy = lay.sol.cy
    const [lx, ly] = beyondEnd(g, cy, -1, 46)
    const [rx, ry] = beyondEnd(g, cy, 1, 46)
    const diagram = (
      <Diagram height={lay.height} width={lay.width} title="Solenoid carrying current" desc={`Solenoid seen from the ${VIEW_CAPTION[g.orient]}; current flows ${near} on the near side. Which end is north?`}>
        <Solenoid {...lay.sol} />
        <PoleLetter x={lx} y={ly} pole="?" />
        <PoleLetter x={rx} y={ry} pole="?" />
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
      choices: END_CHOICES[g.orient],
      answer: `end-${END_WORD[B]}`,
      hint: <>Find the direction of B inside first. Field lines leave a magnet from its north end.</>,
      explanation: (
        <>
          On the front (solid) side the <Q k="I">current</Q> runs {DIR_PHRASE[near]}. {gripSentence(near, B)} Field lines come out of the north end, so the{' '}
          <b>{END_WORD[B]} end</b> is N.
        </>
      ),
      facts: { view, nearSide: 'out', nearCurrent: near, northToward: B, leads: lay.sol.leads, flow, turns: lay.sol.turns },
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
  views: ['side', 'upright', 'end'],
  generate(rng, opts): Problem {
    const view = pickView(rng, ['side', 'upright', 'end'], opts)
    if (view === 'end') {
      const facing = rng.pick(['N', 'S'] as const)
      const lay = loopLayout(rng)
      // B inside points toward the N end: out of the page if N faces you
      const B: Dir = facing === 'N' ? 'out' : 'in'
      const rot = (['cw', 'ccw'] as const).find((r) => loopCenterField(r, 'right') === B)!
      const diagram = (
        <Diagram height={lay.height} title="Solenoid seen end-on" desc={`Looking straight down a solenoid's axis; the end facing you is its ${facing} pole.`}>
          <EndOnCoil cx={lay.cx} cy={lay.cy} r={lay.r} current="none" gapAt={lay.gapAt} leadLength={lay.L} currentLabel="I" unknownCurrent />
          <PoleLetter x={lay.cx} y={lay.cy} pole={facing} />
          <Caption y={lay.captionY}>{END_ON_CAPTION}</Caption>
        </Diagram>
      )
      return {
        typeId: 'coil-solenoid-current',
        prompt: (
          <>
            You're looking straight down the axis of a solenoid, and the end facing you is its <b>{facing === 'N' ? 'north' : 'south'}</b> pole. Which way
            does the <Q k="I">current</Q> go around the coil, as you see it?
          </>
        ),
        diagram,
        choices: ROTATION_CHOICES,
        fullChoices: COIL_CURRENT_FULL,
        answer: rot,
        hint: <>Inside the coil, B points toward the N end. Is that toward you or away? Point your right thumb that way.</>,
        explanation: (
          <>
            Inside a solenoid <Q k="B">B</Q> points toward its north end, so <Q k="B">B</Q> inside points {DIR_PHRASE[B]}
            {B === 'out' ? ' (toward you)' : ' (away from you)'}. Point your right thumb that way: your fingers curl {ROT_WORD[rot]} as you see it, so the{' '}
            <Q k="I">current</Q> goes {ROT_WORD[rot]}.
          </>
        ),
        facts: { view, facing, north: B, nearSide: 'out' },
      }
    }
    const north = rng.pick([-1, 1] as const)
    const lay = randomSolenoid(rng, view === 'upright' ? 'v' : 'h', { current: 'none', markTurn: true, endRoom: 60 })
    const g = lay.g
    const cy = lay.sol.cy
    const northDir: Dir = north > 0 ? g.axisDir : opposite(g.axisDir)
    // which near-side direction produces B inside pointing toward north?
    const nearOpts = [...IN_PLANE].filter((d) => d !== g.axisDir && d !== opposite(g.axisDir))
    const near = nearOpts.find((d) => solenoidField(d) === northDir)!
    const [lx, ly] = beyondEnd(g, cy, -1, 46)
    const [rx, ry] = beyondEnd(g, cy, 1, 46)
    const diagram = (
      <Diagram height={lay.height} width={lay.width} title="Solenoid with marked poles" desc={`Solenoid seen from the ${VIEW_CAPTION[g.orient]}; the ${END_WORD[northDir]} end is the north pole.`}>
        <Solenoid {...lay.sol} />
        <PoleLetter x={lx} y={ly} pole={north < 0 ? 'N' : 'S'} />
        <PoleLetter x={rx} y={ry} pole={north > 0 ? 'N' : 'S'} />
      </Diagram>
    )
    return {
      typeId: 'coil-solenoid-current',
      prompt: (
        <>
          The {END_WORD[northDir]} end of this solenoid is its north pole. Look at the <b>front</b> of the coil — the solid wire, the part closest to you
          (highlighted). Which way is the <Q k="I">current</Q> flowing there?
        </>
      ),
      diagram,
      choices: dirChoices({ only: nearOpts.sort((a, b) => ORDER.indexOf(a) - ORDER.indexOf(b)) }),
      fullChoices: COIL_CURRENT_FULL,
      answer: near,
      hint: (
        <>
          Inside the coil, B points toward the N end. Point your right thumb that way and see which way your fingers go as they cross the front of the coil,
          the side facing you.
        </>
      ),
      explanation: (
        <>
          Inside a solenoid <Q k="B">B</Q> points toward its north end, so <Q k="B">B</Q> inside points {DIR_PHRASE[northDir]}. Point your right thumb{' '}
          {DIR_PHRASE[northDir]} and wrap your fingers around the coil: across the front (solid) side, closest to you, they go {DIR_PHRASE[near]}. So
          the <Q k="I">current</Q> in the front wire flows {DIR_PHRASE[near]} (and back {DIR_PHRASE[opposite(near)]} along the dashed wire behind).
        </>
      ),
      facts: { view, nearSide: 'out', north: northDir, leads: lay.sol.leads, turns: lay.sol.turns },
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
  views: ['side', 'upright'],
  generate(rng, opts): Problem {
    const view = pickView(rng, ['side', 'upright'], opts)
    const flow = rng.pick(['forward', 'backward'] as const)
    const endSide = rng.pick([-1, 1] as const)
    const lay = randomSolenoid(rng, view === 'upright' ? 'v' : 'h', { current: flow, label: 'I', endRoom: 96 })
    const g = lay.g
    const near = g.nearCurrent!
    const B = solenoidField(near)
    const cy = lay.sol.cy
    const endDir: Dir = endSide > 0 ? g.axisDir : opposite(g.axisDir)
    const [compX, compY] = beyondEnd(g, cy, endSide, 62)
    // B on the axis outside the end points away from the coil iff that end is N
    const towardCoil = B !== endDir
    // "compass" label goes on the side away from the lead terminals so it doesn't read as naming one
    const flip = lay.sol.leads === 'bottom'
    const lbl =
      g.orient === 'h'
        ? { x: compX, y: flip ? compY - 25 - 10 : compY + 25 + 16, anchor: 'middle' as const }
        : { x: compX + (flip ? 1 : -1) * (25 + 8), y: compY, anchor: flip ? ('start' as const) : ('end' as const) }
    const diagram = (
      <Diagram height={lay.height} width={lay.width} title="Solenoid and compass" desc={`Solenoid seen from the ${VIEW_CAPTION[g.orient]} with a compass on its axis at the ${END_WORD[endDir]} end.`}>
        <Solenoid {...lay.sol} showAxis />
        <Compass x={compX} y={compY} r={25} />
        <Label x={lbl.x} y={lbl.y} size={15} weight={500} anchor={lbl.anchor}>
          compass
        </Label>
      </Diagram>
    )
    return {
      typeId: 'coil-compass',
      prompt: (
        <>
          A compass sits on the axis just outside the {END_WORD[endDir]} end of the solenoid. Which way does the needle's <b>north</b> tip point?
        </>
      ),
      diagram,
      choices: dirChoices({ only: ['up', 'down', 'left', 'right'] }),
      answer: B,
      hint: <>A compass's north tip lines up with B. On the axis just outside the coil, B keeps going the same way it does inside.</>,
      explanation: (
        <>
          On the front (solid) side the <Q k="I">current</Q> runs {DIR_PHRASE[near]}, so by the right-hand grip rule <Q k="B">B</Q> inside points{' '}
          {DIR_PHRASE[B]}. On the axis just outside the {END_WORD[endDir]} end, the field continues {DIR_PHRASE[B]} (
          {towardCoil ? 'into the coil at its S end' : 'out of the coil from its N end'}). The north tip lines up with <Q k="B">B</Q>, so it points{' '}
          {DIR_PHRASE[B]}.
        </>
      ),
      facts: { view, nearSide: 'out', nearCurrent: near, compassEnd: endDir, leads: lay.sol.leads, flow, turns: lay.sol.turns },
    }
  },
}

export const coilsTypes: ProblemType[] = [loopCenter, loopCurrent, solenoidFieldType, solenoidPoles, solenoidCurrent, coilCompass]
