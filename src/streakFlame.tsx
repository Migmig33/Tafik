import Svg, { Path } from "react-native-svg";

// An original flame drawn for TAFIK: a teardrop with an inner notch on the left. It is not
// a copy of any other app's artwork.
export function StreakFlame({ color, size = 26 }: { color: string; size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" accessible={false}>
      <Path
        d="M12 2.5c.6 2.9 2.3 4.4 4 6.1 1.5 1.6 2.5 3.4 2.5 6A6.5 6.5 0 0 1 12 21.5a6.5 6.5 0 0 1-6.5-6.9c0-2.2.9-3.9 2.2-5.3.2 1.6 1 2.8 2.1 3.5C9.6 8.4 10.2 5 12 2.5Z"
        fill={color}
      />
    </Svg>
  );
}
