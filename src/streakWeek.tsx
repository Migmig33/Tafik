import { useEffect, useRef } from "react";
import { Animated, Easing, StyleSheet, View } from "react-native";
import LockKeyhole from "lucide-react-native/icons/lock-keyhole";
import LockKeyholeOpen from "lucide-react-native/icons/lock-keyhole-open";
import { shouldAnimateCompletion, dayAccessibilityLabel, dayState, type DayState } from "./streakDays";
import { useReducedMotion } from "./motion";
import type { StreakDay } from "./store";
import { colors, radius, space, typeScale } from "./theme";
import { Text } from "./typography";

const PILL = 36;
// The completion bounce: a small overshoot, then settle. Well under 600 ms in total.
const BOUNCE_UP_MS = 220;
const BOUNCE_SETTLE_MS = 150;
const BOUNCE_PEAK = 1.12;

/**
 * The current calendar week, Sunday on the left, with no background behind the row. Each day has
 * a pill whose icon and outline show its state: a closed padlock for completed days; an unlocked
 * padlock for missed, today and upcoming days, each with its own outline and fade. Today keeps a
 * dot underneath. The row sits on a soft shadow rather than a panel.
 */
export function StreakWeek({ days }: { days: StreakDay[] }) {
  const reduce = useReducedMotion();
  return (
    <View style={styles.week}>
      {days.map((day) => (
        <DayPill key={day.key} day={day} reduce={reduce} />
      ))}
    </View>
  );
}

function DayPill({ day, reduce }: { day: StreakDay; reduce: boolean }) {
  const state: DayState = dayState(day);
  const scale = useRef(new Animated.Value(1)).current;
  const wasCompleted = useRef(state === "completed");

  // Plays only when this day changes into completed. Re-renders and unrelated updates do not replay it.
  useEffect(() => {
    const isCompleted = state === "completed";
    if (shouldAnimateCompletion(wasCompleted.current, isCompleted, reduce)) {
      scale.setValue(0.6);
      Animated.sequence([
        Animated.timing(scale, { toValue: BOUNCE_PEAK, duration: BOUNCE_UP_MS, easing: Easing.out(Easing.quad), useNativeDriver: true }),
        Animated.timing(scale, { toValue: 1, duration: BOUNCE_SETTLE_MS, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
      ]).start();
    } else {
      scale.setValue(1);
    }
    wasCompleted.current = isCompleted;
    return () => scale.stopAnimation();
  }, [state, reduce, scale]);

  // Only a completed day shows the closed padlock. Every other state shows the unlocked one.
  const Icon = state === "completed" ? LockKeyhole : LockKeyholeOpen;
  const iconColor = state === "missed" || state === "upcoming" ? colors.textDim : colors.accent;

  return (
    <View accessible accessibilityLabel={dayAccessibilityLabel(day)} style={styles.day}>
      <Text style={[styles.label, labelStyle(state)]}>{day.label}</Text>
      <Animated.View style={[styles.pill, pillStyle(state), { transform: [{ scale }] }]}>
        <Icon size={18} color={iconColor} strokeWidth={2.2} />
      </Animated.View>
      {/* Reserved on every day so the row does not shift when today's state changes. */}
      <View style={[styles.dot, { backgroundColor: colors.accent, opacity: day.isToday ? 1 : 0 }]} />
    </View>
  );
}

/** The pill for each state. Completed is raised with an accent tint; the rest are outlines. */
function pillStyle(state: DayState) {
  switch (state) {
    case "completed":
      return [styles.completed, { backgroundColor: colors.accentWash }];
    case "missed":
      return [{ borderWidth: StyleSheet.hairlineWidth, borderColor: colors.textDim, opacity: 0.85 }];
    case "today":
      return [{ borderWidth: 2, borderColor: colors.accent }];
    case "upcoming":
      return [{ borderWidth: StyleSheet.hairlineWidth, borderColor: colors.border, opacity: 0.4 }];
  }
}

/** The label: today and completed are clearest, missed is muted, upcoming fades the most. */
function labelStyle(state: DayState) {
  switch (state) {
    case "completed":
      return { color: colors.text, fontWeight: "600" as const };
    case "today":
      return { color: colors.text, fontWeight: "700" as const };
    case "missed":
      return { color: colors.textDim, fontWeight: "500" as const, opacity: 0.85 };
    case "upcoming":
      return { color: colors.textDim, fontWeight: "500" as const, opacity: 0.4 };
  }
}

const styles = StyleSheet.create({
  // No background fill: the row sits on the screen, with only a soft shadow beneath it.
  week: {
    flexDirection: "row",
    justifyContent: "space-between",
    borderRadius: radius.card,
    paddingHorizontal: space(1.5),
    paddingVertical: space(2),
    shadowColor: colors.border,
    shadowOpacity: 0.6,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 8 },
  },
  day: {
    flex: 1,
    alignItems: "center",
    gap: space(0.75),
  },
  label: {
    ...typeScale.footnote,
  },
  pill: {
    width: PILL,
    height: PILL,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  // A restrained raised look for completed days: a soft accent shadow, no bloom.
  completed: {
    shadowColor: colors.accent,
    shadowOpacity: 0.25,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 3,
  },
  dot: {
    width: 5,
    height: 5,
    borderRadius: 2.5,
  },
});
