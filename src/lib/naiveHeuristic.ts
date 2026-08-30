import { precedenceViolated, zoneOf } from "./constraintState";
import { travelTime } from "./route";
import type { Point, ShiftPlan, Task } from "./types";

/** Which hazard kind (if any) touches this task — hazards are disjoint. */
function hazardKind(shift: ShiftPlan, taskId: string): "hours" | "queue" | null {
  for (const hazard of shift.hazards) {
    if (hazard.affectedTaskIds.includes(taskId)) return hazard.kind;
  }
  return null;
}

function closeAtFor(shift: ShiftPlan, taskId: string): number {
  for (const hazard of shift.hazards) {
    if (hazard.kind === "hours" && hazard.affectedTaskIds.includes(taskId)) {
      return hazard.closeAt;
    }
  }
  return Infinity;
}

/** Greedy nearest-neighbour walk starting from `start`. */
function walkNearest(start: Point, tasks: readonly Task[]): Task[] {
  const remaining = [...tasks];
  const ordered: Task[] = [];
  let at = start;
  while (remaining.length > 0) {
    let bestIndex = 0;
    let bestTime = Infinity;
    for (let i = 0; i < remaining.length; i++) {
      const time = travelTime(at, remaining[i]!.location);
      if (time < bestTime) {
        bestTime = time;
        bestIndex = i;
      }
    }
    const [next] = remaining.splice(bestIndex, 1);
    ordered.push(next!);
    at = next!.location;
  }
  return ordered;
}

/**
 * The union of every simple heuristic a reasonable player reaches for first —
 * the exact exploit the constraint system exists to defeat. `tune()` in
 * `generate.ts` optimizes toward *this* missing the deadline; this module's
 * own test only checks it always produces a valid, precedence-satisfying
 * permutation, since "does it miss the deadline" is a generation-time
 * property, not a property of the heuristic itself.
 *
 * 1. Deadline hazards (hours) go first, earliest closeAt first — the "by
 *    XX:XX, so do it first" move.
 * 2. Queue hazards go last — the "better later, so do it last" move, in
 *    either direction (building or clearing).
 * 3. Everything else is clustered by zone (start's own zone first), then
 *    walked nearest-neighbour within each zone — the "cluster by zone, then
 *    done" move.
 * 4. A violated precedence pair gets one deterministic splice, safe only
 *    because a shift carries at most one active pair.
 */
export function naiveOrder(shift: ShiftPlan): string[] {
  const hoursTasks = shift.tasks.filter((t) => hazardKind(shift, t.id) === "hours");
  const queueTasks = shift.tasks.filter((t) => hazardKind(shift, t.id) === "queue");
  const freeTasks = shift.tasks.filter((t) => hazardKind(shift, t.id) === null);

  const sortedHours = [...hoursTasks].sort(
    (a, b) => closeAtFor(shift, a.id) - closeAtFor(shift, b.id),
  );

  const startZone = zoneOf(shift.start.x, shift.zoneSplitX);
  const west = freeTasks.filter((t) => zoneOf(t.location.x, shift.zoneSplitX) === "west");
  const east = freeTasks.filter((t) => zoneOf(t.location.x, shift.zoneSplitX) === "east");
  const [nearZone, farZone] = startZone === "west" ? [west, east] : [east, west];

  const nearWalk = walkNearest(shift.start, nearZone);
  const farStart = nearWalk.length > 0 ? nearWalk[nearWalk.length - 1]!.location : shift.start;
  const farWalk = walkNearest(farStart, farZone);

  const order = [...sortedHours, ...nearWalk, ...farWalk, ...queueTasks].map(
    (t) => t.id,
  );

  const precedence = shift.precedence;
  if (precedence && precedenceViolated(precedence, order)) {
    const afterIndex = order.indexOf(precedence.afterId);
    order.splice(afterIndex, 1);
    const beforeIndex = order.indexOf(precedence.beforeId);
    order.splice(beforeIndex + 1, 0, precedence.afterId);
  }

  return order;
}
