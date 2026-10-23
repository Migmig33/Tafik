import { Children, Fragment, useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { LayoutAnimation } from "react-native";
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
import Mail from "lucide-react-native/icons/mail";
import ScanLine from "lucide-react-native/icons/scan-line";
import ShieldAlert from "lucide-react-native/icons/shield-alert";
import ShieldCheck from "lucide-react-native/icons/shield-check";
import Star from "lucide-react-native/icons/star";
import UserRound from "lucide-react-native/icons/user-round";
import type { LucideIcon } from "lucide-react-native";
import { AccessibilityDisclosure, UsageAccessDisclosure } from "../AccessDisclosures";
import {
  hasAccessibilityAccess,
  hasOverlayPermission,
  hasUsageAccess,
  needsRestrictedSettingHelp,
} from "../blocking";
import { Body, InfoSheet, Screen, Title } from "../components";
import { GuideSheet, type GuideKey, useScreenGuide } from "../guides";
import {
  EMERGENCY_HOLD_SECONDS,
  EMERGENCY_UNLOCKS_PER_MONTH,
  emergencyDaysUntilReset,
  emergencyResetLabel,
  type FocusMode,
  getEmergencyUnlocksLeft,
  getFocusMode,
  setFocusMode,
} from "../store";
import { chooseThemeMode, colors, radius, space, typeScale, useThemeMode } from "../theme";
import Moon from "lucide-react-native/icons/moon";
import Sun from "lucide-react-native/icons/sun";
import { ScrollEdgeFade, useScrollEdge } from "../scrollEdge";
import { NAV_CLEARANCE } from "../tabBar";
import { Text } from "../typography";

// Empty until Tafik is published. Filling this in is all that is needed to
// make the rate row open its store listing.
const PLAY_STORE_URL = "";

/**
 * Who to write to. Kept next to the store URL because both are the app's
 * outward-facing contact details, and both belong in one place when they
 * change. This address is also the one named in the privacy policy.
 */
const DEVELOPER_NAME = "KupDevs";
const DEVELOPER_EMAIL = "kupdevs@gmail.com";

/** The outbound links in About, and what to say while there is nowhere to go yet. */
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
    detail: "How Tafik handles data and permissions.",
    url: "",
    icon: FileText,
    pending: "",
  },
  {
    key: "rate",
    title: "Rate Tafik",
    detail: "Leave a review on Google Play.",
    url: PLAY_STORE_URL,
    icon: Star,
    pending:
      "Tafik is not on Google Play yet. Once it is published this row will open " +
      "its store listing so you can leave a review.",
  },
];

type AccessState = { usage: boolean; accessibility: boolean; overlay: boolean };

const TIP_SCREENS: { key: GuideKey; label: string }[] = [
  { key: "home", label: "Home" },
  { key: "insights", label: "Insights" },
  { key: "blocklist", label: "Blocklist" },
  { key: "settings", label: "Settings" },
];

// The icon tile and the text beside it share one left edge on every row, and the
// group's separators start where that text starts, so the lines read as belonging to the text.
const ICON_TILE = 36;
const ROW_GAP = space(1.25);
const ROW_PADDING = space(1.5);
const SEPARATOR_INSET = ROW_PADDING + ICON_TILE + ROW_GAP;

