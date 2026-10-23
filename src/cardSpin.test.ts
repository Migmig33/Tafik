// @ts-nocheck
// Run with: node --experimental-strip-types src/cardSpin.test.ts
import assert from "node:assert/strict";
import { DRAG_SCREEN_WIDTHS_PER_TURN, degreesPerPixel } from "./cardShowcase.ts";

const tests = [
  ["one full turn takes 1.5 screen widths of drag", () => {
    const width = 411;
    assert.equal(Math.round(360 / degreesPerPixel(width)), Math.round(DRAG_SCREEN_WIDTHS_PER_TURN * width));
  }],
  ["dragging right gives a positive spin", () => assert.ok(degreesPerPixel(400) > 0)],
  ["a wider screen spins less per pixel", () => assert.ok(degreesPerPixel(800) < degreesPerPixel(400))],
];
let failed = 0;
for (const [name, run] of tests) {
  try { run(); console.log("PASS", name); }
  catch (error) { failed += 1; console.log("FAIL", name, error.message); }
}
console.log(`${tests.length - failed}/${tests.length} passed`);
if (failed) process.exit(1);
