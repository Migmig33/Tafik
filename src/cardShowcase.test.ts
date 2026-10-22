// @ts-nocheck: runs under Node with --experimental-strip-types, outside the app typecheck.
// Run with: node --experimental-strip-types src/cardShowcase.test.ts
import assert from "node:assert/strict";
import {
  artForScheme,
  clampIndex,
  nextIndex,
  previousIndex,
  showSwitch,
} from "./cardShowcase.ts";

const tests: [string, () => void][] = [
  ["dark system shows the white card", () => assert.equal(artForScheme("dark"), "white")],
  ["light system shows the black card", () => assert.equal(artForScheme("light"), "black")],
  ["unknown scheme shows the white card", () => assert.equal(artForScheme(null), "white")],
  ["no switch for zero cards", () => assert.equal(showSwitch(0), false)],
  ["no switch for one card", () => assert.equal(showSwitch(1), false)],
  ["switch for two cards", () => assert.equal(showSwitch(2), true)],
  ["switch for five cards", () => assert.equal(showSwitch(5), true)],
  ["next moves forward", () => assert.equal(nextIndex(0, 3), 1)],
  ["next loops from last to first", () => assert.equal(nextIndex(2, 3), 0)],
  ["previous moves back", () => assert.equal(previousIndex(2, 3), 1)],
  ["previous loops from first to last", () => assert.equal(previousIndex(0, 3), 2)],
  ["a single card stays on itself", () => assert.equal(nextIndex(0, 1), 0)],
  ["next with no cards stays at zero", () => assert.equal(nextIndex(0, 0), 0)],
  ["clamp keeps a valid selection after a card is removed", () => assert.equal(clampIndex(4, 2), 1)],
  ["clamp never goes negative", () => assert.equal(clampIndex(-1, 3), 0)],
  ["clamp with no cards is zero", () => assert.equal(clampIndex(3, 0), 0)],
  ["a full cycle returns to the start", () => {
    let index = 0;
    for (let step = 0; step < 4; step += 1) index = nextIndex(index, 4);
    assert.equal(index, 0);
  }],
];

let failed = 0;
for (const [name, run] of tests) {
  try {
    run();
    console.log("PASS", name);
  } catch (error) {
    failed += 1;
    console.log("FAIL", name);
    console.log(error);
  }
}
console.log(`${tests.length - failed}/${tests.length} passed`);
if (failed > 0) process.exit(1);
