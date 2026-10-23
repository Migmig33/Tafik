import { useEffect, useRef } from "react";
import { Animated, StyleSheet, View } from "react-native";
import { AppMark } from "./components";
import { MOTION, useReducedMotion } from "./motion";
import { colors, typeScale } from "./theme";
import { Text } from "./typography";

const MARK_HEIGHT = 84;
// The entrance: a short fade with the composition settling up from a little smaller.
const ENTER_MS = 520;
const ENTER_FROM_SCALE = 0.96;

// The entrance plays once per launch. Leaving and coming back to Home mounts the loader again,
// and by then it should simply be there, not replay.
let entered = false;

/**
 * The loading presentation: the TAFIK mark with the brand name directly beneath it, nothing
 * else. The mark is the existing brand artwork, tinted to the app theme's text colour
 * (black in Light mode, white in Dark mode), with no background behind it. The mark and the
 * name enter together as one composition, so they stay centred as they arrive. The parent owns
 * the opacity, so the presentation fades in and out with the 3D card.
 */
export default function CardLoading({ opacity }: { opacity: Animated.Value }) {
  const reduce = useReducedMotion();
  // Starts hidden for the first launch only; under reduced motion, or once the entrance has
  // played, it starts fully shown with no movement.
  const enter = useRef(new Animated.Value(entered || reduce ? 1 : 0)).current;

  useEffect(() => {
    if (entered || reduce) {
      enter.setValue(1);
      return;
    }
    entered = true;
    const run = Animated.timing(enter, {
      toValue: 1,
      duration: ENTER_MS,
      easing: MOTION.ease,
      useNativeDriver: true,
    });
    run.start();
    return () => run.stop();
  }, [enter, reduce]);

  const scale = enter.interpolate({ inputRange: [0, 1], outputRange: [ENTER_FROM_SCALE, 1] });

  return (
    <Animated.View pointerEvents="none" style={[styles.wrap, { opacity }]}>
      <Animated.View style={[styles.composition, { opacity: enter, transform: [{ scale }] }]}>
        <AppMark height={MARK_HEIGHT} color={colors.text} />
        <Text style={[styles.name, { color: colors.text }]}>Tafik</Text>
      </Animated.View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    ...StyleSheet.absoluteFill,
    alignItems: "center",
    justifyContent: "center",
  },
  composition: {
    alignItems: "center",
  },
  name: {
    marginTop: 16,
    fontSize: typeScale.headline.fontSize,
    fontWeight: "700",
    // Title case takes far less tracking than capitals did; the old spacing would read as gappy.
    letterSpacing: 0.4,
  },
});
