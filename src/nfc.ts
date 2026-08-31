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

// A read stays open until a card is tapped, so the UI needs a way to back out
// of one. cancelCardRead() aborts the pending request; the in-flight read then
// resolves as { cancelled: true } rather than an error the UI would alert about.
let readInFlight = false;
let readCancelled = false;

async function readUidOnce(): Promise<string | null> {
  await ensureNfcStarted();
  readCancelled = false;
  readInFlight = true;
  try {
    // NfcA covers the large majority of Android cards (NTAG, MIFARE,
    // most access cards). Add NfcB/NfcF/NfcV fallbacks later if you need
    // to support less common tags.
    await NfcManager.requestTechnology(NfcTech.NfcA);
    const tag = await NfcManager.getTag();
    const uid = tag?.id ?? null;
    return uid ? uid.toLowerCase() : null;
  } finally {
    readInFlight = false;
    try {
      await NfcManager.cancelTechnologyRequest();
    } catch {
      /* no-op */
    }
  }
}

/** Abort a scan the user started. Safe to call when no read is in flight. */
export async function cancelCardRead(): Promise<void> {
  if (!readInFlight) return;
  readCancelled = true;
  try {
    await NfcManager.cancelTechnologyRequest();
  } catch {
    /* no-op */
  }
}

export type ReadResult = { uid: string } | { error: string; cancelled?: boolean };

/** Single read — used to detect a tap during an active session. */
export async function readCardUid(): Promise<ReadResult> {
  try {
    const uid = await readUidOnce();
    if (readCancelled) return { error: "Scan cancelled.", cancelled: true };
    if (!uid) return { error: "Couldn't read that card. Try again." };
    return { uid };
  } catch (e: any) {
    if (readCancelled) return { error: "Scan cancelled.", cancelled: true };
    return { error: e?.message ?? "NFC read failed." };
  }
}

export type RegisterStep = "first" | "confirm";
