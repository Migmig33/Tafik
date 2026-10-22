import { createContext } from "react";
import { space } from "./theme";

/** How far the centre button rises above the top edge of the bar. */
export const ACTION_RISE = 26;

/** Height of the bar itself, not counting the rise or the space below it. */
export const BAR_HEIGHT = 66;

/** The whole bottom area: the rise, the bar, and the space under the bar. */
export const NAV_HEIGHT = ACTION_RISE + BAR_HEIGHT + space(2);

/**
 * Room a tab screen keeps free at the end of its scroll, so the last item stops
 * above the centre button rather than under it.
 */
export const NAV_CLEARANCE = NAV_HEIGHT + space(1);

/**
 * True on the four tab screens. The bar floats over them, so the screen runs to
 * the bottom of the phone and its scroll content keeps NAV_CLEARANCE at the end.
 */
export const TabBarBelowContext = createContext(false);

/** The bar's bottom edge, measured up from the bottom of the phone. */
export const BAR_BOTTOM = space(2);

/** The bar's top edge, measured up from the bottom of the phone. */
export const BAR_TOP = BAR_BOTTOM + BAR_HEIGHT;

/**
 * How far above the bar's top edge the fade begins. From the Blocklist measurements
 * the fade starts at the top of the seventh row, 53 dp above the bar (685 dp against
 * 738 dp). It is measured from the bar, so it holds on any screen size.
 */
export const FADE_RISE_ABOVE_BAR = 53;
