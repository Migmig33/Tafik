import React, { useEffect, useMemo, useState } from "react";
import { AppState, Linking, Pressable, ScrollView, StyleSheet, View } from "react-native";
import ChartNoAxesCombined from "lucide-react-native/icons/chart-no-axes-combined";
import Hourglass from "lucide-react-native/icons/hourglass";
import Lock from "lucide-react-native/icons/lock";
import TrendingDown from "lucide-react-native/icons/trending-down";
import TrendingUp from "lucide-react-native/icons/trending-up";
import type { DimensionValue } from "react-native";
import { AppScreenTime, getScreenTimeInsights, ScreenTimeDay } from "../blocking";
import { Screen, Title } from "../components";
import { usePremium } from "../premium";
import { radius, space, useTheme } from "../theme";
import { Text } from "../typography";

type Period = "today" | "yesterday" | "week";

/** Days the chart covers, and the size of each half of the trend comparison. */
const WEEK = 7;

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

export default function InsightsScreen({ onUnlock }: { onUnlock: () => void }) {
  const { colors } = useTheme();
  // Free sees how long today and yesterday were. Premium sees the shape of it:
  // which apps, the week, and whether the week is going the right way.
  const { isPremium, ready: premiumReady } = usePremium();
  const [period, setPeriod] = useState<Period>("today");
  const [days, setDays] = useState<ScreenTimeDay[] | null | undefined>(undefined);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const refresh = async () => {
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
      apps: combineApps(selectedDays),
    };
  }, [days, period, chartDays]);

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
                {item === "week" && !isPremium && (
                  <Lock size={11} color={selected ? colors.accent : colors.textDim} strokeWidth={2.6} />
                )}
              </Pressable>
            );
          })}
        </View>

        {error ? (
          <View style={[styles.messageCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <Text style={{ color: colors.text, fontSize: 15, fontWeight: "600" }}>Insights unavailable</Text>
            <Text style={{ color: colors.textDim, fontSize: 13, lineHeight: 19, marginTop: 5 }}>{error}</Text>
          </View>
        ) : days === undefined || !premiumReady ? (
          <Text style={{ color: colors.textDim, marginTop: space(4) }}>Loading screen time…</Text>
        ) : days === null ? (
          <Pressable
            onPress={() => Linking.sendIntent("android.settings.USAGE_ACCESS_SETTINGS")}
            style={[styles.messageCard, { backgroundColor: colors.surface, borderColor: colors.border }]}
          >
            <Text style={{ color: colors.text, fontSize: 15, fontWeight: "600" }}>Usage Access required</Text>
            <Text style={{ color: colors.textDim, fontSize: 13, marginTop: 5 }}>Tap to open Android settings.</Text>
          </Pressable>
        ) : (
          <>
            {/* The week total is itself premium; today and yesterday are not. */}
            {period === "week" && !isPremium ? (
              <PremiumLock
                title="See your whole week"
                blurb="Seven days of screen time, the apps behind it, and whether you're trending up or down."
                onUnlock={onUnlock}
              >
                <TotalCard label={periodLabel} value="•h ••m" />
                <WeekChart days={chartDays} placeholder />
                <TrendCard percent={-12} placeholder />
              </PremiumLock>
            ) : (
              <>
                <TotalCard label={periodLabel} value={duration(summary.seconds)} />
                {period === "week" && (
                  <>
                    <WeekChart days={chartDays} />
                    {trend && <TrendCard percent={trend.percent} />}
                  </>
                )}
              </>
            )}

            <View style={styles.listHeader}>
              <Text style={{ color: colors.text, fontSize: 17, fontWeight: "600" }}>App usage</Text>
              {isPremium && (
                <Text style={{ color: colors.textDim, fontSize: 13 }}>{summary.apps.length} apps</Text>
              )}
            </View>
            {isPremium ? (
              <View style={[styles.appList, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                {summary.apps.length === 0 ? (
                  <Text style={{ color: colors.textDim, fontSize: 14, padding: space(2) }}>No app activity recorded.</Text>
                ) : (
                  summary.apps.map((app, index) => (
                    <View
                      key={app.pkg}
                      style={[
                        styles.appRow,
                        index > 0 && { borderTopWidth: StyleSheet.hairlineWidth, borderColor: colors.border },
                      ]}
                    >
                      <View style={[styles.rank, { backgroundColor: colors.accentWash }]}>
                        <Text style={{ color: colors.accent, fontSize: 12, fontWeight: "600" }}>{index + 1}</Text>
                      </View>
                      <Text numberOfLines={1} style={{ flex: 1, color: colors.text, fontSize: 15 }}>
                        {app.name}
                      </Text>
                      <Text style={{ color: colors.textDim, fontSize: 14, fontVariant: ["tabular-nums"] }}>
                        {duration(app.seconds)}
                      </Text>
                    </View>
                  ))
                )}
              </View>
            ) : (
              <PremiumLock
                title="See which apps took the time"
                blurb="Ranked by how long each one held your attention."
                onUnlock={onUnlock}
              >
                <AppListPlaceholder />
              </PremiumLock>
            )}
          </>
        )}
      </ScrollView>
    </Screen>
  );
}

/** The period total. Extracted so the locked preview can show the same shape. */
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
function TrendCard({ percent, placeholder }: { percent: number; placeholder?: boolean }) {
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
          {placeholder
            ? "Week over week"
            : magnitude === 0
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

/**
 * The bar chart. In placeholder mode it draws a fixed sample silhouette in the
 * border colour instead of the user's real data: the locked preview exists to
 * show the shape of the feature, not to hand over the numbers behind it.
 */
function WeekChart({ days, placeholder }: { days: ScreenTimeDay[]; placeholder?: boolean }) {
  const { colors } = useTheme();
  const max = Math.max(...days.map((day) => day.seconds), 1);
  const average = days.length
    ? Math.round(days.reduce((sum, day) => sum + day.seconds, 0) / days.length)
    : 0;
  const sample = [46, 72, 38, 84, 60, 30, 66];

  return (
    <View style={[styles.chartCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
      <View style={styles.chartTitle}>
        <Text style={{ color: colors.text, fontSize: 15, fontWeight: "600" }}>Daily screen time</Text>
        <Text style={{ color: colors.textDim, fontSize: 13 }}>
          {placeholder ? "••m avg" : `${duration(average)} avg`}
        </Text>
      </View>
      <View style={styles.bars}>
        {days.map((day, index) => (
          <View key={day.date} style={styles.barColumn}>
            <View style={styles.barTrack}>
              <View
                style={[
                  styles.bar,
                  placeholder
                    ? { backgroundColor: colors.border, height: sample[index % sample.length] }
                    : {
                        backgroundColor: colors.accent,
                        height: day.seconds === 0 ? 3 : Math.max(8, Math.round((day.seconds / max) * 88)),
                      },
                ]}
              />
            </View>
            <Text style={{ color: colors.textDim, fontSize: 11 }}>{dayName(day.date)}</Text>
          </View>
        ))}
      </View>
    </View>
  );
}

/** Redacted rows: the ranking is visible, the data behind it is not. */
function AppListPlaceholder() {
  const { colors } = useTheme();
  const widths: DimensionValue[] = ["62%", "48%", "70%", "40%"];

  return (
    <View style={[styles.appList, { backgroundColor: colors.surface, borderColor: colors.border }]}>
      {widths.map((width, index) => (
        <View
          key={String(width)}
          style={[
            styles.appRow,
            index > 0 && { borderTopWidth: StyleSheet.hairlineWidth, borderColor: colors.border },
          ]}
        >
          <View style={[styles.rank, { backgroundColor: colors.accentWash }]}>
            <Text style={{ color: colors.accent, fontSize: 12, fontWeight: "600" }}>{index + 1}</Text>
          </View>
          <View style={[styles.redaction, { backgroundColor: colors.border, width }]} />
          <View style={{ flex: 1 }} />
          <View style={[styles.redaction, { backgroundColor: colors.border, width: 42 }]} />
        </View>
      ))}
    </View>
  );
}

/**
 * A premium feature shown rather than hidden: the real layout underneath, dimmed
 * and inert, with the offer on top. Someone deciding whether to pay should be
 * able to see what they would be paying for.
 */
function PremiumLock({
  title,
  blurb,
  onUnlock,
  children,
}: {
  title: string;
  blurb: string;
  onUnlock: () => void;
  children: React.ReactNode;
}) {
  const { colors } = useTheme();
  return (
    <View style={styles.lockWrap}>
      {/* Inert, so a tap anywhere on the preview reaches the offer on top. */}
      <View pointerEvents="none" style={{ opacity: 0.4 }}>
        {children}
      </View>
      <View style={styles.lockOverlay}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`${title}. Unlock with Premium.`}
          onPress={onUnlock}
          style={({ pressed }) => [
            styles.lockCard,
            {
              backgroundColor: colors.surface,
              borderColor: colors.border,
              opacity: pressed ? 0.9 : 1,
            },
          ]}
        >
          <View style={[styles.iconBox, { backgroundColor: colors.accentWash }]}>
            <Lock size={19} color={colors.accent} strokeWidth={2.2} />
          </View>
          <Text style={{ color: colors.text, fontSize: 15, fontWeight: "600", textAlign: "center" }}>
            {title}
          </Text>
          <Text style={{ color: colors.textDim, fontSize: 13, lineHeight: 19, textAlign: "center" }}>
            {blurb}
          </Text>
          <View style={[styles.unlockButton, { backgroundColor: colors.accent }]}>
            <Text style={{ color: colors.onAccent, fontSize: 14, fontWeight: "600" }}>
              Unlock Premium
            </Text>
          </View>
        </Pressable>
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
    height: 118,
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
  rank: {
    width: 28,
    height: 28,
    borderRadius: 9,
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
  redaction: {
    height: 11,
    borderRadius: 6,
  },
  lockWrap: {
    position: "relative",
  },
  lockOverlay: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: "center",
    justifyContent: "center",
    padding: space(2),
  },
  lockCard: {
    alignItems: "center",
    gap: space(1),
    maxWidth: 320,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: radius.card,
    paddingHorizontal: space(2.5),
    paddingVertical: space(2.5),
  },
  unlockButton: {
    marginTop: space(0.75),
    minHeight: 44,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: space(2.5),
    borderRadius: radius.pill,
  },
});
