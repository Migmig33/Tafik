import { useEffect, useState } from "react";
import { ScrollView, StyleSheet, View } from "react-native";
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
import { getStudInConfig } from "../store";
import { space, useTheme } from "../theme";
import { Text } from "../typography";

function countdown(seconds: number): string {
  const safe = Math.max(0, Math.ceil(seconds));
  const minutes = Math.floor(safe / 60);
  return `${minutes.toString().padStart(2, "0")}:${(safe % 60).toString().padStart(2, "0")}`;
}

/**
 * The face of a running StudIn cycle. The schedule itself is chosen in
 * Settings, so this screen never configures anything; it reports the phase the
 * native service is in and offers the only two ways out of it.
 */
export default function StudInScreen({
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
  const { colors } = useTheme();
  const [rounds, setRounds] = useState<number | null>(null);
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    getStudInConfig().then((saved) => setRounds(saved.rounds));
  }, []);

  useEffect(() => {
    if (!session?.active) return;
    setNow(Date.now());
    const timer = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(timer);
  }, [session?.active]);

  if (session?.active && session.mode === "studin" && session.phase) {
    const study = session.phase === "study";
    const secondsLeft = (session.phaseEndsAt - now) / 1000;
    const PhaseIcon = study ? BookOpenCheck : Coffee;
    // Deliberately the same shape as home's live TockIn session: same header,
    // same outlined circle at the same size, same timer beneath it. Only the
    // mark inside the circle and the counting direction differ.
    return (
      <Screen tinted={study}>
        <ScrollView contentContainerStyle={{ flexGrow: 1 }} showsVerticalScrollIndicator={false}>
          <View style={styles.homeHeader}>
            <AnimatedSwapText value="StudIn">
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
                  <Text style={{ color: colors.text, fontSize: 14, fontWeight: "600" }}>
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
              <Text
                accessibilityRole="timer"
                accessibilityLabel={`${study ? "Study" : "Break"} time ${countdown(secondsLeft)}`}
                style={[styles.activeTimer, { color: colors.text }]}
              >
                {countdown(secondsLeft)}
              </Text>
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
              label={scanning ? "Waiting for NFC card..." : "Tap card to end StudIn"}
              disabled={scanning}
              onPress={onEndWithCard}
            />
          )}
          <GhostButton label="Emergency Exit" onPress={onEmergency} />
        </ScrollView>
      </Screen>
    );
  }

  if (completed) {
    return (
      <Screen>
        <View style={styles.simpleHeader}>
          <Title>StudIn</Title>
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
        <PrimaryButton label="Done" onPress={onDone} />
      </Screen>
    );
  }

  // Reachable only if a session ends between the router deciding on this screen
  // and the render, so it just needs a way back rather than a design.
  return (
    <Screen>
      <View style={styles.simpleHeader}>
        <Title>StudIn</Title>
      </View>
      <View style={styles.completionArea}>
        <Body dim>No StudIn cycle is running. Start one by tapping your card on home.</Body>
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
    fontSize: 44,
    lineHeight: 54,
    fontVariant: ["tabular-nums"],
    fontWeight: "600",
    letterSpacing: 0.5,
  },
  scanInstruction: {
    marginTop: space(1),
    fontSize: 13,
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
    fontSize: 26,
    fontWeight: "600",
  },
});