export default function SettingsScreen({
  onManageCards,
  onOpenPrivacy,
  onModeChange,
  onPreviewOnboarding,
}: {
  onManageCards: () => void;
  onOpenPrivacy: () => void;
  /** Lets the shell repaint the tab bar's centre action as the switch slides,
      rather than only once the user navigates away from Settings. */
  onModeChange?: (mode: FocusMode) => void;
  // TEMPORARY: opens the onboarding preview. Remove with the row below.
  onPreviewOnboarding?: () => void;
}) {
  const edge = useScrollEdge();
  const guide = useScreenGuide("settings");
  const themeMode = useThemeMode();
  // Only for the row that replays them: the tick is a confirmation that the
  // press did something, since the other tabs are where the effect shows up.
  const [tipsOpen, setTipsOpen] = useState(false);
  const [tipsGuide, setTipsGuide] = useState<GuideKey | null>(null);
  const [access, setAccess] = useState<AccessState>({
    usage: false,
    accessibility: false,
    overlay: false,
  });
  const [emergencyLeft, setEmergencyLeft] = useState<number | null>(null);
  const [focusMode, setFocusModeState] = useState<FocusMode>("tafik");
  // The row only has room for a summary, so the rest of the explanation lives
  // in a sheet the row opens.
  const [emergencyInfoOpen, setEmergencyInfoOpen] = useState(false);
  // Which outbound link the user pressed before it had somewhere to go.
  const [pendingLink, setPendingLink] = useState<AboutLink | null>(null);
  const [usageDisclosureOpen, setUsageDisclosureOpen] = useState(false);
  const [accessibilityDisclosureOpen, setAccessibilityDisclosureOpen] = useState(false);
  const [developerOpen, setDeveloperOpen] = useState(false);
  const [restrictedSettingHelp, setRestrictedSettingHelp] = useState(false);

  useEffect(() => {
    getFocusMode().then(setFocusModeState);
  }, []);

  const chooseMode = (next: FocusMode) => {
    setFocusModeState(next);
    onModeChange?.(next);
    void setFocusMode(next);
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

  // Who installed the app cannot change while it is running, so unlike the
  // permissions above this is read once instead of on every resume.
  useEffect(() => {
    needsRestrictedSettingHelp().then(setRestrictedSettingHelp);
  }, []);

  const resetsIn = emergencyDaysUntilReset();
  const cycleOn = focusMode === "cycle";
  const lightOn = themeMode === "light";

  return (
    <Screen>
      <View style={{ flex: 1 }}>
        <ScrollView {...edge.scrollProps} showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: space(2) }}>
          <View style={styles.intro}>
            <Title>Settings</Title>
            <Body dim>Make Tafik feel right for you.</Body>
          </View>

          <SectionHeading>Appearance</SectionHeading>
          <SettingGroup>
            <SettingRow
              icon={lightOn ? Sun : Moon}
              title="Light theme"
              detail="Off uses the dark theme."
              role="switch"
              label="Light theme"
              checked={lightOn}
              onPress={() => chooseThemeMode(lightOn ? "dark" : "light")}
              trailing={<ToggleSwitch on={lightOn} />}
            />
          </SettingGroup>

          <SectionHeading>Focus</SectionHeading>
          <SettingGroup>
            <SettingRow
              icon={BookOpenCheck}
              title="Cycle"
              detail="Timed study rounds with automatic breaks."
              role="switch"
              label="Cycle mode"
              checked={cycleOn}
              onPress={() => chooseMode(cycleOn ? "tafik" : "cycle")}
              trailing={<ToggleSwitch on={cycleOn} />}
            />
            {/* Announced, not offered. It has no switch, so the row cannot
                promise a mode that is not built yet. */}
            <SettingRow
              icon={LockKeyhole}
              title="Strict Mode"
              detail="A stricter version of every mode."
              dimmed
              trailing={<Status>Coming soon</Status>}
            />
            <SettingRow
              icon={ScanLine}
              title="Tafik cards"
              detail="Add or remove your NFC keys."
              onPress={onManageCards}
              trailing={<Chevron />}
            />
            <SettingRow
              icon={ShieldAlert}
              title="Emergency unlocks"
              detail="Unlock without your card."
              label="Emergency unlocks"
              onPress={() => setEmergencyInfoOpen(true)}
              trailing={
                <>
                  <Status accent>{emergencyLeft === null ? "—" : `${emergencyLeft} left`}</Status>
                  <Chevron />
                </>
              }
            />
          </SettingGroup>
          <Text style={[styles.note, { color: colors.textDim }]}>
            {cycleOn
              ? "Your card starts a timed study cycle. Set the schedule on home, and end a cycle early by tapping your card during a break."
              : "Your card starts an open session that stays locked until you tap the card again."}
          </Text>

          <SectionHeading>Permissions</SectionHeading>
          <SettingGroup>
            <SettingRow
              icon={ShieldCheck}
              title="Usage access"
              detail="Screen time and app detection."
              onPress={() => setUsageDisclosureOpen(true)}
              trailing={
                <>
                  <Status accent={access.usage}>{access.usage ? "Allowed" : "Required"}</Status>
                  <Chevron />
                </>
              }
            />
            <SettingRow
              icon={Accessibility}
              title="Accessibility"
              detail="Immediate blocked-app redirect."
              onPress={() => setAccessibilityDisclosureOpen(true)}
              trailing={
                <>
                  <Status accent={access.accessibility}>{access.accessibility ? "Allowed" : "Required"}</Status>
                  <Chevron />
                </>
              }
            />
            <SettingRow
              icon={Layers}
              title="Display over apps"
              detail="Shield distracting apps during focus."
              onPress={() => void Linking.sendIntent("android.settings.action.MANAGE_OVERLAY_PERMISSION")}
              trailing={
                <>
                  <Status accent={access.overlay}>{access.overlay ? "Allowed" : "Required"}</Status>
                  <Chevron />
                </>
              }
            />
            <SettingRow
              icon={Bell}
              title="App settings"
              detail="Notifications, permissions, and battery."
              onPress={() => void Linking.openSettings()}
              trailing={<Chevron />}
            />
          </SettingGroup>

          <SectionHeading>Help</SectionHeading>
          <SettingGroup>
            {/* Tips opens the short notes that each screen used to show behind its
                own question mark. Setup itself is onboarding, not a separate tutorial. */}
            <Fragment>
              <SettingRow
                icon={CircleQuestionMark}
                title="Tips"
                detail="Short notes on each screen, whenever you need them."
                label="Tips"
                expanded={tipsOpen}
                onPress={() => {
                  LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
                  setTipsOpen((open) => !open);
                }}
                trailing={<Chevron open={tipsOpen} />}
              />
              {tipsOpen ? (
                <View style={styles.tipList}>
                  {TIP_SCREENS.map((item) => (
                    <Pressable
                      key={item.key}
                      accessibilityRole="button"
                      accessibilityLabel={`${item.label} tips`}
                      onPress={() => setTipsGuide(item.key)}
                      style={({ pressed }) => [styles.tipRow, { opacity: pressed ? 0.68 : 1 }]}
                    >
                      <Text style={[styles.tipLabel, { color: colors.text }]}>{item.label}</Text>
                      <Chevron />
                    </Pressable>
                  ))}
                </View>
              ) : null}
            </Fragment>
          </SettingGroup>

          <SectionHeading>About</SectionHeading>
          <SettingGroup>
            {aboutLinks.map((link) => (
              <SettingRow
                key={link.key}
                icon={link.icon}
                title={link.title}
                detail={link.detail}
                role="link"
                label={link.title}
                onPress={() => {
                  if (link.key === "privacy") {
                    onOpenPrivacy();
                    return;
                  }
                  // Nothing to open yet, so say so rather than failing silently.
                  if (link.url.length === 0) {
                    setPendingLink(link);
                    return;
                  }
                  Linking.openURL(link.url).catch(() => setPendingLink(link));
                }}
                trailing={<Chevron />}
              />
            ))}

            {/* Tafik asks for the three most invasive permissions Android has, so
                a name and a way to reach it is a trust signal rather than a
                credit. An anonymous app with this permission set reads as
                something to uninstall. */}
            <SettingRow
              icon={UserRound}
              title="Developer"
              detail="Who made Tafik, and how to get in touch."
              label="About the developer"
              onPress={() => setDeveloperOpen(true)}
              trailing={<Chevron />}
            />

            {/* TEMPORARY: testing only. Remove this row, the onPreviewOnboarding prop, and the preview wiring in App.tsx and OnboardingScreen.tsx. */}
            <SettingRow
              icon={Layers}
              title="Preview onboarding"
              detail="Temporary. Walks the first-launch steps. Nothing is changed."
              label="Preview onboarding"
              onPress={() => onPreviewOnboarding?.()}
              trailing={<Chevron />}
            />
          </SettingGroup>
          <View style={{ height: NAV_CLEARANCE }} />
        </ScrollView>
        <ScrollEdgeFade visible={edge.visible} />
      </View>

      <GuideSheet guide="settings" visible={guide.visible} onClose={guide.close} />
      <GuideSheet
        guide={tipsGuide ?? "settings"}
        visible={tipsGuide !== null}
        onClose={() => setTipsGuide(null)}
      />

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
          "KupDevs is the solo software studio behind Tafik. Tafik was built by a 4th year " +
          "student from Adamson University who wanted to make focusing simpler. Instead of " +
          "relying on willpower, you just tap. Your distracting apps lock, and they stay locked " +
          "until you tap again."
        }
      >
        <Text style={[styles.thanks, { color: colors.textDim }]}>
          Thank you for supporting Tafik. Your purchase goes straight to an independent student
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
          <Text style={{ color: colors.text, fontSize: typeScale.callout.fontSize, fontWeight: "500" }}>
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
        restrictedSettingHelp={restrictedSettingHelp}
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

