import { StatusBar } from "expo-status-bar";
import { Poppins_400Regular } from "@expo-google-fonts/poppins/400Regular";
import { Poppins_500Medium } from "@expo-google-fonts/poppins/500Medium";
import { Poppins_600SemiBold } from "@expo-google-fonts/poppins/600SemiBold";
import { Poppins_700Bold } from "@expo-google-fonts/poppins/700Bold";
import { useFonts } from "expo-font";
import { useEffect, useRef, useState } from "react";
import { Alert, BackHandler, View } from "react-native";
import {
  BlockingSessionState,
  consumeCycleResult,
  endBlockingSession,
  getBlockingSessionState,
  hasAccessibilityAccess,
  hasAccessibilityServiceSupport,
  hasCycleSessionSupport,
  startBlockingSession,
  startCycleBlockingSession,
} from "./src/blocking";
import ErrorBoundary from "./src/ErrorBoundary";
import BottomNav from "./src/BottomNav";
import { ScreenName } from "./src/nav";
import { cancelCardRead, readCardUid } from "./src/nfc";
import BlocklistScreen from "./src/screens/BlocklistScreen";
import CardSetupScreen from "./src/screens/CardSetupScreen";
import EmergencyScreen from "./src/screens/EmergencyScreen";
import HomeScreen from "./src/screens/HomeScreen";
import NfcTapScreen from "./src/screens/NfcTapScreen";
import IntroScreen from "./src/screens/IntroScreen";
import InsightsScreen from "./src/screens/InsightsScreen";
import OnboardingScreen from "./src/screens/OnboardingScreen";
import PrivacyPolicyScreen from "./src/screens/PrivacyPolicyScreen";
import SettingsScreen from "./src/screens/SettingsScreen";
import CycleScreen from "./src/screens/CycleScreen";
import WelcomeScreen from "./src/screens/WelcomeScreen";
import {
  clearActiveSessionStartedAt,
  consumeEmergencyUnlock,
  EMERGENCY_HOLD_SECONDS,
  getEmergencyUnlocksLeft,
  getActiveSessionStartedAt,
  getBlocklist,
  getOnboardingDone,
  getThemeMode,
  getRegisteredCards,
  type FocusMode,
  getFocusMode,
  getCycleConfig,
  getWelcomeSeen,
  purgeRetiredKeys,
  recordSession,
  setActiveSessionStartedAt,
  setWelcomeSeen,
} from "./src/store";
import { applyThemeMode, colors, useThemeMode } from "./src/theme";
import { ScreenFade } from "./src/motion";
import { TabBarBelowContext } from "./src/tabBar";

/**
 * What starting a cycle actually commits the user to. Said before the
 * cycle begins rather than discovered halfway through it: a Study interval is
 * the one state in the app where tapping the card does nothing, and finding
 * that out while locked out is the worst possible moment to learn it.
 */
function cycleCommitment(unlocksLeft: number): string {
  return (
    "Once Study starts, your card will not end it. The card works again during a " +
    "Break, and tapping it then ends the whole cycle.\n\n" +
    `If you need out during Study, an emergency unlock is the only way. It takes a ` +
    `${EMERGENCY_HOLD_SECONDS} second hold, and you have ${unlocksLeft} left this month.`
  );
}

