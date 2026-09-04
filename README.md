# TapIn

TapIn uses an NFC card to start or end an open-ended focus session. StudIn uses
one NFC scan to start a timed Study and Break cycle that ends automatically.
Android-only. TapIn is sold as a paid download, with every available feature
included and no in-app purchases or subscriptions. It has no backend, accounts,
analytics, or app-initiated network calls.

## What runs today (this repo)

The full JS shell, on your own phone:

- Onboarding / permissions flow (deep-links to the right Android settings)
- Home — idle and active-session states, with a live tabular timer
- Blocklist editor (search + toggles, persisted locally)
- Installed app icons and persistent system/light/dark appearance controls
- Card setup — manages multiple NFC keys and checks each UID is stable across two taps
- Native Android blocker — immediately exits selected apps, with a full-screen shield fallback
- Phone-wide daily screen-time monitoring through Android Usage Access
- Screen-time Insights with a seven-day chart, per-app breakdown, and weekly trend
- A custom message on the native blocking shield
- StudIn with configurable Study, Break, and round counts started by one NFC scan
- Native automatic StudIn transitions with blocking released only during Breaks
- Light + dark mode, monochrome at rest, accent green only during a session

The blocker requires Android Accessibility, Usage Access, and Display over other apps permissions.
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
Blocklist, grant the requested Android permissions, and start either an open-ended
TapIn session or a timed StudIn cycle.

## Before you ship

- Confirm `com.kupdevs.tapin` is the permanent Android application ID before the first Play upload.
- Complete the Play Console **Data Safety** form based on the release build; the current app keeps its
  feature data on-device and does not transmit it to the developer.
- Publish the privacy policy at an active public URL and add that URL to the Play listing as well as the app.
- Justify the Usage Access + overlay permissions in your store listing.
- Complete Google Play's Accessibility declaration, prominent-disclosure flow, and reviewer video.
- Build and test the signed production AAB before promoting it beyond internal testing.
