// @ts-nocheck
import assert from "node:assert/strict";
import { formatClock } from "./timeFormat.ts";

let passed = 0;
function check(name, fn) {
  fn();
  passed += 1;
  console.log(`PASS ${name}`);
}

check("under a minute shows seconds only, with no leading zeros", () => {
  assert.equal(formatClock(20), "20");
  assert.equal(formatClock(59), "59");
  assert.equal(formatClock(5), "5");
});

check("zero shows as a bare zero", () => {
  assert.equal(formatClock(0), "0");
});

check("a minute or more shows minutes and two-digit seconds", () => {
  assert.equal(formatClock(60), "1:00");
  assert.equal(formatClock(12 * 60 + 9), "12:09");
  assert.equal(formatClock(59 * 60 + 59), "59:59");
});

check("an hour or more shows hours, and two digits for minutes and seconds", () => {
  assert.equal(formatClock(3600), "1:00:00");
  assert.equal(formatClock(3600 + 2 * 60 + 9), "1:02:09");
  assert.equal(formatClock(2 * 3600 + 15 * 60 + 30), "2:15:30");
});

check("a negative value reads as zero, never below it", () => {
  assert.equal(formatClock(-1), "0");
  assert.equal(formatClock(-3600), "0");
});

check("fractions of a second are dropped, not rounded up", () => {
  assert.equal(formatClock(59.9), "59");
  assert.equal(formatClock(60.4), "1:00");
});

console.log(`${passed}/${passed} passed`);
