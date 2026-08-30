import { describe, expect, it } from "vitest";
import { zoneOf } from "./constraintState";
import { SCENARIOS, scenarioPool } from "./data/scenarios";
import { generateRandom, generateToday } from "./generate";
import { naiveOrder } from "./naiveHeuristic";
import { optimalRun, simulateOrder } from "./route";
import { isWeekend } from "./seed";

const at = (y: number, m: number, d: number) => new Date(y, m - 1, d, 9, 0, 0);
const month = Array.from({ length: 60 }, (_, i) => new Date(2026, 8, 1 + i));

describe("scenario content", () => {
  it("gives every scenario enough tasks to sample from", () => {
    for (const scenario of SCENARIOS) {
      expect(scenario.tasks.length).toBeGreaterThanOrEqual(8);
    }
  });

  it("gives every scenario something both constraint kinds can bite on", () => {
    for (const scenario of SCENARIOS) {
      for (const kind of ["queue", "hours"] as const) {
        const tagged = scenario.tasks.filter((t) => t.tags.includes(kind));
        expect(tagged.length, `${scenario.id}/${kind}`).toBeGreaterThanOrEqual(3);
      }
    }
  });

  it("uses unique task ids within a scenario", () => {
    for (const scenario of SCENARIOS) {
      const ids = scenario.tasks.map((t) => t.id);
      expect(new Set(ids).size, scenario.id).toBe(ids.length);
    }
  });

  it("offers a real choice on both weekdays and weekends", () => {
    expect(scenarioPool(false).length).toBeGreaterThanOrEqual(3);
    expect(scenarioPool(true).length).toBeGreaterThanOrEqual(3);
  });
});

describe("generateToday", () => {
  it("is stable for a calendar date regardless of the time of day", () => {
    const morning = generateToday(new Date(2026, 8, 2, 0, 5));
    const night = generateToday(new Date(2026, 8, 2, 23, 55));
    expect(morning).toEqual(night);
  });

  it("varies day to day", () => {
    const signatures = month.map((day) => {
      const shift = generateToday(day);
      return `${shift.scenarioId}:${shift.tasks.map((t) => t.id).join(",")}`;
    });
    expect(new Set(signatures).size).toBeGreaterThan(month.length * 0.8);
  });

  it("draws weekend days from the weekend pool", () => {
    for (const day of month) {
      const shift = generateToday(day);
      const scenario = SCENARIOS.find((s) => s.id === shift.scenarioId);
      expect(isWeekend(day) ? scenario?.weekend : scenario?.weekday).toBe(true);
    }
  });

  it("reaches every weekday scenario across a couple of months", () => {
    const seen = new Set(month.map((day) => generateToday(day).scenarioId));
    expect(seen.size).toBeGreaterThanOrEqual(4);
  });

  it("stays inside the brute-forceable task cap", () => {
    for (const day of month) {
      const shift = generateToday(day);
      expect(shift.tasks.length).toBeGreaterThanOrEqual(5);
      expect(shift.tasks.length).toBeLessThanOrEqual(6);
    }
  });

  it("records the date it belongs to", () => {
    expect(generateToday(at(2026, 9, 2)).dateKey).toBe("2026-09-02");
  });
});

