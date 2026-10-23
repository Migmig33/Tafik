import { StyleSheet } from "react-native";
import Svg, { Defs, Ellipse, RadialGradient, Stop } from "react-native-svg";

// A soft, neutral diffuse light behind the Dark-mode card. Two layered radial gradients give the
// falloff: a wide, faint outer spread and a slightly brighter core. Each fades to nothing at its
// edge, so there is no solid disk and no hard ring. Only white, silver and gray are used.
const CENTRE_Y = 238.5;
const CENTRE_X = 160;

// Kept inside the stage (320 x 477 dp), so nothing is clipped by the stage edges.
const OUTER = { rx: 158, ry: 225 };
const CORE = { rx: 110, ry: 160 };

const OUTER_STOPS = [
  { offset: 0, color: "#FFFFFF", opacity: 0.1 },
  { offset: 0.5, color: "#D9D9D9", opacity: 0.05 },
  { offset: 1, color: "#A6A6A6", opacity: 0 },
];
const CORE_STOPS = [
  { offset: 0, color: "#FFFFFF", opacity: 0.16 },
  { offset: 0.55, color: "#E6E6E6", opacity: 0.07 },
  { offset: 1, color: "#C8C8C8", opacity: 0 },
];

/** The soft lighting behind the card. It sits behind the shadow and the 3D model, and never covers them. */
export function DarkLighting({ stageWidth, stageHeight }: { stageWidth: number; stageHeight: number }) {
  return (
    <Svg style={StyleSheet.absoluteFill} width={stageWidth} height={stageHeight} pointerEvents="none">
      <Defs>
        <RadialGradient id="darkOuterLight" cx="50%" cy="50%" rx="50%" ry="50%">
          {OUTER_STOPS.map((stop) => (
            <Stop key={stop.offset} offset={stop.offset} stopColor={stop.color} stopOpacity={stop.opacity} />
          ))}
        </RadialGradient>
        <RadialGradient id="darkCoreLight" cx="50%" cy="50%" rx="50%" ry="50%">
          {CORE_STOPS.map((stop) => (
            <Stop key={stop.offset} offset={stop.offset} stopColor={stop.color} stopOpacity={stop.opacity} />
          ))}
        </RadialGradient>
      </Defs>
      <Ellipse cx={CENTRE_X} cy={CENTRE_Y} rx={OUTER.rx} ry={OUTER.ry} fill="url(#darkOuterLight)" />
      <Ellipse cx={CENTRE_X} cy={CENTRE_Y} rx={CORE.rx} ry={CORE.ry} fill="url(#darkCoreLight)" />
    </Svg>
  );
}