/** A section heading. Sentence case at the footnote size, quiet but clearly above its group. */
function SectionHeading({ children }: { children: string }) {
  return <Text style={[styles.sectionLabel, { color: colors.textDim }]}>{children}</Text>;
}

/**
 * A grouped surface holding related rows. Rows are separated by a hairline that starts
 * at the text, so the group reads as one list rather than a stack of boxes.
 */
function SettingGroup({ children }: { children: ReactNode }) {
  const items = Children.toArray(children);
  return (
    <View style={[styles.group, { backgroundColor: colors.surface, borderColor: colors.border }]}>
      {items.map((item, index) => (
        <Fragment key={index}>
          {index > 0 ? <View style={[styles.separator, { backgroundColor: colors.border }]} /> : null}
          {item}
        </Fragment>
      ))}
    </View>
  );
}

/**
 * One setting: an icon tile, a title with an optional description, and a trailing
 * control. A row with `onPress` is tappable; a row without one only shows its state.
 */
function SettingRow({
  icon: Icon,
  title,
  detail,
  trailing,
  onPress,
  dimmed = false,
  role = "button",
  label,
  checked,
  expanded,
}: {
  icon: LucideIcon;
  title: string;
  detail?: string;
  trailing?: ReactNode;
  onPress?: () => void;
  /** A row that is announced but not available yet. */
  dimmed?: boolean;
  role?: "button" | "switch" | "link";
  label?: string;
  checked?: boolean;
  expanded?: boolean;
}) {
  const content = (
    <>
      <View
        style={[
          styles.iconTile,
          dimmed
            ? { backgroundColor: colors.bg, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.border }
            : { backgroundColor: colors.accentWash },
        ]}
      >
        <Icon size={20} color={dimmed ? colors.textDim : colors.accent} strokeWidth={2.1} />
      </View>
      <View style={styles.rowText}>
        <Text style={[styles.rowTitle, { color: dimmed ? colors.textDim : colors.text }]}>{title}</Text>
        {detail ? <Text style={[styles.rowDetail, { color: colors.textDim }]}>{detail}</Text> : null}
      </View>
      {trailing ? <View style={styles.trailing}>{trailing}</View> : null}
    </>
  );

  if (!onPress) return <View style={styles.row}>{content}</View>;

  return (
    <Pressable
      accessibilityRole={role}
      accessibilityLabel={label ?? title}
      accessibilityState={{
        ...(role === "switch" ? { checked } : {}),
        ...(expanded !== undefined ? { expanded } : {}),
      }}
      onPress={onPress}
      style={({ pressed }) => [styles.row, { opacity: pressed ? 0.68 : 1 }]}
    >
      {content}
    </Pressable>
  );
}

