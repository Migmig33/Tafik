import AsyncStorage from "@react-native-async-storage/async-storage";
import { isBlockingSessionActive } from "./blocking";

// 100% on-device. No backend, no accounts. These are the only things the app
// needs to remember between launches.
//
// IMPORTANT: when you build the native blocking module, the foreground service
// needs to read the blocklist + card UID too. The clean way is to mirror these
// values into Android SharedPreferences from your native module so the service
// can read them without the JS runtime being awake. This file is the JS-side
// source of truth; keep it in sync with SharedPreferences.

const KEYS = {
  onboardingDone: "onboardingDone",
  welcomeSeen: "welcomeSeen", // the one-time first-launch intro copy
  cardUid: "cardUid",
  blocklist: "blocklist", // array of package names
  sessions: "sessions", // array of completed session records
  activeSessionStartedAt: "activeSessionStartedAt", // epoch milliseconds
  studInConfig: "studInConfig", // study minutes, break minutes, and rounds
  focusMode: "focusMode", // "tockin" or "studin"
  emergencyUnlocks: "emergencyUnlocks", // { m: "YYYY-MM", n: uses this month }
  guidesSeen: "guidesSeen", // screens whose first-visit walkthrough has been shown
  welcomeAnswers: "welcomeAnswers", // the two first-run questions
} as const;

export async function getOnboardingDone(): Promise<boolean> {
  return (await AsyncStorage.getItem(KEYS.onboardingDone)) === "1";
}
export async function setOnboardingDone(done: boolean): Promise<void> {
  await AsyncStorage.setItem(KEYS.onboardingDone, done ? "1" : "0");
}

export type RegisteredCard = { uid: string; label: string };

function isRegisteredCard(value: unknown): value is RegisteredCard {
  if (!value || typeof value !== "object") return false;
  const card = value as Partial<RegisteredCard>;
  return (
    typeof card.uid === "string" &&
    card.uid.trim().length > 0 &&
    typeof card.label === "string" &&
    card.label.trim().length > 0
  );
}

function cleanCard(card: RegisteredCard): RegisteredCard {
  return { uid: card.uid.trim().toLowerCase(), label: card.label.trim() };
}

/**
 * Read every registered key. The old app wrote the UID itself at this key;
 * replacing it in place on first read preserves the one physical key a user
 * may rely on, while an existing array is never mistaken for legacy data.
 */
export async function getRegisteredCards(): Promise<RegisteredCard[]> {
  const raw = await AsyncStorage.getItem(KEYS.cardUid);
  if (!raw) return [];

  try {
    const parsed: unknown = JSON.parse(raw);
    if (Array.isArray(parsed)) return parsed.filter(isRegisteredCard).map(cleanCard);

    // This also tolerates a legacy UID that happened to be stored as a JSON
    // string by an intermediate build.
    if (typeof parsed === "string" && parsed.trim()) {
      const migrated = [{ uid: parsed.trim().toLowerCase(), label: "My card" }];
      await AsyncStorage.setItem(KEYS.cardUid, JSON.stringify(migrated));
      return migrated;
    }
  } catch {
    // A legacy UID is deliberately plain text, so JSON parsing usually lands
    // here. It is data to migrate, not a corrupt value to discard.
  }

  const migrated = [{ uid: raw.trim().toLowerCase(), label: "My card" }];
  await AsyncStorage.setItem(KEYS.cardUid, JSON.stringify(migrated));
  return migrated;
}

async function setRegisteredCards(cards: RegisteredCard[]): Promise<void> {
  await AsyncStorage.setItem(KEYS.cardUid, JSON.stringify(cards.map(cleanCard)));
}

export async function addRegisteredCard(card: RegisteredCard): Promise<RegisteredCard[]> {
  const cards = await getRegisteredCards();
  const nextCard = cleanCard(card);
  if (cards.some(({ uid }) => uid === nextCard.uid)) {
    throw new Error("That card is already registered.");
  }
  const next = [...cards, nextCard];
  await setRegisteredCards(next);
  return next;
}

/**
 * The final key stays put during a live session because otherwise the normal
 * NFC exit disappears and the user is forced to spend an emergency unlock.
 */
