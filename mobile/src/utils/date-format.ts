/** The device's IANA time zone, e.g. "America/Chicago". */
export function deviceTimeZone(): string {
  return Intl.DateTimeFormat().resolvedOptions().timeZone;
}

/**
 * Short event date like "Sat, Nov 14", in `timeZone` (the venue's zone when
 * known, so an event shows on its local day wherever the viewer is).
 * Returns null for a missing or unparseable date.
 */
export function formatEventDate(iso: string, timeZone: string = deviceTimeZone()): string | null {
  const date = new Date(iso);
  if (!iso || Number.isNaN(date.getTime())) return null;
  return new Intl.DateTimeFormat('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    timeZone,
  }).format(date);
}
