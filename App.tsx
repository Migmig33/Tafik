import { StatusBar } from "expo-status-bar";
import { Poppins_400Regular } from "@expo-google-fonts/poppins/400Regular";
import { Poppins_500Medium } from "@expo-google-fonts/poppins/500Medium";
import { Poppins_600SemiBold } from "@expo-google-fonts/poppins/600SemiBold";
import { Poppins_700Bold } from "@expo-google-fonts/poppins/700Bold";
import { useFonts } from "expo-font";
import { useEffect, useState } from "react";
import { Alert, View } from "react-native";
import {
  endBlockingSession,
  isBlockingSessionActive,
  startBlockingSession,
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
import WelcomeScreen from "./src/screens/WelcomeScreen";
import {
  clearActiveSessionStartedAt,
  consumeEmergencyUnlock,
  getEmergencyUnlocksLeft,
  getActiveSessionStartedAt,
  getBlocklist,
  getOnboardingDone,
  getRegisteredCards,
  getShieldMessage,
  getWelcomeSeen,
  recordSession,
  setActiveSessionStartedAt,
  setWelcomeSeen,
} from "./src/store";
import { PremiumProvider, usePremium } from "./src/premium";
import { ThemeProvider, useTheme } from "./src/theme";

function AppContent() {
  const { colors, isDark } = useTheme();
  const { isPremium, ready: premiumReady } = usePremium();
  const [ready, setReady] = useState(false);
  const [introFinished, setIntroFinished] = useState(false);
  // Assume seen until storage says otherwise, so a returning user never gets a
  // flash of the first-run copy while the read is in flight.
  const [welcomeSeen, setWelcomeSeenState] = useState(true);
  const [screen, setScreen] = useState<ScreenName>("onboarding");

  // The native foreground service owns enforcement; JS reflects its session state.
  const [active, setActive] = useState(false);
  const [startedAt, setStartedAt] = useState<number | null>(null);
  const [blockCount, setBlockCount] = useState(0);
  // Which read is open, if any. Arming the reader stays a deliberate step so a
  // stray card cannot lock or unlock the phone; the tab bar's centre button is
  // what arms it, and home renders the feedback.
  const [scanning, setScanning] = useState<null | "start" | "end">(null);

  useEffect(() => {
    (async () => {
      const [done, list, sessionActive, savedStartedAt, seenWelcome] = await Promise.all([
        getOnboardingDone(),
        getBlocklist(),
        isBlockingSessionActive(),
        getActiveSessionStartedAt(),
        getWelcomeSeen(),
      ]);
      setBlockCount(list.length);
      setWelcomeSeenState(seenWelcome);
      setActive(sessionActive);
      if (sessionActive) {
        setStartedAt(savedStartedAt ?? Date.now());
      } else if (savedStartedAt !== null) {
        await clearActiveSessionStartedAt();
      }
      setScreen(done ? "home" : "onboarding");
      setReady(true);
    })();
  }, []);

  // Keep SharedPreferences in step with what the user is entitled to, not just
  // with what happens to be stored: a message written on Premium must stop
  // reaching the shield if the entitlement ever goes away.
  useEffect(() => {
    if (!premiumReady) return;
    getShieldMessage().then((message) => syncShieldMessage(isPremium ? message : ""));
  }, [isPremium, premiumReady]);

  // Refresh block count whenever we land back on home.
  useEffect(() => {
    if (screen === "home") getBlocklist().then((l) => setBlockCount(l.length));
  }, [screen]);

  // An armed reader that outlives the screen showing the ripple would sit
  // listening with nothing on screen to say so.
  useEffect(() => {
    if (screen !== "home") void cancelCardRead();
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
  };
  const endSession = async () => {
    const sessionStartedAt = startedAt ?? (await getActiveSessionStartedAt());
    await endBlockingSession();
    if (sessionStartedAt !== null) {
      const elapsedSeconds = Math.floor((Date.now() - sessionStartedAt) / 1000);
      await recordSession(elapsedSeconds);
    }
    await clearActiveSessionStartedAt();
    setActive(false);
    setStartedAt(null);
  };

  // The one primary action, wherever the user is: arm the reader, then let the
  // card decide whether this starts or ends a session. Lives here rather than
  // on home because the button that triggers it is in the tab bar.
  const tapIn = async () => {
    if (scanning) return;
    const mode = active ? "end" : "start";
    // The ripple and the copy that explain the wait are on home, so never arm
    // the reader while the user is looking at another tab.
    if (screen !== "home") setScreen("home");
    // Catch both dead ends before arming. Finding out that there is nothing to
    // lock only after tapping the card is a wasted trip.
    if (mode === "start" && blockCount === 0) {
      Alert.alert("Nothing to lock", "Choose at least one app to lock first.", [
        { text: "Not now", style: "cancel" },
        { text: "Choose apps", onPress: () => setScreen("blocklist") },
      ]);
      return;
    }
    const cards = await getRegisteredCards();
    if (cards.length === 0) {
      setScreen("cardSetup");
      return;
    }
    setScanning(mode);
    const r = await readCardUid();
    setScanning(null);
    if ("error" in r) {
      // A cancel is the user's own doing, so there is nothing to report.
      if (!r.cancelled) Alert.alert("Couldn't read card", r.error);
      return;
    }
    if (!cards.some((card) => card.uid === r.uid)) {
      Alert.alert("Different card", "That card isn't registered with TapIn.");
      return;
    }
    try {
      await (mode === "start" ? startSession() : endSession());
    } catch (e: any) {
      Alert.alert("TapIn couldn't lock apps", e?.message ?? "Please try again.");
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
        {screen === "home" && (
          <HomeScreen
            nav={setScreen}
            active={active}
            startedAt={startedAt}
            blockCount={blockCount}
            scanning={scanning}
            onTapIn={() => void tapIn()}
          />
        )}
        {screen === "blocklist" && <BlocklistScreen />}
        {screen === "insights" && <InsightsScreen />}
        {screen === "settings" && (
          <SettingsScreen
            onManageCards={() => setScreen("cardSetup")}
            onOpenPrivacy={() => setScreen("privacy")}
          />
        )}
        {screen === "privacy" && <PrivacyPolicyScreen onBack={() => setScreen("settings")} />}
        {screen === "cardSetup" && (
          <CardSetupScreen nav={setScreen} active={active} />
        )}
        {screen === "emergency" && (
          <EmergencyScreen nav={setScreen} active={active} onUnlock={emergencyUnlock} />
        )}

        {(screen === "home" ||
          screen === "insights" ||
          screen === "blocklist" ||
          screen === "settings") && (
          <BottomNav
            current={screen}
            nav={setScreen}
            onTapIn={() => void tapIn()}
            onCancel={() => void cancelCardRead()}
            active={active}
            scanning={scanning !== null}
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
      <PremiumProvider>
        <ErrorBoundary>
          <AppContent />
        </ErrorBoundary>
      </PremiumProvider>
    </ThemeProvider>
  );
}
