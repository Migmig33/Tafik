import { requireOptionalNativeModule } from "expo";
import { Platform } from "react-native";

export type InstalledApp = { name: string; pkg: string; icon: string };
type InstalledAppSummary = Omit<InstalledApp, "icon">;
export type AppScreenTime = { name: string; pkg: string; seconds: number };
export type ScreenTimeDay = { date: string; seconds: number; apps: AppScreenTime[] };
export type BlockingSessionState = {
  active: boolean;
  mode: "none" | "tockin" | "studin";
  phase: "study" | "break" | null;
  currentRound: number;
  totalRounds: number;
  phaseStartedAt: number;
  phaseEndsAt: number;
  sessionStartedAt: number;
  studyDurationSeconds: number;
  breakDurationSeconds: number;
};
export type StudInResult = { focusSeconds: number; completed: boolean };

type BlockingNativeModule = {
  startSession(blocklist: string[]): Promise<void>;
  startStudInSession?(
    blocklist: string[],
    studyDurationSeconds: number,
    breakDurationSeconds: number,
    rounds: number
  ): Promise<void>;
  endSession(): Promise<void>;
  isSessionActive(): Promise<boolean>;
  getSessionState?(): Promise<BlockingSessionState>;
  consumeStudInResult?(): Promise<StudInResult>;
  setAppearanceMode?(mode: "system" | "light" | "dark"): Promise<void>;
  setShieldMessage?(message: string): Promise<void>;
  hasUsageAccess(): Promise<boolean>;
  hasOverlayPermission(): Promise<boolean>;
  hasAccessibilityAccess?(): Promise<boolean>;
  wasInstalledFromStore?(): Promise<boolean>;
  getScreenTimeToday(): Promise<number>;
  getAppScreenTimeToday(): Promise<string>;
  getScreenTimeInsights(): Promise<string>;
  getInstalledApps(): Promise<InstalledAppSummary[]>;
  getInstalledAppsWithIcons?(): Promise<string>;
};

const native = requireOptionalNativeModule<BlockingNativeModule>("Blocking");

function requireBlockingModule(): BlockingNativeModule {
  if (!native) {
    throw new Error(
      "TockIn's blocker isn't available on this device. Please update TockIn to the latest version."
    );
  }
  return native;
}

export async function startBlockingSession(blocklist: string[]): Promise<void> {
  if (blocklist.length === 0) throw new Error("Choose at least one app to lock first.");
  await requireBlockingModule().startSession(blocklist);
}

export async function startStudInBlockingSession(
  blocklist: string[],
  studyMinutes: number,
  breakMinutes: number,
  rounds: number
): Promise<void> {
  if (blocklist.length === 0) throw new Error("Choose at least one app to block first.");
  const module = requireBlockingModule();
  if (typeof module.startStudInSession !== "function") {
    throw new Error("StudIn needs a newer native build of TockIn.");
  }
  await module.startStudInSession(
    blocklist,
    Math.round(studyMinutes * 60),
    Math.round(breakMinutes * 60),
    Math.round(rounds)
  );
}

export function hasStudInSessionSupport(): boolean {
  return typeof native?.startStudInSession === "function" &&
    typeof native?.getSessionState === "function";
}

export async function endBlockingSession(): Promise<void> {
  await requireBlockingModule().endSession();
}

export async function isBlockingSessionActive(): Promise<boolean> {
  return native ? native.isSessionActive() : false;
}

const INACTIVE_SESSION: BlockingSessionState = {
  active: false,
  mode: "none",
  phase: null,
  currentRound: 0,
  totalRounds: 0,
  phaseStartedAt: 0,
  phaseEndsAt: 0,
  sessionStartedAt: 0,
  studyDurationSeconds: 0,
  breakDurationSeconds: 0,
};

export async function getBlockingSessionState(): Promise<BlockingSessionState> {
  if (!native) return INACTIVE_SESSION;
  if (typeof native.getSessionState !== "function") {
    const active = await native.isSessionActive();
    return active ? { ...INACTIVE_SESSION, active: true, mode: "tockin" } : INACTIVE_SESSION;
  }

  const state = await native.getSessionState();
  return {
    active: Boolean(state.active),
    mode: state.mode === "tockin" || state.mode === "studin" ? state.mode : "none",
    phase: state.phase === "study" || state.phase === "break" ? state.phase : null,
    currentRound: Math.max(0, Math.round(Number(state.currentRound) || 0)),
    totalRounds: Math.max(0, Math.round(Number(state.totalRounds) || 0)),
    phaseStartedAt: Math.max(0, Number(state.phaseStartedAt) || 0),
    phaseEndsAt: Math.max(0, Number(state.phaseEndsAt) || 0),
    sessionStartedAt: Math.max(0, Number(state.sessionStartedAt) || 0),
    studyDurationSeconds: Math.max(0, Math.round(Number(state.studyDurationSeconds) || 0)),
    breakDurationSeconds: Math.max(0, Math.round(Number(state.breakDurationSeconds) || 0)),
  };
}

