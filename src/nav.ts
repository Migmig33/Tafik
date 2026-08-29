export type ScreenName =
  | "onboarding"
  | "home"
  | "blocklist"
  | "cardSetup"
  | "blockOverlay";

export type Nav = (screen: ScreenName) => void;

// A blocked app the overlay is shown for. In the real build this comes from the
// native foreground service; here it's passed for the demo overlay.
export type BlockedApp = { name: string; pkg: string };
