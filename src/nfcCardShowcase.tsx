import { useEffect, useMemo, useRef, useState } from "react";
import { Animated, Dimensions, Easing, Image, PanResponder, Pressable, StyleSheet, View } from "react-native";
import Svg, { Defs, LinearGradient, Rect, Stop } from "react-native-svg";
import ChevronLeft from "lucide-react-native/icons/chevron-left";
import ChevronRight from "lucide-react-native/icons/chevron-right";
import { Body, GhostButton, PrimaryButton } from "./components";
import { artForAppTheme, clampIndex, degreesPerPixel, displayPhase, nextIndex, previousIndex, showStaticFallback, showSwitch, threePhase } from "./cardShowcase";
import { LOADING_PREVIEW_HOLD_MS } from "./devTest";
import { FALLBACK_SCALE, FALLBACK_SHIFT_DP } from "./cardFit";
import { GroundShadow } from "./cardShadow";
import { DarkLighting } from "./darkLighting";
import CardLoading from "./cardLoading";
import { useThemeMode } from "./theme";
import NfcCard3D from "./nfcCard3D";
import type { RegisteredCard } from "./store";
import { radius, space, colors, typeScale } from "./theme";
import { Text } from "./typography";

// Rendered from the TAFIK_NFC_Cards.glb model: the white card for a dark system, the black one for a light system.
const CARD_IMAGES = {
  white: require("./assets/card/card-white.png"),
  black: require("./assets/card/card-black.png"),
};

// The static image's tilt, matching the inverted 3D view as closely as a flat image can.
const TILT = { yaw: -20, pitch: 32.0, roll: -27, perspective: 900 };

// Matches the 3D view's aspect ratio, so the fitted card lines up with the reference.
const STAGE_WIDTH = 320;
const STAGE_HEIGHT = 477;
// The 3D card and the loader change over this long, so nothing jumps or flashes.
const REVEAL_MS = 380;
// Side fade: the card fades into the page background toward each side of the stage, so it
// never hard-clips. The width is in dp; the strength is the opacity at the very edge (0 to 1).
const SIDE_FADE_WIDTH = 50;
const SIDE_FADE_STRENGTH = 1;
// Inertia after a drag is released: the spin keeps going and slows by this factor per millisecond.
const INERTIA_DECAY = 0.98;

function uidHint(uid: string): string {
  return `NFC card ···· ${uid.slice(-4).toUpperCase()}`;
}

/**
 * The home screen's showcase of the user's registered cards. It shows one card at a
 * time, named as the user named it, and switches between them when there are several.
 * It is built only from the cards passed in: nothing is invented here.
 *
 * While the 3D card loads, only the loading presentation shows. The static image appears
 * only if the 3D card fails, and retry is offered then, as an explicit user action.
 */
