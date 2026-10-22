import type { FocusMode, SessionRecord } from "./store";

/** What a Session Card states. Every value comes from a stored session, never a guess. */
export type SessionCardFacts = {
  mode: FocusMode;
  /** Local date of the session, as stored: YYYY-MM-DD. */
  date: string;
  /** Whole minutes: the blocked time for TAFIK, the completed study time for Tempo. */
  minutes: number;
  /** Tempo only, and only when the round count was recorded. */
  rounds?: { done: number; total: number };
};

/**
 * The card for one stored session, or null when no card should be offered. A card
 * is offered only for a session that completed, and only when it was recorded with
 * its mode. Older records lack that, so they get no card rather than a guessed one.
 */
export function sessionCardFacts(record: SessionRecord): SessionCardFacts | null {
  if (record.c !== true || !record.m) return null;
  const minutes = Math.floor(record.s / 60);
  if (record.m === "cycle" && record.r !== undefined) {
    return { mode: "cycle", date: record.d, minutes, rounds: { done: record.r, total: record.r } };
  }
  return { mode: record.m, date: record.d, minutes };
}

/** The newest card-eligible session in the given records, optionally limited to one mode. */
export function newestSessionCard(records: SessionRecord[], mode?: FocusMode): SessionCardFacts | null {
  for (let index = records.length - 1; index >= 0; index -= 1) {
    const facts = sessionCardFacts(records[index]);
    if (facts && (!mode || facts.mode === mode)) return facts;
  }
  return null;
}

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/** YYYY-MM-DD as "Oct 23, 2026". Anything unexpected is shown as stored rather than guessed at. */
export function formatCardDate(key: string): string {
  const [year, month, day] = key.split("-").map(Number);
  if (!year || !month || !day || month < 1 || month > 12) return key;
  return `${MONTHS[month - 1]} ${day}, ${year}`;
}

/**
 * The words the Home card shows for one completed session. Only what the record holds
 * is named: start and end times and the number of apps are not stored, so they are never shown.
 */
export function sessionSummary(facts: SessionCardFacts): {
  title: string;
  date: string;
  duration: string;
  detail: string;
} {
  const tempo = facts.mode === "cycle";
  const under = facts.minutes < 1;
  const duration = under ? "Under a minute" : `${facts.minutes} min`;
  const date = formatCardDate(facts.date);

  if (tempo) {
    const rounds = facts.rounds ? ` · ${facts.rounds.done} of ${facts.rounds.total} rounds` : "";
    return {
      title: "Tempo session",
      date,
      duration,
      detail: `Study time ${under ? "under a minute" : `${facts.minutes} min`}${rounds}`,
    };
  }

  return {
    title: "TAFIK session",
    date,
    duration,
    detail: under
      ? "Apps blocked for under a minute."
      : `Apps blocked for ${facts.minutes} ${facts.minutes === 1 ? "minute" : "minutes"}.`,
  };
}
