// The three plans the paywall shows. This file is presentation copy only: nothing
// here starts a purchase, grants Premium or limits a feature. When billing exists,
// the purchase and entitlement logic belongs beside these definitions, and the
// paywall screen only has to call it.

export type PlanId = "free" | "pro-monthly" | "pro-lifetime";

export type Plan = {
  id: PlanId;
  name: string;
  /** The headline price as displayed, e.g. "₱49". Static until billing is connected. */
  price: string;
  /** What the price covers, e.g. "per month". */
  period: string;
  /** One line under the name that says how the plan is paid for. */
  billing: string;
  features: string[];
  /** The primary button label when this plan is selected. */
  cta: string;
};

export const PLANS: Plan[] = [
  {
    id: "free",
    name: "Free",
    price: "₱0",
    period: "",
    billing: "Free forever",
    features: [
      "1 blocked app",
      "1 registered NFC key or card",
      "Core TAFIK blocking and unlocking",
      "Basic Tempo: 2 rounds, 25-minute study, 5-minute breaks",
      "Emergency Exit and essential recovery",
      "Basic session history",
      "Unlimited Session Card sharing",
      "Offline use, no account, no ads",
    ],
    cta: "Continue with Free",
  },
  {
    id: "pro-monthly",
    name: "Pro Monthly",
    price: "₱49",
    period: "per month",
    billing: "Recurring monthly subscription",
    features: [
      "Unlimited blocked apps",
      "Multiple registered NFC keys",
      "Customizable Tempo settings",
      "Complete session history",
    ],
    cta: "Continue with Pro Monthly",
  },
  {
    id: "pro-lifetime",
    name: "Pro Lifetime",
    price: "₱99",
    period: "one-time payment",
    billing: "One-time purchase. No recurring subscription.",
    features: [
      "Unlimited blocked apps",
      "Multiple registered NFC keys",
      "Customizable Tempo settings",
      "Complete session history",
    ],
    cta: "Get Pro Lifetime",
  },
];

/** Shown when a paid plan is chosen before billing exists. It never implies a purchase happened. */
export const PURCHASES_SOON = "Purchases will be available soon.";
