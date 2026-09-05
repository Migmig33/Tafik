import { useEffect, useState } from "react";
import { Alert, Modal, Pressable, ScrollView, StyleSheet, View } from "react-native";
import CreditCard from "lucide-react-native/icons/credit-card";
import LockKeyholeOpen from "lucide-react-native/icons/lock-keyhole-open";
import SearchX from "lucide-react-native/icons/search-x";
import TriangleAlert from "lucide-react-native/icons/triangle-alert";
import { Body, GhostButton, HoldButton, PrimaryButton, Screen, Title } from "../components";
import { Nav } from "../nav";
import {
  EMERGENCY_HOLD_SECONDS,
  EMERGENCY_UNLOCKS_PER_MONTH,
  emergencyResetLabel,
  getEmergencyUnlocksLeft,
  getRegisteredCards,
  type RegisteredCard,
  removeRegisteredCard,
} from "../store";
import { radius, space, useTheme } from "../theme";
import { Text } from "../typography";

/**
 * The way back in when the card isn't. Deliberately awkward: a 45-second hold,
 * and only a few per month, so it can't quietly become the normal way to end a
 * session. The hold is spent only once the unlock actually succeeds.
 */
export default function EmergencyScreen({
  nav,
  active,
  sessionMode = "tockin",
  onUnlock,
}: {
  nav: Nav;
  active: boolean;
  sessionMode?: "tockin" | "studin";
  /** Ends the session and spends one unlock. Resolves with the number left. */
  onUnlock: () => Promise<number>;
}) {
  const { colors } = useTheme();
  const [left, setLeft] = useState<number | null>(null);
  const [done, setDone] = useState(false);
  const [busy, setBusy] = useState(false);
  // Asked once, straight after a successful unlock. An unlock has exactly two
  // causes, and only one of them leaves a dead card in the list.
  const [cards, setCards] = useState<RegisteredCard[]>([]);
  const [askReason, setAskReason] = useState(false);
  const [pickingLost, setPickingLost] = useState(false);

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
      // Read after the unlock rather than on mount, so a card registered or
      // removed while this screen was open cannot leave a stale list behind.
      const registered = await getRegisteredCards();
      setCards(registered);
      // With nothing registered there is nothing the answer could change, so
      // the question would only be one more tap between the user and their apps.
      if (registered.length > 0) setAskReason(true);
    } catch (e: any) {
      Alert.alert("Couldn't unlock", e?.message ?? "Please try again.");
    } finally {
      setBusy(false);
    }
  };

  const forgetCard = async (card: RegisteredCard) => {
    try {
      const next = await removeRegisteredCard(card.uid);
      setCards(next);
      setPickingLost(false);
      setAskReason(false);
      Alert.alert(
        "Card removed",
        next.length === 0
          ? `${card.label} is gone and no card is registered. You will need to register one before your next session.`
          : `${card.label} will no longer unlock TockIn.`,
        next.length === 0
          ? [
              { text: "Later", style: "cancel" },
              { text: "Register card", onPress: () => nav("cardSetup") },
            ]
          : [{ text: "OK" }]
      );
    } catch (e: any) {
      Alert.alert("Couldn't remove card", e?.message ?? "Please try again.");
    }
  };

  // One card is unambiguous. Several means the app cannot know which one went
  // missing, and guessing would delete a card the user still has.
  const reportLost = () => {
    if (cards.length === 1) {
      void forgetCard(cards[0]);
      return;
    }
    setAskReason(false);
    setPickingLost(true);
  };

  const exhausted = left !== null && left <= 0;
  const resetsOn = emergencyResetLabel();
  // Unlocking ends the session, which clears the caller's StudIn state before
  // this screen re-renders. Latch the mode it was opened for, so the copy that
  // follows still speaks about the session the user actually exited.
  const [studIn] = useState(sessionMode === "studin");
  const returnScreen = studIn ? "studin" : "home";

  const confirmUnlock = () => {
    if (!studIn) {
      void unlock();
      return;
    }
    Alert.alert(
      "Use Emergency Exit?",
      "This will end your StudIn session before the Study timer is complete.",
      [
        { text: "Keep studying", style: "cancel" },
        { text: "Emergency exit", style: "destructive", onPress: () => void unlock() },
      ]
    );
  };

  return (
    <Screen>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ flexGrow: 1 }}>
        <Title>{done ? "Apps unblocked" : studIn ? "Emergency Exit" : "Card lost?"}</Title>
        <View style={{ height: space(1) }} />
        <Body dim>
          {done
            ? cards.length === 0
              ? "Your apps are available again. No card is registered, so register one before your next session."
              : studIn
                ? "Your StudIn session ended early and its blocked apps are available again."
                : "Your session was ended without the card and every blocked app is available again."
            : studIn
              ? "This will end your StudIn session before your Study timer is complete. Use this only when you need to leave early."
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

        {/* Registering only leads the way out when there is nothing left to tap.
            A user who still has a working card came here for another reason. */}
        {done ? (
          cards.length === 0 ? (
            <>
              <PrimaryButton label="Register a new card" onPress={() => nav("cardSetup")} />
              <GhostButton label="Back to home" onPress={() => nav("home")} />
            </>
          ) : (
            <PrimaryButton label="Back to home" onPress={() => nav("home")} />
          )
        ) : (
          <>
            {!active && (
              <>
                <Body dim>No session is running, so there is nothing to unlock.</Body>
                <View style={{ height: space(1.5) }} />
              </>
            )}
            <HoldButton
              label={
                studIn
                  ? `Hold ${EMERGENCY_HOLD_SECONDS}s for Emergency Exit`
                  : `Hold ${EMERGENCY_HOLD_SECONDS}s to unlock`
              }
              seconds={EMERGENCY_HOLD_SECONDS}
              onComplete={confirmUnlock}
              disabled={exhausted || !active || left === null || busy}
            />
            <GhostButton
              label={studIn ? "Keep studying" : "Cancel"}
              onPress={() => nav(returnScreen)}
            />
          </>
        )}
      </ScrollView>

      {/* Not dismissible by the backdrop: both answers are one tap, and a stray
          press outside would leave a lost card still registered. */}
      <Modal visible={askReason} transparent animationType="fade" onRequestClose={() => setAskReason(false)}>
        <View style={[styles.scrim, { backgroundColor: colors.scrim }]}>
          <View style={[styles.sheet, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <View style={[styles.iconBox, { backgroundColor: colors.accentWash }]}>
              <SearchX size={20} color={colors.accent} strokeWidth={2.1} />
            </View>
            <Text style={[styles.sheetTitle, { color: colors.text }]}>Why did you need this?</Text>
            <Text style={[styles.sheetBody, { color: colors.textDim }]}>
              If the card is gone for good, TockIn should stop listing it as a way back in.
            </Text>
            <View style={styles.sheetActions}>
              <PrimaryButton label="I lost my card" onPress={reportLost} />
              <GhostButton label="Another reason" onPress={() => setAskReason(false)} />
            </View>
          </View>
        </View>
      </Modal>

      <Modal
        visible={pickingLost}
        transparent
        animationType="fade"
        onRequestClose={() => setPickingLost(false)}
      >
        <View style={[styles.scrim, { backgroundColor: colors.scrim }]}>
          <View style={[styles.sheet, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <View style={[styles.iconBox, { backgroundColor: colors.accentWash }]}>
              <CreditCard size={20} color={colors.accent} strokeWidth={2.1} />
            </View>
            <Text style={[styles.sheetTitle, { color: colors.text }]}>Which card is lost?</Text>
            <Text style={[styles.sheetBody, { color: colors.textDim }]}>
              Only the one you pick is removed. The rest keep working.
            </Text>
            <View style={styles.sheetActions}>
              {cards.map((card, index) => (
                <Pressable
                  key={card.uid}
                  accessibilityRole="button"
                  accessibilityLabel={`Remove ${card.label}`}
                  onPress={() => void forgetCard(card)}
                  style={({ pressed }) => [
                    styles.cardRow,
                    index > 0 && { borderTopWidth: StyleSheet.hairlineWidth },
                    { borderColor: colors.border, opacity: pressed ? 0.65 : 1 },
                  ]}
                >
                  <CreditCard size={17} color={colors.textDim} strokeWidth={2.1} />
                  <Text style={{ color: colors.text, fontSize: 15, fontWeight: "500", flex: 1 }}>
                    {card.label}
                  </Text>
                </Pressable>
              ))}
              <GhostButton label="Cancel" onPress={() => setPickingLost(false)} />
            </View>
          </View>
        </View>
      </Modal>
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
  scrim: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: space(3),
  },
  sheet: {
    width: "100%",
    maxWidth: 340,
    alignItems: "center",
    gap: space(1),
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: radius.card,
    padding: space(2.5),
  },
  sheetTitle: {
    marginTop: space(0.5),
    fontSize: 18,
    fontWeight: "600",
  },
  sheetBody: {
    fontSize: 13,
    lineHeight: 20,
    textAlign: "center",
  },
  // Stretched, because the sheet centres its children but the buttons and the
  // card rows both want the full width.
  sheetActions: {
    alignSelf: "stretch",
    marginTop: space(1),
  },
  cardRow: {
    minHeight: 52,
    flexDirection: "row",
    alignItems: "center",
    gap: space(1.25),
  },
});
