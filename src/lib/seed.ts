/**
 * Seeds are derived from the *calendar* date, never from a timestamp: two
 * players in different timezones on the same local date get the same shift,
 * and a shift never changes under a player mid-day.
 */

/** Local calendar date as `YYYY-MM-DD` — the key everything else hangs off. */
export function dateKey(date: Date): string {
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, "0");
  const day = `${date.getDate()}`.padStart(2, "0");
  return `${year}-${month}-${day}`;
}

/** FNV-1a over the date key: small changes in date scatter the seed. */
export function hashString(text: string): number {
  let hash = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    hash ^= text.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return hash >>> 0;
}

export function dateSeed(date: Date): number {
  return hashString(dateKey(date));
}

/**
 * ISO-ish week bucket: days since epoch, floored to weeks starting Monday.
 * Used so a whole week's shifts vary together without any day needing to know
 * what yesterday generated — skipping a day never breaks the sequence.
 */
export function weekIndex(date: Date): number {
  const days = Math.floor(
      Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()) / 86400000,
  );
  // Epoch (1970-01-01) was a Thursday; the first Monday after epoch is day 4,
  // so shift by 3 to align week-buckets to start on Monday.
  return Math.floor((days + 3) / 7);
}

export function weekSeed(date: Date): number {
  return hashString(`week:${weekIndex(date)}`);
}

/** 0 = Monday … 6 = Sunday. */
export function weekdayOffset(date: Date): number {
  return (date.getDay() + 6) % 7;
}

export function isWeekend(date: Date): boolean {
  return weekdayOffset(date) >= 5;
}

/** The seed a given day's generator actually runs on. */
export function shiftSeed(date: Date): number {
  return hashString(`${weekSeed(date)}:${weekdayOffset(date)}`);
}
