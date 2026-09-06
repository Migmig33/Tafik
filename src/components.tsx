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
import type { DimensionValue } from "react-native";
import type { LucideIcon } from "lucide-react-native";
import { radius, space, useTheme } from "./theme";
import { Text } from "./typography";

// The glyph's share of the square artwork. The asset carries a large safe-zone
// margin, so anything drawing the mark has to crop to these bounds or it gets
// padding it did not ask for.
const GLYPH_WIDTH_RATIO = 0.25;
const GLYPH_HEIGHT_RATIO = 0.381;

// The supplied motion reference builds the mark in two overlapping pieces.
// These bounds isolate the horizontal bar inside the cropped glyph without
// maintaining a second logo asset that could drift from the launcher artwork.
const GLYPH_CROSSBAR_TOP_RATIO = 0.23;
const GLYPH_CROSSBAR_HEIGHT_RATIO = 0.23;

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

/**
 * Reproduces the reference clip's two-stage reveal: the crossbar leads, then
 * the diagonal stem catches up underneath it. The sampled opacity stops come
 * from the first 600 ms of the supplied five-second video; its remaining time
 * is a static hold.
 */
function AnimatedAppMark({
  height,
  color,
  progress,
}: {
  height: number;
  color: string;
  progress: Animated.Value;
}) {
  const artwork = Math.round(height / GLYPH_HEIGHT_RATIO);
  const width = Math.round(artwork * GLYPH_WIDTH_RATIO);
  const crossbarTop = Math.round(height * GLYPH_CROSSBAR_TOP_RATIO);
  const crossbarHeight = Math.round(height * GLYPH_CROSSBAR_HEIGHT_RATIO);

  const crossbarOpacity = progress.interpolate({
    inputRange: [0, 0.083, 0.167, 0.25, 0.333, 0.417, 0.5, 0.583, 0.667, 0.75, 0.833, 1],
    outputRange: [0, 0.12, 0.32, 0.42, 0.6, 0.69, 0.82, 0.87, 0.95, 0.98, 1, 1],
  });
  const stemOpacity = progress.interpolate({
    inputRange: [0, 0.333, 0.417, 0.5, 0.583, 0.667, 0.75, 0.833, 0.917, 1],
    outputRange: [0, 0, 0.09, 0.36, 0.5, 0.72, 0.81, 0.95, 0.985, 1],
  });

  return (
    <View style={{ width, height }}>
      {/* The complete mark supplies the delayed diagonal layer. Rendering the
          bar again above it recreates the small overlap visible in the clip. */}
      <Animated.View
        style={{ position: "absolute", top: 0, right: 0, bottom: 0, left: 0, opacity: stemOpacity }}
      >
        <AppMark height={height} color={color} />
      </Animated.View>

      <Animated.View
        style={{
          position: "absolute",
          left: 0,
          right: 0,
          top: crossbarTop,
          height: crossbarHeight,
          overflow: "hidden",
          opacity: crossbarOpacity,
        }}
      >
        <View style={{ position: "absolute", left: 0, top: -crossbarTop }}>
          <AppMark height={height} color={color} />
        </View>
      </Animated.View>
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
      accessibilityRole="button"
      accessibilityState={{ disabled: !!disabled }}
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
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={{ paddingVertical: space(1.5), alignItems: "center" }}
    >
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
    // Width can't be driven natively, but one slowly moving bar is cheap.
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
 * The animated brand lockup: the t assembles like the supplied reference while
 * the wordmark and tagline rise underneath. Shared by the first-run welcome
 * and the ordinary launch intro so the two can never drift apart. `onDone`
 * fires once the whole sequence has settled.
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
    // The measured mark reveal fills the clip while the copy joins during its
    // final 40%. Both start from the same mount that requests the whoosh.
    const animation = Animated.parallel([
      Animated.timing(mark, {
        toValue: 1,
        duration: total.current,
        easing: Easing.linear,
        useNativeDriver: true,
      }),
      Animated.sequence([
        Animated.delay(Math.round(total.current * 0.6)),
        Animated.timing(copy, {
          toValue: 1,
          duration: Math.round(total.current * 0.4),
          easing: Easing.out(Easing.ease),
          useNativeDriver: true,
        }),
      ]),
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
        }}
      >
        <AnimatedAppMark height={96} color={colors.accent} progress={mark} />
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
        <Text style={[styles.brandTitle, { color: colors.text }]}>TockIn</Text>
        {showTagline ? (
          <Text style={[styles.brandTagline, { color: colors.textDim }]}>Tap in. Stay locked in.</Text>
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

// One driver for every skeleton on screen. A per-block loop would start
// counting from whatever moment that block mounted, and a list of rows would
// visibly ripple out of phase instead of breathing as one surface.
const skeletonPulse = new Animated.Value(0);
let skeletonBlocks = 0;
let skeletonLoop: Animated.CompositeAnimation | null = null;

function useSkeletonPulse() {
  useEffect(() => {
    skeletonBlocks += 1;
    if (!skeletonLoop) {
      skeletonLoop = Animated.loop(
        Animated.sequence([
          Animated.timing(skeletonPulse, {
            toValue: 1,
            duration: 700,
            easing: Easing.inOut(Easing.ease),
            useNativeDriver: true,
          }),
          Animated.timing(skeletonPulse, {
            toValue: 0,
            duration: 700,
            easing: Easing.inOut(Easing.ease),
            useNativeDriver: true,
          }),
        ])
      );
      skeletonLoop.start();
    }
    return () => {
      skeletonBlocks -= 1;
      // The last block leaving takes the loop with it, so nothing keeps
      // animating behind a screen that has already finished loading.
      if (skeletonBlocks === 0) {
        skeletonLoop?.stop();
        skeletonLoop = null;
        skeletonPulse.setValue(0);
      }
    };
  }, []);
  return skeletonPulse;
}

/**
 * A placeholder block shaped like the content that is still loading. It is
 * driven on the native thread because the reads it stands in for are native
 * calls that can leave the JS thread busy, which is exactly when a spinner
 * stutters and starts reading as a freeze.
 */
export function Skeleton({
  width,
  height,
  borderRadius = 6,
  style,
}: {
  width?: DimensionValue;
  height: DimensionValue;
  borderRadius?: number;
  style?: ViewStyle;
}) {
  const { colors } = useTheme();
  const pulse = useSkeletonPulse();
  return (
    <Animated.View
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={[
        {
          width,
          height,
          borderRadius,
          backgroundColor: colors.accentWash,
          opacity: pulse.interpolate({ inputRange: [0, 1], outputRange: [1, 0.4] }),
        },
        style,
      ]}
    />
  );
}