export async function removeRegisteredCard(uid: string): Promise<RegisteredCard[]> {
  const cards = await getRegisteredCards();
  if (cards.length === 1 && cards[0].uid === uid && (await isBlockingSessionActive())) {
    throw new Error("End the focus session before removing your only card.");
  }
  const next = cards.filter((card) => card.uid !== uid);
  await setRegisteredCards(next);
  return next;
}

export async function getBlocklist(): Promise<string[]> {
  const raw = await AsyncStorage.getItem(KEYS.blocklist);
  if (!raw) return [];
  try {
    return JSON.parse(raw) as string[];
  } catch {
    return [];
  }
}
export async function setBlocklist(list: string[]): Promise<void> {
  await AsyncStorage.setItem(KEYS.blocklist, JSON.stringify(list));
}

export async function getActiveSessionStartedAt(): Promise<number | null> {
  const raw = await AsyncStorage.getItem(KEYS.activeSessionStartedAt);
  if (!raw) return null;
  const timestamp = Number(raw);
  return Number.isFinite(timestamp) && timestamp > 0 ? timestamp : null;
}

export async function setActiveSessionStartedAt(timestamp: number): Promise<void> {
  await AsyncStorage.setItem(KEYS.activeSessionStartedAt, String(timestamp));
}

export async function clearActiveSessionStartedAt(): Promise<void> {
  await AsyncStorage.removeItem(KEYS.activeSessionStartedAt);
}

/**
 * Which session a card tap starts. "tockin" is the standard open-ended session
 * that runs until a card ends it, and is what the app does when no extra mode
 * is switched on. "studin" is the timed study/break cycle. Strict Mode is
 * announced in Settings as a stricter version of each of these rather than a
 * mode of its own, so it will not add a value here when it ships.
 */
export type FocusMode = "tockin" | "studin";

export async function getFocusMode(): Promise<FocusMode> {
  return (await AsyncStorage.getItem(KEYS.focusMode)) === "studin" ? "studin" : "tockin";
}

export async function setFocusMode(mode: FocusMode): Promise<void> {
  await AsyncStorage.setItem(KEYS.focusMode, mode);
}

export type StudInConfig = {
  studyMinutes: number;
  breakMinutes: number;
  rounds: number;
};

export const DEFAULT_STUDIN_CONFIG: StudInConfig = {
  studyMinutes: 25,
  breakMinutes: 5,
  rounds: 4,
};

function normalizeStudInConfig(value: Partial<StudInConfig>): StudInConfig {
  const whole = (input: unknown, fallback: number, min: number, max: number) => {
    const parsed = typeof input === "number" ? input : Number(input);
    return Number.isFinite(parsed) ? Math.min(max, Math.max(min, Math.round(parsed))) : fallback;
  };
  return {
    studyMinutes: whole(value.studyMinutes, DEFAULT_STUDIN_CONFIG.studyMinutes, 1, 180),
    breakMinutes: whole(value.breakMinutes, DEFAULT_STUDIN_CONFIG.breakMinutes, 1, 60),
    rounds: whole(value.rounds, DEFAULT_STUDIN_CONFIG.rounds, 1, 12),
  };
}

export async function getStudInConfig(): Promise<StudInConfig> {
  const raw = await AsyncStorage.getItem(KEYS.studInConfig);
  if (!raw) return DEFAULT_STUDIN_CONFIG;
  try {
    return normalizeStudInConfig(JSON.parse(raw) as Partial<StudInConfig>);
  } catch {
    return DEFAULT_STUDIN_CONFIG;
  }
}

export async function setStudInConfig(config: StudInConfig): Promise<StudInConfig> {
  const normalized = normalizeStudInConfig(config);
  await AsyncStorage.setItem(KEYS.studInConfig, JSON.stringify(normalized));
  return normalized;
}

// --- Session history -------------------------------------------------------
// Each completed session is stored as { d: "YYYY-MM-DD", s: seconds }.
// This is focus time the app measured itself. Device-wide screen time is a
// different thing entirely and needs UsageStatsManager (see NATIVE.md).

export type SessionRecord = { d: string; s: number };

