import { useEffect, useState } from "react";
import { Pressable, ScrollView, StyleSheet, View } from "react-native";
import type { LucideIcon } from "lucide-react-native";
import BookOpenCheck from "lucide-react-native/icons/book-open-check";
import Coffee from "lucide-react-native/icons/coffee";
import LockKeyhole from "lucide-react-native/icons/lock-keyhole";
import Minus from "lucide-react-native/icons/minus";
import Plus from "lucide-react-native/icons/plus";
import Repeat2 from "lucide-react-native/icons/repeat-2";
import Timer from "lucide-react-native/icons/timer";
import TimerReset from "lucide-react-native/icons/timer-reset";
import {
  AnimatedSwapText,
  AppMark,
  Body,
  GhostButton,
  Screen,
  TapRipple,
  Title,
} from "../components";
import { GuideButton, GuideSheet, useScreenGuide } from "../guides";
import { Nav } from "../nav";
import {
  DEFAULT_STUDIN_CONFIG,
  type FocusMode,
  getStudInConfig,
  getTodayStats,
  setStudInConfig,
  type StudInConfig,
  TodayStats,
} from "../store";
import { radius, space, useTheme } from "../theme";
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
  focusMode,
  scanning,
  onTockIn,
  onStartWithoutCard,
}: {
  nav: Nav;
  active: boolean;
  startedAt: number | null;
  blockCount: number;
  /** Which session the next card tap opens. Owned by the app shell so the tab
      bar's centre button and this screen's circle never disagree. */
  focusMode: FocusMode;
  /** Which read is open, if any. The scan itself is owned by the app shell,
      because the button that starts it now lives in the tab bar. */
  scanning: null | "start" | "end";
  /** Arm the reader. The same action the tab bar's centre button runs. */
  onTockIn: () => void;
  /** Start the session without reading a card, behind a confirmation. Offered
      only while a start read is open, so it is never the first thing pressed. */
  onStartWithoutCard: () => void;
}) {
  const { colors } = useTheme();
  const guide = useScreenGuide("home");
  const [now, setNow] = useState(Date.now());
  const [stats, setStats] = useState<TodayStats>({ seconds: 0, count: 0, streak: 0 });
  const [studIn, setStudIn] = useState<StudInConfig>(DEFAULT_STUDIN_CONFIG);
  const studInMode = focusMode === "studin";

  // Refresh stats whenever we return to the idle state (i.e. a session ended).
  useEffect(() => {
    if (!active) getTodayStats().then(setStats);
  }, [active]);

  // Home is unmounted whenever another tab is showing, so a plain mount read is
  // enough to pick up a schedule edited elsewhere.
  useEffect(() => {
    getStudInConfig().then(setStudIn);
  }, []);

  // Written straight through on every step: the card that starts the cycle
  // reads this from storage, and it may be tapped the moment a number changes.
  const updateStudIn = (next: StudInConfig) => {
    setStudIn(next);
    void setStudInConfig(next);
  };

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
            <AnimatedSwapText value="TockedIn">
              {(label) => <Title>{label}</Title>}
            </AnimatedSwapText>
            <View style={styles.headerActions}>
              <GuideButton label="Home" onPress={guide.open} />
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

        <GuideSheet guide="home" visible={guide.visible} onClose={guide.close} />
      </Screen>
    );
  }

  const waiting = scanning === "start";

  return (
    <Screen>
      <ScrollView contentContainerStyle={{ flexGrow: 1 }} showsVerticalScrollIndicator={false}>
        <View style={styles.homeHeader}>
          <AnimatedSwapText value="TockIn">
            {(label) => <Title>{label}</Title>}
          </AnimatedSwapText>
          <View style={styles.headerActions}>
            <GuideButton label="Home" onPress={guide.open} />
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
        </View>

        {/* Ripple and caption are one unit: the gap holds them together so the
            circle reads as the thing the words are about. The pressable wraps
            only that unit, not the centring box around it, so a tap in the
            empty space either side cannot arm the reader by accident. */}
        <View style={styles.focusCluster}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="TockIn to begin"
            accessibilityState={{ disabled: waiting }}
            onPress={onTockIn}
            disabled={waiting}
            style={({ pressed }) => [styles.focusTarget, { opacity: pressed ? 0.68 : 1 }]}
          >
            {/* The same bare circle in both modes. StudIn's mark belongs to a
                running cycle, not to the thing that starts one, so nothing sits
                inside until blocking is actually live. */}
            <TapRipple active={waiting} size={184} coreSize={116} />
            <Text
              style={{
                color: waiting ? colors.accent : colors.text,
                fontSize: 20,
                fontWeight: "600",
              }}
            >
              {waiting ? "Ready to scan" : "TockIn to begin"}
            </Text>
            <Body dim>
              {waiting
                ? "Hold your card to the back of your phone."
                : `${blockCount} apps will be locked.`}
            </Body>
          </Pressable>

          {/* Outside the circle's pressable, so the tap that reaches it can
              never also be the tap that armed the reader. */}
          {waiting ? (
            <View style={styles.withoutCard}>
              <GhostButton label="Start without card" onPress={onStartWithoutCard} />
            </View>
          ) : null}
        </View>

        {/* StudIn takes this slot rather than sitting beside the day's totals:
            the schedule is what the next card tap will run, so it belongs where
            the eye lands before tapping. The totals return with the mode off. */}
        {studInMode ? (
          <>
            <Text style={[styles.sectionLabel, { color: colors.textDim }]}>StudIn schedule</Text>
            <View style={[styles.studInCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              <DurationControl
                icon={BookOpenCheck}
                label="Study"
                value={studIn.studyMinutes}
                suffix="min"
                min={1}
                max={180}
                onChange={(studyMinutes) => updateStudIn({ ...studIn, studyMinutes })}
              />
              <View style={[styles.divider, { backgroundColor: colors.border }]} />
              <DurationControl
                icon={Coffee}
                label="Break"
                value={studIn.breakMinutes}
                suffix="min"
                min={1}
                max={60}
                onChange={(breakMinutes) => updateStudIn({ ...studIn, breakMinutes })}
              />
              <View style={[styles.divider, { backgroundColor: colors.border }]} />
              <DurationControl
                icon={Repeat2}
                label="Rounds"
                value={studIn.rounds}
                min={1}
                max={12}
                onChange={(rounds) => updateStudIn({ ...studIn, rounds })}
              />
              <View style={[styles.studInSummary, { borderColor: colors.border }]}>
                <TimerReset size={17} color={colors.textDim} strokeWidth={2} />
                <Text style={{ color: colors.textDim, fontSize: 13, flex: 1 }}>
                  {studIn.rounds * studIn.studyMinutes} min Study,{" "}
                  {Math.max(0, studIn.rounds - 1) * studIn.breakMinutes} min Break
                </Text>
              </View>
            </View>
          </>
        ) : (
          <>
            <Text style={[styles.sectionLabel, { color: colors.textDim }]}>Today&apos;s TockedIn</Text>
            <View style={styles.metricsRow}>
              <FocusMetric icon={Timer} label="Focused" value={human(stats.seconds)} />
              <FocusMetric icon={Repeat2} label="Sessions" value={String(stats.count)} />
            </View>
          </>
        )}
      </ScrollView>

      <GuideSheet guide="home" visible={guide.visible} onClose={guide.close} />
    </Screen>
  );
}

/**
 * A stepper for one StudIn number. StudIn is deliberately custom-only: presets
 * were dropped so the schedule is always the one the user chose rather than a
 * name they have to translate.
 */
function DurationControl({
  icon: Icon,
  label,
  value,
  suffix,
  min,
  max,
  onChange,
}: {
  icon: LucideIcon;
  label: string;
  value: number;
  suffix?: string;
  min: number;
  max: number;
  onChange: (value: number) => void;
}) {
  const { colors } = useTheme();
  const button = (direction: -1 | 1) => {
    const disabled = direction < 0 ? value <= min : value >= max;
    const ActionIcon = direction < 0 ? Minus : Plus;
    return (
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`${direction < 0 ? "Decrease" : "Increase"} ${label}`}
        accessibilityState={{ disabled }}
        disabled={disabled}
        onPress={() => onChange(Math.min(max, Math.max(min, value + direction)))}
        style={({ pressed }) => [
          styles.stepButton,
          {
            borderColor: colors.border,
            backgroundColor: colors.bg,
            opacity: disabled ? 0.35 : pressed ? 0.6 : 1,
          },
        ]}
      >
        <ActionIcon size={18} color={colors.text} strokeWidth={2.2} />
      </Pressable>
    );
  };

  return (
    <View style={styles.controlRow}>
      <View style={[styles.controlIcon, { backgroundColor: colors.accentWash }]}>
        <Icon size={20} color={colors.accent} strokeWidth={2.1} />
      </View>
      <Text style={[styles.controlLabel, { color: colors.text }]}>{label}</Text>
      {button(-1)}
      <Text style={[styles.controlValue, { color: colors.text }]}>
        {value}
        {suffix ? ` ${suffix}` : ""}
      </Text>
      {button(1)}
    </View>
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
  headerActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: space(1),
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
  // Held well clear of the circle: this is the path that locks the phone
  // without a key in hand, so it should never be reachable by a near miss.
  withoutCard: {
    marginTop: space(3),
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
  studInCard: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: radius.card,
    overflow: "hidden",
  },
  divider: {
    height: StyleSheet.hairlineWidth,
  },
  controlRow: {
    minHeight: 74,
    flexDirection: "row",
    alignItems: "center",
    gap: space(1.25),
    paddingHorizontal: space(1.5),
  },
  controlIcon: {
    width: 40,
    height: 40,
    borderRadius: 13,
    alignItems: "center",
    justifyContent: "center",
  },
  controlLabel: {
    flex: 1,
    fontSize: 15,
    fontWeight: "600",
  },
  controlValue: {
    width: 66,
    textAlign: "center",
    fontSize: 15,
    fontWeight: "600",
    fontVariant: ["tabular-nums"],
  },
  stepButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: "center",
    justifyContent: "center",
  },
  studInSummary: {
    flexDirection: "row",
    alignItems: "center",
    gap: space(1),
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: space(1.5),
    paddingVertical: space(1.25),
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
