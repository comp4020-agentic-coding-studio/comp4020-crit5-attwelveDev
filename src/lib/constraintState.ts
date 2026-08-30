import type { Hazard, PrecedenceConstraint } from "./types";

/**
 * Constraint state is a pure function of (hazards, task, simulated minute) —
 * or, for precedence, of (precedence, the committed order). Nothing here
 * reads the wall clock, so the deadline solver and the playback renderer are
 * guaranteed to agree — and all of it is testable without a DOM.
 */

/** The one hazard (if any) that touches this task — hazards are disjoint. */
export function hazardFor(hazards: readonly Hazard[], taskId: string): Hazard | null {
  return hazards.find((h) => h.affectedTaskIds.includes(taskId)) ?? null;
}

/** Minutes lost waiting on arrival, or Infinity if the task is unreachable. */
export function constraintWait(
  hazards: readonly Hazard[],
  taskId: string,
  arrival: number,
): number {
  const hit = hazardFor(hazards, taskId);
  if (!hit) return 0;
  if (hit.kind === "hours") {
    return arrival >= hit.closeAt ? Infinity : 0;
  }
  const raw = hit.startWait + hit.growthRate * arrival;
  return Math.round(Math.min(Math.max(raw, 0), hit.cap));
}

/**
 * True once `afterId` has been committed to a spot earlier than `beforeId` —
 * a property of the whole order, not of either task's arrival time, so it
 * can't be folded into `constraintWait`. Absent tasks (not in this order)
 * never violate it.
 */
export function precedenceViolated(
  precedence: PrecedenceConstraint | null,
  order: readonly string[],
): boolean {
  if (!precedence) return false;
  const beforeIndex = order.indexOf(precedence.beforeId);
  const afterIndex = order.indexOf(precedence.afterId);
  return beforeIndex !== -1 && afterIndex !== -1 && afterIndex < beforeIndex;
}

export type Zone = "west" | "east";

/** Which side of the map's spatial seam an x-coordinate falls on. */
export function zoneOf(x: number, splitX: number): Zone {
  return x < splitX ? "west" : "east";
}

/**
 * Severity bands drive shape *and* colour on the board — never colour alone,
 * so the state stays legible without relying on hue discrimination.
 */
export type Severity = "none" | "clear" | "building" | "heavy" | "closed";

export type Reading = {
  readonly severity: Severity;
  /** Minutes of wait; Infinity when closed. */
  readonly wait: number;
  readonly note: string;
};

/** The reading for whichever hazard (if any) touches this task. */
export function hazardReading(
  hazards: readonly Hazard[],
  taskId: string,
  at: number,
): Reading {
  const hit = hazardFor(hazards, taskId);
  if (!hit) return { severity: "none", wait: 0, note: "" };

  if (hit.kind === "hours") {
    const closed = at >= hit.closeAt;
    return closed
      ? { severity: "closed", wait: Infinity, note: hit.closedLabel }
      : {
          severity: hit.closeAt - at <= 15 ? "heavy" : "clear",
          wait: 0,
          note: `${hit.label} ${hit.verb}`,
        };
  }

  const wait = constraintWait(hazards, taskId, at);
  const severity: Severity =
    wait <= 1 ? "clear" : wait <= 5 ? "building" : "heavy";
  return { severity, wait, note: `${wait} min wait` };
}

/** Does the wait on this task get worse as the shift runs on? */
export function worsensOverTime(hazard: Hazard): boolean {
  return hazard.kind === "hours" || hazard.growthRate > 0;
}
