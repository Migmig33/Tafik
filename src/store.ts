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
