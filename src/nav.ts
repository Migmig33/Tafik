export type ScreenName =
  | "onboarding"
  | "home"
  | "nfc"
  | "cycle"
  | "insights"
  | "blocklist"
  | "settings"
  | "privacy"
  | "cardSetup"
  | "emergency";

export type Nav = (screen: ScreenName) => void;
