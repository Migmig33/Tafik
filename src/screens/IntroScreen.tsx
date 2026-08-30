import React, { useEffect, useRef } from "react";
import { Animated, Easing, StyleSheet, View } from "react-native";
import { space, useTheme } from "../theme";
import { Text } from "../typography";

const INTRO_DURATION = 2200;

export default function IntroScreen({ onFinish }: { onFinish: () => void }) {
  const { colors } = useTheme();
  const mark = useRef(new Animated.Value(0)).current;
  const copy = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const animation = Animated.sequence([
      Animated.timing(mark, {
        toValue: 1,
        duration: 650,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.timing(copy, {
        toValue: 1,
        duration: 450,
        easing: Easing.out(Easing.ease),
        useNativeDriver: true,
      }),
    ]);
    const timer = setTimeout(onFinish, INTRO_DURATION);

    animation.start();
    return () => {
      animation.stop();
      clearTimeout(timer);
    };
  }, [copy, mark, onFinish]);

  return (
    <View style={[styles.screen, { backgroundColor: colors.bg }]}>
      <Animated.View
        style={{
          alignItems: "center",
          opacity: mark,
          transform: [
            { scale: mark.interpolate({ inputRange: [0, 1], outputRange: [0.72, 1] }) },
          ],
        }}
      >
        <View style={[styles.mark, { borderColor: colors.accent }]}>
          <View style={[styles.card, { backgroundColor: colors.accent }]} />
          <View style={[styles.signal, styles.signalOne, { borderColor: colors.accent }]} />
          <View style={[styles.signal, styles.signalTwo, { borderColor: colors.accent }]} />
        </View>
      </Animated.View>

      <Animated.View
        style={{
          alignItems: "center",
          marginTop: space(4),
          opacity: copy,
          transform: [
            { translateY: copy.interpolate({ inputRange: [0, 1], outputRange: [10, 0] }) },
          ],
        }}
      >
        <Text style={[styles.title, { color: colors.text }]}>TapIn</Text>
        <Text style={[styles.tagline, { color: colors.textDim }]}>tap in to lock in</Text>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  mark: {
    width: 112,
    height: 112,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 56,
    borderWidth: StyleSheet.hairlineWidth,
  },
  card: {
    width: 38,
    height: 52,
    borderRadius: 6,
    transform: [{ rotate: "-8deg" }],
  },
  signal: {
    position: "absolute",
    borderWidth: 2,
    borderLeftColor: "transparent",
    borderTopColor: "transparent",
    borderBottomColor: "transparent",
    borderRadius: 999,
  },
  signalOne: {
    width: 27,
    height: 38,
    right: 17,
  },
  signalTwo: {
    width: 39,
    height: 56,
    right: 8,
  },
  title: {
    fontSize: 30,
    fontWeight: "600",
    letterSpacing: -0.6,
  },
  tagline: {
    marginTop: space(0.75),
    fontSize: 15,
    letterSpacing: 0.2,
  },
});
