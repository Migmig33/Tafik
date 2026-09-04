import Accessibility from "lucide-react-native/icons/accessibility";
import ChartNoAxesCombined from "lucide-react-native/icons/chart-no-axes-combined";
import type { LucideIcon } from "lucide-react-native";
import { Modal, SafeAreaView, ScrollView, StyleSheet, View } from "react-native";
import { GhostButton, PrimaryButton } from "./components";
import { radius, space, useTheme } from "./theme";
import { Text } from "./typography";

type DisclosureControls = {
  visible: boolean;
  onAgree: () => void;
  onDecline: () => void;
};

type AccessDisclosureProps = DisclosureControls & {
  icon: LucideIcon;
  eyebrow: string;
  title: string;
  intro: string;
  items: readonly string[];
  note: string;
};

/**
 * Google Play requires a standalone, affirmative disclosure immediately
 * before a non-accessibility-tool app sends the user to Accessibility Settings.
 * Usage activity is sensitive too, so its system-access route uses the same
 * clear pattern rather than relying on a short permission-row description.
 */
export function AccessibilityDisclosure(controls: DisclosureControls) {
  return (
    <AccessDisclosure
      {...controls}
      icon={Accessibility}
      eyebrow="ACCESSIBILITY DISCLOSURE"
      title="App blocking needs Accessibility"
      intro="TapIn uses Android Accessibility only to enforce the blocklist during focus sessions."
      items={[
        "TapIn reads the package name of the app currently appearing on your screen.",
        "TapIn uses that package name only during an active focus session, including StudIn Study intervals.",
        "If it matches an app you selected to block, TapIn immediately returns your device to Home.",
        "TapIn does not read text, passwords, taps, or any screen content.",
        "This package-name information stays on your phone. TapIn does not upload or share it.",
      ]}
      note="You can choose Not now. Immediate blocked-app redirection will remain unavailable until you enable Accessibility."
    />
  );
}

export function UsageAccessDisclosure(controls: DisclosureControls) {
  return (
    <AccessDisclosure
      {...controls}
      icon={ChartNoAxesCombined}
      eyebrow="USAGE ACCESS DISCLOSURE"
      title="Blocking and Insights need Usage Access"
      intro="TapIn uses Android Usage Access for app blocking and on-device screen-time Insights."
      items={[
        "TapIn reads foreground-app activity, including which app was used and for how long.",
        "During focus sessions, TapIn uses this activity to detect selected blocked apps and show the blocking shield.",
        "Insights processes recent activity on your device to calculate screen-time totals, app usage, charts, and trends.",
        "Your foreground-app activity and screen-time information stay on your phone. TapIn does not upload or share them.",
      ]}
      note="You can choose Not now. App detection and device screen-time Insights will remain unavailable until you enable Usage Access."
    />
  );
}

function AccessDisclosure({
  visible,
  onAgree,
  onDecline,
  icon: Icon,
  eyebrow,
  title,
  intro,
  items,
  note,
}: AccessDisclosureProps) {
  const { colors } = useTheme();

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onDecline}>
      <SafeAreaView style={[styles.screen, { backgroundColor: colors.bg }]}>
        <ScrollView
          contentContainerStyle={styles.content}
          showsVerticalScrollIndicator={false}
        >
          <View style={[styles.icon, { backgroundColor: colors.accentWash }]}>
            <Icon size={28} color={colors.accent} strokeWidth={2} />
          </View>

          <Text style={[styles.eyebrow, { color: colors.textDim }]}>{eyebrow}</Text>
          <Text style={[styles.title, { color: colors.text }]}>{title}</Text>
          <Text style={[styles.intro, { color: colors.textDim }]}>{intro}</Text>

          <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            {items.map((item, index) => (
              <DisclosureItem key={item} last={index === items.length - 1}>
                {item}
              </DisclosureItem>
            ))}
          </View>

          <Text style={[styles.note, { color: colors.textDim }]}>{note}</Text>
        </ScrollView>

        <View style={[styles.actions, { backgroundColor: colors.bg, borderColor: colors.border }]}>
          <PrimaryButton label="Agree and continue" onPress={onAgree} />
          <GhostButton label="Not now" onPress={onDecline} />
        </View>
      </SafeAreaView>
    </Modal>
  );
}

function DisclosureItem({ children, last = false }: { children: string; last?: boolean }) {
  const { colors } = useTheme();

  return (
    <View
      style={[
        styles.item,
        !last && { borderBottomWidth: StyleSheet.hairlineWidth, borderColor: colors.border },
      ]}
    >
      <View style={[styles.dot, { backgroundColor: colors.accent }]} />
      <Text style={[styles.itemText, { color: colors.text }]}>{children}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
  },
  content: {
    flexGrow: 1,
    paddingHorizontal: space(3),
    paddingTop: space(4),
    paddingBottom: space(3),
  },
  icon: {
    width: 56,
    height: 56,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: space(3),
  },
  eyebrow: {
    fontSize: 12,
    fontWeight: "700",
    letterSpacing: 1.1,
    marginBottom: space(1),
  },
  title: {
    fontSize: 28,
    lineHeight: 34,
    fontWeight: "700",
    letterSpacing: -0.5,
  },
  intro: {
    fontSize: 15,
    lineHeight: 22,
    marginTop: space(1.5),
  },
  card: {
    borderRadius: radius.card,
    borderWidth: StyleSheet.hairlineWidth,
    marginTop: space(3),
    overflow: "hidden",
  },
  item: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: space(1.5),
    padding: space(2),
  },
  dot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    marginTop: 7,
  },
  itemText: {
    flex: 1,
    fontSize: 14,
    lineHeight: 21,
  },
  note: {
    fontSize: 13,
    lineHeight: 19,
    marginTop: space(2),
  },
  actions: {
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: space(3),
    paddingTop: space(2),
    paddingBottom: space(1),
    gap: space(0.25),
  },
});
