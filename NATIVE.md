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
4. **Read blocking state without JS awake.** Mirror the blocklist, appearance,
   and shield message into `SharedPreferences` so the service can enforce a live
   session after the React Native runtime sleeps. NFC reads happen in the app UI.

## Do NOT use AccessibilityService

Use UsageStats + overlay. As of the Jan 2026 Play policy enforcement and Android
17's Advanced Protection Mode, a focus app built on AccessibilityService risks
Play rejection and being disabled on-device. This is the single biggest thing
that gets blocker apps removed.

## JS ↔ native interface (Expo Modules API)

```ts
startSession(blocklist: string[]): Promise<void>   // begin shielding
endSession(): Promise<void>                          // stop shielding
isSessionActive(): Promise<boolean>
hasUsageAccess(): Promise<boolean>                   // for real onboarding checks
hasOverlayPermission(): Promise<boolean>
getInstalledApps(): Promise<{ name: string; pkg: string }[]>
getInstalledAppsWithIcons(): Promise<string>                   // names, packages, icon data URIs
getScreenTimeToday(): Promise<number>                          // foreground app time in ms
getAppScreenTimeToday(): Promise<string>                        // per-app foreground time JSON
getScreenTimeInsights(): Promise<string>                        // fourteen daily totals + apps JSON
setAppearanceMode(mode: "system" | "light" | "dark"): Promise<void>
setShieldMessage(message: string): Promise<void>
```
