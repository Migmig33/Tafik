import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Alert,
  AppState,
  Linking,
  PermissionsAndroid,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
} from "react-native";
import { AccessibilityDisclosure, UsageAccessDisclosure } from "../AccessDisclosures";
import {
  hasAccessibilityAccess,
  hasAccessibilityServiceSupport,
  hasOverlayPermission,
  hasUsageAccess,
} from "../blocking";
import { Body, PrimaryButton, Screen, Title } from "../components";
import { Nav } from "../nav";
import { isNfcReady } from "../nfc";
import { setOnboardingDone } from "../store";
import { space, useTheme } from "../theme";
import { Text } from "../typography";

// POST_NOTIFICATIONS is a runtime permission only on Android 13 (API 33) and
// up. Below that it is granted at install time, so there is nothing to ask for.
const NEEDS_NOTIFICATION_PROMPT =
  Platform.OS === "android" && Number(Platform.Version) >= 33;

async function hasNotificationPermission(): Promise<boolean> {
  if (!NEEDS_NOTIFICATION_PROMPT) return true;
  try {
    return await PermissionsAndroid.check(
      PermissionsAndroid.PERMISSIONS.POST_NOTIFICATIONS
    );
  } catch {
    return false;
  }
}

type PermKey = "usage" | "accessibility" | "overlay" | "notifications" | "nfc";

const PERMS: {
  key: PermKey;
  name: string;
  why: string;
}[] = [
  {
    key: "usage",
    name: "Usage access",
    why: "So TockIn can tell which app is on screen.",
  },
  {
    key: "accessibility",
    name: "Accessibility",
    why: "So blocked apps are closed immediately when opened.",
  },
  {
    key: "overlay",
    name: "Display over other apps",
    why: "So TockIn can cover blocked apps during a session.",
  },
  {
    key: "notifications",
    name: "Notifications",
    why: "To keep your session running in the background.",
  },
  {
    key: "nfc",
    name: "NFC",
    why: "To read your TockIn card when you tap it.",
  },
];

export default function OnboardingScreen({ nav }: { nav: Nav }) {
  const { colors } = useTheme();
  const [usageDisclosureOpen, setUsageDisclosureOpen] = useState(false);
  const [accessibilityDisclosureOpen, setAccessibilityDisclosureOpen] = useState(false);
  const [granted, setGranted] = useState<Record<PermKey, boolean>>({
    usage: false,
    accessibility: false,
    overlay: false,
    notifications: false,
    nfc: false,
  });
  // Listing a permission the installed binary cannot grant would leave
  // Continue disabled for good, so an old APK running new JavaScript drops the
  // Accessibility row instead of dead-ending on it.
  const perms = useMemo(
    () => PERMS.filter((p) => p.key !== "accessibility" || hasAccessibilityServiceSupport()),
    []
  );
  const allGranted = perms.every((p) => granted[p.key]);

  // Every permission here is granted outside the app, so the only honest way to
  // know is to re-read the real state each time the user comes back to us.
  const refresh = useCallback(async () => {
    const [usage, accessibility, overlay, notifications, nfc] = await Promise.all([
      hasUsageAccess(),
      hasAccessibilityAccess(),
      hasOverlayPermission(),
      hasNotificationPermission(),
      isNfcReady(),
    ]);
    setGranted({ usage, accessibility, overlay, notifications, nfc });
  }, []);

  useEffect(() => {
    refresh();
    const subscription = AppState.addEventListener("change", (state) => {
      if (state === "active") refresh();
    });
    return () => subscription.remove();
  }, [refresh]);

  const grant = async (key: PermKey) => {
    try {
      if (key === "notifications") {
        if (NEEDS_NOTIFICATION_PROMPT) {
          const result = await PermissionsAndroid.request(
            PermissionsAndroid.PERMISSIONS.POST_NOTIFICATIONS
          );
          // "Never ask again" means the dialog will not appear again, so send
          // the user somewhere they can still say yes.
          if (result === PermissionsAndroid.RESULTS.NEVER_ASK_AGAIN) {
            await Linking.openSettings();
          }
        }
      } else if (key === "usage") {
        setUsageDisclosureOpen(true);
        return;
      } else if (key === "accessibility") {
        if (!hasAccessibilityServiceSupport()) {
          Alert.alert(
            "Native rebuild required",
            "This installed TockIn build does not contain the app-blocking Accessibility service yet. Install a newly built APK; Expo Start cannot add native Android services."
          );
          return;
        }
        setAccessibilityDisclosureOpen(true);
        return;
      } else if (key === "overlay") {
        await Linking.sendIntent("android.settings.action.MANAGE_OVERLAY_PERMISSION");
      } else {
        await Linking.sendIntent("android.settings.NFC_SETTINGS");
      }
    } catch {
      // If the settings screen cannot be opened directly, the app's own
      // settings page is always reachable and gets the user to the same place.
      try {
        await Linking.openSettings();
      } catch {
        /* nothing more we can do from here */
      }
    }
    // Never assume the grant succeeded: re-read it.
    await refresh();
  };

  return (
    <Screen>
      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        <Title>Lock in.</Title>
        <View style={{ height: space(1) }} />
        <Body dim>Tap a card to start a focus session. First, a few permissions.</Body>

        <View style={{ height: space(4) }} />

        <View style={{ gap: space(1.5) }}>
          {perms.map((p) => {
            const ok = granted[p.key];
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
                  onPress={() => grant(p.key)}
                  disabled={ok}
                  accessibilityRole="button"
                  accessibilityState={{ disabled: ok }}
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

        <View style={{ flex: 1, minHeight: space(3) }} />

        {!allGranted && (
          <>
            <Body dim>Grant all of these to continue. TockIn cannot block reliably without them.</Body>
            <View style={{ height: space(1.5) }} />
          </>
        )}

        <PrimaryButton
          label="Continue"
          disabled={!allGranted}
          onPress={async () => {
            await setOnboardingDone(true);
            nav("home");
          }}
        />
      </ScrollView>

      <AccessibilityDisclosure
        visible={accessibilityDisclosureOpen}
        onDecline={() => setAccessibilityDisclosureOpen(false)}
        onAgree={() => {
          setAccessibilityDisclosureOpen(false);
          Linking.sendIntent("android.settings.ACCESSIBILITY_SETTINGS").catch(() =>
            Linking.openSettings()
          );
        }}
      />

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

const styles = StyleSheet.create({
  content: {
    flexGrow: 1,
    paddingBottom: space(1),
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    padding: space(2),
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
  },
});
