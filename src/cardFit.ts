// Placement of the Home card, fitted for the 320 x 477 dp stage. These values are shared by the
// 3D card and the static fallback, so both show the same size and position.

// The card's scale. The previous scale was 0.95; this is that times 1.12. At this scale the
// projected card stays inside the stage at every spin angle, with a small margin on each side.
export const CARD_SCALE = 0.95 * 1.12;

// The pivot offset that centres the card's projected silhouette in the stage at the starting
// angle. It sits on the spin pivot, so the card turns about its own centre. The previous value
// was -0.0059 on the card, which put the silhouette 41 px right of centre and made it swing.
export const CARD_OFFSET_X = -0.01;
// The vertical offset is unchanged.
export const CARD_OFFSET_Y = 0.0941;

// The static fallback image: the same scale, and a shift that centres its artwork. The artwork's
// opaque pixels sit 0.5135 of the way across, so the shift is (0.5 - 0.5135) of the 320 dp width.
export const FALLBACK_SCALE = 1.12;
export const FALLBACK_SHIFT_DP = (0.5 - 0.5135) * 320;

// Lighting for the 3D card, per card. The black card (Light mode) keeps its original soft wash.
// The white card (Dark mode) gets a directional key from the upper left and a very faint fill,
// so its edges and face read as a shaded 3D object rather than a flat white shape.
export const LIGHTING_BY_CARD = {
  black: {
    ambient: 0.7,
    keyIntensity: 1.4,
    keyPosition: [0.2, 0.3, 1] as const,
    fillIntensity: 0.5,
    fillPosition: [-0.3, -0.2, 0.6] as const,
  },
  white: {
    ambient: 0.9,
    keyIntensity: 1.1,
    keyPosition: [-0.5, 0.6, 0.8] as const,
    fillIntensity: 0.15,
    fillPosition: [0.6, -0.3, 0.5] as const,
  },
};
