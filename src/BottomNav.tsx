import { useEffect, useMemo, useRef } from "react";
import { Animated, StyleSheet, View } from "react-native";
import type { LucideIcon } from "lucide-react-native";
import BookOpenCheck from "lucide-react-native/icons/book-open-check";
import ChartNoAxesCombined from "lucide-react-native/icons/chart-no-axes-combined";
import House from "lucide-react-native/icons/house";
import ListChecks from "lucide-react-native/icons/list-checks";
import Settings from "lucide-react-native/icons/settings";
import X from "lucide-react-native/icons/x";
import { AppMark } from "./components";
import { Nav, ScreenName } from "./nav";
import { MOTION, PressableScale, useReducedMotion } from "./motion";
import { centreRaised } from "./homeMode";
import { ACTION_RISE, BAR_HEIGHT } from "./tabBar";
import { space, colors } from "./theme";

type Tab = Extract<ScreenName, "home" | "insights" | "blocklist" | "settings">;

const tabs: { screen: Tab; label: string; icon: LucideIcon }[] = [
  { screen: "home", label: "Home", icon: House },
  { screen: "insights", label: "Insights", icon: ChartNoAxesCombined },
  { screen: "blocklist", label: "Blocklist", icon: ListChecks },
  { screen: "settings", label: "Settings", icon: Settings },
];

const ACTION_SIZE = 56;
// The action button's offset from the top of the nav area. Idle, it sits centred
// in the bar, level with the tab icons. Raised, it straddles the bar's top edge.
// The raise stays inside the rise the nav area already reserves, because Android
// clips children that overflow their parent.
const IDLE_Y = ACTION_RISE + (BAR_HEIGHT - ACTION_SIZE) / 2;
const RAISED_Y = 0;
const RAISED_SCALE = 1.06;
const LIFT_MS = 300;

