import { Pressable, StyleSheet, View } from "react-native";
import { AppMark, Body, GhostButton, Screen, TapRipple, Title } from "../components";
import { Nav } from "../nav";
import { colors, space, typeScale } from "../theme";
import { Text } from "../typography";

/**
 * The card-tapping screen. The middle button in the tab bar opens it and arms
 * the reader, so the circle, its mark and its ripple live here rather than on
 * Home. The same circle starts a session and ends one. The app shell owns the
 * read itself, so this screen only shows its state and forwards taps.
 */
export default function NfcTapScreen({
  nav,
  active,
  blockCount,
  cycleMode,
  scanning,
  onTafik,
  onStartWithoutCard,
}: {
  nav: Nav;
  active: boolean;
  blockCount: number;
  /** Cycle is the next session to start, so the circle says so. */
  cycleMode: boolean;
  /** Which read is open, if any. Owned by the app shell. */
  scanning: null | "start" | "end";
  /** Arm the reader. The same action the tab bar's centre button runs. */
  onTafik: () => void;
  /** Start the session without reading a card, behind a confirmation. */
  onStartWithoutCard: () => void;
}) {
  const waiting = active ? scanning === "end" : scanning === "start";

  return (
    <Screen>
      <Title>Tafik</Title>

      <View style={styles.cluster}>
        {active ? (
          <View style={styles.content}>
            <TapRipple active={waiting} size={184} coreSize={116}>
              <AppMark height={72} color={colors.text} />
            </TapRipple>
            <Text style={[styles.headline, { color: waiting ? colors.accent : colors.text }]}>
              {waiting ? "Ready to scan" : "Session active"}
            </Text>
            <Body dim>
              {waiting ? "Hold your card to the back of your phone." : `${blockCount} apps blocked`}
            </Body>
          </View>
        ) : (
          <View style={styles.content}>
            {/* Ripple and caption are one unit. Only this unit is pressable, so a
                tap in the empty space around it cannot arm the reader. */}
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={cycleMode ? "Tap in to start Cycle" : "Tap in to begin"}
              accessibilityState={{ disabled: waiting }}
              onPress={onTafik}
              disabled={waiting}
              style={({ pressed }) => [styles.target, { opacity: pressed ? 0.68 : 1 }]}
            >
              <TapRipple active={waiting} size={184} coreSize={116} />
              <Text style={[styles.headline, { color: waiting ? colors.accent : colors.text }]}>
                {waiting ? "Ready to scan" : cycleMode ? "Tap in to start Cycle" : "Tap in to begin"}
              </Text>
              <Body dim>
                {waiting
                  ? "Hold your card to the back of your phone."
                  : `${blockCount} apps will be locked.`}
              </Body>
            </Pressable>

            {/* Outside the circle's pressable, so the tap that reaches it can
                never also be the tap that armed the reader. */}
            {waiting ? (
              <View style={styles.withoutCard}>
                <GhostButton label="Start without card" onPress={onStartWithoutCard} />
              </View>
            ) : null}
          </View>
        )}
      </View>

      {/* Ending is done by tapping the card here or from the centre button. */}
      {active ? (
        <GhostButton label="Card lost? Emergency unlock" onPress={() => nav("emergency")} />
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  cluster: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  content: {
    alignItems: "center",
    gap: space(1),
  },
  target: {
    alignItems: "center",
    gap: space(1),
  },
  headline: {
    fontSize: typeScale.headline.fontSize,
    fontWeight: "600",
  },
  // Held well clear of the circle: this is the path that locks the phone without
  // a key in hand, so it should never be reachable by a near miss.
  withoutCard: {
    marginTop: space(3),
  },
});
