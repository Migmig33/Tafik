// @ts-nocheck
import assert from "node:assert/strict";
import { remainingCycles } from "./cycleCount.ts";

let passed = 0;
function check(name, fn) {
  fn();
  passed += 1;
  console.log(`PASS ${name}`);
}

check("the first round, in Study or Break, leaves every cycle to run", () => {
  assert.equal(remainingCycles({ currentRound: 1, totalRounds: 3 }), 3);
});

check("the count drops when the next round begins", () => {
  assert.equal(remainingCycles({ currentRound: 2, totalRounds: 3 }), 2);
  assert.equal(remainingCycles({ currentRound: 3, totalRounds: 3 }), 1);
});

check("a single round shows one remaining", () => {
  assert.equal(remainingCycles({ currentRound: 1, totalRounds: 1 }), 1);
});

check("no schedule shows zero", () => {
  assert.equal(remainingCycles({ currentRound: 0, totalRounds: 0 }), 0);
});

check("a round past the end is clamped, so the count never goes negative", () => {
  assert.equal(remainingCycles({ currentRound: 9, totalRounds: 3 }), 1);
  assert.equal(remainingCycles({ currentRound: 0, totalRounds: 3 }), 3);
});

console.log(`${passed}/${passed} passed`);
