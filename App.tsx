import { StatusBar } from "expo-status-bar";
import { Poppins_400Regular } from "@expo-google-fonts/poppins/400Regular";
import { Poppins_500Medium } from "@expo-google-fonts/poppins/500Medium";
import { Poppins_600SemiBold } from "@expo-google-fonts/poppins/600SemiBold";
import { Poppins_700Bold } from "@expo-google-fonts/poppins/700Bold";
import { useFonts } from "expo-font";
import React, { useEffect, useState } from "react";
import { View } from "react-native";
import { endBlockingSession, isBlockingSessionActive, startBlockingSession } from "./src/blocking";
import BottomNav from "./src/BottomNav";
import { ScreenName } from "./src/nav";
import BlocklistScreen from "./src/screens/BlocklistScreen";
import CardSetupScreen from "./src/screens/CardSetupScreen";
import HomeScreen from "./src/screens/HomeScreen";
import IntroScreen from "./src/screens/IntroScreen";
import InsightsScreen from "./src/screens/InsightsScreen";
import OnboardingScreen from "./src/screens/OnboardingScreen";
import SettingsScreen from "./src/screens/SettingsScreen";
import {
  clearActiveSessionStartedAt,
  getActiveSessionStartedAt,
  getBlocklist,
  getOnboardingDone,
  recordSession,
  setActiveSessionStartedAt,
} from "./src/store";
import { ThemeProvider, useTheme } from "./src/theme";

function AppContent() {
  const { isDark } = useTheme();
  const [ready, setReady] = useState(false);
  const [introFinished, setIntroFinished] = useState(false);
  const [screen, setScreen] = useState<ScreenName>("onboarding");

  // The native foreground service owns enforcement; JS reflects its session state.
  const [active, setActive] = useState(false);
  const [startedAt, setStartedAt] = useState<number | null>(null);
  const [blockCount, setBlockCount] = useState(0);

  useEffect(() => {
    (async () => {
      const [done, list, sessionActive, savedStartedAt] = await Promise.all([
        getOnboardingDone(),
        getBlocklist(),
        isBlockingSessionActive(),
        getActiveSessionStartedAt(),
      ]);
      setBlockCount(list.length);
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

  // Refresh block count whenever we land back on home.
  useEffect(() => {
    if (screen === "home") getBlocklist().then((l) => setBlockCount(l.length));
  }, [screen]);

  // Keep the launch animation visible for its full duration and while stored
  // app state loads. This runs on every fresh app launch.
  if (!ready || !introFinished) {
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

  return (
    <>
      <StatusBar style={isDark ? "light" : "dark"} />
      <View style={{ flex: 1 }}>
        {screen === "onboarding" && <OnboardingScreen nav={setScreen} />}
        {screen === "home" && (
          <HomeScreen
            nav={setScreen}
            active={active}
            startedAt={startedAt}
            blockCount={blockCount}
            onStart={startSession}
            onEnd={endSession}
          />
        )}
        {screen === "blocklist" && <BlocklistScreen />}
        {screen === "insights" && <InsightsScreen />}
        {screen === "settings" && <SettingsScreen />}
        {screen === "cardSetup" && <CardSetupScreen nav={setScreen} />}

        {(screen === "home" ||
          screen === "insights" ||
          screen === "blocklist" ||
          screen === "settings") && (
          <BottomNav current={screen} nav={setScreen} />
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
      <AppContent />
    </ThemeProvider>
  );
}
