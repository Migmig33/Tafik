import React, { useState } from "react";
import { Linking, Pressable, StyleSheet, Text, View } from "react-native";
import { Body, PrimaryButton, Screen, Title } from "../components";
import { Nav } from "../nav";
import { setOnboardingDone } from "../store";
import { space, useTheme } from "../theme";

// The four permissions the app cannot function without. On a real device these
// buttons should deep-link into the correct system settings screen and then
// verify the grant. Deep links below are the standard Android setting intents;
// wire the verification checks in your native module.
const PERMS = [
  {
    key: "usage",
    name: "Usage access",
    why: "So we can tell which app you've opened.",
    settings: "android.settings.USAGE_ACCESS_SETTINGS",
  },
  {
    key: "overlay",
    name: "Display over other apps",
    why: "So we can cover blocked apps during a session.",
    settings: "android.settings.action.MANAGE_OVERLAY_PERMISSION",
  },
  {
    key: "notifications",
    name: "Notifications",
    why: "To keep your session running in the background.",
    settings: "android.settings.APP_NOTIFICATION_SETTINGS",
  },
  {
    key: "nfc",
    name: "NFC",
    why: "To read your focus card when you tap it.",
    settings: "android.settings.NFC_SETTINGS",
  },
] as const;

export default function OnboardingScreen({ nav }: { nav: Nav }) {
  const { colors } = useTheme();
  const [granted, setGranted] = useState<Record<string, boolean>>({});
  const allGranted = PERMS.every((p) => granted[p.key]);

  // NOTE: this optimistically marks a permission granted after the user returns
  // from settings. In the build, replace with a real check before flipping it.
  const grant = async (p: (typeof PERMS)[number]) => {
    try {
      await Linking.sendIntent(p.settings);
    } catch {
      /* some intents need extras; refine per permission in the native layer */
    }
    setGranted((g) => ({ ...g, [p.key]: true }));
  };

  return (
    <Screen>
      <Title>Lock in.</Title>
      <View style={{ height: space(1) }} />
      <Body dim>Tap a card to start a focus session. First, a few permissions.</Body>

      <View style={{ height: space(4) }} />

      <View style={{ gap: space(1.5) }}>
        {PERMS.map((p) => {
          const ok = !!granted[p.key];
          return (
            <View
              key={p.key}
              style={[styles.row, { borderColor: colors.border, backgroundColor: colors.surface }]}
            >
              <View style={{ flex: 1, paddingRight: space(1.5) }}>
                <Text style={{ color: colors.text, fontSize: 15, fontWeight: "600" }}>{p.name}</Text>
                <Text style={{ color: colors.textDim, fontSize: 13, marginTop: 2 }}>{p.why}</Text>
              </View>
              <Pressable
                onPress={() => grant(p)}
                disabled={ok}
                style={{
                  paddingHorizontal: space(2),
                  paddingVertical: space(1),
                  borderRadius: 999,
                  borderWidth: StyleSheet.hairlineWidth,
                  borderColor: ok ? "transparent" : colors.accent,
                }}
              >
                <Text style={{ color: ok ? colors.textDim : colors.accent, fontWeight: "600", fontSize: 14 }}>
                  {ok ? "Granted" : "Grant"}
                </Text>
              </Pressable>
            </View>
          );
        })}
      </View>

      <View style={{ flex: 1 }} />

      <PrimaryButton
        label="Continue"
        disabled={!allGranted}
        onPress={async () => {
          await setOnboardingDone(true);
          nav("home");
        }}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    padding: space(2),
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
  },
});
