import type { ProblemType } from './types'
import { chargesTypes } from './charges'
import { wiresTypes } from './wires'
import { coilsTypes } from './coils'
import { lenzTypes } from './lenz'

export const PROBLEM_TYPES: ProblemType[] = [...chargesTypes, ...wiresTypes, ...coilsTypes, ...lenzTypes]

export const getType = (id: string) => PROBLEM_TYPES.find((t) => t.id === id)
