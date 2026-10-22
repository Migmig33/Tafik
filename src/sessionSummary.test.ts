// @ts-nocheck
// Run with: node --experimental-strip-types src/sessionSummary.test.ts
import assert from "node:assert/strict";
import { sessionSummary } from "./sessionFacts.ts";

const tests = [
  ["TAFIK session shows its blocked time", () => {
    const s = sessionSummary({ mode: "tafik", date: "2026-10-23", minutes: 25 });
    assert.equal(s.title, "TAFIK session");
    assert.equal(s.duration, "25 min");
    assert.equal(s.detail, "Apps blocked for 25 minutes.");
    assert.equal(s.date, "Oct 23, 2026");
  }],
  ["one minute uses the singular", () => {
    assert.equal(sessionSummary({ mode: "tafik", date: "2026-10-23", minutes: 1 }).detail, "Apps blocked for 1 minute.");
  }],
  ["under a minute is said plainly", () => {
    const s = sessionSummary({ mode: "tafik", date: "2026-10-23", minutes: 0 });
    assert.equal(s.duration, "Under a minute");
    assert.equal(s.detail, "Apps blocked for under a minute.");
  }],
  ["Tempo shows study time and rounds", () => {
    const s = sessionSummary({ mode: "cycle", date: "2026-10-23", minutes: 50, rounds: { done: 2, total: 2 } });
    assert.equal(s.title, "Tempo session");
    assert.equal(s.duration, "50 min");
    assert.equal(s.detail, "Study time 50 min · 2 of 2 rounds");
  }],
  ["Tempo without a round count omits rounds", () => {
    assert.equal(sessionSummary({ mode: "cycle", date: "2026-10-23", minutes: 25 }).detail, "Study time 25 min");
  }],
  ["summary never names start or end times or apps", () => {
    const s = sessionSummary({ mode: "tafik", date: "2026-10-23", minutes: 25 });
    const text = JSON.stringify(s);
    assert.equal(/start|end time|apps? blocked: \d|\bfrom\b|\bto\b/i.test(text.replace("Apps blocked for", "")), false);
  }],
];

let failed = 0;
for (const [name, run] of tests) {
  try { run(); console.log("PASS", name); }
  catch (error) { failed += 1; console.log("FAIL", name, error.message); }
}
console.log(`${tests.length - failed}/${tests.length} passed`);
if (failed) process.exit(1);
