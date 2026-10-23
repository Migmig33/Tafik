// The ground shadow's values, per theme. Kept free of React Native so they can be tested with Node.
// The shadow sits on the ground under the card, flat and unrotated. It has two soft layers: a narrow
// contact shadow right under the card's bottom edge, and a wider ambient shadow around it.

export type ShadowLayer = {
  colour: string;
  opacity: number; // the opacity at the centre of the ellipse
  width: number; // the ellipse's full width, in dp
  height: number; // the ellipse's full height, in dp
  centreY: number; // vertical centre, in dp from the top of the stage
};

export type ShadowTheme = { contact: ShadowLayer; ambient: ShadowLayer };

// The card's bottom edge, in stage dp from the top, at the starting angle. The contact shadow
// must sit below it.
export const CARD_BOTTOM_DP = 393;

export const SHADOW_THEME: { light: ShadowTheme; dark: ShadowTheme } = {
  light: {
    contact: { colour: "#2b2b2b", opacity: 0.22, width: 150, height: 14, centreY: 398 },
    ambient: { colour: "#5a5a5a", opacity: 0.1, width: 268, height: 36, centreY: 404 },
  },
  dark: {
    // Black alone disappears on a dark page, so the contact shadow is stronger here.
    contact: { colour: "#000000", opacity: 0.6, width: 150, height: 14, centreY: 398 },
    // A faint lighter glow keeps the ambient layer visible against the dark page.
    ambient: { colour: "#ffffff", opacity: 0.08, width: 268, height: 36, centreY: 404 },
  },
};
