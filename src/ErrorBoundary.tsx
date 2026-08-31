import React from "react";
import { View } from "react-native";
import { Body, PrimaryButton, Screen, Title } from "./components";
import { space } from "./theme";

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
  { failed: boolean }
> {
  state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  render() {
    if (!this.state.failed) return this.props.children;
    return <Fallback onRetry={() => this.setState({ failed: false })} />;
  }
}

function Fallback({ onRetry }: { onRetry: () => void }) {
  return (
    <Screen>
      <View style={{ flex: 1, justifyContent: "center" }}>
        <Title>Something went wrong</Title>
        <View style={{ height: space(1.5) }} />
        <Body dim>
          TapIn hit an unexpected error. If a focus session was running it is still
          running — your apps are still locked, and your card will still end it.
        </Body>
      </View>
      <PrimaryButton label="Try again" onPress={onRetry} />
    </Screen>
  );
}
