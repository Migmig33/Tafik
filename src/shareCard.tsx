import { forwardRef } from "react";
import { Image, StyleSheet, View } from "react-native";
import type { View as NativeView } from "react-native";
import Svg, { Defs, LinearGradient, Rect, Stop } from "react-native-svg";
import { AppMark } from "./components";
import { formatCardDate, sessionSummary, type SessionCardFacts } from "./sessionFacts";
import { CARD_HEIGHT, CARD_WIDTH, type TextTone } from "./shareCardMath";
import { Text } from "./typography";

// The NFC card renders, upright. White reads on the dark default and on a dark-text
// photo gets the black card instead.
const CARD_IMAGES = {
  white: require("./assets/card/card-white.png"),
  black: require("./assets/card/card-black.png"),
};

const INK = { light: "#FFFFFF", dark: "#000000" } as const;
const SCRIM = { light: "rgba(0, 0, 0, 0.58)", dark: "rgba(255, 255, 255, 0.62)" } as const;

export type ShareCardArt = {
  /** The chosen photo, or null for the default template. */
  photoUri: string | null;
  zoom: number;
  offsetX: number;
  offsetY: number;
  tone: TextTone;
};

/**
 * The vertical share card, 360 by 640 points. It is the exact layout that is exported,
 * so the preview and the shared image match. Controls never sit inside it.
 */
export const ShareCard = forwardRef<NativeView, { facts: SessionCardFacts; art: ShareCardArt }>(
  function ShareCard({ facts, art }, ref) {
    const ink = art.photoUri ? INK[art.tone] : INK.light;
    const dim = art.photoUri ? (art.tone === "light" ? "rgba(255,255,255,0.78)" : "rgba(0,0,0,0.7)") : "rgba(255,255,255,0.62)";
    const scrim = art.photoUri ? SCRIM[art.tone] : null;
    const summary = sessionSummary(facts);
    const date = formatCardDate(facts.date);
    const card = art.photoUri && art.tone === "dark" ? CARD_IMAGES.black : CARD_IMAGES.white;

    return (
      <View ref={ref} collapsable={false} style={styles.canvas}>
        {/* Background: the photo, moved and zoomed by the user, or the default gradient. */}
        {art.photoUri ? (
          <Image
            source={{ uri: art.photoUri }}
            style={[
              styles.photo,
              {
                transform: [
                  { translateX: art.offsetX },
                  { translateY: art.offsetY },
                  { scale: art.zoom },
                ],
              },
            ]}
            resizeMode="cover"
          />
        ) : (
          <Svg width={CARD_WIDTH} height={CARD_HEIGHT} style={StyleSheet.absoluteFill}>
            <Defs>
              <LinearGradient id="shareDefault" x1="0" y1="0" x2="0" y2="1">
                <Stop offset="0" stopColor="#1A1A1A" />
                <Stop offset="1" stopColor="#000000" />
              </LinearGradient>
            </Defs>
            <Rect x="0" y="0" width={CARD_WIDTH} height={CARD_HEIGHT} fill="url(#shareDefault)" />
          </Svg>
        )}

        {/* Soft scrims top and bottom keep the text readable over any photo. */}
        {scrim ? (
          <Svg width={CARD_WIDTH} height={CARD_HEIGHT} style={StyleSheet.absoluteFill}>
            <Defs>
              <LinearGradient id="shareTop" x1="0" y1="0" x2="0" y2="1">
                <Stop offset="0" stopColor={scrim} />
                <Stop offset="1" stopColor={scrim} stopOpacity="0" />
              </LinearGradient>
              <LinearGradient id="shareBottom" x1="0" y1="0" x2="0" y2="1">
                <Stop offset="0" stopColor={scrim} stopOpacity="0" />
                <Stop offset="1" stopColor={scrim} />
              </LinearGradient>
            </Defs>
            <Rect x="0" y="0" width={CARD_WIDTH} height={190} fill="url(#shareTop)" />
            <Rect x="0" y={CARD_HEIGHT - 340} width={CARD_WIDTH} height={340} fill="url(#shareBottom)" />
          </Svg>
        ) : null}

        <View style={styles.top}>
          <View style={styles.brand}>
            <AppMark height={24} color={ink} />
            <Text style={[styles.brandName, { color: ink }]}>TAFIK</Text>
          </View>
          <Text style={[styles.date, { color: dim }]}>{date}</Text>
        </View>

        <View style={styles.cardWrap}>
          <Image source={card} style={styles.cardImage} resizeMode="contain" />
        </View>

        <View style={styles.bottom}>
          <Text style={[styles.kind, { color: dim }]}>{summary.title.toUpperCase()}</Text>
          <Text style={[styles.duration, { color: ink }]}>{summary.duration}</Text>
          <Text style={[styles.detail, { color: dim }]}>{summary.detail}</Text>
          <View style={[styles.pill, { borderColor: ink }]}>
            <Text style={[styles.pillText, { color: ink }]}>Completed</Text>
          </View>
          <View style={[styles.rule, { backgroundColor: dim }]} />
          <Text style={[styles.tagline, { color: ink }]}>Tap it. Lock it.</Text>
        </View>
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
  photo: {
    position: "absolute",
    top: 0,
    left: 0,
    width: CARD_WIDTH,
    height: CARD_HEIGHT,
  },
  top: {
    position: "absolute",
    top: 36,
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
  cardWrap: {
    position: "absolute",
    top: 96,
    left: 0,
    right: 0,
    height: 300,
    alignItems: "center",
    justifyContent: "center",
  },
  cardImage: {
    width: 300,
    height: 300,
  },
  bottom: {
    position: "absolute",
    left: 28,
    right: 28,
    bottom: 96,
    gap: 6,
  },
  kind: {
    fontSize: 12,
    fontWeight: "600",
    letterSpacing: 2,
  },
  duration: {
    fontSize: 64,
    lineHeight: 68,
    fontWeight: "700",
    letterSpacing: -1.5,
  },
  detail: {
    fontSize: 16,
    lineHeight: 22,
  },
  pill: {
    alignSelf: "flex-start",
    marginTop: 10,
    borderWidth: 1.5,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 5,
  },
  pillText: {
    fontSize: 13,
    fontWeight: "700",
  },
  rule: {
    height: StyleSheet.hairlineWidth,
    marginTop: 18,
    opacity: 0.6,
  },
  tagline: {
    marginTop: 12,
    fontSize: 15,
    fontWeight: "600",
  },
});
