import React, { useEffect, useRef, useState } from "react";
import {
  Animated,
  Easing,
  Image,
  Modal,
  Pressable,
  StyleSheet,
  View,
  ViewStyle,
} from "react-native";
import type { LucideIcon } from "lucide-react-native";
import { radius, space, useTheme } from "./theme";
import { Text } from "./typography";

// The glyph's share of the square artwork. The asset carries a large safe-zone
// margin, so anything drawing the mark has to crop to these bounds or it gets
// padding it did not ask for.
const GLYPH_WIDTH_RATIO = 0.22;
const GLYPH_HEIGHT_RATIO = 0.381;

/**
 * The launcher icon's "t", cropped to the letter itself and tinted. Drawing it
 * from the asset rather than redrawing it keeps every place the mark appears
 * from drifting the next time the artwork changes.
 */
export function AppMark({ height, color }: { height: number; color: string }) {
  const artwork = Math.round(height / GLYPH_HEIGHT_RATIO);
  return (
    <View
      style={{
        width: Math.round(artwork * GLYPH_WIDTH_RATIO),
        height,
        alignItems: "center",
        justifyContent: "center",
        overflow: "hidden",
      }}
    >
      <Image
        source={require("./assets/adaptive-icon.png")}
        style={{ width: artwork, height: artwork, tintColor: color }}
        resizeMode="contain"
        accessibilityIgnoresInvertColors
      />
    </View>
  );
}

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

/**
 * A centred sheet for explaining something a settings row has no room for.
 * The backdrop, the Close button and the Android back button all dismiss it, so
 * it can never become a dead end even when the content itself is inert.
 */
