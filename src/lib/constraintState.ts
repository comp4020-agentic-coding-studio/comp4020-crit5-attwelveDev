import type { Constraint } from "./types";

/**
 * Constraint state is a pure function of (constraint, task, simulated minute).
 * Nothing here reads the wall clock, so the deadline solver and the playback
 * renderer are guaranteed to agree — and all of it is testable without a DOM.
 */

/** Minutes lost waiting on arrival, or Infinity if the task is unreachable. */
export function constraintWait(
  constraint: Constraint,
  taskId: string,
  arrival: number,
): number {
  if (!constraint.affectedTaskIds.includes(taskId)) return 0;
  if (constraint.kind === "hours") {
    return arrival >= constraint.closeAt ? Infinity : 0;
  }
  const raw = constraint.startWait + constraint.growthRate * arrival;
  return Math.round(Math.min(Math.max(raw, 0), constraint.cap));
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

export function constraintReading(
  constraint: Constraint,
  taskId: string,
  at: number,
): Reading {
  if (!constraint.affectedTaskIds.includes(taskId)) {
    return { severity: "none", wait: 0, note: "" };
  }

  if (constraint.kind === "hours") {
    const closed = at >= constraint.closeAt;
    return closed
      ? { severity: "closed", wait: Infinity, note: constraint.closedLabel }
      : {
          severity: constraint.closeAt - at <= 15 ? "heavy" : "clear",
          wait: 0,
          note: `${constraint.label} ${constraint.verb}`,
        };
  }

  const wait = constraintWait(constraint, taskId, at);
  const severity: Severity =
    wait <= 1 ? "clear" : wait <= 5 ? "building" : "heavy";
  return { severity, wait, note: `${wait} min wait` };
}

/** Does the wait on this task get worse as the shift runs on? */
export function worsensOverTime(constraint: Constraint): boolean {
  return constraint.kind === "hours" || constraint.growthRate > 0;
}
