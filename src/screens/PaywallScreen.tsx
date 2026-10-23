import { useEffect, useRef, useState, type ComponentType } from "react";
import { Pressable, ScrollView, StyleSheet, UIManager, View } from "react-native";
import Svg, { Defs, RadialGradient, Rect, Stop } from "react-native-svg";
import Check from "lucide-react-native/icons/check";
import { Body, PrimaryButton, Screen, Title } from "../components";
import { PLANS, PURCHASES_SOON, type Plan, type PlanId } from "../plans";
import { radius, space, colors, typeScale, useThemeMode } from "../theme";
import { Text } from "../typography";
import { useExpoBlur } from "../softBlur";


// The native masked view is loaded only when this build has it, so a build without it still opens
// the Paywall, with the blur shown unmasked.
function useMaskedView() {
  const [Masked, setMasked] = useState<ComponentType<any> | null>(null);
  useEffect(() => {
    if (!UIManager.hasViewManagerConfig("RNCMaskedView")) return;
    let cancelled = false;
    import("@react-native-masked-view/masked-view")
      .then((module) => {
        if (!cancelled) setMasked(() => module.default);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);
  return Masked;
}

/**
 * The mask for the blur. Only its alpha is used: opaque across the middle and fading to nothing
 * at the rim on every side, so the blur's top, sides and bottom dissolve into the page.
 */
function FeatherMask() {
  return (
    <Svg style={StyleSheet.absoluteFill} viewBox="0 0 100 100" preserveAspectRatio="none">
      <Defs>
        <RadialGradient id="blurFeather" cx="50%" cy="50%" rx="50%" ry="50%">
          <Stop offset={0.55} stopColor="#000000" stopOpacity={1} />
          <Stop offset={1} stopColor="#000000" stopOpacity={0} />
        </RadialGradient>
      </Defs>
      <Rect x={0} y={0} width={100} height={100} fill="url(#blurFeather)" />
    </Svg>
  );
}

/**
 * The plan choice shown after the first-use experience. Presentation only: Free
 * continues into the app, and a paid plan never claims that a purchase happened.
 * Billing will attach to onContinue for a paid plan when it exists.
 */
export default function PaywallScreen({ onContinueFree }: { onContinueFree: () => void }) {
  // Free is selected first, so nothing is pre-chosen for the user.
  const [selectedId, setSelectedId] = useState<PlanId>("free");
  const [notice, setNotice] = useState<string | null>(null);
  const selected = PLANS.find((plan) => plan.id === selectedId) ?? PLANS[0];
  // The scrolling cards are the blur target. The action area floats over them, and its height
  // sets how much room the list keeps at the end, so the last card can scroll clear of it.
  const blurTarget = useRef<View>(null);
  const [actionsHeight, setActionsHeight] = useState(0);
  const blur = useExpoBlur();
  const Masked = useMaskedView();
  const mode = useThemeMode();
  const Target = blur?.BlurTargetView ?? View;

  const choose = (id: PlanId) => {
    setSelectedId(id);
    setNotice(null);
  };

  const onPrimary = () => {
    if (selected.id === "free") {
      onContinueFree();
      return;
    }
    // Billing does not exist yet, so a paid choice only says so.
    setNotice(PURCHASES_SOON);
  };

  return (
    <Screen>
      <View style={styles.body}>
        <Target ref={blurTarget} style={styles.body}>
          <ScrollView
            showsVerticalScrollIndicator={false}
            contentContainerStyle={[styles.content, { paddingBottom: actionsHeight + space(2) }]}
          >
            <Title bold>Make focus your default.</Title>
            <View style={{ height: space(1) }} />
            <Body dim>Choose the level of control that works for you.</Body>

            <View style={styles.plans}>
              {PLANS.map((plan) => (
                <PlanCard
                  key={plan.id}
                  plan={plan}
                  selected={plan.id === selectedId}
                  onPress={() => choose(plan.id)}
                />
              ))}
            </View>

            {notice ? (
              <Text style={[styles.notice, { color: colors.textDim }]}>{notice}</Text>
            ) : null}
          </ScrollView>
        </Target>

        {/* The wrapper has no background of its own. The blur is the only thing behind the button and the note. */}
        <View
          style={styles.actions}
          onLayout={(event) => setActionsHeight(event.nativeEvent.layout.height)}
        >
          {blur
            ? Masked
              ? (
                <Masked style={StyleSheet.absoluteFill} maskElement={<FeatherMask />} pointerEvents="none">
                  <blur.BlurView
                    blurTarget={blurTarget}
                    tint={mode === "light" ? "light" : "dark"}
                    intensity={40}
                    blurMethod="dimezisBlurViewSdk31Plus"
                    pointerEvents="none"
                    style={StyleSheet.absoluteFill}
                  />
                </Masked>
              )
              : (
                <blur.BlurView
                  blurTarget={blurTarget}
                  tint={mode === "light" ? "light" : "dark"}
                  intensity={40}
                  blurMethod="dimezisBlurViewSdk31Plus"
                  pointerEvents="none"
                  style={StyleSheet.absoluteFill}
                />
              )
            : null}
          <PrimaryButton label={selected.cta} onPress={onPrimary} />
          <Text style={[styles.fineprint, { color: colors.textDim }]}>
            Prices are shown for reference. Nothing is charged in this version.
          </Text>
        </View>
      </View>
    </Screen>
  );
}

// Clears the badge (12 px inset plus about 24 px tall) with a little room to spare, so the name
// never sits under it. Only the featured card uses it.
const BADGE_CLEAR_TOP = 40;

function PlanCard({ plan, selected, onPress }: { plan: Plan; selected: boolean; onPress: () => void }) {
  // Lifetime is the one plan filled in, so it stands out even when it is not selected.
  const featured = plan.id === "pro-lifetime";
  const ink = featured ? colors.onAccent : colors.text;
  const dim = featured ? colors.onAccent : colors.textDim;
  const background = featured ? colors.accent : colors.surface;

  return (
    <Pressable
      accessibilityRole="radio"
      accessibilityState={{ selected }}
      accessibilityLabel={`${plan.name}, ${plan.price} ${plan.period}`}
      onPress={onPress}
      style={({ pressed }) => [
        styles.card,
        // The badge sits in the top-right, so the featured card leaves room for it above the name.
        featured ? { paddingTop: BADGE_CLEAR_TOP } : null,
        {
          backgroundColor: background,
          borderColor: selected ? colors.text : colors.border,
          borderWidth: selected ? 2 : StyleSheet.hairlineWidth,
          opacity: pressed ? 0.85 : 1,
        },
      ]}
    >
      {/* The card is accent, so the badge takes the inverse pair: on-accent behind accent text. */}
      {featured ? (
        <View style={[styles.badge, { backgroundColor: colors.onAccent }]}>
          <Text style={[styles.badgeText, { color: colors.accent }]}>BEST VALUE</Text>
        </View>
      ) : null}

      <View style={styles.cardHeader}>
        <Text style={[styles.planName, { color: ink }]}>{plan.name}</Text>
        {selected ? <Check size={20} color={ink} strokeWidth={2.6} /> : null}
      </View>

      <View style={styles.priceRow}>
        <Text style={[styles.price, { color: ink }]}>{plan.price}</Text>
        {plan.period ? <Text style={[styles.period, { color: dim }]}>{plan.period}</Text> : null}
      </View>
      <Text style={[styles.billing, { color: dim }]}>{plan.billing}</Text>

      {selected ? (
        <View style={styles.features}>
          {plan.features.map((feature) => (
            <Text key={feature} style={[styles.feature, { color: ink }]}>
              {`•  ${feature}`}
            </Text>
          ))}
        </View>
      ) : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  body: {
    flex: 1,
  },
  content: {
    paddingBottom: space(2),
  },
  plans: {
    marginTop: space(3),
    gap: space(1.5),
  },
  card: {
    borderRadius: radius.card,
    padding: space(2),
    gap: space(0.5),
  },
  // Top-right, 12 px in from each edge. Fully rounded, with a small label and no shadow or border.
  badge: {
    position: "absolute",
    top: 12,
    right: 12,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 999,
  },
  badgeText: {
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 0.6,
  },
  cardHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  planName: {
    fontSize: typeScale.headline.fontSize,
    fontWeight: "600",
  },
  priceRow: {
    flexDirection: "row",
    alignItems: "baseline",
    gap: space(1),
    marginTop: space(0.5),
  },
  price: {
    fontSize: typeScale.title.fontSize,
    fontWeight: "700",
  },
  period: {
    fontSize: typeScale.footnote.fontSize,
    fontWeight: "600",
  },
  billing: {
    fontSize: typeScale.footnote.fontSize,
    lineHeight: typeScale.footnote.lineHeight,
  },
  features: {
    marginTop: space(1.25),
    gap: space(0.75),
  },
  feature: {
    fontSize: typeScale.callout.fontSize,
    lineHeight: typeScale.callout.lineHeight,
  },
  notice: {
    marginTop: space(2),
    fontSize: typeScale.callout.fontSize,
    fontWeight: "600",
    textAlign: "center",
  },
  // Floats over the bottom of the list, inside the screen margins. The blur covers the whole
  // area, including its padding, so the cards show through softly behind the button and the note.
  actions: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    gap: space(1),
    paddingTop: space(2),
    paddingBottom: space(1),
    overflow: "hidden",
  },
  fineprint: {
    fontSize: typeScale.caption.fontSize,
    textAlign: "center",
  },
});
