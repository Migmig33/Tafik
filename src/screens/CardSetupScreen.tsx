import { useEffect, useState } from "react";
import { Alert, Pressable, ScrollView, StyleSheet, View } from "react-native";
import CreditCard from "lucide-react-native/icons/credit-card";
import Lock from "lucide-react-native/icons/lock";
import Plus from "lucide-react-native/icons/plus";
import Trash2 from "lucide-react-native/icons/trash-2";
import { Body, GhostButton, PrimaryButton, Screen, TapRipple, Title } from "../components";
import { Nav } from "../nav";
import { cancelCardRead, readCardUid } from "../nfc";
import { usePremium } from "../premium";
import {
  addRegisteredCard,
  getRegisteredCards,
  RegisteredCard,
  removeRegisteredCard,
} from "../store";
import { radius, space, useTheme } from "../theme";
import { Text, TextInput } from "../typography";

type Step = "list" | "intro" | "reading" | "confirm" | "name" | "done" | "error";
type ScanFrom = "intro" | "confirm";

function nextCardLabel(cards: RegisteredCard[]): string {
  return cards.length === 0 ? "My card" : `Card ${cards.length + 1}`;
}

function uidHint(uid: string): string {
  return `NFC card ···· ${uid.slice(-4).toUpperCase()}`;
}

