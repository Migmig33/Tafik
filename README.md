# TockIn

TockIn uses an NFC card to start or end an open-ended focus session. Tap the
card to lock the apps you chose. Tap it again to get them back. StudIn is the
second mode: one scan starts a timed Study and Break cycle that runs itself and
ends on its own.

Android only. TockIn is sold as a paid download, with every feature included and
no in-app purchases or subscriptions. There is no backend, no account, no
analytics, and no network call the app makes on its own. Everything it knows
stays on the phone.

## Contents

- [What it does](#what-it-does)
- [How it works](#how-it-works)
- [The two modes](#the-two-modes)
- [Session lifecycle](#session-lifecycle)
- [Emergency unlock](#emergency-unlock)
- [What is stored, and where](#what-is-stored-and-where)
- [Permissions](#permissions)
- [Project structure](#project-structure)
- [Development](#development)
- [Conventions](#conventions)
- [Before you ship](#before-you-ship)

## What it does

- Onboarding that walks through each Android permission and deep-links to the
  right settings screen
- Home, with idle and active-session states and a live tabular timer
- Blocklist editor with search, toggles, and real installed-app icons
- Card setup that manages several NFC cards and checks each UID is stable
  across two taps before trusting it
- A native blocker that closes a blocked app the moment it opens, with a
  full-screen shield as the visual fallback
- Phone-wide screen-time monitoring through Android Usage Access
- Insights: a seven-day chart, a per-app breakdown, and a week-over-week trend
- StudIn, with configurable Study length, Break length, and round count
- Light and dark themes, monochrome at rest, accent green only during a session
- Three emergency unlocks per calendar month for a card that is lost or not to
  hand

## How it works

TockIn is a React Native app sitting in front of a custom Android native module.
The split is not cosmetic. Blocking has to keep working after Android has put
the JavaScript runtime to sleep, which it will do within minutes of the user
leaving the app. Anything that must survive that cannot live in JavaScript.

```
┌─────────────────────────────────────────────┐
│  React Native (src/)                        │
│  screens, navigation, AsyncStorage, NFC     │
│  Awake only while the app is in front.      │
└───────────────────┬─────────────────────────┘
                    │  Expo Modules bridge (src/blocking.ts)
┌───────────────────▼─────────────────────────┐
│  BlockingModule.kt                          │
│  Commands in, state out.                    │
└───────────────────┬─────────────────────────┘
                    │  SharedPreferences (BlockingPreferences.kt)
        ┌───────────┴────────────┐
        ▼                        ▼
┌──────────────────┐   ┌──────────────────────┐
│ Accessibility    │   │ ForegroundBlock      │
│ BlockService     │   │ Service              │
│                  │   │                      │
│ Instant. Reacts  │   │ Polls every ~500ms,  │
│ to window        │   │ draws the shield,    │
│ changes and      │   │ holds the ongoing    │
│ presses Home.    │   │ notification, runs   │
│                  │   │ the StudIn clock.    │
└──────────────────┘   └──────────────────────┘
```

Two enforcement paths run at once on purpose. The accessibility service is fast
but Android can drop or delay its events. The polling service is slower but
never misses, and it is the one that draws the shield and keeps the foreground
notification alive so Android does not kill the process.

SharedPreferences is the seam between the two worlds. JavaScript writes the
blocklist, the appearance mode, and the StudIn schedule into it, and the native
services read from it. That is why a session started before you locked your
phone is still running an hour later with the app long since swapped out of
memory.

## The two modes

**TockIn** is open-ended. Tap the card, the blocklist is enforced, and it stays
enforced until you tap the same card again. There is no timer and no automatic
end. A "Start without card" option exists on Home for a session begun away from
the card, but the card is still the only ordinary way out.

**StudIn** is timed. One scan starts the whole cycle: Study, Break, Study,
Break, for as many rounds as configured. Defaults are 25 minutes of Study, 5 of
Break, 4 rounds; the accepted ranges are 1 to 180, 1 to 60, and 1 to 12. Apps
are blocked during Study and released during Break, and the transitions happen
natively without waking JavaScript. While the cycle is active, the foreground
notification shows Android's live countdown. Android schedules each phase end
as a wake-up alarm; the alert uses the bundled `src/assets/alarm.wav` sound and
vibration. An optional lock-screen alarm brings TockIn above the keyguard, but
is never requested while another app is visibly in use. The card does not end
a Study interval. That is deliberate, it is stated before the cycle begins,
and emergency unlock is the only way out mid-Study.

## Session lifecycle

1. The user taps a registered card. `src/nfc.ts` reads the UID and compares it
   against the stored cards.
2. JavaScript calls `startBlockingSession` or `startStudInBlockingSession`,
   which crosses the bridge into `BlockingModule.kt`.
3. The module refuses to start unless Usage Access, overlay, and Accessibility
   are all genuinely granted, then writes the session into SharedPreferences and
   starts `ForegroundBlockService`.
4. Enforcement runs entirely natively from here. Opening a blocked app triggers
   either an accessibility event or the next poll, and Android is sent Home with
   the shield drawn over the top.
5. Ending is a second card tap, the StudIn cycle finishing on its own, or an
   emergency unlock. The finished session is written to history as a date and a
   length, never as the apps that were opened.

Sessions shorter than five seconds are discarded as mis-taps, and only the 400
most recent are kept.

## Emergency unlock

Three per calendar month, refilling on the 1st, each behind a 45 second
press-and-hold. It is slow and scarce on purpose, so it stays an emergency
rather than becoming a second unlock button. A user who moves the device clock
can defeat the monthly count; that is an accepted trade for having no accounts
and no server.

## What is stored, and where

Everything is in the app's own private storage. Nothing is transmitted.

**AsyncStorage**, the JavaScript side and the source of truth:

| Key | Holds |
| --- | --- |
| `onboardingDone` | Whether setup finished |
| `welcomeSeen` | Whether the one-time first-launch intro has played |
| `welcomeAnswers` | The two first-run questions, used to personalise the intro |
| `cardUid` | Registered NFC cards, as UID and label pairs |
| `blocklist` | Package names the user chose to block |
| `focusMode` | `tockin` or `studin` |
| `studInConfig` | Study minutes, Break minutes, round count |
| `activeSessionStartedAt` | Start time of a session still running |
| `sessions` | Finished sessions, as `{ d: "YYYY-MM-DD", s: seconds }` |
| `emergencyUnlocks` | Uses so far this calendar month |
| `guidesSeen` | Which screens have shown their first-visit walkthrough |

**SharedPreferences**, the native mirror in `BlockingPreferences.kt`: the
blocklist, appearance mode, session mode and start time, and the StudIn
schedule. These are copies, written by JavaScript, existing only so the services
can read them while the runtime is asleep.

Keys from features that no longer exist are cleared on launch from both sides.
See `RETIRED_KEYS` in `src/store.ts` and `BlockingPreferences.kt`.

## Permissions

| Permission | Asked where | Without it |
| --- | --- | --- |
| NFC | Onboarding | No card can be read, so nothing starts or ends normally |
| Usage Access (`PACKAGE_USAGE_STATS`) | Android special access screen | No app detection and no Insights |
| Display over other apps (`SYSTEM_ALERT_WINDOW`) | Android special access screen | No shield can be drawn |
| Accessibility service | Android accessibility settings | Blocked apps are caught by polling only, so noticeably slower |
| `FOREGROUND_SERVICE` and `FOREGROUND_SERVICE_SPECIAL_USE` | Install time | Android kills the session as soon as the app leaves the screen |
| `POST_NOTIFICATIONS` | Runtime prompt, Android 13+ | No ongoing session countdown or StudIn timer alarms |
| `SCHEDULE_EXACT_ALARM` | Alarms & reminders special access, Android 12+ | Sleeping-device alarms can be delayed; the foreground monitor remains as fallback |
| `USE_FULL_SCREEN_INTENT` | Optional Settings toggle; special access on Android 14+ | Alarm still sounds, but TockIn will not appear above the lock screen |

A Play release must complete the full-screen-intent declaration. TockIn requests
that surface only for a user-started StudIn timer, only while the keyguard is
showing, and keeps the ordinary alarm notification as its denial fallback.

The accessibility service declares `isAccessibilityTool="false"` and
`canRetrieveWindowContent="false"`, listens only for window-change events, and
reads nothing but the package name of the app in front. A standalone disclosure
is shown and consented to before the user is ever sent to Android's accessibility
settings, as Google Play requires.

On Android 13 and up, an app installed from a file rather than a store cannot be
switched on as an accessibility service until the user allows restricted
settings. The disclosure detects that case and explains the way out. Play
installs never see it. See `needsRestrictedSettingHelp` in `src/blocking.ts`.

## Project structure

```
App.tsx                     Root: navigation, session state, NFC scan handling
index.ts                    Entry point
app.json                    Expo config: package name, permissions, plugins
eas.json                    Build profiles: development, preview, production

src/
  blocking.ts               Typed wrapper over the native module
  store.ts                  AsyncStorage: every persisted value and its rules
  nfc.ts                    Card reading and UID comparison
  nav.ts                    Screen names and the nav function type
  theme.ts                  Colours, spacing, radii, light and dark
  typography.tsx            Text and TextInput with the app's type scale
  components.tsx            Shared buttons, screens, sheets
  guides.tsx                Per-screen first-visit walkthroughs
  AccessDisclosures.tsx     Accessibility and Usage Access consent modals
  BottomNav.tsx             Tab bar with the centre scan button
  ErrorBoundary.tsx         Keeps a crash from implying blocking has stopped
  sound.ts                  The session launch cue
  welcomeQuestions.ts       First-run question copy
  screens/                  One file per screen

modules/blocking/android/
  BlockingModule.kt         The bridge: every function JavaScript can call
  BlockingPreferences.kt    SharedPreferences read and write
  AccessibilityBlockService.kt   Instant blocked-app redirect
  ForegroundBlockService.kt      Polling, shield drawing, StudIn clock
  res/xml/                  Accessibility service declaration

privacy-site/index.html     The hosted copy of the privacy policy
```

## Development

Requires Node 22.13+ and a **physical Android phone with NFC**. Expo Go cannot
load the native blocking module, so a development build is mandatory.

```bash
npm install
npx expo install       # aligns native versions to the installed Expo SDK
npx expo start         # then open the dev build on your phone
```

To build the dev client itself, either locally with Android Studio installed:

```bash
npx expo run:android
```

or in the cloud, which needs no local JDK or Android SDK:

```bash
npx eas-cli build --platform android --profile development
```

Then register a card on Card setup, pick apps on Blocklist, grant the
permissions onboarding asks for, and start a session.

Native changes require a new build. JavaScript changes do not; `npx expo start`
delivers those to an installed dev build.

## Conventions

**Everything stays on-device.** No backend, no accounts, no sync, no analytics,
no remote config. When a problem seems to want a server, the answer is the
on-device one.

**Comments explain why, not what.** The codebase justifies decisions: why a
permission is re-read on resume rather than trusted, why the emergency unlock is
deliberately slow, why a sound clip's measured length drives an animation. A
comment restating the line below it does not earn its place.

**Typecheck after every change.** There is no test suite, so this is the only
automated safety net.

```bash
npm run typecheck      # tsc --noEmit
```

## Before you ship

In the repo:

- [ ] Host `privacy-site/index.html` at a public URL and put that URL in the
      Play listing
- [ ] Fill in `PLAY_STORE_URL` in `src/screens/SettingsScreen.tsx` so the rate
      row opens the listing
- [ ] Produce the listing art: 512x512 icon, 1024x500 feature graphic, and at
      least two phone screenshots
- [ ] Confirm `com.kupdevs.tockin` is the permanent application ID; it cannot
      be changed after the first upload

In Play Console:

- [ ] Data Safety form, declaring that nothing leaves the device
- [ ] Accessibility API declaration
- [ ] `FOREGROUND_SERVICE_SPECIAL_USE` justification
- [ ] Usage Access and overlay permission justifications
- [ ] Content rating questionnaire and target audience
- [ ] App access instructions covering "Start without card" and emergency
      unlock, since a reviewer has no NFC card and will otherwise conclude the
      app does nothing
- [ ] A screen recording of the full flow

Also worth knowing: a new personal developer account needs closed testing with
at least 12 testers for 14 continuous days before production access, and a paid
app needs a Google payments merchant profile. Both take calendar time.

Finally, build and test the production AAB before promoting it anywhere:

```bash
npx eas-cli build --platform android --profile production
```

## Further reading

`NATIVE.md` documents the native module in more depth: what each service must
guarantee, the accessibility policy position, and the full JavaScript to native
interface.
