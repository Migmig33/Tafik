import { Pressable, StyleSheet, View } from "react-native";
import type { LucideIcon } from "lucide-react-native";
import BookOpenCheck from "lucide-react-native/icons/book-open-check";
import ChartNoAxesCombined from "lucide-react-native/icons/chart-no-axes-combined";
import House from "lucide-react-native/icons/house";
import ListChecks from "lucide-react-native/icons/list-checks";
import SlidersHorizontal from "lucide-react-native/icons/sliders-horizontal";
import X from "lucide-react-native/icons/x";
import { AppMark } from "./components";
import { Nav, ScreenName } from "./nav";
import { space, useTheme } from "./theme";
import { Text } from "./typography";

type Tab = Extract<ScreenName, "home" | "insights" | "blocklist" | "settings">;

const tabs: { screen: Tab; label: string; icon: LucideIcon }[] = [
  { screen: "home", label: "Home", icon: House },
  { screen: "insights", label: "Insights", icon: ChartNoAxesCombined },
  { screen: "blocklist", label: "Blocklist", icon: ListChecks },
  { screen: "settings", label: "Settings", icon: SlidersHorizontal },
];

const ACTION_SIZE = 56;
// How far the action button stands proud of the bar's top edge. The bar is
// pushed down by exactly this much rather than the button being lifted out of
// it, because Android clips children that overflow their parent.
const ACTION_RISE = 26;

export default function BottomNav({
  current,
  nav,
  onTapIn,
  onCancel,
  active,
  scanning,
  studIn = false,
}: {
  current: Tab;
  nav: Nav;
  /** The app's primary action: arm the reader for a card tap. */
  onTapIn: () => void;
  /** Drop the open read. The button is the only way to back out of a scan. */
  onCancel: () => void;
  /** A live focus session turns the centre action into the end-session X. */
  active: boolean;
  /** True while a read is open, which turns the button into that cancel. */
  scanning: boolean;
  /** StudIn mode selected. The centre action names the session it will start. */
  studIn?: boolean;
}) {
  const { colors } = useTheme();

  const tab = (item: (typeof tabs)[number]) => {
    const selected = current === item.screen;
    const Icon = item.icon;
    return (
      <Pressable
        key={item.screen}
        accessibilityRole="tab"
        accessibilityState={{ selected }}
        onPress={() => nav(item.screen)}
        style={({ pressed }) => [styles.tab, { opacity: pressed ? 0.65 : 1 }]}
      >
        <Icon
          size={21}
          color={selected ? colors.accent : colors.textDim}
          strokeWidth={selected ? 2.4 : 2}
        />
        <Text
          numberOfLines={1}
          style={{
            color: selected ? colors.accent : colors.textDim,
            fontSize: 11,
            fontWeight: selected ? "600" : "500",
          }}
        >
          {item.label}
        </Text>
      </Pressable>
    );
  };

  return (
    <View style={styles.wrap}>
      <View style={[styles.bar, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        {/* Each half is its own flex:1 row so the two sides are always equal.
            Letting all four tabs flex against one another instead let the wider
            labels steal width and shunt the right-hand pair into the edge. */}
        <View style={styles.side}>{tabs.slice(0, 2).map(tab)}</View>
        <View style={styles.actionGap} />
        <View style={styles.side}>{tabs.slice(2).map(tab)}</View>
      </View>

      {/* Absolutely placed rather than laid out in the bar: it has to straddle
          the bar's top edge, which it cannot do as a flex child. box-none lets
          taps through the transparent strip either side of it. */}
      <View pointerEvents="box-none" style={styles.actionLayer}>
        {/* Idle it is the app's own mark, or StudIn's when that mode is on, so
            the button says which session the next tap opens. A live session
            swaps it for the red X that starts the card-confirmed end flow; once
            scanning, the same X cancels that pending read. */}
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={
            scanning
              ? "Cancel card scan"
              : active
                ? "End focus session"
                : studIn
                  ? "Start StudIn"
                  : "Tap in"
          }
          onPress={scanning ? onCancel : onTapIn}
          style={({ pressed }) => [
            styles.action,
            active || scanning
              ? { backgroundColor: colors.danger, borderColor: colors.danger }
              : { backgroundColor: colors.bg, borderColor: colors.text },
            { opacity: pressed ? 0.85 : 1 },
          ]}
        >
          {active || scanning ? (
            <X size={24} color={colors.onDanger} strokeWidth={2.6} />
          ) : studIn ? (
            <BookOpenCheck size={25} color={colors.text} strokeWidth={2.2} />
          ) : (
            <AppMark height={26} color={colors.text} />
          )}
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    paddingBottom: space(2),
  },
  bar: {
    flexDirection: "row",
    alignItems: "center",
    height: 66,
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
    // Without this a label wider than its share refuses to shrink and grows the
    // tab instead, which is what pulled the bar out of balance.
    minWidth: 0,
    alignItems: "center",
    gap: space(0.5),
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
  },
  action: {
    width: ACTION_SIZE,
    height: ACTION_SIZE,
    borderRadius: 999,
    alignItems: "center",
    justifyContent: "center",
    // Wide enough to read as an outline rather than a seam. It also does the
    // separating work in light mode, where the page, the bar and this button
    // are all the same white and the button would otherwise be only a shadow.
    borderWidth: 1.5,
    elevation: 10,
  },
});
