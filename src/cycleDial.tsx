import { useEffect, useRef, useState } from "react";
import { Animated, Pressable, StyleSheet, View } from "react-native";
import { MOTION, useReducedMotion } from "./motion";
import SessionClock from "./sessionClock";
import { useThemeMode } from "./theme";
import { formatClock } from "./timeFormat";

// The phase tints. Study is a calm indigo and Break a clear green. Each has a tone for Light and for
// Dark, so the digits keep strong contrast on either background.
const PALETTE = {
  study: { light: "#2F4BD8", dark: "#8FA6FF" },
  break: { light: "#0E8F6E", dark: "#5FD2AE" },
};

// The countdown is read four times a second, so a new second is never shown late. Only the digits
// change, so the motion below follows the real seconds rather than a timer of its own.
const TICK_MS = 250;
const PHASE_MS = 320;

/**
 * The session's countdown, set large in the middle of the screen with nothing around it. It reads
 * the phase's real start and end times, so it cannot drift from the session. The digits are drawn by
 * the shared clock, which formats and animates them. A change of phase fades the digits through,
 * skipped under reduced motion.
 *
 * During a Break, tapping the countdown is the card's way to end the cycle. Study has no press.
 */
export default function CycleDial({
  phase,
  endsAt,
  onPress,
}: {
  phase: "study" | "break";
  startedAt: number;
  endsAt: number;
  /** Present only in Break, and only while the card is free to be read. */
  onPress?: () => void;
}) {
  const mode = useThemeMode();
  const reduce = useReducedMotion();
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    setNow(Date.now());
    const timer = setInterval(() => setNow(Date.now()), TICK_MS);
    return () => clearInterval(timer);
  }, []);

  const remainingMs = Math.max(0, endsAt - now);
  const shownSecond = Math.ceil(remainingMs / 1000);
  const accent = PALETTE[phase][mode === "light" ? "light" : "dark"];
  const label = phase === "study" ? "Study" : "Break";

  // A change of phase fades the digits through and back, so the new tint arrives gently.
  const phaseFade = useRef(new Animated.Value(1)).current;
  const lastPhase = useRef(phase);
  useEffect(() => {
    if (lastPhase.current === phase) return;
    lastPhase.current = phase;
    if (reduce) return;
    phaseFade.setValue(0.3);
    const fade = Animated.timing(phaseFade, {
      toValue: 1,
      duration: PHASE_MS,
      easing: MOTION.ease,
      useNativeDriver: true,
    });
    fade.start();
    return () => fade.stop();
  }, [phase, reduce, phaseFade]);

  const face = (
    <Animated.View style={{ opacity: phaseFade }}>
      <SessionClock
        seconds={shownSecond}
        color={accent}
        accessibilityLabel={`${label} time ${formatClock(shownSecond)}`}
      />
    </Animated.View>
  );

  if (!onPress) return <View style={styles.face}>{face}</View>;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel="End Cycle with card"
      onPress={onPress}
      style={styles.face}
    >
      {face}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  face: {
    alignItems: "center",
    justifyContent: "center",
  },
});
