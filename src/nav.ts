export type ScreenName =
  | "onboarding"
  | "home"
  | "studin"
  | "insights"
  | "blocklist"
  | "settings"
  | "privacy"
  | "cardSetup"
  | "emergency";

export type Nav = (screen: ScreenName) => void;
