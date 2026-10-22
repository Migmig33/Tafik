import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Alert,
  AppState,
  Animated,
  Image,
  Linking,
  PermissionsAndroid,
  Platform,
  Pressable,
  StyleSheet,
  Switch,
  View,
} from "react-native";
import { AccessibilityDisclosure, UsageAccessDisclosure } from "../AccessDisclosures";
import {
  getBlockingSessionState,
  getInstalledApps,
  getScreenTimeInsights,
  hasAccessibilityAccess,
  hasAccessibilityServiceSupport,
  hasOverlayPermission,
  hasUsageAccess,
  needsRestrictedSettingHelp,
  type InstalledApp,
} from "../blocking";
import { AppMark, Body, GhostButton, PrimaryButton, Screen, TapRipple, Title } from "../components";
import CardEnrollment from "../cardEnrollment";
import { isNfcReady } from "../nfc";
import { GrantedBadge, LoadingSpinner, MOTION, ScreenFade } from "../motion";
import { Nav } from "../nav";
import { getBlocklist, getRegisteredCards, RegisteredCard, setBlocklist, setOnboardingDone } from "../store";
import { radius, space, colors, typeScale } from "../theme";
import { Text } from "../typography";
import { rankMostUsed } from "../usageRanking";
import BlocklistScreen from "./BlocklistScreen";
import PaywallScreen from "./PaywallScreen";

// POST_NOTIFICATIONS is a runtime permission only on Android 13 (API 33) and
// up. Below that it is granted at install time, so there is nothing to ask for.
const NEEDS_NOTIFICATION_PROMPT =
  Platform.OS === "android" && Number(Platform.Version) >= 33;

// How long a verified permission stays on screen before the flow moves on, so
// the user sees it turn to Granted rather than the page changing under them.
const VERIFIED_HOLD_MS = 700;

// TEMPORARY: how long the preview's simulated check spins. Preview only; a real
// grant never uses a timer, it ends when Android or the re-read says so.
const PREVIEW_CHECK_MS = 900;

async function hasNotificationPermission(): Promise<boolean> {
  if (!NEEDS_NOTIFICATION_PROMPT) return true;
  try {
    return await PermissionsAndroid.check(
      PermissionsAndroid.PERMISSIONS.POST_NOTIFICATIONS
    );
  } catch {
    return false;
  }
}

/**
 * The apps Android says the user uses most, from the screen-time data the app already
 * reads. Null when that data is not available, so the caller shows the full picker
 * instead of a guessed list.
 */
async function loadRecommendations(): Promise<InstalledApp[] | null> {
  try {
    const [days, installed] = await Promise.all([getScreenTimeInsights(), getInstalledApps()]);
    if (days === null) return null;
    return rankMostUsed(days, installed);
  } catch {
    return null;
  }
}

type PermKey = "usage" | "accessibility" | "overlay" | "notifications" | "nfc";

const PERMS: {
  key: PermKey;
  name: string;
  why: string;
}[] = [
  {
    key: "usage",
    name: "Usage access",
    why: "So Tafik can tell which app is on screen.",
  },
  {
    key: "accessibility",
    name: "Accessibility",
    why: "So blocked apps are closed immediately when opened.",
  },
  {
    key: "overlay",
    name: "Display over other apps",
    why: "So Tafik can cover blocked apps during a session.",
  },
  {
    key: "notifications",
    name: "Notifications",
    why: "To keep your session running in the background.",
  },
  {
    key: "nfc",
    name: "NFC",
    why: "To read your Tafik card when you tap it.",
  },
];

/**
 * One page per onboarding step, in the order a first use needs them: the case
 * for the app, the permissions, the card, the apps, then the first real lock and
 * the first real unlock. The index into this list is the single source of truth
 * for where the user is, and the progress bar is computed from it.
 */
type Page =
  | { kind: "intro" }
  | { kind: "permission"; key: PermKey }
  | { kind: "card" }
  | { kind: "apps" }
  | { kind: "block" }
  | { kind: "unblock" }
  | { kind: "done" }
  | { kind: "paywall" };

function formatElapsed(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000));
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const seconds = total % 60;
  const pad = (n: number) => n.toString().padStart(2, "0");
  return hours > 0 ? `${hours}:${pad(minutes)}:${pad(seconds)}` : `${pad(minutes)}:${pad(seconds)}`;
}

/**
 * Counts up from the real start of the block. The start is the native session's
 * own timestamp, so a re-render, a screen change or a relaunch never restarts it.
 */
