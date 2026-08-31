import { Pressable, StyleSheet, View } from "react-native";
import type { LucideIcon } from "lucide-react-native";
import ChartNoAxesCombined from "lucide-react-native/icons/chart-no-axes-combined";
import House from "lucide-react-native/icons/house";
import ListChecks from "lucide-react-native/icons/list-checks";
import SlidersHorizontal from "lucide-react-native/icons/sliders-horizontal";
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

export default function BottomNav({ current, nav }: { current: Tab; nav: Nav }) {
  const { colors } = useTheme();

  return (
    <View style={[styles.bar, { backgroundColor: colors.surface, borderColor: colors.border }]}>
      {tabs.map((tab) => {
        const selected = current === tab.screen;
        const Icon = tab.icon;
        return (
          <Pressable
            key={tab.screen}
            accessibilityRole="tab"
            accessibilityState={{ selected }}
            onPress={() => nav(tab.screen)}
            style={({ pressed }) => [styles.tab, { opacity: pressed ? 0.65 : 1 }]}
          >
            <View
              style={[
                styles.iconPill,
                { backgroundColor: selected ? colors.accentWash : "transparent" },
              ]}
            >
              <Icon
                size={21}
                color={selected ? colors.accent : colors.textDim}
                strokeWidth={selected ? 2.4 : 2}
              />
            </View>
            <Text
              style={{
                color: selected ? colors.accent : colors.textDim,
                fontSize: 13,
                fontWeight: selected ? "600" : "500",
              }}
            >
              {tab.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    flexDirection: "row",
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingTop: space(1),
    paddingBottom: space(2),
    paddingHorizontal: space(1),
  },
  tab: {
    flex: 1,
    alignItems: "center",
    gap: space(0.5),
    paddingVertical: space(0.5),
  },
  iconPill: {
    width: 46,
    height: 30,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
  },
});
