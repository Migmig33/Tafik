import React, { useCallback, useEffect, useState } from "react";
import { AppState, Linking, Pressable, ScrollView, StyleSheet, View } from "react-native";
import Bell from "lucide-react-native/icons/bell";
import ChevronRight from "lucide-react-native/icons/chevron-right";
import Layers from "lucide-react-native/icons/layers";
import Lock from "lucide-react-native/icons/lock";
import MessageSquareQuote from "lucide-react-native/icons/message-square-quote";
import Monitor from "lucide-react-native/icons/monitor";
import Moon from "lucide-react-native/icons/moon";
import ScanLine from "lucide-react-native/icons/scan-line";
import ShieldAlert from "lucide-react-native/icons/shield-alert";
import ShieldCheck from "lucide-react-native/icons/shield-check";
import Sun from "lucide-react-native/icons/sun";
import type { LucideIcon } from "lucide-react-native";
import { hasOverlayPermission, hasUsageAccess } from "../blocking";
import { Body, Screen, Title } from "../components";
import { usePremium } from "../premium";
import {
  EMERGENCY_HOLD_SECONDS,
  EMERGENCY_UNLOCKS_PER_MONTH,
  emergencyResetLabel,
  getEmergencyUnlocksLeft,
  getShieldMessage,
  setShieldMessage,
  SHIELD_MESSAGE_MAX_LENGTH,
} from "../store";
import { radius, space, ThemeMode, useTheme } from "../theme";
import { Text, TextInput } from "../typography";

/** What the shield says when the user has not written their own line. */
const DEFAULT_SHIELD_MESSAGE =
  "This app is locked by TapIn while your focus session is active.";

type AccessState = { usage: boolean; overlay: boolean };

