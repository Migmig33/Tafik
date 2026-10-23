import { useRef } from "react";
import { PanResponder, Pressable, StyleSheet, View } from "react-native";
import { colors, space } from "./theme";
import { Text } from "./typography";

// Rolling number wheels for the Cycle schedule. Study and Break are vertical
// wheels side by side, with a colon between them. Cycle sits below them as a
// horizontal wheel. The selected value is large and centred, with neighbours on
// either side that fade with distance. Drag a wheel, or tap a neighbour, to change
// it. The active wheel is fully lit, and the vertical ones mark it with a diamond.

const STEP_PX = 22; // drag distance for one value
// Every vertical row is the same height, as in the reference: the selected value
// sits in the middle row, with two rows above and two below.
const ROW = 66;
const WHEEL_WIDTH = 116;
const CELL_WIDTH = 56;
const LABEL_HEIGHT = 18;
const COLON_SIZE = 56;
const DIAMOND = 12;

// The wheels loop: going past the largest value comes back to the smallest, and going
// below the smallest comes back to the largest.
const wrap = (value: number, min: number, max: number) => {
  const span = max - min + 1;
  return ((((value - min) % span) + span) % span) + min;
};

type WheelProps = {
  label: string;
  value: number;
  min: number;
  max: number;
  active: boolean;
  onChange: (value: number) => void;
  onActivate: () => void;
};

/** A vertical wheel. Drag it up or down to change the value. */
function Wheel({ label, value, min, max, active, onChange, onActivate, diamond = true }: WheelProps & { diamond?: boolean }) {
  // The gesture handler is created once, so it reads the latest props from here.
  const latest = useRef({ value, min, max, onChange, onActivate });
  latest.current = { value, min, max, onChange, onActivate };
  const dragStart = useRef(value);

  const pan = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_, g) => Math.abs(g.dy) > 6 && Math.abs(g.dy) > Math.abs(g.dx),
      onPanResponderGrant: () => {
        dragStart.current = latest.current.value;
        latest.current.onActivate();
      },
      onPanResponderMove: (_, g) => {
        const { min: lo, max: hi, value: current, onChange: change } = latest.current;
        const next = wrap(dragStart.current + Math.round(-g.dy / STEP_PX), lo, hi);
        if (next !== current) change(next);
      },
    })
  ).current;

  const offsets = [-2, -1, 0, 1, 2];

  return (
    <View
      accessibilityRole="adjustable"
      accessibilityLabel={`${label}, ${value}`}
      style={[styles.wheel, { opacity: active ? 1 : 0.35 }]}
      {...pan.panHandlers}
    >
      <Text style={[styles.label, { color: colors.textDim }]}>{label.toUpperCase()}</Text>
      <View style={styles.column}>
        {offsets.map((offset) => {
          const number = wrap(value + offset, min, max);
          const isCenter = offset === 0;
          const opacity = isCenter ? 1 : Math.abs(offset) === 1 ? 0.9 : 0.45;
          return (
            <Pressable
              key={offset}
              accessibilityRole="button"
              accessibilityLabel={`${label} ${number}`}
              onPress={() => {
                latest.current.onActivate();
                if (!isCenter) onChange(number);
              }}
              style={[styles.row, { height: ROW, width: WHEEL_WIDTH }]}
            >
              <Text
                style={{
                  color: colors.text,
                  opacity,
                  fontSize: isCenter ? 80 : 46,
                  lineHeight: isCenter ? ROW : 50,
                  fontWeight: isCenter ? "700" : "600",
                  fontVariant: ["tabular-nums"],
                }}
              >
                {number}
              </Text>
            </Pressable>
          );
        })}

        {active && diamond ? <View style={[styles.diamond, { backgroundColor: colors.text }]} /> : null}
      </View>
    </View>
  );
}

