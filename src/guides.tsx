import { useCallback, useEffect, useState } from "react";
import { Modal, Pressable, ScrollView, StyleSheet, View } from "react-native";
import type { LucideIcon } from "lucide-react-native";
import BookOpenCheck from "lucide-react-native/icons/book-open-check";
import ChartNoAxesCombined from "lucide-react-native/icons/chart-no-axes-combined";
import CircleQuestionMark from "lucide-react-native/icons/circle-question-mark";
import Flame from "lucide-react-native/icons/flame";
import Hourglass from "lucide-react-native/icons/hourglass";
import House from "lucide-react-native/icons/house";
import Layers from "lucide-react-native/icons/layers";
import ListChecks from "lucide-react-native/icons/list-checks";
import Nfc from "lucide-react-native/icons/nfc";
import Palette from "lucide-react-native/icons/palette";
import ScanLine from "lucide-react-native/icons/scan-line";
import Search from "lucide-react-native/icons/search";
import ShieldAlert from "lucide-react-native/icons/shield-alert";
import ShieldCheck from "lucide-react-native/icons/shield-check";
import SlidersHorizontal from "lucide-react-native/icons/sliders-horizontal";
import Timer from "lucide-react-native/icons/timer";
import ToggleRight from "lucide-react-native/icons/toggle-right";
import TrendingDown from "lucide-react-native/icons/trending-down";
import { PrimaryButton } from "./components";
import { hasSeenGuide, markGuideSeen } from "./store";
import { radius, space, useTheme } from "./theme";
import { Text } from "./typography";

export type GuideKey = "home" | "insights" | "blocklist" | "settings";

type GuideStep = { icon: LucideIcon; title: string; body: string };
type Guide = {
  icon: LucideIcon;
  title: string;
  intro: string;
  steps: GuideStep[];
};

/**
 * What each tab says the first time it is opened. Written as one description
 * rather than a coach-mark tour: each screen is a single page, so pointing at
 * every control in turn would cost more taps than reading about all of them at
 * once, and a spotlight would have to chase layouts that change with the
 * session state.
 */
