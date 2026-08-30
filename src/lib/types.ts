export type Point = { readonly x: number; readonly y: number };

/**
 * The thing that is physically there. Shared vocabulary across scenarios — a
 * deli counter and a bank counter are the same prop — but chosen per place, so
 * a gym is racks and treadmills and a kitchen is a stove and a sink.
 */
export type Fixture =
  | "counter"
  | "shelving"
  | "fridge"
  | "stove"
  | "oven"
  | "sink"
  | "table"
  | "desk"
  | "bed"
  | "sofa"
  | "shower"
  | "washer"
  | "wardrobe"
  | "printer"
  | "treadmill"
  | "rack"
  | "cables"
  | "mat"
  | "fountain"
  | "sauna"
  | "lockers"
  | "produce"
  | "stall"
  | "storefront"
  | "carwash"
  | "planter";

/** A named area of the map: a footprint, and what's in it. */
export type Place = {
  readonly name: string;
  readonly at: Point;
  /** Footprint in board units (the board is 100 x 100). */
  readonly w: number;
  readonly h: number;
  readonly fixture: Fixture;
};

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
  /** Only the places this shift actually visits. */
  readonly places: readonly Place[];
  readonly constraint: Constraint;
};

export type Shift = ShiftPlan & { readonly deadline: number };