export default function CardSetupScreen({
  nav,
  active,
  onUnlock,
}: {
  nav: Nav;
  active: boolean;
  onUnlock?: () => void;
}) {
  const { colors } = useTheme();
  const { isPremium, ready: premiumReady } = usePremium();
  const [cards, setCards] = useState<RegisteredCard[]>([]);
  const [cardsReady, setCardsReady] = useState(false);
  const [step, setStep] = useState<Step>("list");
  const [firstUid, setFirstUid] = useState<string | null>(null);
  const [label, setLabel] = useState("");
  const [message, setMessage] = useState("");
  // The step to fall back to when the user cancels a scan in progress.
  const [scanFrom, setScanFrom] = useState<ScanFrom>("intro");

  useEffect(() => {
    let mounted = true;
    getRegisteredCards().then((stored) => {
      if (!mounted) return;
      setCards(stored);
      setCardsReady(true);
    });
    // Never leave the reader listening after the screen goes away.
    return () => {
      mounted = false;
      void cancelCardRead();
    };
  }, []);

  const beginAdd = () => {
    if (cards.length >= 1 && !isPremium) {
      onUnlock?.();
      return;
    }
    setFirstUid(null);
    setLabel(nextCardLabel(cards));
    setMessage("");
    setStep("intro");
  };

  const readFirst = async () => {
    setScanFrom("intro");
    setStep("reading");
    const result = await readCardUid();
    if ("error" in result) {
      if (result.cancelled) {
        setStep("intro");
        return;
      }
      setMessage(result.error);
      setStep("error");
      return;
    }
    setFirstUid(result.uid);
    setStep("confirm");
  };

  const confirm = async () => {
    setScanFrom("confirm");
    setStep("reading");
    const result = await readCardUid();
    if ("error" in result) {
      if (result.cancelled) {
        setStep("confirm");
        return;
      }
      setMessage(result.error);
      setStep("error");
      return;
    }
    if (result.uid !== firstUid) {
      // A different UID on the second tap means this card randomizes its ID and
      // would eventually strand a session that only the original ID can end.
      setMessage(
        "This card changes its ID each tap, so it can't be used as a key. Try a cheap NFC sticker or tag instead."
      );
      setStep("error");
      return;
    }
    if (cards.some((card) => card.uid === result.uid)) {
      setMessage("That card is already registered with TapIn.");
      setStep("error");
      return;
    }
    setFirstUid(result.uid);
    setStep("name");
  };

  const save = async () => {
    if (!firstUid) return;
    const nextLabel = label.trim() || nextCardLabel(cards);
    try {
      const next = await addRegisteredCard({ uid: firstUid, label: nextLabel }, isPremium);
      setCards(next);
      setLabel(nextLabel);
      setStep("done");
    } catch (error: any) {
      setMessage(error?.message ?? "TapIn couldn't save that card.");
      setStep("error");
    }
  };

  const requestRemove = (card: RegisteredCard) => {
    if (active && cards.length === 1) {
      Alert.alert(
        "Card needed for this session",
        "End the focus session before removing your only registered card."
      );
      return;
    }
    Alert.alert(
      `Remove ${card.label}?`,
      "This card will no longer start or end focus sessions.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Remove",
          style: "destructive",
          onPress: () => {
            void removeRegisteredCard(card.uid)
              .then(setCards)
              .catch((error: any) =>
                Alert.alert("Couldn't remove card", error?.message ?? "Please try again.")
              );
          },
        },
      ]
    );
  };

  if (step === "list") {
    const freeLimitReached = premiumReady && !isPremium && cards.length >= 1;
    return (
      <Screen>
        <Title>Your cards</Title>
        <View style={{ height: space(0.75) }} />
        <Body dim>
          Any registered card can start or end a focus session.
        </Body>

        <ScrollView
          style={styles.list}
          contentContainerStyle={cards.length === 0 ? styles.emptyList : undefined}
          showsVerticalScrollIndicator={false}
        >
          {!cardsReady ? null : cards.length === 0 ? (
            <View style={[styles.emptyCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              <View style={[styles.largeIcon, { backgroundColor: colors.bg }]}>
                <CreditCard size={28} color={colors.textDim} strokeWidth={1.8} />
              </View>
              <Text style={[styles.emptyTitle, { color: colors.text }]}>No card registered</Text>
              <Body dim>Add one NFC card or tag to use as your key.</Body>
            </View>
          ) : (
            <View style={[styles.cardList, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              {cards.map((card, index) => (
                <View
                  key={card.uid}
                  style={[
                    styles.cardRow,
                    index > 0 && { borderTopWidth: StyleSheet.hairlineWidth, borderColor: colors.border },
                  ]}
                >
                  <View style={[styles.iconBox, { backgroundColor: colors.bg }]}>
                    <CreditCard size={20} color={colors.textDim} strokeWidth={2} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={{ color: colors.text, fontSize: 15, fontWeight: "600" }}>
                      {card.label}
                    </Text>
                    <Text style={{ color: colors.textDim, fontSize: 12, marginTop: 3 }}>
                      {uidHint(card.uid)}
                    </Text>
                  </View>
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={`Remove ${card.label}`}
                    onPress={() => requestRemove(card)}
                    hitSlop={10}
                    style={({ pressed }) => [styles.removeButton, { opacity: pressed ? 0.55 : 1 }]}
                  >
                    <Trash2 size={19} color={colors.textDim} strokeWidth={2} />
                  </Pressable>
                </View>
              ))}
            </View>
          )}
        </ScrollView>

        {premiumReady &&
          (freeLimitReached ? (
            <Pressable
              onPress={onUnlock}
              style={({ pressed }) => [
                styles.lockedAdd,
                { borderColor: colors.border, opacity: pressed ? 0.65 : 1 },
              ]}
            >
              <Plus size={19} color={colors.textDim} strokeWidth={2.2} />
              <Text style={{ flex: 1, color: colors.text, fontSize: 15, fontWeight: "600" }}>
                Add another card
              </Text>
              <Lock size={17} color={colors.textDim} strokeWidth={2.2} />
            </Pressable>
          ) : (
            <PrimaryButton
              label={cards.length === 0 ? "Add a card" : "Add another card"}
              onPress={beginAdd}
            />
          ))}
        <GhostButton label="Back" onPress={() => nav("home")} />
      </Screen>
    );
  }

  const copy: Record<Exclude<Step, "list" | "name">, { title: string; body: string }> = {
    intro: {
      title: "Add a card",
      body: "Press Scan card, then hold any NFC card or tag to the back of your phone.",
    },
    reading: {
      title: "Ready to scan",
      body:
        scanFrom === "confirm"
          ? "Hold the same card against the back of your phone."
          : "Hold the card against the back of your phone.",
    },
    confirm: {
      title: "Tap once more",
      body: "Same card again. This checks its ID stays the same.",
    },
    done: {
      title: "Card registered",
      body: `${label} can now start and end focus sessions.`,
    },
    error: { title: "Hmm", body: message },
  };

  const current = step === "name" ? null : copy[step];
  return (
    <Screen>
      <Title>{step === "name" ? "Name this card" : current?.title}</Title>
      <View style={{ height: space(1) }} />
      <Body dim>
        {step === "name"
          ? "Use a name you'll recognize when you manage your keys."
          : current?.body}
      </Body>

      <View style={styles.wizardBody}>
        {step === "name" ? (
          <TextInput
            autoFocus
            value={label}
            onChangeText={setLabel}
            onSubmitEditing={() => void save()}
            returnKeyType="done"
            maxLength={30}
            selectTextOnFocus
            placeholder="My card"
            placeholderTextColor={colors.textDim}
            style={[
              styles.labelInput,
              { color: colors.text, backgroundColor: colors.surface, borderColor: colors.border },
            ]}
          />
        ) : (
          <TapRipple active={step === "reading"} />
        )}
      </View>

      {step === "intro" && <PrimaryButton label="Scan card" onPress={() => void readFirst()} />}
      {step === "confirm" && <PrimaryButton label="Confirm card" onPress={() => void confirm()} />}
      {step === "name" && <PrimaryButton label="Save card" onPress={() => void save()} />}
      {step === "reading" && (
        <>
          <PrimaryButton label="Waiting for card…" onPress={() => {}} disabled />
          <GhostButton label="Cancel" onPress={() => void cancelCardRead()} />
        </>
      )}
      {step === "done" && <PrimaryButton label="Back to cards" onPress={() => setStep("list")} />}
      {step === "error" && (
        <>
          <PrimaryButton label="Try again" onPress={beginAdd} />
          <GhostButton label="Back to cards" onPress={() => setStep("list")} />
        </>
      )}
      {(step === "intro" || step === "confirm" || step === "name") && (
        <GhostButton label="Cancel" onPress={() => setStep("list")} />
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  list: {
    flex: 1,
    marginTop: space(3),
  },
  emptyList: {
    flexGrow: 1,
    justifyContent: "center",
  },
  emptyCard: {
    alignItems: "center",
    gap: space(1),
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: radius.card,
    padding: space(3),
  },
  largeIcon: {
    width: 56,
    height: 56,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: space(0.5),
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: "600",
  },
  cardList: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: radius.card,
    overflow: "hidden",
  },
  cardRow: {
    minHeight: 78,
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
  removeButton: {
    width: 40,
    height: 40,
    alignItems: "center",
    justifyContent: "center",
  },
  lockedAdd: {
    minHeight: 58,
    flexDirection: "row",
    alignItems: "center",
    gap: space(1.25),
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: radius.pill,
    paddingHorizontal: space(2),
  },
  wizardBody: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  labelInput: {
    width: "100%",
    minHeight: 58,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: radius.input,
    paddingHorizontal: space(1.75),
    fontSize: 16,
  },
});
