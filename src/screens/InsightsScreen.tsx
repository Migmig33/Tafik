import { useEffect, useMemo, useState } from "react";
import { AppState, Image, Linking, Pressable, ScrollView, StyleSheet, View } from "react-native";
import ChartNoAxesCombined from "lucide-react-native/icons/chart-no-axes-combined";
import ChevronDown from "lucide-react-native/icons/chevron-down";
import ChevronUp from "lucide-react-native/icons/chevron-up";
import Hourglass from "lucide-react-native/icons/hourglass";
import Repeat2 from "lucide-react-native/icons/repeat-2";
import Timer from "lucide-react-native/icons/timer";
import TrendingDown from "lucide-react-native/icons/trending-down";
import TrendingUp from "lucide-react-native/icons/trending-up";
import type { LucideIcon } from "lucide-react-native";
import { UsageAccessDisclosure } from "../AccessDisclosures";
import { AppScreenTime, getInstalledApps, getScreenTimeInsights, ScreenTimeDay } from "../blocking";
import { Screen, Title } from "../components";
import { getSessions, SessionRecord, todayKey } from "../store";
import { space, useTheme } from "../theme";
import { Text } from "../typography";

type Period = "today" | "yesterday" | "week";
type FocusDay = { date: string; seconds: number; sessions: number };

/** Days the chart covers, and the size of each half of the trend comparison. */
const WEEK = 7;
const APP_PREVIEW_COUNT = 4;

function duration(totalSeconds: number): string {
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  if (hours === 0) return `${minutes}m`;
  return minutes === 0 ? `${hours}h` : `${hours}h ${minutes}m`;
}

