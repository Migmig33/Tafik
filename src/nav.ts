export type ScreenName =
  | "onboarding"
  | "home"
  | "insights"
  | "blocklist"
  | "settings"
  | "cardSetup";

export type Nav = (screen: ScreenName) => void;
