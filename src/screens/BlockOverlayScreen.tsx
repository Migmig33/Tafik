import React from "react";
import { StyleSheet, Text, View } from "react-native";
import { Body, GhostButton, PrimaryButton } from "../components";
import { BlockedApp, Nav } from "../nav";
import { readCardUid } from "../nfc";
import { getCardUid } from "../store";
import { space, useTheme } from "../theme";

// In the real build this UI is drawn by the native overlay (a SYSTEM_ALERT_WINDOW
// from the foreground service) when a blocked app comes to the foreground — not a
// React screen. This React version exists so you can design and preview it.
export default function BlockOverlayScreen({
  nav,
  app,
  onUnlock,
}: {
  nav: Nav;
  app: BlockedApp;
  onUnlock: () => void;
}) {
  const { colors } = useTheme();

  const tapToUnlock = async () => {
    const stored = await getCardUid();
    if (!stored) {
      onUnlock();
      return;
    }
    const r = await readCardUid();
    if ("error" in r) return;
    if (r.uid === stored) onUnlock();
  };

  return (
    <View style={[styles.wrap, { backgroundColor: colors.accentWash }]}>
      <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        <Text style={{ color: colors.accent, fontWeight: "600", letterSpacing: 0.3, fontSize: 13 }}>
          FOCUS SESSION
        </Text>
        <View style={{ height: space(2) }} />
        <Text style={{ color: colors.text, fontSize: 24, fontWeight: "600" }}>{app.name}</Text>
        <View style={{ height: space(1) }} />
        <Body dim>You're in a focus session. This app is paused until you tap your card.</Body>
        <View style={{ height: space(4) }} />
        <PrimaryButton label="Tap your card to unlock" onPress={tapToUnlock} />
        <View style={{ height: space(0.5) }} />
        <GhostButton label="Stay focused" onPress={() => nav("home")} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, alignItems: "center", justifyContent: "center", padding: space(3) },
  card: {
    width: "100%",
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    padding: space(3),
    // The one place we allow a soft shadow — to lift the shield above the app.
    shadowColor: "#000",
    shadowOpacity: 0.18,
    shadowRadius: 24,
    shadowOffset: { width: 0, height: 8 },
    elevation: 12,
  },
});
