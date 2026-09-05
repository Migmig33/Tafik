import { useCallback, useEffect, useRef, useState } from "react";
import {
  Alert,
  Animated,
  AppState,
  Easing,
  Linking,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
} from "react-native";
import Accessibility from "lucide-react-native/icons/accessibility";
import Bell from "lucide-react-native/icons/bell";
import BookOpenCheck from "lucide-react-native/icons/book-open-check";
import FileText from "lucide-react-native/icons/file-text";
import ChevronRight from "lucide-react-native/icons/chevron-right";
import CircleQuestionMark from "lucide-react-native/icons/circle-question-mark";
import Layers from "lucide-react-native/icons/layers";
import LockKeyhole from "lucide-react-native/icons/lock-keyhole";
import MessageSquareQuote from "lucide-react-native/icons/message-square-quote";
import Mail from "lucide-react-native/icons/mail";
import Monitor from "lucide-react-native/icons/monitor";
import Moon from "lucide-react-native/icons/moon";
import ScanLine from "lucide-react-native/icons/scan-line";
import ShieldAlert from "lucide-react-native/icons/shield-alert";
import ShieldCheck from "lucide-react-native/icons/shield-check";
import Star from "lucide-react-native/icons/star";
import Sun from "lucide-react-native/icons/sun";
import UserRound from "lucide-react-native/icons/user-round";
import type { LucideIcon } from "lucide-react-native";
import { AccessibilityDisclosure, UsageAccessDisclosure } from "../AccessDisclosures";
import {
  hasAccessibilityAccess,
  hasOverlayPermission,
  hasUsageAccess,
} from "../blocking";
import { Body, InfoSheet, Screen, Title } from "../components";
import { GuideButton, GuideSheet, useScreenGuide } from "../guides";
import {
  EMERGENCY_HOLD_SECONDS,
  EMERGENCY_UNLOCKS_PER_MONTH,
  emergencyDaysUntilReset,
  emergencyResetLabel,
  type FocusMode,
  getEmergencyUnlocksLeft,
  getFocusMode,
  getShieldMessage,
  resetGuides,
  setFocusMode,
  setShieldMessage,
  SHIELD_MESSAGE_MAX_LENGTH,
} from "../store";
import { radius, space, ThemeMode, useTheme } from "../theme";
import { Text, TextInput } from "../typography";

// Empty until TockIn is published. Filling this in is all that is needed to
// make the rate row open its store listing.
const PLAY_STORE_URL = "";

/**
 * Who to write to. Kept next to the store URL because both are the app's
 * outward-facing contact details, and both belong in one place when they
 * change. This address is also the one named in the privacy policy.
 */
const DEVELOPER_NAME = "KupDevs";
const DEVELOPER_EMAIL = "kupdevs@gmail.com";

/** The two outbound links, and what to say while there is nowhere to go yet. */
type AboutLink = {
  key: "privacy" | "rate";
  title: string;
  detail: string;
  url: string;
  icon: LucideIcon;
  /** Shown in the sheet the row opens while its URL is still empty. */
  pending: string;
};

const aboutLinks: AboutLink[] = [
  {
    key: "privacy",
    title: "Privacy policy",
    detail: "How TockIn handles data and permissions.",
    url: "",
    icon: FileText,
    pending: "",
  },
  {
    key: "rate",
    title: "Rate TockIn",
    detail: "Leave a review on Google Play.",
    url: PLAY_STORE_URL,
    icon: Star,
    pending:
      "TockIn is not on Google Play yet. Once it is published this row will open " +
      "its store listing so you can leave a review.",
  },
];

/** What the shield says when the user has not written their own line. */
const DEFAULT_SHIELD_MESSAGE =
  "This app will close.";

type AccessState = { usage: boolean; accessibility: boolean; overlay: boolean };

