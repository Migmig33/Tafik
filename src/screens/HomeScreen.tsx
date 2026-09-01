import { useEffect, useRef, useState } from "react";
import { Animated, Easing, Pressable, ScrollView, StyleSheet, View } from "react-native";
import type { LucideIcon } from "lucide-react-native";
import LockKeyhole from "lucide-react-native/icons/lock-keyhole";
import Repeat2 from "lucide-react-native/icons/repeat-2";
import Timer from "lucide-react-native/icons/timer";
import { AppMark, Body, GhostButton, Screen, TapRipple, Title } from "../components";
import { Nav } from "../nav";
import { getTodayStats, TodayStats } from "../store";
import { space, useTheme } from "../theme";
import { Text } from "../typography";

function fmt(totalSec: number): string {
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;
  const pad = (n: number) => n.toString().padStart(2, "0");
  return `${pad(h)}:${pad(m)}:${pad(s)}`;
}

/** Compact duration for the stats row: "0m", "48m", "2h 15m". */
function human(totalSec: number): string {
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  if (h === 0) return `${m}m`;
  return m === 0 ? `${h}h` : `${h}h ${m}m`;
}

export default function HomeScreen({
  nav,
  active,
  startedAt,
  blockCount,
  scanning,
  onTapIn,
}: {
  nav: Nav;
  active: boolean;
  startedAt: number | null;
  blockCount: number;
  /** Which read is open, if any. The scan itself is owned by the app shell,
      because the button that starts it now lives in the tab bar. */
  scanning: null | "start" | "end";
  /** Arm the reader. The same action the tab bar's centre button runs. */
  onTapIn: () => void;
}) {
  const { colors } = useTheme();
  const [now, setNow] = useState(Date.now());
  const [stats, setStats] = useState<TodayStats>({ seconds: 0, count: 0, streak: 0 });

  // Refresh stats whenever we return to the idle state (i.e. a session ended).
  useEffect(() => {
    if (!active) getTodayStats().then(setStats);
  }, [active]);

  useEffect(() => {
    if (!active) return;
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [active]);

  if (active) {
    const elapsed = startedAt ? Math.max(0, Math.floor((now - startedAt) / 1000)) : 0;
    const waiting = scanning === "end";
    return (
      <Screen>
        <ScrollView contentContainerStyle={{ flexGrow: 1 }} showsVerticalScrollIndicator={false}>
          <View style={styles.homeHeader}>
            <AnimatedSwapText value="TappedIn">
              {(label) => <Title>{label}</Title>}
            </AnimatedSwapText>
            <View style={[styles.streakPill, { backgroundColor: colors.accentWash }]}>
              <LockKeyhole size={17} color={colors.accent} strokeWidth={2.3} />
              <AnimatedSwapText value={waiting ? "Ready to scan" : "Session active"}>
                {(label) => (
                  <Text style={{ color: colors.text, fontSize: 14, fontWeight: "600" }}>
                    {label}
                  </Text>
                )}
              </AnimatedSwapText>
            </View>
          </View>

          {/* The active mark keeps Home's exact circle size. Arming the reader
              turns on the same expanding rings used by the start-card scan. */}
          <View style={styles.focusCluster}>
            <View style={styles.activeFocusContent}>
              <TapRipple active={waiting} size={184} coreSize={116}>
                <AppMark height={72} color={colors.text} />
              </TapRipple>
              <Text
                accessibilityLabel={`Focus time ${fmt(elapsed)}`}
                style={[styles.activeTimer, { color: colors.text }]}
              >
                {fmt(elapsed)}
              </Text>
              <Body dim>{blockCount} apps blocked</Body>
              {waiting ? (
                <Text style={[styles.scanInstruction, { color: colors.textDim }]}>
                  Hold your card to the back of your phone.
                </Text>
              ) : null}
            </View>
          </View>

          {/* Ending and cancelling live in the centre tab-bar button. */}
          <GhostButton label="Card lost? Emergency unlock" onPress={() => nav("emergency")} />
        </ScrollView>
      </Screen>
    );
  }

  const waiting = scanning === "start";

  return (
    <Screen>
      <ScrollView contentContainerStyle={{ flexGrow: 1 }} showsVerticalScrollIndicator={false}>
        <View style={styles.homeHeader}>
          <AnimatedSwapText value="TapIn">
            {(label) => <Title>{label}</Title>}
          </AnimatedSwapText>
          <View style={[styles.streakPill, { backgroundColor: colors.accentWash }]}>
            <LockKeyhole size={17} color={colors.accent} strokeWidth={2.3} />
            <AnimatedSwapText
              value={`${stats.streak} ${stats.streak === 1 ? "day" : "days"}`}
            >
              {(label) => (
                <Text style={{ color: colors.text, fontSize: 14, fontWeight: "600" }}>
                  {label}
                </Text>
              )}
            </AnimatedSwapText>
          </View>
        </View>

        {/* Ripple and caption are one unit: the gap holds them together so the
            circle reads as the thing the words are about. The pressable wraps
            only that unit, not the centring box around it, so a tap in the
            empty space either side cannot arm the reader by accident. */}
        <View style={styles.focusCluster}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="TapIn to begin"
            accessibilityState={{ disabled: waiting }}
            onPress={onTapIn}
            disabled={waiting}
            style={({ pressed }) => [styles.focusTarget, { opacity: pressed ? 0.68 : 1 }]}
          >
            <TapRipple active={waiting} size={184} coreSize={116} />
            <Text
              style={{
                color: waiting ? colors.accent : colors.text,
                fontSize: 20,
                fontWeight: "600",
              }}
            >
              {waiting ? "Ready to scan" : "TapIn to begin"}
            </Text>
            <Body dim>
              {waiting
                ? "Hold your card to the back of your phone."
                : `${blockCount} apps will be locked.`}
            </Body>
          </Pressable>
        </View>

        <Text style={[styles.sectionLabel, { color: colors.textDim }]}>TODAY&apos;S FOCUS</Text>
        <View style={styles.metricsRow}>
          <FocusMetric icon={Timer} label="Focused" value={human(stats.seconds)} />
          <FocusMetric icon={Repeat2} label="Sessions" value={String(stats.count)} />
        </View>
      </ScrollView>
    </Screen>
  );
}

/** Fade the old label away, then let the replacement settle down into place. */
function AnimatedSwapText({
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

/** One cell in the stats row. Numbers use tabular figures so they don't jitter. */
function FocusMetric({ icon: Icon, label, value }: { icon: LucideIcon; label: string; value: string }) {
  const { colors } = useTheme();
  return (
    <View style={[styles.metricCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
      <View style={styles.metricHeader}>
        <Icon size={16} color={colors.accent} strokeWidth={2.2} />
        <Text style={{ color: colors.textDim, fontSize: 13 }}>{label}</Text>
      </View>
      <Text style={[styles.metricValue, { color: colors.text }]}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  homeHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: space(1.5),
  },
  streakPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: space(0.75),
    borderRadius: 999,
    paddingHorizontal: space(1.25),
    paddingVertical: space(0.75),
  },
  focusCluster: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  focusTarget: {
    alignItems: "center",
    gap: space(1),
  },
  activeFocusContent: {
    alignItems: "center",
  },
  activeTimer: {
    marginTop: space(1),
    fontSize: 44,
    lineHeight: 54,
    fontVariant: ["tabular-nums"],
    fontWeight: "600",
    letterSpacing: 0.5,
  },
  scanInstruction: {
    marginTop: space(1),
    fontSize: 13,
    lineHeight: 20,
    textAlign: "center",
  },
  sectionLabel: {
    fontSize: 11,
    fontWeight: "600",
    letterSpacing: 0.8,
    marginBottom: space(1),
  },
  metricsRow: {
    flexDirection: "row",
    gap: space(1.5),
  },
  // Laid out along one line rather than stacked: two numbers do not need a
  // card half the height of the screen's focal point.
  metricCard: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: space(1),
    minHeight: 48,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 14,
    paddingHorizontal: space(1.5),
    paddingVertical: space(1),
  },
  metricHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: space(0.75),
    minWidth: 0,
  },
  metricValue: {
    fontSize: 19,
    fontWeight: "600",
    fontVariant: ["tabular-nums"],
    letterSpacing: -0.3,
  },
});
