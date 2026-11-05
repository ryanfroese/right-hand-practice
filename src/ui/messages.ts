const pick = <T,>(xs: readonly T[]): T => xs[Math.floor(Math.random() * xs.length)]

const CORRECT = ['Nice!', 'Nailed it!', 'Spot on!', 'Yes! That’s it.', 'Exactly right!', 'Great hand-work!', 'Correct!', 'Smooth!']
const WRONG = [
  'Not quite — you’ve got this.',
  'Close! Check the rule below.',
  'Almost. Let’s walk through it.',
  'Good try — every miss teaches something.',
  'Not this time — you’ll get the next one.',
]

/** Returns [headline, isStreakCallout]. `streak` is the streak AFTER this answer. */
export function correctMessage(streak: number): [string, boolean] {
  if (streak === 3) return ['3 in a row! You’re warming up.', true]
  if (streak === 5) return ['5 in a row! On fire!', true]
  if (streak === 10) return ['10 streak! Right-hand master!', true]
  if (streak > 10 && streak % 5 === 0) return [`${streak} in a row! Unstoppable!`, true]
  return [pick(CORRECT), false]
}

export function wrongMessage(lostStreak: number): string {
  if (lostStreak >= 3) return `Streak of ${lostStreak} ended — shake it off!`
  return pick(WRONG)
}
