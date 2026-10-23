import { useEffect, useRef, useState } from "react";
import * as Haptics from "expo-haptics";
import { StyleSheet, View } from "react-native";
import Check from "lucide-react-native/icons/circle-check";
import type { BlockingSessionState } from "../blocking";
import { AppMark, Body, GhostButton, PrimaryButton, Screen, Title } from "../components";
import CycleDial from "../cycleDial";
import { remainingCycles } from "../cycleCount";
import { useExpoBlur } from "../softBlur";
import EmergencyExitButton from "../emergencyExit";
import { getCycleConfig } from "../store";
import { latestSessionCard, SessionCardFacts, SessionCardModal } from "../sessionCard";
import { colors, space, typeScale } from "../theme";
import { Text } from "../typography";

// The phase whose completion has already been tapped on this device. Module-level, so it survives
// leaving and returning to the screen within the app's process.
let lastHapticPhase: string | null = null;

/**
 * The face of a running cycle. The schedule itself is chosen in
 * Settings, so this screen never configures anything; it reports the phase the
 * native service is in and offers the only two ways out of it.
 */
export default function CycleScreen({
  session,
  completed,
  scanning,
  blockCount,
  onEndWithCard,
  onAdvance,
  onEmergency,
  onDone,
}: {
  session: BlockingSessionState | null;
  completed: boolean;
  scanning: boolean;
  blockCount: number;
  onEndWithCard: () => void;
  /** Moves a waiting phase on: Start Break, Start Next Cycle, or the end of the session. */
  onAdvance: () => void;
  onEmergency: () => void;
  onDone: () => void;
}) {
  const [rounds, setRounds] = useState<number | null>(null);
  // The card for the Tempo session that just completed, read back from storage.
  const [shareable, setShareable] = useState<SessionCardFacts | null>(null);
  const [openCard, setOpenCard] = useState<SessionCardFacts | null>(null);
  // The share editor blurs the completion screen behind it: the content inside this blur target.
  const blurTarget = useRef<View>(null);
  const blur = useExpoBlur();
  const Target = blur?.BlurTargetView ?? View;

  useEffect(() => {
    getCycleConfig().then((saved) => setRounds(saved.rounds));
  }, []);

  useEffect(() => {
    if (completed) void latestSessionCard("cycle").then(setShareable);
  }, [completed]);

  // A haptic tap as each phase runs out, once per phase. The last phase tapped is kept at module
  // level, so leaving and returning to this screen does not replay it.
  useEffect(() => {
    const waiting = session?.active && session.mode === "cycle" && session.awaiting
      ? `${session.phase}:${session.currentRound}`
      : null;
    if (!waiting || lastHapticPhase === waiting) return;
    lastHapticPhase = waiting;
    try {
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    } catch {
      // A build without the haptics module simply has no tap; the notification still sounds.
    }
  }, [session]);

  if (session?.active && session.mode === "cycle" && session.phase) {
    const study = session.phase === "study";
    const remaining = remainingCycles(session);
    const awaiting = session.awaiting === true;
    const finalBreak = !study && session.currentRound >= session.totalRounds;
    const advanceLabel = study ? "Start Break" : finalBreak ? "Finish Session" : "Start Next Cycle";
    // Only the dial and the Emergency Exit. In a Break the dial is also how the card ends the
    // cycle: tapping it reads the card, and it is inert while a read is already open.
    return (
      <Screen>
        <View style={styles.activeColumn}>
          <View style={styles.brandMark}>
            <AppMark height={32} color={colors.text} />
          </View>
          <View style={styles.timerArea}>
            <CycleDial
              phase={session.phase}
              startedAt={session.phaseStartedAt}
              endsAt={session.phaseEndsAt}
              onPress={study || scanning || awaiting ? undefined : onEndWithCard}
            />
            {awaiting ? (
              <View style={styles.advance}>
                <PrimaryButton label={advanceLabel} onPress={onAdvance} />
              </View>
            ) : null}
          </View>
          <View style={styles.emergency}>
            <EmergencyExitButton onPress={onEmergency} />
          </View>
          {/* The cycles still to run: a small label with the number beneath it, at the very bottom. */}
          <View style={styles.cycleCount} accessibilityLabel={`${remaining} ${remaining === 1 ? "cycle" : "cycles"} remaining`}>
            <Text style={[styles.cycleLabel, { color: colors.textDim }]}>Cycle</Text>
            <Text style={[styles.cycleNumber, { color: colors.text }]}>{remaining}</Text>
          </View>
        </View>
      </Screen>
    );
  }

  if (completed) {
    return (
      <Screen>
        <Target ref={blurTarget} style={{ flex: 1 }}>
        <View style={styles.simpleHeader}>
          <Title>Cycle</Title>
        </View>
        <View style={styles.completionArea}>
          <View style={[styles.completionIcon, { backgroundColor: colors.accentWash }]}>
            <Check size={42} color={colors.accent} strokeWidth={1.8} />
          </View>
          <Text style={[styles.completionTitle, { color: colors.text }]}>Study complete</Text>
          <Body dim>
            {/* The saved schedule is the one this cycle ran on, but it arrives a
                frame late, so avoid claiming a round count until it is read. */}
            {rounds === null
              ? "You finished every round. Selected apps are unblocked."
              : `You finished all ${rounds} ${rounds === 1 ? "round" : "rounds"}. Selected apps are unblocked.`}
          </Body>
        </View>
        {shareable ? (
          <GhostButton label="Share session card" onPress={() => setOpenCard(shareable)} />
        ) : null}
        <PrimaryButton label="Done" onPress={onDone} />
        </Target>
        <SessionCardModal facts={openCard} onClose={() => setOpenCard(null)} blurTarget={blurTarget} />
      </Screen>
    );
  }

  // No Cycle is running: after a finished or stopped session, or when the page opens without one.
  // The brand mark anchors the top as it does on the live screen, and the one action leads back
  // to Home, where the centre button starts a new Cycle.
  return (
    <Screen>
      <View style={styles.emptyColumn}>
        <View style={styles.brandMark}>
          <AppMark height={32} color={colors.text} />
        </View>
        <View style={styles.emptyCenter}>
          <Text style={[styles.emptyTitle, { color: colors.text }]}>No Cycle running</Text>
          <Text style={[styles.emptyBody, { color: colors.textDim }]}>
            Start one from Home. Tap the centre button, then hold your card to the phone.
          </Text>
        </View>
        <View style={styles.emptyAction}>
          <PrimaryButton label="Start a Cycle" onPress={onDone} />
        </View>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  simpleHeader: {
    minHeight: 40,
    flexDirection: "row",
    alignItems: "center",
    gap: space(1.25),
  },
  // Copied from home's live session rather than reinvented: the two screens are
  // meant to read as the same thing with a different mark in the circle.
  homeHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: space(1.5),
  },
  streakPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: space(0.75),
    borderRadius: 999,
    paddingHorizontal: space(1.25),
    paddingVertical: space(0.75),
  },
  focusCluster: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  activeFocusContent: {
    alignItems: "center",
  },
  activeTimer: {
    marginTop: space(1),
    ...typeScale.display,
    lineHeight: 54,
    fontVariant: ["tabular-nums"],
    fontWeight: "600",
    letterSpacing: 0.5,
  },
  scanInstruction: {
    marginTop: space(1),
    fontSize: typeScale.footnote.fontSize,
    lineHeight: 20,
    textAlign: "center",
  },
  completionArea: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: space(1.5),
  },
  completionIcon: {
    width: 84,
    height: 84,
    borderRadius: 42,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: space(1),
  },
  // The active session: the dial in the middle of the screen, the Emergency Exit well below it.
  activeColumn: {
    flex: 1,
    alignItems: "center",
  },
  brandMark: {
    marginTop: space(3),
  },
  // The countdown takes the room between the brand mark and Emergency Exit, and sits centred in it.
  timerArea: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  emergency: {
    marginBottom: space(4),
  },
  // The empty state: no Cycle running. The message is centred in the room above one action.
  emptyColumn: {
    flex: 1,
  },
  emptyCenter: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: space(2),
    paddingHorizontal: space(2),
  },
  emptyTitle: {
    fontSize: typeScale.title.fontSize,
    lineHeight: typeScale.title.lineHeight,
    fontWeight: "600",
    letterSpacing: -0.5,
    textAlign: "center",
  },
  emptyBody: {
    fontSize: typeScale.callout.fontSize,
    lineHeight: typeScale.callout.lineHeight,
    textAlign: "center",
  },
  emptyAction: {
    marginBottom: space(1),
  },
  // The next action, shown only once a phase has run out. It sits clear of the countdown.
  // A fixed width, so the label has room on both sides and the button stays centred under the dial.
  advance: {
    width: 240,
    marginTop: space(5),
  },
  // Clear of the Emergency Exit above, and at the bottom of the screen.
  cycleCount: {
    alignItems: "center",
    marginBottom: space(3),
  },
  // The label is small and quiet; the remaining count sits beneath it, a step larger.
  cycleLabel: {
    ...typeScale.caption,
    fontWeight: "600",
  },
  cycleNumber: {
    ...typeScale.headline,
    fontWeight: "600",
    fontVariant: ["tabular-nums"],
    includeFontPadding: false,
  },
  completionTitle: {
    fontSize: typeScale.title.fontSize,
    fontWeight: "600",
  },
});
