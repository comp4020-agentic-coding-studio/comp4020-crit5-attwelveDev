import { scenarioPool, type Scenario } from "./data/scenarios";
import { mulberry32, pick, randInt, sample, type Rng } from "./prng";
import {
  analyse,
  computeDeadline,
  DEADLINE_MARGIN,
  lossRate,
  optimalTime,
} from "./route";
import { dateKey, isWeekend, shiftSeed } from "./seed";
import type {
  Constraint,
  ConstraintKind,
  Shift,
  ShiftPlan,
  Task,
} from "./types";

/** Enough orderings to reason about, few enough to brute-force. */
const MIN_TASKS = 5;
const MAX_TASKS = 6;

/** A day where most orderings win isn't a puzzle; one where most lose is noise. */
const MIN_LOSS_RATE = 0.2;
const TUNING_PASSES = 8;

const NO_CONSTRAINT: Constraint = {
  kind: "queue",
  label: "",
  affectedTaskIds: [],
  startWait: 0,
  growthRate: 0,
  cap: 0,
};

function eligible(tasks: readonly Task[], kind: ConstraintKind): Task[] {
  return tasks.filter((task) => task.tags.includes(kind));
}

function pickTasks(rng: Rng, scenario: Scenario): Task[] {
  const count = randInt(rng, MIN_TASKS, MAX_TASKS);
  // Re-roll until the day has something a constraint can actually bite on.
  for (let attempt = 0; attempt < 12; attempt++) {
    const tasks = sample(rng, scenario.tasks, count);
    const kinds = (["queue", "hours"] as const).filter(
      (kind) => eligible(tasks, kind).length >= 2,
    );
    if (kinds.length > 0) return tasks;
  }
  return sample(rng, scenario.tasks, count);
}

function buildConstraint(
  rng: Rng,
  scenario: Scenario,
  kind: ConstraintKind,
  candidates: readonly Task[],
  baseOptimal: number,
  weekend: boolean,
): Constraint {
  // The difficulty lever is how many tasks the constraint touches, not how
  // many kinds exist: one affected task is decorative, three forces trade-offs.
  const affected = sample(
    rng,
    candidates,
    randInt(rng, 2, Math.min(3, candidates.length)),
  ).map((task) => task.id);
  const ease = weekend ? 0.75 : 1;

  if (kind === "hours") {
    const fraction = (weekend ? 62 : 52) + randInt(rng, 0, 18);
    return {
      kind: "hours",
      label: scenario.hoursLabel,
      verb: scenario.hours.verb,
      closedLabel: scenario.hours.closedLabel,
      affectedTaskIds: affected,
      closeAt: Math.max(8, Math.round((baseOptimal * fraction) / 100)),
    };
  }

  // Waits are sized against the day's own length. A fixed number of minutes
  // saturates on a short shift — every order pays the cap, nothing to choose
  // between them — and disappears on a long one.
  const peak = Math.max(
    4,
    Math.round((baseOptimal * randInt(rng, 20, 34) * ease) / 100),
  );

  // Two flavours, so "constrained" never just means "do these first".
  if (rng() < 0.5) {
    return {
      kind: "queue",
      label: scenario.queueLabel,
      affectedTaskIds: affected,
      startWait: randInt(rng, 0, 2),
      growthRate: peak / (baseOptimal * (randInt(rng, 65, 90) / 100)),
      cap: Math.round(peak * 1.3),
    };
  }
  return {
    kind: "queue",
    label: scenario.queueLabel,
    affectedTaskIds: affected,
    startWait: peak,
    growthRate: -peak / (baseOptimal * (randInt(rng, 50, 75) / 100)),
    cap: peak,
  };
}

/**
 * Nudge a constraint harder (>1) or gentler (<1) without changing its shape.
 * A clearing queue tightens the other way round from a building one: it hurts
 * more when it lingers, so tightening *slows* the clear rather than speeding it.
 */
function retune(constraint: Constraint, factor: number): Constraint {
  if (constraint.kind === "hours") {
    return {
      ...constraint,
      closeAt: Math.max(6, Math.round(constraint.closeAt / factor)),
    };
  }
  const clearing = constraint.growthRate < 0;
  return {
    ...constraint,
    startWait: Math.round(constraint.startWait * factor),
    growthRate: clearing
      ? constraint.growthRate / factor
      : constraint.growthRate * factor,
    cap: Math.max(2, Math.round(constraint.cap * factor)),
  };
}

/** The designed difficulty lever: pull in one more task the constraint touches. */
function widen(constraint: Constraint, pool: readonly Task[]): Constraint {
  const next = pool.find((task) => !constraint.affectedTaskIds.includes(task.id));
  if (!next) return constraint;
  return {
    ...constraint,
    affectedTaskIds: [...constraint.affectedTaskIds, next.id],
  };
}

/**
 * Generation ends with a measured day, not a hoped-for one: the deadline comes
 * from the day's own optimal route, and the constraint is nudged until the day
 * is both winnable and genuinely losable. An unlosable shift is a broken
 * puzzle, so this keeps the most losable candidate it found rather than the
 * first one that merely worked.
 */
function tune(plan: ShiftPlan, pool: readonly Task[]): Shift {
  let current = plan;
  let best: { shift: Shift; rate: number } | null = null;

  for (let pass = 0; pass < TUNING_PASSES; pass++) {
    const analysis = analyse(current);
    if (!analysis.best.feasible) {
      current = { ...current, constraint: retune(current.constraint, 0.8) };
      continue;
    }
    const deadline = Math.ceil(analysis.best.total * DEADLINE_MARGIN);
    const rate = lossRate(analysis, deadline);
    if (rate >= MIN_LOSS_RATE) return { ...current, deadline };
    if (best === null || rate > best.rate) {
      best = { shift: { ...current, deadline }, rate };
    }
    current = {
      ...current,
      constraint: widen(retune(current.constraint, 1.3), pool),
    };
  }

  return best?.shift ?? { ...current, deadline: computeDeadline(current) };
}

function build(seed: number, weekend: boolean, day: string | null): Shift {
  const rng = mulberry32(seed);
  const scenario = pick(rng, scenarioPool(weekend));
  const tasks = pickTasks(rng, scenario);

  const visited = new Set(tasks.map((task) => task.place));
  const bare: ShiftPlan = {
    places: scenario.places.filter((place) => visited.has(place.name)),
    scenarioId: scenario.id,
    title: scenario.title,
    place: scenario.place,
    seed,
    dateKey: day,
    start: scenario.start,
    startLabel: scenario.startLabel,
    startClock: scenario.startClock,
    travelScale: scenario.travelScale,
    tasks,
    constraint: NO_CONSTRAINT,
  };

  const kinds = (["queue", "hours"] as const).filter(
    (kind) => eligible(tasks, kind).length >= 2,
  );
  const kind = kinds.length > 0 ? pick(rng, kinds) : "queue";
  const candidates = eligible(tasks, kind);
  const baseOptimal = optimalTime(bare);
  const constraint = buildConstraint(
    rng,
    scenario,
    kind,
    candidates,
    baseOptimal,
    weekend,
  );
  return tune({ ...bare, constraint }, candidates);
}

/** The same shift for every player on a given calendar date, forever. */
export function generateToday(date: Date): Shift {
  return build(shiftSeed(date), isWeekend(date), dateKey(date));
}

/** Practice. Seeded independently and never recorded. */
export function generateRandom(seed: number): Shift {
  const rng = mulberry32(seed);
  return build(seed, rng() < 2 / 7, null);
}
