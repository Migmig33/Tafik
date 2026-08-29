# Focus Card

Tap an NFC card to start a locked focus session; tap again to end it.
Android-first. One-time paid app, 100% on-device, no backend, no accounts.

## What runs today (this repo)

The full JS shell, on your own phone:

- Onboarding / permissions flow (deep-links to the right Android settings)
- Home — idle and active-session states, with a live tabular timer
- Blocklist editor (search + toggles, persisted locally)
- Card setup — reads a real NFC card and does the tap-twice UID stability check
- Block overlay — the shield UI (previewable from Home → "Preview block overlay")
- Light + dark mode, monochrome at rest, accent green only during a session

## What is NOT built yet

The native blocking engine (foreground service + UsageStats detection + overlay)
and the installed-app query. See **NATIVE.md** — that's your next focused session.
Until then the blocklist uses a placeholder app list and the overlay is a preview.

## Run it on your phone today

Requires: Node 18+, a **physical Android phone with NFC** (Expo Go will NOT work —
NFC needs a dev build), USB debugging on, and Android Studio / platform tools.

```bash
npm install
npx expo install       # aligns native versions to the installed Expo SDK
npx expo run:android   # builds a dev client and installs it on your device
```

Then tap your card on the Card setup screen to register it, pick some apps on the
Blocklist, and walk the flow. NFC reads work; the block overlay is a preview
until you build the native module in NATIVE.md.

## Before you rename / ship

- Change `name`, `slug`, `android.package` in `app.json` (currently placeholders).
- Fill the Play Console **Data Safety** form as "no data collected / stays on device".
- Justify the Usage Access + overlay permissions in your store listing.
- Set your one-time price in Play Console (no billing SDK needed for paid-up-front).
