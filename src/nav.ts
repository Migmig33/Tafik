export type ScreenName =
  | "onboarding"
  | "home"
  | "insights"
  | "blocklist"
  | "settings"
  | "privacy"
  | "cardSetup"
  | "emergency";

export type Nav = (screen: ScreenName) => void;
