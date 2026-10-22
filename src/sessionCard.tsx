import { getSessions } from "./store";
import { newestSessionCard, type SessionCardFacts } from "./sessionFacts";
import type { FocusMode } from "./store";

export type { SessionCardFacts } from "./sessionFacts";
export { sessionCardFacts, newestSessionCard } from "./sessionFacts";
export { ShareSetupModal as SessionCardModal } from "./shareSetup";

/** The newest card-eligible session, optionally limited to one mode. */
export async function latestSessionCard(mode?: FocusMode): Promise<SessionCardFacts | null> {
  return newestSessionCard(await getSessions(), mode);
}
