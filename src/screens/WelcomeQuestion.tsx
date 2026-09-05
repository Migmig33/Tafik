import { useEffect, useRef } from "react";
import { Animated, Easing, Pressable, StyleSheet, View } from "react-native";
import type { Option } from "../welcomeQuestions";
import { radius, space, useTheme } from "../theme";
import { Text } from "../typography";

const REVEAL_MS = 420;
const STAGGER_MS = 70;

/**
 * One first-run question. Answering advances immediately rather than lighting
 * up a Next button: there are only two of these, both are a single choice, and
 * a confirmation step would make the app feel like a form before it has earned
 * the right to ask anything.
 */
export default function WelcomeQuestion<T extends string>({
  step,
  total,
  question,
  options,
  onAnswer,
}: {
  step: number;
  total: number;
  question: string;
  options: Option<T>[];
  onAnswer: (value: T) => void;
}) {
  const { colors } = useTheme();
  const reveal = useRef(new Animated.Value(0)).current;

  // Re-runs per question because the key changes, so the second question
  // arrives with the same entrance as the first rather than snapping in.
  useEffect(() => {
    reveal.setValue(0);
    const animation = Animated.timing(reveal, {
      toValue: 1,
      duration: REVEAL_MS,
      easing: Easing.out(Easing.ease),
      useNativeDriver: true,
    });
    animation.start();
    return () => animation.stop();
  }, [reveal]);

  const rise = (order: number) => {
    // Each row starts slightly later than the one above it, so the list reads
    // top to bottom instead of appearing as a block.
    const start = Math.min(0.6, order * (STAGGER_MS / REVEAL_MS));
    const slice = reveal.interpolate({
      inputRange: [start, Math.min(1, start + 0.6)],
      outputRange: [0, 1],
      extrapolate: "clamp",
    });
    return {
      opacity: slice,
      transform: [{ translateY: slice.interpolate({ inputRange: [0, 1], outputRange: [10, 0] }) }],
    };
  };

  return (
    <View style={styles.screen}>
      <Animated.View style={rise(0)}>
        <Text style={[styles.step, { color: colors.textDim }]}>
          {step} of {total}
        </Text>
        <Text style={[styles.question, { color: colors.text }]}>{question}</Text>
      </Animated.View>

      <View style={styles.options}>
        {options.map((option, index) => (
          <Animated.View key={option.value} style={rise(index + 1)}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={option.label}
              onPress={() => onAnswer(option.value)}
              style={({ pressed }) => [
                styles.option,
                {
                  backgroundColor: pressed ? colors.accentWash : colors.surface,
                  borderColor: pressed ? colors.accent : colors.border,
                },
              ]}
            >
              <Text style={[styles.optionLabel, { color: colors.text }]}>{option.label}</Text>
            </Pressable>
          </Animated.View>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    width: "100%",
  },
  step: {
    fontSize: 12,
    fontWeight: "600",
    letterSpacing: 0.8,
    textAlign: "center",
  },
  question: {
    marginTop: space(1),
    fontSize: 23,
    lineHeight: 32,
    fontWeight: "600",
    letterSpacing: -0.3,
    textAlign: "center",
  },
  options: {
    marginTop: space(4),
    gap: space(1.25),
  },
  option: {
    minHeight: 58,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: radius.card,
    paddingHorizontal: space(2),
  },
  optionLabel: {
    fontSize: 16,
    fontWeight: "500",
  },
});