export function todayKey(now = new Date()): string {
  const pad = (n: number) => n.toString().padStart(2, "0");
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
}

export async function getSessions(): Promise<SessionRecord[]> {
  const raw = await AsyncStorage.getItem(KEYS.sessions);
  if (!raw) return [];
  try {
    return JSON.parse(raw) as SessionRecord[];
  } catch {
    return [];
  }
}

/** Append a finished session. Sessions under 5s are ignored as mis-taps. */
export async function recordSession(seconds: number): Promise<void> {
  if (seconds < 5) return;
  const all = await getSessions();
  all.push({ d: todayKey(), s: Math.round(seconds) });
  // Keep the log bounded — 400 sessions is well over a year of daily use.
  const trimmed = all.slice(-400);
  await AsyncStorage.setItem(KEYS.sessions, JSON.stringify(trimmed));
}

export type TodayStats = { seconds: number; count: number; streak: number };

export async function getTodayStats(): Promise<TodayStats> {
  const all = await getSessions();
  const key = todayKey();
  const today = all.filter((r) => r.d === key);

  // Streak: count back day by day while each day has at least one session.
  const days = new Set(all.map((r) => r.d));
  let streak = 0;
  const cursor = new Date();
  while (days.has(todayKey(cursor))) {
    streak += 1;
    cursor.setDate(cursor.getDate() - 1);
  }

  return {
    seconds: today.reduce((sum, r) => sum + r.s, 0),
    count: today.length,
    streak,
  };
}

// --- Emergency unlocks -----------------------------------------------------
// If the card is lost, broken, or simply not to hand, the user must still be
// able to get back into their phone. The escape hatch is deliberately slow (a
// long press-and-hold) and deliberately scarce (a few per calendar month) so it
// stays an emergency rather than a second unlock button.
//
// The allowance is keyed to the local calendar month and refills on the 1st:
// spend all three in August and the count is back to three on 1 September.
// Nothing here defends against a user moving the device clock; that is a
// trade-off we accept for staying fully on-device with no accounts.

export const EMERGENCY_UNLOCKS_PER_MONTH = 3;
export const EMERGENCY_HOLD_SECONDS = 45;

type EmergencyRecord = { m: string; n: number };

export function monthKey(now = new Date()): string {
  return `${now.getFullYear()}-${(now.getMonth() + 1).toString().padStart(2, "0")}`;
}

const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

/** When the allowance refills, e.g. "September 1". */
export function emergencyResetLabel(now = new Date()): string {
  const next = new Date(now.getFullYear(), now.getMonth() + 1, 1);
  return `${MONTH_NAMES[next.getMonth()]} 1`;
}

/**
 * Whole days until the allowance refills, counting from today. Both ends are
 * local midnight, so a day that gains or loses an hour to DST still counts as
 * one day. Returns 1 on the last day of the month, never 0.
 */
export function emergencyDaysUntilReset(now = new Date()): number {
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const next = new Date(now.getFullYear(), now.getMonth() + 1, 1);
  return Math.round((next.getTime() - today.getTime()) / 86_400_000);
}

/** Usage for the current month. A record from an older month reads as unused. */
async function readEmergencyRecord(): Promise<EmergencyRecord> {
  const month = monthKey();
  const raw = await AsyncStorage.getItem(KEYS.emergencyUnlocks);
  if (!raw) return { m: month, n: 0 };
  try {
    const parsed = JSON.parse(raw) as Partial<EmergencyRecord>;
    if (parsed?.m !== month || typeof parsed.n !== "number" || !Number.isFinite(parsed.n)) {
      return { m: month, n: 0 };
    }
    const used = Math.floor(parsed.n);
    return { m: month, n: Math.min(EMERGENCY_UNLOCKS_PER_MONTH, Math.max(0, used)) };
  } catch {
    return { m: month, n: 0 };
  }
}

export async function getEmergencyUnlocksLeft(): Promise<number> {
  const record = await readEmergencyRecord();
  return EMERGENCY_UNLOCKS_PER_MONTH - record.n;
}

