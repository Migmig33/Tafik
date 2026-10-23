// Development-only switches for testing the 3D card on a device. __DEV__ is false in release
// builds, so neither switch can be on in production or in an ordinary user's session. Each is
// a constant in this file; a change needs a rebuild, and nothing in the app sets them at runtime.

// Failure injection: makes the 3D card fail at setup, to test the fallback path.
const FORCE_3D_FAILURE = false;
export const INJECT_3D_FAILURE: boolean = __DEV__ && FORCE_3D_FAILURE;

// Loading preview: keeps the loading screen up for a few seconds after the 3D card is ready,
// so the loading presentation can be seen. It only delays what is shown; the 3D card's real
// readiness and failure handling still run as normal.
const SHOW_LOADING_PREVIEW = false;
const LOADING_PREVIEW_MS = 4000;
export const LOADING_PREVIEW_HOLD_MS: number = __DEV__ && SHOW_LOADING_PREVIEW ? LOADING_PREVIEW_MS : 0;

// Streak preview (development only): shows one fixed streak case for screenshots. It is "off" in
// release builds, and the Home screen reads real streak data whenever it is "off".
const STREAK_PREVIEW_CASE: "off" | "zero" | "midWeek" | "fullWeek" | "completion" = "off";
export const STREAK_PREVIEW: "off" | "zero" | "midWeek" | "fullWeek" | "completion" = __DEV__ ? STREAK_PREVIEW_CASE : "off";
