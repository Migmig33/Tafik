import React, { useEffect, useState } from "react";
import { Alert, Pressable, Text, View } from "react-native";
import { Body, GhostButton, PrimaryButton, Screen, TapRipple, Title } from "../components";
import { Nav } from "../nav";
import { readCardUid } from "../nfc";
import { getCardUid } from "../store";
import { space, useTheme } from "../theme";

function fmt(totalSec: number): string {
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;
  const pad = (n: number) => n.toString().padStart(2, "0");
  return `${pad(h)}:${pad(m)}:${pad(s)}`;
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
  onStart: () => void;
  onEnd: () => void;
}) {
  const { colors } = useTheme();
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    if (!active) return;
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [active]);

  const tapCard = async (mode: "start" | "end") => {
    const stored = await getCardUid();
    if (!stored) {
      nav("cardSetup");
      return;
    }
    const r = await readCardUid();
    if ("error" in r) {
      Alert.alert("Couldn't read card", r.error);
      return;
    }
    if (r.uid !== stored) {
      Alert.alert("Different card", "That isn't your registered focus card.");
      return;
    }
    mode === "start" ? onStart() : onEnd();
  };

  if (active) {
    const elapsed = startedAt ? Math.max(0, Math.floor((now - startedAt) / 1000)) : 0;
    return (
      <Screen tinted>
        <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
          <Text style={{ color: colors.accent, fontWeight: "600", letterSpacing: 0.3 }}>
            FOCUS SESSION ACTIVE
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

        <Body dim>Tap your card to end the session.</Body>
        <View style={{ height: space(1.5) }} />
        <PrimaryButton label="Tap card to end" onPress={() => tapCard("end")} />
      </Screen>
    );
  }

  return (
    <Screen>
      <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
        <Title>Focus Card</Title>
        <Pressable onPress={() => nav("blocklist")} hitSlop={12}>
          <Text style={{ color: colors.textDim, fontSize: 15 }}>Settings</Text>
        </Pressable>
      </View>

      <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
        <TapRipple />
        <View style={{ height: space(3) }} />
        <Text style={{ color: colors.text, fontSize: 20, fontWeight: "600" }}>
          Tap your card to start
        </Text>
        <View style={{ height: space(0.5) }} />
        <Body dim>{blockCount} apps will be blocked</Body>
      </View>

      <PrimaryButton label="Tap card to start" onPress={() => tapCard("start")} />
      <View style={{ height: space(0.5) }} />
      <GhostButton label="Edit blocklist" onPress={() => nav("blocklist")} />

      {/* Dev-only shortcut to preview the block overlay without the native engine. */}
      <GhostButton label="▸ Preview block overlay (dev)" onPress={() => nav("blockOverlay")} />
    </Screen>
  );
}
