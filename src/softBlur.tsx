import { useEffect, useState } from "react";
import { requireOptionalNativeModule } from "expo";
import { StyleSheet } from "react-native";
import { useThemeMode } from "./theme";

// The blur is a native view. A build that predates expo-blur has no such module, so it
// gets no blur at all rather than a crash, and the shade on top still reads as shading.
const blurInstalled = requireOptionalNativeModule("ExpoBlur") !== null;

/**
 * A soft blur over whatever sits beneath it, tinted to the app's current theme. It is
 * loaded on demand so a build without the native module never fails to start.
 */
export function SoftBlur({ intensity = 40 }: { intensity?: number }) {
  const mode = useThemeMode();
  const [Blur, setBlur] = useState<typeof import("expo-blur").BlurView | null>(null);

  useEffect(() => {
    if (!blurInstalled) return;
    let cancelled = false;
    import("expo-blur")
      .then((module) => {
        if (!cancelled) setBlur(() => module.BlurView);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  if (!Blur) return null;
  return (
    <Blur
      tint={mode === "light" ? "light" : "dark"}
      intensity={intensity}
      pointerEvents="none"
      style={StyleSheet.absoluteFill}
    />
  );
}
