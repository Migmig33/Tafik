// @ts-nocheck
// Run with: node --experimental-strip-types src/streakDays.test.ts
// Fixtures are fixed day records, so the tests do not depend on today's date or timezone.
import assert from "node:assert/strict";
import {
  dayAccessibilityLabel,
  dayState,
  justCompleted,
  shouldAnimateCompletion,
  streakAccessibilityLabel,
} from "./streakDays.ts";

const completed = { label: "Fri", earned: true, isToday: false, isFuture: false };
const missed = { label: "Wed", earned: false, isToday: false, isFuture: false };
const todayOpen = { label: "Thu", earned: false, isToday: true, isFuture: false };
const todayDone = { label: "Thu", earned: true, isToday: true, isFuture: false };
const upcoming = { label: "Sat", earned: false, isToday: false, isFuture: true };

// A mid-week streak with a missed day: Sunday, Monday and Wednesday earned; Tuesday missed;
// today (Thursday) not yet completed; Friday and Saturday upcoming.
const midWeek = [
  { label: "Sun", earned: true, isToday: false, isFuture: false },
  { label: "Mon", earned: true, isToday: false, isFuture: false },
  { label: "Tue", earned: false, isToday: false, isFuture: false },
  { label: "Wed", earned: true, isToday: false, isFuture: false },
  todayOpen,
  { label: "Fri", earned: false, isToday: false, isFuture: true },
  { label: "Sat", earned: false, isToday: false, isFuture: true },
];

const tests = [
  ["a completed day is completed", () => assert.equal(dayState(completed), "completed")],
  ["a missed day is missed", () => assert.equal(dayState(missed), "missed")],
  ["today, not completed, is today", () => assert.equal(dayState(todayOpen), "today")],
  ["an upcoming day is upcoming", () => assert.equal(dayState(upcoming), "upcoming")],
  ["today, once completed, is completed and still marked today", () => {
    assert.equal(dayState(todayDone), "completed");
    assert.equal(todayDone.isToday, true);
  }],
  ["a completed day's label says completed", () => assert.equal(dayAccessibilityLabel(completed), "Friday, completed")],
  ["a missed day's label says missed", () => assert.equal(dayAccessibilityLabel(missed), "Wednesday, missed")],
  ["today's label says not completed", () => assert.equal(dayAccessibilityLabel(todayOpen), "Thursday, today, not completed")],
  ["an upcoming day's label says upcoming", () => assert.equal(dayAccessibilityLabel(upcoming), "Saturday, upcoming")],
  ["completed today says both today and completed", () => assert.equal(dayAccessibilityLabel(todayDone), "Thursday, today, completed")],
  ["a zero streak reads zero days", () => assert.equal(streakAccessibilityLabel(0), "Current streak: 0 days")],
  ["one day is singular", () => assert.equal(streakAccessibilityLabel(1), "Current streak: 1 day")],
  ["sixteen days is plural", () => assert.equal(streakAccessibilityLabel(16), "Current streak: 16 days")],
  ["mid-week: Sunday completed", () => assert.equal(dayState(midWeek[0]), "completed")],
  ["mid-week: Tuesday, a gap in the streak, is missed", () => assert.equal(dayState(midWeek[2]), "missed")],
  ["mid-week: Wednesday completed after the gap", () => assert.equal(dayState(midWeek[3]), "completed")],
  ["mid-week: today is today, not completed", () => assert.equal(dayState(midWeek[4]), "today")],
  ["mid-week: Friday is upcoming", () => assert.equal(dayState(midWeek[5]), "upcoming")],
  ["the completion transition fires only on the change to completed", () => {
    assert.equal(justCompleted(false, true), true);
    assert.equal(justCompleted(true, true), false);
    assert.equal(justCompleted(true, false), false);
    assert.equal(justCompleted(false, false), false);
  }],
  ["reduce motion skips the completion animation", () => assert.equal(shouldAnimateCompletion(false, true, true), false)],
  ["without reduce motion, the change to completed animates", () => assert.equal(shouldAnimateCompletion(false, true, false), true)],
];
let failed = 0;
for (const [name, run] of tests) {
  try { run(); console.log("PASS", name); }
  catch (error) { failed += 1; console.log("FAIL", name, error.message); }
}
console.log(`${tests.length - failed}/${tests.length} passed`);
if (failed) process.exit(1);
