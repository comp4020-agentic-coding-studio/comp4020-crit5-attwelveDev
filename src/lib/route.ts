import { constraintWait, precedenceViolated, zoneOf } from "./constraintState";
import type { Point, ShiftPlan, Task } from "./types";

/** The one tuning number in the whole game. */
export const DEADLINE_MARGIN = 1.2;

/** Board units per simulated minute, before the scenario's own scale. */
const UNITS_PER_MINUTE = 14;

export function travelTime(a: Point, b: Point, scale = 1): number {
  const distance = Math.hypot(b.x - a.x, b.y - a.y);
  return Math.max(1, Math.round((distance / UNITS_PER_MINUTE) * scale));
}

export type Step = {
  readonly task: Task;
  readonly leave: number;
  readonly arrive: number;
  readonly wait: number;
  readonly done: number;
};

export type Run = {
  readonly order: readonly string[];
  readonly steps: readonly Step[];
  /** Simulated minutes for the whole shift; Infinity if it can't be finished. */
  readonly total: number;
  readonly feasible: boolean;
  /** Index of the step that broke the run, or -1. */
  readonly failedAt: number;
};

/**
 * Walk one committed order and report exactly what happens, minute by
 * minute. Precedence is a property of the whole order, not of any single
 * step, so it's checked once, up front, before the order is even walked —
 * the same shape of early return as an unreachable task, just triggered
 * before travel starts rather than partway through it.
 */
export function simulateOrder(shift: ShiftPlan, order: readonly string[]): Run {
  if (precedenceViolated(shift.precedence, order)) {
    const failedAt = order.indexOf(shift.precedence!.afterId);
    return { order, steps: [], total: Infinity, feasible: false, failedAt };
  }

  const byId = new Map(shift.tasks.map((task) => [task.id, task]));
  const steps: Step[] = [];
  let clock = 0;
  let at = shift.start;

  for (const [index, id] of order.entries()) {
    const task = byId.get(id);
    if (!task) continue;
    const leave = clock;
    // Crossing the map's spatial seam costs a surcharge on top of geometric
    // travel time — not folded into `wait`, since it isn't a hazard: it's
    // what the map itself costs you for zig-zagging instead of clustering.
    const crossedZone =
      zoneOf(at.x, shift.zoneSplitX) !== zoneOf(task.location.x, shift.zoneSplitX);
    const arrive =
      clock +
      travelTime(at, task.location, shift.travelScale) +
      (crossedZone ? shift.zonePenaltyMinutes : 0);
    const wait = constraintWait(shift.hazards, id, arrive);
    if (!Number.isFinite(wait)) {
      steps.push({ task, leave, arrive, wait, done: Infinity });
      return {
        order,
        steps,
        total: Infinity,
        feasible: false,
        failedAt: index,
      };
    }
    const done = arrive + wait + task.baseTime;
    steps.push({ task, leave, arrive, wait, done });
    clock = done;
    at = task.location;
  }

  return { order, steps, total: clock, feasible: true, failedAt: -1 };
}

export function permutations<T>(items: readonly T[]): T[][] {
  if (items.length <= 1) return [[...items]];
  const out: T[][] = [];
  for (let i = 0; i < items.length; i++) {
    const head = items[i] as T;
    const rest = [...items.slice(0, i), ...items.slice(i + 1)];
    for (const tail of permutations(rest)) out.push([head, ...tail]);
  }
  return out;
}

export type Analysis = {
  readonly best: Run;
  /** Every ordering's total, Infinity included — how losable the day is. */
  readonly totals: readonly number[];
};

/**
 * Brute force. At the six-task cap that's 720 orderings of six steps each —
 * cheap enough to run at generation time, which is what lets the deadline be
 * derived from the day rather than guessed at.
 */
export function analyse(shift: ShiftPlan): Analysis {
  const ids = shift.tasks.map((task) => task.id);
  const totals: number[] = [];
  let best: Run | null = null;
  for (const order of permutations(ids)) {
    const run = simulateOrder(shift, order);
    totals.push(run.total);
    if (run.feasible && (best === null || run.total < best.total)) best = run;
  }
  return {
    best: best ?? {
      order: ids,
      steps: [],
      total: Infinity,
      feasible: false,
      failedAt: 0,
    },
    totals,
  };
}

export function optimalRun(shift: ShiftPlan): Run {
  return analyse(shift).best;
}

export function optimalTime(shift: ShiftPlan): number {
  return optimalRun(shift).total;
}

/** Share of orderings that miss the deadline — the day's difficulty, measured. */
export function lossRate(analysis: Analysis, deadline: number): number {
  const missed = analysis.totals.filter((total) => total > deadline).length;
  return missed / analysis.totals.length;
}

/** Tight, but achievable by construction — see route.test.ts. */
export function computeDeadline(shift: ShiftPlan): number {
  const optimal = optimalTime(shift);
  return Number.isFinite(optimal) ? Math.ceil(optimal * DEADLINE_MARGIN) : Infinity;
}
