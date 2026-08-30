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
    throw new Error("TapIn's blocking engine is not in this build. Rebuild the Android app, then try again.");
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

/** Device-wide foreground app time today, in seconds. */
export async function getDeviceScreenTimeToday(): Promise<number | null> {
  if (!native || !(await native.hasUsageAccess())) return null;
  return Math.round((await native.getScreenTimeToday()) / 1000);
}

export async function getAppScreenTimeToday(): Promise<AppScreenTime[] | null> {
  if (!native || !(await native.hasUsageAccess())) return null;
  if (typeof native.getAppScreenTimeToday !== "function") {
    throw new Error("Rebuild TapIn to install the screen-time details update.");
  }
  const raw = await native.getAppScreenTimeToday();
  const apps = JSON.parse(raw) as unknown;
  if (!Array.isArray(apps)) throw new Error("Android returned invalid app usage data.");

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

export async function getScreenTimeInsights(): Promise<ScreenTimeDay[] | null> {
  if (!native || !(await native.hasUsageAccess())) return null;
  if (typeof native.getScreenTimeInsights !== "function") {
    throw new Error("Rebuild TapIn to install screen-time insights.");
  }
  const parsed = JSON.parse(await native.getScreenTimeInsights()) as {
    days?: { date?: unknown; milliseconds?: unknown; apps?: unknown }[];
  };
  if (!Array.isArray(parsed.days)) throw new Error("Android returned invalid insights data.");

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
    throw new Error("Rebuild TapIn to install real app icon support.");
  }
  const parsed = JSON.parse(await module.getInstalledAppsWithIcons()) as unknown;
  if (!Array.isArray(parsed)) throw new Error("Android returned invalid installed-app data.");

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
