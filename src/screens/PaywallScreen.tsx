import { useState } from "react";
import { Pressable, ScrollView, StyleSheet, View } from "react-native";
import Check from "lucide-react-native/icons/check";
import { Body, PrimaryButton, Screen, Title } from "../components";
import { PLANS, PURCHASES_SOON, type Plan, type PlanId } from "../plans";
import { radius, space, colors, typeScale } from "../theme";
import { Text } from "../typography";

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
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.content}>
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

      <View style={styles.actions}>
        <PrimaryButton label={selected.cta} onPress={onPrimary} />
        <Text style={[styles.fineprint, { color: colors.textDim }]}>
          Prices are shown for reference. Nothing is charged in this version.
        </Text>
      </View>
    </Screen>
  );
}

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
        {
          backgroundColor: background,
          borderColor: selected ? colors.text : colors.border,
          borderWidth: selected ? 2 : StyleSheet.hairlineWidth,
          opacity: pressed ? 0.85 : 1,
        },
      ]}
    >
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
  actions: {
    gap: space(1),
    paddingBottom: space(1),
  },
  fineprint: {
    fontSize: typeScale.caption.fontSize,
    textAlign: "center",
  },
});
