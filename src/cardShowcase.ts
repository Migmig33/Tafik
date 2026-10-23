// The rules behind the home screen's NFC card showcase. Kept free of React Native
// so they can be tested directly with Node.

/** Which rendered card to show. White is the card for a dark system, black for a light one. */
export type CardArt = "white" | "black";

/**
 * Dark system appearance shows the white card; light shows the black card. A phone
 * that has not reported a scheme gets the white card, matching the app's dark default.
 */
export function artForScheme(scheme: "light" | "dark" | null | undefined): CardArt {
  return scheme === "light" ? "black" : "white";
}

/** The switch only exists when there is something to switch between. */
export function showSwitch(count: number): boolean {
  return count >= 2;
}

/** Keeps a selection valid after the list of cards changes. Nothing selected when there are none. */
export function clampIndex(index: number, count: number): number {
  if (count <= 0) return 0;
  return Math.min(Math.max(index, 0), count - 1);
}

/** The next card, looping from the last back to the first. */
export function nextIndex(index: number, count: number): number {
  if (count <= 0) return 0;
  return (clampIndex(index, count) + 1) % count;
}

/** The previous card, looping from the first back to the last. */
export function previousIndex(index: number, count: number): number {
  if (count <= 0) return 0;
  const current = clampIndex(index, count);
  return (current - 1 + count) % count;
}

/**
 * The card's colour on Home follows the app's own Light or Dark mode. Light mode shows
 * the black card, so it stands out from the white page; Dark mode shows the white card.
 */
export function artForAppTheme(mode: "light" | "dark"): CardArt {
  return mode === "light" ? "black" : "white";
}

/**
 * Where the 3D card is. Loading keeps the loader and the static image; ready means the 3D
 * card has drawn its first frame; failed means the static image stays and no loader shows.
 */
export type ThreePhase = "loading" | "ready" | "failed";

export function threePhase(ready: boolean, failed: boolean): ThreePhase {
  if (ready) return "ready";
  if (failed) return "failed";
  return "loading";
}

/**
 * The phase the screen shows. A loading preview holds it at loading until the hold is over,
 * even when the real phase is already known. The real phase is not changed by this.
 */
export function displayPhase(phase: ThreePhase, holdDone: boolean): ThreePhase {
  return holdDone ? phase : "loading";
}

/** The static image appears only after the 3D card has failed. It never shows while loading. */
export function showStaticFallback(phase: ThreePhase): boolean {
  return phase === "failed";
}

/** Drag speed: one full turn of the card per this many screen widths of horizontal drag. */
export const DRAG_SCREEN_WIDTHS_PER_TURN = 1.5;

/** Degrees of spin per pixel of horizontal drag. Dragging right turns the card's front to the right. */
export function degreesPerPixel(screenWidth: number): number {
  return 360 / (DRAG_SCREEN_WIDTHS_PER_TURN * screenWidth);
}

/** The loading presentation shows only while the 3D card is still being prepared. */
export function showLoader(phase: ThreePhase): boolean {
  return phase === "loading";
}
