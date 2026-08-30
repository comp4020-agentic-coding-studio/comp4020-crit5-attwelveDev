/**
 * Only the first attempt at a given date is ever written. Everything after it
 * is practice, and practice must not be able to overwrite a recorded result —
 * otherwise "your score" quietly becomes "your best score after retrying".
 */

const KEY = "todays-shift:v1";

export type Outcome = "made-it" | "ran-out" | "blocked";

export type Result = {
  readonly date: string;
  readonly scenarioId: string;
  readonly outcome: Outcome;
  /** Simulated minutes taken; Infinity when the shift was blocked. */
  readonly total: number;
  readonly deadline: number;
  /** The committed order, so the day's result can be replayed without re-solving it. */
  readonly order: readonly string[];
};

type Store = Record<string, Result>;

/** Storage can be absent, full, or disabled. None of that should end a game. */
function read(): Store {
  try {
    const raw = globalThis.localStorage?.getItem(KEY);
    if (!raw) return {};
    const parsed: unknown = JSON.parse(raw);
    return parsed && typeof parsed === "object" ? (parsed as Store) : {};
  } catch {
    return {};
  }
}

function write(store: Store): void {
  try {
    globalThis.localStorage?.setItem(KEY, JSON.stringify(store));
  } catch {
    // A player in a private window still gets to play; they just aren't tracked.
  }
}

export function recordFor(date: string): Result | null {
  return read()[date] ?? null;
}

/** Returns true when this became the recorded result, false when it was practice. */
export function recordFirstAttempt(result: Result): boolean {
  const store = read();
  if (store[result.date]) return false;
  store[result.date] = result;
  write(store);
  return true;
}

export type Stats = {
  readonly played: number;
  readonly madeIt: number;
  readonly ranOut: number;
  readonly blocked: number;
  /** 0–1; 0 when nothing's been played yet. */
  readonly winRate: number;
  /** Consecutive recorded days ending today (or yesterday) that were made. */
  readonly currentStreak: number;
  /** The longest such run across every recorded day, not just the live one. */
  readonly maxStreak: number;
};

function shiftDay(date: string, by: number): string {
  const [year, month, day] = date.split("-").map(Number);
  const shifted = new Date(year ?? 0, (month ?? 1) - 1, (day ?? 1) + by);
  return `${shifted.getFullYear()}-${`${shifted.getMonth() + 1}`.padStart(2, "0")}-${`${shifted.getDate()}`.padStart(2, "0")}`;
}

function previousDay(date: string): string {
  return shiftDay(date, -1);
}

function nextDay(date: string): string {
  return shiftDay(date, 1);
}

export function stats(today: string): Stats {
  const store = read();
  const results = Object.values(store);
  const madeIt = results.filter((r) => r.outcome === "made-it").length;
  const ranOut = results.filter((r) => r.outcome === "ran-out").length;
  const blocked = results.filter((r) => r.outcome === "blocked").length;

  let currentStreak = 0;
  let cursor = store[today] ? today : previousDay(today);
  while (store[cursor]?.outcome === "made-it") {
    currentStreak++;
    cursor = previousDay(cursor);
  }

  // Longest run of consecutive made-it days across every recorded date, not
  // just the one still live today — a lapsed streak stays worth remembering.
  let maxStreak = 0;
  let run = 0;
  let previous: string | null = null;
  for (const date of Object.keys(store).sort()) {
    const won = store[date]?.outcome === "made-it";
    const consecutive = previous !== null && nextDay(previous) === date;
    run = won ? (consecutive ? run + 1 : 1) : 0;
    maxStreak = Math.max(maxStreak, run);
    previous = date;
  }

  return {
    played: results.length,
    madeIt,
    ranOut,
    blocked,
    winRate: results.length > 0 ? madeIt / results.length : 0,
    currentStreak,
    maxStreak,
  };
}
