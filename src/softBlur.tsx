import { useEffect, useState } from "react";
import { requireOptionalNativeModule } from "expo";
import { StyleSheet, View } from "react-native";
import type { RefObject } from "react";
import { useThemeMode } from "./theme";

// The blur is a native view. A build that predates expo-blur has no such module, so it gets no
// blur at all rather than a crash, and anything drawn on top still reads as its own shading.
const blurInstalled = requireOptionalNativeModule("ExpoBlur") !== null;

type ExpoBlur = typeof import("expo-blur");

/**
 * The expo-blur module, loaded on demand so a build without the native module never fails to
 * start. It is null until the module has loaded, and stays null when the build has no module.
 */
export function useExpoBlur(): ExpoBlur | null {
  const [blur, setBlur] = useState<ExpoBlur | null>(null);
  useEffect(() => {
    if (!blurInstalled) return;
    let cancelled = false;
    import("expo-blur")
      .then((module) => {
        if (!cancelled) setBlur(() => module);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);
  return blur;
}

/**
 * A real background blur of the content inside the blur target, tinted to the app's current
 * theme. On Android the blur only reaches content that sits inside a BlurTargetView, so the
 * screen must wrap that content in one and pass its ref here.
 */
export function SoftBlur({
  target,
  intensity = 40,
}: {
  target: RefObject<View | null>;
  intensity?: number;
}) {
  const blur = useExpoBlur();
  const mode = useThemeMode();
  if (!blur) return null;
  return (
    <blur.BlurView
      blurTarget={target}
      tint={mode === "light" ? "light" : "dark"}
      intensity={intensity}
      blurMethod="dimezisBlurViewSdk31Plus"
      pointerEvents="none"
      style={StyleSheet.absoluteFill}
    />
  );
}
