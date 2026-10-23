import { useEffect, useRef, useState, type ReactNode } from "react";
import { Animated, StyleSheet, View, type StyleProp, type ViewStyle } from "react-native";
import Svg, { Circle, Defs, RadialGradient, Stop } from "react-native-svg";
import { AnimatedSwapText, AppMark, Body, GhostButton, Screen, TapRipple } from "../components";
import { MOTION, PressableScale, useReducedMotion } from "../motion";
import { Nav } from "../nav";
import EmergencyExitButton from "../emergencyExit";
import SessionClock from "../sessionClock";
import { formatClock } from "../timeFormat";
import { NAV_CLEARANCE } from "../tabBar";
import { colors, space, typeScale } from "../theme";
import { Text } from "../typography";

/**
 * The card-tapping screen. The middle button in the tab bar opens it and arms
 * the reader, so the circle, its mark and its ripple live here rather than on
 * Home. The same circle starts a session and ends one. The app shell owns the
 * read itself, so this screen only shows its state and forwards taps.
 */
export default function NfcTapScreen({
  nav,
  active,
  blockCount,
  cycleMode,
  scanning,
  onTafik,
  onStartWithoutCard,
  startedAt,
}: {
  nav: Nav;
  active: boolean;
  /** When the running session began, for its clock. Null when none is running. */
  startedAt: number | null;
  blockCount: number;
  /** Cycle is the next session to start, so the circle says so. */
  cycleMode: boolean;
  /** Which read is open, if any. Owned by the app shell. */
  scanning: null | "start" | "end";
  /** Arm the reader. The same action the tab bar's centre button runs. */
  onTafik: () => void;
  /** Start the session without reading a card, behind a confirmation. */
  onStartWithoutCard: () => void;
}) {
  const waiting = active ? scanning === "end" : scanning === "start";
  const headline = waiting ? READY_TEXT : cycleMode ? "Tap in to start Cycle" : "Tap in to begin";
  const caption = waiting ? "Hold your card to the back of your phone." : "apps will be locked.";

  // The running session shows only the brand, the clock, and the way out.
  const session = active && !waiting;
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    if (!session) return;
    setNow(Date.now());
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [session]);

  if (session) {
    const elapsed = startedAt ? Math.max(0, Math.floor((now - startedAt) / 1000)) : 0;
    return (
      <Screen>
        <View style={styles.activeColumn}>
          <View style={styles.brandMark}>
            <AppMark height={32} color={colors.text} />
          </View>
          <View style={styles.timerArea}>
            <SessionClock seconds={elapsed} accessibilityLabel={`Focus time ${formatClock(elapsed)}`} />
          </View>
          <View style={styles.emergency}>
            <EmergencyExitButton onPress={() => nav("emergency")} />
          </View>
          <View style={{ height: NAV_CLEARANCE }} />
        </View>
      </Screen>
    );
  }

  // The reader is open at the end of a session. The brand sits at the top as in the session
  // view, the ring is centred with room below it so its outer edge clears the words, and the way
  // out sits above the tab bar, where it can be reached.
  if (active) {
    return (
      <Screen>
        <View style={styles.activeColumn}>
          <View style={styles.brandMark}>
            <AppMark height={32} color={colors.text} />
          </View>
          <View style={styles.readerArea}>
            <TapRipple active={waiting} size={184} coreSize={116}>
              <AppMark height={72} color={colors.text} />
            </TapRipple>
            <View style={styles.readerText}>
              <Text style={[styles.headline, { color: colors.accent }]}>{READY_TEXT}</Text>
              <Body dim>Hold your card to the back of your phone.</Body>
            </View>
          </View>
          <View style={styles.emergency}>
            <EmergencyExitButton onPress={() => nav("emergency")} />
          </View>
          <View style={{ height: NAV_CLEARANCE }} />
        </View>
      </Screen>
    );
  }

  // The start page has no header, so its content sits in the middle of the screen.
  return (
    <Screen>
      <View style={styles.cluster}>
        <FadeIn style={styles.startContent}>
          {/* Ripple and caption are one unit. Only this unit is pressable, so a
              tap in the empty space around it cannot arm the reader. */}
          <PressableScale
            accessibilityRole="button"
            accessibilityLabel={cycleMode ? "Tap in to start Cycle" : "Tap in to begin"}
            accessibilityState={{ disabled: waiting }}
            onPress={onTafik}
            disabled={waiting}
            style={styles.target}
          >
            {/* The brand mark is the focal point. A soft halo sits behind it and the ripple rings out from it. */}
            <View style={styles.focal}>
              <Halo size={HALO} />
              <TapRipple active={waiting} size={184} coreSize={116} showCore={false} smooth>
                <AppMark height={84} color={colors.text} />
              </TapRipple>
            </View>
            <View style={styles.caption}>
              <Swap value={headline}>
                {(shown) => (
                  <Text style={[styles.headline, { color: shown === READY_TEXT ? colors.accent : colors.text }]}>
                    {shown}
                  </Text>
                )}
              </Swap>
              <Swap value={caption}>{(shown) => <Body dim>{shown}</Body>}</Swap>
            </View>
          </PressableScale>

          {/* Outside the circle's pressable, so the tap that reaches it can
              never also be the tap that armed the reader. */}
          {waiting ? (
            <FadeIn style={styles.withoutCard}>
              <GhostButton label="Start without card" onPress={onStartWithoutCard} />
            </FadeIn>
          ) : null}
        </FadeIn>
      </View>
    </Screen>
  );
}

