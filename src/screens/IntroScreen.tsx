import { useEffect, useRef } from "react";
import { Animated, StyleSheet, View } from "react-native";
import { BrandLockup, GhostButton, LOCKUP_MS } from "../components";
import { MOTION } from "../motion";
import { colors, space, typeScale } from "../theme";
import { Text } from "../typography";
import { CLOSING_LINE } from "../welcomeQuestions";

/** How long the message takes to settle in once the lockup has finished. */
const MESSAGE_IN_MS = 500;

/** How long the finished intro sits on screen before the app takes over. */
const HOLD_AFTER_MS = 1200;

/**
 * The launch intro, shown before permission onboarding on every start. It
 * introduces the name and mark, then the closing line of the first-run story.
 * There is no sound: the intro is silent on every path.
 *
 * `onExitPreview` is TEMPORARY, for the onboarding preview in Settings. It adds
 * an exit control only while previewing.
 */
export default function IntroScreen({
  onFinish,
  onExitPreview,
}: {
  onFinish: () => void;
  onExitPreview?: () => void;
}) {
  const message = useRef(new Animated.Value(0)).current;
  // Read through a ref so a parent that passes a new callback on each render
  // does not restart the timer partway through the intro.
  const finish = useRef(onFinish);
  finish.current = onFinish;

  useEffect(() => {
    const reveal = Animated.timing(message, {
      toValue: 1,
      duration: MESSAGE_IN_MS,
      delay: LOCKUP_MS,
      easing: MOTION.ease,
      useNativeDriver: true,
    });
    reveal.start();
    const timer = setTimeout(
      () => finish.current(),
      LOCKUP_MS + MESSAGE_IN_MS + HOLD_AFTER_MS
    );
    return () => {
      reveal.stop();
      clearTimeout(timer);
    };
  }, [message]);

  return (
    <View style={[styles.screen, { backgroundColor: colors.bg }]}>
      <BrandLockup durationMs={LOCKUP_MS} />

      <Animated.View
        style={[
          styles.message,
          {
            opacity: message,
            transform: [
              { translateY: message.interpolate({ inputRange: [0, 1], outputRange: [8, 0] }) },
            ],
          },
        ]}
      >
        <Text style={[styles.line, { color: colors.textDim }]}>{CLOSING_LINE}</Text>
      </Animated.View>

      {onExitPreview ? (
        <View style={styles.exit}>
          <GhostButton label="Exit preview" onPress={onExitPreview} />
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: space(3),
  },
  message: {
    marginTop: space(3),
    maxWidth: 300,
  },
  line: {
    ...typeScale.callout,
    textAlign: "center",
  },
  exit: {
    position: "absolute",
    bottom: space(6),
    left: 0,
    right: 0,
    alignItems: "center",
  },
});
