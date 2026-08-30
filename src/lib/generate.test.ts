import { describe, expect, it } from "vitest";
import { SCENARIOS, scenarioPool } from "./data/scenarios";
import { generateRandom, generateToday } from "./generate";
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

describe("the day's constraint", () => {
  it("touches at least two tasks — one would be decorative", () => {
    for (const day of month) {
      const shift = generateToday(day);
      expect(shift.constraint.affectedTaskIds.length).toBeGreaterThanOrEqual(2);
      expect(shift.constraint.affectedTaskIds.length).toBeLessThan(
        shift.tasks.length,
      );
    }
  });

  it("only touches tasks that are actually in the shift, and tagged for it", () => {
    for (const day of month) {
      const shift = generateToday(day);
      for (const id of shift.constraint.affectedTaskIds) {
        const task = shift.tasks.find((t) => t.id === id);
        expect(task, id).toBeDefined();
        expect(task?.tags).toContain(shift.constraint.kind);
      }
    }
  });

  it("uses both kinds across a month", () => {
    const kinds = new Set(month.map((day) => generateToday(day).constraint.kind));
    expect(kinds.size).toBe(2);
  });

  it("produces queues that clear as well as queues that build", () => {
    const queues = Array.from({ length: 120 }, (_, i) => generateRandom(i * 31 + 5))
      .map((shift) => shift.constraint)
      .filter((c) => c.kind === "queue" && c.affectedTaskIds.length > 0);
    expect(queues.some((c) => c.kind === "queue" && c.growthRate > 0)).toBe(true);
    expect(queues.some((c) => c.kind === "queue" && c.growthRate < 0)).toBe(true);
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
