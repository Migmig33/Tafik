import { useEffect, useRef } from "react";
import { Animated, StyleSheet, View, type StyleProp, type TextStyle } from "react-native";
import { MOTION, useReducedMotion } from "./motion";
import { Text } from "./typography";

// A changed character slides down into place over this long, fading up as it arrives.
const SLIDE_MS = 240;
const SLIDE_DISTANCE = 10;
const FADE_FROM = 0.4;

/**
 * A clock string drawn one character at a time. Each character is keyed by its place counted
 * from the right, so the seconds stay the same element as the time grows and only the characters
 * that change move. A changed character slides down from just above its place; a new one (when the
 * text grows) does the same. The text is centred by its parent, so growth extends both ways.
 *
 * The first render shows the text at rest. Under reduced motion nothing moves at all.
 */
export default function RollingTime({
  text,
  label,
  style,
}: {
  text: string;
  label: string;
  style: StyleProp<TextStyle>;
}) {
  const reduce = useReducedMotion();
  // Only characters that appear after the first render animate in; the first render itself is at rest.
  const rendered = useRef(false);
  useEffect(() => {
    rendered.current = true;
  }, []);
  const animateIn = rendered.current;

  // Index 0 is the rightmost character, so the places line up whatever the length.
  const places = Array.from(text).reverse();
  return (
    <View accessible accessibilityRole="timer" accessibilityLabel={label} style={styles.row}>
      {places
        .map((char, place) => (
          <Glyph key={place} char={char} style={style} reduce={reduce} animateIn={animateIn} />
        ))
        .reverse()}
    </View>
  );
}

function Glyph({
  char,
  style,
  reduce,
  animateIn,
}: {
  char: string;
  style: StyleProp<TextStyle>;
  reduce: boolean;
  animateIn: boolean;
}) {
  // 1 is at rest. A changed character starts at 0, above its place, and eases down to 1.
  const slide = useRef(new Animated.Value(animateIn && !reduce ? 0 : 1)).current;
  const shown = useRef(char);
  const mounted = useRef(false);

  useEffect(() => {
    // A character that appears with the first render is at rest; one that appears later slides in.
    if (!mounted.current) {
      mounted.current = true;
      if (!animateIn || reduce) {
        slide.setValue(1);
        return;
      }
    } else if (shown.current === char) {
      return;
    }
    shown.current = char;
    if (reduce) {
      slide.setValue(1);
      return;
    }
    slide.setValue(0);
    const run = Animated.timing(slide, {
      toValue: 1,
      duration: SLIDE_MS,
      easing: MOTION.ease,
      useNativeDriver: true,
    });
    run.start();
    return () => run.stop();
  }, [char, reduce, animateIn, slide]);

  return (
    <Animated.View
      style={{
        opacity: slide.interpolate({ inputRange: [0, 1], outputRange: [FADE_FROM, 1] }),
        transform: [{ translateY: slide.interpolate({ inputRange: [0, 1], outputRange: [-SLIDE_DISTANCE, 0] }) }],
      }}
    >
      <Text accessible={false} style={style}>
        {char}
      </Text>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
  },
});