export default function SettingsScreen({ onUnlock }: { onUnlock: () => void }) {
  const { colors, mode, setMode } = useTheme();
  const { isPremium, ready: premiumReady } = usePremium();
  const [access, setAccess] = useState<AccessState>({ usage: false, overlay: false });
  const [emergencyLeft, setEmergencyLeft] = useState<number | null>(null);
  const [shieldDraft, setShieldDraft] = useState("");

  useEffect(() => {
    getShieldMessage().then(setShieldDraft);
  }, []);

  // Saved on the way out of the field rather than on every keystroke: each save
  // crosses the native bridge, and the shield only needs the finished sentence.
  const commitShieldMessage = () => {
    setShieldMessage(shieldDraft).then(setShieldDraft);
  };

  const refresh = useCallback(async () => {
    const [usage, overlay, left] = await Promise.all([
      hasUsageAccess(),
      hasOverlayPermission(),
      getEmergencyUnlocksLeft(),
    ]);
    setAccess({ usage, overlay });
    setEmergencyLeft(left);
  }, []);

  useEffect(() => {
    refresh();
    const subscription = AppState.addEventListener("change", (state) => {
      if (state === "active") refresh();
    });
    return () => subscription.remove();
  }, [refresh]);

  const appearance: { value: ThemeMode; label: string; icon: LucideIcon }[] = [
    { value: "system", label: "System", icon: Monitor },
    { value: "light", label: "Light", icon: Sun },
    { value: "dark", label: "Dark", icon: Moon },
  ];
  const rows: {
    title: string;
    detail: string;
    status: string;
    icon: LucideIcon;
    onPress: () => void;
  }[] = [
    {
      title: "Usage access",
      detail: "Screen time and app detection",
      status: access.usage ? "Allowed" : "Required",
      icon: ShieldCheck,
      onPress: () => void Linking.sendIntent("android.settings.USAGE_ACCESS_SETTINGS"),
    },
    {
      title: "Display over apps",
      detail: "Shield distracting apps during focus",
      status: access.overlay ? "Allowed" : "Required",
      icon: Layers,
      onPress: () => void Linking.sendIntent("android.settings.action.MANAGE_OVERLAY_PERMISSION"),
    },
    {
      title: "NFC",
      detail: "Configure your TapIn card",
      status: "Open",
      icon: ScanLine,
      onPress: () => void Linking.sendIntent("android.settings.NFC_SETTINGS"),
    },
    {
      title: "App settings",
      detail: "Notifications, permissions, and battery",
      status: "Open",
      icon: Bell,
      onPress: () => void Linking.openSettings(),
    },
  ];

  return (
    <Screen>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: space(2) }}>
        <Title>Settings</Title>
        <View style={{ height: space(0.75) }} />
        <Body dim>Make TapIn feel right for you.</Body>

        <Text style={[styles.sectionLabel, { color: colors.textDim }]}>APPEARANCE</Text>
        <View style={[styles.appearanceCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          {appearance.map((option) => {
            const selected = mode === option.value;
            const Icon = option.icon;
            return (
              <Pressable
                key={option.value}
                onPress={() => setMode(option.value)}
                style={[
                  styles.appearanceOption,
                  {
                    backgroundColor: selected ? colors.accentWash : "transparent",
                    borderColor: selected ? colors.accent : "transparent",
                  },
                ]}
              >
                <Icon size={20} color={selected ? colors.accent : colors.textDim} strokeWidth={2.1} />
                <Text style={{ color: selected ? colors.accent : colors.textDim, fontSize: 13, fontWeight: "600" }}>
                  {option.label}
                </Text>
              </Pressable>
            );
          })}
        </View>

        <Text style={[styles.sectionLabel, { color: colors.textDim }]}>SHIELD MESSAGE</Text>
        {!premiumReady ? null : isPremium ? (
          <View style={[styles.systemCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <View style={styles.shieldBody}>
              <View style={styles.shieldHeader}>
                <View style={[styles.iconBox, { backgroundColor: colors.accentWash }]}>
                  <MessageSquareQuote size={20} color={colors.accent} strokeWidth={2.1} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={{ color: colors.text, fontSize: 15, fontWeight: "600" }}>
                    Your words on the shield
                  </Text>
                  <Text style={{ color: colors.textDim, fontSize: 12, marginTop: 3, lineHeight: 17 }}>
                    Shown when a locked app is opened. Leave it empty for TapIn&apos;s own line.
                  </Text>
                </View>
              </View>

              <TextInput
                value={shieldDraft}
                onChangeText={setShieldDraft}
                onBlur={commitShieldMessage}
                onSubmitEditing={commitShieldMessage}
                returnKeyType="done"
                multiline
                maxLength={SHIELD_MESSAGE_MAX_LENGTH}
                placeholder={DEFAULT_SHIELD_MESSAGE}
                placeholderTextColor={colors.textDim}
                style={[
                  styles.shieldInput,
                  { color: colors.text, backgroundColor: colors.bg, borderColor: colors.border },
                ]}
              />
              <Text style={{ color: colors.textDim, fontSize: 11, textAlign: "right" }}>
                {shieldDraft.length} / {SHIELD_MESSAGE_MAX_LENGTH}
              </Text>
            </View>
          </View>
        ) : (
          <Pressable
            onPress={onUnlock}
            style={({ pressed }) => [
              styles.systemCard,
              styles.row,
              { backgroundColor: colors.surface, borderColor: colors.border, opacity: pressed ? 0.68 : 1 },
            ]}
          >
            <View style={[styles.iconBox, { backgroundColor: colors.accentWash }]}>
              <MessageSquareQuote size={20} color={colors.accent} strokeWidth={2.1} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={{ color: colors.text, fontSize: 15, fontWeight: "600" }}>
                Your words on the shield
              </Text>
              <Text style={{ color: colors.textDim, fontSize: 12, marginTop: 3, lineHeight: 17 }}>
                Write what a locked app should say back to you. Premium.
              </Text>
            </View>
            <Lock size={17} color={colors.textDim} strokeWidth={2.2} />
          </Pressable>
        )}

        <Text style={[styles.sectionLabel, { color: colors.textDim }]}>SYSTEM ACCESS</Text>
        <View style={[styles.systemCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          {rows.map((row, index) => {
            const Icon = row.icon;
            const allowed = row.status === "Allowed";
            return (
              <Pressable
                key={row.title}
                onPress={row.onPress}
                style={({ pressed }) => [
                  styles.row,
                  index > 0 && { borderTopWidth: StyleSheet.hairlineWidth, borderColor: colors.border },
                  { opacity: pressed ? 0.68 : 1 },
                ]}
              >
                <View style={[styles.iconBox, { backgroundColor: colors.accentWash }]}>
                  <Icon size={20} color={colors.accent} strokeWidth={2.1} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={{ color: colors.text, fontSize: 15, fontWeight: "600" }}>{row.title}</Text>
                  <Text style={{ color: colors.textDim, fontSize: 12, marginTop: 3 }}>{row.detail}</Text>
                </View>
                <Text style={{ color: allowed ? colors.accent : colors.textDim, fontSize: 12, fontWeight: "600" }}>
                  {row.status}
                </Text>
                <ChevronRight size={17} color={colors.textDim} />
              </Pressable>
            );
          })}
        </View>

        <Text style={[styles.sectionLabel, { color: colors.textDim }]}>EMERGENCY ACCESS</Text>
        <View style={[styles.systemCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <View style={styles.row}>
            <View style={[styles.iconBox, { backgroundColor: colors.accentWash }]}>
              <ShieldAlert size={20} color={colors.accent} strokeWidth={2.1} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={{ color: colors.text, fontSize: 15, fontWeight: "600" }}>Emergency unlocks</Text>
              <Text style={{ color: colors.textDim, fontSize: 12, marginTop: 3, lineHeight: 17 }}>
                Lost your card? Hold the unlock on the session screen for {EMERGENCY_HOLD_SECONDS}s.
                Resets to {EMERGENCY_UNLOCKS_PER_MONTH} on {emergencyResetLabel()}.
              </Text>
            </View>
            <Text style={{ color: colors.accent, fontSize: 12, fontWeight: "600" }}>
              {emergencyLeft === null ? "—" : `${emergencyLeft} left`}
            </Text>
          </View>
        </View>
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  sectionLabel: {
    fontSize: 11,
    fontWeight: "600",
    letterSpacing: 0.9,
    marginTop: space(3.5),
    marginBottom: space(1.25),
  },
  appearanceCard: {
    flexDirection: "row",
    gap: space(1),
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: radius.card,
    padding: space(1),
  },
  appearanceOption: {
    flex: 1,
    minHeight: 76,
    alignItems: "center",
    justifyContent: "center",
    gap: space(0.75),
    borderWidth: 1,
    borderRadius: 14,
  },
  systemCard: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: radius.card,
    overflow: "hidden",
  },
  row: {
    minHeight: 74,
    flexDirection: "row",
    alignItems: "center",
    gap: space(1.25),
    paddingHorizontal: space(1.5),
  },
  iconBox: {
    width: 40,
    height: 40,
    borderRadius: 13,
    alignItems: "center",
    justifyContent: "center",
  },
  shieldBody: {
    gap: space(1.25),
    padding: space(1.5),
  },
  shieldHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: space(1.25),
  },
  shieldInput: {
    minHeight: 76,
    fontSize: 14,
    lineHeight: 20,
    textAlignVertical: "top",
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: radius.input,
    paddingHorizontal: space(1.5),
    paddingVertical: space(1.25),
  },
});
