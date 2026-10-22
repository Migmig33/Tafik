import type { InstalledApp, ScreenTimeDay } from "./blocking";

// Tafik never suggests itself: locking the app that does the locking would strand the user.
const OWN_PACKAGE = "com.kupdevs.tafik";

export const RECOMMENDATION_LIMIT = 5;

/**
 * The most-used eligible apps, most used first. Eligible means it is installed and
 * launchable, it is not Tafik, and Android recorded time in it over the days given.
 * Nothing is invented: an app with no recorded time is never suggested.
 */
export function rankMostUsed(
  days: ScreenTimeDay[],
  installed: InstalledApp[],
  limit = RECOMMENDATION_LIMIT
): InstalledApp[] {
  const totals = new Map<string, number>();
  for (const day of days) {
    for (const app of day.apps) {
      totals.set(app.pkg, (totals.get(app.pkg) ?? 0) + app.seconds);
    }
  }

  return installed
    .filter((app) => app.pkg !== OWN_PACKAGE && (totals.get(app.pkg) ?? 0) > 0)
    .sort((a, b) => (totals.get(b.pkg) ?? 0) - (totals.get(a.pkg) ?? 0))
    .slice(0, limit);
}
