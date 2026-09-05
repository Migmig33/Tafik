import { StatusBar } from "expo-status-bar";
import { Poppins_400Regular } from "@expo-google-fonts/poppins/400Regular";
import { Poppins_500Medium } from "@expo-google-fonts/poppins/500Medium";
import { Poppins_600SemiBold } from "@expo-google-fonts/poppins/600SemiBold";
import { Poppins_700Bold } from "@expo-google-fonts/poppins/700Bold";
import { useFonts } from "expo-font";
import { useEffect, useRef, useState } from "react";
import { Alert, View } from "react-native";
import {
  BlockingSessionState,
  consumeStudInResult,
  endBlockingSession,
  getBlockingSessionState,
  hasAccessibilityAccess,
  hasAccessibilityServiceSupport,
  hasStudInSessionSupport,
  startBlockingSession,
  startStudInBlockingSession,
  syncShieldMessage,
} from "./src/blocking";
import ErrorBoundary from "./src/ErrorBoundary";
import BottomNav from "./src/BottomNav";
import { ScreenName } from "./src/nav";
import { cancelCardRead, readCardUid } from "./src/nfc";
import BlocklistScreen from "./src/screens/BlocklistScreen";
import CardSetupScreen from "./src/screens/CardSetupScreen";
import EmergencyScreen from "./src/screens/EmergencyScreen";
import HomeScreen from "./src/screens/HomeScreen";
import IntroScreen from "./src/screens/IntroScreen";
import InsightsScreen from "./src/screens/InsightsScreen";
import OnboardingScreen from "./src/screens/OnboardingScreen";
import PrivacyPolicyScreen from "./src/screens/PrivacyPolicyScreen";
import SettingsScreen from "./src/screens/SettingsScreen";
import StudInScreen from "./src/screens/StudInScreen";
import WelcomeScreen from "./src/screens/WelcomeScreen";
import {
  clearActiveSessionStartedAt,
  consumeEmergencyUnlock,
  EMERGENCY_HOLD_SECONDS,
  getEmergencyUnlocksLeft,
  getActiveSessionStartedAt,
  getBlocklist,
  getOnboardingDone,
  getRegisteredCards,
  getShieldMessage,
  type FocusMode,
  getFocusMode,
  getStudInConfig,
  getWelcomeSeen,
  recordSession,
  setActiveSessionStartedAt,
  setWelcomeSeen,
} from "./src/store";
import { ThemeProvider, useTheme } from "./src/theme";

/**
 * What starting a StudIn cycle actually commits the user to. Said before the
 * cycle begins rather than discovered halfway through it: a Study interval is
 * the one state in the app where tapping the card does nothing, and finding
 * that out while locked out is the worst possible moment to learn it.
 */
function studInCommitment(unlocksLeft: number): string {
  return (
    "Once Study starts, your card will not end it. The card works again during a " +
    "Break, and tapping it then ends the whole cycle.\n\n" +
    `If you need out during Study, an emergency unlock is the only way. It takes a ` +
    `${EMERGENCY_HOLD_SECONDS} second hold, and you have ${unlocksLeft} left this month.`
  );
}