/** The chevron that marks a row as opening something. Rotated when the row expands in place. */
function Chevron({ open = false }: { open?: boolean }) {
  return (
    <View style={{ transform: [{ rotate: open ? "90deg" : "0deg" }] }}>
      <ChevronRight size={18} color={colors.textDim} strokeWidth={2} />
    </View>
  );
}

/** A short value shown before the chevron: a state, or a count. */
function Status({ children, accent = false }: { children: string; accent?: boolean }) {
  return (
    <Text style={[styles.rowStatus, { color: accent ? colors.accent : colors.textDim }]}>{children}</Text>
  );
}

const SWITCH_WIDTH = 46;
const SWITCH_HEIGHT = 28;
const SWITCH_PADDING = 3;
const SWITCH_KNOB = SWITCH_HEIGHT - SWITCH_PADDING * 2;

/**
 * The one switch used for every toggle in Settings. It slides rather than simply recolouring,
 * because seeing the knob travel is what shows a change of state. Colour is animated alongside
 * the position, so this drives layout values and cannot run on the native driver.
 */
function ToggleSwitch({ on }: { on: boolean }) {
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
  // The knob has to stay legible on both track colours.
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
  return (
    <View style={styles.sheetStatRow}>
      <Text style={{ color: colors.textDim, fontSize: typeScale.footnote.fontSize }}>{label}</Text>
      <Text style={{ color: colors.text, fontSize: typeScale.footnote.fontSize, fontWeight: "600" }}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  intro: {
    gap: space(0.75),
  },
  // Section headings are sentence case at the footnote size: quiet, but clearly a heading above
  // its group, with no tracking or capitals to fight the rows beneath.
  sectionLabel: {
    ...typeScale.footnote,
    fontWeight: "600",
    marginTop: space(3),
    marginBottom: space(1),
  },
  group: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: radius.card,
    overflow: "hidden",
  },
  separator: {
    height: StyleSheet.hairlineWidth,
    marginLeft: SEPARATOR_INSET,
  },
  // Every row is the same height, so a one-line row and a two-line row sit on the same rhythm.
  row: {
    minHeight: 64,
    flexDirection: "row",
    alignItems: "center",
    gap: ROW_GAP,
    paddingHorizontal: ROW_PADDING,
    paddingVertical: space(1.25),
  },
  iconTile: {
    width: ICON_TILE,
    height: ICON_TILE,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  // Title and description are a pair, so they are tuned as one. Android pads every Text with
  // the font's own ascent and descent, which stacked up with the margin to leave a visible gap
  // between the two lines; dropping that padding closes it without touching the line-height.
  // minWidth lets long text wrap inside the row instead of pushing the trailing control off-edge.
  rowText: {
    flex: 1,
    minWidth: 0,
  },
  rowTitle: {
    fontSize: typeScale.callout.fontSize,
    fontWeight: "600",
    lineHeight: 20,
    includeFontPadding: false,
  },
  rowDetail: {
    fontSize: typeScale.footnote.fontSize,
    marginTop: 1,
    lineHeight: 18,
    includeFontPadding: false,
  },
  // Every trailing control sits in the same slot, at the same right edge, so switches and chevrons line up.
  trailing: {
    flexDirection: "row",
    alignItems: "center",
    gap: space(1),
    flexShrink: 0,
  },
  rowStatus: {
    fontSize: typeScale.footnote.fontSize,
    fontWeight: "500",
  },
  tipList: {
    paddingLeft: SEPARATOR_INSET,
    paddingRight: ROW_PADDING,
    paddingBottom: space(1),
  },
  tipRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    minHeight: 44,
  },
  tipLabel: {
    ...typeScale.callout,
    fontWeight: "600",
  },
  // Under the Focus group: what the Cycle switch changes, in the same footnote voice as the rows.
  note: {
    fontSize: typeScale.footnote.fontSize,
    lineHeight: 18,
    marginTop: space(1),
  },
  // Sits between the bio and the contact row, so the thanks lands before the
  // one thing on the sheet that asks the reader to do something.
  thanks: {
    fontSize: typeScale.footnote.fontSize,
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
});
