import { StyleSheet, View } from "react-native";
import LockKeyhole from "lucide-react-native/icons/lock-keyhole";
import LockKeyholeOpen from "lucide-react-native/icons/lock-keyhole-open";
import { AnimatedSwapText } from "./components";
import { streakAccessibilityLabel } from "./streakDays";
import { StreakFlame } from "./streakFlame";
import { colors, space, typeScale } from "./theme";
import { Text } from "./typography";

/**
 * The header counter: an icon and the streak number, right-aligned, with no background. By default
 * the icon is the flame. Cycle's header passes a lock state instead, and gets a padlock. The icon is
 * accent-coloured for a positive streak and neutral for zero. The number animates when it changes.
 */
export function StreakCounter({
  streak,
  lock,
}: {
  streak: number;
  lock?: "locked" | "unlocked";
}) {
  const positive = streak > 0;
  const tint = positive ? colors.accent : colors.textDim;
  return (
    <View accessible accessibilityRole="text" accessibilityLabel={streakAccessibilityLabel(streak)} style={styles.counter}>
      <View importantForAccessibility="no-hide-descendants" accessibilityElementsHidden>
        {lock === undefined ? (
          <StreakFlame color={tint} size={26} />
        ) : lock === "locked" ? (
          <LockKeyhole size={24} color={tint} strokeWidth={2.2} />
        ) : (
          <LockKeyholeOpen size={24} color={tint} strokeWidth={2.2} />
        )}
      </View>
      <AnimatedSwapText value={`${streak}`}>
        {(label) => (
          <Text style={[styles.number, { color: positive ? colors.text : colors.textDim }]}>{label}</Text>
        )}
      </AnimatedSwapText>
    </View>
  );
}

const styles = StyleSheet.create({
  counter: {
    flexDirection: "row",
    alignItems: "center",
    gap: space(0.75),
  },
  number: {
    fontSize: typeScale.title.fontSize,
    lineHeight: typeScale.title.lineHeight,
    fontWeight: "700",
    // Android pads text above and below the glyphs, which pushed the number off the icon's centre.
    includeFontPadding: false,
    textAlignVertical: "center",
  },
});