function AppContent() {
  // Re-renders the whole app on a theme change, so every colour updates at once.
  const themeMode = useThemeMode();
  // TEMPORARY onboarding preview: shows the first-launch flow without touching real state.
  const [onboardingPreview, setOnboardingPreview] = useState(false);
  // TEMPORARY: a preview opens on the intro, as a first launch does, before the permission pages.
  const [previewIntro, setPreviewIntro] = useState(false);
  const exitPreview = () => {
    setOnboardingPreview(false);
    setPreviewIntro(false);
    setScreen("settings");
  };
  const [ready, setReady] = useState(false);
  const [introFinished, setIntroFinished] = useState(false);
  // Assume seen until storage says otherwise, so a returning user never gets a
  // flash of the first-run copy while the read is in flight.
  const [welcomeSeen, setWelcomeSeenState] = useState(true);
  const [screen, setScreen] = useState<ScreenName>("onboarding");

  // The native foreground service owns enforcement; JS reflects its session state.
  const [active, setActive] = useState(false);
  const [startedAt, setStartedAt] = useState<number | null>(null);
  const [cycleSession, setCycleSession] = useState<BlockingSessionState | null>(null);
  const [cycleCompleted, setCycleCompleted] = useState(false);
  const [blockCount, setBlockCount] = useState(0);
  // Held here rather than read per screen so the tab bar's centre button and
  // home's circle always show the same mode at the same moment.
  const [focusMode, setFocusMode] = useState<FocusMode>("tafik");
  // Which read is open, if any. Arming the reader stays a deliberate step so a
  // stray card cannot lock or unlock the phone; the tab bar's centre button is
  // what arms it, and home renders the feedback.
  const [scanning, setScanning] = useState<null | "start" | "end" | "cycle">(null);
  // Android back returns from the card screen to Home instead of leaving the app.
  useEffect(() => {
    const sub = BackHandler.addEventListener("hardwareBackPress", () => {
      if (screen !== "nfc") return false;
      setScreen("home");
      return true;
    });
    return () => sub.remove();
  }, [screen]);
  const endingSession = useRef(false);
  const syncingCycle = useRef(false);

  useEffect(() => {
    (async () => {
      const [done, savedFocusMode, accessibility, list, nativeSession, savedStartedAt, seenWelcome, savedTheme] = await Promise.all([
        getOnboardingDone(),
        getFocusMode(),
        hasAccessibilityAccess(),
        getBlocklist(),
        getBlockingSessionState(),
        getActiveSessionStartedAt(),
        getWelcomeSeen(),
        getThemeMode(),
      ]);
      // Dark stays the default for anyone who has never chosen. A saved choice is
      // applied as it is read, so the first real frame already has the right colours.
      applyThemeMode(savedTheme ?? "dark");
      const result = await consumeCycleResult();
      if (result.focusSeconds > 0) await recordSession(result.focusSeconds, result.completed, { mode: "cycle" });
      const sessionActive = nativeSession.active;
      setBlockCount(list.length);
      setFocusMode(savedFocusMode);
      setWelcomeSeenState(seenWelcome);
      setActive(sessionActive);
      setCycleCompleted(result.completed);
      if (sessionActive && nativeSession.mode === "cycle") {
        setCycleSession(nativeSession);
        setStartedAt(null);
        if (savedStartedAt !== null) await clearActiveSessionStartedAt();
      } else if (sessionActive) {
        setStartedAt((savedStartedAt ?? nativeSession.sessionStartedAt) || Date.now());
      } else if (savedStartedAt !== null) {
        await clearActiveSessionStartedAt();
      }
      // Existing installs completed onboarding before Accessibility was part
      // of it. Route them through the new disclosure, but never hide an active
      // session's NFC unlock screen if access was disabled mid-session.
      const sessionScreen =
        nativeSession.mode === "cycle" || result.completed ? "cycle" : "home";
      // A binary whose native module predates the Accessibility service can
      // neither report nor grant it, so gating on it there would strand the
      // user in onboarding behind a button that can only explain itself. Such
      // a build carries new JavaScript on an old APK; the disclosure returns
      // as soon as the rebuilt module can answer for the permission.
      const accessibilityReady = accessibility || !hasAccessibilityServiceSupport();
      setScreen(done && (accessibilityReady || sessionActive) ? sessionScreen : "onboarding");
      setReady(true);
    })();
  }, []);

  // Cleared on launch rather than on the way out of the removed feature: the
  // build that dropped it is the first one that can reach these phones at all.
  useEffect(() => {
    void purgeRetiredKeys().catch(() => {});
  }, []);

  // Refresh block count whenever we land back on home.
  useEffect(() => {
    if (screen === "home") getBlocklist().then((l) => setBlockCount(l.length));
  }, [screen]);

  // Native time is authoritative. Polling only mirrors it into the visible UI;
  // the foreground service performs the actual phase transitions and blocking.
  useEffect(() => {
    if (!active || cycleSession?.mode !== "cycle") return;
    let cancelled = false;

    const refresh = async () => {
      if (syncingCycle.current || endingSession.current) return;
      syncingCycle.current = true;
      try {
        const next = await getBlockingSessionState();
        if (cancelled) return;
        if (next.active && next.mode === "cycle") {
          setCycleSession(next);
          return;
        }

        setActive(false);
        setCycleSession(null);
        const result = await consumeCycleResult();
        if (result.focusSeconds > 0) {
          await recordSession(result.focusSeconds, result.completed, {
            mode: "cycle",
            rounds: cycleSession?.totalRounds,
          });
        }
        if (!cancelled && result.completed) {
          setCycleCompleted(true);
          setScreen("cycle");
        }
      } finally {
        syncingCycle.current = false;
      }
    };

    const id = setInterval(() => void refresh(), 500);
    void refresh();
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, [active, cycleSession?.mode]);

  // An armed reader that outlives the screen showing the ripple would sit
  // listening with nothing on screen to say so.
  useEffect(() => {
    if (screen !== "nfc" && screen !== "cycle") void cancelCardRead();
  }, [screen]);

  // Hold on a bare background until storage answers, so we know which of the
  // two openings to play. The read is a few milliseconds; starting the intro
  // first would show the intro twice on a first launch.
  if (!ready) {
    return (
      <>
        <StatusBar style={themeMode === "light" ? "dark" : "light"} />
        <View style={{ flex: 1, backgroundColor: colors.bg }} />
      </>
    );
  }

  // First launch ever: the case for the app, ending on the same lockup the
  // ordinary intro shows, then a button. No timer — the user leaves when ready.
  if (!welcomeSeen) {
    const finishWelcome = async () => {
      await setWelcomeSeen(true);
      setWelcomeSeenState(true);
      // They just watched the lockup animate in; do not replay it.
      setIntroFinished(true);
    };
    return (
      <>
        <StatusBar style={themeMode === "light" ? "dark" : "light"} />
        <WelcomeScreen onGetStarted={finishWelcome} />
      </>
    );
  }

  // Keep the launch animation visible for its full duration. Every later start.
  if (!introFinished) {
    return (
      <>
        <StatusBar style={themeMode === "light" ? "dark" : "light"} />
        <IntroScreen onFinish={() => setIntroFinished(true)} />
      </>
    );
  }

  const startSession = async () => {
    const list = await getBlocklist();
    const sessionStartedAt = Date.now();
    await setActiveSessionStartedAt(sessionStartedAt);
    try {
      await startBlockingSession(list);
    } catch (error) {
      await clearActiveSessionStartedAt();
      throw error;
    }
    setActive(true);
    setStartedAt(sessionStartedAt);
    setCycleSession(null);
    setCycleCompleted(false);
  };

  // A session ended by the emergency unlock is a cancel, so it never earns its
  // day in the streak, however long it ran.
  const endSession = async ({ cancelled = false }: { cancelled?: boolean } = {}) => {
    if (endingSession.current) return;
    endingSession.current = true;
    try {
      const endingCycle = cycleSession?.mode === "cycle";
      const sessionStartedAt = startedAt ?? (await getActiveSessionStartedAt());
      await endBlockingSession();
      if (endingCycle) {
        const result = await consumeCycleResult();
        if (result.focusSeconds > 0) {
          await recordSession(result.focusSeconds, result.completed && !cancelled, {
            mode: "cycle",
            rounds: cycleSession?.totalRounds,
          });
        }
      } else if (sessionStartedAt !== null) {
        const elapsedSeconds = Math.floor((Date.now() - sessionStartedAt) / 1000);
        await recordSession(elapsedSeconds, !cancelled, { mode: "tafik" });
      }
      await clearActiveSessionStartedAt();
      setActive(false);
      setStartedAt(null);
      setCycleSession(null);
      setCycleCompleted(false);
    } finally {
      endingSession.current = false;
    }
  };

  const startCycle = async () => {
    const [list, config] = await Promise.all([getBlocklist(), getCycleConfig()]);
    await startCycleBlockingSession(
      list,
      config.studyMinutes,
      config.breakMinutes,
      config.rounds
    );
    const nativeSession = await getBlockingSessionState();
    await clearActiveSessionStartedAt();
    setActive(true);
    setStartedAt(null);
    setCycleSession(nativeSession);
    setCycleCompleted(false);
    setScreen("cycle");
  };

  /**
   * Arms the reader and answers whether the card that landed is one the user
   * registered. Every card-driven action shares it, so a stray card can never
   * start or end anything on any screen.
   */
  const scanRegisteredCard = async (kind: "start" | "end" | "cycle"): Promise<boolean> => {
    const cards = await getRegisteredCards();
    if (cards.length === 0) {
      setScreen("cardSetup");
      return false;
    }
    setScanning(kind);
    const result = await readCardUid();
    setScanning(null);
    if ("error" in result) {
      // A cancel is the user's own doing, so there is nothing to report.
      if (!result.cancelled) Alert.alert("Couldn't read card", result.error);
      return false;
    }
    if (!cards.some((card) => card.uid === result.uid)) {
      Alert.alert("Different card", "That card isn't registered with Tafik.");
      return false;
    }
    return true;
  };

  /**
   * Asks before a cycle begins. Wrapped in a promise because the caller
   * has to wait on the answer before arming the reader, and Alert only speaks
   * in callbacks. onDismiss covers the Android back gesture, which would
   * otherwise leave this promise unresolved and the button dead.
   */
  const confirmCycle = async (): Promise<boolean> => {
    const unlocksLeft = await getEmergencyUnlocksLeft();
    return new Promise((resolve) => {
      Alert.alert("Start Cycle?", cycleCommitment(unlocksLeft), [
        { text: "Cancel", style: "cancel", onPress: () => resolve(false) },
        { text: "Start Cycle", onPress: () => resolve(true) },
      ], { onDismiss: () => resolve(false) });
    });
  };

  /**
   * The way in when the card is not to hand. Offered only while a start read is
   * already open, so it is always a second, deliberate choice rather than
   * something you can hit by reflex from an idle screen.
   *
   * Tapping a card stays the ordinary path and keeps no confirmation of its
   * own: fetching the card and holding it to the phone is already the
   * deliberate act this dialog exists to reproduce.
   */
  const startWithoutCard = async () => {
    // A session with no registered card has no ordinary way out at all, so the
    // card has to exist even on the path that never reads one.
    if ((await getRegisteredCards()).length === 0) {
      Alert.alert(
        "Register a card first",
        "Tafik will not start a session you have no way to end. Register a card, and after that you can start without tapping it.",
        [
          { text: "Not now", style: "cancel" },
          {
            text: "Register card",
            onPress: () => {
              void cancelCardRead();
              setScreen("cardSetup");
            },
          },
        ]
      );
      return;
    }

    const [unlocksLeft, mode] = await Promise.all([getEmergencyUnlocksLeft(), getFocusMode()]);
    const cycle = mode === "cycle";
    Alert.alert(
      cycle ? "Start Cycle?" : `Lock ${blockCount} ${blockCount === 1 ? "app" : "apps"}?`,
      // The remaining allowance is named rather than described: an abstract
      // warning is easy to wave through, a number that is about to drop is not.
      // Cycle gets its own wording because promising that the card unlocks the
      // apps would be a lie for the whole of a Study interval.
      cycle
        ? cycleCommitment(unlocksLeft)
        : `Only your registered card can unlock them. Emergency unlock is the only other way out, and you have ${unlocksLeft} left this month.`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: cycle ? "Start Cycle" : "Lock apps",
          onPress: () => {
            void (async () => {
              // Drop the open read first. The tafik call still waiting on it
              // sees a cancelled scan and bails, so nothing starts twice.
              await cancelCardRead();
              try {
                if (cycle) await startCycle();
                else await startSession();
              } catch (e: any) {
                Alert.alert(
                  cycle ? "Cycle couldn't start" : "Tafik couldn't lock apps",
                  e?.message ?? "Please try again."
                );
              }
            })();
          },
        },
      ]
    );
  };

  // A break is the one point in a cycle where the card works again.
  // Ending here banks the Study time already finished and costs no emergency
  // unlock, which is what makes the Study phase itself safe to lock down.
  const endCycleWithCard = async () => {
    if (scanning || cycleSession?.phase !== "break") return;
    if (!(await scanRegisteredCard("cycle"))) return;
    // The break can run out while the reader is still waiting for the card, and
    // a card that lands after that must not cut the next Study short.
    const live = await getBlockingSessionState();
    if (live.active && live.mode === "cycle" && live.phase !== "break") {
      setCycleSession(live);
      Alert.alert(
        "Study has resumed",
        "The break ended before that card landed, so Cycle is still running."
      );
      return;
    }
    try {
      await endSession();
      setScreen("home");
    } catch (e: any) {
      Alert.alert("Cycle couldn't end", e?.message ?? "Please try again.");
    }
  };

  // The one primary action, wherever the user is: arm the reader, then let the
  // card decide whether this starts or ends a session. Lives here rather than
  // on home because the button that triggers it is in the tab bar.
  const tafik = async () => {
    if (scanning) return;
    // A running cycle owns the card: during Study it is inert, and
    // during a break it ends the cycle from the Cycle screen itself.
    if (active && cycleSession?.mode === "cycle") {
      setScreen("cycle");
      return;
    }
    const action = active ? "end" : "start";
    // The ripple and the copy that explain the wait are on home, so never arm
    // the reader while the user is looking at another tab.
    if (screen !== "nfc") setScreen("nfc");
    // Catch both dead ends before arming. Finding out that there is nothing to
    // lock only after tapping the card is a wasted trip.
    if (action === "start" && blockCount === 0) {
      Alert.alert("Nothing to lock", "Choose at least one app to lock first.", [
        { text: "Not now", style: "cancel" },
        { text: "Choose apps", onPress: () => setScreen("blocklist") },
      ]);
      return;
    }
    // One card, one tap, and Settings decides which session it opens.
    const focusMode = action === "start" ? await getFocusMode() : "tafik";
    const cycle = focusMode === "cycle";
    if (cycle && !hasCycleSessionSupport()) {
      Alert.alert(
        "Native rebuild required",
        "This installed build does not include the Cycle timer service yet. Install a newly rebuilt APK, or turn Cycle off in Settings to use the standard session."
      );
      return;
    }
    // Asked before the reader is armed, so Cancel costs nothing. Once the card
    // lands the cycle is already running and the answer would be too late.
    if (cycle && !(await confirmCycle())) return;
    if (!(await scanRegisteredCard(action === "start" && cycle ? "cycle" : action))) return;
    try {
      if (action === "end") await endSession();
      else if (cycle) await startCycle();
      else await startSession();
    } catch (e: any) {
      Alert.alert(
        cycle ? "Cycle couldn't start" : "Tafik couldn't lock apps",
        e?.message ?? "Please try again."
      );
    }
  };

  // The card-free way out. The allowance is checked before anything is torn
  // down, and only spent once the session has actually ended.
  const emergencyUnlock = async () => {
    if ((await getEmergencyUnlocksLeft()) <= 0) {
      throw new Error(
        "You have no emergency unlocks left this month. They refill on the 1st."
      );
    }
    await endSession({ cancelled: true });
    return consumeEmergencyUnlock();
  };

  // The tab bar is shown on these four screens only.
  const tabBarBelow = screen === "home" || screen === "nfc" || screen === "insights" || screen === "blocklist" || screen === "settings";

  return (
    <>
      <StatusBar style={themeMode === "light" ? "dark" : "light"} />
      {/* The tab bar sits outside Screen, so the shell paints the same ground
          under it — otherwise a band of a different colour shows behind the bar. */}
      <View
        style={{
          flex: 1,
          backgroundColor: colors.bg,
        }}
      >
        <TabBarBelowContext.Provider value={tabBarBelow}>
        <ScreenFade key={screen}>
        {screen === "onboarding" && onboardingPreview && previewIntro && (
          <IntroScreen onFinish={() => setPreviewIntro(false)} onExitPreview={exitPreview} />
        )}
        {screen === "onboarding" && !(onboardingPreview && previewIntro) && (
          <OnboardingScreen
            nav={setScreen}
            preview={onboardingPreview}
            onExitPreview={exitPreview}
            startFirstSession={startSession}
            endFirstSession={() => endSession()}
            scanRegisteredCard={scanRegisteredCard}
          />
        )}
        {/* A Cycle read is still a start read as far as home is concerned, so
            it gets the same expanding rings and the same "hold your card" copy
            as an ordinary Tafik scan. */}
        {screen === "home" && (
          <HomeScreen
            nav={setScreen}
            active={active}
            startedAt={startedAt}
            blockCount={blockCount}
            focusMode={focusMode}
          />
        )}
        {screen === "nfc" && (
          <NfcTapScreen
            nav={setScreen}
            active={active}
            blockCount={blockCount}
            cycleMode={focusMode === "cycle"}
            scanning={scanning === "end" ? "end" : scanning === null ? null : "start"}
            onTafik={() => void tafik()}
            onStartWithoutCard={() => void startWithoutCard()}
          />
        )}
        {screen === "cycle" && (
          <CycleScreen
            session={cycleSession}
            completed={cycleCompleted}
            scanning={scanning === "cycle"}
            blockCount={blockCount}
            onEndWithCard={() => void endCycleWithCard()}
            onEmergency={() => setScreen("emergency")}
            onDone={() => {
              setCycleCompleted(false);
              setScreen("home");
            }}
          />
        )}
        {screen === "blocklist" && <BlocklistScreen />}
        {screen === "insights" && <InsightsScreen />}
        {screen === "settings" && (
          <SettingsScreen
            onManageCards={() => setScreen("cardSetup")}
            onOpenPrivacy={() => setScreen("privacy")}
            onModeChange={setFocusMode}
            onPreviewOnboarding={() => {
              setOnboardingPreview(true);
              setPreviewIntro(true);
              setScreen("onboarding");
            }}
          />
        )}
        {screen === "privacy" && <PrivacyPolicyScreen onBack={() => setScreen("settings")} />}
        {screen === "cardSetup" && (
          <CardSetupScreen nav={setScreen} active={active} />
        )}
        {screen === "emergency" && (
          <EmergencyScreen
            nav={setScreen}
            active={active}
            sessionMode={cycleSession?.mode === "cycle" ? "cycle" : "tafik"}
            onUnlock={emergencyUnlock}
          />
        )}
        </ScreenFade>
        </TabBarBelowContext.Provider>
        {(screen === "home" ||
          screen === "insights" ||
          screen === "blocklist" ||
          screen === "settings" ||
          screen === "nfc") && (
          <BottomNav
            current={screen}
            nav={setScreen}
            onTafik={() => void tafik()}
            onCancel={() => void cancelCardRead()}
            active={active}
            scanning={scanning !== null}
            cycle={focusMode === "cycle"}
          />
        )}

      </View>
    </>
  );
}

export default function App() {
  const [fontsLoaded, fontError] = useFonts({
    Poppins_400Regular,
    Poppins_500Medium,
    Poppins_600SemiBold,
    Poppins_700Bold,
  });

  if (!fontsLoaded && !fontError) return null;

  return (
    <ErrorBoundary>
      <AppContent />
    </ErrorBoundary>
  );
}
