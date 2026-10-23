import { useEffect, useRef, useState } from "react";
import { Animated, AppState, Easing, ScrollView, StyleSheet, View } from "react-native";
import type { LucideIcon } from "lucide-react-native";
import Repeat2 from "lucide-react-native/icons/repeat-2";
import Timer from "lucide-react-native/icons/timer";
import {
  AnimatedSwapText,
  AppMark,
  Screen,
  Title,
} from "../components";
import { StreakCounter } from "../streakCounter";
import EmergencyExitButton from "../emergencyExit";
import SessionClock from "../sessionClock";
import { formatClock } from "../timeFormat";
import { STREAK_PREVIEW } from "../devTest";
import { COMPLETION_PREVIEW_DELAY_MS, streakPreviewFor } from "../streakPreview";
import { StreakWeek } from "../streakWeek";
import { GuideSheet, useScreenGuide } from "../guides";
import { Nav } from "../nav";
import LastSessionCard from "../lastSessionCard";
import CardLoading from "../cardLoading";
import NfcCardShowcase from "../nfcCardShowcase";
import { newestSessionCard, SessionCardFacts, SessionCardModal } from "../sessionCard";
import { useExpoBlur } from "../softBlur";
import { CycleWheels, type ActiveWheel } from "../wheelPicker";
import { homeIsReady, showsCycleHome, streakLockState } from "../homeMode";
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

