import { useEffect, useMemo, useState } from "react";
import { AppState, Image, Linking, Pressable, ScrollView, StyleSheet, View } from "react-native";
import Svg, { Circle, Line, Path, Polyline } from "react-native-svg";
import CalendarDays from "lucide-react-native/icons/calendar-days";
import ChartNoAxesCombined from "lucide-react-native/icons/chart-no-axes-combined";
import ChevronDown from "lucide-react-native/icons/chevron-down";
import ChevronUp from "lucide-react-native/icons/chevron-up";
import Hourglass from "lucide-react-native/icons/hourglass";
import Nfc from "lucide-react-native/icons/nfc";
import Repeat2 from "lucide-react-native/icons/repeat-2";
import Timer from "lucide-react-native/icons/timer";
import TrendingDown from "lucide-react-native/icons/trending-down";
import TrendingUp from "lucide-react-native/icons/trending-up";
import type { LucideIcon } from "lucide-react-native";
import { UsageAccessDisclosure } from "../AccessDisclosures";
import { AppScreenTime, getInstalledApps, getScreenTimeInsights, ScreenTimeDay } from "../blocking";
import { Screen, Skeleton, Title } from "../components";
import { GuideButton, GuideSheet, useScreenGuide } from "../guides";
import { getSessions, SessionRecord, todayKey } from "../store";
import { space, useTheme } from "../theme";
import { Text } from "../typography";

type Period = "today" | "yesterday" | "week";
type FocusDay = { date: string; seconds: number; sessions: number };

/** Which line the weekly chart is drawing. */
type Series = "focus" | "screen";
/** One day of whichever series is on show, which is all the line needs. */
type TrendPoint = { date: string; seconds: number };

const SERIES_OPTIONS: { value: Series; label: string }[] = [
  { value: "focus", label: "TockedIn" },
  { value: "screen", label: "Screen time" },
];

/** Days the chart covers, and the window the weekly comparison averages. */
const WEEK = 7;
const APP_PREVIEW_COUNT = 4;

/**
 * Complete days needed before TockIn will claim a saving. Two days is a mood;
 * three is the least that can pass for a habit, and the card says so rather
 * than quietly showing a number built on one day.
 */
const MIN_BASELINE_DAYS = 3;

/**
 * The focus line's box. The top inset is the room a value label needs above the
 * highest point of the week, so the peak day is never clipped by the card.
 */
const FOCUS_CHART_HEIGHT = 148;
const FOCUS_CHART_TOP = 26;
const FOCUS_CHART_BOTTOM = 12;

/** Screen time either side of a comparison, in seconds per day. */
type Saving = {
  current: number;
  baseline: number;
  /** How many days the baseline averages, which is also what gates the card. */
  baselineDays: number;
  /** Today is still accumulating, so its gap narrows as the day goes on. */
  partial: boolean;
};

/** Average screen time on the days a focus session ran, against the rest. */
type TockInEffect = { tapped: number; rest: number };

function duration(totalSeconds: number): string {
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  if (hours === 0) return `${minutes}m`;
  return minutes === 0 ? `${hours}h` : `${hours}h ${minutes}m`;
}

function dayName(date: string): string {
  const [year, month, day] = date.split("-").map(Number);
  return new Date(year, month - 1, day).toLocaleDateString(undefined, { weekday: "short" });
}

function combineApps(days: ScreenTimeDay[]): AppScreenTime[] {
  const combined = new Map<string, AppScreenTime>();
  days.forEach((day) => {
    day.apps.forEach((app) => {
      const current = combined.get(app.pkg);
      combined.set(app.pkg, {
        name: app.name,
        pkg: app.pkg,
        seconds: (current?.seconds ?? 0) + app.seconds,
      });
    });
  });
  return [...combined.values()].sort((a, b) => b.seconds - a.seconds);
}

/** Local calendar dates represented by the selected insight period. */
function focusDateKeys(period: Period, now = new Date()): Set<string> {
  const keys = new Set<string>();
  const length = period === "week" ? WEEK : 1;
  const firstOffset = period === "yesterday" ? 1 : 0;

  for (let index = 0; index < length; index += 1) {
    const cursor = new Date(now);
    cursor.setDate(cursor.getDate() - firstOffset - index);
    keys.add(todayKey(cursor));
  }
  return keys;
}

/** Seven local-calendar days, oldest first, including zero-session days. */
function focusWeek(sessions: SessionRecord[], now = new Date()): FocusDay[] {
  return Array.from({ length: WEEK }, (_, index) => {
    const cursor = new Date(now);
    cursor.setDate(cursor.getDate() - (WEEK - 1 - index));
    const date = todayKey(cursor);
    const records = sessions.filter(
      (session) => session.d === date && Number.isFinite(session.s) && session.s >= 0
    );
    return {
      date,
      seconds: records.reduce((total, session) => total + session.s, 0),
      sessions: records.length,
    };
  });
}

