import { useEffect, useState } from "react";
import { AppState, ScrollView, StyleSheet, View } from "react-native";
import type { LucideIcon } from "lucide-react-native";
import LockKeyhole from "lucide-react-native/icons/lock-keyhole";
import LockKeyholeOpen from "lucide-react-native/icons/lock-keyhole-open";
import Repeat2 from "lucide-react-native/icons/repeat-2";
import Timer from "lucide-react-native/icons/timer";
import {
  AnimatedSwapText,
  Body,
  Screen,
  StreakWeek,
  Title,
} from "../components";
import { GuideSheet, useScreenGuide } from "../guides";
import { Nav } from "../nav";
import LastSessionCard from "../lastSessionCard";
import NfcCardShowcase from "../nfcCardShowcase";
import { newestSessionCard, SessionCardFacts, SessionCardModal } from "../sessionCard";
import { CycleWheels, type ActiveWheel } from "../wheelPicker";
import {
  DEFAULT_CYCLE_CONFIG,
  type FocusMode,
  getCycleConfig,
  getRegisteredCards,
  getSessions,
  getStreakWeek,
  getTodayStats,
  setCycleConfig,
  type CycleConfig,
  type RegisteredCard,
  type StreakDay,
  TodayStats,
} from "../store";
import { colors, space, typeScale } from "../theme";
import { ScrollEdgeFade, useScrollEdge } from "../scrollEdge";
import { NAV_CLEARANCE } from "../tabBar";
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
}: {
  nav: Nav;
  active: boolean;
  startedAt: number | null;
  blockCount: number;
  /** Which session the next card tap opens. Owned by the app shell so the tab
      bar's centre button and this screen's circle never disagree. */
  focusMode: FocusMode;
}) {
  const edge = useScrollEdge();
  const guide = useScreenGuide("home");
  const [now, setNow] = useState(Date.now());
  const [stats, setStats] = useState<TodayStats>({ seconds: 0, count: 0, streak: 0, doneToday: false });
  const [week, setWeek] = useState<StreakDay[]>([]);
  const [cycle, setCycle] = useState<CycleConfig>(DEFAULT_CYCLE_CONFIG);
  const [activeWheel, setActiveWheel] = useState<ActiveWheel>("study");
  // The registered cards the showcase shows, and the newest completed session to share.
  const [cards, setCards] = useState<RegisteredCard[]>([]);
  const [lastCard, setLastCard] = useState<SessionCardFacts | null>(null);
  const [openCard, setOpenCard] = useState<SessionCardFacts | null>(null);
  const cycleMode = focusMode === "cycle";

  // Refresh stats whenever we return to the idle state (i.e. a session ended).
  // The week is read from the same history, so it is refreshed at the same time.
  const refreshStreak = () => {
    getTodayStats().then(setStats);
    getStreakWeek().then(setWeek);
    getRegisteredCards().then(setCards);
    getSessions().then((all) => setLastCard(newestSessionCard(all)));
  };

  useEffect(() => {
    if (!active) refreshStreak();
  }, [active]);

  // A qualifying session can also end while the app is in the background, and
  // the day may roll over overnight, so the idle view re-reads on every return.
  useEffect(() => {
    const sub = AppState.addEventListener("change", (state) => {
      if (state === "active" && !active) refreshStreak();
    });
    return () => sub.remove();
  }, [active]);

  // Home is unmounted whenever another tab is showing, so a plain mount read is
  // enough to pick up a schedule edited elsewhere.
  useEffect(() => {
    getCycleConfig().then(setCycle);
  }, []);

  // Written straight through on every step: the card that starts the cycle
  // reads this from storage, and it may be tapped the moment a number changes.
  const updateCycle = (next: CycleConfig) => {
    setCycle(next);
    void setCycleConfig(next);
  };

  useEffect(() => {
    if (!active) return;
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [active]);

  if (active) {
    const elapsed = startedAt ? Math.max(0, Math.floor((now - startedAt) / 1000)) : 0;
    return (
      <Screen>
        <View style={{ flex: 1 }}>
          <ScrollView {...edge.scrollProps} contentContainerStyle={{ flexGrow: 1 }} showsVerticalScrollIndicator={false}>
            <View style={styles.homeHeader}>
              <AnimatedSwapText value="Tafik">
                {(label) => <Title>{label}</Title>}
              </AnimatedSwapText>
              <View style={styles.headerActions}>
                <View style={[styles.streakPill, { backgroundColor: colors.accentWash }]}>
                  <LockKeyhole size={17} color={colors.accent} strokeWidth={2.3} />
                  <AnimatedSwapText value="Session active">
                    {(label) => (
                      <Text style={{ color: colors.text, fontSize: typeScale.callout.fontSize, fontWeight: "600" }}>
                        {label}
                      </Text>
                    )}
                  </AnimatedSwapText>
                </View>
              </View>
            </View>

            <View style={styles.focusCluster}>
              <View style={styles.activeFocusContent}>
                <Text
                  accessibilityLabel={`Focus time ${fmt(elapsed)}`}
                  style={[styles.activeTimer, { color: colors.text }]}
                >
                  {fmt(elapsed)}
                </Text>
                <Body dim>{blockCount} apps blocked</Body>
              </View>
            </View>

            <View style={{ height: NAV_CLEARANCE }} />
          </ScrollView>
          <ScrollEdgeFade visible={edge.visible} />
        </View>

        <GuideSheet guide="home" visible={guide.visible} onClose={guide.close} />
      </Screen>
    );
  }

  return (
    <Screen>
      <View style={{ flex: 1 }}>
        <ScrollView {...edge.scrollProps} contentContainerStyle={{ flexGrow: 1 }} showsVerticalScrollIndicator={false}>
          <View style={styles.homeHeader}>
            <AnimatedSwapText value="Tafik">
              {(label) => <Title>{label}</Title>}
            </AnimatedSwapText>
            <View style={styles.headerActions}>
              <View style={[styles.streakPill, { backgroundColor: colors.accentWash }]}>
                {stats.doneToday ? (
                  <LockKeyhole size={17} color={colors.text} strokeWidth={2.3} />
                ) : (
                  <LockKeyholeOpen size={17} color={colors.textDim} strokeWidth={2.3} />
                )}
                <AnimatedSwapText value={`${stats.streak}`}>
                  {(label) => (
                    <Text style={{ color: stats.doneToday ? colors.text : colors.textDim, fontSize: typeScale.callout.fontSize, fontWeight: "600" }}>
                      {label}
                    </Text>
                  )}
                </AnimatedSwapText>
              </View>
            </View>
          </View>

          <View style={{ marginTop: space(2) }}>
            <StreakWeek days={week} />
          </View>

          {/* The registered card sits directly under the streak, as the first thing
              the user taps against. */}
          <View style={{ marginTop: space(2.5) }}>
            <NfcCardShowcase cards={cards} onRegister={() => nav("cardSetup")} />
          </View>

          <View style={{ height: space(2) }} />

          {/* Cycle takes this slot rather than sitting beside the day's totals:
              the schedule is what the next card tap will run, so it belongs where
              the eye lands before tapping. The totals return with the mode off. */}
          {cycleMode ? (
            <>
              <View style={styles.cycleBody}>
                <View style={styles.topArea}>
                  <CycleWheels
                    part="top"
                    study={cycle.studyMinutes}
                    breakMinutes={cycle.breakMinutes}
                    cycles={cycle.rounds}
                    onChange={updateCycle}
                    active={activeWheel}
                    onActivate={setActiveWheel}
                  />
                </View>
              </View>
            </>
          ) : (
            <>
              <Text style={[styles.sectionLabel, { color: colors.textDim }]}>Today&apos;s Tafik</Text>
              <View style={styles.metricsRow}>
                <FocusMetric icon={Timer} label="Focused" value={human(stats.seconds)} />
                <FocusMetric icon={Repeat2} label="Sessions" value={String(stats.count)} />
              </View>
              {/* Share Session sits directly below Today's Tafik. It only appears once a
                  completed session exists to share. */}
              <View style={{ marginTop: space(1.5) }}>
                <LastSessionCard facts={lastCard} onShare={() => setOpenCard(lastCard)} />
              </View>
              <SessionCardModal facts={openCard} onClose={() => setOpenCard(null)} />
            </>
          )}
          <View style={{ height: NAV_CLEARANCE }} />
        </ScrollView>
        <ScrollEdgeFade visible={edge.visible} />
        {cycleMode ? (
          <View pointerEvents="box-none" style={styles.cycleFloor}>
            <CycleWheels
              part="bottom"
              study={cycle.studyMinutes}
              breakMinutes={cycle.breakMinutes}
              cycles={cycle.rounds}
              onChange={updateCycle}
              active={activeWheel}
              onActivate={setActiveWheel}
            />
          </View>
        ) : null}
      </View>

      <GuideSheet guide="home" visible={guide.visible} onClose={guide.close} />
    </Screen>
  );
}

/** One cell in the stats row. Numbers use tabular figures so they don't jitter. */
function FocusMetric({ icon: Icon, label, value }: { icon: LucideIcon; label: string; value: string }) {
  return (
    <View style={[styles.metricCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
      <View style={styles.metricHeader}>
        <Icon size={16} color={colors.accent} strokeWidth={2.2} />
        <Text style={{ color: colors.textDim, fontSize: typeScale.footnote.fontSize }}>{label}</Text>
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
  activeFocusContent: {
    alignItems: "center",
  },
  activeTimer: {
    marginTop: space(1),
    fontSize: typeScale.display.fontSize,
    lineHeight: 54,
    fontVariant: ["tabular-nums"],
    fontWeight: "600",
    letterSpacing: 0.5,
  },
  sectionLabel: {
    ...typeScale.label,
    fontWeight: "600",
    marginBottom: space(1),
  },
  cycleBody: {
    flex: 1,
    gap: space(1),
  },
  // The Study and Break wheels sit in the middle of the space above the Cycle row.
  topArea: {
    flex: 1,
    justifyContent: "center",
    paddingBottom: space(7),
  },
  cycleFloor: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: NAV_CLEARANCE,
  },
  divider: {
    height: StyleSheet.hairlineWidth,
  },
  cycleSummary: {
    flexDirection: "row",
    alignItems: "center",
    gap: space(1),
    paddingHorizontal: space(0.5),
    paddingVertical: space(0.5),
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
    fontSize: typeScale.headline.fontSize,
    fontWeight: "600",
    fontVariant: ["tabular-nums"],
    letterSpacing: -0.3,
  },
});
