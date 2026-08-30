export type Point = { readonly x: number; readonly y: number };

/** A constraint kind a task is allowed to interact with. */
export type ConstraintKind = "queue" | "hours";

export type Task = {
  readonly id: string;
  readonly label: string;
  /** Display name of where it happens; several tasks can share one. */
  readonly place: string;
  readonly location: Point;
  /** Minutes spent at the location, before any waiting. */
  readonly baseTime: number;
  readonly tags: readonly ConstraintKind[];
};

/**
 * A wait that grows or clears over the shift. `growthRate` may be negative:
 * a queue that clears rewards doing the task later, which is what stops the
 * puzzle collapsing into "do the constrained things first".
 */
export type QueueConstraint = {
  readonly kind: "queue";
  readonly label: string;
  readonly affectedTaskIds: readonly string[];
  /** Minutes of wait at the start of the shift. */
  readonly startWait: number;
  /** Minutes of wait added per simulated minute. */
  readonly growthRate: number;
  readonly cap: number;
};

/** A hard cutoff: affected tasks become unreachable once the clock passes it. */
export type HoursConstraint = {
  readonly kind: "hours";
  readonly label: string;
  readonly affectedTaskIds: readonly string[];
  readonly verb: string;
  readonly closedLabel: string;
  /** Simulated minutes from the start of the shift. */
  readonly closeAt: number;
};

export type Constraint = QueueConstraint | HoursConstraint;

/** A generated shift, before its deadline has been derived from itself. */
export type ShiftPlan = {
  readonly scenarioId: string;
  readonly title: string;
  readonly place: string;
  readonly seed: number;
  /** `YYYY-MM-DD` for Today's Shift; null for Random Shift. */
  readonly dateKey: string | null;
  readonly start: Point;
  readonly startLabel: string;
  /** Minutes past midnight the shift starts at, for the displayed clock. */
  readonly startClock: number;
  /** Scales travel time, so a flat feels tighter than a town. */
  readonly travelScale: number;
  readonly tasks: readonly Task[];
  readonly constraint: Constraint;
};

export type Shift = ShiftPlan & { readonly deadline: number };
