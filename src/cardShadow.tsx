import { StyleSheet } from "react-native";
import Svg, { Defs, Ellipse, RadialGradient, Stop } from "react-native-svg";
import { SHADOW_THEME, type ShadowLayer } from "./cardShadowTheme";

// The shadow's gradient fades to nothing at its edge, so there is no hard outline.
const STOPS = [
  { offset: 0, factor: 1 },
  { offset: 0.5, factor: 0.45 },
  { offset: 1, factor: 0 },
];

function Layer({ id, layer, stageWidth }: { id: string; layer: ShadowLayer; stageWidth: number }) {
  return (
    <>
      <Defs>
        <RadialGradient id={id} cx="50%" cy="50%" rx="50%" ry="50%">
          {STOPS.map((stop) => (
            <Stop key={stop.offset} offset={stop.offset} stopColor={layer.colour} stopOpacity={layer.opacity * stop.factor} />
          ))}
        </RadialGradient>
      </Defs>
      <Ellipse cx={stageWidth / 2} cy={layer.centreY} rx={layer.width / 2} ry={layer.height / 2} fill={`url(#${id})`} />
    </>
  );
}

/** The two-layer ground shadow for the card's stage. It is centred horizontally under the card. */
export function GroundShadow({ mode, stageWidth, stageHeight }: { mode: "light" | "dark"; stageWidth: number; stageHeight: number }) {
  const theme = SHADOW_THEME[mode];
  return (
    <Svg style={StyleSheet.absoluteFill} width={stageWidth} height={stageHeight} pointerEvents="none">
      <Layer id="ambientShadow" layer={theme.ambient} stageWidth={stageWidth} />
      <Layer id="contactShadow" layer={theme.contact} stageWidth={stageWidth} />
    </Svg>
  );
}
