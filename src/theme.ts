import AsyncStorage from "@react-native-async-storage/async-storage";
import React, { createContext, useContext, useEffect, useMemo, useState } from "react";
import { useColorScheme } from "react-native";
import { syncBlockingAppearance } from "./blocking";

// The palette is monochrome at rest. The accent green appears ONLY to signal
// an active focus session — it is a state color with a job, not decoration.
export type Palette = {
  bg: string;
  surface: string;
  text: string;
  textDim: string;
  border: string;
  accent: string;
  // A calm tint used to wash the screen when a session is active.
  accentWash: string;
  onAccent: string;
};

const light: Palette = {
  bg: "#F5F5F0",
  surface: "#FFFFFF",
  text: "#1C211E",
  textDim: "#70766F",
  border: "#E5E9E3",
  accent: "#3D684F",
  accentWash: "#E8F1EB",
  onAccent: "#FFFFFF",
};

const dark: Palette = {
  bg: "#101310",
  surface: "#1A1F1B",
  text: "#F3F6F2",
  textDim: "#9DA59E",
  border: "#2A312B",
  accent: "#83BE98",
  accentWash: "#1D2B22",
  onAccent: "#0F1611",
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
