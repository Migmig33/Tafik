// The streak week's day states and labels, derived from each day's own record. Kept free of
// React Native so the rules can be tested directly with Node.
//
// Data source: getStreakWeek() in store.ts. Each day has `earned` (a qualifying session of at
// least five minutes that day), `isToday` and `isFuture`. That is enough to tell completed,
// missed, today and upcoming apart, so no count-only inference is needed.

/** The fields the week row needs for one day. */
export type StreakDayInput = { label: string; earned: boolean; isToday: boolean; isFuture: boolean };

export type DayState = "completed" | "missed" | "today" | "upcoming";

const FULL_NAMES: Record<string, string> = {
  Sun: "Sunday",
  Mon: "Monday",
  Tue: "Tuesday",
  Wed: "Wednesday",
  Thu: "Thursday",
  Fri: "Friday",
  Sat: "Saturday",
};

/**
 * Completed wins over everything: a day that earned the streak is completed, including today
 * once its action is done. Otherwise today is "today" (not completed yet), a future day is
 * upcoming, and any other unearned past day is missed.
 */
export function dayState(day: StreakDayInput): DayState {
  if (day.earned) return "completed";
  if (day.isToday) return "today";
  if (day.isFuture) return "upcoming";
  return "missed";
}

export function dayAccessibilityLabel(day: StreakDayInput): string {
  const name = FULL_NAMES[day.label] ?? day.label;
  switch (dayState(day)) {
    case "completed":
      return day.isToday ? `${name}, today, completed` : `${name}, completed`;
    case "today":
      return `${name}, today, not completed`;
    case "missed":
      return `${name}, missed`;
    case "upcoming":
      return `${name}, upcoming`;
  }
}

/** The counter's accessible label, with singular and plural wording handled. */
export function streakAccessibilityLabel(count: number): string {
  return `Current streak: ${count} ${count === 1 ? "day" : "days"}`;
}

/** True only on the change from today not completed to today completed. */
export function justCompleted(wasCompleted: boolean, isCompleted: boolean): boolean {
  return !wasCompleted && isCompleted;
}

/** The completion animation plays only for a real change, and never when reduce motion is on. */
export function shouldAnimateCompletion(wasCompleted: boolean, isCompleted: boolean, reduceMotion: boolean): boolean {
  return !reduceMotion && justCompleted(wasCompleted, isCompleted);
}
