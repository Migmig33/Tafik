import React from "react";
import { ScrollView, StyleSheet, View } from "react-native";
import { Body, PrimaryButton, Screen, Title } from "./components";
import { radius, space, useTheme } from "./theme";
import { Text } from "./typography";

/**
 * Last line of defence. Without this, an unhandled render error leaves a blank
 * white screen — which for a blocker is worse than it sounds: the native
 * service keeps shielding apps whether or not the UI is alive, so a user who
 * cannot reach the screen also cannot end their session.
 *
 * Recovery is a remount rather than a restart, so an active session and its
 * elapsed time survive it.
 */
export default class ErrorBoundary extends React.Component<
  { children: React.ReactNode },
  { failed: boolean; details: string }
> {
  state = { failed: false, details: "" };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  /**
   * A release build has no red screen, no console, and no crash reporter, so
   * without keeping the message the only report a user can give is "it broke".
   * The component stack is trimmed to the first few frames: past that it is
   * provider noise, and the fallback has to stay readable on a phone.
   */
  componentDidCatch(error: Error, info: React.ErrorInfo) {
    const frames = (info?.componentStack ?? "").trim().split("\n").slice(0, 6).join("\n");
    const message = error?.message ?? String(error);
    this.setState({ details: [message, frames].filter(Boolean).join("\n\n") });
  }

  render() {
    if (!this.state.failed) return this.props.children;
    return (
      <Fallback
        details={this.state.details}
        onRetry={() => this.setState({ failed: false, details: "" })}
      />
    );
  }
}

function Fallback({ details, onRetry }: { details: string; onRetry: () => void }) {
  const { colors } = useTheme();
  return (
    <Screen>
      <View style={{ flex: 1, justifyContent: "center" }}>
        <Title>Something went wrong</Title>
        <View style={{ height: space(1.5) }} />
        <Body dim>
          TockIn hit an unexpected error. If a focus session was running it is still
          running. Your apps are still locked, and your card will still end it.
        </Body>

        {details ? (
          <>
            <View style={{ height: space(2) }} />
            <Text style={[styles.label, { color: colors.textDim }]}>WHAT HAPPENED</Text>
            {/* Selectable so the text can be long-pressed and copied straight
                into a bug report. On a release build this is the only place the
                message exists at all. */}
            <ScrollView
              style={[styles.detailBox, { backgroundColor: colors.surface, borderColor: colors.border }]}
              contentContainerStyle={{ padding: space(1.5) }}
            >
              <Text selectable style={[styles.detailText, { color: colors.textDim }]}>
                {details}
              </Text>
            </ScrollView>
          </>
        ) : null}
      </View>
      <PrimaryButton label="Try again" onPress={onRetry} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  label: {
    fontSize: 11,
    fontWeight: "600",
    letterSpacing: 0.8,
    marginBottom: space(1),
  },
  detailBox: {
    maxHeight: 220,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: radius.input,
  },
  detailText: {
    fontSize: 12,
    lineHeight: 18,
  },
});
