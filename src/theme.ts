import AsyncStorage from "@react-native-async-storage/async-storage";
import React, { createContext, useContext, useEffect, useMemo, useState } from "react";
import { useColorScheme } from "react-native";
import { syncBlockingAppearance } from "./blocking";

// The palette is fully monochrome: there is no hue anywhere in the app. What
// used to be a green state colour is now the darkest neutral in light mode and
// the lightest in dark, so an active session still reads as "on" through
// contrast alone rather than through hue.
export type Palette = {
  bg: string;
  surface: string;
  text: string;
  textDim: string;
  border: string;
  accent: string;
  // A calm neutral tint used to wash the screen when a session is active.
  accentWash: string;
  onAccent: string;
  // Dims the page behind a modal. Translucent by nature, so it is the one
  // token that is not a flat colour.
  scrim: string;
  // The only hue left in the palette. Reserved for stopping something that is
  // already running, so it never competes with anything else on screen.
  danger: string;
  onDanger: string;
};

const light: Palette = {
  // bg and surface are deliberately the same white: cards and the tab bar are
  // separated by their hairline border and elevation, not by a fill.
  bg: "#FFFFFF",
  surface: "#FFFFFF",
  text: "#1A1A1A",
  textDim: "#737373",
  border: "#E8E8E8",
  accent: "#1A1A1A",
  accentWash: "#F2F2F2",
  onAccent: "#FFFFFF",
  scrim: "rgba(0, 0, 0, 0.4)",
  danger: "#C0392B",
  onDanger: "#FFFFFF",
};

const dark: Palette = {
  bg: "#101010",
  surface: "#1A1A1A",
  text: "#F5F5F5",
  textDim: "#A1A1A1",
  border: "#2E2E2E",
  // Inverted against light mode: accent is the lightest neutral here, so a
  // filled button stays light-on-dark the way it is dark-on-light.
  accent: "#F5F5F5",
  accentWash: "#262626",
  onAccent: "#101010",
  scrim: "rgba(0, 0, 0, 0.6)",
  danger: "#E74C3C",
  onDanger: "#FFFFFF",
};

export const radius = { input: 14, card: 18, pill: 999 } as const;
export const space = (n: number) => n * 8;

export type ThemeMode = "system" | "light" | "dark";
export type Theme = {
  colors: Palette;
  isDark: boolean;
  mode: ThemeMode;
  setMode: (mode: ThemeMode) => void;
};

const ThemeContext = createContext<Theme>({
  colors: light,
  isDark: false,
  mode: "system",
  setMode: () => {},
});

const THEME_KEY = "appearanceMode";

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const systemScheme = useColorScheme();
  const [mode, setModeState] = useState<ThemeMode>("system");

  useEffect(() => {
    AsyncStorage.getItem(THEME_KEY).then((saved) => {
      const next = saved === "system" || saved === "light" || saved === "dark" ? saved : "system";
      setModeState(next);
      syncBlockingAppearance(next);
    });
  }, []);

  const setMode = (next: ThemeMode) => {
    setModeState(next);
    AsyncStorage.setItem(THEME_KEY, next);
    syncBlockingAppearance(next);
  };
  const isDark = mode === "dark" || (mode === "system" && systemScheme === "dark");
  const value = useMemo(
    () => ({ colors: isDark ? dark : light, isDark, mode, setMode }),
    [isDark, mode]
  );

  return React.createElement(ThemeContext.Provider, { value }, children);
}

export function useTheme(): Theme {
  return useContext(ThemeContext);
}