const READY_TEXT = "Ready to scan";
// The halo is wider than the ring so its soft edge fades out before the ring's outer edge.
const HALO = 264;
const ENTER_MS = 280;

/** A soft light behind the mark. It has no edge, so it reads as depth rather than a badge. */
function Halo({ size }: { size: number }) {
  return (
    <Svg style={StyleSheet.absoluteFill} width={size} height={size} pointerEvents="none">
      <Defs>
        <RadialGradient id="nfcHalo" cx="50%" cy="50%" rx="50%" ry="50%">
          <Stop offset={0} stopColor={colors.text} stopOpacity={0.06} />
          <Stop offset={1} stopColor={colors.text} stopOpacity={0} />
        </RadialGradient>
      </Defs>
      <Circle cx={size / 2} cy={size / 2} r={size / 2} fill="url(#nfcHalo)" />
    </Svg>
  );
}

/** The label swap. Under reduce motion the new label simply appears, with no fade or slide. */
function Swap({ value, children }: { value: string; children: (shown: string) => ReactNode }) {
  const reduce = useReducedMotion();
  return reduce ? <>{children(value)}</> : <AnimatedSwapText value={value}>{children}</AnimatedSwapText>;
}

/** Fades its children in on mount. Reduce motion shows them at once. */
function FadeIn({ children, style }: { children: ReactNode; style?: StyleProp<ViewStyle> }) {
  const reduce = useReducedMotion();
  const opacity = useRef(new Animated.Value(reduce ? 1 : 0)).current;

  useEffect(() => {
    if (reduce) {
      opacity.setValue(1);
      return;
    }
    const fade = Animated.timing(opacity, {
      toValue: 1,
      duration: ENTER_MS,
      easing: MOTION.ease,
      useNativeDriver: true,
    });
    fade.start();
    return () => fade.stop();
  }, [opacity, reduce]);

  return <Animated.View style={[style, { opacity }]}>{children}</Animated.View>;
}

const styles = StyleSheet.create({
  // The running session and the open reader share this column: the brand mark at the top, the
  // main content in the room below it, and the Emergency Exit above the tab bar.
  activeColumn: {
    flex: 1,
    alignItems: "center",
  },
  brandMark: {
    marginTop: space(3),
  },
  timerArea: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  // The reader's ring and words, centred in the room between the brand and the way out.
  readerArea: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  // The ring's outer edge reaches past its box, so the words sit below that edge with room to spare.
  readerText: {
    marginTop: space(5),
    alignItems: "center",
    gap: space(1),
    paddingHorizontal: space(2),
  },
  emergency: {
    marginBottom: space(3),
  },
  cluster: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  // The start page's ring and caption form one group, lifted clear of the floating
  // tab bar so the group sits where the eye expects the centre of the screen to be.
  startContent: {
    alignItems: "center",
    gap: space(3),
    paddingBottom: space(6),
  },
  target: {
    alignItems: "center",
    gap: space(1),
  },
  // PressableScale wraps its children in a plain view, so each block centres itself.
  focal: {
    width: HALO,
    height: HALO,
    alignSelf: "center",
    alignItems: "center",
    justifyContent: "center",
  },
  caption: {
    alignSelf: "center",
    alignItems: "center",
    gap: space(1),
  },
  headline: {
    fontSize: typeScale.headline.fontSize,
    fontWeight: "600",
  },
  // Held well clear of the circle: this is the path that locks the phone without
  // a key in hand, so it should never be reachable by a near miss.
  withoutCard: {
    marginTop: space(3),
  },
});
