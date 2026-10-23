// @ts-nocheck
import assert from "node:assert/strict";
import { centreRaised, homeIsReady, showsCycleHome, streakLockState } from "./homeMode.ts";

let passed = 0;
function check(name, fn) {
  fn();
  passed += 1;
  console.log(`PASS ${name}`);
}

check("Cycle mode selects CycleHome, Tafik mode selects Normal Home", () => {
  assert.equal(showsCycleHome("cycle"), true);
  assert.equal(showsCycleHome("tafik"), false);
});

check("Normal Home waits for its card before it is ready", () => {
  assert.equal(homeIsReady({ dataReady: true, cycleMode: false, showcaseReady: false }), false);
  assert.equal(homeIsReady({ dataReady: true, cycleMode: false, showcaseReady: true }), true);
});

check("CycleHome is ready as soon as its data is in, with no card", () => {
  assert.equal(homeIsReady({ dataReady: true, cycleMode: true, showcaseReady: false }), true);
});

check("nothing is ready before the data has loaded", () => {
  assert.equal(homeIsReady({ dataReady: false, cycleMode: true, showcaseReady: true }), false);
  assert.equal(homeIsReady({ dataReady: false, cycleMode: false, showcaseReady: true }), false);
});

check("the centre button rises for a read or a running cycle, and not otherwise", () => {
  assert.equal(centreRaised({ scanning: false, cycleActive: false }), false);
  assert.equal(centreRaised({ scanning: true, cycleActive: false }), true);
  assert.equal(centreRaised({ scanning: false, cycleActive: true }), true);
  assert.equal(centreRaised({ scanning: true, cycleActive: true }), true);
});

check("the streak pill is locked during a session and unlocked otherwise", () => {
  assert.equal(streakLockState(true), "locked");
  assert.equal(streakLockState(false), "unlocked");
});

console.log(`${passed}/${passed} passed`);
