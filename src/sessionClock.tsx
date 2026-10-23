import { StyleSheet, View } from "react-native";
import RollingTime from "./rollingTime";
import { formatClock } from "./timeFormat";
import { colors } from "./theme";

/**
 * A session's clock, set large and bare in the middle of the screen. The caller supplies the
 * whole seconds; this formats them (see `formatClock`) and draws them with the sliding digits.
 * Hours bring a longer string, so the size steps down to keep it on one line.
 */
export default function SessionClock({
  seconds,
  accessibilityLabel,
  color = colors.text,
}: {
  seconds: number;
  accessibilityLabel: string;
  color?: string;
}) {
  const text = formatClock(seconds);
  const withHours = text.split(":").length === 3;
  return (
    <View style={styles.face}>
      <RollingTime
        text={text}
        label={accessibilityLabel}
        style={[styles.time, withHours ? styles.timeWithHours : null, { color }]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  face: {
    alignItems: "center",
    justifyContent: "center",
  },
  time: {
    fontSize: 84,
    lineHeight: 92,
    fontWeight: "600",
    letterSpacing: -2,
    fontVariant: ["tabular-nums"],
    // Android pads text above and below the glyphs; this keeps the digits optically centred.
    includeFontPadding: false,
    textAlignVertical: "center",
  },
  timeWithHours: {
    fontSize: 60,
    lineHeight: 66,
  },
});
