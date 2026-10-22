import Check from "lucide-react-native/icons/check";
import React, { useEffect, useRef, useState } from "react";
import { colors, space, typeScale } from "./theme";
import { Text } from "./typography";
import { AccessibilityInfo, Animated, Easing, Pressable, PressableProps, View } from "react-native";

// One set of timings for the whole app, so a press in one place and a screen
// change in another feel like the same motion.
export const MOTION = {
  pressIn: 110,
  pressOut: 180,
  fade: 200,
  ease: Easing.out(Easing.cubic),
} as const;

/** True when the phone asks for reduced motion. Loops and travel are skipped then. */
export function useReducedMotion(): boolean {
  const [reduce, setReduce] = useState(false);

  useEffect(() => {
    let live = true;
    void AccessibilityInfo.isReduceMotionEnabled().then((value) => {
      if (live) setReduce(value);
    });
    const subscription = AccessibilityInfo.addEventListener("reduceMotionChanged", setReduce);
    return () => {
      live = false;
      subscription.remove();
    };
  }, []);

  return reduce;
}

/**
 * A Pressable whose content sinks slightly while the finger is down and springs
 * back on release. The scale is a transform on a child, so nothing around the
 * control moves and the layout never changes.
 */
export const PressableScale = React.forwardRef<View, Omit<PressableProps, "children"> & { scaleTo?: number; children?: React.ReactNode }>(
  function PressableScale({ scaleTo = 0.97, onPressIn, onPressOut, children, ...rest }, ref) {
    const scale = useRef(new Animated.Value(1)).current;
    const reduce = useReducedMotion();

    const animateTo = (value: number, duration: number) => {
      if (reduce) return;
      Animated.timing(scale, {
        toValue: value,
        duration,
        easing: MOTION.ease,
        useNativeDriver: true,
      }).start();
    };

    return (
      <Pressable
        ref={ref}
        {...rest}
        onPressIn={(event) => {
          animateTo(scaleTo, MOTION.pressIn);
          onPressIn?.(event);
        }}
        onPressOut={(event) => {
          animateTo(1, MOTION.pressOut);
          onPressOut?.(event);
        }}
      >
        <Animated.View style={{ transform: [{ scale }] }}>{children}</Animated.View>
      </Pressable>
    );
  }
);

/**
 * Fades and lifts a screen in when it is mounted. The parent keys it by screen,
 * so every change of tab or screen plays once. Opacity and a short translate are
 * both native-driven, and touches are never blocked while it runs.
 */
export function ScreenFade({ children }: { children: React.ReactNode }) {
  const opacity = useRef(new Animated.Value(0)).current;
  const lift = useRef(new Animated.Value(6)).current;
  const reduce = useReducedMotion();

  useEffect(() => {
    if (reduce) {
      opacity.setValue(1);
      lift.setValue(0);
      return;
    }
    const enter = Animated.parallel([
      Animated.timing(opacity, {
        toValue: 1,
        duration: MOTION.fade,
        easing: MOTION.ease,
        useNativeDriver: true,
      }),
      Animated.timing(lift, {
        toValue: 0,
        duration: MOTION.fade,
        easing: MOTION.ease,
        useNativeDriver: true,
      }),
    ]);
    enter.start();
    return () => enter.stop();
  }, [opacity, lift, reduce]);

  return (
    <Animated.View style={{ flex: 1, opacity, transform: [{ translateY: lift }] }}>
      {children}
    </Animated.View>
  );
}

/**
 * A ring with a white arc that turns continuously, with a small dot breathing in
 * its centre. It is mounted only while an operation is genuinely pending, so the
 * loops start with the operation and stop when the component unmounts.
 */
export function LoadingSpinner({ size = 28 }: { size?: number }) {
  const spin = useRef(new Animated.Value(0)).current;
  const breathe = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const turn = Animated.loop(
      Animated.timing(spin, {
        toValue: 1,
        duration: 900,
        easing: Easing.linear,
        useNativeDriver: true,
      })
    );
    const pulse = Animated.loop(
      Animated.sequence([
        Animated.timing(breathe, {
          toValue: 1,
          duration: 700,
          easing: MOTION.ease,
          useNativeDriver: true,
        }),
        Animated.timing(breathe, {
          toValue: 0,
          duration: 700,
          easing: MOTION.ease,
          useNativeDriver: true,
        }),
      ])
    );
    turn.start();
    pulse.start();
    return () => {
      turn.stop();
      pulse.stop();
    };
  }, [spin, breathe]);

  const dot = size * 0.3;

  return (
    <View style={{ width: size, height: size, alignItems: "center", justifyContent: "center" }}>
      <Animated.View
        style={{
          position: "absolute",
          width: size,
          height: size,
          borderRadius: size / 2,
          borderWidth: 3,
          borderColor: colors.surface,
          borderTopColor: colors.text,
          transform: [
            {
              rotate: spin.interpolate({ inputRange: [0, 1], outputRange: ["0deg", "360deg"] }),
            },
          ],
        }}
      />
      <Animated.View
        style={{
          width: dot,
          height: dot,
          borderRadius: dot / 2,
          backgroundColor: colors.text,
          transform: [
            { scale: breathe.interpolate({ inputRange: [0, 1], outputRange: [0.55, 1] }) },
          ],
        }}
      />
    </View>
  );
}

/** The confirmation shown once Android has verified a permission. It fades and settles in once. */
export function GrantedBadge() {
  const reveal = useRef(new Animated.Value(0)).current;
  const reduce = useReducedMotion();

  useEffect(() => {
    if (reduce) {
      reveal.setValue(1);
      return;
    }
    const settle = Animated.timing(reveal, {
      toValue: 1,
      duration: MOTION.fade + 60,
      easing: MOTION.ease,
      useNativeDriver: true,
    });
    settle.start();
    return () => settle.stop();
  }, [reveal, reduce]);

  return (
    <Animated.View
      style={{
        flexDirection: "row",
        alignItems: "center",
        gap: space(1),
        opacity: reveal,
        transform: [{ scale: reveal.interpolate({ inputRange: [0, 1], outputRange: [0.92, 1] }) }],
      }}
    >
      <Check size={18} color={colors.text} strokeWidth={2.4} />
      <Text style={{ color: colors.text, ...typeScale.callout, fontWeight: "600" }}>Granted</Text>
    </Animated.View>
  );
}
