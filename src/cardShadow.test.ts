// @ts-nocheck
// Run with: node --experimental-strip-types src/cardShadow.test.ts
import assert from "node:assert/strict";
import { CARD_BOTTOM_DP, SHADOW_THEME } from "./cardShadowTheme.ts";
import { CARD_OFFSET_X, CARD_SCALE, FALLBACK_SCALE, LIGHTING_BY_CARD } from "./cardFit.ts";

const tests = [
  ["the contact shadow sits under the card's bottom edge, in light mode", () => assert.ok(SHADOW_THEME.light.contact.centreY > CARD_BOTTOM_DP)],
  ["the contact shadow sits under the card's bottom edge, in dark mode", () => assert.ok(SHADOW_THEME.dark.contact.centreY > CARD_BOTTOM_DP)],
  ["the ambient layer is wider and softer than the contact layer, in light mode", () => {
    assert.ok(SHADOW_THEME.light.ambient.width > SHADOW_THEME.light.contact.width);
    assert.ok(SHADOW_THEME.light.ambient.opacity < SHADOW_THEME.light.contact.opacity);
  }],
  ["the ambient layer is wider and softer than the contact layer, in dark mode", () => {
    assert.ok(SHADOW_THEME.dark.ambient.width > SHADOW_THEME.dark.contact.width);
    assert.ok(SHADOW_THEME.dark.ambient.opacity < SHADOW_THEME.dark.contact.opacity);
  }],
  ["light mode uses a dark grey shadow, not pure black", () => assert.notEqual(SHADOW_THEME.light.contact.colour, "#000000")],
  ["dark mode contact shadow is stronger than light mode", () => assert.ok(SHADOW_THEME.dark.contact.opacity > SHADOW_THEME.light.contact.opacity)],
  ["dark mode ambient is a faint lighter glow", () => {
    assert.equal(SHADOW_THEME.dark.ambient.colour, "#ffffff");
    assert.ok(SHADOW_THEME.dark.ambient.opacity <= 0.1);
  }],
  ["the card scale is the previous 0.95 times 1.12", () => assert.ok(Math.abs(CARD_SCALE - 0.95 * 1.12) < 1e-9)],
  ["the fallback uses the same 1.12 change", () => assert.equal(FALLBACK_SCALE, 1.12)],
  ["the card offset is the centring value on the pivot", () => assert.equal(CARD_OFFSET_X, -0.01)],
  ["Light mode's black card keeps its original lighting", () => {
    assert.equal(LIGHTING_BY_CARD.black.ambient, 0.7);
    assert.equal(LIGHTING_BY_CARD.black.keyIntensity, 1.4);
    assert.equal(LIGHTING_BY_CARD.black.fillIntensity, 0.5);
  }],
  ["Dark mode's white card has a softer fill than its key", () => assert.ok(LIGHTING_BY_CARD.white.fillIntensity < LIGHTING_BY_CARD.white.keyIntensity)],
];
let failed = 0;
for (const [name, run] of tests) {
  try { run(); console.log("PASS", name); }
  catch (error) { failed += 1; console.log("FAIL", name, error.message); }
}
console.log(`${tests.length - failed}/${tests.length} passed`);
if (failed) process.exit(1);
