import React, { useEffect, useMemo, useState } from "react";
import { AppState, Linking, Pressable, ScrollView, StyleSheet, View } from "react-native";
import ChartNoAxesCombined from "lucide-react-native/icons/chart-no-axes-combined";
import Hourglass from "lucide-react-native/icons/hourglass";
import { AppScreenTime, getScreenTimeInsights, ScreenTimeDay } from "../blocking";
import { Screen, Title } from "../components";
import { space, useTheme } from "../theme";
import { Text } from "../typography";

type Period = "today" | "yesterday" | "week";

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

export default function InsightsScreen() {
  const { colors } = useTheme();
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

  const summary = useMemo(() => {
    if (!days?.length) return { seconds: 0, apps: [] as AppScreenTime[] };
    const selectedDays =
      period === "today" ? days.slice(-1) : period === "yesterday" ? days.slice(-2, -1) : days;
    return {
      seconds: selectedDays.reduce((total, day) => total + day.seconds, 0),
      apps: combineApps(selectedDays),
    };
  }, [days, period]);

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

        {error ? (
          <View style={[styles.messageCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <Text style={{ color: colors.text, fontSize: 15, fontWeight: "600" }}>Insights unavailable</Text>
            <Text style={{ color: colors.textDim, fontSize: 13, lineHeight: 19, marginTop: 5 }}>{error}</Text>
          </View>
        ) : days === undefined ? (
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
            <View style={[styles.totalCard, { backgroundColor: colors.accentWash }]}>
              <View>
                <Text style={{ color: colors.textDim, fontSize: 13 }}>{periodLabel} screen time</Text>
                <Text style={[styles.total, { color: colors.text }]}>{duration(summary.seconds)}</Text>
              </View>
              <View style={[styles.totalIcon, { backgroundColor: colors.surface }]}>
                <Hourglass size={23} color={colors.accent} strokeWidth={2.2} />
              </View>
            </View>

            {period === "week" && <WeekChart days={days} />}

            <View style={styles.listHeader}>
              <Text style={{ color: colors.text, fontSize: 17, fontWeight: "600" }}>App usage</Text>
              <Text style={{ color: colors.textDim, fontSize: 13 }}>{summary.apps.length} apps</Text>
            </View>
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
          </>
        )}
      </ScrollView>
    </Screen>
  );
}

function WeekChart({ days }: { days: ScreenTimeDay[] }) {
  const { colors } = useTheme();
  const max = Math.max(...days.map((day) => day.seconds), 1);
  const average = Math.round(days.reduce((sum, day) => sum + day.seconds, 0) / days.length);

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
              <View
                style={[
                  styles.bar,
                  {
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
    alignItems: "center",
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
});
