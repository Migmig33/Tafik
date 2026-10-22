// The rules behind the share card editor. Kept free of React Native so they can be
// tested directly with Node.

/** The share card's design size in points. It is exported at 1080 by 1920 pixels. */
export const CARD_WIDTH = 360;
export const CARD_HEIGHT = 640;

/** Zoom is never smaller than the card, so the photo always covers it. */
export const MIN_ZOOM = 1;
export const MAX_ZOOM = 3;

export function clampZoom(zoom: number): number {
  return Math.min(Math.max(zoom, MIN_ZOOM), MAX_ZOOM);
}

/**
 * The furthest the photo may move from centre along one axis. At zoom 1 it cannot
 * move at all; a larger zoom allows movement only as far as the photo overhangs the card.
 */
export function maxOffset(zoom: number, size: number): number {
  return ((clampZoom(zoom) - 1) * size) / 2;
}

export function clampOffset(offset: number, zoom: number, size: number): number {
  const limit = maxOffset(zoom, size);
  return Math.min(Math.max(offset, -limit), limit);
}

/** The text colour that reads on a card: light text on the default black, and on a photo the user chose. */
export type TextTone = "light" | "dark";

export function textToneFor(hasPhoto: boolean, choice: TextTone): TextTone {
  return hasPhoto ? choice : "light";
}

const SUPPORTED_MIME = ["image/jpeg", "image/png", "image/webp"];

/**
 * Whether a picked image can be used. A missing type is accepted, because the picker
 * does not always report one; the image preview then reports a file it cannot draw.
 */
export function isSupportedImage(mimeType: string | null | undefined): boolean {
  if (!mimeType) return true;
  return SUPPORTED_MIME.includes(mimeType.toLowerCase());
}

/** The file extension a saved background is stored under, from its type. */
export function extensionFor(mimeType: string | null | undefined): string {
  if (mimeType === "image/png") return "png";
  if (mimeType === "image/webp") return "webp";
  return "jpg";
}
