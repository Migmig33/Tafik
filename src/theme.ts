import { useEffect, useState } from "react";
import { setThemeMode } from "./store";

// TAFIK has two appearances, Dark and Light, chosen by the user in Settings.
// Dark is the original black-and-white look and stays the default. Every colour
// in the app comes from `colors`, which is one object updated in place when the
// mode changes. Components read it while rendering, and the root re-renders on
// every change, so the whole tree picks up the new values at once.

export type ThemeMode = "dark" | "light";

export type Palette = {
  // The page behind everything.
  bg: string;
  // Cards, sheets, the tab bar and inputs.
  surface: string;
  // Primary text and important labels.
  text: string;
  // Secondary text, captions and disabled labels.
  textDim: string;
  // Hairlines, separators and the outline of inactive controls.
  border: string;
  // The fill of the selected or primary control, and its active icons.
  accent: string;
  // A faint wash behind selected rows, icon wells and active sessions.
  accentWash: string;
  // Text and icons drawn on top of `accent`.
  onAccent: string;
  // Dims the page behind a modal.
  scrim: string;
};

const DARK: Palette = {
  bg: "#000000",
  surface: "#1A1A1A",
  text: "#FFFFFF",
  textDim: "rgba(255, 255, 255, 0.64)",
  border: "rgba(255, 255, 255, 0.14)",
  accent: "#FFFFFF",
  accentWash: "rgba(255, 255, 255, 0.08)",
  onAccent: "#000000",
  scrim: "rgba(0, 0, 0, 0.6)",
};

const LIGHT: Palette = {
  bg: "#FFFFFF",
  surface: "#F5F5F5",
  text: "#000000",
  textDim: "#666666",
  border: "#E5E5E5",
  accent: "#000000",
  accentWash: "rgba(0, 0, 0, 0.06)",
  onAccent: "#FFFFFF",
  scrim: "rgba(0, 0, 0, 0.35)",
};

const PALETTES: Record<ThemeMode, Palette> = { dark: DARK, light: LIGHT };

/** The live palette. Mutated in place by `applyThemeMode`, never replaced. */
export const colors: Palette = { ...DARK };

let appliedMode: ThemeMode = "dark";
const listeners = new Set<() => void>();

/** Switches the palette now and tells every subscriber. Does not save anything. */
export function applyThemeMode(mode: ThemeMode): void {
  if (mode === appliedMode) return;
  appliedMode = mode;
  Object.assign(colors, PALETTES[mode]);
  listeners.forEach((listener) => listener());
}

/** The user's explicit choice from Settings: applied at once and saved. */
export function chooseThemeMode(mode: ThemeMode): void {
  applyThemeMode(mode);
  void setThemeMode(mode);
}

/** The mode currently applied to `colors`. */
export function currentThemeMode(): ThemeMode {
  return appliedMode;
}

/**
 * Re-renders the calling component whenever the mode changes. Call it in the
 * root and in any component that must update its own styling immediately.
 */
export function useThemeMode(): ThemeMode {
  const [mode, setMode] = useState<ThemeMode>(appliedMode);
  useEffect(() => {
    const listener = () => setMode(appliedMode);
    listeners.add(listener);
    // A change may have landed between the first render and this subscription.
    listener();
    return () => {
      listeners.delete(listener);
    };
  }, []);
  return mode;
}

export const radius = { input: 14, card: 18, pill: 999 } as const;
export const space = (n: number) => n * 8;

/** The horizontal inset every Screen leaves at each edge. */
export const SCREEN_GUTTER = space(2.5);

// Type scale. Poppins is the only family, so weight and size carry the
// hierarchy: 600 for anything read first, 400 for running text. Every size in
// the app is one of these steps, so screens cannot drift into near-duplicates.
export const typeScale = {
  display: { fontSize: 44, lineHeight: 50, letterSpacing: -0.8 },
  title: { fontSize: 28, lineHeight: 34, letterSpacing: -0.5 },
  headline: { fontSize: 20, lineHeight: 26, letterSpacing: -0.2 },
  body: { fontSize: 16, lineHeight: 24 },
  callout: { fontSize: 15, lineHeight: 22 },
  footnote: { fontSize: 13, lineHeight: 18 },
  caption: { fontSize: 12, lineHeight: 16, letterSpacing: 0.2 },
  label: { fontSize: 11, lineHeight: 14, letterSpacing: 0.8 },
} as const;
