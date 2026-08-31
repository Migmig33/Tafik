import AsyncStorage from "@react-native-async-storage/async-storage";

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
  emergencyUnlocks: "emergencyUnlocks", // { m: "YYYY-MM", n: uses this month }
  premium: "premium", // "1" once the one-time unlock is owned
} as const;

export async function getOnboardingDone(): Promise<boolean> {
  return (await AsyncStorage.getItem(KEYS.onboardingDone)) === "1";
}
export async function setOnboardingDone(done: boolean): Promise<void> {
  await AsyncStorage.setItem(KEYS.onboardingDone, done ? "1" : "0");
}

export async function getCardUid(): Promise<string | null> {
  return AsyncStorage.getItem(KEYS.cardUid);
}
export async function setCardUid(uid: string): Promise<void> {
  await AsyncStorage.setItem(KEYS.cardUid, uid);
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
export const EMERGENCY_HOLD_SECONDS = 30;

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

// --- Premium ---------------------------------------------------------------
// TapIn is freemium, and the free tier is a whole product: unlimited apps,
// unlimited sessions, the card, the timer, the streak, and a way out if the
// card is lost. Premium buys depth — the longer view of your screen time, your
// own words on the shield, and more than one card — never the ability to block.
//
// This is the single source of truth for the entitlement. Every gated screen
// reads it through usePremium() (src/premium.tsx) so there is exactly one place
// to change when billing becomes real.

/**
 * Forces the entitlement regardless of what is stored, so gated UI can be built
 * and reviewed before any billing exists. `null` means "use the real value".
 *
 * TODO(billing, step 6): set this to `null` and make getIsPremium() ask
 * RevenueCat for the non-consumable entitlement, caching the answer here so a
 * launch with no network still knows what the user owns.
 */
const PREMIUM_OVERRIDE: boolean | null = true;

/** Whether the one-time Premium unlock is owned. */
export async function getIsPremium(): Promise<boolean> {
  if (PREMIUM_OVERRIDE !== null) return PREMIUM_OVERRIDE;
  return (await AsyncStorage.getItem(KEYS.premium)) === "1";
}

/**
 * Record the entitlement locally. Called after a purchase or a restore — never
 * from the UI as a toggle, since owning Premium is the store's fact, not ours.
 */
export async function setIsPremium(premium: boolean): Promise<void> {
  await AsyncStorage.setItem(KEYS.premium, premium ? "1" : "0");
}
