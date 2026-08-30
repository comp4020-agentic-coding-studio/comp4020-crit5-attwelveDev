import type { Run, Step } from "../lib/route";
import type { Place, Point, Shift } from "../lib/types";
import { isoProp } from "./fixtures";
import { depth, iso, slab } from "./iso";

/**
 * The playback view: a non-interactive isometric replay of the committed
 * order. It is driven by the *simulated* clock, never the wall clock, and it
 * reads constraint state through the same pure functions the deadline was
 * solved with — so what you watch is exactly what was scored.
 */

/** A few seconds whatever the shift's simulated length: snappy, not real-time. */
const MS_PER_SIM_MINUTE = 95;
const MIN_MS = 4200;
const MAX_MS = 8000;

/** How far in front of a fixture the character stands, in world units. */
const STAND_OFF = 5;

/**
 * Frame the camera on the places this shift actually visits. A fixed floor
 * means a five-task kitchen is rendered at the same zoom as a town's worth of
 * errands, and the kitchen ends up a speck in the middle of an empty diamond.
 */
function viewBoxFor(shift: Shift): { box: string; floor: Point[] } {
  const xs: number[] = [shift.start.x];
  const ys: number[] = [shift.start.y];
  for (const spot of shift.places) {
    xs.push(spot.at.x - spot.w / 2, spot.at.x + spot.w / 2);
    ys.push(spot.at.y - spot.h / 2, spot.at.y + spot.h / 2);
  }
  const pad = 7;
  const west = Math.min(...xs) - pad;
  const east = Math.max(...xs) + pad;
  const north = Math.min(...ys) - pad;
  const south = Math.max(...ys) + pad;

  const floor = [
    { x: west, y: north },
    { x: east, y: north },
    { x: east, y: south },
    { x: west, y: south },
  ];
  const projected = floor.map(iso);
  const left = Math.min(...projected.map((p) => p.x));
  const right = Math.max(...projected.map((p) => p.x));
  // Headroom above for prop height and the character; a little below for labels.
  const top = Math.min(...projected.map((p) => p.y)) - 17;
  const bottom = Math.max(...projected.map((p) => p.y)) + 9;

  return {
    box: `${left.toFixed(1)} ${top.toFixed(1)} ${(right - left).toFixed(1)} ${(bottom - top).toFixed(1)}`,
    floor,
  };
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

function escape(text: string): string {
  return text.replace(/[&<>"]/g, (c) =>
    c === "&" ? "&amp;" : c === "<" ? "&lt;" : c === ">" ? "&gt;" : "&quot;",
  );
}

/** Furthest from the camera first, so nearer props overlap correctly. */
function sorted(places: readonly Place[]): Place[] {
  return [...places].sort((a, b) => depth(a.at) - depth(b.at));
}

function labelMarkup(place: Place): string {
  // Sit under the footprint's *nearest corner*, not its front edge — the
  // corner is the lowest point on screen, and anything higher lands on the
  // prop itself.
  const mid = iso({ x: place.at.x, y: place.at.y + place.h / 2 });
  const front = iso({
    x: place.at.x + place.w / 2,
    y: place.at.y + place.h / 2,
  });
  return `<text class="plinth-name" x="${mid.x.toFixed(2)}" y="${(front.y + 5).toFixed(2)}">${escape(place.name)}</text>`;
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
    // Stand in front of the fixture rather than on top of it: a task's point
    // is the middle of its room, which in three dimensions is inside the
    // counter you're meant to be queueing at.
    const p = iso({ x: frame.at.x, y: frame.at.y + STAND_OFF });
    const bob =
      frame.state === "travel" ? Math.sin(frame.at.x * 0.9 + frame.at.y) * 0.6 : 0;
    actor.setAttribute("transform", `translate(${p.x.toFixed(2)} ${(p.y + bob).toFixed(2)})`);
    actor.dataset.state = frame.state;

    const activePlace = frame.step ? placeOf.get(frame.step.task.id) : undefined;
    for (const node of svg.querySelectorAll<SVGGElement>(".room3d")) {
      node.classList.toggle("is-active", node.dataset.place === activePlace);
    }
  }

  return {
    prepare(shift, order) {
      const places = sorted(shift.places);
      placeOf = new Map(shift.tasks.map((task) => [task.id, task.place]));

      const byId = new Map(shift.tasks.map((task) => [task.id, task]));
      const path = [
        shift.start,
        ...order.map((id) => byId.get(id)?.location ?? shift.start),
      ]
        .map(iso)
        .map((p) => `${p.x.toFixed(2)},${p.y.toFixed(2)}`)
        .join(" ");
      const framing = viewBoxFor(shift);
      svg.setAttribute("viewBox", framing.box);
      const floor = framing.floor.map(iso);

      const rooms = places
        .map(
          (spot) =>
            `<g class="room3d" data-place="${escape(spot.name)}">
${slab(spot.at.x, spot.at.y, spot.w, spot.h, "room-pad")}
${isoProp(spot)}
</g>`,
        )
        .join("");

      svg.innerHTML = `<polygon class="stage-floor" points="${floor.map((p) => `${p.x.toFixed(2)},${p.y.toFixed(2)}`).join(" ")}" />
<polyline class="stage-route" points="${path}" />
<g class="stage-places">${rooms}</g>
<g class="stage-labels">${places.map(labelMarkup).join("")}</g>
<g class="actor" data-state="done">
  <ellipse class="actor-shadow" cx="0" cy="0" rx="5" ry="2.5" />
  <polygon class="actor-body" points="-3.6,-1.4 3.6,-1.4 2.5,-10.5 -2.5,-10.5" />
  <circle class="actor-head" cx="0" cy="-13.6" r="3.4" />
  <circle class="actor-ring" cx="0" cy="-7" r="10.5" />
</g>`;
      actor = svg.querySelector<SVGGElement>(".actor");
      place({ at: shift.start, state: "done", step: null, completed: 0 });
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