/** A horizontal wheel for Cycle. Drag it left or right to change the value. */
function HorizontalWheel({ label, value, min, max, active, onChange, onActivate }: WheelProps) {
  const latest = useRef({ value, min, max, onChange, onActivate });
  latest.current = { value, min, max, onChange, onActivate };
  const dragStart = useRef(value);

  const pan = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_, g) => Math.abs(g.dx) > 6 && Math.abs(g.dx) > Math.abs(g.dy),
      onPanResponderGrant: () => {
        dragStart.current = latest.current.value;
        latest.current.onActivate();
      },
      onPanResponderMove: (_, g) => {
        const { min: lo, max: hi, value: current, onChange: change } = latest.current;
        // Dragging left moves to larger values, as a wheel does.
        const next = wrap(dragStart.current + Math.round(-g.dx / STEP_PX), lo, hi);
        if (next !== current) change(next);
      },
    })
  ).current;

  const offsets = [-2, -1, 0, 1, 2];

  return (
    <View
      accessibilityRole="adjustable"
      accessibilityLabel={`${label}, ${value}`}
      style={[styles.horizontal, { opacity: active ? 1 : 0.35 }]}
      {...pan.panHandlers}
    >
      <View style={styles.rowWide}>
        {offsets.map((offset) => {
          const number = wrap(value + offset, min, max);
          const isCenter = offset === 0;
          const opacity = isCenter ? 1 : Math.abs(offset) === 1 ? 0.9 : 0.45;
          return (
            <Pressable
              key={offset}
              accessibilityRole="button"
              accessibilityLabel={`${label} ${number}`}
              onPress={() => {
                latest.current.onActivate();
                if (!isCenter) onChange(number);
              }}
              style={[styles.cell, { width: CELL_WIDTH }]}
            >
              <Text
                style={{
                  color: colors.text,
                  opacity,
                  fontSize: isCenter ? 40 : 26,
                  lineHeight: isCenter ? 42 : 28,
                  fontWeight: isCenter ? "700" : "600",
                  fontVariant: ["tabular-nums"],
                }}
              >
                {number}
              </Text>
            </Pressable>
          );
        })}
      </View>
      <Text style={[styles.labelBelow, { color: colors.textDim }]}>{label.toUpperCase()}</Text>
    </View>
  );
}

function Colon() {
  return (
    <Text style={[styles.colon, { color: colors.text }]} accessibilityElementsHidden>
      :
    </Text>
  );
}

type Schedule = { studyMinutes: number; breakMinutes: number; rounds: number };

/** Which wheel is active. Shared by both halves, so only one wheel is lit at a time. */
export type ActiveWheel = "study" | "break" | "cycles";

type ScheduleProps = {
  study: number;
  breakMinutes: number;
  cycles: number;
  onChange: (next: Schedule) => void;
  active: ActiveWheel;
  onActivate: (wheel: ActiveWheel) => void;
};

/**
 * The schedule wheels, in two parts so the page can place them apart. The top part
 * is Study and Break side by side. The bottom part is Cycle, on its own row.
 */
export function CycleWheels({
  part,
  ...props
}: ScheduleProps & { part: "top" | "bottom" }) {
  const { study, breakMinutes, cycles, onChange, active, onActivate } = props;

  if (part === "bottom") {
    return (
      <View style={styles.bottomRow}>
        <HorizontalWheel
          label="Cycle"
          value={cycles}
          min={1}
          max={12}
          active={active === "cycles"}
          onActivate={() => onActivate("cycles")}
          onChange={(next) => onChange({ studyMinutes: study, breakMinutes, rounds: next })}
        />
      </View>
    );
  }

  return (
    <View style={styles.picker}>
      <Wheel
        label="Study"
        value={study}
        min={1}
        max={180}
        active={active === "study"}
        diamond={false}
        onActivate={() => onActivate("study")}
        onChange={(studyMinutes) => onChange({ studyMinutes, breakMinutes, rounds: cycles })}
      />
      <Colon />
      <Wheel
        label="Break"
        diamond={false}
        value={breakMinutes}
        min={1}
        max={60}
        active={active === "break"}
        onActivate={() => onActivate("break")}
        onChange={(next) => onChange({ studyMinutes: study, breakMinutes: next, rounds: cycles })}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  bottomRow: {
    alignItems: "center",
    paddingTop: space(2),
  },
  picker: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "center",
    gap: space(0.75),
  },
  wheel: {
    width: WHEEL_WIDTH,
    alignItems: "center",
  },
  label: {
    height: LABEL_HEIGHT,
    fontSize: 11,
    lineHeight: 14,
    fontWeight: "600",
    letterSpacing: 2.4,
    opacity: 0.4,
  },
  column: {
    alignItems: "center",
    justifyContent: "flex-start",
  },
  row: {
    alignItems: "center",
    justifyContent: "center",
  },
  // Sits on the boundary between the row above and the selected value, as in the reference.
  diamond: {
    position: "absolute",
    top: ROW * 2 - DIAMOND / 2,
    alignSelf: "center",
    width: DIAMOND,
    height: DIAMOND,
    borderRadius: 2,
    transform: [{ rotate: "45deg" }],
  },
  colon: {
    width: space(1.5),
    marginTop: LABEL_HEIGHT + ROW * 2 + ROW / 2 - COLON_SIZE / 2,
    fontSize: COLON_SIZE,
    lineHeight: COLON_SIZE,
    fontWeight: "700",
    textAlign: "center",
  },
  horizontal: {
    alignItems: "center",
    gap: space(0.5),
  },
  rowWide: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
  },
  cell: {
    alignItems: "center",
    justifyContent: "center",
  },
  labelBelow: {
    fontSize: 11,
    lineHeight: 14,
    fontWeight: "600",
    letterSpacing: 2.4,
    opacity: 0.4,
  },
});