/** Narrow two-line value that fits above one column of the seven-day chart. */
function chartDuration(totalSeconds: number): string {
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  if (hours === 0) return `${minutes}m`;
  return minutes === 0 ? `${hours}h` : `${hours}h\n${minutes}m`;
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

export default function InsightsScreen() {
  const { colors } = useTheme();
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

  // Week over week. Older builds only return seven days, so there is nothing to
  // compare against and the card is left out rather than shown as a flat zero.
  const trend = useMemo(() => {
    if (!days || days.length < WEEK * 2) return null;
    const previous = days.slice(-WEEK * 2, -WEEK).reduce((total, day) => total + day.seconds, 0);
    const current = chartDays.reduce((total, day) => total + day.seconds, 0);
    if (previous === 0) return null;
    return {
      current,
      previous,
      percent: Math.round(((current - previous) / previous) * 100),
    };
  }, [days, chartDays]);

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
          <ChartNoAxesCombined size={25} color={colors.accent} strokeWidth={2.2} />
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

        <FocusSummaryCard
          label={periodLabel}
          seconds={focusSummary?.seconds}
          sessions={focusSummary?.count}
        />
        {period === "week" && sessions !== undefined ? (
          <TappedInWeekChart days={focusWeekDays} />
        ) : null}

        {error ? (
          <View style={[styles.messageCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <Text style={{ color: colors.text, fontSize: 15, fontWeight: "600" }}>Screen time unavailable</Text>
            <Text style={{ color: colors.textDim, fontSize: 13, lineHeight: 19, marginTop: 5 }}>{error}</Text>
          </View>
        ) : days === undefined ? (
          <Text style={{ color: colors.textDim, marginTop: space(4) }}>Loading screen time…</Text>
        ) : days === null ? (
          <Pressable
            onPress={() => setUsageDisclosureOpen(true)}
            style={[styles.messageCard, { backgroundColor: colors.surface, borderColor: colors.border }]}
          >
            <Text style={{ color: colors.text, fontSize: 15, fontWeight: "600" }}>Usage Access required</Text>
            <Text style={{ color: colors.textDim, fontSize: 13, marginTop: 5 }}>Tap to open Android settings.</Text>
          </Pressable>
        ) : (
          <>
            <TotalCard label={periodLabel} value={duration(summary.seconds)} />
            {period === "week" && (
              <>
                <WeekChart days={chartDays} />
                {trend && <TrendCard percent={trend.percent} />}
              </>
            )}

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
        )}
      </ScrollView>

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

/** TapIn's own completed focus sessions for the period selected above. */
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
        <Text style={{ color: colors.text, fontSize: 15, fontWeight: "600" }}>TappedIn</Text>
        <Text style={{ color: colors.textDim, fontSize: 12 }}>{label}</Text>
      </View>
      <View style={styles.focusMetrics}>
        <FocusInsightMetric
          icon={Timer}
          label="Focused time"
          value={seconds === undefined ? "—" : duration(seconds)}
        />
        <View style={[styles.focusDivider, { backgroundColor: colors.border }]} />
        <FocusInsightMetric
          icon={Repeat2}
          label="Sessions"
          value={sessions === undefined ? "—" : String(sessions)}
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
  value: string;
}) {
  const { colors } = useTheme();
  return (
    <View style={styles.focusMetric}>
      <View style={[styles.focusMetricIcon, { backgroundColor: colors.accentWash }]}>
        <Icon size={17} color={colors.accent} strokeWidth={2.2} />
      </View>
      <View>
        <Text style={[styles.focusMetricValue, { color: colors.text }]}>{value}</Text>
        <Text style={{ color: colors.textDim, fontSize: 12 }}>{label}</Text>
      </View>
    </View>
  );
}

/** Mobile-friendly horizontal bars leave room for exact daily values. */
function TappedInWeekChart({ days }: { days: FocusDay[] }) {
  const { colors } = useTheme();
  const max = Math.max(...days.map((day) => day.seconds), 1);

  return (
    <View style={[styles.focusChart, { backgroundColor: colors.surface, borderColor: colors.border }]}>
      <View style={styles.focusChartHeader}>
        <Text style={{ color: colors.text, fontSize: 15, fontWeight: "600" }}>
          Daily TappedIn
        </Text>
        <Text style={{ color: colors.textDim, fontSize: 12 }}>Focused · Sessions</Text>
      </View>

      <View style={styles.focusChartRows}>
        {days.map((day) => {
          const width = day.seconds === 0 ? 0 : Math.max(3, (day.seconds / max) * 100);
          return (
            <View key={day.date} style={styles.focusChartRow}>
              <View style={styles.focusDayLabel}>
                <Text style={{ color: colors.text, fontSize: 12, fontWeight: "600" }}>
                  {dayName(day.date)}
                </Text>
                <Text style={{ color: colors.textDim, fontSize: 10 }}>
                  {new Date(`${day.date}T00:00:00`).toLocaleDateString(undefined, {
                    month: "short",
                    day: "numeric",
                  })}
                </Text>
              </View>
              <View style={[styles.focusBarTrack, { backgroundColor: colors.accentWash }]}>
                <View
                  style={[
                    styles.focusBar,
                    { backgroundColor: colors.accent, width: `${width}%` },
                  ]}
                />
              </View>
              <View style={styles.focusDayValues}>
                <Text style={{ color: colors.text, fontSize: 12, fontWeight: "600" }}>
                  {duration(day.seconds)}
                </Text>
                <Text style={{ color: colors.textDim, fontSize: 10 }}>
                  {day.sessions} {day.sessions === 1 ? "session" : "sessions"}
                </Text>
              </View>
            </View>
          );
        })}
      </View>
    </View>
  );
}

/**
 * The app's own launcher icon, straight from the package manager. Usage stats
 * can name packages the launcher does not list — TapIn itself, keyboards,
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
function TotalCard({ label, value }: { label: string; value: string }) {
  const { colors } = useTheme();
  return (
    <View style={[styles.totalCard, { backgroundColor: colors.accentWash }]}>
      <View>
        <Text style={{ color: colors.textDim, fontSize: 13 }}>{label} screen time</Text>
        <Text style={[styles.total, { color: colors.text }]}>{value}</Text>
      </View>
      <View style={[styles.totalIcon, { backgroundColor: colors.surface }]}>
        <Hourglass size={23} color={colors.accent} strokeWidth={2.2} />
      </View>
    </View>
  );
}

/**
 * This week against the one before it. The wording carries the direction rather
 * than a colour: the accent green means "a session is running" everywhere else
 * in TapIn, and borrowing it here to mean "a good week" would blunt that.
 */
function TrendCard({ percent }: { percent: number }) {
  const { colors } = useTheme();
  const down = percent <= 0;
  const Icon = down ? TrendingDown : TrendingUp;
  const magnitude = Math.abs(percent);

  return (
    <View style={[styles.trendCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
      <View style={[styles.iconBox, { backgroundColor: colors.accentWash }]}>
        <Icon size={20} color={colors.accent} strokeWidth={2.2} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={{ color: colors.text, fontSize: 15, fontWeight: "600" }}>
          {magnitude === 0
            ? "Level with last week"
            : `${magnitude}% ${down ? "less" : "more"} than last week`}
        </Text>
        <Text style={{ color: colors.textDim, fontSize: 12, marginTop: 3, lineHeight: 17 }}>
          How these seven days compare with the seven before them.
        </Text>
      </View>
    </View>
  );
}

/** Screen time for each of the last seven local-calendar days. */
function WeekChart({ days }: { days: ScreenTimeDay[] }) {
  const { colors } = useTheme();
  const max = Math.max(...days.map((day) => day.seconds), 1);
  const average = days.length
    ? Math.round(days.reduce((sum, day) => sum + day.seconds, 0) / days.length)
    : 0;

  return (
    <View style={[styles.chartCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
      <View style={styles.chartTitle}>
        <Text style={{ color: colors.text, fontSize: 15, fontWeight: "600" }}>Daily screen time</Text>
        <Text style={{ color: colors.textDim, fontSize: 13 }}>{duration(average)} avg</Text>
      </View>
      <View style={styles.bars}>
        {days.map((day) => (
          <View key={day.date} style={styles.barColumn}>
            <View style={styles.barTrack}>
              <Text style={[styles.barValue, { color: colors.textDim }]}>
                {chartDuration(day.seconds)}
              </Text>
              <View style={styles.barArea}>
                <View
                  style={[
                    styles.bar,
                    {
                      backgroundColor: colors.accent,
                      height:
                        day.seconds === 0
                          ? 3
                          : Math.max(8, Math.round((day.seconds / max) * 88)),
                    },
                  ]}
                />
              </View>
            </View>
            <Text style={{ color: colors.textDim, fontSize: 11 }}>{dayName(day.date)}</Text>
          </View>
        ))}
      </View>
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
  focusChartRows: {
    gap: space(1.1),
  },
  focusChartRow: {
    minHeight: 34,
    flexDirection: "row",
    alignItems: "center",
    gap: space(1),
  },
  focusDayLabel: {
    width: 38,
  },
  focusBarTrack: {
    flex: 1,
    height: 8,
    borderRadius: 999,
    overflow: "hidden",
  },
  focusBar: {
    height: "100%",
    borderRadius: 999,
  },
  focusDayValues: {
    width: 76,
    alignItems: "flex-end",
  },
  messageCard: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 14,
    padding: space(2),
  },
  totalCard: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderRadius: 16,
    padding: space(2.25),
    marginBottom: space(2),
  },
  total: {
    fontSize: 34,
    fontWeight: "600",
    letterSpacing: -0.8,
    marginTop: 3,
    fontVariant: ["tabular-nums"],
  },
  totalIcon: {
    width: 46,
    height: 46,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 23,
  },
  chartCard: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 16,
    padding: space(2),
    marginBottom: space(3),
  },
  chartTitle: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: space(2),
  },
  bars: {
    height: 142,
    flexDirection: "row",
    alignItems: "flex-end",
    gap: space(0.75),
  },
  barColumn: {
    flex: 1,
    height: "100%",
    alignItems: "center",
    justifyContent: "flex-end",
    gap: 6,
  },
  barTrack: {
    flex: 1,
    width: "100%",
    alignItems: "center",
  },
  barValue: {
    width: "100%",
    height: 22,
    fontSize: 9,
    lineHeight: 10,
    textAlign: "center",
    fontVariant: ["tabular-nums"],
  },
  barArea: {
    flex: 1,
    width: "60%",
    justifyContent: "flex-end",
  },
  bar: {
    width: "100%",
    borderRadius: 5,
    opacity: 0.85,
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
  trendCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: space(1.5),
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 16,
    padding: space(2),
    marginBottom: space(3),
  },
  iconBox: {
    width: 40,
    height: 40,
    borderRadius: 13,
    alignItems: "center",
    justifyContent: "center",
  },
});
