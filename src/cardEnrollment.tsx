import { useEffect, useState } from "react";
import { StyleSheet, View } from "react-native";
import { Body, GhostButton, PrimaryButton, TapRipple, Title } from "./components";
import { cancelCardRead, readCardUid } from "./nfc";
import { addRegisteredCard, RegisteredCard } from "./store";
import { radius, space, colors, typeScale } from "./theme";
import { TextInput } from "./typography";

type Step = "intro" | "reading" | "confirm" | "name" | "done" | "error";
type ScanFrom = "intro" | "confirm";

function nextCardLabel(cards: RegisteredCard[]): string {
  return cards.length === 0 ? "My card" : `Card ${cards.length + 1}`;
}

/**
 * The card registration wizard: scan, confirm the same card twice, name it, save.
 * It holds the only copy of that logic, so Settings' card manager and onboarding
 * register a card in exactly the same way. The caller supplies the frame around it.
 */
export default function CardEnrollment({
  cards,
  doneLabel,
  returnLabel,
  bold = false,
  onSaved,
  onCancel,
}: {
  /** Cards already registered. Used for the default name and the duplicate check. */
  cards: RegisteredCard[];
  /** Label of the button shown once the card is saved. */
  doneLabel: string;
  /** Label of the button that leaves the wizard after an error. */
  returnLabel: string;
  /** Bold heading, for the onboarding pages. */
  bold?: boolean;
  /** Called with the full card list once the user taps the done button. */
  onSaved: (next: RegisteredCard[]) => void;
  /** Called when the user backs out. Any open read has already been dropped. */
  onCancel: () => void;
}) {
  const [step, setStep] = useState<Step>("intro");
  const [firstUid, setFirstUid] = useState<string | null>(null);
  const [label, setLabel] = useState(() => nextCardLabel(cards));
  const [message, setMessage] = useState("");
  // The step to fall back to when the user cancels a scan in progress.
  const [scanFrom, setScanFrom] = useState<ScanFrom>("intro");
  const [saved, setSaved] = useState<RegisteredCard[] | null>(null);

  // Never leave the reader listening after the wizard goes away.
  useEffect(() => () => void cancelCardRead(), []);

  const beginAgain = () => {
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
      setMessage("That card is already registered with Tafik.");
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
      const next = await addRegisteredCard({ uid: firstUid, label: nextLabel });
      setSaved(next);
      setLabel(nextLabel);
      setStep("done");
    } catch (error: any) {
      setMessage(error?.message ?? "Tafik couldn't save that card.");
      setStep("error");
    }
  };

  const copy: Record<Exclude<Step, "name">, { title: string; body: string }> = {
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
    <>
      <Title bold={bold}>{step === "name" ? "Name this card" : current?.title}</Title>
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
      {step === "done" && <PrimaryButton label={doneLabel} onPress={() => onSaved(saved ?? cards)} />}
      {step === "error" && (
        <>
          <PrimaryButton label="Try again" onPress={beginAgain} />
          <GhostButton label={returnLabel} onPress={onCancel} />
        </>
      )}
      {(step === "intro" || step === "confirm" || step === "name") && (
        <GhostButton label="Cancel" onPress={onCancel} />
      )}
    </>
  );
}

const styles = StyleSheet.create({
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
    fontSize: typeScale.body.fontSize,
  },
});
