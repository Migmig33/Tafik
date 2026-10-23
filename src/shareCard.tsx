import { forwardRef } from "react";
import { Image, StyleSheet, View } from "react-native";
import type { View as NativeView } from "react-native";
import Svg, { Defs, LinearGradient, Rect, Stop } from "react-native-svg";
import { AppMark } from "./components";
import { formatCardDate, sessionSummary, type SessionCardFacts } from "./sessionFacts";
import { CARD_HEIGHT, CARD_WIDTH, type TextTone } from "./shareCardMath";
import { Text } from "./typography";

const INK = { light: "#FFFFFF", dark: "#000000" } as const;
const DIM = { light: "rgba(255, 255, 255, 0.82)", dark: "rgba(0, 0, 0, 0.72)" } as const;
// Each text colour gets a shadow of the opposite tone, so it stays readable over a photo.
const TEXT_SHADOW = {
  light: { color: "rgba(0, 0, 0, 0.5)", radius: 8 },
  dark: { color: "rgba(255, 255, 255, 0.5)", radius: 8 },
} as const;
const SCRIM = { light: "rgba(0, 0, 0, 0.45)", dark: "rgba(255, 255, 255, 0.5)" } as const;

export type ShareCardArt = {
  /** The chosen photo, or null for the default background. */
  photoUri: string | null;
  zoom: number;
  offsetX: number;
  offsetY: number;
  tone: TextTone;
};

/**
 * The shareable session image: a full-bleed background with the session details placed
 * directly on it. There is no card, panel or frame. The preview and the export both draw
 * this view, so they match.
 */
export const ShareComposition = forwardRef<NativeView, { facts: SessionCardFacts; art: ShareCardArt }>(
  function ShareComposition({ facts, art }, ref) {
    const hasPhoto = art.photoUri !== null;
    const ink = hasPhoto ? INK[art.tone] : INK.light;
    const dim = hasPhoto ? DIM[art.tone] : DIM.light;
    const shadow = TEXT_SHADOW[hasPhoto ? art.tone : "light"];
    const textShadow = { textShadowColor: shadow.color, textShadowOffset: { width: 0, height: 1 }, textShadowRadius: shadow.radius };
    const summary = sessionSummary(facts);
    const date = formatCardDate(facts.date);

    return (
      <View ref={ref} collapsable={false} style={styles.canvas}>
        {/* The background fills the whole image. */}
        {art.photoUri ? (
          <Image
            source={{ uri: art.photoUri }}
            style={[
              styles.fill,
              { transform: [{ translateX: art.offsetX }, { translateY: art.offsetY }, { scale: art.zoom }] },
            ]}
            resizeMode="cover"
          />
        ) : (
          <>
            <Svg width={CARD_WIDTH} height={CARD_HEIGHT} style={StyleSheet.absoluteFill}>
              <Defs>
                <LinearGradient id="shareDefault" x1="0" y1="0" x2="0" y2="1">
                  <Stop offset="0" stopColor="#1A1A1A" />
                  <Stop offset="1" stopColor="#000000" />
                </LinearGradient>
              </Defs>
              <Rect x="0" y="0" width={CARD_WIDTH} height={CARD_HEIGHT} fill="url(#shareDefault)" />
            </Svg>
            {/* A faint TAFIK mark keeps the empty background from reading as blank. */}
            <View style={[styles.mark, { opacity: 0.06 }]} pointerEvents="none">
              <AppMark height={320} color="#FFFFFF" />
            </View>
          </>
        )}

        {/* Soft darkening top and bottom, only over a photo, where the text sits. */}
        {hasPhoto ? (
          <Svg width={CARD_WIDTH} height={CARD_HEIGHT} style={StyleSheet.absoluteFill}>
            <Defs>
              <LinearGradient id="shareTop" x1="0" y1="0" x2="0" y2="1">
                <Stop offset="0" stopColor={SCRIM[art.tone]} />
                <Stop offset="1" stopColor={SCRIM[art.tone]} stopOpacity="0" />
              </LinearGradient>
              <LinearGradient id="shareBottom" x1="0" y1="0" x2="0" y2="1">
                <Stop offset="0" stopColor={SCRIM[art.tone]} stopOpacity="0" />
                <Stop offset="1" stopColor={SCRIM[art.tone]} />
              </LinearGradient>
            </Defs>
            <Rect x="0" y="0" width={CARD_WIDTH} height={180} fill="url(#shareTop)" />
            <Rect x="0" y={CARD_HEIGHT - 340} width={CARD_WIDTH} height={340} fill="url(#shareBottom)" />
          </Svg>
        ) : null}

        <View style={styles.top}>
          <View style={styles.brand}>
            <AppMark height={24} color={ink} />
            <Text style={[styles.brandName, { color: ink }, textShadow]}>TAFIK</Text>
          </View>
          <Text style={[styles.date, { color: dim }, textShadow]}>{date}</Text>
        </View>

        <View style={styles.bottom}>
          <Text style={[styles.kind, { color: dim }, textShadow]}>{summary.title.toUpperCase()}</Text>
          <Text style={[styles.duration, { color: ink }, textShadow]}>{summary.duration}</Text>
          <Text style={[styles.detail, { color: dim }, textShadow]}>{summary.detail}</Text>
          <Text style={[styles.status, { color: ink }, textShadow]}>COMPLETED</Text>
        </View>

        <Text style={[styles.tagline, { color: ink }, textShadow]}>Tap it. Lock it.</Text>
      </View>
    );
  }
);

const styles = StyleSheet.create({
  canvas: {
    width: CARD_WIDTH,
    height: CARD_HEIGHT,
    backgroundColor: "#000000",
    overflow: "hidden",
  },
  fill: {
    position: "absolute",
    top: 0,
    left: 0,
    width: CARD_WIDTH,
    height: CARD_HEIGHT,
  },
  mark: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: "center",
    justifyContent: "center",
  },
  top: {
    position: "absolute",
    top: 40,
    left: 28,
    right: 28,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  brand: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  brandName: {
    fontSize: 16,
    fontWeight: "700",
    letterSpacing: 2.4,
  },
  date: {
    fontSize: 13,
    fontWeight: "600",
  },
  bottom: {
    position: "absolute",
    left: 28,
    right: 28,
    bottom: 104,
    gap: 6,
  },
  kind: {
    fontSize: 12,
    fontWeight: "600",
    letterSpacing: 2,
  },
  duration: {
    fontSize: 72,
    lineHeight: 76,
    fontWeight: "700",
    letterSpacing: -1.5,
  },
  detail: {
    fontSize: 16,
    lineHeight: 22,
  },
  status: {
    marginTop: 10,
    fontSize: 13,
    fontWeight: "700",
    letterSpacing: 2,
  },
  tagline: {
    position: "absolute",
    left: 28,
    bottom: 40,
    fontSize: 15,
    fontWeight: "600",
  },
});
