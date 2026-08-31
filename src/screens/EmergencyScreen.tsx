import React, { useEffect, useState } from "react";
import { Alert, ScrollView, StyleSheet, View } from "react-native";
import LockKeyholeOpen from "lucide-react-native/icons/lock-keyhole-open";
import TriangleAlert from "lucide-react-native/icons/triangle-alert";
import { Body, GhostButton, HoldButton, PrimaryButton, Screen, Title } from "../components";
import { Nav } from "../nav";
import {
  EMERGENCY_HOLD_SECONDS,
  EMERGENCY_UNLOCKS_PER_MONTH,
  emergencyResetLabel,
  getEmergencyUnlocksLeft,
} from "../store";
import { radius, space, useTheme } from "../theme";
import { Text } from "../typography";

/**
 * The way back in when the card isn't. Deliberately awkward: a 30 second hold,
 * and only a few per month, so it can't quietly become the normal way to end a
 * session. The hold is spent only once the unlock actually succeeds.
 */
export default function EmergencyScreen({
  nav,
  active,
  onUnlock,
}: {
  nav: Nav;
  active: boolean;
  /** Ends the session and spends one unlock. Resolves with the number left. */
  onUnlock: () => Promise<number>;
}) {
  const { colors } = useTheme();
  const [left, setLeft] = useState<number | null>(null);
  const [done, setDone] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    getEmergencyUnlocksLeft().then(setLeft);
  }, []);

  const unlock = async () => {
    if (busy) return;
    setBusy(true);
    try {
      const remaining = await onUnlock();
      setLeft(remaining);
      setDone(true);
    } catch (e: any) {
      Alert.alert("Couldn't unlock", e?.message ?? "Please try again.");
    } finally {
      setBusy(false);
    }
  };

  const exhausted = left !== null && left <= 0;
  const resetsOn = emergencyResetLabel();

  return (
    <Screen>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ flexGrow: 1 }}>
        <Title>{done ? "Apps unblocked" : "Card lost?"}</Title>
        <View style={{ height: space(1) }} />
        <Body dim>
          {done
            ? "Your session was ended without the card. Register a replacement card so the next one is a normal tap."
            : "If your card is lost or unreadable, you can end the session without it. Hold the button below for the full " +
              `${EMERGENCY_HOLD_SECONDS} seconds and every blocked app unlocks straight away.`}
        </Body>

        <View style={{ height: space(2.5) }} />

        <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <View style={[styles.iconBox, { backgroundColor: colors.accentWash }]}>
            {done ? (
              <LockKeyholeOpen size={20} color={colors.accent} strokeWidth={2.1} />
            ) : (
              <TriangleAlert size={20} color={colors.accent} strokeWidth={2.1} />
            )}
          </View>
          <View style={{ flex: 1 }}>
            <Text style={{ color: colors.text, fontSize: 15, fontWeight: "600" }}>
              {left === null
                ? "Checking your allowance…"
                : `${left} of ${EMERGENCY_UNLOCKS_PER_MONTH} emergency unlocks left`}
            </Text>
            <Text style={{ color: colors.textDim, fontSize: 12, marginTop: 4, lineHeight: 17 }}>
              {exhausted
                ? `All ${EMERGENCY_UNLOCKS_PER_MONTH} are spent. Your allowance refills on ${resetsOn}.`
                : `This month's allowance. It resets to ${EMERGENCY_UNLOCKS_PER_MONTH} on ${resetsOn}.`}
            </Text>
          </View>
        </View>

        <View style={{ flex: 1, minHeight: space(3) }} />

        {done ? (
          <>
            <PrimaryButton label="Register a new card" onPress={() => nav("cardSetup")} />
            <GhostButton label="Back to home" onPress={() => nav("home")} />
          </>
        ) : (
          <>
            {!active && (
              <>
                <Body dim>No session is running, so there is nothing to unlock.</Body>
                <View style={{ height: space(1.5) }} />
              </>
            )}
            <HoldButton
              label={`Hold ${EMERGENCY_HOLD_SECONDS}s to unlock`}
              seconds={EMERGENCY_HOLD_SECONDS}
              onComplete={unlock}
              disabled={exhausted || !active || left === null || busy}
            />
            <GhostButton label="Cancel" onPress={() => nav("home")} />
          </>
        )}
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: space(1.5),
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: radius.card,
    padding: space(2),
  },
  iconBox: {
    width: 40,
    height: 40,
    borderRadius: 13,
    alignItems: "center",
    justifyContent: "center",
  },
});
