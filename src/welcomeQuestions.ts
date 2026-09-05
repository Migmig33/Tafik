import type { DistractionAnswer, ScreenTimeAnswer, WelcomeAnswers } from "./store";

/**
 * The two questions asked on first launch, and the story they select.
 *
 * The point is not data collection. It is that "you opened it to check one
 * thing" lands only if scrolling is actually your problem, and reads as noise
 * if your problem is a game. Four openings, one of which will be the user's
 * own, beats one opening that is nobody's.
 */

export type Option<T> = { value: T; label: string };

export const SCREEN_TIME_OPTIONS: Option<ScreenTimeAnswer>[] = [
  { value: "light", label: "1 hour or less" },
  { value: "moderate", label: "2 to 3 hours" },
  { value: "heavy", label: "4 to 6 hours" },
  { value: "extreme", label: "7 hours or more" },
];

/**
 * Five habits that do not overlap. Doomscrolling and short videos were the same
 * answer wearing two labels, so videos now means the thing you press play on,
 * and the endless feed keeps doomscrolling to itself. The last two cover the
 * pulls that are not an app at all: a conversation you cannot leave, and a buzz
 * that takes you somewhere else.
 */
export const DISTRACTION_OPTIONS: Option<DistractionAnswer>[] = [
  { value: "doomscroll", label: "Doomscrolling" },
  { value: "videos", label: "Videos" },
  { value: "games", label: "Games" },
  { value: "messages", label: "Messages" },
  { value: "notifications", label: "Notifications" },
];

export const SCREEN_TIME_QUESTION = "How long are you on your phone most days?";
export const DISTRACTION_QUESTION = "What pulls you away most?";

/** The opening beats. Three lines each, in the user's own situation. */
const DISTRACTION_STORY: Record<DistractionAnswer, string[]> = {
  doomscroll: [
    "You opened it to check one thing.",
    "Forty minutes later, you're still scrolling.",
    "The feed has no bottom. That's not an accident.",
  ],
  videos: [
    "You pressed play on one thing.",
    "Three videos later, the evening is gone.",
    "Autoplay never asks whether you're done.",
  ],
  games: [
    "One more round. You meant it at the time.",
    "That was three rounds ago.",
    "The next match is queued before the last one ends.",
  ],
  messages: [
    "One reply was all it needed.",
    "Then the thread moved, and you moved with it.",
    "A conversation has no natural place to stop.",
  ],
  notifications: [
    "It buzzed once. You looked.",
    "You were somewhere else for the next ten minutes.",
    "Every interruption costs more than the second it takes.",
  ],
};

/**
 * The fourth beat: what the habit costs over a week. Stated in hours rather
 * than as a scolding, because the number does that work on its own. A light
 * user gets no guilt line, since there is nothing honest to be alarmed about.
 */
const SCREEN_TIME_COST: Record<ScreenTimeAnswer, string> = {
  light: "You already hold that line. This is how you keep holding it.",
  moderate: "That is around 18 hours a week.",
  heavy: "That is about 35 hours a week. A full working week, every week.",
  extreme: "That is close to 50 hours a week. More than a full-time job.",
};

/** Where every version of the story lands, and what the card is for. */
const CLOSING_LINE = "So we gave you an ending you can hold.";

/**
 * The story for a set of answers. Falls back to the doomscrolling opening and
 * no cost line when the questions were skipped or could not be read, so the
 * screen always has something to say.
 */
export function welcomeLines(answers: WelcomeAnswers | null): string[] {
  if (!answers) return [...DISTRACTION_STORY.doomscroll, CLOSING_LINE];
  return [
    ...DISTRACTION_STORY[answers.distraction],
    SCREEN_TIME_COST[answers.screenTime],
    CLOSING_LINE,
  ];
}
