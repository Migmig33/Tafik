import { requireOptionalNativeModule } from "expo";

export type InstalledApp = { name: string; pkg: string; icon: string };
type InstalledAppSummary = Omit<InstalledApp, "icon">;
export type AppScreenTime = { name: string; pkg: string; seconds: number };
export type ScreenTimeDay = { date: string; seconds: number; apps: AppScreenTime[] };

type BlockingNativeModule = {
  startSession(blocklist: string[]): Promise<void>;
  endSession(): Promise<void>;
  isSessionActive(): Promise<boolean>;
  setAppearanceMode?(mode: "system" | "light" | "dark"): Promise<void>;
  hasUsageAccess(): Promise<boolean>;
  hasOverlayPermission(): Promise<boolean>;
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
      "TapIn's blocker isn't available on this device. Please update TapIn to the latest version."
    );
  }
  return native;
}

export async function startBlockingSession(blocklist: string[]): Promise<void> {
  if (blocklist.length === 0) throw new Error("Choose at least one app to lock first.");
  await requireBlockingModule().startSession(blocklist);
}

export async function endBlockingSession(): Promise<void> {
  await requireBlockingModule().endSession();
}

export async function isBlockingSessionActive(): Promise<boolean> {
  return native ? native.isSessionActive() : false;
}

export async function syncBlockingAppearance(mode: "system" | "light" | "dark"): Promise<void> {
  await native?.setAppearanceMode?.(mode);
}

export async function hasUsageAccess(): Promise<boolean> {
  return native ? native.hasUsageAccess() : false;
}

export async function hasOverlayPermission(): Promise<boolean> {
  return native ? native.hasOverlayPermission() : false;
}

export async function getAppScreenTimeToday(): Promise<AppScreenTime[] | null> {
  if (!native || !(await native.hasUsageAccess())) return null;
  if (typeof native.getAppScreenTimeToday !== "function") {
    throw new Error("Screen-time details aren't available yet. Please update TapIn to the latest version.");
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
    throw new Error("Screen-time insights aren't available yet. Please update TapIn to the latest version.");
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
    throw new Error("The app list isn't available yet. Please update TapIn to the latest version.");
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
