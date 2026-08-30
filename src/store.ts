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
  cardUid: "cardUid",
  blocklist: "blocklist", // array of package names
  sessions: "sessions", // array of completed session records
  activeSessionStartedAt: "activeSessionStartedAt", // epoch milliseconds
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
