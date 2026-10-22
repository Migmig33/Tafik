// @ts-nocheck
// Run with: node --experimental-strip-types src/shareCardMath.test.ts
import assert from "node:assert/strict";
import {
  CARD_WIDTH,
  clampOffset,
  clampZoom,
  extensionFor,
  isSupportedImage,
  maxOffset,
  textToneFor,
} from "./shareCardMath.ts";

const tests = [
  ["zoom below the card is raised to 1", () => assert.equal(clampZoom(0.4), 1)],
  ["zoom above the limit is held at 3", () => assert.equal(clampZoom(9), 3)],
  ["at zoom 1 the photo cannot move", () => assert.equal(maxOffset(1, CARD_WIDTH), 0)],
  ["at zoom 2 the photo may move half the card", () => assert.equal(maxOffset(2, CARD_WIDTH), 180)],
  ["an offset past the edge is pulled back", () => assert.equal(clampOffset(500, 2, CARD_WIDTH), 180)],
  ["a negative offset past the edge is pulled back", () => assert.equal(clampOffset(-500, 2, CARD_WIDTH), -180)],
  ["an offset inside the limit is kept", () => assert.equal(clampOffset(40, 2, CARD_WIDTH), 40)],
  ["the default card always uses light text", () => assert.equal(textToneFor(false, "dark"), "light")],
  ["a photo uses the chosen light text", () => assert.equal(textToneFor(true, "light"), "light")],
  ["a photo uses the chosen dark text", () => assert.equal(textToneFor(true, "dark"), "dark")],
  ["JPEG is accepted", () => assert.equal(isSupportedImage("image/jpeg"), true)],
  ["PNG is accepted", () => assert.equal(isSupportedImage("image/png"), true)],
  ["WebP is accepted", () => assert.equal(isSupportedImage("image/webp"), true)],
  ["an unknown type is refused", () => assert.equal(isSupportedImage("image/gif"), false)],
  ["a missing type is accepted and checked when drawn", () => assert.equal(isSupportedImage(null), true)],
  ["the saved file keeps its type's extension", () => assert.equal(extensionFor("image/png"), "png")],
  ["an unknown type is saved as jpg", () => assert.equal(extensionFor(undefined), "jpg")],
];

let failed = 0;
for (const [name, run] of tests) {
  try { run(); console.log("PASS", name); }
  catch (error) { failed += 1; console.log("FAIL", name, error.message); }
}
console.log(`${tests.length - failed}/${tests.length} passed`);
if (failed) process.exit(1);