describe("hazards and precedence", () => {
  it("each hazard touches at least two tasks — one would be decorative", () => {
    for (const day of month) {
      const shift = generateToday(day);
      for (const hazard of shift.hazards) {
        expect(hazard.affectedTaskIds.length).toBeGreaterThanOrEqual(2);
      }
    }
  });

  it("leaves at least one task completely unflagged every day", () => {
    for (const day of month) {
      const shift = generateToday(day);
      const touched = new Set(shift.hazards.flatMap((h) => h.affectedTaskIds));
      if (shift.precedence) {
        touched.add(shift.precedence.beforeId);
        touched.add(shift.precedence.afterId);
      }
      expect(touched.size, shift.dateKey ?? "").toBeLessThan(shift.tasks.length);
    }
  });

  it("keeps hazards mutually disjoint — a card's severity badge is never ambiguous", () => {
    for (const day of month) {
      const shift = generateToday(day);
      const seen = new Set<string>();
      for (const hazard of shift.hazards) {
        for (const id of hazard.affectedTaskIds) {
          expect(seen.has(id), `${shift.dateKey}: ${id}`).toBe(false);
          seen.add(id);
        }
      }
    }
  });

  it("only touches tasks that are actually in the shift, and tagged for it", () => {
    for (const day of month) {
      const shift = generateToday(day);
      for (const hazard of shift.hazards) {
        for (const id of hazard.affectedTaskIds) {
          const task = shift.tasks.find((t) => t.id === id);
          expect(task, id).toBeDefined();
          expect(task?.tags).toContain(hazard.kind);
        }
      }
    }
  });

  it("uses both hazard kinds across a month", () => {
    const kinds = new Set(
      month.flatMap((day) => generateToday(day).hazards.map((h) => h.kind)),
    );
    expect(kinds.size).toBe(2);
  });

  it("produces queues that clear as well as queues that build", () => {
    const queues = Array.from({ length: 120 }, (_, i) => generateRandom(i * 31 + 5))
      .flatMap((shift) => shift.hazards)
      .filter((h) => h.kind === "queue");
    expect(queues.some((h) => h.kind === "queue" && h.growthRate > 0)).toBe(true);
    expect(queues.some((h) => h.kind === "queue" && h.growthRate < 0)).toBe(true);
  });

  it("keeps precedence to one active pair, always present in the day's tasks", () => {
    for (const day of month) {
      const shift = generateToday(day);
      if (!shift.precedence) continue;
      const ids = new Set(shift.tasks.map((t) => t.id));
      expect(ids.has(shift.precedence.beforeId)).toBe(true);
      expect(ids.has(shift.precedence.afterId)).toBe(true);
    }
  });

  it("guarantees a real spatial choice: at least two tasks on each side of the seam", () => {
    for (const day of month) {
      const shift = generateToday(day);
      const west = shift.tasks.filter(
        (t) => zoneOf(t.location.x, shift.zoneSplitX) === "west",
      ).length;
      const east = shift.tasks.length - west;
      expect(west, shift.dateKey ?? "").toBeGreaterThanOrEqual(2);
      expect(east, shift.dateKey ?? "").toBeGreaterThanOrEqual(2);
    }
  });
});

describe("the generator is judged against the exploit, not the average", () => {
  const shifts = [
    ...month.map(generateToday),
    ...Array.from({ length: 60 }, (_, i) => generateRandom(i * 7919 + 11)),
  ];

  it("every generated day has a feasible optimal order — never an impossible day", () => {
    for (const shift of shifts) {
      expect(optimalRun(shift).feasible, shift.dateKey ?? `seed ${shift.seed}`).toBe(
        true,
      );
    }
  });

  it("the naive strategy — deadlines first, hazards last, zones clustered — misses the deadline on most days", () => {
    const misses = shifts.filter(
      (shift) => simulateOrder(shift, naiveOrder(shift)).total > shift.deadline,
    );
    // Measured at ~0.6 against this exact shift set; 0.55 leaves headroom
    // rather than locking in today's precise number.
    expect(misses.length / shifts.length).toBeGreaterThanOrEqual(0.55);
  });
});

describe("generateRandom", () => {
  it("repeats for the same seed and differs across seeds", () => {
    expect(generateRandom(1234)).toEqual(generateRandom(1234));
    expect(generateRandom(1234)).not.toEqual(generateRandom(1235));
  });

  it("never claims a calendar date, so it can't be mistaken for Today's Shift", () => {
    for (let seed = 0; seed < 30; seed++) {
      expect(generateRandom(seed).dateKey).toBeNull();
    }
  });
});
