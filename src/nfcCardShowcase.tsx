import { useEffect, useRef, useState } from "react";
import { Animated, Easing, Image, Pressable, StyleSheet, useColorScheme, View } from "react-native";
import ChevronLeft from "lucide-react-native/icons/chevron-left";
import ChevronRight from "lucide-react-native/icons/chevron-right";
import { Body, PrimaryButton } from "./components";
import { artForScheme, clampIndex, nextIndex, previousIndex, showSwitch } from "./cardShowcase";
import { useReducedMotion } from "./motion";
import NfcCard3D from "./nfcCard3D";
import type { RegisteredCard } from "./store";
import { radius, space, colors, typeScale } from "./theme";
import { Text } from "./typography";

// Rendered from the TAFIK_NFC_Cards.glb model: the white card for a dark system, the black one for a light system.
const CARD_IMAGES = {
  white: require("./assets/card/card-white.png"),
  black: require("./assets/card/card-black.png"),
};

// The stage behind the card contrasts with it, so the white card never sits on white
// and the black card never sits on black. These are the palette's charcoal and off-white.
const BACKDROP = { white: "#1A1A1A", black: "#F2F2F2" } as const;

const STAGE_WIDTH = 240;
const STAGE_HEIGHT = 300;
// One sway from one side to the other and back. Slow enough to read as a card at rest.
const SWAY_MS = 3200;

function uidHint(uid: string): string {
  return `NFC card ···· ${uid.slice(-4).toUpperCase()}`;
}

/**
 * The home screen's showcase of the user's registered cards. It shows one card at a
 * time, named as the user named it, and switches between them when there are several.
 * It is built only from the cards passed in: nothing is invented here.
 */
export default function NfcCardShowcase({
  cards,
  onRegister,
}: {
  cards: RegisteredCard[];
  onRegister: () => void;
}) {
  const scheme = useColorScheme();
  const reduce = useReducedMotion();
  const art = artForScheme(scheme === "light" || scheme === "dark" ? scheme : null);
  const [index, setIndex] = useState(0);
  const [status, setStatus] = useState<"loading" | "ready" | "failed">("loading");
  // The 3D card replaces the static image once it is ready. If it cannot run, the image stays.
  const [threeReady, setThreeReady] = useState(false);
  const [threeFailed, setThreeFailed] = useState(false);

  // A card removed elsewhere can leave the selection past the end of the list.
  useEffect(() => {
    setIndex((current) => clampIndex(current, cards.length));
  }, [cards.length]);

  // A theme change swaps the image, so it has to load again before it is shown.
  useEffect(() => {
    setStatus("loading");
  }, [art]);

  // Subtle sway for the card. It stops entirely when the user asks for reduced motion.
  const sway = useRef(new Animated.Value(0.5)).current;
  useEffect(() => {
    if (reduce) {
      sway.setValue(0.5);
      return;
    }
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(sway, {
          toValue: 1,
          duration: SWAY_MS,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
        Animated.timing(sway, {
          toValue: 0,
          duration: SWAY_MS,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [reduce, sway]);

  const rotate = sway.interpolate({ inputRange: [0, 1], outputRange: ["-2deg", "2deg"] });

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
      <View style={[styles.stage, { backgroundColor: BACKDROP[art] }]}>
        {status === "failed" ? (
          <View style={[styles.fallback, { borderColor: colors.border, backgroundColor: colors.surface }]}>
            <Text style={[styles.fallbackLabel, { color: colors.textDim }]}>NFC card</Text>
          </View>
        ) : (
          <Animated.View style={{ transform: [{ rotate: reduce ? "0deg" : rotate }] }}>
            <Image
              source={CARD_IMAGES[art]}
              style={[styles.image, { opacity: threeReady ? 0 : 1 }]}
              resizeMode="contain"
              onLoad={() => setStatus("ready")}
              onError={() => setStatus("failed")}
              accessibilityLabel={`${selected.label}, ${art} NFC card`}
            />
          </Animated.View>
        )}
        {!threeFailed ? (
          <NfcCard3D
            art={art}
            reduceMotion={reduce}
            onReady={() => setThreeReady(true)}
            onFail={() => setThreeFailed(true)}
          />
        ) : null}
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
  stage: {
    width: STAGE_WIDTH,
    height: STAGE_HEIGHT,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: radius.card,
  },
  image: {
    width: STAGE_WIDTH,
    height: STAGE_HEIGHT,
  },
  fallback: {
    width: 150,
    height: 200,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: radius.card,
    alignItems: "center",
    justifyContent: "center",
  },
  fallbackLabel: {
    ...typeScale.label,
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
