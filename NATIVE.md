# Native blocking module architecture

The native Android blocker is implemented in `modules/blocking`. This document
records its architecture and constraints for future maintenance.

## What it must do

1. **Detect the foreground app.** A `ForegroundService` polls
   `UsageStatsManager.queryEvents(...)` (last ~2s) every ~500ms, or listens for
   `MOVE_TO_FOREGROUND` events, to learn which package is on screen.
2. **Shield blocked apps.** When the foreground package is in the blocklist and a
   session is active, draw a full-screen overlay window
   (`WindowManager` + `TYPE_APPLICATION_OVERLAY`, requires `SYSTEM_ALERT_WINDOW`).
   The overlay is the shield and is drawn directly by `ForegroundBlockService.kt`.
3. **Own session state.** Start/stop shielding on command from JS, and keep the
   persistent foreground notification alive while a session runs.
4. **Read the blocklist + card UID without JS awake.** Mirror them into
   `SharedPreferences` from JS (via this module) so the service reads them directly.

## Do NOT use AccessibilityService

Use UsageStats + overlay. As of the Jan 2026 Play policy enforcement and Android
17's Advanced Protection Mode, a focus app built on AccessibilityService risks
Play rejection and being disabled on-device. This is the single biggest thing
that gets blocker apps removed.

## JS ↔ native interface to expose (Expo Modules API)

```ts
// src/blocking.ts (create when the native side exists)
startSession(blocklist: string[]): Promise<void>   // begin shielding
endSession(): Promise<void>                          // stop shielding
isSessionActive(): Promise<boolean>
hasUsageAccess(): Promise<boolean>                   // for real onboarding checks
hasOverlayPermission(): Promise<boolean>
getInstalledApps(): Promise<{ name: string; pkg: string }[]>  // replace MOCK_APPS
getInstalledAppsWithIcons(): Promise<string>                   // names, packages, icon data URIs
getScreenTimeToday(): Promise<number>                          // foreground app time in ms
getAppScreenTimeToday(): Promise<string>                        // per-app foreground time JSON
getScreenTimeInsights(): Promise<string>                        // seven daily totals + apps JSON
```

Wire `getInstalledApps()` into `BlocklistScreen` (replace `MOCK_APPS`) and the
permission checks into `OnboardingScreen` (replace the optimistic grant flip).

## Create it with

```
npx create-expo-module@latest --local blocking
```

Then implement the service + overlay in the generated Kotlin. Skeleton to start:

```kotlin
// modules/blocking/android/.../BlockingModule.kt  (skeleton — fill in)
class BlockingModule : Module() {
  override fun definition() = ModuleDefinition {
    Name("Blocking")
    AsyncFunction("startSession") { blocklist: List<String> ->
      val ctx = appContext.reactContext!!
      Prefs.saveBlocklist(ctx, blocklist)
      ForegroundBlockService.start(ctx)   // startForegroundService(...)
    }
    AsyncFunction("endSession") { ForegroundBlockService.stop(appContext.reactContext!!) }
    AsyncFunction("hasUsageAccess") { UsageAccess.granted(appContext.reactContext!!) }
    AsyncFunction("hasOverlayPermission") { Settings.canDrawOverlays(appContext.reactContext!!) }
    AsyncFunction("getInstalledApps") { Apps.installed(appContext.reactContext!!) }
  }
}
```

`ForegroundBlockService`: the poll loop + overlay show/hide.
`UsageAccess.granted`: check via `AppOpsManager` `OPSTR_GET_USAGE_STATS`.
`Apps.installed`: `packageManager.getInstalledApplications`, filter launchable, non-system.
