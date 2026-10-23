// @ts-nocheck
// Run with: node --experimental-strip-types src/cardArt.test.ts
import assert from "node:assert/strict";
import { artForAppTheme } from "./cardShowcase.ts";

const tests = [
  ["Light mode shows the black card", () => assert.equal(artForAppTheme("light"), "black")],
  ["Dark mode shows the white card", () => assert.equal(artForAppTheme("dark"), "white")],
];
let failed = 0;
for (const [name, run] of tests) {
  try { run(); console.log("PASS", name); }
  catch (error) { failed += 1; console.log("FAIL", name, error.message); }
}
console.log(`${tests.length - failed}/${tests.length} passed`);
if (failed) process.exit(1);
