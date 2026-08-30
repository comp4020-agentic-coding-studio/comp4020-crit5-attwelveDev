import { describe, expect, it } from "vitest";
import { constraintWait } from "./constraintState";
import { generateRandom, generateToday } from "./generate";
import {
  analyse,
  computeDeadline,
  DEADLINE_MARGIN,
  lossRate,
  optimalRun,
  permutations,
  simulateOrder,
  travelTime,
} from "./route";
import type { Shift, ShiftPlan } from "./types";

const days = Array.from({ length: 60 }, (_, i) => new Date(2026, 8, 1 + i));
const randoms = Array.from({ length: 60 }, (_, i) => generateRandom(i * 7919 + 3));

/**
 * ── The game's rule, under test ────────────────────────────────────────────
 *
 * The deadline is derived from the day's own best possible route, so a shift
 * is always winnable, and a shift is always losable. Both halves matter: the
 * first makes a loss the player's fault, the second makes a win mean anything.
 * This is the claim the whole design rests on, and it is checked against the
 * real generator across every scenario, not against a fixture.
 */
describe("every generated shift is winnable, and losable", () => {
  const shifts: Shift[] = [...days.map(generateToday), ...randoms];

  it("covers more than one scenario", () => {
    expect(new Set(shifts.map((s) => s.scenarioId)).size).toBeGreaterThan(1);
  });

  for (const shift of shifts) {
    const name = `${shift.dateKey ?? `seed ${shift.seed}`} · ${shift.title}`;

    it(`${name}: the best possible order meets the deadline`, () => {
      const best = optimalRun(shift);
      expect(best.feasible).toBe(true);
      expect(best.total).toBeLessThanOrEqual(shift.deadline);
    });

    it(`${name}: at least one order misses the deadline`, () => {
      const { totals } = analyse(shift);
      expect(Math.max(...totals)).toBeGreaterThan(shift.deadline);
    });
  }
});

describe("difficulty is measured, not hoped for", () => {
  it("keeps most days meaningfully losable", () => {
    const rates = days
      .map(generateToday)
      .map((shift) => lossRate(analyse(shift), shift.deadline));
    const median = rates.sort((a, b) => a - b)[Math.floor(rates.length / 2)] ?? 0;
    expect(median).toBeGreaterThanOrEqual(0.2);
  });
});

describe("travelTime", () => {
  it("is symmetric and never free", () => {
    const a = { x: 10, y: 10 };
    const b = { x: 80, y: 60 };
    expect(travelTime(a, b)).toBe(travelTime(b, a));
    expect(travelTime(a, a)).toBeGreaterThan(0);
  });

  it("scales with the scenario", () => {
    const a = { x: 0, y: 0 };
    const b = { x: 90, y: 0 };
    expect(travelTime(a, b, 0.5)).toBeLessThan(travelTime(a, b, 1.3));
  });
});

describe("permutations", () => {
  it("produces n! distinct orderings", () => {
    const out = permutations([1, 2, 3, 4]);
    expect(out).toHaveLength(24);
    expect(new Set(out.map((o) => o.join(""))).size).toBe(24);
  });
});

describe("simulateOrder", () => {
  const shift = generateToday(new Date(2026, 8, 2));

  it("accounts for every minute: travel + wait + work", () => {
    const run = simulateOrder(shift, shift.tasks.map((t) => t.id));
    let clock = 0;
    for (const step of run.steps) {
      expect(step.leave).toBe(clock);
      expect(step.arrive).toBeGreaterThan(step.leave);
      expect(step.done).toBe(step.arrive + step.wait + step.task.baseTime);
      clock = step.done;
    }
    expect(run.total).toBe(clock);
  });

  it("uses the same constraint function the deadline was solved with", () => {
    const run = simulateOrder(shift, shift.tasks.map((t) => t.id));
    for (const step of run.steps) {
      expect(step.wait).toBe(
        constraintWait(shift.constraint, step.task.id, step.arrive),
      );
    }
  });

  it("stops dead at an unreachable task rather than fudging it", () => {
    const closed: ShiftPlan = {
      ...shift,
      constraint: {
        kind: "hours",
        label: "Test",
        verb: "closes at",
        closedLabel: "Closed",
        affectedTaskIds: [shift.tasks[shift.tasks.length - 1]!.id],
        closeAt: 0,
      },
    };
    const run = simulateOrder(closed, closed.tasks.map((t) => t.id));
    expect(run.feasible).toBe(false);
    expect(run.total).toBe(Infinity);
    expect(run.failedAt).toBe(closed.tasks.length - 1);
  });
});

describe("computeDeadline", () => {
  it("is the optimal route plus a fixed margin, never an authored number", () => {
    const shift = generateToday(new Date(2026, 8, 3));
    expect(computeDeadline(shift)).toBe(
      Math.ceil(optimalRun(shift).total * DEADLINE_MARGIN),
    );
  });
});
