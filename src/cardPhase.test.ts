// @ts-nocheck
// Run with: node --experimental-strip-types src/cardPhase.test.ts
import assert from "node:assert/strict";
import { displayPhase, showLoader, showStaticFallback, threePhase } from "./cardShowcase.ts";

const tests = [
  ["starts loading before anything has happened", () => assert.equal(threePhase(false, false), "loading")],
  ["stays loading while the model is still being prepared", () => assert.equal(threePhase(false, false), "loading")],
  ["becomes ready once the first frame has rendered", () => assert.equal(threePhase(true, false), "ready")],
  ["a failure leaves the card failed, not loading", () => assert.equal(threePhase(false, true), "failed")],
  ["a failure never reads as ready", () => assert.notEqual(threePhase(false, true), "ready")],
  ["ready wins if both flags are somehow set", () => assert.equal(threePhase(true, true), "ready")],
  ["the loader shows while loading", () => assert.equal(showLoader("loading"), true)],
  ["the loader stops once ready", () => assert.equal(showLoader("ready"), false)],
  ["the loader stops after a failure", () => assert.equal(showLoader("failed"), false)],
  ["the static image never shows while loading", () => assert.equal(showStaticFallback("loading"), false)],
  ["the static image never shows once ready", () => assert.equal(showStaticFallback("ready"), false)],
  ["the static image shows after a failure", () => assert.equal(showStaticFallback("failed"), true)],
  ["a retry returns to loading, not to the static image", () => assert.equal(threePhase(false, false), "loading")],
  ["without a preview hold, the real phase shows through", () => assert.equal(displayPhase("ready", true), "ready")],
  ["a preview hold keeps the loader up even when ready", () => assert.equal(displayPhase("ready", false), "loading")],
  ["a preview hold keeps a failure from showing its fallback", () => assert.equal(displayPhase("failed", false), "loading")],
  ["after the hold, a ready card shows", () => assert.equal(displayPhase("ready", true), "ready")],
  ["after the hold, a failure shows its fallback", () => assert.equal(displayPhase("failed", true), "failed")],
  ["the hold never changes the real phase", () => assert.equal(threePhase(true, false), "ready")],
];
let failed = 0;
for (const [name, run] of tests) {
  try { run(); console.log("PASS", name); }
  catch (error) { failed += 1; console.log("FAIL", name, error.message); }
}
console.log(`${tests.length - failed}/${tests.length} passed`);
if (failed) process.exit(1);
