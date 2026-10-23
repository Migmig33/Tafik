// The cycles still to run, shown on the active Study and Break screens. The session counts its
// rounds from 1, and a round is finished when its Break ends. So during a round, both its Study and
// its Break still count as remaining, and the number drops when the next round begins.

/** Cycles still to run, counting the one in progress. Zero when there is no schedule. */
export function remainingCycles({ currentRound, totalRounds }: { currentRound: number; totalRounds: number }): number {
  if (totalRounds <= 0) return 0;
  const round = Math.min(totalRounds, Math.max(1, currentRound));
  return totalRounds - round + 1;
}
