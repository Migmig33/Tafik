# Native blocking module architecture

The native Android blocker is implemented in `modules/blocking`. This document
records its architecture and constraints for future maintenance.

## What it must do

1. **Reject blocked windows immediately.** `AccessibilityBlockService` listens
   only for window-change events and reads their package names. If a package is
   blocked while the current phase enforces blocking, it performs Android's global Home action. It does
   not request or inspect the accessibility node tree.
2. **Keep a polling fallback.** `ForegroundBlockService` polls
   `UsageStatsManager.queryEvents(...)` every ~500ms. It remains the visual
   fallback and foreground-service watchdog when an accessibility event is late
   or unavailable.
3. **Shield blocked apps.** When the foreground package is in the blocklist and a
   session is active, draw a full-screen overlay window
   (`WindowManager` + `TYPE_APPLICATION_OVERLAY`, requires `SYSTEM_ALERT_WINDOW`).
   The overlay is the shield and is drawn directly by `ForegroundBlockService.kt`.
4. **Own session state.** Start/stop shielding on command from JS, and keep the
   persistent foreground notification alive while a session runs. TapIn remains
   open-ended. StudIn derives Study and Break phases from its persisted start
   time, durations, and round count; the native watchdog releases restrictions
   during Break and reapplies them at the next Study without waking JS.
5. **Read blocking state without JS awake.** Mirror the blocklist, appearance,
   shield message, and StudIn schedule into `SharedPreferences` so the service can
   enforce and complete a live session after the React Native runtime sleeps. NFC
   reads happen in the app UI. One scan starts StudIn; it does not normally end it.

## Accessibility policy

TapIn declares `isAccessibilityTool="false"`. Before opening Android's
Accessibility settings, onboarding displays a separate disclosure and asks for
affirmative consent. A Play release must include the Accessibility declaration
and reviewer video. The service performs only deterministic, user-configured
blocking and cannot prevent the user from disabling or uninstalling TapIn.

## JS ↔ native interface (Expo Modules API)

```ts
startSession(blocklist: string[]): Promise<void>   // begin shielding
startStudInSession(blocklist: string[], studySeconds: number, breakSeconds: number, rounds: number): Promise<void>
endSession(): Promise<void>                          // stop shielding
isSessionActive(): Promise<boolean>
getSessionState(): Promise<BlockingSessionState>
consumeStudInResult(): Promise<{ focusSeconds: number; completed: boolean }>
hasUsageAccess(): Promise<boolean>                   // for real onboarding checks
hasOverlayPermission(): Promise<boolean>
hasAccessibilityAccess(): Promise<boolean>
getInstalledApps(): Promise<{ name: string; pkg: string }[]>
getInstalledAppsWithIcons(): Promise<string>                   // names, packages, icon data URIs
getScreenTimeToday(): Promise<number>                          // foreground app time in ms
getAppScreenTimeToday(): Promise<string>                        // per-app foreground time JSON
getScreenTimeInsights(): Promise<string>                        // fourteen daily totals + apps JSON
setAppearanceMode(mode: "system" | "light" | "dark"): Promise<void>
setShieldMessage(message: string): Promise<void>
```
