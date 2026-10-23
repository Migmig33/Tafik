import type { FocusMode } from "./store";

// The rules that decide what Home shows and how the centre button rises. They are pure, so the
// tests can check them without rendering anything.

/** Cycle mode is the single source of truth for which Home content is shown. */
export function showsCycleHome(focusMode: FocusMode): boolean {
  return focusMode === "cycle";
}

/**
 * Home is ready once its data has loaded and, on Normal Home, the card has nothing left to load.
 * CycleHome has no card, so it is ready as soon as its data is in.
 */
export function homeIsReady({
  dataReady,
  cycleMode,
  showcaseReady,
}: {
  dataReady: boolean;
  cycleMode: boolean;
  showcaseReady: boolean;
}): boolean {
  return dataReady && (cycleMode || showcaseReady);
}

/**
 * The Cycle header's streak pill shows a closed lock while a session is holding the apps, and an
 * open lock otherwise. It is the same lock the streak row uses for a locked day.
 */
export function streakLockState(sessionActive: boolean): "locked" | "unlocked" {
  return sessionActive ? "locked" : "unlocked";
}

/** The centre button rises while a card read is open, or while a Cycle session runs. */
export function centreRaised({ scanning, cycleActive }: { scanning: boolean; cycleActive: boolean }): boolean {
  return scanning || cycleActive;
}