function AppContent() {
  const { colors, isDark } = useTheme();
  const [ready, setReady] = useState(false);
  const [introFinished, setIntroFinished] = useState(false);
  // Assume seen until storage says otherwise, so a returning user never gets a
  // flash of the first-run copy while the read is in flight.
  const [welcomeSeen, setWelcomeSeenState] = useState(true);
  const [screen, setScreen] = useState<ScreenName>("onboarding");

  // The native foreground service owns enforcement; JS reflects its session state.
  const [active, setActive] = useState(false);
  const [startedAt, setStartedAt] = useState<number | null>(null);
  const [studInSession, setStudInSession] = useState<BlockingSessionState | null>(null);
  const [studInCompleted, setStudInCompleted] = useState(false);
  const [blockCount, setBlockCount] = useState(0);
  // Held here rather than read per screen so the tab bar's centre button and
  // home's circle always show the same mode at the same moment.
  const [focusMode, setFocusMode] = useState<FocusMode>("tockin");
  // Which read is open, if any. Arming the reader stays a deliberate step so a
  // stray card cannot lock or unlock the phone; the tab bar's centre button is
  // what arms it, and home renders the feedback.
  const [scanning, setScanning] = useState<null | "start" | "end" | "studin">(null);
  const endingSession = useRef(false);
  const syncingStudIn = useRef(false);

  useEffect(() => {
    (async () => {
      const [done, savedFocusMode, accessibility, list, nativeSession, savedStartedAt, seenWelcome] = await Promise.all([
        getOnboardingDone(),
        getFocusMode(),
        hasAccessibilityAccess(),
        getBlocklist(),
        getBlockingSessionState(),
        getActiveSessionStartedAt(),
        getWelcomeSeen(),
      ]);
      const result = await consumeStudInResult();
      if (result.focusSeconds > 0) await recordSession(result.focusSeconds);
      const sessionActive = nativeSession.active;
      setBlockCount(list.length);
      setFocusMode(savedFocusMode);
      setWelcomeSeenState(seenWelcome);
      setActive(sessionActive);
      setStudInCompleted(result.completed);
      if (sessionActive && nativeSession.mode === "studin") {
        setStudInSession(nativeSession);
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
        nativeSession.mode === "studin" || result.completed ? "studin" : "home";
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

  // Keep the service's native copy in step with the locally stored message.
  useEffect(() => {
    void getShieldMessage()
      .then(syncShieldMessage)
      .catch(() => {});
  }, []);

  // Refresh block count whenever we land back on home.
  useEffect(() => {
    if (screen === "home") getBlocklist().then((l) => setBlockCount(l.length));
  }, [screen]);

  // Native time is authoritative. Polling only mirrors it into the visible UI;
  // the foreground service performs the actual phase transitions and blocking.
  useEffect(() => {
    if (!active || studInSession?.mode !== "studin") return;
    let cancelled = false;

    const refresh = async () => {
      if (syncingStudIn.current || endingSession.current) return;
      syncingStudIn.current = true;
      try {
        const next = await getBlockingSessionState();
        if (cancelled) return;
        if (next.active && next.mode === "studin") {
          setStudInSession(next);
          return;
        }

        setActive(false);
        setStudInSession(null);
        const result = await consumeStudInResult();
        if (result.focusSeconds > 0) await recordSession(result.focusSeconds);
        if (!cancelled && result.completed) {
          setStudInCompleted(true);
          setScreen("studin");
        }
      } finally {
        syncingStudIn.current = false;
      }
    };

    const id = setInterval(() => void refresh(), 500);
    void refresh();
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, [active, studInSession?.mode]);

  // An armed reader that outlives the screen showing the ripple would sit
  // listening with nothing on screen to say so.
  useEffect(() => {
    if (screen !== "home" && screen !== "studin") void cancelCardRead();
  }, [screen]);

  // Hold on a bare background until storage answers, so we know which of the
  // two openings to play. The read is a few milliseconds; starting the intro
  // first would mean playing the whoosh twice on a first launch.
  if (!ready) {
    return (
      <>
        <StatusBar style={isDark ? "light" : "dark"} />
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
        <StatusBar style={isDark ? "light" : "dark"} />
        <WelcomeScreen onGetStarted={finishWelcome} />
      </>
    );
  }

  // Keep the launch animation visible for its full duration. Every later start.
  if (!introFinished) {
    return (
      <>
        <StatusBar style={isDark ? "light" : "dark"} />
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
    setStudInSession(null);
    setStudInCompleted(false);
  };

  const endSession = async () => {
    if (endingSession.current) return;
    endingSession.current = true;
    try {
      const endingStudIn = studInSession?.mode === "studin";
      const sessionStartedAt = startedAt ?? (await getActiveSessionStartedAt());
      await endBlockingSession();
      if (endingStudIn) {
        const result = await consumeStudInResult();
        if (result.focusSeconds > 0) await recordSession(result.focusSeconds);
      } else if (sessionStartedAt !== null) {
        const elapsedSeconds = Math.floor((Date.now() - sessionStartedAt) / 1000);
        await recordSession(elapsedSeconds);
      }
      await clearActiveSessionStartedAt();
      setActive(false);
      setStartedAt(null);
      setStudInSession(null);
      setStudInCompleted(false);
    } finally {
      endingSession.current = false;
    }
  };

  const startStudIn = async () => {
    const [list, config] = await Promise.all([getBlocklist(), getStudInConfig()]);
    await startStudInBlockingSession(
      list,
      config.studyMinutes,
      config.breakMinutes,
      config.rounds
    );
    const nativeSession = await getBlockingSessionState();
    await clearActiveSessionStartedAt();
    setActive(true);
    setStartedAt(null);
    setStudInSession(nativeSession);
    setStudInCompleted(false);
    setScreen("studin");
  };

  /**
   * Arms the reader and answers whether the card that landed is one the user
   * registered. Every card-driven action shares it, so a stray card can never
   * start or end anything on any screen.
   */
  const scanRegisteredCard = async (kind: "start" | "end" | "studin"): Promise<boolean> => {
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
      Alert.alert("Different card", "That card isn't registered with TockIn.");
      return false;
    }
    return true;
  };

  /**
   * Asks before a StudIn cycle begins. Wrapped in a promise because the caller
   * has to wait on the answer before arming the reader, and Alert only speaks
   * in callbacks. onDismiss covers the Android back gesture, which would
   * otherwise leave this promise unresolved and the button dead.
   */
  const confirmStudIn = async (): Promise<boolean> => {
    const unlocksLeft = await getEmergencyUnlocksLeft();
    return new Promise((resolve) => {
      Alert.alert("Start StudIn?", studInCommitment(unlocksLeft), [
        { text: "Cancel", style: "cancel", onPress: () => resolve(false) },
        { text: "Start StudIn", onPress: () => resolve(true) },
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
        "TockIn will not start a session you have no way to end. Register a card, and after that you can start without tapping it.",
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
    const studIn = mode === "studin";
    Alert.alert(
      studIn ? "Start StudIn?" : `Lock ${blockCount} ${blockCount === 1 ? "app" : "apps"}?`,
      // The remaining allowance is named rather than described: an abstract
      // warning is easy to wave through, a number that is about to drop is not.
      // StudIn gets its own wording because promising that the card unlocks the
      // apps would be a lie for the whole of a Study interval.
      studIn
        ? studInCommitment(unlocksLeft)
        : `Only your registered card can unlock them. Emergency unlock is the only other way out, and you have ${unlocksLeft} left this month.`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: studIn ? "Start StudIn" : "Lock apps",
          onPress: () => {
            void (async () => {
              // Drop the open read first. The tockIn call still waiting on it
              // sees a cancelled scan and bails, so nothing starts twice.
              await cancelCardRead();
              try {
                if (studIn) await startStudIn();
                else await startSession();
              } catch (e: any) {
                Alert.alert(
                  studIn ? "StudIn couldn't start" : "TockIn couldn't lock apps",
                  e?.message ?? "Please try again."
                );
              }
            })();
          },
        },
      ]
    );
  };

  // A break is the one point in a StudIn cycle where the card works again.
  // Ending here banks the Study time already finished and costs no emergency
  // unlock, which is what makes the Study phase itself safe to lock down.
  const endStudInWithCard = async () => {
    if (scanning || studInSession?.phase !== "break") return;
    if (!(await scanRegisteredCard("studin"))) return;
    // The break can run out while the reader is still waiting for the card, and
    // a card that lands after that must not cut the next Study short.
    const live = await getBlockingSessionState();
    if (live.active && live.mode === "studin" && live.phase !== "break") {
      setStudInSession(live);
      Alert.alert(
        "Study has resumed",
        "The break ended before that card landed, so StudIn is still running."
      );
      return;
    }
    try {
      await endSession();
      setScreen("home");
    } catch (e: any) {
      Alert.alert("StudIn couldn't end", e?.message ?? "Please try again.");
    }
  };

  // The one primary action, wherever the user is: arm the reader, then let the
  // card decide whether this starts or ends a session. Lives here rather than
  // on home because the button that triggers it is in the tab bar.
  const tockIn = async () => {
    if (scanning) return;
    // A running StudIn cycle owns the card: during Study it is inert, and
    // during a break it ends the cycle from the StudIn screen itself.
    if (active && studInSession?.mode === "studin") {
      setScreen("studin");
      return;
    }
    const action = active ? "end" : "start";
    // The ripple and the copy that explain the wait are on home, so never arm
    // the reader while the user is looking at another tab.
    if (screen !== "home") setScreen("home");
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
    const focusMode = action === "start" ? await getFocusMode() : "tockin";
    const studIn = focusMode === "studin";
    if (studIn && !hasStudInSessionSupport()) {
      Alert.alert(
        "Native rebuild required",
        "This installed build does not include the StudIn timer service yet. Install a newly rebuilt APK, or turn StudIn off in Settings to use the standard session."
      );
      return;
    }
    // Asked before the reader is armed, so Cancel costs nothing. Once the card
    // lands the cycle is already running and the answer would be too late.
    if (studIn && !(await confirmStudIn())) return;
    if (!(await scanRegisteredCard(action === "start" && studIn ? "studin" : action))) return;
    try {
      if (action === "end") await endSession();
      else if (studIn) await startStudIn();
      else await startSession();
    } catch (e: any) {
      Alert.alert(
        studIn ? "StudIn couldn't start" : "TockIn couldn't lock apps",
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
    await endSession();
    return consumeEmergencyUnlock();
  };

  return (
    <>
      <StatusBar style={isDark ? "light" : "dark"} />
      {/* The tab bar sits outside Screen, so the shell paints the same ground
          under it — otherwise a band of a different colour shows behind the bar. */}
      <View
        style={{
          flex: 1,
          backgroundColor: colors.bg,
        }}
      >
        {screen === "onboarding" && <OnboardingScreen nav={setScreen} />}
        {/* A StudIn read is still a start read as far as home is concerned, so
            it gets the same expanding rings and the same "hold your card" copy
            as an ordinary TockIn scan. */}
        {screen === "home" && (
          <HomeScreen
            nav={setScreen}
            active={active}
            startedAt={startedAt}
            blockCount={blockCount}
            focusMode={focusMode}
            scanning={scanning === "end" ? "end" : scanning === null ? null : "start"}
            onTockIn={() => void tockIn()}
            onStartWithoutCard={() => void startWithoutCard()}
          />
        )}
        {screen === "studin" && (
          <StudInScreen
            session={studInSession}
            completed={studInCompleted}
            scanning={scanning === "studin"}
            blockCount={blockCount}
            onEndWithCard={() => void endStudInWithCard()}
            onEmergency={() => setScreen("emergency")}
            onDone={() => {
              setStudInCompleted(false);
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
            sessionMode={studInSession?.mode === "studin" ? "studin" : "tockin"}
            onUnlock={emergencyUnlock}
          />
        )}

        {(screen === "home" ||
          screen === "insights" ||
          screen === "blocklist" ||
          screen === "settings") && (
          <BottomNav
            current={screen}
            nav={setScreen}
            onTockIn={() => void tockIn()}
            onCancel={() => void cancelCardRead()}
            active={active}
            scanning={scanning !== null}
            studIn={focusMode === "studin"}
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
    <ThemeProvider>
      <ErrorBoundary>
        <AppContent />
      </ErrorBoundary>
    </ThemeProvider>
  );
}