export default function SettingsScreen({
  onManageCards,
  onOpenPrivacy,
  onModeChange,
}: {
  onManageCards: () => void;
  onOpenPrivacy: () => void;
  /** Lets the shell repaint the tab bar's centre action as the switch slides,
      rather than only once the user navigates away from Settings. */
  onModeChange?: (mode: FocusMode) => void;
}) {
  const { colors, mode, setMode } = useTheme();
  const guide = useScreenGuide("settings");
  // Only for the row that replays them: the tick is a confirmation that the
  // press did something, since the other tabs are where the effect shows up.
  const [guidesReset, setGuidesReset] = useState(false);
  const [access, setAccess] = useState<AccessState>({
    usage: false,
    accessibility: false,
    overlay: false,
  });
  const [emergencyLeft, setEmergencyLeft] = useState<number | null>(null);
  const [shieldDraft, setShieldDraft] = useState("");
  const [focusMode, setFocusModeState] = useState<FocusMode>("tockin");
  // The row only has room for a summary, so the rest of the explanation lives
  // in a sheet the row opens.
  const [emergencyInfoOpen, setEmergencyInfoOpen] = useState(false);
  // Which outbound link the user pressed before it had somewhere to go.
  const [pendingLink, setPendingLink] = useState<AboutLink | null>(null);
  const [usageDisclosureOpen, setUsageDisclosureOpen] = useState(false);
  const [accessibilityDisclosureOpen, setAccessibilityDisclosureOpen] = useState(false);
  const [developerOpen, setDeveloperOpen] = useState(false);

  useEffect(() => {
    getShieldMessage().then(setShieldDraft);
    getFocusMode().then(setFocusModeState);
  }, []);

  const chooseMode = (next: FocusMode) => {
    setFocusModeState(next);
    onModeChange?.(next);
    void setFocusMode(next);
  };

  // Saved on the way out of the field rather than on every keystroke: each save
  // crosses the native bridge, and the shield only needs the finished sentence.
  const commitShieldMessage = () => {
    setShieldMessage(shieldDraft).then(setShieldDraft);
  };

  const refresh = useCallback(async () => {
    const [usage, accessibility, overlay, left] = await Promise.all([
      hasUsageAccess(),
      hasAccessibilityAccess(),
      hasOverlayPermission(),
      getEmergencyUnlocksLeft(),
    ]);
    setAccess({ usage, accessibility, overlay });
    setEmergencyLeft(left);
  }, []);

  useEffect(() => {
    refresh();
    const subscription = AppState.addEventListener("change", (state) => {
      if (state === "active") refresh();
    });
    return () => subscription.remove();
  }, [refresh]);

  const resetsIn = emergencyDaysUntilReset();
  const appearance: { value: ThemeMode; label: string; icon: LucideIcon }[] = [
    { value: "system", label: "System", icon: Monitor },
    { value: "light", label: "Light", icon: Sun },
    { value: "dark", label: "Dark", icon: Moon },
  ];
  const studInOn = focusMode === "studin";
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
      onPress: () => setUsageDisclosureOpen(true),
    },
    {
      title: "Accessibility",
      detail: "Immediate blocked-app redirect",
      status: access.accessibility ? "Allowed" : "Required",
      icon: Accessibility,
      onPress: () => setAccessibilityDisclosureOpen(true),
    },
    {
      title: "Display over apps",
      detail: "Shield distracting apps during focus",
      status: access.overlay ? "Allowed" : "Required",
      icon: Layers,
      onPress: () => void Linking.sendIntent("android.settings.action.MANAGE_OVERLAY_PERMISSION"),
    },
    {
      title: "TockIn cards",
      detail: "Add or remove your NFC keys",
      status: "Open",
      icon: ScanLine,
      onPress: onManageCards,
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
        <View style={styles.header}>
          <Title>Settings</Title>
          <GuideButton label="Settings" onPress={guide.open} />
        </View>
        <View style={{ height: space(0.75) }} />
        <Body dim>Make TockIn feel right for you.</Body>

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

        <Text style={[styles.sectionLabel, { color: colors.textDim }]}>MODE</Text>
        <View style={[styles.systemCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <Pressable
            accessibilityRole="switch"
            accessibilityState={{ checked: studInOn }}
            accessibilityLabel="StudIn mode"
            onPress={() => chooseMode(studInOn ? "tockin" : "studin")}
            style={({ pressed }) => [styles.row, { opacity: pressed ? 0.68 : 1 }]}
          >
            <View style={[styles.iconBox, { backgroundColor: colors.accentWash }]}>
              <BookOpenCheck size={20} color={colors.accent} strokeWidth={2.1} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[styles.rowTitle, { color: colors.text }]}>StudIn</Text>
              <Text style={[styles.rowDetail, { color: colors.textDim }]}>
                Timed study rounds with automatic breaks.
              </Text>
            </View>
            <ModeSwitch on={studInOn} />
          </Pressable>

          {/* Announced, not offered. It carries no switch so the row cannot
              promise a mode that is not built yet. */}
          <View
            style={[
              styles.row,
              { borderTopWidth: StyleSheet.hairlineWidth, borderColor: colors.border },
            ]}
          >
            <View
              style={[
                styles.iconBox,
                styles.pendingIconBox,
                { backgroundColor: colors.bg, borderColor: colors.border },
              ]}
            >
              <LockKeyhole size={20} color={colors.textDim} strokeWidth={2.1} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[styles.rowTitle, { color: colors.textDim }]}>LockIn</Text>
              <Text style={[styles.rowDetail, { color: colors.textDim }]}>
                A stricter session that resists being switched off.
              </Text>
            </View>
            <Text style={[styles.rowStatus, { color: colors.textDim }]}>Coming soon</Text>
          </View>
        </View>
        <Text style={[styles.modeNote, { color: colors.textDim }]}>
          {studInOn
            ? "Your card starts a timed study cycle. Set the schedule on home, and end a cycle early by tapping your card during a break."
            : "Your card starts an open session that stays locked until you tap the card again."}
        </Text>

        <Text style={[styles.sectionLabel, { color: colors.textDim }]}>SHIELD MESSAGE</Text>
        <View style={[styles.systemCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <View style={styles.shieldBody}>
            <View style={styles.shieldHeader}>
              <View style={[styles.iconBox, { backgroundColor: colors.accentWash }]}>
                <MessageSquareQuote size={20} color={colors.accent} strokeWidth={2.1} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[styles.rowTitle, { color: colors.text }]}>
                  Your words on the shield
                </Text>
                <Text style={[styles.rowDetail, { color: colors.textDim }]}>
                  Shown when a locked app is opened. Leave it empty for TockIn&apos;s own line.
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
            <Text style={{ color: colors.textDim, fontSize: 12, textAlign: "right" }}>
              {shieldDraft.length} / {SHIELD_MESSAGE_MAX_LENGTH}
            </Text>
          </View>
        </View>

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
                  <Text style={[styles.rowTitle, { color: colors.text }]}>{row.title}</Text>
                  <Text style={[styles.rowDetail, { color: colors.textDim }]}>{row.detail}</Text>
                </View>
                <Text style={[styles.rowStatus, { color: allowed ? colors.accent : colors.textDim }]}>
                  {row.status}
                </Text>
                <ChevronRight size={17} color={colors.textDim} />
              </Pressable>
            );
          })}
        </View>

        <Text style={[styles.sectionLabel, { color: colors.textDim }]}>EMERGENCY ACCESS</Text>
        <View style={[styles.systemCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Emergency unlocks"
            onPress={() => setEmergencyInfoOpen(true)}
            style={({ pressed }) => [styles.row, { opacity: pressed ? 0.68 : 1 }]}
          >
            <View style={[styles.iconBox, { backgroundColor: colors.accentWash }]}>
              <ShieldAlert size={20} color={colors.accent} strokeWidth={2.1} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[styles.rowTitle, { color: colors.text }]}>Emergency unlocks</Text>
              <Text style={[styles.rowDetail, { color: colors.textDim }]}>
                Unlock without your card.
              </Text>
            </View>
            <Text style={[styles.rowStatus, { color: colors.accent }]}>
              {emergencyLeft === null ? "—" : `${emergencyLeft} left`}
            </Text>
          </Pressable>
        </View>
        <Text style={[styles.sectionLabel, { color: colors.textDim }]}>ABOUT</Text>
        <View style={[styles.systemCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          {aboutLinks.map((link, index) => {
            const Icon = link.icon;
            const ready = link.key === "privacy" || link.url.length > 0;
            return (
              <Pressable
                key={link.key}
                accessibilityRole="link"
                accessibilityLabel={link.title}
                onPress={() => {
                  if (link.key === "privacy") {
                    onOpenPrivacy();
                    return;
                  }
                  // Nothing to open yet, so say so rather than failing silently.
                  if (!ready) {
                    setPendingLink(link);
                    return;
                  }
                  Linking.openURL(link.url).catch(() => setPendingLink(link));
                }}
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
                  <Text style={[styles.rowTitle, { color: colors.text }]}>{link.title}</Text>
                  <Text style={[styles.rowDetail, { color: colors.textDim }]}>{link.detail}</Text>
                </View>
                <ChevronRight size={17} color={colors.textDim} />
              </Pressable>
            );
          })}

          {/* TockIn asks for the three most invasive permissions Android has, so
              a name and a way to reach it is a trust signal rather than a
              credit. An anonymous app with this permission set reads as
              something to uninstall. */}
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="About the developer"
            onPress={() => setDeveloperOpen(true)}
            style={({ pressed }) => [
              styles.row,
              { borderTopWidth: StyleSheet.hairlineWidth, borderColor: colors.border },
              { opacity: pressed ? 0.68 : 1 },
            ]}
          >
            <View style={[styles.iconBox, { backgroundColor: colors.accentWash }]}>
              <UserRound size={20} color={colors.accent} strokeWidth={2.1} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[styles.rowTitle, { color: colors.text }]}>Developer</Text>
              <Text style={[styles.rowDetail, { color: colors.textDim }]}>
                Who made TockIn, and how to get in touch.
              </Text>
            </View>
            <ChevronRight size={17} color={colors.textDim} />
          </Pressable>

          {/* Sits with the links rather than in its own section: it is a thing
              to read again, not a setting that changes how TockIn behaves. */}
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Show the tab guides again"
            onPress={() => {
              void resetGuides();
              setGuidesReset(true);
            }}
            style={({ pressed }) => [
              styles.row,
              { borderTopWidth: StyleSheet.hairlineWidth, borderColor: colors.border },
              { opacity: pressed ? 0.68 : 1 },
            ]}
          >
            <View style={[styles.iconBox, { backgroundColor: colors.accentWash }]}>
              <CircleQuestionMark size={20} color={colors.accent} strokeWidth={2.1} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[styles.rowTitle, { color: colors.text }]}>Show tips again</Text>
              <Text style={[styles.rowDetail, { color: colors.textDim }]}>
                {guidesReset ? "Each tab will explain itself again." : "Replay the guide on every tab."}
              </Text>
            </View>
            <Text style={[styles.rowStatus, { color: colors.accent }]}>
              {guidesReset ? "Ready" : "Replay"}
            </Text>
          </Pressable>
        </View>
      </ScrollView>

      <GuideSheet guide="settings" visible={guide.visible} onClose={guide.close} />

      <InfoSheet
        visible={pendingLink !== null}
        onClose={() => setPendingLink(null)}
        icon={pendingLink?.icon ?? FileText}
        title={pendingLink?.title ?? ""}
        body={pendingLink?.pending ?? ""}
        muted
      />

      <InfoSheet
        visible={developerOpen}
        onClose={() => setDeveloperOpen(false)}
        icon={UserRound}
        title={DEVELOPER_NAME}
        // First person and plainly written on purpose. This is the one place in
        // the app that is meant to sound like a person rather than a product.
        body={
          "KupDevs is the solo software studio behind TockIn. TockIn was built by a 4th year " +
          "student from Adamson University who wanted to make focusing simpler. Instead of " +
          "relying on willpower, you just tap. Your distracting apps lock, and they stay locked " +
          "until you tap again."
        }
      >
        <Text style={[styles.thanks, { color: colors.textDim }]}>
          Thank you for supporting TockIn. Your purchase goes straight to an independent student
          developer and makes continued improvements possible.
        </Text>

        {/* A tappable address rather than text to copy out by hand, since the
            whole point of the row is that reaching a person is easy. */}
        <Pressable
          accessibilityRole="link"
          accessibilityLabel={`Email ${DEVELOPER_EMAIL}`}
          onPress={() => {
            Linking.openURL(`mailto:${DEVELOPER_EMAIL}`).catch(() =>
              Alert.alert("No mail app", `Write to ${DEVELOPER_EMAIL} from any email app.`)
            );
          }}
          style={({ pressed }) => [
            styles.contactRow,
            { borderColor: colors.border, opacity: pressed ? 0.65 : 1 },
          ]}
        >
          <Mail size={17} color={colors.accent} strokeWidth={2.1} />
          <Text style={{ color: colors.text, fontSize: 14, fontWeight: "500" }}>
            {DEVELOPER_EMAIL}
          </Text>
        </Pressable>
      </InfoSheet>

      <InfoSheet
        visible={emergencyInfoOpen}
        onClose={() => setEmergencyInfoOpen(false)}
        icon={ShieldAlert}
        title="Emergency unlocks"
        body={
          `Lost your card? Hold the unlock on the session screen for ${EMERGENCY_HOLD_SECONDS} ` +
          "seconds and every locked app opens straight away. The long hold is the safeguard, so " +
          "an emergency unlock can never happen by reflex."
        }
      >
        <View style={[styles.sheetStats, { borderColor: colors.border }]}>
          <SheetStat
            label="Remaining this month"
            value={
              emergencyLeft === null
                ? "—"
                : `${emergencyLeft} of ${EMERGENCY_UNLOCKS_PER_MONTH}`
            }
          />
          <SheetStat label="Resets in" value={resetsIn === 1 ? "1 day" : `${resetsIn} days`} />
          <SheetStat label="Refills on" value={emergencyResetLabel()} />
        </View>
      </InfoSheet>

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

const SWITCH_WIDTH = 46;
const SWITCH_HEIGHT = 28;
const SWITCH_PADDING = 3;
const SWITCH_KNOB = SWITCH_HEIGHT - SWITCH_PADDING * 2;

/**
 * The mode switch. It slides rather than simply recolouring, because the two
 * modes are exclusive: seeing the knob travel is what says the other one just
 * turned off. Colour is animated alongside the position, so this drives layout
 * values and cannot run on the native driver.
 */
function ModeSwitch({ on }: { on: boolean }) {
  const { colors } = useTheme();
  const progress = useRef(new Animated.Value(on ? 1 : 0)).current;

  useEffect(() => {
    Animated.timing(progress, {
      toValue: on ? 1 : 0,
      duration: 190,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: false,
    }).start();
  }, [on, progress]);

  const translateX = progress.interpolate({
    inputRange: [0, 1],
    outputRange: [0, SWITCH_WIDTH - SWITCH_KNOB - SWITCH_PADDING * 2],
  });
  const trackColor = progress.interpolate({
    inputRange: [0, 1],
    outputRange: [colors.border, colors.accent],
  });
  // The knob has to stay legible on both track colours, in both themes.
  const knobColor = progress.interpolate({
    inputRange: [0, 1],
    outputRange: [colors.textDim, colors.onAccent],
  });

  return (
    <Animated.View style={[styles.switchTrack, { backgroundColor: trackColor }]}>
      <Animated.View
        style={[styles.switchKnob, { backgroundColor: knobColor, transform: [{ translateX }] }]}
      />
    </Animated.View>
  );
}

/** One "label ..... value" line inside the emergency sheet. */
function SheetStat({ label, value }: { label: string; value: string }) {
  const { colors } = useTheme();
  return (
    <View style={styles.sheetStatRow}>
      <Text style={{ color: colors.textDim, fontSize: 13 }}>{label}</Text>
      <Text style={{ color: colors.text, fontSize: 13, fontWeight: "600" }}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: space(1.5),
  },
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
    paddingHorizontal: space(2),
    borderWidth: 1,
    borderRadius: 14,
  },
  // Title and description are a pair, so they are tuned as one. Android pads
  // every Text with the font's own ascent and descent, which stacked up with
  // the margin to leave a visible gap between the two lines; dropping that
  // padding closes it without touching the 1.5 line-height inside each block.
  rowTitle: {
    fontSize: 15,
    fontWeight: "600",
    lineHeight: 20,
    includeFontPadding: false,
  },
  rowDetail: {
    fontSize: 12,
    marginTop: 1,
    lineHeight: 18,
    includeFontPadding: false,
  },
  rowStatus: {
    fontSize: 12,
    fontWeight: "500",
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
  // Sits between the bio and the contact row, so the thanks lands before the
  // one thing on the sheet that asks the reader to do something.
  thanks: {
    fontSize: 13,
    lineHeight: 20,
    textAlign: "center",
    marginBottom: space(1.5),
  },
  contactRow: {
    minHeight: 48,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: space(1),
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: radius.input,
    paddingHorizontal: space(1.5),
  },
  pendingIconBox: {
    borderWidth: StyleSheet.hairlineWidth,
  },
  switchTrack: {
    width: SWITCH_WIDTH,
    height: SWITCH_HEIGHT,
    borderRadius: SWITCH_HEIGHT / 2,
    padding: SWITCH_PADDING,
    justifyContent: "center",
  },
  switchKnob: {
    width: SWITCH_KNOB,
    height: SWITCH_KNOB,
    borderRadius: SWITCH_KNOB / 2,
  },
  modeNote: {
    fontSize: 12,
    lineHeight: 18,
    marginTop: space(1),
  },
  sheetStats: {
    gap: space(0.75),
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingTop: space(1.25),
  },
  sheetStatRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: space(1),
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
