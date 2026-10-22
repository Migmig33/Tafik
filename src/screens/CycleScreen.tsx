import { useEffect, useState } from "react";
import { ScrollView, StyleProp, StyleSheet, TextStyle, View } from "react-native";
import BookOpenCheck from "lucide-react-native/icons/book-open-check";
import Check from "lucide-react-native/icons/circle-check";
import Coffee from "lucide-react-native/icons/coffee";
import type { BlockingSessionState } from "../blocking";
import {
  AnimatedSwapText,
  Body,
  GhostButton,
  PrimaryButton,
  Screen,
  TapRipple,
  Title,
} from "../components";
import { getCycleConfig } from "../store";
import { latestSessionCard, SessionCardFacts, SessionCardModal } from "../sessionCard";
import { colors, space, typeScale } from "../theme";
import { ScrollEdgeFade, useScrollEdge } from "../scrollEdge";
import { Text } from "../typography";

function countdown(seconds: number): string {
  const safe = Math.max(0, Math.ceil(seconds));
  const minutes = Math.floor(safe / 60);
  return `${minutes.toString().padStart(2, "0")}:${(safe % 60).toString().padStart(2, "0")}`;
}

/**
 * The live countdown. It owns its own tick, so the 4-per-second re-render stays
 * on these digits and the circle, header and buttons around them are not rebuilt.
 */
function LiveCountdown({ endsAt, label, style }: { endsAt: number; label: string; style: StyleProp<TextStyle> }) {
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    setNow(Date.now());
    const timer = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(timer);
  }, []);

  const secondsLeft = (endsAt - now) / 1000;
  return (
    <Text
      accessibilityRole="timer"
      accessibilityLabel={`${label} time ${countdown(secondsLeft)}`}
      style={style}
    >
      {countdown(secondsLeft)}
    </Text>
  );
}

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
  onEmergency,
  onDone,
}: {
  session: BlockingSessionState | null;
  completed: boolean;
  scanning: boolean;
  blockCount: number;
  onEndWithCard: () => void;
  onEmergency: () => void;
  onDone: () => void;
}) {
  const edge = useScrollEdge();
  const [rounds, setRounds] = useState<number | null>(null);
  // The card for the Tempo session that just completed, read back from storage.
  const [shareable, setShareable] = useState<SessionCardFacts | null>(null);
  const [openCard, setOpenCard] = useState<SessionCardFacts | null>(null);

  useEffect(() => {
    getCycleConfig().then((saved) => setRounds(saved.rounds));
  }, []);

  useEffect(() => {
    if (completed) void latestSessionCard("cycle").then(setShareable);
  }, [completed]);

  if (session?.active && session.mode === "cycle" && session.phase) {
    const study = session.phase === "study";
    const PhaseIcon = study ? BookOpenCheck : Coffee;
    // Deliberately the same shape as home's live Tafik session: same header,
    // same outlined circle at the same size, same timer beneath it. Only the
    // mark inside the circle and the counting direction differ.
    return (
      <Screen tinted={study}>
        <View style={{ flex: 1 }}>
          <ScrollView {...edge.scrollProps} contentContainerStyle={{ flexGrow: 1 }} showsVerticalScrollIndicator={false}>
            <View style={styles.homeHeader}>
              <AnimatedSwapText value="Cycle">
                {(label) => <Title>{label}</Title>}
              </AnimatedSwapText>
              <View style={[styles.streakPill, { backgroundColor: colors.accentWash }]}>
                <PhaseIcon size={17} color={colors.accent} strokeWidth={2.3} />
                <AnimatedSwapText
                  value={
                    scanning
                      ? "Ready to scan"
                      : `${study ? "Study" : "Break"} ${session.currentRound}/${session.totalRounds}`
                  }
                >
                  {(label) => (
                    <Text style={{ color: colors.text, ...typeScale.callout, fontWeight: "600" }}>
                      {label}
                    </Text>
                  )}
                </AnimatedSwapText>
              </View>
            </View>

            <View style={styles.focusCluster}>
              <View style={styles.activeFocusContent}>
                <TapRipple active={scanning} size={184} coreSize={116}>
                  <PhaseIcon size={64} color={colors.text} strokeWidth={1.7} />
                </TapRipple>
                <LiveCountdown
                  endsAt={session.phaseEndsAt}
                  label={study ? "Study" : "Break"}
                  style={[styles.activeTimer, { color: colors.text }]}
                />
                <Body dim>
                  {study
                    ? `${blockCount} apps blocked`
                    : "Apps are available during this break"}
                </Body>
                {scanning ? (
                  <Text style={[styles.scanInstruction, { color: colors.textDim }]}>
                    Hold your card to the back of your phone.
                  </Text>
                ) : (
                  <Text style={[styles.scanInstruction, { color: colors.textDim }]}>
                    {study
                      ? "Stay with what matters. The next break starts on its own."
                      : "The next Study starts automatically."}
                  </Text>
                )}
              </View>
            </View>

            {/* A break is the only point where the cycle can be ended normally.
                During Study the card is deliberately inert, so the way out there
                is the emergency unlock and its cost. */}
            {study ? null : (
              <PrimaryButton
                label={scanning ? "Waiting for NFC card..." : "Tap card to end Cycle"}
                disabled={scanning}
                onPress={onEndWithCard}
              />
            )}
            <GhostButton label="Emergency Exit" onPress={onEmergency} />
          </ScrollView>
          <ScrollEdgeFade visible={edge.visible} />
        </View>
      </Screen>
    );
  }

  if (completed) {
    return (
      <Screen>
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
        <SessionCardModal facts={openCard} onClose={() => setOpenCard(null)} />
      </Screen>
    );
  }

  // Reachable only if a session ends between the router deciding on this screen
  // and the render, so it just needs a way back rather than a design.
  return (
    <Screen>
      <View style={styles.simpleHeader}>
        <Title>Cycle</Title>
      </View>
      <View style={styles.completionArea}>
        <Body dim>No cycle is running. Start one by tapping your card on home.</Body>
      </View>
      <PrimaryButton label="Back to home" onPress={onDone} />
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
  completionTitle: {
    fontSize: typeScale.title.fontSize,
    fontWeight: "600",
  },
});
