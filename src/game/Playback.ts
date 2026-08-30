import type { Run, Step } from "../lib/route";
import type { Point, Shift, Task } from "../lib/types";

/**
 * The playback view: a non-interactive isometric replay of the committed
 * order. It is driven by the *simulated* clock, never the wall clock, and it
 * reads constraint state through the same pure functions the deadline was
 * solved with — so what you watch is exactly what was scored.
 */

const ISO_X = 0.7071;
const ISO_Y = 0.4082;
const PLINTH = 6;
const PLACE_Y = 7;

/** A few seconds whatever the shift's simulated length: snappy, not real-time. */
const MS_PER_SIM_MINUTE = 95;
const MIN_MS = 4200;
const MAX_MS = 8000;

function iso(p: Point): Point {
  return { x: (p.x - p.y) * ISO_X, y: (p.x + p.y) * ISO_Y };
}

function lerp(a: Point, b: Point, u: number): Point {
  return { x: a.x + (b.x - a.x) * u, y: a.y + (b.y - a.y) * u };
}

export type FrameState = "travel" | "wait" | "work" | "blocked" | "done";

export type Frame = {
  readonly at: Point;
  readonly state: FrameState;
  readonly step: Step | null;
  readonly completed: number;
};

/** Where the character is, and what they're doing, at simulated minute `t`. */
export function frameAt(shift: Shift, run: Run, t: number): Frame {
  let from = shift.start;
  for (const [index, step] of run.steps.entries()) {
    if (t < step.arrive) {
      const span = step.arrive - step.leave;
      const u = span > 0 ? (t - step.leave) / span : 1;
      return {
        at: lerp(from, step.task.location, Math.min(Math.max(u, 0), 1)),
        state: "travel",
        step,
        completed: index,
      };
    }
    if (!Number.isFinite(step.wait)) {
      return { at: step.task.location, state: "blocked", step, completed: index };
    }
    if (t < step.arrive + step.wait) {
      return { at: step.task.location, state: "wait", step, completed: index };
    }
    if (t < step.done) {
      return { at: step.task.location, state: "work", step, completed: index };
    }
    from = step.task.location;
  }
  return { at: from, state: "done", step: null, completed: run.steps.length };
}

type Plinth = { name: string; centre: Point; halfWidth: number; taskIds: string[] };

function plinths(shift: Shift): Plinth[] {
  const groups = new Map<string, Task[]>();
  for (const task of shift.tasks) {
    const group = groups.get(task.place) ?? [];
    group.push(task);
    groups.set(task.place, group);
  }
  return [...groups]
    .map(([name, tasks]) => ({
      name,
      centre: (tasks[0] as Task).location,
      halfWidth: Math.max(9, tasks.length * 3.4 + 5),
      taskIds: tasks.map((task) => task.id),
    }))
    .sort((a, b) => a.centre.x + a.centre.y - (b.centre.x + b.centre.y));
}

