import React, { useEffect, useState } from "react";
import { View } from "react-native";
import { Body, GhostButton, PrimaryButton, Screen, TapRipple, Title } from "../components";
import { Nav } from "../nav";
import { cancelCardRead, readCardUid } from "../nfc";
import { setCardUid } from "../store";
import { space } from "../theme";

type Step = "intro" | "reading" | "confirm" | "done" | "error";

export default function CardSetupScreen({ nav }: { nav: Nav }) {
  const [step, setStep] = useState<Step>("intro");
  const [firstUid, setFirstUid] = useState<string | null>(null);
  const [message, setMessage] = useState("");
  // The step to fall back to when the user cancels a scan in progress.
  const [scanFrom, setScanFrom] = useState<Step>("intro");

  // Never leave the reader listening after the screen goes away.
  useEffect(() => () => void cancelCardRead(), []);

  const readFirst = async () => {
    setScanFrom("intro");
    setStep("reading");
    const r = await readCardUid();
    if ("error" in r) {
      if (r.cancelled) {
        setStep("intro");
        return;
      }
      setMessage(r.error);
      setStep("error");
      return;
    }
    setFirstUid(r.uid);
    setStep("confirm");
  };

  const confirm = async () => {
    setScanFrom("confirm");
    setStep("reading");
    const r = await readCardUid();
    if ("error" in r) {
      if (r.cancelled) {
        setStep("confirm");
        return;
      }
      setMessage(r.error);
      setStep("error");
      return;
    }
    if (r.uid !== firstUid) {
      // Different UID on second tap, so this card randomizes its ID and can't be a key.
      setMessage(
        "This card changes its ID each tap, so it can't be used as a key. Try a cheap NFC sticker or tag instead."
      );
      setStep("error");
      return;
    }
    await setCardUid(r.uid);
    setStep("done");
  };

  const copy: Record<Step, { title: string; body: string }> = {
    intro: { title: "Register your card", body: "Press Scan card, then hold any NFC card or tag to the back of your phone." },
    reading: {
      title: "Ready to scan",
      body:
        scanFrom === "confirm"
          ? "Hold the same card against the back of your phone."
          : "Hold the card against the back of your phone.",
    },
    confirm: { title: "Tap once more", body: "Same card again — this checks its ID stays the same." },
    done: { title: "Card registered", body: "You're set. Tap this card to start and end focus sessions." },
    error: { title: "Hmm", body: message },
  };

  const c = copy[step];

  return (
    <Screen>
      <Title>{c.title}</Title>
      <View style={{ height: space(1) }} />
      <Body dim>{c.body}</Body>

      <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
        <TapRipple active={step === "reading"} />
      </View>

      {step === "intro" && <PrimaryButton label="Scan card" onPress={readFirst} />}
      {step === "confirm" && <PrimaryButton label="Confirm card" onPress={confirm} />}
      {step === "reading" && (
        <>
          <PrimaryButton label="Waiting for card…" onPress={() => {}} disabled />
          <GhostButton label="Cancel" onPress={() => void cancelCardRead()} />
        </>
      )}
      {step === "done" && <PrimaryButton label="Done" onPress={() => nav("home")} />}
      {step === "error" && (
        <>
          <PrimaryButton label="Try again" onPress={() => setStep("intro")} />
          <GhostButton label="Back" onPress={() => nav("home")} />
        </>
      )}
      {(step === "intro" || step === "confirm") && <GhostButton label="Cancel" onPress={() => nav("home")} />}
    </Screen>
  );
}