/**
 * Complete calendar days only. Today is still filling up, so averaging it into
 * a baseline would drag that baseline below the days it is meant to describe.
 */
function completedDays(days: ScreenTimeDay[], now = new Date()): ScreenTimeDay[] {
  const today = todayKey(now);
  return days.filter((day) => day.date !== "" && day.date !== today);
}

/** Mean screen time per day. The unit every comparison on this screen uses. */
function dailyMean(days: ScreenTimeDay[]): number {
  if (days.length === 0) return 0;
  return Math.round(days.reduce((total, day) => total + day.seconds, 0) / days.length);
}

function dayKeyBefore(daysBack: number, now = new Date()): string {
  const cursor = new Date(now);
  cursor.setDate(cursor.getDate() - daysBack);
  return todayKey(cursor);
}

export default function InsightsScreen() {
  const { colors } = useTheme();
  const guide = useScreenGuide("insights");
  const [period, setPeriod] = useState<Period>("today");
  const [showAllApps, setShowAllApps] = useState(false);
  const [days, setDays] = useState<ScreenTimeDay[] | null | undefined>(undefined);
  const [sessions, setSessions] = useState<SessionRecord[] | undefined>(undefined);
  const [error, setError] = useState<string | null>(null);
  // Launcher icons keyed by package. Screen-time rows carry only a name and a
  // package, so the icons are fetched separately and joined on pkg.
  const [icons, setIcons] = useState<Record<string, string>>({});
  const [usageDisclosureOpen, setUsageDisclosureOpen] = useState(false);

  // A missing icon is not worth surfacing: the row falls back to a lettered
  // tile and the timings — the actual point of the screen — are unaffected.
  useEffect(() => {
    getInstalledApps()
      .then((apps) => setIcons(Object.fromEntries(apps.map((app) => [app.pkg, app.icon]))))
      .catch(() => {});
  }, []);

  useEffect(() => {
    const refresh = async () => {
      // Focus history is independent of Usage Access, so refresh it even if
      // Android screen-time access is missing or its query fails.
      void getSessions().then(setSessions).catch(() => setSessions([]));
      try {
        setDays(await getScreenTimeInsights());
        setError(null);
      } catch (e: any) {
        setError(e?.message ?? "Couldn't load screen-time insights.");
      }
    };
    refresh();
    const timer = setInterval(refresh, 60_000);
    const subscription = AppState.addEventListener("change", (state) => {
      if (state === "active") refresh();
    });
    return () => {
      clearInterval(timer);
      subscription.remove();
    };
  }, []);

  // The last seven days of however many the native module returned.
  const chartDays = useMemo(() => days?.slice(-WEEK) ?? [], [days]);

  const summary = useMemo(() => {
    if (!days?.length) return { seconds: 0, apps: [] as AppScreenTime[] };
    const selectedDays =
      period === "today" ? days.slice(-1) : period === "yesterday" ? days.slice(-2, -1) : chartDays;
    return {
      seconds: selectedDays.reduce((total, day) => total + day.seconds, 0),
      // The UI reports whole minutes, so an entry below one minute would read
      // as a misleading "0m". Keep those tiny samples out of the ranked list.
      apps: combineApps(selectedDays).filter((app) => app.seconds >= 60),
    };
  }, [days, period, chartDays]);

  const visibleApps = useMemo(
    () => (showAllApps ? summary.apps : summary.apps.slice(0, APP_PREVIEW_COUNT)),
    [showAllApps, summary.apps]
  );

  useEffect(() => {
    setShowAllApps(false);
  }, [period]);

  const focusSummary = useMemo(() => {
    if (!sessions) return null;
    const keys = focusDateKeys(period);
    const selected = sessions.filter(
      (session) => keys.has(session.d) && Number.isFinite(session.s) && session.s >= 0
    );
    return {
      seconds: selected.reduce((total, session) => total + session.s, 0),
      count: selected.length,
    };
  }, [period, sessions]);

  const focusWeekDays = useMemo(() => focusWeek(sessions ?? []), [sessions]);

  /**
   * The selected period against the user's own usual day. The baseline is
   * always "every other complete day TockIn has recorded", which is one rule
   * that holds for all three periods and degrades gracefully when the native
   * module only returns seven days instead of fourteen.
   */
  const saving = useMemo<Saving | null>(() => {
    if (!days?.length) return null;
    const complete = completedDays(days);

    if (period === "today") {
      const current = days.find((day) => day.date === todayKey());
      if (!current) return null;
      return {
        current: current.seconds,
        baseline: dailyMean(complete),
        baselineDays: complete.length,
        partial: true,
      };
    }

    if (period === "yesterday") {
      const key = dayKeyBefore(1);
      const current = complete.find((day) => day.date === key);
      if (!current) return null;
      const rest = complete.filter((day) => day.date !== key);
      return {
        current: current.seconds,
        baseline: dailyMean(rest),
        baselineDays: rest.length,
        partial: false,
      };
    }

    // Per day on both sides, so a seven-day window can be compared with a
    // baseline that may hold six days or thirteen.
    const window = complete.slice(-WEEK);
    if (window.length === 0) return null;
    const rest = complete.slice(0, -WEEK);
    return {
      current: dailyMean(window),
      baseline: dailyMean(rest),
      baselineDays: rest.length,
      partial: false,
    };
  }, [days, period]);

  /**
   * The question the whole screen is really about: does tapping in change the
   * day? Answered by splitting the recorded days on whether a session ran,
   * which needs no baseline and cannot be skewed by a partial today.
   */
  const tockInEffect = useMemo<TockInEffect | null>(() => {
    if (!days?.length || !sessions) return null;
    const ran = new Set(sessions.filter((session) => session.s > 0).map((session) => session.d));
    const complete = completedDays(days);
    const tapped = complete.filter((day) => ran.has(day.date));
    const rest = complete.filter((day) => !ran.has(day.date));
    // One day either side is an anecdote. Two is the least that can average.
    if (tapped.length < 2 || rest.length < 2) return null;
    return { tapped: dailyMean(tapped), rest: dailyMean(rest) };
  }, [days, sessions]);

  const periodLabel = period === "today" ? "Today" : period === "yesterday" ? "Yesterday" : "Last 7 days";

  return (
    <Screen>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: space(2) }}>
        <View style={styles.header}>
          <View>
            <Title>Insights</Title>
            <Text style={{ color: colors.textDim, fontSize: 14, marginTop: 4 }}>
              Understand where your time goes.
            </Text>
          </View>
          <View style={styles.headerActions}>
            <GuideButton label="Insights" onPress={guide.open} />
            <ChartNoAxesCombined size={25} color={colors.accent} strokeWidth={2.2} />
          </View>
        </View>

        <View style={[styles.segment, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          {(["today", "yesterday", "week"] as const).map((item) => {
            const selected = period === item;
            return (
              <Pressable
                key={item}
                onPress={() => setPeriod(item)}
                style={[
                  styles.segmentButton,
                  { backgroundColor: selected ? colors.accentWash : "transparent" },
                ]}
              >
                <Text style={{ color: selected ? colors.accent : colors.textDim, fontWeight: "600", fontSize: 13 }}>
                  {item === "week" ? "7 days" : item[0].toUpperCase() + item.slice(1)}
                </Text>
              </Pressable>
            );
          })}
        </View>

        {/* TockIn's own numbers lead, then the week's shape, and the screen-time
            card closes with what that shape adds up to. */}
        <FocusSummaryCard
          label={periodLabel}
          seconds={focusSummary?.seconds}
          sessions={focusSummary?.count}
        />

        {period === "week" && sessions !== undefined ? (
          <WeekTrendChart
            focus={focusWeekDays}
            screen={days}
            onRequestScreenTime={() => setUsageDisclosureOpen(true)}
          />
        ) : null}

        {error ? (
          <View style={[styles.messageCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <Text style={{ color: colors.text, fontSize: 15, fontWeight: "600" }}>Screen time unavailable</Text>
            <Text style={{ color: colors.textDim, fontSize: 13, lineHeight: 19, marginTop: 5 }}>{error}</Text>
          </View>
        ) : days === undefined ? (
          <ScreenTimeCardSkeleton />
        ) : days === null ? (
          <Pressable
            onPress={() => setUsageDisclosureOpen(true)}
            style={[styles.messageCard, { backgroundColor: colors.surface, borderColor: colors.border }]}
          >
            <Text style={{ color: colors.text, fontSize: 15, fontWeight: "600" }}>Usage Access required</Text>
            <Text style={{ color: colors.textDim, fontSize: 13, marginTop: 5 }}>Tap to open Android settings.</Text>
          </Pressable>
        ) : (
          <ScreenTimeCard
            periodLabel={periodLabel}
            total={summary.seconds}
            saving={saving}
            label={
              period === "today"
                ? "Today so far"
                : period === "yesterday"
                  ? "Yesterday"
                  : "Last 7 days"
            }
            perDay={period === "week"}
            effect={tockInEffect}
          />
        )}

        {days ? (
          <>
            <View style={styles.listHeader}>
              <Text style={{ color: colors.text, fontSize: 17, fontWeight: "600" }}>App usage</Text>
              <Text style={{ color: colors.textDim, fontSize: 13 }}>{summary.apps.length} apps</Text>
            </View>
            <View style={[styles.appList, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              {summary.apps.length === 0 ? (
                <Text style={{ color: colors.textDim, fontSize: 14, padding: space(2) }}>
                  No app activity of at least one minute.
                </Text>
              ) : (
                visibleApps.map((app, index) => (
                  <View
                    key={app.pkg}
                    style={[
                      styles.appRow,
                      index > 0 && { borderTopWidth: StyleSheet.hairlineWidth, borderColor: colors.border },
                    ]}
                  >
                    <AppIcon name={app.name} uri={icons[app.pkg]} />
                    <Text numberOfLines={1} style={{ flex: 1, color: colors.text, fontSize: 15 }}>
                      {app.name}
                    </Text>
                    <Text style={{ color: colors.textDim, fontSize: 14, fontVariant: ["tabular-nums"] }}>
                      {duration(app.seconds)}
                    </Text>
                  </View>
                ))
              )}
              {summary.apps.length > APP_PREVIEW_COUNT ? (
                <Pressable
                  accessibilityRole="button"
                  accessibilityState={{ expanded: showAllApps }}
                  accessibilityLabel={showAllApps ? "Show fewer apps" : "View all app usage"}
                  onPress={() => setShowAllApps((current) => !current)}
                  style={({ pressed }) => [
                    styles.viewAllRow,
                    {
                      borderColor: colors.border,
                      backgroundColor: pressed ? colors.accentWash : colors.surface,
                    },
                  ]}
                >
                  <Text style={{ color: colors.accent, fontSize: 13, fontWeight: "600" }}>
                    {showAllApps ? "Show less" : `View all ${summary.apps.length} apps`}
                  </Text>
                  {showAllApps ? (
                    <ChevronUp size={16} color={colors.accent} strokeWidth={2.2} />
                  ) : (
                    <ChevronDown size={16} color={colors.accent} strokeWidth={2.2} />
                  )}
                </Pressable>
              ) : null}
            </View>
          </>
        ) : days === undefined ? (
          <AppUsageSkeleton />
        ) : null}
      </ScrollView>

      <GuideSheet guide="insights" visible={guide.visible} onClose={guide.close} />

      <UsageAccessDisclosure
        visible={usageDisclosureOpen}
        onDecline={() => setUsageDisclosureOpen(false)}
        onAgree={() => {
          setUsageDisclosureOpen(false);
          Linking.sendIntent("android.settings.USAGE_ACCESS_SETTINGS").catch(() =>
            Linking.openSettings()
          );
        }}
      />
    </Screen>
  );
}

/** TockIn's own completed focus sessions for the period selected above. */
function FocusSummaryCard({
  label,
  seconds,
  sessions,
}: {
  label: string;
  seconds?: number;
  sessions?: number;
}) {
  const { colors } = useTheme();
  return (
    <View style={[styles.focusCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
      <View style={styles.focusCardHeader}>
        <Text style={{ color: colors.text, fontSize: 15, fontWeight: "600" }}>TockedIn</Text>
        <Text style={{ color: colors.textDim, fontSize: 12 }}>{label}</Text>
      </View>
      <View style={styles.focusMetrics}>
        <FocusInsightMetric
          icon={Timer}
          label="Focused time"
          value={seconds === undefined ? undefined : duration(seconds)}
        />
        <View style={[styles.focusDivider, { backgroundColor: colors.border }]} />
        <FocusInsightMetric
          icon={Repeat2}
          label="Sessions"
          value={sessions === undefined ? undefined : String(sessions)}
        />
      </View>
    </View>
  );
}

function FocusInsightMetric({
  icon: Icon,
  label,
  value,
}: {
  icon: LucideIcon;
  label: string;
  /** undefined while the read is still in flight, which the block stands in for. */
  value?: string;
}) {
  const { colors } = useTheme();
  return (
    <View style={styles.focusMetric}>
      <View style={[styles.focusMetricIcon, { backgroundColor: colors.accentWash }]}>
        <Icon size={17} color={colors.accent} strokeWidth={2.2} />
      </View>
      <View style={{ flex: 1, minWidth: 0 }}>
        {value === undefined ? (
          <Skeleton width="70%" height={20} style={{ marginBottom: 4 }} />
        ) : (
          <Text style={[styles.focusMetricValue, { color: colors.text }]}>{value}</Text>
        )}
        <Text style={{ color: colors.textDim, fontSize: 12 }}>{label}</Text>
      </View>
    </View>
  );
}

// The two cards below stand in for the screen-time read, which goes out to
// Android Usage Access and can take a beat. They carry the same borders,
// padding and row heights as the real cards so nothing jumps when the numbers
// land.
function ScreenTimeCardSkeleton() {
  const { colors } = useTheme();
  return (
    <View style={[styles.savingCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
      <View style={styles.screenHeader}>
        <Skeleton width={40} height={40} borderRadius={13} />
        <View style={{ flex: 1 }}>
          <Skeleton width="60%" height={13} />
        </View>
        <Skeleton width={54} height={15} />
      </View>
      <Skeleton width="72%" height={19} style={{ marginBottom: space(0.75) }} />
      <Skeleton width="90%" height={13} />
      <View style={styles.savingBars}>
        <Skeleton width="100%" height={34} borderRadius={10} />
        <Skeleton width="100%" height={34} borderRadius={10} />
      </View>
    </View>
  );
}

const APP_SKELETON_WIDTHS = ["55%", "38%", "64%", "44%", "50%"] as const;

function AppUsageSkeleton() {
  const { colors } = useTheme();
  return (
    <>
      <View style={styles.listHeader}>
        <Skeleton width={96} height={17} />
        <Skeleton width={54} height={13} />
      </View>
      <View style={[styles.appList, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        {APP_SKELETON_WIDTHS.map((width, index) => (
          <View
            key={index}
            style={[
              styles.appRow,
              index > 0 && { borderTopWidth: StyleSheet.hairlineWidth, borderColor: colors.border },
            ]}
          >
            <Skeleton width={28} height={28} borderRadius={9} />
            <View style={{ flex: 1 }}>
              <Skeleton width={width} height={14} />
            </View>
            <Skeleton width={42} height={13} />
          </View>
        ))}
      </View>
    </>
  );
}

/**
 * The week as one line, with both series behind a toggle rather than in two
 * separate cards. Focus time and screen time are read against each other far
 * more often than either is read alone, and stacking two charts turned that
 * comparison into a scroll rather than a glance.
 *
 * Seven bars read as seven separate facts; a line reads as a direction. The
 * stroke is the accent, so it is the near-white neutral in dark mode and the
 * near-black one in light.
 */
function WeekTrendChart({
  focus,
  screen,
  onRequestScreenTime,
}: {
  focus: FocusDay[];
  /** null when Usage access is missing, undefined while the read is in flight. */
  screen: ScreenTimeDay[] | null | undefined;
  /** Offered when the screen-time series is picked but has nothing to draw. */
  onRequestScreenTime: () => void;
}) {
  const { colors } = useTheme();
  const [series, setSeries] = useState<Series>("focus");
  // The card is fluid but the SVG needs a pixel width, so it is measured.
  const [width, setWidth] = useState(0);

  const screenDays = screen?.slice(-WEEK) ?? [];
  const screenReady = screenDays.length > 0;
  // Usage access can be revoked while the screen-time series is the one on
  // show, so the card falls back rather than drawing an empty chart.
  const active: Series = series === "screen" && screenReady ? "screen" : "focus";
  const values: TrendPoint[] =
    active === "screen"
      ? screenDays.map((day) => ({ date: day.date, seconds: day.seconds }))
      : focus.map((day) => ({ date: day.date, seconds: day.seconds }));

  const max = Math.max(...values.map((point) => point.seconds), 1);
  const total = values.reduce((sum, point) => sum + point.seconds, 0);
  const sessions = focus.reduce((sum, day) => sum + day.sessions, 0);

  const plot = FOCUS_CHART_HEIGHT - FOCUS_CHART_TOP - FOCUS_CHART_BOTTOM;
  const baseline = FOCUS_CHART_TOP + plot;
  // Points sit at the centre of each day's column so they line up with the
  // labels underneath, which are laid out as equal flex children.
  const points = values.map((point, index) => ({
    point,
    x: ((index + 0.5) / values.length) * width,
    y: FOCUS_CHART_TOP + (1 - point.seconds / max) * plot,
  }));

  const line = points.map((entry) => `${entry.x},${entry.y}`).join(" ");
  const area = points.length
    ? `M ${points[0].x},${baseline} ` +
      points.map((entry) => `L ${entry.x},${entry.y}`).join(" ") +
      ` L ${points[points.length - 1].x},${baseline} Z`
    : "";

  return (
    <View style={[styles.focusChart, { backgroundColor: colors.surface, borderColor: colors.border }]}>
      <View style={styles.focusChartHeader}>
        <Text style={{ color: colors.text, fontSize: 15, fontWeight: "600" }}>
          {active === "screen" ? "Daily screen time" : "Daily TockedIn"}
        </Text>
        <Text style={{ color: colors.textDim, fontSize: 12 }}>
          {active === "screen"
            ? `${duration(total)} · ${duration(Math.round(total / Math.max(1, values.length)))} a day`
            : `${duration(total)} · ${sessions} ${sessions === 1 ? "session" : "sessions"}`}
        </Text>
      </View>

      <View style={[styles.trendToggle, { backgroundColor: colors.bg, borderColor: colors.border }]}>
        {SERIES_OPTIONS.map((option) => {
          const selected = active === option.value;
          return (
            <Pressable
              key={option.value}
              accessibilityRole="button"
              accessibilityState={{ selected }}
              onPress={() => {
                // There is nothing to draw without Usage access, so send the
                // user to the one place that can fix it rather than switching
                // to an empty chart and leaving them to work out why.
                if (option.value === "screen" && !screenReady) {
                  onRequestScreenTime();
                  return;
                }
                setSeries(option.value);
              }}
              style={({ pressed }) => [
                styles.trendToggleButton,
                {
                  backgroundColor: selected ? colors.accentWash : "transparent",
                  opacity: pressed ? 0.7 : 1,
                },
              ]}
            >
              <Text
                style={{
                  color: selected ? colors.accent : colors.textDim,
                  fontSize: 12,
                  fontWeight: "600",
                }}
              >
                {option.label}
              </Text>
            </Pressable>
          );
        })}
      </View>

      <View
        style={{ height: FOCUS_CHART_HEIGHT }}
        onLayout={(event) => setWidth(event.nativeEvent.layout.width)}
      >
        {width > 0 ? (
          <>
            <Svg width={width} height={FOCUS_CHART_HEIGHT}>
              {/* The day axis. Every point is measured up from this line. */}
              <Line
                x1={0}
                y1={baseline}
                x2={width}
                y2={baseline}
                stroke={colors.border}
                strokeWidth={1}
              />
              {/* A wash under the line rather than a second colour, so the fill
                  reads as the line's own shadow and not as its own series. */}
              <Path d={area} fill={colors.accent} fillOpacity={0.1} />
              <Polyline
                points={line}
                fill="none"
                stroke={colors.accent}
                strokeWidth={2}
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              {points.map((entry) => (
                <Circle
                  key={entry.point.date}
                  cx={entry.x}
                  cy={entry.y}
                  r={entry.point.seconds > 0 ? 3.5 : 2.5}
                  fill={entry.point.seconds > 0 ? colors.accent : colors.border}
                />
              ))}
            </Svg>

            {/* Values are ordinary text rather than SVG text so they carry the
                app's own font. Only days with time are labelled: a row of
                zeroes would crowd out the days that actually happened. */}
            {points.map((entry) =>
              entry.point.seconds > 0 ? (
                <Text
                  key={entry.point.date}
                  numberOfLines={1}
                  style={[
                    styles.focusPointValue,
                    { left: entry.x - 22, top: entry.y - 20, color: colors.text },
                  ]}
                >
                  {duration(entry.point.seconds)}
                </Text>
              ) : null
            )}
          </>
        ) : null}
      </View>

      {/* Labelled from the series on show, so a short run of screen-time days
          can never sit under a seven-day row of names. */}
      <View style={styles.focusChartDays}>
        {values.map((point) => (
          <Text
            key={point.date}
            numberOfLines={1}
            style={[styles.focusDayName, { color: colors.textDim }]}
          >
            {dayName(point.date)}
          </Text>
        ))}
      </View>
    </View>
  );
}

/**
 * The app's own launcher icon, straight from the package manager. Usage stats
 * can name packages the launcher does not list — TockIn itself, keyboards,
 * system UI — so anything without an icon falls back to a lettered tile rather
 * than leaving a hole in the row.
 */
function AppIcon({ name, uri }: { name: string; uri?: string }) {
  const { colors } = useTheme();

  if (uri) {
    return (
      <Image
        source={{ uri }}
        style={[styles.appIcon, { backgroundColor: colors.accentWash }]}
        resizeMode="contain"
        fadeDuration={0}
      />
    );
  }

  return (
    <View style={[styles.appIcon, styles.appIconFallback, { backgroundColor: colors.accentWash }]}>
      <Text style={{ color: colors.textDim, fontSize: 12, fontWeight: "600" }}>
        {name.trim().charAt(0).toUpperCase() || "?"}
      </Text>
    </View>
  );
}

/** The selected period's total screen time. */
/**
 * The selected period measured against the user's own usual day, which is the
 * only baseline that means anything: a national average would say nothing
 * about whether TockIn is working for this person.
 *
 * The wording carries the direction rather than a colour. The accent means "a
 * session is running" everywhere else in TockIn, and borrowing it here to mean
 * "a good day" would blunt that.
 */
function ScreenTimeCard({
  periodLabel,
  total,
  saving,
  label,
  perDay,
  effect,
}: {
  periodLabel: string;
  /** The period's own screen time. Its bar repeats it, but the header is what
      the eye lands on first and the bar only means something next to the other. */
  total: number;
  /** null when there is no screen-time history to compare against at all. */
  saving: Saving | null;
  /** Names the bar for the selected period. */
  label: string;
  /** The period is an average of several days, so the headline says "a day". */
  perDay: boolean;
  effect: TockInEffect | null;
}) {
  const { colors } = useTheme();
  const ready = saving !== null && saving.baselineDays >= MIN_BASELINE_DAYS;

  const difference = saving ? saving.baseline - saving.current : 0;
  const magnitude = Math.abs(difference);
  // A minute either way is measurement noise, not a change worth naming.
  const level = magnitude < 60;
  const down = difference > 0;
  const percent =
    saving && saving.baseline > 0 ? Math.round((magnitude / saving.baseline) * 100) : 0;
  const HeaderIcon = !ready ? CalendarDays : level ? Hourglass : down ? TrendingDown : TrendingUp;

  return (
    <View style={[styles.savingCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
      {/* The total the separate screen-time card used to carry, kept small: the
          headline underneath is the reading, and this is only its subject. */}
      <View style={styles.screenHeader}>
        <View style={[styles.iconBox, { backgroundColor: colors.accentWash }]}>
          <HeaderIcon size={20} color={colors.accent} strokeWidth={2.2} />
        </View>
        <Text numberOfLines={1} style={[styles.screenHeaderLabel, { color: colors.textDim }]}>
          {periodLabel} screen time
        </Text>
        <Text style={[styles.screenHeaderTotal, { color: colors.text }]}>{duration(total)}</Text>
      </View>

      {/* Saying "3h saved" off one day of history would be a guess dressed as a
          measurement. Naming the wait gives the user a reason to come back. */}
      {!ready || !saving ? (
        <>
          <Text style={[styles.savingLearningTitle, { color: colors.text }]}>
            Learning your usual day
          </Text>
          <Text style={[styles.savingSub, { color: colors.textDim }]}>
            TockIn measures your screen time against your own average. That needs{" "}
            {MIN_BASELINE_DAYS} full days, and it has {saving?.baselineDays ?? 0}{" "}
            {saving?.baselineDays === 1 ? "day" : "days"} so far.
          </Text>
        </>
      ) : (
        <>
          <Text style={[styles.savingHeadline, { color: colors.text }]}>
            {level
              ? "Level with your usual day"
              : `${duration(magnitude)} ${down ? "less" : "more"}${perDay ? " a day" : ""}`}
          </Text>
          <Text style={[styles.savingSub, { color: colors.textDim }]}>
            {level ? "Your usual day is the same." : `${percent}% ${down ? "below" : "above"} your usual day.`}
            {saving.partial ? " Today is still going." : ""}
          </Text>

          {/* Both bars share one scale, so their lengths are the comparison. */}
          <View style={styles.savingBars}>
            <ComparisonBar
              label="Your usual day"
              seconds={saving.baseline}
              max={Math.max(saving.baseline, saving.current, 1)}
            />
            <ComparisonBar
              label={label}
              seconds={saving.current}
              max={Math.max(saving.baseline, saving.current, 1)}
            />
          </View>

          {effect ? (
            <View style={[styles.savingFooter, { borderColor: colors.border }]}>
              <Nfc size={15} color={colors.textDim} strokeWidth={2.1} />
              <Text style={[styles.savingFootnote, { color: colors.textDim }]}>
                You average {duration(effect.tapped)} on the days you tap in, and{" "}
                {duration(effect.rest)} on the days you do not.
              </Text>
            </View>
          ) : (
            <Text style={[styles.savingBaselineNote, { color: colors.textDim }]}>
              Your usual day is the average of the other {saving.baselineDays} days TockIn has
              recorded.
            </Text>
          )}
        </>
      )}
    </View>
  );
}

/**
 * One side of the comparison. Horizontal, so the pair is read as one ratio.
 *
 * Both bars are filled with the accent, which is the near-white neutral in dark
 * mode and the near-black one in light. Drawing the baseline in a fainter
 * colour lost it against its own track in dark mode, and the two lengths are
 * what carry the comparison anyway.
 */
function ComparisonBar({ label, seconds, max }: { label: string; seconds: number; max: number }) {
  const { colors } = useTheme();
  // A day with no recorded time still gets a sliver, otherwise the row looks
  // like it failed to load rather than like a genuine zero.
  const width = seconds === 0 ? 0 : Math.max(4, (seconds / max) * 100);

  return (
    <View style={styles.savingBarRow}>
      <Text numberOfLines={1} style={[styles.savingBarLabel, { color: colors.textDim }]}>
        {label}
      </Text>
      <View style={[styles.savingBarTrack, { backgroundColor: colors.accentWash }]}>
        <View
          style={[styles.savingBarFill, { width: `${width}%`, backgroundColor: colors.accent }]}
        />
      </View>
      <Text style={[styles.savingBarValue, { color: colors.text }]}>{duration(seconds)}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: space(3),
  },
  headerActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: space(1.5),
  },
  segment: {
    flexDirection: "row",
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 14,
    padding: 4,
    marginBottom: space(2),
  },
  segmentButton: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: space(0.5),
    borderRadius: 10,
    paddingVertical: space(1.1),
  },
  focusCard: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 16,
    padding: space(1.75),
    marginBottom: space(2),
  },
  focusCardHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: space(1),
    marginBottom: space(1.5),
  },
  focusMetrics: {
    flexDirection: "row",
    alignItems: "stretch",
  },
  focusMetric: {
    flex: 1,
    minWidth: 0,
    flexDirection: "row",
    alignItems: "center",
    gap: space(1),
  },
  focusMetricIcon: {
    width: 36,
    height: 36,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  focusMetricValue: {
    fontSize: 20,
    lineHeight: 24,
    fontWeight: "600",
    fontVariant: ["tabular-nums"],
    letterSpacing: -0.3,
  },
  focusDivider: {
    width: StyleSheet.hairlineWidth,
    marginHorizontal: space(1.25),
  },
  focusChart: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 16,
    padding: space(1.75),
    marginBottom: space(2),
  },
  focusChartHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: space(1),
    marginBottom: space(1.5),
  },
  // Narrower than the gap between two points, so neighbouring labels cannot
  // touch even on the week where every day has time on it.
  focusPointValue: {
    position: "absolute",
    width: 44,
    textAlign: "center",
    fontSize: 10,
    fontWeight: "600",
    fontVariant: ["tabular-nums"],
  },
  focusChartDays: {
    flexDirection: "row",
    marginTop: space(0.75),
  },
  focusDayName: {
    flex: 1,
    textAlign: "center",
    fontSize: 11,
  },
  messageCard: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 14,
    padding: space(2),
    marginBottom: space(3),
  },
  screenHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: space(1.25),
    marginBottom: space(1.5),
  },
  screenHeaderLabel: {
    flex: 1,
    fontSize: 13,
  },
  screenHeaderTotal: {
    fontSize: 15,
    fontWeight: "600",
    fontVariant: ["tabular-nums"],
  },
  // Smaller than the period segment above it: that one chooses what the whole
  // screen is about, this one only swaps the line inside its own card.
  trendToggle: {
    flexDirection: "row",
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 12,
    padding: 3,
    marginBottom: space(1),
  },
  trendToggleButton: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 9,
    paddingVertical: space(0.85),
  },
  listHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: space(1.25),
  },
  appList: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 16,
    overflow: "hidden",
  },
  appRow: {
    minHeight: 58,
    flexDirection: "row",
    alignItems: "center",
    gap: space(1.25),
    paddingHorizontal: space(1.5),
  },
  viewAllRow: {
    minHeight: 48,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: space(0.75),
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: space(1.5),
  },
  // Same 28x28 footprint the rank badge had, so the rows keep their alignment.
  appIcon: {
    width: 28,
    height: 28,
    borderRadius: 9,
  },
  appIconFallback: {
    alignItems: "center",
    justifyContent: "center",
  },
  savingCard: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 16,
    padding: space(1.75),
    marginBottom: space(3),
  },
  savingHeadline: {
    fontSize: 19,
    lineHeight: 25,
    fontWeight: "600",
    letterSpacing: -0.3,
    fontVariant: ["tabular-nums"],
  },
  savingLearningTitle: {
    fontSize: 15,
    fontWeight: "600",
  },
  savingSub: {
    fontSize: 12,
    lineHeight: 17,
    marginTop: 3,
  },
  savingBars: {
    marginTop: space(1.75),
    gap: space(1),
  },
  savingBarRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: space(1),
  },
  savingBarLabel: {
    width: 84,
    fontSize: 12,
  },
  savingBarTrack: {
    flex: 1,
    height: 10,
    borderRadius: 999,
    overflow: "hidden",
  },
  savingBarFill: {
    height: "100%",
    borderRadius: 999,
  },
  savingBarValue: {
    width: 54,
    textAlign: "right",
    fontSize: 13,
    fontWeight: "600",
    fontVariant: ["tabular-nums"],
  },
  savingFooter: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: space(1),
    marginTop: space(1.75),
    paddingTop: space(1.5),
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  savingFootnote: {
    flex: 1,
    fontSize: 12,
    lineHeight: 17,
  },
  savingBaselineNote: {
    marginTop: space(1.5),
    fontSize: 11,
    lineHeight: 16,
  },
  iconBox: {
    width: 40,
    height: 40,
    borderRadius: 13,
    alignItems: "center",
    justifyContent: "center",
  },
});
