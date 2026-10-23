// Development-only streak fixtures, for screenshots of each streak case. The Home screen uses these
// only when the development switch in devTest.ts is set; in release builds that switch is "off".
// Dates are fixed as day positions in a week (Sunday = 0), so nothing depends on the real date.

export type PreviewCase = "off" | "zero" | "midWeek" | "fullWeek" | "completion";

export type PreviewDay = { key: string; label: string; earned: boolean; isToday: boolean; isFuture: boolean };

export type PreviewResult = { week: PreviewDay[]; streak: number; doneToday: boolean };

const LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const TODAY_THURSDAY = 4;
const TODAY_SATURDAY = 6;
// How long the completion case waits before today's action completes, in milliseconds.
export const COMPLETION_PREVIEW_DELAY_MS = 4000;

/** Builds a week from which days are earned, with today at a fixed position. */
function buildWeek(todayIndex: number, earnedDays: number[]): PreviewResult {
  const week: PreviewDay[] = LABELS.map((label, index) => ({
    key: `preview-${index}`,
    label,
    earned: index <= todayIndex && earnedDays.includes(index),
    isToday: index === todayIndex,
    isFuture: index > todayIndex,
  }));
  // The streak counts back from today while each day is earned, as the store does.
  let streak = 0;
  for (let index = todayIndex; index >= 0 && week[index].earned; index -= 1) streak += 1;
  return { week, streak, doneToday: week[todayIndex].earned };
}

/**
 * The preview state for a case. `completedNow` is only used by the completion case, to show
 * today before and after its action completes. Returns null when the preview is off.
 */
export function streakPreviewFor(preview: PreviewCase, completedNow: boolean): PreviewResult | null {
  switch (preview) {
    case "zero":
      // Today not completed, earlier days missed, later days upcoming: no streak yet.
      return buildWeek(TODAY_THURSDAY, []);
    case "midWeek":
      // Sunday and Monday missed in turn; Tuesday missed, Wednesday and today completed.
      return buildWeek(TODAY_THURSDAY, [0, 1, 3, 4]);
    case "fullWeek":
      // Every day completed, with Saturday as today.
      return buildWeek(TODAY_SATURDAY, [0, 1, 2, 3, 4, 5, 6]);
    case "completion":
      // Before: Sunday to Wednesday done, today open, count zero. After: today done, count five.
      return buildWeek(TODAY_THURSDAY, completedNow ? [0, 1, 2, 3, 4] : [0, 1, 2, 3]);
    default:
      return null;
  }
}