function LiveElapsed({ since }: { since: number | null }) {
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    if (since === null) return;
    setNow(Date.now());
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, [since]);

  return (
    <Text accessibilityRole="timer" style={[styles.elapsed, { color: colors.text }]}>
      {since === null ? "--:--" : formatElapsed(now - since)}
    </Text>
  );
}

/** The step progress bar. Its fill follows the real page index, never a fixed value. */
function StepProgress({ progress, label }: { progress: number; label: string }) {
  const fill = useRef(new Animated.Value(progress)).current;

  useEffect(() => {
    // Width cannot run on the native driver, and a 3 px bar is cheap to lay out.
    const run = Animated.timing(fill, {
      toValue: progress,
      duration: MOTION.fade + 80,
      easing: MOTION.ease,
      useNativeDriver: false,
    });
    run.start();
    return () => run.stop();
  }, [fill, progress]);

  return (
    <View style={styles.progress}>
      <Text style={[styles.progressLabel, { color: colors.textDim }]}>{label}</Text>
      <View style={[styles.track, { backgroundColor: colors.border }]}>
        <Animated.View
          style={[
            styles.fill,
            {
              backgroundColor: colors.text,
              width: fill.interpolate({ inputRange: [0, 1], outputRange: ["0%", "100%"] }),
            },
          ]}
        />
      </View>
    </View>
  );
}

