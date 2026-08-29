import NfcManager, { NfcTech } from "react-native-nfc-manager";

// NFC only works in a dev build / production build — NOT in Expo Go.
// We read the tag's UID (tag.id) and use it as the identifier for the card.
// We never write to the card, so any tag with a stable UID works.
//
// Caveat handled in the UI: some cards (many bank cards, some transit passes)
// emit a RANDOM UID on every tap for privacy. Those can't be used as a key.
// registerCard() reads twice and confirms the two UIDs match before saving.

let started = false;

export async function ensureNfcStarted(): Promise<void> {
  if (started) return;
  await NfcManager.start();
  started = true;
}

export async function isNfcSupported(): Promise<boolean> {
  try {
    await ensureNfcStarted();
    return await NfcManager.isSupported();
  } catch {
    return false;
  }
}

async function readUidOnce(): Promise<string | null> {
  await ensureNfcStarted();
  try {
    // NfcA covers the large majority of Android cards (NTAG, MIFARE,
    // most access cards). Add NfcB/NfcF/NfcV fallbacks later if you need
    // to support less common tags.
    await NfcManager.requestTechnology(NfcTech.NfcA);
    const tag = await NfcManager.getTag();
    const uid = tag?.id ?? null;
    return uid ? uid.toLowerCase() : null;
  } finally {
    try {
      await NfcManager.cancelTechnologyRequest();
    } catch {
      /* no-op */
    }
  }
}

export type ReadResult = { uid: string } | { error: string };

/** Single read — used to detect a tap during an active session. */
export async function readCardUid(): Promise<ReadResult> {
  try {
    const uid = await readUidOnce();
    if (!uid) return { error: "Couldn't read that card. Try again." };
    return { uid };
  } catch (e: any) {
    return { error: e?.message ?? "NFC read failed." };
  }
}

export type RegisterStep = "first" | "confirm";
