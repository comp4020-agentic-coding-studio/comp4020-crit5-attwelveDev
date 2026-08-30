import { zoneOf } from "./constraintState";
import { scenarioPool, type Scenario } from "./data/scenarios";
import { naiveOrder } from "./naiveHeuristic";
import { mulberry32, pick, randInt, sample, type Rng } from "./prng";
import {
  analyse,
  computeDeadline,
  DEADLINE_MARGIN,
  lossRate,
  optimalTime,
  simulateOrder,
} from "./route";
import { dateKey, isWeekend, shiftSeed } from "./seed";
import type {
  ConstraintKind,
  Hazard,
  PrecedenceConstraint,
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

/** Fraction of the day's own (hazard-free) optimal time a zone crossing costs. */
const ZONE_PENALTY_FRACTION_MIN = 6;
const ZONE_PENALTY_FRACTION_MAX = 12;

function eligible(tasks: readonly Task[], kind: ConstraintKind): Task[] {
  return tasks.filter((task) => task.tags.includes(kind));
}

function pickTasks(rng: Rng, scenario: Scenario): Task[] {
  const count = randInt(rng, MIN_TASKS, MAX_TASKS);
  // Re-roll until the day has something a hazard can bite on, and a genuine
  // spatial choice to make — tasks on both sides of the map's seam. Both are
  // soft: 12 tries at long enough odds, then whatever the sample landed on.
  for (let attempt = 0; attempt < 12; attempt++) {
    const tasks = sample(rng, scenario.tasks, count);
    const kinds = (["queue", "hours"] as const).filter(
      (kind) => eligible(tasks, kind).length >= 2,
    );
    const west = tasks.filter(
      (task) => zoneOf(task.location.x, scenario.zoneSplitX) === "west",
    ).length;
    const east = tasks.length - west;
    if (kinds.length > 0 && west >= 2 && east >= 2) return tasks;
  }
  return sample(rng, scenario.tasks, count);
}

function buildHazard(
  rng: Rng,
  scenario: Scenario,
  kind: ConstraintKind,
  candidates: readonly Task[],
  baseOptimal: number,
  weekend: boolean,
): Hazard {
  // The difficulty lever is how many tasks the hazard touches, not how many
  // kinds exist: one affected task is decorative, three forces trade-offs.
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
 * Nudge a hazard harder (>1) or gentler (<1) without changing its shape. A
 * clearing queue tightens the other way round from a building one: it hurts
 * more when it lingers, so tightening *slows* the clear rather than speeding
 * it up.
 */
function retuneHazard(hazard: Hazard, factor: number): Hazard {
  if (hazard.kind === "hours") {
    return {
      ...hazard,
      closeAt: Math.max(6, Math.round(hazard.closeAt / factor)),
    };
  }
  const clearing = hazard.growthRate < 0;
  return {
    ...hazard,
    startWait: Math.round(hazard.startWait * factor),
    growthRate: clearing ? hazard.growthRate / factor : hazard.growthRate * factor,
    cap: Math.max(2, Math.round(hazard.cap * factor)),
  };
}

/** The designed difficulty lever: pull in one more task the hazard touches. */
function widenHazard(hazard: Hazard, pool: readonly Task[]): Hazard {
  const next = pool.find((task) => !hazard.affectedTaskIds.includes(task.id));
  if (!next) return hazard;
  return {
    ...hazard,
    affectedTaskIds: [...hazard.affectedTaskIds, next.id],
  };
}

/**
 * Prefer a pair that shares a task with a hazard, or spans the zone seam —
 * that overlap is what stops the pressures being solved one at a time. Only
 * ever one active pair, and never one that would leave every task touched.
 */
function buildPrecedence(
  rng: Rng,
  scenario: Scenario,
  tasks: readonly Task[],
  used: ReadonlySet<string>,
  maxTouchable: number,
): PrecedenceConstraint | null {
  const byId = new Map(tasks.map((task) => [task.id, task]));
  const candidates = scenario.precedencePool
    .filter((pair) => byId.has(pair.before) && byId.has(pair.after))
    .map((pair) => {
      const touched = new Set([...used, pair.before, pair.after]);
      const beforeTask = byId.get(pair.before)!;
      const afterTask = byId.get(pair.after)!;
      const spansZones =
        zoneOf(beforeTask.location.x, scenario.zoneSplitX) !==
        zoneOf(afterTask.location.x, scenario.zoneSplitX);
      const overlapsHazard = used.has(pair.before) || used.has(pair.after);
      return { pair, touched, preferred: spansZones || overlapsHazard };
    })
    .filter(({ touched }) => touched.size <= maxTouchable);

  if (candidates.length === 0) return null;
  const preferred = candidates.filter((c) => c.preferred);
  const { pair } = pick(rng, preferred.length > 0 ? preferred : candidates);
  const beforeTask = byId.get(pair.before)!;
  const afterTask = byId.get(pair.after)!;
  return {
    kind: "precedence",
    label: `${beforeTask.label} before ${afterTask.label}`,
    beforeId: pair.before,
    afterId: pair.after,
    blockedLabel: `Not yet — ${beforeTask.label.toLowerCase()} first`,
  };
}

function touchedIds(plan: ShiftPlan): Set<string> {
  const ids = new Set<string>();
  for (const hazard of plan.hazards) {
    for (const id of hazard.affectedTaskIds) ids.add(id);
  }
  if (plan.precedence) {
    ids.add(plan.precedence.beforeId);
    ids.add(plan.precedence.afterId);
  }
  return ids;
}

/**
 * Generation ends with a measured day, not a hoped-for one. Feasibility is a
 * hard gate, checked every pass, before anything else — a shift with no
 * feasible order is a broken puzzle, not merely a hard one. Past that gate,
 * the day is judged against the exact naive strategy a player reaches for
 * first (`naiveOrder`): deadlines ascending, hazards worsening-last, zones
 * clustered, precedence patched up after the fact. Only once that heuristic
 * misses the deadline does the existing loss-rate floor get to weigh in.
 */
function tune(plan: ShiftPlan, hazardPools: readonly (readonly Task[])[]): Shift {
  let current = plan;
  let best: { shift: Shift; naiveMisses: boolean; rate: number } | null = null;

  for (let pass = 0; pass < TUNING_PASSES; pass++) {
    const analysis = analyse(current);
    if (!analysis.best.feasible) {
      current = {
        ...current,
        hazards: current.hazards.map((hazard) => retuneHazard(hazard, 0.8)),
      };
      continue;
    }

    const deadline = Math.ceil(analysis.best.total * DEADLINE_MARGIN);
    const shift: Shift = { ...current, deadline };
    const rate = lossRate(analysis, deadline);
    const naiveTotal = simulateOrder(current, naiveOrder(current)).total;
    const naiveMisses = naiveTotal > deadline;

    if (naiveMisses && rate >= MIN_LOSS_RATE) return shift;

    const better =
      best === null ||
      (naiveMisses && !best.naiveMisses) ||
      (naiveMisses === best.naiveMisses && rate > best.rate);
    if (better) best = { shift, naiveMisses, rate };

    const maxTouchable = current.tasks.length - 1;
    const touched = touchedIds(current);
    const canWiden = touched.size < maxTouchable;
    let widened = false;
    const hazards = current.hazards.map((hazard, index) => {
      const retuned = retuneHazard(hazard, 1.3);
      if (widened || !canWiden) return retuned;
      const otherIds = new Set(
        current.hazards.flatMap((other, j) =>
          j === index ? [] : other.affectedTaskIds,
        ),
      );
      const pool = (hazardPools[index] ?? []).filter(
        (task) => !otherIds.has(task.id) && !touched.has(task.id),
      );
      const next = widenHazard(retuned, pool);
      if (next.affectedTaskIds.length > retuned.affectedTaskIds.length) {
        widened = true;
      }
      return next;
    });
    current = { ...current, hazards };
  }

  if (best) return best.shift;

  // Never ship an infeasible day: strip every pressure down to the bare,
  // always-feasible shift rather than gambling on one more retune.
  const stripped: ShiftPlan = { ...plan, hazards: [], precedence: null };
  return { ...stripped, deadline: computeDeadline(stripped) };
}

function build(seed: number, weekend: boolean, day: string | null): Shift {
  const rng = mulberry32(seed);
  const scenario = pick(rng, scenarioPool(weekend));
  const tasks = pickTasks(rng, scenario);

  const visited = new Set(tasks.map((task) => task.place));
  const bareBase: ShiftPlan = {
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
    floor: scenario.floor,
    tasks,
    hazards: [],
    precedence: null,
    zoneSplitX: scenario.zoneSplitX,
    zonePenaltyMinutes: 0,
  };

  const rawOptimal = optimalTime(bareBase);
  const zoneFraction = randInt(
    rng,
    ZONE_PENALTY_FRACTION_MIN,
    ZONE_PENALTY_FRACTION_MAX,
  );
  const zonePenaltyMinutes = Math.max(
    1,
    Math.round((rawOptimal * zoneFraction) / 100),
  );
  const baseOptimal = optimalTime({ ...bareBase, zonePenaltyMinutes });

  const hazardBudget = tasks.length >= 6 ? randInt(rng, 1, 2) : 1;
  const maxTouchable = tasks.length - 1;
  const hazards: Hazard[] = [];
  const hazardPools: Task[][] = [];
  const used = new Set<string>();

  for (let i = 0; i < hazardBudget; i++) {
    const remaining = tasks.filter((task) => !used.has(task.id));
    const kinds = (["queue", "hours"] as const).filter(
      (kind) => eligible(remaining, kind).length >= 2,
    );
    if (kinds.length === 0) break;
    const kind = pick(rng, kinds);
    const candidates = eligible(remaining, kind);
    const hazard = buildHazard(rng, scenario, kind, candidates, baseOptimal, weekend);
    const touchedAfter = new Set([...used, ...hazard.affectedTaskIds]);
    if (touchedAfter.size > maxTouchable) break;
    hazard.affectedTaskIds.forEach((id) => used.add(id));
    hazards.push(hazard);
    hazardPools.push(candidates);
  }

  const precedence = buildPrecedence(rng, scenario, tasks, used, maxTouchable);

  const plan: ShiftPlan = { ...bareBase, hazards, precedence, zonePenaltyMinutes };
  return tune(plan, hazardPools);
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
