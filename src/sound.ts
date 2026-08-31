import { setAudioModeAsync, useAudioPlayer, useAudioPlayerStatus } from "expo-audio";
import { useCallback, useEffect, useRef, useState } from "react";

// whoosh.wav is whoosh.mp3 with the dead air trimmed off both ends, then
// compressed and normalized to -1 dBFS: about 11 dB louder to the ear. The mp3
// is kept beside it as the untouched source, and is not bundled.
const WHOOSH = require("./assets/whoosh.wav");

/** Length of the bundled clip. Used until the player reports the real value. */
export const WHOOSH_FALLBACK_MS = 237;

// A whoosh is a short transient, far too short to drive a visible animation.
// Below this the lockup would be a flash, so the animation floors here while a
// longer replacement clip still stretches it to match.
const MIN_LOCKUP_MS = 600;

/** If the player never reports a load, play anyway rather than stay silent. */
const LOAD_TIMEOUT_MS = 800;

/**
 * The launch whoosh. Shared so the first-run welcome and the ordinary intro
 * play the same sound, and so the lockup animation can be timed against it.
 *
 * `play` is a one-shot request: call it whenever, and it fires as soon as the
 * clip is loaded (or after a short grace period if the load never reports).
 * `durationMs` is the clip's real length once known, so a shorter or longer
 * replacement file automatically retimes the animation that follows it.
 */
export function useWhoosh(): {
  play: () => void;
  /** True length of the clip. */
  durationMs: number;
  /** How long the lockup animation should run: the clip, but never a flash. */
  lockupMs: number;
} {
  const player = useAudioPlayer(WHOOSH);
  const status = useAudioPlayerStatus(player);
  const [requested, setRequested] = useState(false);
  const fired = useRef(false);

  const play = useCallback(() => setRequested(true), []);

  useEffect(() => {
    if (!requested || fired.current) return;

    const fire = () => {
      if (fired.current) return;
      fired.current = true;
      // playsInSilentMode must stay true on Android: the ringer governs
      // ringtones and notifications, not media, so leaving it false silences
      // the clip on any phone set to vibrate — which is most of them.
      setAudioModeAsync({ playsInSilentMode: true })
        .catch(() => {})
        .finally(() => {
          try {
            player.play();
          } catch (error) {
            // A silent launch is not worth a log line in a shipped build.
            if (__DEV__) console.warn("[TapIn] whoosh playback failed:", error);
          }
        });
    };

    if (status.isLoaded) {
      fire();
      return;
    }
    const timer = setTimeout(fire, LOAD_TIMEOUT_MS);
    return () => clearTimeout(timer);
  }, [player, requested, status.isLoaded]);

  const reported = status.duration;
  const durationMs =
    typeof reported === "number" && reported > 0
      ? Math.round(reported * 1000)
      : WHOOSH_FALLBACK_MS;

  return { play, durationMs, lockupMs: Math.max(durationMs, MIN_LOCKUP_MS) };
}
