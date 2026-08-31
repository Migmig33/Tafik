export type ScreenName =
  | "onboarding"
  | "home"
  | "insights"
  | "blocklist"
  | "settings"
  | "cardSetup"
  | "emergency";

export type Nav = (screen: ScreenName) => void;
