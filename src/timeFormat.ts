/**
 * The clock's text for a whole number of seconds. Only the precision the time needs is shown:
 * seconds alone under a minute, minutes and seconds under an hour, and hours too from an hour on.
 * Leading zero groups are dropped, but the groups after the first keep two digits, so the
 * units never shift position as they change. Negative input reads as zero, so a finished
 * countdown shows "0" rather than a value below it.
 */
export function formatClock(totalSeconds: number): string {
  const s = Math.max(0, Math.floor(totalSeconds));
  if (s < 60) return String(s);

  const pad = (n: number) => n.toString().padStart(2, "0");
  const minutes = Math.floor(s / 60);
  const seconds = s % 60;
  if (s < 3600) return `${minutes}:${pad(seconds)}`;

  const hours = Math.floor(s / 3600);
  return `${hours}:${pad(minutes % 60)}:${pad(seconds)}`;
}
