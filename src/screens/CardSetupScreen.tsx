import { useEffect, useRef, useState, type RefObject } from "react";
import Svg, { Defs, LinearGradient, Rect, Stop } from "react-native-svg";
import { ScrollEdgeFade, useScrollEdge } from "../scrollEdge";
import { Alert, Pressable, ScrollView, StyleSheet, View } from "react-native";
import CreditCard from "lucide-react-native/icons/credit-card";
import Trash2 from "lucide-react-native/icons/trash-2";
import { Body, GhostButton, PrimaryButton, Screen, Title } from "../components";
import CardEnrollment from "../cardEnrollment";
import NfcCardShowcase from "../nfcCardShowcase";
import { Nav } from "../nav";
import { cancelCardRead } from "../nfc";
import { getRegisteredCards, RegisteredCard, removeRegisteredCard } from "../store";
import { radius, space, colors, typeScale } from "../theme";
import { Text } from "../typography";
import { SoftBlur, useExpoBlur } from "../softBlur";

// The blur band at the foot of the card list. Cards that scroll into it are softened; the rest stays sharp.
const BLUR_HEIGHT = space(14);

function uidHint(uid: string): string {
  return `NFC card ···· ${uid.slice(-4).toUpperCase()}`;
}

/**
 * The blur band at the foot of the list. The gradient above the blur fades its top edge into the
 * page, so the blur starts softly rather than on a line. Neither layer takes touches.
 */
function BottomBlur({ target }: { target: RefObject<View | null> }) {
  return (
    <View pointerEvents="none" style={styles.bottomBlur}>
      <SoftBlur target={target} intensity={40} />
      <Svg style={StyleSheet.absoluteFill} width="100%" height="100%">
        <Defs>
          <LinearGradient id="cardsBlurFade" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor={colors.bg} stopOpacity={0.9} />
            <Stop offset="1" stopColor={colors.bg} stopOpacity={0} />
          </LinearGradient>
        </Defs>
        <Rect x="0" y="0" width="100%" height="100%" fill="url(#cardsBlurFade)" />
      </Svg>
    </View>
  );
}

export default function CardSetupScreen({
  nav,
  active,
}: {
  nav: Nav;
  active: boolean;
}) {
  const edge = useScrollEdge();
  const [cards, setCards] = useState<RegisteredCard[]>([]);
  const [cardsReady, setCardsReady] = useState(false);
  const [adding, setAdding] = useState(false);
  // The card list is the blur target: the bottom band blurs the list content behind it.
  const blur = useExpoBlur();
  const blurTarget = useRef<View>(null);
  const Target = blur?.BlurTargetView ?? View;

  useEffect(() => {
    let mounted = true;
    getRegisteredCards().then((stored) => {
      if (!mounted) return;
      setCards(stored);
      setCardsReady(true);
    });
    // Never leave the reader listening after the screen goes away.
    return () => {
      mounted = false;
      void cancelCardRead();
    };
  }, []);

  const requestRemove = (card: RegisteredCard) => {
    if (active && cards.length === 1) {
      Alert.alert(
        "Card needed for this session",
        "End the focus session before removing your only registered card."
      );
      return;
    }
    Alert.alert(
      `Remove ${card.label}?`,
      "This card will no longer start or end focus sessions.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Remove",
          style: "destructive",
          onPress: () => {
            void removeRegisteredCard(card.uid)
              .then(setCards)
              .catch((error: any) =>
                Alert.alert("Couldn't remove card", error?.message ?? "Please try again.")
              );
          },
        },
      ]
    );
  };

  if (adding) {
    return (
      <Screen>
        <CardEnrollment
          cards={cards}
          doneLabel="Back to cards"
          returnLabel="Back to cards"
          onSaved={(next) => {
            setCards(next);
            setAdding(false);
          }}
          onCancel={() => setAdding(false)}
        />
      </Screen>
    );
  }

  return (
    <Screen>
      <Title>Your cards</Title>
      <View style={{ height: space(0.75) }} />
      <Body dim>
        Any registered card can start or end a focus session. You can start one without
        tapping a card, but only a card ends it.
      </Body>

      <View style={{ flex: 1 }}>
        <Target ref={blurTarget} style={{ flex: 1 }}>
        <ScrollView {...edge.scrollProps} style={styles.list} showsVerticalScrollIndicator={false}>
          {/* The same 3D card the Home screen shows, read from the same stored cards. It waits for the
              stored list, so an empty list is never mistaken for a missing card while it loads. */}
          {cardsReady ? (
            <View style={styles.showcase}>
              <NfcCardShowcase cards={cards} onRegister={() => setAdding(true)} />
            </View>
          ) : null}

          {cards.length > 0 ? (
            <View style={[styles.cardList, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              {cards.map((card, index) => (
                <View
                  key={card.uid}
                  style={[
                    styles.cardRow,
                    index > 0 && { borderTopWidth: StyleSheet.hairlineWidth, borderColor: colors.border },
                  ]}
                >
                  <View style={[styles.iconBox, { backgroundColor: colors.bg }]}>
                    <CreditCard size={20} color={colors.textDim} strokeWidth={2} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={{ color: colors.text, fontSize: typeScale.callout.fontSize, fontWeight: "600" }}>
                      {card.label}
                    </Text>
                    <Text style={{ color: colors.textDim, fontSize: typeScale.caption.fontSize, marginTop: 3 }}>
                      {uidHint(card.uid)}
                    </Text>
                  </View>
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={`Remove ${card.label}`}
                    onPress={() => requestRemove(card)}
                    hitSlop={10}
                    style={({ pressed }) => [styles.removeButton, { opacity: pressed ? 0.55 : 1 }]}
                  >
                    <Trash2 size={19} color={colors.textDim} strokeWidth={2} />
                  </Pressable>
                </View>
              ))}
            </View>
          ) : null}
        </ScrollView>
        </Target>
        <ScrollEdgeFade visible={edge.visible} />
        {/* Only with cards in the list: the empty state's own button must not sit under the blur. */}
        {cards.length > 0 ? <BottomBlur target={blurTarget} /> : null}
      </View>

      {/* With no card, the showcase's own "Register card" button is the way to add one. */}
      {cards.length > 0 ? (
        <PrimaryButton label="Add another card" onPress={() => setAdding(true)} />
      ) : null}
      <GhostButton label="Back" onPress={() => nav("home")} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  list: {
    flex: 1,
    marginTop: space(2),
  },
  // The bottom band of the card list. It sits inside the list's box, clipped to it, and takes no touches.
  bottomBlur: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    height: BLUR_HEIGHT,
    overflow: "hidden",
  },
  // Centred in the page, with the same stage the Home screen uses, so the card reads the same here.
  showcase: {
    alignItems: "center",
    marginBottom: space(3),
  },
  cardList: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: radius.card,
    overflow: "hidden",
  },
  cardRow: {
    minHeight: 78,
    flexDirection: "row",
    alignItems: "center",
    gap: space(1.25),
    paddingHorizontal: space(1.5),
  },
  iconBox: {
    width: 40,
    height: 40,
    borderRadius: 13,
    alignItems: "center",
    justifyContent: "center",
  },
  removeButton: {
    width: 40,
    height: 40,
    alignItems: "center",
    justifyContent: "center",
  },
});
