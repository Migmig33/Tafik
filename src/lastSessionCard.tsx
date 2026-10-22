import { StyleSheet, View } from "react-native";
import { Body, PrimaryButton } from "./components";
import { sessionSummary, type SessionCardFacts } from "./sessionFacts";
import { radius, space, colors, typeScale } from "./theme";
import { Text } from "./typography";

/**
 * The most recent completed session, shown under Today's Tafik with its own share
 * action. With no completed session yet it says so, and offers nothing to share.
 */
export default function LastSessionCard({
  facts,
  onShare,
}: {
  facts: SessionCardFacts | null;
  onShare: () => void;
}) {
  if (!facts) {
    return (
      <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        <Text style={[styles.label, { color: colors.textDim }]}>LAST SESSION</Text>
        <Body dim>A completed session will appear here once you finish one.</Body>
      </View>
    );
  }

  const summary = sessionSummary(facts);
  return (
    <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
      <View style={styles.header}>
        <Text style={[styles.label, { color: colors.textDim }]}>LAST SESSION</Text>
        <Text style={[styles.date, { color: colors.textDim }]}>{summary.date}</Text>
      </View>

      <View style={styles.titleRow}>
        <Text style={[styles.title, { color: colors.text }]}>{summary.title}</Text>
        <View style={[styles.pill, { backgroundColor: colors.accentWash }]}>
          <Text style={[styles.pillText, { color: colors.accent }]}>Completed</Text>
        </View>
      </View>
      <Text style={[styles.duration, { color: colors.text }]} numberOfLines={1}>
        {summary.duration}
      </Text>

      <Text style={[styles.detail, { color: colors.textDim }]}>{summary.detail}</Text>

      <PrimaryButton label="Share session" onPress={onShare} />
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    gap: space(1.25),
    padding: space(2),
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: radius.card,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  label: {
    ...typeScale.label,
    fontWeight: "600",
  },
  date: {
    fontSize: typeScale.footnote.fontSize,
    fontWeight: "600",
  },
  titleRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  title: {
    fontSize: typeScale.callout.fontSize,
    fontWeight: "600",
  },
  duration: {
    fontSize: typeScale.title.fontSize,
    fontWeight: "700",
  },
  pill: {
    borderRadius: radius.pill,
    paddingHorizontal: space(1.25),
    paddingVertical: space(0.6),
  },
  pillText: {
    fontSize: typeScale.caption.fontSize,
    fontWeight: "600",
  },
  detail: {
    fontSize: typeScale.footnote.fontSize,
    lineHeight: typeScale.footnote.lineHeight,
  },
});