export default function BottomNav({
  current,
  nav,
  onTafik,
  onCancel,
  active,
  scanning,
  cycle = false,
  cycleActive = false,
}: {
  current: Tab | "nfc";
  nav: Nav;
  /** The app's primary action: arm the reader for a card tap. */
  onTafik: () => void;
  /** Drop the open read. The button is the only way to back out of a scan. */
  onCancel: () => void;
  /** A live focus session turns the centre action into the end-session X. */
  active: boolean;
  /** True while a read is open, which turns the button into that cancel. */
  scanning: boolean;
  /** Cycle mode selected. The centre action names the session it will start. */
  cycle?: boolean;
  /** A Cycle session is running. The button rises for it, the same as for a read. */
  cycleActive?: boolean;
}) {
  // The raise follows the real read state: it is up exactly while a card read is open
  // ("Ready to scan"). Cancelling, a card landing, or leaving the page all lower it, and
  // nothing extra is stored, so it cannot drift from the scan the app is running.
  const raised = centreRaised({ scanning, cycleActive });
  const reduce = useReducedMotion();
  const lift = useRef(new Animated.Value(raised ? 1 : 0)).current;

  // Runs only when the page or the reduce setting changes, not on every render. A
  // change mid-move is stopped where it is and reversed from there.
  useEffect(() => {
    if (reduce) {
      lift.setValue(raised ? 1 : 0);
      return;
    }
    const move = Animated.timing(lift, {
      toValue: raised ? 1 : 0,
      duration: LIFT_MS,
      easing: MOTION.ease,
      useNativeDriver: true,
    });
    move.start();
    return () => move.stop();
  }, [lift, raised, reduce]);

  const liftStyle = useMemo(
    () => ({
      transform: [
        { translateY: lift.interpolate({ inputRange: [0, 1], outputRange: [IDLE_Y, RAISED_Y] }) },
        { scale: lift.interpolate({ inputRange: [0, 1], outputRange: [1, RAISED_SCALE] }) },
      ],
    }),
    [lift]
  );

  const tab = (item: (typeof tabs)[number]) => {
    const selected = current === item.screen;
    const Icon = item.icon;
    return (
      <PressableScale
        key={item.screen}
        accessibilityRole="tab"
        accessibilityLabel={item.label}
        accessibilityState={{ selected }}
        onPress={() => nav(item.screen)}
        style={({ pressed }) => [styles.tab, { opacity: pressed ? 0.65 : 1 }]}
      >
        {/* Icons only. The label stays in accessibilityLabel for screen readers. */}
        <Icon
          size={24}
          color={selected ? colors.accent : colors.textDim}
          strokeWidth={selected ? 2.4 : 2}
        />
      </PressableScale>
    );
  };

  return (
    <View pointerEvents="box-none" style={styles.wrap}>
      <View style={[styles.bar, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        {/* Each half is its own flex:1 row so the two sides are always equal.
            Letting all four tabs flex against one another instead let the wider
            labels steal width and shunt the right-hand pair into the edge. */}
        <View style={styles.side}>{tabs.slice(0, 2).map(tab)}</View>
        <View style={styles.actionGap} />
        <View style={styles.side}>{tabs.slice(2).map(tab)}</View>
      </View>

      {/* Absolutely placed so it can move across the bar's top edge without changing
          the bar's layout. box-none lets taps through the transparent strip either side. */}
      <View pointerEvents="box-none" style={styles.actionLayer}>
        {/* Idle it is the app's own mark, or Cycle's when that mode is on, so
            the button says which session the next tap opens. A live session
            swaps it for the red X that starts the card-confirmed end flow; once
            scanning, the same X cancels that pending read. */}
        <Animated.View style={liftStyle}>
          <PressableScale
            scaleTo={0.94}
            accessibilityRole="button"
            accessibilityLabel={
              scanning
                ? "Cancel card scan"
                : active
                  ? "End focus session"
                  : cycle
                    ? "Start Cycle"
                    : "Tap in"
            }
            onPress={scanning ? onCancel : onTafik}
            style={({ pressed }) => [
              styles.action,
              active || scanning
                ? { backgroundColor: colors.accent, borderColor: colors.accent }
                : { backgroundColor: colors.bg, borderColor: colors.text },
              { opacity: pressed ? 0.85 : 1 },
            ]}
          >
            {active || scanning ? (
              <X size={24} color={colors.onAccent} strokeWidth={2.6} />
            ) : cycle ? (
              <BookOpenCheck size={25} color={colors.text} strokeWidth={2.2} />
            ) : (
              <AppMark height={26} color={colors.text} />
            )}
          </PressableScale>
        </Animated.View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    paddingBottom: space(2),
  },
  bar: {
    flexDirection: "row",
    alignItems: "center",
    height: BAR_HEIGHT,
    marginTop: ACTION_RISE,
    marginHorizontal: space(2),
    borderRadius: 26,
    borderWidth: StyleSheet.hairlineWidth,
    // Android draws the shadow from elevation alone, so the floating card needs
    // no colour of its own to lift off the page.
    elevation: 8,
  },
  side: {
    flex: 1,
    flexDirection: "row",
  },
  tab: {
    flex: 1,
    minWidth: 0,
    minHeight: 48,
    alignItems: "center",
    justifyContent: "center",
  },
  actionGap: {
    width: ACTION_SIZE + space(2),
  },
  actionLayer: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    alignItems: "center",
    // Android orders siblings by elevation, and the bar sits at 8. Without this the
    // bar paints over the button whenever the button is inside the bar's area.
    elevation: 12,
  },
  action: {
    width: ACTION_SIZE,
    height: ACTION_SIZE,
    borderRadius: 999,
    alignItems: "center",
    justifyContent: "center",
    // Wide enough to read as an outline rather than a seam, so the button stays
    // distinct from the bar it sits in.
    borderWidth: 1.5,
    elevation: 10,
  },
});