function escape(text: string): string {
  return text.replace(/[&<>"]/g, (c) =>
    c === "&" ? "&amp;" : c === "<" ? "&lt;" : c === ">" ? "&gt;" : "&quot;",
  );
}

function quad(a: Point, b: Point, c: Point, d: Point): string {
  return `${a.x},${a.y} ${b.x},${b.y} ${c.x},${c.y} ${d.x},${d.y}`;
}

function plinthMarkup(place: Plinth): string {
  const s = place.halfWidth;
  const corners = [
    { x: place.centre.x - s, y: place.centre.y - PLACE_Y },
    { x: place.centre.x + s, y: place.centre.y - PLACE_Y },
    { x: place.centre.x + s, y: place.centre.y + PLACE_Y },
    { x: place.centre.x - s, y: place.centre.y + PLACE_Y },
  ].map(iso);
  const [a, b, c, d] = corners as [Point, Point, Point, Point];
  const up = (p: Point): Point => ({ x: p.x, y: p.y - PLINTH });

  return `<g class="plinth" data-place="${escape(place.name)}">
  <polygon class="face-right" points="${quad(up(b), up(c), c, b)}" />
  <polygon class="face-left" points="${quad(up(c), up(d), d, c)}" />
  <polygon class="face-top" points="${quad(up(a), up(b), up(c), up(d))}" />
</g>`;
}

/** Labels live above every plinth, or the one in front crops the one behind. */
function labelMarkup(place: Plinth): string {
  const at = iso({ x: place.centre.x, y: place.centre.y + PLACE_Y });
  return `<text class="plinth-name" x="${at.x}" y="${at.y + 7}">${escape(place.name)}</text>`;
}

export type PlaybackHooks = {
  onFrame(t: number, frame: Frame): void;
  onEnd(frame: Frame): void;
};

export type PlaybackHandle = {
  prepare(shift: Shift, order: readonly string[]): void;
  play(shift: Shift, run: Run, stopAt: number, hooks: PlaybackHooks): void;
  stop(): void;
};

export function createPlayback(svg: SVGSVGElement): PlaybackHandle {
  let raf = 0;
  let actor: SVGGElement | null = null;
  let placeOf = new Map<string, string>();

  function place(frame: Frame): void {
    if (!actor) return;
    const p = iso(frame.at);
    const bob =
      frame.state === "travel" ? Math.sin(frame.at.x * 0.9 + frame.at.y) * 0.6 : 0;
    actor.setAttribute("transform", `translate(${p.x} ${p.y + bob})`);
    actor.dataset.state = frame.state;

    const activePlace = frame.step ? placeOf.get(frame.step.task.id) : undefined;
    for (const node of svg.querySelectorAll<SVGGElement>(".plinth")) {
      node.classList.toggle("is-active", node.dataset.place === activePlace);
    }
  }

  return {
    prepare(shift, order) {
      const places = plinths(shift);
      placeOf = new Map(
        places.flatMap((p) => p.taskIds.map((id) => [id, p.name] as const)),
      );
      const byId = new Map(shift.tasks.map((task) => [task.id, task]));
      const path = [
        shift.start,
        ...order.map((id) => byId.get(id)?.location ?? shift.start),
      ]
        .map(iso)
        .map((p) => `${p.x},${p.y}`)
        .join(" ");
      const floor = [
        { x: -6, y: -6 },
        { x: 106, y: -6 },
        { x: 106, y: 106 },
        { x: -6, y: 106 },
      ].map(iso);

      svg.innerHTML = `<polygon class="stage-floor" points="${floor.map((p) => `${p.x},${p.y}`).join(" ")}" />
<polyline class="stage-route" points="${path}" />
<g class="stage-places">${places.map(plinthMarkup).join("")}</g>
<g class="stage-labels">${places.map(labelMarkup).join("")}</g>
<g class="actor" data-state="done">
  <ellipse class="actor-shadow" cx="0" cy="0" rx="5" ry="2.5" />
  <polygon class="actor-body" points="-3.6,-1.4 3.6,-1.4 2.5,-10.5 -2.5,-10.5" />
  <circle class="actor-head" cx="0" cy="-13.6" r="3.4" />
  <circle class="actor-ring" cx="0" cy="-7" r="10.5" />
</g>`;
      actor = svg.querySelector<SVGGElement>(".actor");
      place(frameAt(shift, { order, steps: [], total: 0, feasible: true, failedAt: -1 }, 0));
    },

    play(shift, run, stopAt, hooks) {
      globalThis.cancelAnimationFrame(raf);
      const duration = Math.min(
        Math.max(stopAt * MS_PER_SIM_MINUTE, MIN_MS),
        MAX_MS,
      );
      const started = performance.now();

      const tick = (now: number): void => {
        const progress = Math.min((now - started) / duration, 1);
        const t = stopAt * progress;
        const frame = frameAt(shift, run, t);
        place(frame);
        hooks.onFrame(t, frame);
        if (progress < 1) raf = globalThis.requestAnimationFrame(tick);
        else hooks.onEnd(frame);
      };
      raf = globalThis.requestAnimationFrame(tick);
    },

    stop() {
      globalThis.cancelAnimationFrame(raf);
    },
  };
}
