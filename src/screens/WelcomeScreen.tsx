import React, { useCallback, useEffect, useRef, useState } from "react";
import { Animated, Easing, StyleSheet, View } from "react-native";
import { BrandLockup, PrimaryButton } from "../components";
import { useWhoosh } from "../sound";
import { space, useTheme } from "../theme";
import { Text } from "../typography";

// The case for the app, made before the app asks for anything. Shown once, on
// the very first launch, ahead of the permission onboarding.
const LINES = [
  "You opened it to check one thing.",
  "Forty minutes later, you're still scrolling.",
  "The feed has no bottom. That's not an accident.",
  "Doomscrolling doesn't end on its own.",
  "So we gave you an ending you can hold.",
];

// One line at a time, alone in the middle. Each line sits fully visible for
// HOLD before it starts to leave, so a new line begins every
// FADE_IN + HOLD + FADE_OUT, with the screen briefly empty between them so
// each line lands on its own.
const FADE_IN = 700;
const HOLD = 2000;
const FADE_OUT = 600;

// Ease in and out of both fades. The obvious choice — accelerating in and
// decelerating out — snaps at the very start and the very end, which is what
// reads as abrupt. Easing both ends of both fades keeps the whole crossing soft.
const FADE_CURVE = Easing.inOut(Easing.ease);

export default function WelcomeScreen({ onGetStarted }: { onGetStarted: () => void }) {
  const { colors } = useTheme();
  const { play: playWhoosh, lockupMs } = useWhoosh();
  const [index, setIndex] = useState(0);
  const line = useRef(new Animated.Value(0)).current;
  const cta = useRef(new Animated.Value(0)).current;

  const finishedLines = index >= LINES.length;

  useEffect(() => {
    if (finishedLines) return;
    line.setValue(0);
    const animation = Animated.sequence([
      Animated.timing(line, {
        toValue: 1,
        duration: FADE_IN,
        easing: FADE_CURVE,
        useNativeDriver: true,
      }),
      Animated.delay(HOLD),
      Animated.timing(line, {
        toValue: 0,
        duration: FADE_OUT,
        easing: FADE_CURVE,
        useNativeDriver: true,
      }),
    ]);
    animation.start(({ finished }) => {
      if (finished) setIndex((current) => current + 1);
    });
    return () => animation.stop();
  }, [finishedLines, index, line]);

  // The whoosh belongs to the mark, not to the copy, and starts with it.
  useEffect(() => {
    if (finishedLines) playWhoosh();
  }, [finishedLines, playWhoosh]);

  const revealCta = useCallback(() => {
    Animated.timing(cta, {
      toValue: 1,
      duration: 450,
      easing: Easing.out(Easing.ease),
      useNativeDriver: true,
    }).start();
  }, [cta]);

  return (
    <View style={[styles.screen, { backgroundColor: colors.bg }]}>
      {finishedLines ? (
        <>
          <BrandLockup durationMs={lockupMs} onDone={revealCta} />
          <Animated.View
            style={{
              width: "100%",
              marginTop: space(6),
              opacity: cta,
              transform: [
                { translateY: cta.interpolate({ inputRange: [0, 1], outputRange: [12, 0] }) },
              ],
            }}
          >
            <PrimaryButton label="Get started" onPress={onGetStarted} />
          </Animated.View>
        </>
      ) : (
        <Animated.View style={{ width: "100%", opacity: line }}>
          <Text
            style={[
              styles.line,
              // The closing line is the turn, so it carries full contrast.
              index === LINES.length - 1
                ? { color: colors.text, fontWeight: "600" }
                : { color: colors.textDim },
            ]}
          >
            {LINES[index]}
          </Text>
        </Animated.View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: space(3.5),
  },
  line: {
    fontSize: 24,
    lineHeight: 35,
    letterSpacing: -0.3,
    textAlign: "center",
  },
});