/** Spend one unlock. Returns how many are left afterwards. */
export async function consumeEmergencyUnlock(): Promise<number> {
  const record = await readEmergencyRecord();
  if (record.n >= EMERGENCY_UNLOCKS_PER_MONTH) {
    throw new Error(
      `You've used all ${EMERGENCY_UNLOCKS_PER_MONTH} emergency unlocks this month. They come back on ${emergencyResetLabel()}.`
    );
  }
  const next: EmergencyRecord = { m: record.m, n: record.n + 1 };
  await AsyncStorage.setItem(KEYS.emergencyUnlocks, JSON.stringify(next));
  return EMERGENCY_UNLOCKS_PER_MONTH - next.n;
}

// --- First launch ----------------------------------------------------------

/**
 * Whether the one-time welcome sequence has been seen. Separate from
 * onboardingDone so quitting midway through the permission screens doesn't
 * replay the whole intro copy on the next launch.
 */
export async function getWelcomeSeen(): Promise<boolean> {
  return (await AsyncStorage.getItem(KEYS.welcomeSeen)) === "1";
}

export async function setWelcomeSeen(seen: boolean): Promise<void> {
  await AsyncStorage.setItem(KEYS.welcomeSeen, seen ? "1" : "0");
}

// --- Screen guides ---------------------------------------------------------
// The first time a tab is opened it explains itself. Which ones have been seen
// is stored as a list of keys rather than a single "toured" flag, so a screen
// added in a later version can still introduce itself to somebody who has been
// using the app for months.

export async function getSeenGuides(): Promise<string[]> {
  const raw = await AsyncStorage.getItem(KEYS.guidesSeen);
  if (!raw) return [];
  try {
    const parsed: unknown = JSON.parse(raw);
    return Array.isArray(parsed)
      ? parsed.filter((key): key is string => typeof key === "string")
      : [];
  } catch {
    return [];
  }
}

export async function hasSeenGuide(key: string): Promise<boolean> {
  return (await getSeenGuides()).includes(key);
}

export async function markGuideSeen(key: string): Promise<void> {
  const seen = await getSeenGuides();
  if (seen.includes(key)) return;
  await AsyncStorage.setItem(KEYS.guidesSeen, JSON.stringify([...seen, key]));
}

/** Forget every walkthrough so each tab introduces itself again on the next visit. */
export async function resetGuides(): Promise<void> {
  await AsyncStorage.removeItem(KEYS.guidesSeen);
}

// --- First-run questions ---------------------------------------------------
// Two questions asked once, between Get started and the opening story. The
// answers pick which story the user is told, so the copy describes their own
// habit rather than a generic one. They are kept because a story built on an
// answer is worth nothing if the answer is thrown away the moment it is used.

export type ScreenTimeAnswer = "light" | "moderate" | "heavy" | "extreme";
export type DistractionAnswer =
  | "doomscroll"
  | "videos"
  | "games"
  | "messages"
  | "notifications";
export type WelcomeAnswers = {
  screenTime: ScreenTimeAnswer;
  distraction: DistractionAnswer;
};

const SCREEN_TIME_ANSWERS: ScreenTimeAnswer[] = ["light", "moderate", "heavy", "extreme"];
const DISTRACTION_ANSWERS: DistractionAnswer[] = [
  "doomscroll",
  "videos",
  "games",
  "messages",
  "notifications",
];

/** Null when the questions were never answered, so callers can fall back. */
export async function getWelcomeAnswers(): Promise<WelcomeAnswers | null> {
  const raw = await AsyncStorage.getItem(KEYS.welcomeAnswers);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as Partial<WelcomeAnswers>;
    // Validated rather than trusted: an answer set written by an older build
    // could name an option this version no longer has.
    if (
      SCREEN_TIME_ANSWERS.includes(parsed?.screenTime as ScreenTimeAnswer) &&
      DISTRACTION_ANSWERS.includes(parsed?.distraction as DistractionAnswer)
    ) {
      return parsed as WelcomeAnswers;
    }
    return null;
  } catch {
    return null;
  }
}

export async function setWelcomeAnswers(answers: WelcomeAnswers): Promise<void> {
  await AsyncStorage.setItem(KEYS.welcomeAnswers, JSON.stringify(answers));
}
