import { StyleSheet, View } from "react-native";
import Svg, { Defs, LinearGradient, Rect, Stop } from "react-native-svg";

// The shade is a soft curve from clear at the top to solid at the bottom, drawn in the
// card's own surface colour. The eased curve has no visible start or end line, so
// the bottom reads as shading on the card rather than a section or a second card.
const STEPS = 16;

function ease(t: number): number {
  return t * t * (3 - 2 * t);
}

/** Soft shading over the bottom of a loading card, in the colour of the card it sits on. */
export function SkeletonShade({ color }: { color: string }) {
  const stops = Array.from({ length: STEPS + 1 }, (_, index) => {
    const offset = index / STEPS;
    return { offset, opacity: ease(offset) * 0.96 };
  });

  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      <Svg width="100%" height="100%">
        <Defs>
          <LinearGradient id="skeletonShade" x1="0" y1="0" x2="0" y2="1">
            {stops.map((stop) => (
              <Stop key={stop.offset} offset={stop.offset} stopColor={color} stopOpacity={stop.opacity} />
            ))}
          </LinearGradient>
        </Defs>
        <Rect x="0" y="0" width="100%" height="100%" fill="url(#skeletonShade)" />
      </Svg>
    </View>
  );
}
