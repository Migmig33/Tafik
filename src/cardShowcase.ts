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
