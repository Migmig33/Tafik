import { useColorScheme } from "react-native";

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
  bg: "#FAF9F6",
  surface: "#FFFFFF",
  text: "#1A1917",
  textDim: "#6B6862",
  border: "#E7E4DD",
  accent: "#2F5D45",
  accentWash: "#EAF0EC",
  onAccent: "#FFFFFF",
};

const dark: Palette = {
  bg: "#121110",
  surface: "#1C1B19",
  text: "#F5F3EE",
  textDim: "#A3A09A",
  border: "#2E2C29",
  accent: "#7BB893",
  accentWash: "#17201B",
  onAccent: "#0F1611",
};

export const radius = { input: 8, card: 12, pill: 999 } as const;
export const space = (n: number) => n * 8;

export type Theme = { colors: Palette; isDark: boolean };

export function useTheme(): Theme {
  const scheme = useColorScheme();
  const isDark = scheme === "dark";
  return { colors: isDark ? dark : light, isDark };
}
