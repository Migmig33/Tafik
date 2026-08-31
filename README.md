# TapIn

Tap an NFC card to start a locked focus session; tap again to end it.
Android-only. v2 ships fully unlocked, with no backend, accounts, analytics, or
app-initiated network calls.

## What runs today (this repo)

The full JS shell, on your own phone:

- Onboarding / permissions flow (deep-links to the right Android settings)
- Home — idle and active-session states, with a live tabular timer
- Blocklist editor (search + toggles, persisted locally)
- Installed app icons and persistent system/light/dark appearance controls
- Card setup — manages multiple NFC keys and checks each UID is stable across two taps
- Native Android blocker — detects selected foreground apps and covers them during a session
- Phone-wide daily screen-time monitoring through Android Usage Access
- Screen-time Insights with a seven-day chart, per-app breakdown, and weekly trend
- A custom message on the native blocking shield
- Light + dark mode, monochrome at rest, accent green only during a session

The blocker requires Android Usage Access and Display over other apps permissions.
It runs only in an Android development or production build; Expo Go cannot load
the native blocking module.

## Run it on your phone today

Requires: Node 22.13+, a **physical Android phone with NFC** (Expo Go will NOT work —
NFC needs a dev build), USB debugging on, and Android Studio / platform tools.

```bash
npm install
npx expo install       # aligns native versions to the installed Expo SDK
npx expo run:android   # builds a dev client and installs it on your device
```

Then tap your card on the Card setup screen to register it, pick some apps on the
Blocklist, grant the requested Android permissions, and start a focus session.

## Before you ship

- Confirm `com.kupdevs.tapin` is the permanent Android application ID before the first Play upload.
- Fill the Play Console **Data Safety** form as "no data collected / stays on device".
- Justify the Usage Access + overlay permissions in your store listing.
- Build and test the signed production AAB before promoting it beyond internal testing.
