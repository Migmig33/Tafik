import React, { useEffect, useState } from "react";
import { Alert, ScrollView, StyleSheet, View } from "react-native";
import type { LucideIcon } from "lucide-react-native";
import LockKeyhole from "lucide-react-native/icons/lock-keyhole";
import Repeat2 from "lucide-react-native/icons/repeat-2";
import Timer from "lucide-react-native/icons/timer";
import { Body, GhostButton, PrimaryButton, Screen, TapRipple, Title } from "../components";
import { Nav } from "../nav";
import { cancelCardRead, readCardUid } from "../nfc";
import { getCardUid, getTodayStats, TodayStats } from "../store";
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
  onStart,
  onEnd,
}: {
  nav: Nav;
  active: boolean;
  startedAt: number | null;
  blockCount: number;
  onStart: () => Promise<void>;
  onEnd: () => Promise<void>;
}) {
  const { colors } = useTheme();
  const [now, setNow] = useState(Date.now());
  const [stats, setStats] = useState<TodayStats>({ seconds: 0, count: 0, streak: 0 });
  // Which action is waiting for a card tap, if any. Arming the reader is a
  // deliberate step so a stray tap cannot lock or unlock the phone, and so the
  // button cannot be spammed into opening several reads at once.
  const [scanning, setScanning] = useState<null | "start" | "end">(null);

  // Refresh stats whenever we return to the idle state (i.e. a session ended).
  useEffect(() => {
    if (!active) getTodayStats().then(setStats);
  }, [active]);

  useEffect(() => {
    if (!active) return;
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [active]);

  // Leaving the screen with the reader armed would leave it listening in the
  // background, so drop the pending read on the way out.
  useEffect(() => () => void cancelCardRead(), []);

  const beginScan = async (mode: "start" | "end") => {
    if (scanning) return;
    const stored = await getCardUid();
    if (!stored) {
      nav("cardSetup");
      return;
    }
    setScanning(mode);
    const r = await readCardUid();
    setScanning(null);
    if ("error" in r) {
      // A cancel is the user's own doing, so there is nothing to report.
      if (!r.cancelled) Alert.alert("Couldn't read card", r.error);
      return;
    }
    if (r.uid !== stored) {
      Alert.alert("Different card", "That isn't your registered focus card.");
      return;
    }
    try {
      await (mode === "start" ? onStart() : onEnd());
    } catch (e: any) {
      Alert.alert("TapIn couldn't lock apps", e?.message ?? "Please try again.");
    }
  };

  const cancelScan = () => void cancelCardRead();

  if (active) {
    const elapsed = startedAt ? Math.max(0, Math.floor((now - startedAt) / 1000)) : 0;
    const waiting = scanning === "end";
    return (
      <Screen tinted>
        <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
          <Text style={{ color: colors.accent, fontWeight: "600", letterSpacing: 0.3 }}>
            {waiting ? "READY TO SCAN" : "FOCUS SESSION ACTIVE"}
          </Text>
        </View>

        <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
          <Text
            style={{
              color: colors.text,
              fontSize: 56,
              fontVariant: ["tabular-nums"],
              fontWeight: "600",
              letterSpacing: 1,
            }}
          >
            {fmt(elapsed)}
          </Text>
          <View style={{ height: space(1) }} />
          <Body dim>{blockCount} apps blocked</Body>
        </View>

        <Body dim>
          {waiting
            ? "Hold your card to the back of your phone."
            : "Press End session, then tap your card."}
        </Body>
        <View style={{ height: space(1.5) }} />
        {waiting ? (
          <>
            <PrimaryButton label="Waiting for card…" onPress={() => {}} disabled />
            <GhostButton label="Cancel" onPress={cancelScan} />
          </>
        ) : (
          <>
            <PrimaryButton label="End session" onPress={() => beginScan("end")} />
            <GhostButton label="Card lost? Emergency unlock" onPress={() => nav("emergency")} />
          </>
        )}
      </Screen>
    );
  }

  const waiting = scanning === "start";

  return (
    <Screen>
      <ScrollView
        contentContainerStyle={{ flexGrow: 1 }}
        showsVerticalScrollIndicator={false}
      >
      <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
        <Title>TapIn</Title>
        <View style={[styles.streakPill, { backgroundColor: colors.accentWash }]}>
          <LockKeyhole size={17} color={colors.accent} strokeWidth={2.3} />
          <Text style={{ color: colors.text, fontSize: 14, fontWeight: "600" }}>
            {stats.streak} {stats.streak === 1 ? "day" : "days"}
          </Text>
        </View>
      </View>

      <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
        <TapRipple active={waiting} />
        <View style={{ height: space(3) }} />
        <Text style={{ color: waiting ? colors.accent : colors.text, fontSize: 20, fontWeight: "600" }}>
          {waiting ? "Ready to scan" : "Press TapIn to begin"}
        </Text>
        <View style={{ height: space(0.5) }} />
        <Body dim>
          {waiting
            ? "Hold your card to the back of your phone."
            : `Then tap your card. ${blockCount} apps will be locked.`}
        </Body>
      </View>

      <Text style={[styles.sectionLabel, { color: colors.textDim }]}>TODAY&apos;S FOCUS</Text>
      <View style={styles.metricsRow}>
        <FocusMetric icon={Timer} label="Focused" value={human(stats.seconds)} />
        <FocusMetric icon={Repeat2} label="Sessions" value={String(stats.count)} />
      </View>

      {waiting ? (
        <>
          <PrimaryButton label="Waiting for card…" onPress={() => {}} disabled />
          <GhostButton label="Cancel" onPress={cancelScan} />
        </>
      ) : (
        <PrimaryButton label="TapIn" onPress={() => beginScan("start")} />
      )}
      </ScrollView>
    </Screen>
  );
}

/** One cell in the stats row. Numbers use tabular figures so they don't jitter. */
function FocusMetric({ icon: Icon, label, value }: { icon: LucideIcon; label: string; value: string }) {
  const { colors } = useTheme();
  return (
    <View style={[styles.metricCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
      <View style={styles.metricHeader}>
        <Icon size={18} color={colors.accent} strokeWidth={2.2} />
        <Text style={{ color: colors.textDim, fontSize: 13 }}>{label}</Text>
      </View>
      <Text style={[styles.metricValue, { color: colors.text }]}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  streakPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: space(0.75),
    borderRadius: 999,
    paddingHorizontal: space(1.25),
    paddingVertical: space(0.75),
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
    marginBottom: space(2),
  },
  metricCard: {
    flex: 1,
    minHeight: 94,
    justifyContent: "space-between",
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 14,
    padding: space(1.75),
  },
  metricHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: space(0.75),
  },
  metricValue: {
    fontSize: 25,
    fontWeight: "600",
    fontVariant: ["tabular-nums"],
    letterSpacing: -0.4,
  },
});
