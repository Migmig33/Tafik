import { useCallback, useEffect, useRef, useState } from "react";
import { Animated, Easing, ScrollView, StyleSheet, View } from "react-native";
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

// Keep the established story timing. Motion is layered onto the same fade,
// hold, and fade-out sequence rather than making the intro longer or faster.
const FADE_IN = 700;
const HOLD = 2000;
const FADE_OUT = 600;
const FINAL_PAUSE_MS = 220;
const RIPPLE_DURATION_MS = 860;
const RIPPLE_ECHO_DELAY_MS = 160;
const COPY_REVEAL_MS = 420;
const COPY_STAGGER_MS = 90;
const CTA_REVEAL_MS = 450;
const IDLE_HALF_CYCLE_MS = 2500;

const FADE_CURVE = Easing.inOut(Easing.ease);

export default function WelcomeScreen({ onGetStarted }: { onGetStarted: () => void }) {
  const { colors } = useTheme();
  const { play: playWhoosh, lockupMs } = useWhoosh();
  const [index, setIndex] = useState(0);
  const [brandVisible, setBrandVisible] = useState(false);
  const [ctaReady, setCtaReady] = useState(false);
  const line = useRef(new Animated.Value(0)).current;
  const tagline = useRef(new Animated.Value(0)).current;
  const supportingCopy = useRef(new Animated.Value(0)).current;
  const cta = useRef(new Animated.Value(0)).current;
  const idle = useRef(new Animated.Value(0)).current;
  const finalPause = useRef<ReturnType<typeof setTimeout> | null>(null);
  const copyAnimation = useRef<Animated.CompositeAnimation | null>(null);
  const ctaAnimation = useRef<Animated.CompositeAnimation | null>(null);
  const idleAnimation = useRef<Animated.CompositeAnimation | null>(null);

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
        toValue: 2,
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

  // Let the final sentence fully clear before the story resolves into TapIn.
  // The whoosh still begins at the exact moment BrandLockup appears.
  useEffect(() => {
    if (!finishedLines) return;

    finalPause.current = setTimeout(() => {
      setBrandVisible(true);
      playWhoosh();
    }, FINAL_PAUSE_MS);

    return () => {
      if (finalPause.current) clearTimeout(finalPause.current);
    };
  }, [finishedLines, playWhoosh]);

  const startIdleMotion = useCallback(() => {
    idleAnimation.current?.stop();
    idleAnimation.current = Animated.loop(
      Animated.sequence([
        Animated.timing(idle, {
          toValue: 1,
          duration: IDLE_HALF_CYCLE_MS,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
        Animated.timing(idle, {
          toValue: 0,
          duration: IDLE_HALF_CYCLE_MS,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
      ])
    );
    idleAnimation.current.start();
  }, [idle]);

  const revealCta = useCallback(() => {
    ctaAnimation.current = Animated.timing(cta, {
      toValue: 1,
      duration: CTA_REVEAL_MS,
      easing: Easing.out(Easing.ease),
      useNativeDriver: true,
    });
    ctaAnimation.current.start(({ finished }) => {
      if (!finished) return;
      setCtaReady(true);
      startIdleMotion();
    });
  }, [cta, startIdleMotion]);

  const revealFinalCopy = useCallback(() => {
    copyAnimation.current = Animated.stagger(COPY_STAGGER_MS, [
      Animated.timing(tagline, {
        toValue: 1,
        duration: COPY_REVEAL_MS,
        easing: Easing.out(Easing.ease),
        useNativeDriver: true,
      }),
      Animated.timing(supportingCopy, {
        toValue: 1,
        duration: COPY_REVEAL_MS,
        easing: Easing.out(Easing.ease),
        useNativeDriver: true,
      }),
    ]);
    copyAnimation.current.start(({ finished }) => {
      if (finished) revealCta();
    });
  }, [revealCta, supportingCopy, tagline]);

  useEffect(
    () => () => {
      copyAnimation.current?.stop();
      ctaAnimation.current?.stop();
      idleAnimation.current?.stop();
    },
    []
  );

  const lineOpacity = line.interpolate({
    inputRange: [0, 1, 2],
    outputRange: [0, 1, 0],
  });
  const lineTranslateY = line.interpolate({
    inputRange: [0, 1, 2],
    outputRange: [8, 0, -7],
  });
  const lineScale = line.interpolate({
    inputRange: [0, 1, 2],
    outputRange: [0.985, 1, 1],
  });

  return (
    <View style={[styles.screen, { backgroundColor: colors.bg }]}>
      {finishedLines ? (
        <ScrollView
          style={styles.finalScroll}
          contentContainerStyle={styles.finalScrollContent}
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.finalComposition}>
            <Animated.View
              style={[
                styles.brandStage,
                {
                  transform: [
                    {
                      translateY: idle.interpolate({
                        inputRange: [0, 1],
                        outputRange: [0, -2],
                      }),
                    },
                  ],
                },
              ]}
            >
              {brandVisible ? (
                <>
                  <BrandTapRipple />
                  <BrandLockup
                    durationMs={lockupMs}
                    onDone={revealFinalCopy}
                    showTagline={false}
                  />
                </>
              ) : null}
            </Animated.View>

            <View style={styles.finalCopy}>
              <Animated.View
                style={{
                  opacity: tagline,
                  transform: [
                    {
                      translateY: tagline.interpolate({
                        inputRange: [0, 1],
                        outputRange: [8, 0],
                      }),
                    },
                  ],
                }}
              >
                <Text style={[styles.finalTagline, { color: colors.text }]}>
                  Tap in. Stay Tapped In.
                </Text>
              </Animated.View>

              <Animated.View
                style={{
                  opacity: supportingCopy,
                  transform: [
                    {
                      translateY: supportingCopy.interpolate({
                        inputRange: [0, 1],
                        outputRange: [7, 0],
                      }),
                    },
                  ],
                }}
              >
                <Text style={[styles.finalSupport, { color: colors.textDim }]}>
                  Take back your focus, one tap at a time.
                </Text>
              </Animated.View>
            </View>

            <Animated.View
              pointerEvents={ctaReady ? "auto" : "none"}
              accessibilityElementsHidden={!ctaReady}
              importantForAccessibility={ctaReady ? "auto" : "no-hide-descendants"}
              style={[
                styles.cta,
                {
                  opacity: cta,
                  transform: [
                    { translateY: cta.interpolate({ inputRange: [0, 1], outputRange: [10, 0] }) },
                  ],
                },
              ]}
            >
              <PrimaryButton label="Get started" onPress={onGetStarted} />
            </Animated.View>
          </View>
        </ScrollView>
      ) : (
        <Animated.View
          style={{
            width: "100%",
            opacity: lineOpacity,
            transform: [{ translateY: lineTranslateY }, { scale: lineScale }],
          }}
        >
          <Text
            style={[
              styles.line,
              index === LINES.length - 1
                ? [styles.closingLine, { color: colors.text }]
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

/** One quiet tap response behind the mark; it plays once and fully disappears. */
function BrandTapRipple() {
  const { colors } = useTheme();
  const primary = useRef(new Animated.Value(0)).current;
  const echo = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const animation = Animated.parallel([
      Animated.timing(primary, {
        toValue: 1,
        duration: RIPPLE_DURATION_MS,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.sequence([
        Animated.delay(RIPPLE_ECHO_DELAY_MS),
        Animated.timing(echo, {
          toValue: 1,
          duration: RIPPLE_DURATION_MS,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
      ]),
    ]);

    animation.start();
    return () => animation.stop();
  }, [echo, primary]);

  return (
    <View pointerEvents="none" style={styles.rippleLayer}>
      <Animated.View
        style={[
          styles.tapRing,
          {
            borderColor: colors.text,
            opacity: primary.interpolate({
              inputRange: [0, 0.18, 0.72, 1],
              outputRange: [0, 0.13, 0.04, 0],
            }),
            transform: [
              { scale: primary.interpolate({ inputRange: [0, 1], outputRange: [0.34, 1.04] }) },
            ],
          },
        ]}
      />
      <Animated.View
        style={[
          styles.tapRing,
          {
            borderColor: colors.text,
            opacity: echo.interpolate({
              inputRange: [0, 0.18, 1],
              outputRange: [0, 0.065, 0],
            }),
            transform: [
              { scale: echo.interpolate({ inputRange: [0, 1], outputRange: [0.42, 1.14] }) },
            ],
          },
        ]}
      />
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
  finalScroll: {
    width: "100%",
  },
  finalScrollContent: {
    flexGrow: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: space(3),
  },
  finalComposition: {
    width: "100%",
    alignItems: "center",
    transform: [{ translateY: -8 }],
  },
  brandStage: {
    width: "100%",
    height: 174,
    alignItems: "center",
    justifyContent: "flex-start",
  },
  rippleLayer: {
    position: "absolute",
    top: -24,
    left: "50%",
    width: 144,
    height: 144,
    marginLeft: -72,
    alignItems: "center",
    justifyContent: "center",
  },
  tapRing: {
    position: "absolute",
    width: 144,
    height: 144,
    borderRadius: 999,
    borderWidth: StyleSheet.hairlineWidth,
  },
  finalCopy: {
    width: "100%",
    minHeight: 60,
    alignItems: "center",
    marginTop: space(1.5),
    paddingHorizontal: space(0.5),
  },
  finalTagline: {
    fontSize: 17,
    lineHeight: 25,
    fontWeight: "600",
    textAlign: "center",
  },
  finalSupport: {
    maxWidth: 300,
    marginTop: space(0.5),
    fontSize: 14,
    lineHeight: 20,
    textAlign: "center",
  },
  cta: {
    width: "100%",
    marginTop: space(2.25),
  },
  line: {
    fontSize: 24,
    lineHeight: 35,
    letterSpacing: -0.3,
    textAlign: "center",
  },
  closingLine: {
    fontSize: 25,
    fontWeight: "600",
    letterSpacing: -0.4,
  },
});
