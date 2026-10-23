import { useCallback, useEffect, useState } from "react";
import { Modal, Pressable, ScrollView, StyleSheet, View } from "react-native";
import type { LucideIcon } from "lucide-react-native";
import BookOpenCheck from "lucide-react-native/icons/book-open-check";
import ChartNoAxesCombined from "lucide-react-native/icons/chart-no-axes-combined";
import Flame from "lucide-react-native/icons/flame";
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
import { radius, space, colors, typeScale } from "./theme";
import { ScrollEdgeFade, useScrollEdge } from "./scrollEdge";
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
        title: "The middle button starts a session",
        body:
          "Press the round button in the middle of the tab bar. It opens the card screen and waits for your Tafik card. Hold the card against the back of your phone, and your chosen apps lock the moment it is read.",
      },
      {
        icon: ShieldAlert,
        title: "Card not to hand?",
        body:
          "While Tafik is waiting for a card on the card screen, a Start without card option appears underneath. It asks you to confirm first. The session still ends with your card, and emergency unlocks are the only other way out.",
      },
      {
        icon: Timer,
        title: "Only the card ends it",
        body:
          "While a session runs, the middle button turns into an X. Press it, then tap your card to end the session. Emergency Exit is the only other way out.",
      },
      {
        icon: Flame,
        title: "The pill is your streak",
        body: "Each day with at least one focus session adds to it. Miss a day and it starts again.",
      },
      {
        icon: BookOpenCheck,
        title: "Cycle swaps the bottom half",
        body:
          "With Cycle on in Settings, the day's totals give way to your study, break and rounds schedule, and the next card tap starts that timed cycle instead.",
      },
    ],
  },
  insights: {
    icon: ChartNoAxesCombined,
    title: "This is Insights",
    intro: "Insights shows where your time actually went, on the phone and inside Tafik.",
    steps: [
      {
        icon: Layers,
        title: "Pick the period first",
        body:
          "Today, Yesterday, or the last 7 days. Everything below those buttons follows whichever one is selected.",
      },
      {
        icon: Timer,
        title: "Tafik time is yours",
        body:
          "Tafik time is the time you spent inside focus sessions. Screen time is what your phone recorded for each app. The chart switches between the two.",
      },
      {
        icon: TrendingDown,
        title: "Screen saved is the point",
        body:
          "Under the total, Tafik compares the period you picked with your own usual day and shows the gap. It also splits your days into the ones you tapped in and the ones you did not, so you can see whether it is working.",
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
          "With no apps chosen, a card tap stops and offers to open the Blocklist instead.",
      },
    ],
  },
  settings: {
    icon: SlidersHorizontal,
    title: "This is Settings",
    intro: "Settings is where you shape how Tafik looks and how strict it is.",
    steps: [
      {
        icon: Palette,
        title: "Mode",
        body:
          "Turn on Light theme to switch from Dark. Cycle turns the open-ended session into a timed study and break cycle. Strict Mode is coming soon and is not available yet.",
      },
      {
        icon: ScanLine,
        title: "System access and cards",
        body:
          "Check the Android permissions Tafik needs, and add or remove NFC cards. A permission switched off elsewhere shows as Required here.",
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
  const edge = useScrollEdge();
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
          <View style={styles.stepScroll}>
            <ScrollView {...edge.scrollProps} style={styles.stepScroll} contentContainerStyle={styles.steps}>
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
            <ScrollEdgeFade visible={edge.visible} bleed={0} />
          </View>

          <View style={styles.action}>
            <PrimaryButton label="Got it" onPress={onClose} />
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
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
    fontSize: typeScale.headline.fontSize,
    fontWeight: "600",
    letterSpacing: -0.3,
  },
  sheetIntro: {
    marginTop: space(0.5),
    fontSize: typeScale.callout.fontSize,
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
    fontSize: typeScale.callout.fontSize,
    fontWeight: "600",
  },
  stepBody: {
    marginTop: 3,
    fontSize: typeScale.footnote.fontSize,
    lineHeight: 20,
  },
  action: {
    marginTop: space(2.5),
  },
});