export default function OnboardingScreen({
  nav,
  preview = false,
  onExitPreview,
  startFirstSession,
  endFirstSession,
  scanRegisteredCard,
}: {
  nav: Nav;
  // TEMPORARY onboarding preview (see SettingsScreen "Preview Onboarding").
  // In preview nothing real is requested, opened, saved, locked or unlocked.
  preview?: boolean;
  onExitPreview?: () => void;
  /** Locks the chosen apps with the standard session. The app shell owns the native call. */
  startFirstSession: () => Promise<void>;
  /** Ends the session the first tap started. */
  endFirstSession: () => Promise<void>;
  /** Reads a card and answers whether it is one the user registered. */
  scanRegisteredCard: (kind: "start" | "end") => Promise<boolean>;
}) {
  const [usageDisclosureOpen, setUsageDisclosureOpen] = useState(false);
  const [accessibilityDisclosureOpen, setAccessibilityDisclosureOpen] = useState(false);
  const [restrictedSettingHelp, setRestrictedSettingHelp] = useState(false);
  const [granted, setGranted] = useState<Record<PermKey, boolean>>({
    usage: false,
    accessibility: false,
    overlay: false,
    notifications: false,
    nfc: false,
  });
  // The real registered cards and the real Blocklist. Both are re-read from storage,
  // never trusted from an earlier screen.
  const [cards, setCards] = useState<RegisteredCard[]>([]);
  const [appCount, setAppCount] = useState(0);
  // Whether Android reports a session running right now. The first tap's outcome is
  // taken from this, not from the tap itself.
  const [sessionActive, setSessionActive] = useState(false);
  // The native start of the current block, in epoch milliseconds. The elapsed time is
  // counted from this, so it survives re-renders, navigation and a relaunch.
  const [blockedSince, setBlockedSince] = useState<number | null>(null);
  const [selectedPkgs, setSelectedPkgs] = useState<string[]>([]);
  // Undefined while the usage read is in flight; null when Android gives no usable data.
  const [recommended, setRecommended] = useState<InstalledApp[] | null | undefined>(undefined);
  const [showAllApps, setShowAllApps] = useState(false);
  const [appNames, setAppNames] = useState<Record<string, string>>({});
  // Null until the first real read of the state has finished, so the flow never
  // flashes a page before it knows where to start. A preview always starts at the intro.
  const [index, setIndex] = useState<number | null>(preview ? 0 : null);
  // The page where the user last pressed a grant button. A hint about what is
  // still missing only shows there, so a fresh page stays calm.
  const [attemptedAt, setAttemptedAt] = useState<number | null>(null);
  // The page that was showing an unverified permission. A grant that verifies
  // only moves the flow on from that same page, so Back never triggers it.
  const pendingAdvanceAt = useRef<number | null>(null);
  // TEMPORARY: preview-only grants. Held in memory, so leaving the preview
  // discards them and nothing is written to storage.
  const [simulated, setSimulated] = useState<Partial<Record<PermKey, boolean>>>({});

  // What the app is waiting on right now, shown as the loader's label. It is
  // null whenever nothing is pending, so the loader exists only during a real
  // operation: a permission request, opening Settings, a card read or a lock check.
  const [busy, setBusy] = useState<string | null>(null);
  // Set synchronously, so a second tap before the state update lands is ignored.
  const busyRef = useRef(false);
  const mounted = useRef(true);
  const previewTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Set when the user answered "Don't allow" to the notification prompt on this
  // page, so the hint can say what to do next.
  const [denied, setDenied] = useState(false);
  // The outcome of the last card or Blocklist step, shown in place of its button hint.
  const [stepError, setStepError] = useState<string | null>(null);

  // Listing a permission the installed binary cannot grant would leave the
  // flow stuck on it, so an old APK running new JavaScript drops that page.
  const perms = useMemo(
    () => PERMS.filter((p) => p.key !== "accessibility" || hasAccessibilityServiceSupport()),
    []
  );
  const pages = useMemo<Page[]>(
    () => [
      { kind: "intro" },
      ...perms.map((p) => ({ kind: "permission" as const, key: p.key })),
      { kind: "card" },
      { kind: "apps" },
      { kind: "block" },
      { kind: "unblock" },
      { kind: "done" },
      { kind: "paywall" },
    ],
    [perms]
  );
  const blockIndex = pages.findIndex((p) => p.kind === "block");
  const appsIndex = pages.findIndex((p) => p.kind === "apps");
  const unblockIndex = pages.findIndex((p) => p.kind === "unblock");
  // The congratulations page is the last step of the first use; the paywall follows it.
  const doneIndex = pages.length - 2;
  const paywallIndex = pages.length - 1;

  // Every permission here is granted outside the app, and the card, Blocklist and
  // session live in storage and native state, so the only honest way to know is to
  // re-read all of it each time the user comes back to us.
  const refresh = useCallback(
    async (initial: boolean) => {
      const [usage, accessibility, overlay, notifications, nfc, savedCards, list, session] =
        await Promise.all([
          hasUsageAccess(),
          hasAccessibilityAccess(),
          hasOverlayPermission(),
          hasNotificationPermission(),
          isNfcReady(),
          getRegisteredCards(),
          getBlocklist(),
          getBlockingSessionState().catch(() => null),
        ]);
      const grantedNow = { usage, accessibility, overlay, notifications, nfc };
      const sessionOn = session?.active === true;
      setGranted(grantedNow);
      setCards(savedCards);
      setAppCount(list.length);
      setSessionActive(sessionOn);
      setBlockedSince(sessionOn && session && session.sessionStartedAt > 0 ? session.sessionStartedAt : null);
      setSelectedPkgs(list);

      // A session that ended while the unlock page was showing (an emergency unlock,
      // for one) leaves nothing to unlock, so that page hands back to the lock page.
      if (!initial) {
        if (!sessionOn) {
          setIndex((current) =>
            current !== null && pages[current]?.kind === "unblock" ? blockIndex : current
          );
        }
        return;
      }

      // Resume where the user actually is, judged from real state rather than a
      // stored flag: a live session goes straight to unlocking; otherwise the first
      // step that is not yet satisfied.
      const isDone = (page: Page): boolean => {
        if (page.kind === "intro") return true;
        if (page.kind === "permission") return grantedNow[page.key];
        if (page.kind === "card") return savedCards.length > 0;
        if (page.kind === "apps") return list.length > 0;
        return false;
      };
      const progressed =
        perms.some((p) => grantedNow[p.key]) || savedCards.length > 0 || list.length > 0 || sessionOn;
      let start = 0;
      if (sessionOn) {
        start = unblockIndex;
      } else if (progressed) {
        const open = pages.findIndex((p) => !isDone(p));
        start = open === -1 ? doneIndex : open;
      }
      // A preview never moves the start point off the intro.
      setIndex((current) => current ?? (preview ? 0 : start));
    },
    [perms, pages, preview, blockIndex, unblockIndex, doneIndex]
  );

  // A real re-read, with the loader shown while it is genuinely pending. The
  // loader clears when the read resolves, however it resolves.
  const verify = useCallback(async () => {
    if (!busyRef.current) setBusy("Checking…");
    try {
      await refresh(false);
    } finally {
      if (mounted.current && !busyRef.current) setBusy(null);
    }
  }, [refresh]);

  useEffect(() => {
    void refresh(true);
    const subscription = AppState.addEventListener("change", (state) => {
      if (state === "active") void verify();
    });
    return () => subscription.remove();
  }, [refresh, verify]);

  // Who installed the app cannot change while it is running, so unlike the
  // permissions above this is read once instead of on every resume.
  useEffect(() => {
    needsRestrictedSettingHelp().then(setRestrictedSettingHelp);
  }, []);


  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      if (previewTimer.current) clearTimeout(previewTimer.current);
    };
  }, []);

  const page = index !== null ? pages[index] : null;

  // Usage is read when the apps page is reached, not at mount, because the usage
  // permission may only be granted a few pages earlier. A preview never reads it.
  const onAppsPage = page?.kind === "apps" && !preview;
  useEffect(() => {
    if (!onAppsPage) return;
    setRecommended(undefined);
    void loadRecommendations().then(setRecommended);
  }, [onAppsPage]);

  // The unlock page names the blocked apps. Their names are read once, on arrival.
  const onUnblockPage = page?.kind === "unblock" && !preview;
  useEffect(() => {
    if (!onUnblockPage) return;
    getInstalledApps()
      .then((apps) => setAppNames(Object.fromEntries(apps.map((app) => [app.pkg, app.name]))))
      .catch(() => {});
  }, [onUnblockPage]);
  const currentKey = page?.kind === "permission" ? page.key : null;
  const verified =
    currentKey !== null && (granted[currentKey] || (preview && simulated[currentKey] === true));

  // Moves on once a permission is verified on the page the user is looking at.
  // It only does so if the page was showing that permission as missing first,
  // so arriving on an already-granted page (by Back or on relaunch) stays put.
  useEffect(() => {
    if (index === null || currentKey === null) return;
    if (!verified) {
      pendingAdvanceAt.current = index;
      return;
    }
    if (pendingAdvanceAt.current !== index) return;
    pendingAdvanceAt.current = null;
    const timer = setTimeout(() => {
      setIndex((current) => (current === index ? index + 1 : current));
    }, VERIFIED_HOLD_MS);
    return () => clearTimeout(timer);
  }, [index, currentKey, verified]);

  const goTo = (next: number) => {
    // Nothing moves while Android or a check is still answering.
    if (busyRef.current) return;
    setAttemptedAt(null);
    setDenied(false);
    setStepError(null);
    setIndex(next);
  };

  const grant = async (key: PermKey) => {
    // TEMPORARY: a preview simulates the grant. The loader runs for a moment so
    // its motion can be inspected, then the permission is marked as simulated.
    // No dialog opens and no Settings screen is launched.
    if (preview) {
      if (busyRef.current) return;
      busyRef.current = true;
      setBusy("Checking permission…");
      previewTimer.current = setTimeout(() => {
        previewTimer.current = null;
        busyRef.current = false;
        if (!mounted.current) return;
        setBusy(null);
        setSimulated((current) => ({ ...current, [key]: true }));
      }, PREVIEW_CHECK_MS);
      return;
    }

    // The disclosure sheets and the rebuild check open nothing the app waits
    // on, so they never show a loader.
    if (key === "usage") {
      setUsageDisclosureOpen(true);
      return;
    }
    if (key === "accessibility") {
      if (!hasAccessibilityServiceSupport()) {
        Alert.alert(
          "Native rebuild required",
          "This installed Tafik build does not contain the app-blocking Accessibility service yet. Install a newly built APK; Expo Start cannot add native Android services."
        );
        return;
      }
      setAccessibilityDisclosureOpen(true);
      return;
    }

    // Repeated taps while an operation is in flight do nothing.
    if (busyRef.current) return;
    busyRef.current = true;
    if (index !== null) setAttemptedAt(index);
    setDenied(false);

    try {
      if (key === "notifications") {
        if (NEEDS_NOTIFICATION_PROMPT) {
          setBusy("Requesting permission…");
          const result = await PermissionsAndroid.request(
            PermissionsAndroid.PERMISSIONS.POST_NOTIFICATIONS
          );
          if (result === PermissionsAndroid.RESULTS.NEVER_ASK_AGAIN) {
            // "Never ask again" means the dialog will not appear again, so send
            // the user somewhere they can still say yes. Waiting there is the
            // user's action, so no loader is shown for it.
            setBusy(null);
            await Linking.openSettings();
          } else if (result === PermissionsAndroid.RESULTS.DENIED) {
            setDenied(true);
          }
        }
      } else if (key === "overlay") {
        setBusy("Opening Settings…");
        await Linking.sendIntent("android.settings.action.MANAGE_OVERLAY_PERMISSION");
      } else {
        setBusy("Opening Settings…");
        await Linking.sendIntent("android.settings.NFC_SETTINGS");
      }
    } catch {
      // If the settings screen cannot be opened directly, the app's own
      // settings page is always reachable and gets the user to the same place.
      try {
        await Linking.openSettings();
      } catch {
        /* nothing more we can do from here */
      }
    } finally {
      busyRef.current = false;
      if (mounted.current) setBusy(null);
    }

    // The request dialog has closed, so the answer is re-read from Android
    // rather than taken from the dialog. Settings is verified when we return.
    if (key === "notifications") await verify();
  };

  /**
   * The real card tap for the first lock and the first unlock. The card has to be
   * one the user registered (scanRegisteredCard checks that), and the outcome is
   * read back from the native session, so a tap that did not change anything is
   * reported as a failure rather than passed over.
   */
  const tapCard = async (kind: "start" | "end") => {
    if (busyRef.current || index === null) return;
    busyRef.current = true;
    setStepError(null);
    setBusy("Reading card…");
    try {
      const matched = await scanRegisteredCard(kind);
      if (!matched) return;
      if (kind === "start") {
        setBusy("Locking apps…");
        await startFirstSession();
        const live = await getBlockingSessionState();
        if (!live.active) throw new Error("Tafik didn't confirm the apps are locked. Tap your card again.");
        setSessionActive(true);
        setBlockedSince(live.sessionStartedAt > 0 ? live.sessionStartedAt : null);
        setIndex(unblockIndex);
      } else {
        setBusy("Unlocking apps…");
        await endFirstSession();
        const live = await getBlockingSessionState();
        if (live.active) throw new Error("The apps are still locked. Tap your card again.");
        // Both taps are now verified. Onboarding is saved only when the user goes Home.
        setSessionActive(false);
        setBlockedSince(null);
        setIndex(doneIndex);
      }
    } catch (error: any) {
      setStepError(error?.message ?? "Tafik couldn't complete that tap. Try again.");
    } finally {
      busyRef.current = false;
      if (mounted.current) setBusy(null);
    }
  };

  // Saved as it changes, through the same Blocklist storage the Blocklist screen uses.
  const togglePkg = async (pkg: string) => {
    const list = await getBlocklist();
    const next = list.includes(pkg) ? list.filter((p) => p !== pkg) : [...list, pkg];
    await setBlocklist(next);
    setSelectedPkgs(next);
    setAppCount(next.length);
  };

  // The Blocklist step only moves on when the saved list really has an app in it.
  const continueFromApps = async () => {
    if (busyRef.current || index === null) return;
    const list = await getBlocklist();
    setAppCount(list.length);
    if (list.length === 0) {
      setStepError("Choose at least one app to continue.");
      return;
    }
    goTo(index + 1);
  };

  const onCardSaved = (next: RegisteredCard[]) => {
    setCards(next);
    if (index !== null) goTo(index + 1);
  };

  const finish = async () => {
    // A preview ends by leaving; it must never touch the real onboarding state.
    if (preview) {
      onExitPreview?.();
      return;
    }
    // Only reachable once the first lock and the first unlock have both been verified.
    await setOnboardingDone(true).catch(() => {});
    nav("home");
  };

  // The progress bar counts pages, not granted permissions, so it never implies
  // that Android has granted anything the user has not actually turned on.
  const progress = index === null ? 0 : index / doneIndex;
  // The intro and the finish page are not counted, so the numbers run 1 of N to N of N.
  const stepsTotal = doneIndex - 1;
  const stepLabel =
    page?.kind === "intro"
      ? "Setup"
      : page?.kind === "done"
        ? "Complete"
        : index !== null
          ? `Step ${index} of ${stepsTotal}`
          : "";

  if (index === null || page === null) {
    return <Screen>{null}</Screen>;
  }

  // The plan choice comes after the congratulations, so it never interrupts the
  // first lock and unlock. Free is the only path that finishes onboarding.
  if (page.kind === "paywall") {
    return <PaywallScreen onContinueFree={() => void finish()} />;
  }

  const progressBar = (
    <StepProgress progress={progress} label={preview ? `Preview · ${stepLabel}` : stepLabel} />
  );

  // The Blocklist is a full screen of its own, so the apps page hands the frame
  // to it, with the same progress bar on top and the confirming footer below.
  if (page.kind === "apps" && !preview) {
    // Still reading usage: say so rather than showing a list that is not ready.
    if (recommended === undefined) {
      return (
        <Screen>
          {progressBar}
          <View style={styles.page}>
            <View style={styles.busyRow}>
              <LoadingSpinner size={34} />
              <Text style={[styles.busyText, { color: colors.textDim }]}>Finding your most-used apps…</Text>
            </View>
          </View>
        </Screen>
      );
    }

    // At most five of the apps Android says the user uses most. Nothing is selected
    // for them; the user picks, and the Continue button needs at least one.
    if (recommended && recommended.length > 0 && !showAllApps) {
      return (
        <Screen>
          {progressBar}
          <Title bold>Your most-used apps</Title>
          <View style={{ height: space(1) }} />
          <Body dim>Pick the ones to block. Tafik only locks what you choose.</Body>
          <View style={[styles.recommendedList, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            {recommended.map((app, i) => {
              const selected = selectedPkgs.includes(app.pkg);
              return (
                <Pressable
                  key={app.pkg}
                  accessibilityRole="switch"
                  accessibilityState={{ checked: selected }}
                  onPress={() => void togglePkg(app.pkg)}
                  style={[
                    styles.appRow,
                    i > 0 && { borderTopWidth: StyleSheet.hairlineWidth, borderColor: colors.border },
                  ]}
                >
                  <Image
                    source={{ uri: app.icon }}
                    style={[styles.appIcon, { backgroundColor: colors.accentWash }]}
                    resizeMode="contain"
                    fadeDuration={0}
                  />
                  <Text numberOfLines={1} style={[styles.appName, { color: colors.text }]}>
                    {app.name}
                  </Text>
                  <Switch
                    value={selected}
                    onValueChange={() => void togglePkg(app.pkg)}
                    trackColor={{ true: colors.accent, false: colors.border }}
                    thumbColor={selected ? colors.onAccent : colors.textDim}
                  />
                </Pressable>
              );
            })}
          </View>
          <View style={styles.actions}>
            {stepError ? <Body dim>{stepError}</Body> : null}
            <PrimaryButton
              label="Continue"
              disabled={selectedPkgs.length === 0 || busy !== null}
              onPress={() => void continueFromApps()}
            />
            <GhostButton label="Choose from all apps" onPress={() => setShowAllApps(true)} />
            <GhostButton label="Back" onPress={() => goTo(index - 1)} />
          </View>
        </Screen>
      );
    }

    // No usable usage data (or none eligible): the full picker, not a guessed list.
    return (
      <BlocklistScreen
        top={progressBar}
        footer={(selectedCount) => (
          <>
            {stepError ? <Body dim>{stepError}</Body> : null}
            <PrimaryButton
              label="Continue"
              disabled={selectedCount === 0 || busy !== null}
              onPress={() => void continueFromApps()}
            />
            <GhostButton label="Back" onPress={() => goTo(index - 1)} />
          </>
        )}
      />
    );
  }

  const copy =
    page.kind === "permission" ? PERMS.find((p) => p.key === page.key) ?? null : null;

  const hint =
    copy?.key === "notifications" && denied
      ? "Notifications were not allowed. Try again to be asked once more."
      : `Not turned on yet. Switch ${copy?.name ?? "this permission"} on in Settings, then come back here.`;

  const appsWord = appCount === 1 ? "app" : "apps";
  const blockedNames = selectedPkgs.map((pkg) => appNames[pkg]).filter((name): name is string => !!name);
  const blockedLabel =
    blockedNames.length > 0
      ? blockedNames.join(", ")
      : `${selectedPkgs.length} ${selectedPkgs.length === 1 ? "app" : "apps"} blocked`;

  return (
    <Screen>
      {progressBar}

      <ScreenFade key={index}>
        <View style={styles.page}>
          {page.kind === "intro" && (
            <>
              <Title bold>One card locks your apps.</Title>
              <View style={{ height: space(1.5) }} />
              <Body dim>
                Tafik locks the apps you choose. Tap your registered NFC card to lock them, and
                tap it again to unlock. Next, you'll grant {perms.length} permissions, register
                a card and choose your apps.
              </Body>
            </>
          )}

          {page.kind === "permission" && copy && (
            <>
              <Text style={[styles.required, { color: colors.textDim }]}>Required</Text>
              <Title bold>{copy.name}</Title>
              <View style={{ height: space(1.5) }} />
              <Body dim>{copy.why}</Body>
              <View style={{ height: space(3) }} />

              {/* A fixed-height row, so the loader, the confirmation and the hint
                  all take the same space and nothing below them jumps. */}
              <View style={styles.statusRow}>
                {busy ? (
                  <View style={styles.busyRow}>
                    <LoadingSpinner size={34} />
                    <Text style={[styles.busyText, { color: colors.textDim }]}>{busy}</Text>
                  </View>
                ) : verified ? (
                  <GrantedBadge />
                ) : attemptedAt === index ? (
                  <Body dim>{hint}</Body>
                ) : null}
              </View>
            </>
          )}

          {page.kind === "card" && !preview && (
            // The same registration wizard Settings uses, so the card is registered
            // exactly the way it is everywhere else.
            <CardEnrollment
              bold
              cards={cards}
              doneLabel="Continue"
              returnLabel="Back"
              onSaved={onCardSaved}
              onCancel={() => goTo(index - 1)}
            />
          )}

          {page.kind === "card" && preview && (
            <>
              <Title bold>Register your card</Title>
              <View style={{ height: space(1.5) }} />
              <Body dim>
                Here you hold your NFC card to the back of the phone once, then again to confirm
                it. Preview doesn't register a card.
              </Body>
            </>
          )}

          {page.kind === "apps" && preview && (
            <>
              <Title bold>Choose your apps</Title>
              <View style={{ height: space(1.5) }} />
              <Body dim>
                Here you pick the apps Tafik will lock when the card is tapped. Preview doesn't
                change your Blocklist.
              </Body>
            </>
          )}

          {page.kind === "block" && (
            <>
              <Title bold>Tap to lock</Title>
              <View style={{ height: space(1.5) }} />
              <Body dim>
                {preview
                  ? "Hold your card to the back of your phone to lock the apps you chose. Preview locks nothing."
                  : `Hold your registered card to the back of your phone. Tafik locks the ${appCount} ${appsWord} you chose.`}
              </Body>
              <View style={styles.stage}>
                <TapRipple active={busy !== null} size={184} coreSize={116}>
                  <AppMark height={72} color={colors.text} />
                </TapRipple>
              </View>
              <View style={styles.statusRow}>
                {busy ? (
                  <View style={styles.busyRow}>
                    <LoadingSpinner size={34} />
                    <Text style={[styles.busyText, { color: colors.textDim }]}>{busy}</Text>
                  </View>
                ) : stepError ? (
                  <Body dim>{stepError}</Body>
                ) : null}
              </View>
            </>
          )}

          {page.kind === "unblock" && (
            <>
              <Title bold>{preview ? "Tap to unlock" : "Apps are blocked"}</Title>
              <View style={{ height: space(1.5) }} />
              <Body dim>
                {preview
                  ? "Hold the same card to the back of your phone to unlock the apps. Preview unlocks nothing."
                  : "Tap the same card again to unblock them."}
              </Body>
              {!preview && (
                <View style={styles.blockedInfo}>
                  <Text style={[styles.elapsedLabel, { color: colors.textDim }]}>Blocked for</Text>
                  <LiveElapsed since={blockedSince} />
                  <Body dim>{blockedLabel}</Body>
                </View>
              )}
              <View style={styles.stage}>
                <TapRipple active={busy !== null} size={184} coreSize={116}>
                  <AppMark height={72} color={colors.text} />
                </TapRipple>
              </View>
              <View style={styles.statusRow}>
                {busy ? (
                  <View style={styles.busyRow}>
                    <LoadingSpinner size={34} />
                    <Text style={[styles.busyText, { color: colors.textDim }]}>{busy}</Text>
                  </View>
                ) : stepError ? (
                  <Body dim>{stepError}</Body>
                ) : null}
              </View>
            </>
          )}

          {page.kind === "done" && (
            <>
              <Title bold>You're all set.</Title>
              <View style={{ height: space(1.5) }} />
              <Body dim>You've registered your card and successfully tested TAFIK.</Body>
            </>
          )}
        </View>
      </ScreenFade>

      <View style={styles.actions}>
        {page.kind === "intro" && (
          <PrimaryButton label="Get started" onPress={() => goTo(1)} />
        )}

        {page.kind === "permission" && (
          <PrimaryButton
            label={
              verified ? "Continue" : attemptedAt === index && !busy ? "Try again" : "Grant permission"
            }
            disabled={!verified && !!busy}
            onPress={() => (verified ? goTo(index + 1) : void grant(page.key))}
          />
        )}

        {page.kind === "card" && preview && (
          <PrimaryButton label="Next in preview" onPress={() => goTo(index + 1)} />
        )}

        {page.kind === "apps" && preview && (
          <PrimaryButton label="Next in preview" onPress={() => goTo(index + 1)} />
        )}

        {page.kind === "block" && preview && (
          <PrimaryButton label="Next in preview" onPress={() => goTo(index + 1)} />
        )}

        {page.kind === "block" && !preview && sessionActive && (
          <PrimaryButton label="Continue" onPress={() => goTo(unblockIndex)} />
        )}

        {page.kind === "block" && !preview && !sessionActive && (
          <>
            <PrimaryButton
              label="Tap card to lock"
              disabled={busy !== null}
              onPress={() => void tapCard("start")}
            />
            <GhostButton label="Change apps" onPress={() => goTo(appsIndex)} />
          </>
        )}

        {page.kind === "unblock" && preview && (
          <PrimaryButton label="Next in preview" onPress={() => goTo(index + 1)} />
        )}

        {page.kind === "unblock" && !preview && (
          <>
            <PrimaryButton
              label="Tap card to unlock"
              disabled={busy !== null}
              onPress={() => void tapCard("end")}
            />
            <GhostButton label="Card lost? Emergency unlock" onPress={() => nav("emergency")} />
          </>
        )}

        {page.kind === "done" && (
          <PrimaryButton label="Continue" onPress={() => goTo(paywallIndex)} />
        )}

        {index > 0 && page.kind === "permission" && (
          <GhostButton label="Back" onPress={() => goTo(index - 1)} />
        )}

        {/* TEMPORARY: the way out of the preview from any page. */}
        {preview && <GhostButton label="Exit preview" onPress={() => onExitPreview?.()} />}
      </View>

      <AccessibilityDisclosure
        visible={accessibilityDisclosureOpen}
        restrictedSettingHelp={restrictedSettingHelp}
        onDecline={() => setAccessibilityDisclosureOpen(false)}
        onAgree={() => {
          setAccessibilityDisclosureOpen(false);
          Linking.sendIntent("android.settings.ACCESSIBILITY_SETTINGS").catch(() =>
            Linking.openSettings()
          );
        }}
      />

      <UsageAccessDisclosure
        visible={usageDisclosureOpen}
        onDecline={() => setUsageDisclosureOpen(false)}
        onAgree={() => {
          setUsageDisclosureOpen(false);
          Linking.sendIntent("android.settings.USAGE_ACCESS_SETTINGS").catch(() =>
            Linking.openSettings()
          );
        }}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  progress: {
    gap: space(1),
    marginBottom: space(3),
  },
  progressLabel: {
    ...typeScale.label,
    fontWeight: "600",
  },
  track: {
    height: 3,
    borderRadius: 2,
    overflow: "hidden",
  },
  fill: {
    height: 3,
  },
  page: {
    flex: 1,
    justifyContent: "center",
  },
  required: {
    ...typeScale.label,
    fontWeight: "600",
    marginBottom: space(1),
  },
  stage: {
    alignItems: "center",
    justifyContent: "center",
    marginVertical: space(2),
  },
  statusRow: {
    minHeight: 56,
    justifyContent: "center",
  },
  busyRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: space(1.5),
  },
  busyText: {
    ...typeScale.callout,
    fontWeight: "600",
  },
  actions: {
    gap: space(1),
    paddingBottom: space(1),
  },
  recommendedList: {
    marginTop: space(2.5),
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: radius.card,
    paddingHorizontal: space(1.5),
    overflow: "hidden",
  },
  appRow: {
    minHeight: 68,
    flexDirection: "row",
    alignItems: "center",
    gap: space(1.25),
  },
  appIcon: {
    width: 42,
    height: 42,
    borderRadius: 11,
  },
  appName: {
    flex: 1,
    fontSize: typeScale.callout.fontSize,
    fontWeight: "500",
  },
  blockedInfo: {
    alignItems: "center",
    gap: space(0.75),
    marginTop: space(2.5),
  },
  elapsedLabel: {
    ...typeScale.label,
    fontWeight: "600",
  },
  elapsed: {
    fontSize: typeScale.display.fontSize,
    lineHeight: typeScale.display.lineHeight,
    fontWeight: "700",
    fontVariant: ["tabular-nums"],
  },
});
