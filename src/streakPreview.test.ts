// @ts-nocheck
// Run with: node --experimental-strip-types src/streakPreview.test.ts
import assert from "node:assert/strict";
import { streakPreviewFor } from "./streakPreview.ts";

const tests = [
  ["the preview is off by default", () => assert.equal(streakPreviewFor("off", false), null)],
  ["zero: the count is zero and today is not completed", () => {
    const p = streakPreviewFor("zero", false);
    assert.equal(p.streak, 0);
    assert.equal(p.doneToday, false);
    assert.equal(p.week[4].isToday, true);
  }],
  ["zero: earlier days are missed and later days upcoming", () => {
    const p = streakPreviewFor("zero", false);
    assert.equal(p.week[0].earned, false);
    assert.equal(p.week[0].isFuture, false);
    assert.equal(p.week[5].isFuture, true);
  }],
  ["mid-week: Tuesday is a missed gap between completed days", () => {
    const p = streakPreviewFor("midWeek", false);
    assert.equal(p.week[2].earned, false);
    assert.equal(p.week[2].isFuture, false);
    assert.equal(p.week[3].earned, true);
  }],
  ["mid-week: today is completed and the streak counts back to the gap", () => {
    const p = streakPreviewFor("midWeek", false);
    assert.equal(p.doneToday, true);
    assert.equal(p.streak, 2);
  }],
  ["full week: every day is completed, with today identifiable", () => {
    const p = streakPreviewFor("fullWeek", false);
    assert.ok(p.week.every((day) => day.earned));
    assert.equal(p.week[6].isToday, true);
    assert.equal(p.streak, 7);
  }],
  ["completion: before, today is open and the count is zero", () => {
    const p = streakPreviewFor("completion", false);
    assert.equal(p.doneToday, false);
    assert.equal(p.streak, 0);
  }],
  ["completion: after, today is completed and the count is five", () => {
    const p = streakPreviewFor("completion", true);
    assert.equal(p.doneToday, true);
    assert.equal(p.streak, 5);
    assert.equal(p.week[4].isToday, true);
  }],
];
let failed = 0;
for (const [name, run] of tests) {
  try { run(); console.log("PASS", name); }
  catch (error) { failed += 1; console.log("FAIL", name, error.message); }
}
console.log(`${tests.length - failed}/${tests.length} passed`);
if (failed) process.exit(1);
