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

export type Summary = {
  readonly played: number;
  readonly madeIt: number;
  /** Consecutive recorded days ending today (or yesterday) that were made. */
  readonly streak: number;
};

function previousDay(date: string): string {
  const [year, month, day] = date.split("-").map(Number);
  const previous = new Date(year ?? 0, (month ?? 1) - 1, (day ?? 1) - 1);
  return `${previous.getFullYear()}-${`${previous.getMonth() + 1}`.padStart(2, "0")}-${`${previous.getDate()}`.padStart(2, "0")}`;
}

export function summary(today: string): Summary {
  const store = read();
  const results = Object.values(store);

  let streak = 0;
  let cursor = store[today] ? today : previousDay(today);
  while (store[cursor]?.outcome === "made-it") {
    streak++;
    cursor = previousDay(cursor);
  }

  return {
    played: results.length,
    madeIt: results.filter((r) => r.outcome === "made-it").length,
    streak,
  };
}
