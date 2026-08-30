import { beforeEach, describe, expect, it } from "vitest";
import { recordFirstAttempt, recordFor, stats, type Result } from "./stats";

/**
 * Vitest's default environment is plain Node, which has no `localStorage` —
 * stats.ts already treats that as "untracked, not broken" via optional
 * chaining, but a unit test needs somewhere real to write to. A tiny
 * in-memory stand-in is enough; it only needs to satisfy what stats.ts calls.
 */
class MemoryStorage {
  private store = new Map<string, string>();
  getItem(key: string): string | null {
    return this.store.has(key) ? (this.store.get(key) ?? null) : null;
  }
  setItem(key: string, value: string): void {
    this.store.set(key, value);
  }
  clear(): void {
    this.store.clear();
  }
}

(globalThis as unknown as { localStorage: MemoryStorage }).localStorage =
  new MemoryStorage();

function result(date: string, outcome: Result["outcome"]): Result {
  return {
    date,
    scenarioId: "getting-ready",
    outcome,
    total: outcome === "made-it" ? 40 : Infinity,
    deadline: 48,
    order: ["a", "b", "c"],
  };
}

beforeEach(() => {
  globalThis.localStorage.clear();
});

describe("recordFirstAttempt", () => {
  it("records the first attempt for a date, and refuses every one after", () => {
    expect(recordFirstAttempt(result("2026-08-01", "made-it"))).toBe(true);
    expect(recordFirstAttempt(result("2026-08-01", "ran-out"))).toBe(false);
    expect(recordFor("2026-08-01")?.outcome).toBe("made-it");
  });

  it("keeps the committed order alongside the outcome", () => {
    recordFirstAttempt(result("2026-08-01", "made-it"));
    expect(recordFor("2026-08-01")?.order).toEqual(["a", "b", "c"]);
  });
});

describe("stats", () => {
  it("is all zero with nothing recorded", () => {
    expect(stats("2026-08-10")).toEqual({
      played: 0,
      madeIt: 0,
      ranOut: 0,
      blocked: 0,
      winRate: 0,
      currentStreak: 0,
      maxStreak: 0,
    });
  });

  it("counts played, made-it, and win rate", () => {
    recordFirstAttempt(result("2026-08-01", "made-it"));
    recordFirstAttempt(result("2026-08-02", "ran-out"));
    recordFirstAttempt(result("2026-08-03", "blocked"));
    recordFirstAttempt(result("2026-08-04", "made-it"));
    const s = stats("2026-08-04");
    expect(s.played).toBe(4);
    expect(s.madeIt).toBe(2);
    expect(s.ranOut).toBe(1);
    expect(s.blocked).toBe(1);
    expect(s.winRate).toBeCloseTo(0.5);
  });

  it("counts the current streak back from today through consecutive wins", () => {
    recordFirstAttempt(result("2026-08-01", "made-it"));
    recordFirstAttempt(result("2026-08-02", "made-it"));
    recordFirstAttempt(result("2026-08-03", "made-it"));
    expect(stats("2026-08-03").currentStreak).toBe(3);
  });

  it("breaks the current streak on a loss, or a gap in play", () => {
    recordFirstAttempt(result("2026-08-01", "made-it"));
    recordFirstAttempt(result("2026-08-02", "ran-out"));
    recordFirstAttempt(result("2026-08-03", "made-it"));
    expect(stats("2026-08-03").currentStreak).toBe(1);
  });

  it("still counts the streak through yesterday if today hasn't been played", () => {
    recordFirstAttempt(result("2026-08-01", "made-it"));
    recordFirstAttempt(result("2026-08-02", "made-it"));
    expect(stats("2026-08-03").currentStreak).toBe(2);
  });

  it("remembers the longest streak even after it's lapsed", () => {
    recordFirstAttempt(result("2026-08-01", "made-it"));
    recordFirstAttempt(result("2026-08-02", "made-it"));
    recordFirstAttempt(result("2026-08-03", "made-it"));
    recordFirstAttempt(result("2026-08-04", "ran-out"));
    recordFirstAttempt(result("2026-08-05", "made-it"));
    const s = stats("2026-08-05");
    expect(s.currentStreak).toBe(1);
    expect(s.maxStreak).toBe(3);
  });

  it("treats a missed day as breaking the streak, not merely a loss would", () => {
    recordFirstAttempt(result("2026-08-01", "made-it"));
    recordFirstAttempt(result("2026-08-02", "made-it"));
    // 2026-08-03 never played at all.
    recordFirstAttempt(result("2026-08-04", "made-it"));
    const s = stats("2026-08-04");
    expect(s.maxStreak).toBe(2);
  });
});
