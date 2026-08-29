import { StatusBar } from "expo-status-bar";
import React, { useEffect, useState } from "react";
import { View } from "react-native";
import { BlockedApp, ScreenName } from "./src/nav";
import BlocklistScreen from "./src/screens/BlocklistScreen";
import BlockOverlayScreen from "./src/screens/BlockOverlayScreen";
import CardSetupScreen from "./src/screens/CardSetupScreen";
import HomeScreen from "./src/screens/HomeScreen";
import OnboardingScreen from "./src/screens/OnboardingScreen";
import { getBlocklist, getOnboardingDone } from "./src/store";
import { useTheme } from "./src/theme";

const DEMO_BLOCKED_APP: BlockedApp = { name: "Instagram", pkg: "com.instagram.android" };

export default function App() {
  const { isDark, colors } = useTheme();
  const [ready, setReady] = useState(false);
  const [screen, setScreen] = useState<ScreenName>("onboarding");

  // Session state. In the real build the native foreground service owns this;
  // JS reflects it. Here JS owns it so the shell is fully testable.
  const [active, setActive] = useState(false);
  const [startedAt, setStartedAt] = useState<number | null>(null);
  const [blockCount, setBlockCount] = useState(0);

  useEffect(() => {
    (async () => {
      const [done, list] = await Promise.all([getOnboardingDone(), getBlocklist()]);
      setBlockCount(list.length);
      setScreen(done ? "home" : "onboarding");
      setReady(true);
    })();
  }, []);

  // Refresh block count whenever we land back on home.
  useEffect(() => {
    if (screen === "home") getBlocklist().then((l) => setBlockCount(l.length));
  }, [screen]);

  if (!ready) return <View style={{ flex: 1, backgroundColor: colors.bg }} />;

  const startSession = () => {
    setActive(true);
    setStartedAt(Date.now());
    // TODO(native): tell the foreground service to start shielding the blocklist.
  };
  const endSession = () => {
    setActive(false);
    setStartedAt(null);
    // TODO(native): tell the foreground service to stop shielding.
  };

  return (
    <>
      <StatusBar style={isDark ? "light" : "dark"} />
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
      {screen === "blocklist" && <BlocklistScreen nav={setScreen} />}
      {screen === "cardSetup" && <CardSetupScreen nav={setScreen} />}
      {screen === "blockOverlay" && (
        <BlockOverlayScreen nav={setScreen} app={DEMO_BLOCKED_APP} onUnlock={() => setScreen("home")} />
      )}
    </>
  );
}
