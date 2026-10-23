import { StyleSheet } from "react-native";
import { PressableScale } from "./motion";
import { colors, radius, space, typeScale } from "./theme";
import { Text } from "./typography";

/**
 * The way out of a running session. An outlined pill, so it reads as something to tap, but it
 * stays quieter than the timer above it: a hairline edge, no fill, and the label at callout size.
 * It sits centred under the clock and keeps its own width rather than stretching across the screen.
 */
export default function EmergencyExitButton({ onPress }: { onPress: () => void }) {
  return (
    <PressableScale
      scaleTo={0.97}
      accessibilityRole="button"
      accessibilityLabel="Emergency Exit"
      onPress={onPress}
      style={({ pressed }) => [styles.button, { opacity: pressed ? 0.7 : 1 }]}
    >
      <Text style={[styles.label, { color: colors.text }]}>Emergency Exit</Text>
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  button: {
    minHeight: 48,
    minWidth: 200,
    paddingHorizontal: space(3),
    borderRadius: radius.pill,
    alignItems: "center",
    justifyContent: "center",
  },
  label: {
    ...typeScale.callout,
    fontWeight: "600",
  },
});
