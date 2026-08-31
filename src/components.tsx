import React, { useEffect, useRef, useState } from "react";
import {
  Animated,
  Easing,
  Pressable,
  StyleSheet,
  View,
  ViewStyle,
} from "react-native";
import { radius, space, useTheme } from "./theme";
import { Text } from "./typography";

export function Screen({
  children,
  tinted,
}: {
  children: React.ReactNode;
  tinted?: boolean;
}) {
  const { colors } = useTheme();
  return (
    <View
      style={{
        flex: 1,
        backgroundColor: tinted ? colors.accentWash : colors.bg,
        paddingHorizontal: space(2.5),
        paddingTop: space(7),
        paddingBottom: space(3),
      }}
    >
      {children}
    </View>
  );
}

export function Title({ children }: { children: React.ReactNode }) {
  const { colors } = useTheme();
  return (
    <Text
      style={{
        color: colors.text,
        fontSize: 26,
        fontWeight: "600",
        letterSpacing: -0.4,
      }}
    >
      {children}
    </Text>
  );
}

export function Body({
  children,
  dim,
}: {
  children: React.ReactNode;
  dim?: boolean;
}) {
  const { colors } = useTheme();
  return (
    <Text style={{ color: dim ? colors.textDim : colors.text, fontSize: 15, lineHeight: 22 }}>
      {children}
    </Text>
  );
}

export function PrimaryButton({
  label,
  onPress,
  disabled,
}: {
  label: string;
  onPress: () => void;
  disabled?: boolean;
}) {
  const { colors } = useTheme();
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      style={({ pressed }) => ({
        backgroundColor: disabled ? colors.border : colors.accent,
        borderRadius: radius.pill,
        paddingVertical: space(2),
        alignItems: "center",
        opacity: pressed ? 0.85 : 1,
      })}
    >
      <Text
        style={{
          color: disabled ? colors.textDim : colors.onAccent,
          fontSize: 16,
          fontWeight: "600",
        }}
      >
        {label}
      </Text>
    </Pressable>
  );
}

export function GhostButton({ label, onPress }: { label: string; onPress: () => void }) {
  const { colors } = useTheme();
  return (
    <Pressable onPress={onPress} style={{ paddingVertical: space(1.5), alignItems: "center" }}>
      <Text style={{ color: colors.textDim, fontSize: 15, fontWeight: "500" }}>{label}</Text>
    </Pressable>
  );
}

export function Card({ children, style }: { children: React.ReactNode; style?: ViewStyle }) {
  const { colors } = useTheme();
  return (
    <View
      style={[
        {
          backgroundColor: colors.surface,
          borderRadius: radius.card,
          borderWidth: StyleSheet.hairlineWidth,
          borderColor: colors.border,
          padding: space(2),
        },
        style,
      ]}
    >
      {children}
    </View>
  );
}

/** A quiet concentric-ripple cue for "tap your card". Not skeuomorphic. */
export function TapRipple({ active = true }: { active?: boolean }) {
  const { colors } = useTheme();
  const a = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!active) {
      // Park the rings at the start so re-arming always pulses from zero.
      a.setValue(0);
      return;
    }
    const loop = Animated.loop(
      Animated.timing(a, {
        toValue: 1,
        duration: 2200,
        easing: Easing.out(Easing.ease),
        useNativeDriver: true,
      })
    );
    loop.start();
    return () => loop.stop();
  }, [a, active]);

  const ring = (delay: number) => {
    const p = Animated.modulo(Animated.add(a, delay), 1);
    return {
      transform: [{ scale: p.interpolate({ inputRange: [0, 1], outputRange: [0.6, 1.9] }) }],
      opacity: p.interpolate({ inputRange: [0, 0.15, 1], outputRange: [0, 0.5, 0] }),
    };
  };

  return (
    <View style={{ width: 160, height: 160, alignItems: "center", justifyContent: "center" }}>
      {active && (
        <>
          <Animated.View style={[styles.ring, { borderColor: colors.accent }, ring(0)]} />
          <Animated.View style={[styles.ring, { borderColor: colors.accent }, ring(0.5)]} />
        </>
      )}
      <View
        style={{
          width: 64,
          height: 64,
          borderRadius: 999,
          borderWidth: 1.5,
          borderColor: colors.accent,
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  ring: {
    position: "absolute",
    width: 160,
    height: 160,
    borderRadius: 999,
    borderWidth: 1.5,
  },
});

/**
 * Press-and-hold confirmation. The delay is the safeguard: it makes an
 * irreversible action impossible to trigger by accident or by reflex, and it
 * gives the user the whole hold to change their mind. Letting go at any point
 * cancels and rewinds. onComplete fires only if the hold runs the full length.
 */
export function HoldButton({
  label,
  seconds,
  onComplete,
  disabled,
}: {
  label: string;
  seconds: number;
  onComplete: () => void;
  disabled?: boolean;
}) {
  const { colors } = useTheme();
  const progress = useRef(new Animated.Value(0)).current;
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);
  const [holding, setHolding] = useState(false);
  const [left, setLeft] = useState(seconds);

  const stopTimer = () => {
    if (timer.current !== null) {
      clearInterval(timer.current);
      timer.current = null;
    }
  };

  // A hold that outlives the screen would fire onComplete into nothing.
  useEffect(() => {
    return () => {
      stopTimer();
      progress.stopAnimation();
    };
  }, [progress]);

  const start = () => {
    if (disabled) return;
    setHolding(true);
    setLeft(seconds);
    const startedAt = Date.now();
    stopTimer();
    timer.current = setInterval(() => {
      const remaining = seconds - Math.floor((Date.now() - startedAt) / 1000);
      setLeft(Math.max(0, remaining));
    }, 250);
    // Width can't be driven natively, but one bar over 30s is cheap.
    Animated.timing(progress, {
      toValue: 1,
      duration: seconds * 1000,
      easing: Easing.linear,
      useNativeDriver: false,
    }).start(({ finished }) => {
      if (!finished) return;
      stopTimer();
      setHolding(false);
      progress.setValue(0);
      onComplete();
    });
  };

  const cancel = () => {
    stopTimer();
    progress.stopAnimation();
    setHolding(false);
    setLeft(seconds);
    Animated.timing(progress, {
      toValue: 0,
      duration: 220,
      easing: Easing.out(Easing.ease),
      useNativeDriver: false,
    }).start();
  };

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled: !!disabled }}
      accessibilityHint={`Press and hold for ${seconds} seconds to confirm`}
      onPressIn={start}
      onPressOut={cancel}
      disabled={disabled}
      style={{
        height: 60,
        borderRadius: radius.pill,
        borderWidth: 1.5,
        borderColor: disabled ? colors.border : colors.accent,
        backgroundColor: colors.surface,
        overflow: "hidden",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <Animated.View
        style={{
          position: "absolute",
          left: 0,
          top: 0,
          bottom: 0,
          backgroundColor: colors.accentWash,
          width: progress.interpolate({ inputRange: [0, 1], outputRange: ["0%", "100%"] }),
        }}
      />
      <Text
        style={{
          color: disabled ? colors.textDim : colors.accent,
          fontSize: 16,
          fontWeight: "600",
          fontVariant: ["tabular-nums"],
        }}
      >
        {holding ? `Keep holding… ${left}s` : label}
      </Text>
    </Pressable>
  );
}