export const GUIDES: Record<GuideKey, Guide> = {
  home: {
    icon: House,
    title: "This is Home",
    intro: "Home is where a focus session starts, runs, and ends.",
    steps: [
      {
        icon: Nfc,
        title: "The circle starts a session",
        body:
          "Tap the circle, or the round button in the middle of the tab bar, then hold your TockIn card against the back of your phone. Your chosen apps lock the moment the card is read.",
      },
      {
        icon: ShieldAlert,
        title: "Card not to hand?",
        body:
          "While TockIn is waiting for a card, a Start without card option appears underneath. It asks you to confirm first, because your card is still the only thing that will unlock the apps afterwards.",
      },
      {
        icon: Timer,
        title: "Only the card ends it",
        body:
          "While a session runs, the circle becomes a timer and the middle button turns into a red X. Press that, then tap your card to unlock. However the session started, a card is what finishes it.",
      },
      {
        icon: Flame,
        title: "The pill is your streak",
        body: "It counts the days in a row you have tapped in at least once.",
      },
      {
        icon: BookOpenCheck,
        title: "StudIn swaps the bottom half",
        body:
          "With StudIn on in Settings, the day's totals give way to your study, break and rounds schedule, and the next card tap starts that timed cycle instead.",
      },
    ],
  },
  insights: {
    icon: ChartNoAxesCombined,
    title: "This is Insights",
    intro: "Insights shows where your time actually went, on the phone and inside TockIn.",
    steps: [
      {
        icon: Layers,
        title: "Pick the period first",
        body:
          "Today, Yesterday, or the last 7 days. Everything below those buttons follows whichever one is selected.",
      },
      {
        icon: Timer,
        title: "TockedIn time is yours",
        body:
          "The first card counts the time you spent inside focus sessions, and how many you ran. Screen time, further down, is what your phone recorded for each app.",
      },
      {
        icon: Hourglass,
        title: "One line, two series",
        body:
          "On the 7 day view a single chart draws your week. The buttons inside it swap the line between TockedIn time and screen time, so you can hold one against the other without scrolling.",
      },
      {
        icon: TrendingDown,
        title: "Screen saved is the point",
        body:
          "Under the total, TockIn compares the period you picked with your own usual day and shows the gap. It also splits your days into the ones you tapped in and the ones you did not, so you can see whether it is working.",
      },
    ],
  },
  blocklist: {
    icon: ListChecks,
    title: "This is your Blocklist",
    intro: "The blocklist decides which apps disappear while a session is running.",
    steps: [
      {
        icon: ToggleRight,
        title: "Flip a switch to lock an app",
        body:
          "On means the app is closed and shielded during focus. Off means it stays available. Every app you leave alone keeps working as normal.",
      },
      {
        icon: Search,
        title: "Search instead of scrolling",
        body: "Type part of a name to find an app without going through the whole list.",
      },
      {
        icon: ShieldCheck,
        title: "Changes save themselves",
        body:
          "There is no save button. The count on the right always shows how many apps the next session will lock.",
      },
      {
        icon: Nfc,
        title: "Pick at least one app",
        body:
          "A card tap with an empty list has nothing to lock, so TockIn sends you back here before it starts.",
      },
    ],
  },
  settings: {
    icon: SlidersHorizontal,
    title: "This is Settings",
    intro: "Settings is where you shape how TockIn looks and how strict it is.",
    steps: [
      {
        icon: Palette,
        title: "Appearance and mode",
        body:
          "Choose light, dark, or follow the system. Under it, StudIn turns the open-ended session into a timed study and break cycle. Strict Mode, a tighter version of every mode with fewer ways out, is on the way.",
      },
      {
        icon: ScanLine,
        title: "System access and cards",
        body:
          "Check the Android permissions TockIn needs, and add or remove NFC cards. A permission switched off elsewhere shows as Required here.",
      },
      {
        icon: ShieldAlert,
        title: "Emergency unlocks",
        body:
          "A few card-free exits each calendar month, for a card that is lost or not to hand. They need a long press and hold, so they stay a last resort.",
      },
    ],
  },
};

/**
 * Shows a tab's guide the first time it is opened and remembers that it has
 * been shown. `open` brings it back on demand, which is what the help button in
 * each header calls.
 */
export function useScreenGuide(key: GuideKey) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    let current = true;
    // A guide that arrived after the screen was left would be a modal over the
    // wrong tab, so a late read is dropped.
    void hasSeenGuide(key).then((seen) => {
      if (current && !seen) setVisible(true);
    });
    return () => {
      current = false;
    };
  }, [key]);

  const close = useCallback(() => {
    setVisible(false);
    void markGuideSeen(key);
  }, [key]);

  const open = useCallback(() => setVisible(true), []);

  return { visible, open, close };
}

/**
 * The round question mark in a screen's header. Deliberately quiet: the guide
 * has already shown itself once, so this is only the way back to it.
 */
export function GuideButton({ onPress, label }: { onPress: () => void; label: string }) {
  const { colors } = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`How ${label} works`}
      onPress={onPress}
      // Widens the tap target past the outline, which stays small so it cannot
      // compete with the screen's own title.
      hitSlop={10}
      style={({ pressed }) => [
        styles.helpButton,
        { borderColor: colors.border, opacity: pressed ? 0.6 : 1 },
      ]}
    >
      <CircleQuestionMark size={19} color={colors.textDim} strokeWidth={2.1} />
    </Pressable>
  );
}

