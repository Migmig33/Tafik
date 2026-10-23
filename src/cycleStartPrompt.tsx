import { useEffect, useState } from "react";
import { Modal, Pressable, StyleSheet, View } from "react-native";
import Check from "lucide-react-native/icons/check";
import { GhostButton, PrimaryButton } from "./components";
import { colors, radius, space, typeScale } from "./theme";
import { Text } from "./typography";

/**
 * The Cycle start reminder. It carries the same words and the same two actions as the native
 * alert it replaces, plus a "Don't show again" option. Starting with the option ticked is what
 * stops the reminder from showing on later Cycle starts.
 */
export default function CycleStartPrompt({
  visible,
  body,
  onCancel,
  onStart,
}: {
  visible: boolean;
  body: string;
  onCancel: () => void;
  /** Starts the Cycle. `dontShowAgain` is true when the option was ticked. */
  onStart: (dontShowAgain: boolean) => void;
}) {
  const [dontShowAgain, setDontShowAgain] = useState(false);

  // Each time the prompt opens, the option starts unticked.
  useEffect(() => {
    if (visible) setDontShowAgain(false);
  }, [visible]);

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onCancel}>
      {/* Tapping the dimmed area cancels. The inner Pressable swallows taps so a press on the
          card itself does not fall through to the scrim. */}
      <Pressable style={[styles.scrim, { backgroundColor: colors.scrim }]} onPress={onCancel}>
        <Pressable
          style={[styles.sheet, { backgroundColor: colors.surface, borderColor: colors.border }]}
          onPress={() => {}}
        >
          <Text style={[styles.title, { color: colors.text }]}>Start Cycle?</Text>
          <Text style={[styles.body, { color: colors.textDim }]}>{body}</Text>

          <Pressable
            accessibilityRole="checkbox"
            accessibilityState={{ checked: dontShowAgain }}
            accessibilityLabel="Don't show again"
            onPress={() => setDontShowAgain((ticked) => !ticked)}
            style={styles.option}
          >
            <View
              style={[
                styles.box,
                {
                  borderColor: dontShowAgain ? colors.accent : colors.border,
                  backgroundColor: dontShowAgain ? colors.accent : colors.bg,
                },
              ]}
            >
              {dontShowAgain ? <Check size={14} color={colors.onAccent} strokeWidth={3} /> : null}
            </View>
            <Text style={[styles.optionLabel, { color: colors.text }]}>Don&apos;t show again</Text>
          </Pressable>

          <View style={styles.actions}>
            <GhostButton label="Cancel" onPress={onCancel} />
            <PrimaryButton label="Start Cycle" onPress={() => onStart(dontShowAgain)} />
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  scrim: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: space(3),
  },
  sheet: {
    width: "100%",
    maxWidth: 340,
    gap: space(1.5),
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: radius.card,
    padding: space(2.5),
  },
  title: {
    fontSize: typeScale.headline.fontSize,
    fontWeight: "600",
  },
  body: {
    fontSize: typeScale.callout.fontSize,
    lineHeight: typeScale.callout.lineHeight,
  },
  option: {
    flexDirection: "row",
    alignItems: "center",
    gap: space(1.25),
    paddingVertical: space(0.5),
  },
  box: {
    width: 22,
    height: 22,
    borderRadius: 6,
    borderWidth: 1.5,
    alignItems: "center",
    justifyContent: "center",
  },
  optionLabel: {
    fontSize: typeScale.callout.fontSize,
    fontWeight: "500",
  },
  actions: {
    gap: space(1),
    alignSelf: "stretch",
  },
});