export default function NfcCardShowcase({
  cards,
  onRegister,
  onReady,
}: {
  cards: RegisteredCard[];
  onRegister: () => void;
  /** Called once there is nothing left to load: the card is ready or has failed, or there is no card. */
  onReady?: () => void;
}) {
  const appTheme = useThemeMode();
  const art = artForAppTheme(appTheme);
  const [index, setIndex] = useState(0);
  const [status, setStatus] = useState<"loading" | "ready" | "failed">("loading");
  // Each attempt mounts a fresh 3D view. A retry starts a new attempt.
  const [attempt, setAttempt] = useState(0);
  const [threeReady, setThreeReady] = useState(false);
  const [threeFailed, setThreeFailed] = useState(false);
  // The loading preview (development only) holds the loading screen for a few seconds.
  const [holdDone, setHoldDone] = useState(LOADING_PREVIEW_HOLD_MS === 0);
  // The phase shown on screen. The real phase is threePhase(threeReady, threeFailed).
  const phase = displayPhase(threePhase(threeReady, threeFailed), holdDone);

  // The parent holds its own first frame until this showcase has nothing left to load.
  useEffect(() => {
    if (cards.length === 0 || phase !== "loading") onReady?.();
  }, [cards.length, phase, onReady]);
  const [loaderShown, setLoaderShown] = useState(true);
  const loaderFade = useRef(new Animated.Value(0)).current;
  const reveal = useRef(new Animated.Value(0)).current;
  const fallbackFade = useRef(new Animated.Value(0)).current;

  // A card removed elsewhere can leave the selection past the end of the list.
  useEffect(() => {
    setIndex((current) => clampIndex(current, cards.length));
  }, [cards.length]);

  // A theme change swaps the image, so it has to load again before it is shown.
  useEffect(() => {
    setStatus("loading");
  }, [art]);

  // Once the phase is known, the loader fades out and the matching content fades in together.
  useEffect(() => {
    if (phase === "loading") return;
    const incoming = phase === "ready" ? reveal : fallbackFade;
    Animated.parallel([
      Animated.timing(incoming, { toValue: 1, duration: REVEAL_MS, easing: Easing.out(Easing.quad), useNativeDriver: true }),
      Animated.timing(loaderFade, { toValue: 0, duration: REVEAL_MS, easing: Easing.out(Easing.quad), useNativeDriver: true }),
    ]).start(({ finished }) => {
      if (finished) setLoaderShown(false);
    });
  }, [phase, reveal, fallbackFade, loaderFade]);

  // Each attempt holds the loading screen for the preview time, when the preview is enabled.
  useEffect(() => {
    if (LOADING_PREVIEW_HOLD_MS === 0) return;
    setHoldDone(false);
    const timer = setTimeout(() => setHoldDone(true), LOADING_PREVIEW_HOLD_MS);
    return () => clearTimeout(timer);
  }, [attempt]);

  // The loading presentation fades in each time an attempt starts, including the first.
  useEffect(() => {
    loaderFade.setValue(0);
    Animated.timing(loaderFade, { toValue: 1, duration: REVEAL_MS, easing: Easing.out(Easing.quad), useNativeDriver: true }).start();
  }, [attempt, loaderFade]);

  useEffect(() => {
    if (threeFailed) console.warn("[NfcCardShowcase] 3D preview unavailable; showing the static image.");
  }, [threeFailed]);

  // A retry starts a new attempt from the loading presentation, and only on a tap.
  const retry = () => {
    reveal.setValue(0);
    fallbackFade.setValue(0);
    setLoaderShown(true);
    setThreeReady(false);
    setThreeFailed(false);
    setAttempt((current) => current + 1);
  };

  // The turntable spin, in degrees, added to the base yaw. Only a horizontal drag changes it, so
  // nothing moves unless the user touches the card. The 3D card and the static image both read it.
  const spin = useRef(new Animated.Value(0)).current;
  const spinAtGrant = useRef(0);
  // The static image's yaw: the base tilt plus the spin, one degree per degree.
  const spinYaw = spin.interpolate({
    inputRange: [0, 1],
    outputRange: [`${TILT.yaw}deg`, `${TILT.yaw + 1}deg`],
    extrapolate: "extend",
  });

  // Horizontal drag only. A mostly vertical gesture never takes the touch, so the page can scroll.
  const pan = useMemo(
    () =>
      PanResponder.create({
        onMoveShouldSetPanResponder: (_, g) => Math.abs(g.dx) > 4 && Math.abs(g.dx) > Math.abs(g.dy) * 1.5,
        onPanResponderTerminationRequest: () => false,
        onPanResponderGrant: () => {
          spin.stopAnimation((value: number) => {
            spinAtGrant.current = value;
          });
        },
        onPanResponderMove: (_, g) => {
          spin.setValue(spinAtGrant.current + g.dx * degreesPerPixel(Dimensions.get("window").width));
        },
        onPanResponderRelease: (_, g) => {
          // Dragging keeps the card's velocity on release; it then decays to a stop, with no return.
          const velocity = g.vx * degreesPerPixel(Dimensions.get("window").width);
          Animated.decay(spin, { velocity, deceleration: INERTIA_DECAY, useNativeDriver: false }).start();
        },
      }),
    [spin]
  );

  if (cards.length === 0) {
    return (
      <View style={[styles.empty, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        <Text style={[styles.emptyTitle, { color: colors.text }]}>No card registered</Text>
        <Body dim>Register an NFC card or tag to use as your key.</Body>
        <PrimaryButton label="Register card" onPress={onRegister} />
      </View>
    );
  }

  const selected = cards[clampIndex(index, cards.length)];

  return (
    <View style={styles.wrap}>
      <View style={styles.stage} {...pan.panHandlers}>
        {/* Dark mode only: a soft neutral light behind the card, shown once the card is ready or has failed,
            so the loading screen is unchanged. They sit behind the shadow and the 3D card. */}
        {appTheme === "dark" && phase !== "loading" ? (
          <View pointerEvents="none" style={StyleSheet.absoluteFill}>
            <DarkLighting stageWidth={STAGE_WIDTH} stageHeight={STAGE_HEIGHT} />
          </View>
        ) : null}

        {/* The ground shadow fades in with the card. It stays flat under the card and does not rotate. */}
        <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, { opacity: Animated.add(reveal, fallbackFade) }]}>
          <GroundShadow mode={appTheme} stageWidth={STAGE_WIDTH} stageHeight={STAGE_HEIGHT} />
        </Animated.View>

        {/* The 3D view is mounted while loading so it can prepare. It stays hidden until ready. */}
        {!threeFailed ? (
          <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, { opacity: reveal }]}>
            <NfcCard3D
              key={attempt}
              art={art}
              spin={spin}
              onReady={() => setThreeReady(true)}
              onFail={() => setThreeFailed(true)}
            />
          </Animated.View>
        ) : null}

        {/* The static image is never shown while loading. It appears only after a failure. */}
        {showStaticFallback(phase) ? (
          <Animated.View style={[StyleSheet.absoluteFill, styles.center, { opacity: fallbackFade }]}>
            {status === "failed" ? (
              <View style={styles.fallback}>
                <Text style={[styles.fallbackLabel, { color: colors.textDim }]}>NFC card</Text>
              </View>
            ) : (
              <Animated.View
                style={{
                  transform: [
                    { translateX: FALLBACK_SHIFT_DP },
                    { scale: FALLBACK_SCALE },
                    { perspective: TILT.perspective },
                    { rotateX: `${TILT.pitch}deg` },
                    { rotateY: spinYaw },
                    { rotateZ: `${TILT.roll}deg` },
                  ],
                }}
              >
                <Image
                  source={CARD_IMAGES[art]}
                  style={styles.image}
                  resizeMode="contain"
                  onLoad={() => setStatus("ready")}
                  onError={() => setStatus("failed")}
                  accessibilityLabel={`${selected.label}, ${art} NFC card`}
                />
              </Animated.View>
            )}
          </Animated.View>
        ) : null}

        {showStaticFallback(phase) ? (
          <Animated.View pointerEvents="box-none" style={[styles.unavailable, { opacity: fallbackFade }]}>
            <Text style={[styles.unavailableLabel, { color: colors.textDim }]}>3D preview unavailable</Text>
            <GhostButton label="Retry" onPress={retry} />
          </Animated.View>
        ) : null}

        {/* A soft fade into the page background at each side of the stage, so the card never hard-clips. */}
        <View pointerEvents="none" style={StyleSheet.absoluteFill}>
          <Svg width={STAGE_WIDTH} height={STAGE_HEIGHT}>
            <Defs>
              <LinearGradient id="sideFadeLeft" x1="0" y1="0" x2="1" y2="0">
                <Stop offset="0" stopColor={colors.bg} stopOpacity={SIDE_FADE_STRENGTH} />
                <Stop offset="1" stopColor={colors.bg} stopOpacity={0} />
              </LinearGradient>
              <LinearGradient id="sideFadeRight" x1="1" y1="0" x2="0" y2="0">
                <Stop offset="0" stopColor={colors.bg} stopOpacity={SIDE_FADE_STRENGTH} />
                <Stop offset="1" stopColor={colors.bg} stopOpacity={0} />
              </LinearGradient>
            </Defs>
            <Rect x={0} y={0} width={SIDE_FADE_WIDTH} height={STAGE_HEIGHT} fill="url(#sideFadeLeft)" />
            <Rect x={STAGE_WIDTH - SIDE_FADE_WIDTH} y={0} width={SIDE_FADE_WIDTH} height={STAGE_HEIGHT} fill="url(#sideFadeRight)" />
          </Svg>
        </View>

        {/* The loading presentation sits in the middle of the stage and fades out once the phase is known. */}
        {loaderShown ? <CardLoading opacity={loaderFade} /> : null}
      </View>

      <Text style={[styles.name, { color: colors.text }]} numberOfLines={1}>
        {selected.label}
      </Text>
      <Text style={[styles.uid, { color: colors.textDim }]}>{uidHint(selected.uid)}</Text>

      {showSwitch(cards.length) ? (
        <View style={styles.switcher}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Previous card"
            hitSlop={10}
            onPress={() => setIndex(previousIndex(index, cards.length))}
            style={({ pressed }) => [styles.arrow, { opacity: pressed ? 0.55 : 1 }]}
          >
            <ChevronLeft size={22} color={colors.text} strokeWidth={2.2} />
          </Pressable>
          <Text style={[styles.count, { color: colors.textDim }]}>
            {`${clampIndex(index, cards.length) + 1} of ${cards.length}`}
          </Text>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Next card"
            hitSlop={10}
            onPress={() => setIndex(nextIndex(index, cards.length))}
            style={({ pressed }) => [styles.arrow, { opacity: pressed ? 0.55 : 1 }]}
          >
            <ChevronRight size={22} color={colors.text} strokeWidth={2.2} />
          </Pressable>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    alignItems: "center",
    gap: space(0.75),
  },
  // No panel behind the card: the stage is transparent and centred in the Home column.
  // Clipped to the stage, so the 3D view can never draw outside its box.
  stage: {
    width: STAGE_WIDTH,
    height: STAGE_HEIGHT,
    alignItems: "center",
    justifyContent: "center",
    alignSelf: "center",
    overflow: "hidden",
  },
  center: {
    alignItems: "center",
    justifyContent: "center",
  },
  image: {
    width: STAGE_WIDTH,
    height: STAGE_HEIGHT,
  },
  fallback: {
    width: 150,
    height: 200,
    alignItems: "center",
    justifyContent: "center",
  },
  fallbackLabel: {
    ...typeScale.label,
    fontWeight: "600",
  },
  // The failure message and retry sit at the bottom of the stage, clear of the static card.
  unavailable: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: "center",
    gap: space(0.5),
  },
  unavailableLabel: {
    fontSize: typeScale.footnote.fontSize,
    fontWeight: "600",
  },
  name: {
    fontSize: typeScale.headline.fontSize,
    fontWeight: "600",
    maxWidth: STAGE_WIDTH,
  },
  uid: {
    fontSize: typeScale.caption.fontSize,
  },
  switcher: {
    flexDirection: "row",
    alignItems: "center",
    gap: space(2),
  },
  arrow: {
    width: 36,
    height: 36,
    alignItems: "center",
    justifyContent: "center",
  },
  count: {
    fontSize: typeScale.footnote.fontSize,
    fontWeight: "600",
  },
  empty: {
    alignItems: "center",
    gap: space(1),
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: radius.card,
    padding: space(2.5),
  },
  emptyTitle: {
    fontSize: typeScale.body.fontSize,
    fontWeight: "600",
  },
});