export function InfoSheet({
  visible,
  onClose,
  icon: Icon,
  title,
  body,
  muted,
  children,
}: {
  visible: boolean;
  onClose: () => void;
  icon: LucideIcon;
  title: string;
  body: string;
  /** For a feature that has not shipped: no accent anywhere on the sheet. */
  muted?: boolean;
  /** Extra content between the body and the Close button. */
  children?: React.ReactNode;
}) {
  const { colors } = useTheme();

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      {/* Tapping the dimmed area closes. The inner Pressable swallows taps so a
          press on the card itself does not fall through to it. */}
      <Pressable style={[styles.scrim, { backgroundColor: colors.scrim }]} onPress={onClose}>
        <Pressable
          style={[styles.sheet, { backgroundColor: colors.surface, borderColor: colors.border }]}
          onPress={() => {}}
        >
          <View
            style={[
              styles.sheetIcon,
              muted
                ? {
                    backgroundColor: colors.bg,
                    borderColor: colors.border,
                    borderWidth: StyleSheet.hairlineWidth,
                  }
                : { backgroundColor: colors.accentWash },
            ]}
          >
            <Icon size={20} color={muted ? colors.textDim : colors.accent} strokeWidth={2.1} />
          </View>
          <Text style={[styles.sheetTitle, { color: colors.text }]}>{title}</Text>
          <Text style={[styles.sheetBody, { color: colors.textDim }]}>{body}</Text>
          {children ? <View style={styles.sheetChildren}>{children}</View> : null}
          <View style={styles.sheetActions}>
            <GhostButton label="Close" onPress={onClose} />
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

/**
 * A quiet concentric-ripple cue for "tap your card". Not skeuomorphic.
 * The defaults are the card-setup size; home overrides them because there the
 * ripple is the screen's focal point rather than one step in a flow.
 */
export function TapRipple({
  active = true,
  size = 160,
  coreSize = 64,
  children,
}: {
  active?: boolean;
  /** Footprint of the ripple, and the base the rings scale up from. */
  size?: number;
  /** Diameter of the outlined circle at the centre. */
  coreSize?: number;
  /** Optional mark drawn inside the outlined centre circle. */
  children?: React.ReactNode;
}) {
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

  const ringSize = { width: size, height: size };

  return (
    <View style={{ width: size, height: size, alignItems: "center", justifyContent: "center" }}>
      {active && (
        <>
          <Animated.View style={[styles.ring, ringSize, { borderColor: colors.accent }, ring(0)]} />
          <Animated.View style={[styles.ring, ringSize, { borderColor: colors.accent }, ring(0.5)]} />
        </>
      )}
      <View
        style={{
          width: coreSize,
          height: coreSize,
          borderRadius: 999,
          borderWidth: 1.5,
          borderColor: colors.accent,
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        {children}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  scrim: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: space(3),
  },
  sheet: {
    width: "100%",
    maxWidth: 340,
    alignItems: "center",
    gap: space(1),
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: radius.card,
    padding: space(2.5),
  },
  sheetIcon: {
    width: 40,
    height: 40,
    borderRadius: 13,
    alignItems: "center",
    justifyContent: "center",
  },
  sheetTitle: {
    fontSize: 18,
    fontWeight: "600",
  },
  sheetBody: {
    fontSize: 13,
    lineHeight: 20,
    textAlign: "center",
  },
  // Stretched, because the sheet centres its children but block content and
  // buttons want the full width.
  sheetChildren: {
    alignSelf: "stretch",
    marginTop: space(0.5),
  },
  sheetActions: {
    alignSelf: "stretch",
  },
  brandTitle: {
    fontSize: 30,
    fontWeight: "600",
    letterSpacing: -0.6,
  },
  brandTagline: {
    marginTop: space(0.75),
    fontSize: 15,
    letterSpacing: 0.2,
  },
  ring: {
    position: "absolute",
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

/**
 * The animated brand lockup: the t mark scales up, then the wordmark and
 * tagline rise under it. Shared by the first-run welcome and the ordinary
 * launch intro so the two can never drift apart. `onDone` fires once the whole
 * sequence has settled.
 */
export function BrandLockup({
  durationMs,
  onDone,
  showTagline = true,
}: {
  /** Total length of the whole lockup, matched to the whoosh clip. */
  durationMs: number;
  onDone?: () => void;
  /** Keep shared launch lockups unchanged while allowing tighter compositions. */
  showTagline?: boolean;
}) {
  const { colors } = useTheme();
  const mark = useRef(new Animated.Value(0)).current;
  const copy = useRef(new Animated.Value(0)).current;
  // Held in a ref so a caller re-rendering with a new callback can't restart
  // the animation partway through.
  const done = useRef(onDone);
  done.current = onDone;
  // Captured once: the duration is whatever it was when the mark appeared, so
  // a late-arriving value cannot restart the animation midway.
  const total = useRef(durationMs);

  useEffect(() => {
    // The mark and the wordmark split the clip 60/40, so the lockup lands
    // exactly as the sound ends. A shorter clip means a faster animation.
    const animation = Animated.sequence([
      Animated.timing(mark, {
        toValue: 1,
        duration: Math.round(total.current * 0.6),
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.timing(copy, {
        toValue: 1,
        duration: Math.round(total.current * 0.4),
        easing: Easing.out(Easing.ease),
        useNativeDriver: true,
      }),
    ]);
    animation.start(({ finished }) => {
      if (finished) done.current?.();
    });
    return () => animation.stop();
  }, [copy, mark]);

  return (
    <>
      <Animated.View
        style={{
          alignItems: "center",
          opacity: mark,
          transform: [
            { scale: mark.interpolate({ inputRange: [0, 1], outputRange: [0.72, 1] }) },
          ],
        }}
      >
        <AppMark height={96} color={colors.accent} />
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
        <Text style={[styles.brandTitle, { color: colors.text }]}>TapIn</Text>
        {showTagline ? (
          <Text style={[styles.brandTagline, { color: colors.textDim }]}>tap and lock in</Text>
        ) : null}
      </Animated.View>
    </>
  );
}
/** Fade the old label away, then let the replacement settle down into place. */
export function AnimatedSwapText({
  value,
  children,
}: {
  value: string;
  children: (displayedValue: string) => React.ReactNode;
}) {
  const [displayed, setDisplayed] = useState(value);
  const current = useRef(value);
  const opacity = useRef(new Animated.Value(1)).current;
  const translateY = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    // If a very quick state reversal cancels the outgoing label before it was
    // swapped, return that still-correct label to a fully visible resting state.
    if (value === current.current) {
      opacity.stopAnimation();
      translateY.stopAnimation();
      opacity.setValue(1);
      translateY.setValue(0);
      return;
    }
    let cancelled = false;

    opacity.stopAnimation();
    translateY.stopAnimation();
    Animated.parallel([
      Animated.timing(opacity, {
        toValue: 0,
        duration: 120,
        easing: Easing.in(Easing.ease),
        useNativeDriver: true,
      }),
      Animated.timing(translateY, {
        toValue: 6,
        duration: 120,
        easing: Easing.in(Easing.ease),
        useNativeDriver: true,
      }),
    ]).start(({ finished }) => {
      if (!finished || cancelled) return;
      current.current = value;
      setDisplayed(value);
      opacity.setValue(0);
      translateY.setValue(-8);
      Animated.parallel([
        Animated.timing(opacity, {
          toValue: 1,
          duration: 220,
          easing: Easing.out(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(translateY, {
          toValue: 0,
          duration: 220,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
      ]).start();
    });

    return () => {
      cancelled = true;
      opacity.stopAnimation();
      translateY.stopAnimation();
    };
  }, [opacity, translateY, value]);

  return (
    <Animated.View style={{ opacity, transform: [{ translateY }] }}>
      {children(displayed)}
    </Animated.View>
  );
}