/** The walkthrough card itself. */
export function GuideSheet({
  guide,
  visible,
  onClose,
}: {
  guide: GuideKey;
  visible: boolean;
  onClose: () => void;
}) {
  const { colors } = useTheme();
  const { icon: Icon, title, intro, steps } = GUIDES[guide];

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      {/* The backdrop, the button and the Android back gesture all dismiss, so
          a first-run user can never be trapped behind the explanation.

          It sits behind the card as a sibling rather than wrapping it. As the
          card's parent it competed with the step list for the gesture: a
          Pressable claims a touch on the way down, so a drag that started on a
          step was taken as a press and the list would not scroll back. A
          sibling never sees those touches, and a tap on the card still misses
          it because the card is drawn on top. */}
      <View style={[styles.scrim, { backgroundColor: colors.scrim }]}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Close"
          style={StyleSheet.absoluteFill}
          onPress={onClose}
        />
        <View style={[styles.sheet, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <View style={[styles.sheetIcon, { backgroundColor: colors.accentWash }]}>
            <Icon size={20} color={colors.accent} strokeWidth={2.1} />
          </View>
          <Text style={[styles.sheetTitle, { color: colors.text }]}>{title}</Text>
          <Text style={[styles.sheetIntro, { color: colors.textDim }]}>{intro}</Text>

          {/* The steps scroll rather than the card growing: on a short screen
              the last one must still be reachable with the button below it.
              The indicator stays visible, because hiding it made a guide that
              scrolls look like one that had simply been cut off. */}
          <ScrollView style={styles.stepScroll} contentContainerStyle={styles.steps}>
            {steps.map((step) => {
              const StepIcon = step.icon;
              return (
                <View key={step.title} style={styles.step}>
                  <View style={[styles.stepIcon, { backgroundColor: colors.accentWash }]}>
                    <StepIcon size={17} color={colors.accent} strokeWidth={2.1} />
                  </View>
                  <View style={styles.stepCopy}>
                    <Text style={[styles.stepTitle, { color: colors.text }]}>{step.title}</Text>
                    <Text style={[styles.stepBody, { color: colors.textDim }]}>{step.body}</Text>
                  </View>
                </View>
              );
            })}
          </ScrollView>

          <View style={styles.action}>
            <PrimaryButton label="Got it" onPress={onClose} />
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  helpButton: {
    width: 34,
    height: 34,
    borderRadius: 999,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: "center",
    justifyContent: "center",
  },
  scrim: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: space(3),
  },
  sheet: {
    width: "100%",
    maxWidth: 360,
    // Leaves the scrim visible at both ends on a small phone, so the card reads
    // as something laid over the screen the user just opened.
    maxHeight: "86%",
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: radius.card,
    padding: space(2.5),
  },
  sheetIcon: {
    width: 40,
    height: 40,
    borderRadius: 13,
    alignItems: "center",
    justifyContent: "center",
  },
  sheetTitle: {
    marginTop: space(1.25),
    fontSize: 20,
    fontWeight: "600",
    letterSpacing: -0.3,
  },
  sheetIntro: {
    marginTop: space(0.5),
    fontSize: 14,
    lineHeight: 21,
  },
  // Bounded so a long guide grows the list rather than the card. flexGrow: 0
  // keeps a short guide from stretching, but on its own it left the steps at
  // their full height inside a card the maxHeight had already clamped, so the
  // overflow ran under the button. Shrinking is what actually hands the
  // leftover height back to the scroll.
  stepScroll: {
    flexGrow: 0,
    flexShrink: 1,
    minHeight: 0,
    marginTop: space(2),
  },
  steps: {
    gap: space(2),
    // Keeps the last step off the button rather than ending flush against it,
    // which read as the two overlapping.
    paddingBottom: space(1),
  },
  step: {
    flexDirection: "row",
    gap: space(1.5),
  },
  stepIcon: {
    width: 32,
    height: 32,
    borderRadius: 11,
    alignItems: "center",
    justifyContent: "center",
  },
  stepCopy: {
    flex: 1,
  },
  stepTitle: {
    fontSize: 15,
    fontWeight: "600",
  },
  stepBody: {
    marginTop: 3,
    fontSize: 13,
    lineHeight: 20,
  },
  action: {
    marginTop: space(2.5),
  },
});