export async function consumeStudInResult(): Promise<StudInResult> {
  if (!native?.consumeStudInResult) return { focusSeconds: 0, completed: false };
  const result = await native.consumeStudInResult();
  return {
    focusSeconds: Math.max(0, Math.round(Number(result.focusSeconds) || 0)),
    completed: Boolean(result.completed),
  };
}

export async function syncBlockingAppearance(mode: "system" | "light" | "dark"): Promise<void> {
  await native?.setAppearanceMode?.(mode);
}

/**
 * Mirror the shield message into SharedPreferences, where the foreground
 * service can read it without the JS runtime being awake. An empty string means
 * "fall back to TockIn's own line".
 *
 * Optional on the native side: a user running a build from before this shipped
 * simply keeps the default shield rather than crashing on a missing function.
 */
export async function syncShieldMessage(message: string): Promise<void> {
  await native?.setShieldMessage?.(message);
}

export async function hasUsageAccess(): Promise<boolean> {
  return native ? native.hasUsageAccess() : false;
}

export async function hasOverlayPermission(): Promise<boolean> {
  return native ? native.hasOverlayPermission() : false;
}

export async function hasAccessibilityAccess(): Promise<boolean> {
  return native?.hasAccessibilityAccess ? native.hasAccessibilityAccess() : false;
}

// Only sideloaded installs on Android 13 and up run into the restricted
// setting, so everyone else is spared an explanation of a dialog they will
// never see.
export async function needsRestrictedSettingHelp(): Promise<boolean> {
  if (Platform.OS !== "android" || Number(Platform.Version) < 33) return false;
  if (typeof native?.wasInstalledFromStore !== "function") return false;
  return !(await native.wasInstalledFromStore());
}

export function hasAccessibilityServiceSupport(): boolean {
  return typeof native?.hasAccessibilityAccess === "function";
}

export async function getAppScreenTimeToday(): Promise<AppScreenTime[] | null> {
  if (!native || !(await native.hasUsageAccess())) return null;
  if (typeof native.getAppScreenTimeToday !== "function") {
    throw new Error("Screen-time details aren't available yet. Please update TockIn to the latest version.");
  }
  const raw = await native.getAppScreenTimeToday();
  const apps = JSON.parse(raw) as unknown;
  if (!Array.isArray(apps)) throw new Error("Couldn't read your screen time. Please try again.");

  return apps
    .filter(
      (app): app is { name: string; pkg: string; milliseconds: number } =>
        typeof app === "object" &&
        app !== null &&
        typeof app.name === "string" &&
        typeof app.pkg === "string" &&
        typeof app.milliseconds === "number"
    )
    .map((app) => ({
      name: app.name,
      pkg: app.pkg,
      seconds: Math.round(app.milliseconds / 1000),
    }));
}

/**
 * Daily screen time, oldest day first, ending with today.
 *
 * Newer builds return 14 days so a week can be compared against the one before
 * it; builds from before that return 7. Callers must therefore treat the length
 * as a maximum and not index back from it blindly.
 */
export async function getScreenTimeInsights(): Promise<ScreenTimeDay[] | null> {
  if (!native || !(await native.hasUsageAccess())) return null;
  if (typeof native.getScreenTimeInsights !== "function") {
    throw new Error("Screen-time insights aren't available yet. Please update TockIn to the latest version.");
  }
  const parsed = JSON.parse(await native.getScreenTimeInsights()) as {
    days?: { date?: unknown; milliseconds?: unknown; apps?: unknown }[];
  };
  if (!Array.isArray(parsed.days)) throw new Error("Couldn't read your screen time. Please try again.");

  return parsed.days.map((day) => {
    const rawApps = Array.isArray(day.apps) ? day.apps : [];
    const apps = rawApps
      .filter(
        (app): app is { name: string; pkg: string; milliseconds: number } =>
          typeof app === "object" &&
          app !== null &&
          typeof app.name === "string" &&
          typeof app.pkg === "string" &&
          typeof app.milliseconds === "number"
      )
      .map((app) => ({
        name: app.name,
        pkg: app.pkg,
        seconds: Math.round(app.milliseconds / 1000),
      }));
    return {
      date: typeof day.date === "string" ? day.date : "",
      seconds: typeof day.milliseconds === "number" ? Math.round(day.milliseconds / 1000) : 0,
      apps,
    };
  });
}

export async function getInstalledApps(): Promise<InstalledApp[]> {
  const module = requireBlockingModule();
  if (typeof module.getInstalledAppsWithIcons !== "function") {
    throw new Error("The app list isn't available yet. Please update TockIn to the latest version.");
  }
  const parsed = JSON.parse(await module.getInstalledAppsWithIcons()) as unknown;
  if (!Array.isArray(parsed)) throw new Error("Couldn't read your installed apps. Please try again.");

  return parsed.filter(
    (app): app is InstalledApp =>
      typeof app === "object" &&
      app !== null &&
      typeof app.name === "string" &&
      typeof app.pkg === "string" &&
      typeof app.icon === "string" &&
      app.icon.startsWith("data:image/png;base64,")
  );
}