// The cover fades out over this long once Home is ready.
const COVER_MS = 300;


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
  onShareOpenChange,
}: {
  nav: Nav;
  active: boolean;
  startedAt: number | null;
  blockCount: number;
  /** Which session the next card tap opens. Owned by the app shell so the tab
      bar's centre button and this screen's circle never disagree. */
  focusMode: FocusMode;
  /** Reports whether the share editor is open, so the app shell can hide its tab bar meanwhile. */
  onShareOpenChange?: (open: boolean) => void;
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

  // The shell hides its tab bar while the share editor is open; a close or an unmount restores it.
  useEffect(() => {
    if (!onShareOpenChange) return;
    onShareOpenChange(openCard !== null);
    return () => onShareOpenChange(false);
  }, [openCard, onShareOpenChange]);
  // Cycle mode is the single source of truth for which Home content is shown.
  const cycleMode = showsCycleHome(focusMode);
  // The share editor blurs the page behind it: the content inside this blur target.
  const blurTarget = useRef<View>(null);
  const blur = useExpoBlur();
  const Target = blur?.BlurTargetView ?? View;
  // Home is covered by the loading presentation from its first frame until its first data has
  // landed and the showcase has nothing left to load. The cover is part of the first render, so
  // the empty starting state (no stats, no week, no card) is never drawn.
  const [dataReady, setDataReady] = useState(false);
  const [showcaseReady, setShowcaseReady] = useState(false);
  const homeReady = homeIsReady({ dataReady, cycleMode, showcaseReady });
  const cover = useRef(new Animated.Value(1)).current;
  const loaderOn = useRef(new Animated.Value(1)).current;
  const [coverShown, setCoverShown] = useState(true);

  // Refresh stats whenever we return to the idle state (i.e. a session ended).
  // The week is read from the same history, so it is refreshed at the same time.
  const refreshStreak = () => {
    const preview = streakPreviewFor(STREAK_PREVIEW, completionPreviewDone.current);
    if (preview) {
      setStats((current) => ({ ...current, streak: preview.streak, doneToday: preview.doneToday }));
      setWeek(preview.week);
    } else {
      getTodayStats().then(setStats);
      getStreakWeek().then(setWeek);
    }
    getRegisteredCards().then(setCards);
    getSessions().then((all) => setLastCard(newestSessionCard(all)));
  };

  useEffect(() => {
    if (!active) refreshStreak();
  }, [active]);

  // The first read of what Home shows. It runs even during a session, because the cover has to lift.
  // The values land together with the flag, so the first real frame already has them.
  useEffect(() => {
    let live = true;
    Promise.all([getTodayStats(), getStreakWeek(), getRegisteredCards(), getCycleConfig()]).then(
      ([today, days, registered, schedule]) => {
        if (!live) return;
        setStats(today);
        setWeek(days);
        setCards(registered);
        setCycle(schedule);
        setDataReady(true);
      }
    );
    return () => {
      live = false;
    };
  }, []);

  // Lifts the cover once Home is ready, and drops it when the fade has finished.
  useEffect(() => {
    if (!homeReady) return;
    const lift = Animated.timing(cover, {
      toValue: 0,
      duration: COVER_MS,
      easing: Easing.out(Easing.quad),
      useNativeDriver: true,
    });
    lift.start(({ finished }) => {
      if (finished) setCoverShown(false);
    });
    return () => lift.stop();
  }, [homeReady, cover]);

  // Development preview only: the completion case completes today after a short delay, so the
  // transition and its animation can be seen. In release builds the preview is off and this does nothing.
  const completionPreviewDone = useRef(false);
  useEffect(() => {
    if (STREAK_PREVIEW !== "completion" || active) return;
    const timer = setTimeout(() => {
      completionPreviewDone.current = true;
      refreshStreak();
    }, COMPLETION_PREVIEW_DELAY_MS);
    return () => clearTimeout(timer);
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
    // Only the brand, the clock, and the way out. Nothing else competes with the time.
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

        <GuideSheet guide="home" visible={guide.visible} onClose={guide.close} />
      </Screen>
    );
  }

  return (
    // The blur target wraps the whole screen, margins included, so the share editor's blur reaches
    // every edge of the page rather than stopping at the content gutters. The editor sits outside
    // this target, because a blur cannot draw the view that contains it.
    <>
    <Target ref={blurTarget} style={{ flex: 1 }}>
    <Screen>
      <View style={{ flex: 1 }}>
        <ScrollView {...edge.scrollProps} contentContainerStyle={{ flexGrow: 1 }} showsVerticalScrollIndicator={false}>
          {/* Cycle's own header: its title and the streak as a padlock, with no brand mark and no week row. */}
          {cycleMode ? (
            <View style={styles.homeHeader}>
              <Title>Cycle</Title>
              <StreakCounter streak={stats.streak} lock={streakLockState(active)} />
            </View>
          ) : null}
          {/* Cycle shows only its wheels and controls, so the header, the week and the card are Normal Home. */}
          {cycleMode ? null : (
          <>
          <View style={styles.homeHeader}>
            <View style={styles.brandRow}>
              {/* Placeholder mark: the existing TAFIK mark. Swap for the official logo here when it is ready. */}
              <AppMark height={22} color={colors.text} />
              <AnimatedSwapText value="Tafik">
                {(label) => <Title>{label}</Title>}
              </AnimatedSwapText>
            </View>
            <StreakCounter streak={stats.streak} />
          </View>

          <View style={{ marginTop: space(2) }}>
            <StreakWeek days={week} />
          </View>
          </>
          )}

          {/* The registered card sits directly under the streak, as the first thing
              the user taps against. */}
          {/* Never mounted in Cycle mode, so the 3D card does not load or show behind the wheels. */}
          {cycleMode ? null : (
          <View style={{ marginTop: space(2.5) }}>
            {/* Mounted only once the cards are loaded, so "no card" is never judged from the empty starting list. */}
            {dataReady ? (
              <NfcCardShowcase
                cards={cards}
                onRegister={() => nav("cardSetup")}
                onReady={() => setShowcaseReady(true)}
              />
            ) : null}
          </View>
          )}

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

      {/* Opaque, and covers the whole screen including the area behind the bottom nav, so no
          unfinished Home content shows underneath while it loads. It fades out once Home is ready. */}
      {coverShown ? (
        <Animated.View
          pointerEvents={homeReady ? "none" : "auto"}
          style={[StyleSheet.absoluteFill, { backgroundColor: colors.bg, opacity: cover }]}
        >
          <CardLoading opacity={loaderOn} />
        </Animated.View>
      ) : null}
    </Screen>
    </Target>
    <SessionCardModal facts={openCard} onClose={() => setOpenCard(null)} blurTarget={blurTarget} />
    </>
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
  brandRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: space(1),
  },
  // The active session: the brand mark at the top, the clock in the room below it, and the
  // Emergency Exit under the clock. Mirrors the Cycle session so the two read as one product.
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
  emergency: {
    marginBottom: space(3),
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
