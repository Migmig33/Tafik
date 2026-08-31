import { useEffect, useRef } from "react";
import { StyleSheet, View } from "react-native";
import { BrandLockup } from "../components";
import { useWhoosh } from "../sound";
import { useTheme } from "../theme";

/** How long the finished lockup sits on screen before the app takes over. */
const HOLD_AFTER_MS = 1200;

/**
 * The ordinary launch animation, shown on every start after the first. The
 * first-ever launch gets WelcomeScreen instead, which ends on the same lockup.
 */
export default function IntroScreen({ onFinish }: { onFinish: () => void }) {
  const { colors } = useTheme();
  const { play, lockupMs } = useWhoosh();

  // Sound and animation start together on mount, so they stay in step.
  const total = useRef(lockupMs + HOLD_AFTER_MS);

  useEffect(() => {
    play();
  }, [play]);

  useEffect(() => {
    const timer = setTimeout(onFinish, total.current);
    return () => clearTimeout(timer);
  }, [onFinish]);

  return (
    <View style={[styles.screen, { backgroundColor: colors.bg }]}>
      <BrandLockup durationMs={lockupMs} />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
});
