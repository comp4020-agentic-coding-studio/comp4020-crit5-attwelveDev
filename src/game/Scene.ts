import { hazardFor, hazardReading } from "../lib/constraintState";
import type { Run, Step } from "../lib/route";
import type { FloorKind, Place, Point, Shift } from "../lib/types";
import { isoProp } from "./fixtures";
import { depth, iso } from "./iso";

/**
 * One camera for the whole game. Planning and playback are the same isometric
 * room: planning adds numbered markers and a dashed route, playback swaps them
 * for the character walking it. A second, top-down rendering of the same world
 * asked the player to learn two languages for one place, and taught them
 * nothing the markers don't.
 *
 * The scene is built as a diorama, not a floating cluster of furniture: a
 * floor with a real material, two back walls, and a skirting where they meet.
 * That shell is most of what makes an isometric room read as a room.
 *
 * Each place carries a small name tag, tucked against its back-left corner
 * rather than at its front edge — that's clear of both the prop itself and
 * the numbered marker standing in front of it, which is why an earlier
 * version of this label (anchored at the front edge, full size) had to be
 * removed rather than tuned. Subtle on purpose: muted, small, a thin halo in
 * the floor colour for legibility — a label, not a heading.
 */

/** A few seconds whatever the shift's simulated length: snappy, not real-time. */
const MS_PER_SIM_MINUTE = 95;
const MIN_MS = 4200;
const MAX_MS = 8000;

/** How far in front of a fixture the character stands, in world units. */
const STAND_OFF = 5;
/** Wall height, in world units. */
const WALL = 24;
/** How high a task marker floats above its spot. */
const MARKER_LIFT = 15;

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
  // Precedence fails outright, before any travel — no step ever ran, so the
  // character never leaves the start, stuck there the same way they'd be
  // stuck outside a shop that's already shut.
  if (!run.feasible && run.steps.length === 0) {
    return { at: shift.start, state: "blocked", step: null, completed: 0 };
  }

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

const at = (p: Point): string => {
  const s = iso(p);
  return `${s.x.toFixed(2)},${s.y.toFixed(2)}`;
};

const up = (p: Point, by: number): string => {
  const s = iso(p);
  return `${s.x.toFixed(2)},${(s.y - by).toFixed(2)}`;
};

type Bounds = { west: number; east: number; north: number; south: number };

function boundsOf(shift: Shift): Bounds {
  const xs = [shift.start.x];
  const ys = [shift.start.y];
  for (const spot of shift.places) {
    xs.push(spot.at.x - spot.w / 2, spot.at.x + spot.w / 2);
    ys.push(spot.at.y - spot.h / 2, spot.at.y + spot.h / 2);
  }
  const pad = 8;
  return {
    west: Math.min(...xs) - pad,
    east: Math.max(...xs) + pad,
    north: Math.min(...ys) - pad,
    south: Math.max(...ys) + pad,
  };
}

function viewBoxFor(b: Bounds): string {
  const corners = [
    { x: b.west, y: b.north },
    { x: b.east, y: b.north },
    { x: b.east, y: b.south },
    { x: b.west, y: b.south },
  ].map(iso);
  const left = Math.min(...corners.map((p) => p.x)) - 3;
  const right = Math.max(...corners.map((p) => p.x)) + 3;
  const top = Math.min(...corners.map((p) => p.y)) - WALL - 6;
  const bottom = Math.max(...corners.map((p) => p.y)) + 10;
  return `${left.toFixed(1)} ${top.toFixed(1)} ${(right - left).toFixed(1)} ${(bottom - top).toFixed(1)}`;
}

/**
 * Floorboards, tiles or paving, drawn as real lines rather than a pattern:
 * a screen-space pattern would not line up with the isometric grid, and a
 * floor that disagrees with the geometry standing on it reads as a bug.
 */
function floorTexture(b: Bounds, kind: FloorKind): string {
  const lines: string[] = [];
  const alongX = (step: number, cls: string): void => {
    for (let y = b.north + step; y < b.south; y += step) {
      lines.push(
        `<line class="${cls}" x1="${iso({ x: b.west, y }).x.toFixed(2)}" y1="${iso({ x: b.west, y }).y.toFixed(2)}" x2="${iso({ x: b.east, y }).x.toFixed(2)}" y2="${iso({ x: b.east, y }).y.toFixed(2)}" />`,
      );
    }
  };
  const alongY = (step: number, cls: string): void => {
    for (let x = b.west + step; x < b.east; x += step) {
      lines.push(
        `<line class="${cls}" x1="${iso({ x, y: b.north }).x.toFixed(2)}" y1="${iso({ x, y: b.north }).y.toFixed(2)}" x2="${iso({ x, y: b.south }).x.toFixed(2)}" y2="${iso({ x, y: b.south }).y.toFixed(2)}" />`,
      );
    }
  };

  if (kind === "wood") {
    alongX(5, "board");
    // Staggered end joints, so the boards read as planks and not as stripes.
    for (let y = b.north + 5, row = 0; y < b.south; y += 5, row++) {
      for (let x = b.west + (row % 2 ? 14 : 26); x < b.east; x += 28) {
        lines.push(
          `<line class="joint" x1="${iso({ x, y: y - 5 }).x.toFixed(2)}" y1="${iso({ x, y: y - 5 }).y.toFixed(2)}" x2="${iso({ x, y }).x.toFixed(2)}" y2="${iso({ x, y }).y.toFixed(2)}" />`,
        );
      }
    }
  } else if (kind === "tile") {
    alongX(9, "grid");
    alongY(9, "grid");
  } else if (kind === "paving") {
    alongX(13, "grid");
    alongY(13, "grid");
  } else {
    alongX(7, "nap");
  }
  return lines.join("");
}

/**
 * A subtle tonal overlay on the far side of the map's spatial seam — shown,
 * not hidden, so crossing it reads as a real cost the player can see coming
 * rather than an invisible tax. Skipped if the seam falls outside this
 * shift's own bounds (nothing to tint).
 */
function zoneOverlay(b: Bounds, splitX: number): string {
  if (splitX <= b.west || splitX >= b.east) return "";
  const quad = [
    { x: splitX, y: b.north },
    { x: b.east, y: b.north },
    { x: b.east, y: b.south },
    { x: splitX, y: b.south },
  ];
  return `<polygon class="zone-tint" points="${quad.map(at).join(" ")}" />`;
}

function shell(b: Bounds, kind: FloorKind, zoneSplitX: number): string {
  const floor = [
    { x: b.west, y: b.north },
    { x: b.east, y: b.north },
    { x: b.east, y: b.south },
    { x: b.west, y: b.south },
  ];
  const nw = { x: b.west, y: b.north };
  const ne = { x: b.east, y: b.north };
  const sw = { x: b.west, y: b.south };

  return `<polygon class="wall-back" points="${up(nw, WALL)} ${up(ne, WALL)} ${at(ne)} ${at(nw)}" />
<polygon class="wall-side" points="${up(nw, WALL)} ${up(sw, WALL)} ${at(sw)} ${at(nw)}" />
<polygon class="skirting-back" points="${up(nw, 2.4)} ${up(ne, 2.4)} ${at(ne)} ${at(nw)}" />
<polygon class="skirting-side" points="${up(nw, 2.4)} ${up(sw, 2.4)} ${at(sw)} ${at(nw)}" />
<polygon class="stage-floor" data-floor="${kind}" points="${floor.map(at).join(" ")}" />
${zoneOverlay(b, zoneSplitX)}
<g class="floor-texture" data-floor="${kind}">${floorTexture(b, kind)}</g>`;
}

/** Furthest from the camera first, so nearer props overlap correctly. */
function sorted(places: readonly Place[]): Place[] {
  return [...places].sort((a, b) => depth(a.at) - depth(b.at));
}

/** Base height a place's name tag floats above its prop, like a small sign. */
const LABEL_BASE_LIFT = 13;
/** Roughly how wide one character of the tag renders, in board units. */
const LABEL_CHAR_WIDTH = 1.55;

/** The screen-space rectangle a marker's stem, disc and flag occupy. */
type Zone = { readonly x: number; readonly top: number; readonly bottom: number };

/**
 * A name tag centred directly over the prop, lifted like a small sign rather
 * than sitting on the floor. It anchors on `place.at` — where every fixture in
 * `fixtures.ts` actually centres its own drawing — deliberately not on the
 * place's declared `w`/`h` footprint. That footprint exists for scenario
 * *layout*: keeping neighbouring rooms from overlapping. It has no relation
 * to how big the prop drawn inside it actually is (a shelving unit is only
 * ~4 units deep no matter how wide its room footprint is declared), so a
 * label anchored at a footprint corner routinely landed nowhere near its own
 * object — sometimes closer to a neighbouring room's prop instead. Anchoring
 * on the prop's own centre point fixes that regardless of footprint size.
 *
 * A fixed lift still isn't quite enough on its own: a severity flag floats
 * above and beside a marker's disc, so the tag is pushed further up whenever
 * it would land in a marker's zone — mirroring how markers already push each
 * other apart when they'd overlap. That pushing has a limit: three tasks
 * sharing one place stack their markers tall enough to reach a neighbouring
 * room, and chasing every such stack with an ever-taller label would
 * eventually float it above the walls. Past a modest number of tries, this
 * omits the tag rather than drawing it overlapped or absurdly high — a
 * missing label in a crowded room is a smaller loss than a broken-looking one.
 */
function labelFor(place: Place, zones: readonly Zone[]): string | null {
  const anchor = iso(place.at);
  const halfWidth = (place.name.length * LABEL_CHAR_WIDTH) / 2;
  let lift = LABEL_BASE_LIFT;
  let clash = true;

  for (let guard = 0; guard < 5 && clash; guard++) {
    const y = anchor.y - lift;
    clash = zones.some(
      (zone) =>
        anchor.x - halfWidth - 8 < zone.x &&
        zone.x < anchor.x + halfWidth + 8 &&
        y - 2 < zone.bottom &&
        y + 1.5 > zone.top,
    );
    if (clash) lift += 6;
  }
  if (clash) return null;
  return `<text class="place-label" x="${anchor.x.toFixed(2)}" y="${(anchor.y - lift).toFixed(2)}">${escape(place.name)}</text>`;
}

/** Where a task's marker stands: in front of its place, spread if it shares one. */
function markerSpot(shift: Shift, taskId: string): Point {
  const task = shift.tasks.find((candidate) => candidate.id === taskId);
  const place = shift.places.find((candidate) => candidate.name === task?.place);
  if (!task || !place) return shift.start;
  const here = shift.tasks.filter((candidate) => candidate.place === place.name);
  const index = here.findIndex((candidate) => candidate.id === taskId);
  return {
    x: place.at.x + (index - (here.length - 1) / 2) * 9,
    y: place.at.y + place.h / 2 + 3,
  };
}

type FlagShape = "up" | "down" | "cutoff" | "link";

/**
 * Which flag (if any) a task's marker shows. A hazard, when this task has
 * one, always wins the slot — it's the more urgent fact. A task with no
 * hazard but a role in the active precedence pair gets the fourth shape
 * instead, so "must happen in order" is visible on the board too, not only
 * in the task list.
 */
function flagShapeFor(shift: Shift, taskId: string): FlagShape | null {
  const hazard = hazardFor(shift.hazards, taskId);
  if (hazard) return hazard.kind === "hours" ? "cutoff" : hazard.growthRate > 0 ? "up" : "down";
  const precedence = shift.precedence;
  if (precedence && (precedence.beforeId === taskId || precedence.afterId === taskId)) {
    return "link";
  }
  return null;
}

function flag(shape: FlagShape, x: number, y: number): string {
  if (shape === "up") return `<polygon points="${x},${y - 3} ${x + 2.8},${y + 2} ${x - 2.8},${y + 2}" />`;
  if (shape === "down") return `<polygon points="${x},${y + 3} ${x - 2.8},${y - 2} ${x + 2.8},${y - 2}" />`;
  if (shape === "cutoff") return `<polygon points="${x},${y - 3} ${x + 3},${y} ${x},${y + 3} ${x - 3},${y}" />`;
  return `<rect x="${(x - 2.6).toFixed(2)}" y="${(y - 2.6).toFixed(2)}" width="5.2" height="5.2" />`;
}

export type PlaybackHooks = {
  onFrame(t: number, frame: Frame): void;
  onEnd(frame: Frame): void;
};

export type SceneHandle = {
  /** Rebuild the room. Call once per shift. */
  build(shift: Shift): void;
  /** Redraw the route and markers for a committed order. Cheap; call on drag. */
  setOrder(shift: Shift, order: readonly string[]): void;
  play(shift: Shift, run: Run, stopAt: number, hooks: PlaybackHooks): void;
  stop(): void;
};

export function createScene(svg: SVGSVGElement): SceneHandle {
  let raf = 0;
  let actor: SVGGElement | null = null;
  let routeLayer: SVGGElement | null = null;
  let markerLayer: SVGGElement | null = null;
  let labelLayer: SVGGElement | null = null;
  let previous: string[] = [];

  function moveActor(frame: Frame): void {
    if (!actor) return;
    const p = iso({ x: frame.at.x, y: frame.at.y + STAND_OFF });
    const bob =
      frame.state === "travel" ? Math.sin(frame.at.x * 0.9 + frame.at.y) * 0.6 : 0;
    actor.setAttribute(
      "transform",
      `translate(${p.x.toFixed(2)} ${(p.y + bob).toFixed(2)})`,
    );
    actor.dataset.state = frame.state;
  }

  function highlight(place: string | undefined): void {
    for (const node of svg.querySelectorAll<SVGGElement>(".room3d")) {
      node.classList.toggle("is-active", node.dataset.place === place);
    }
  }

  return {
    build(shift) {
      const bounds = boundsOf(shift);
      svg.setAttribute("viewBox", viewBoxFor(bounds));
      const places = sorted(shift.places);

      // The route is painted on the floor, so it belongs under the furniture.
      // The markers are UI: they belong above everything, or a shelf hides the
      // number telling you when to visit it.
      svg.innerHTML = `${shell(bounds, shift.floor, shift.zoneSplitX)}
<g class="scene-route-layer"></g>
<g class="scene-places">${places
        .map(
          (spot) =>
            `<g class="room3d" data-place="${escape(spot.name)}">${isoProp(spot)}</g>`,
        )
        .join("")}</g>
<g class="scene-place-labels"></g>
<g class="scene-marker-layer"></g>
<g class="actor" data-state="done">
  <ellipse class="actor-shadow" cx="0" cy="0" rx="5" ry="2.5" />
  <polygon class="actor-body" points="-3.6,-1.4 3.6,-1.4 2.5,-10.5 -2.5,-10.5" />
  <circle class="actor-head" cx="0" cy="-13.6" r="3.4" />
  <circle class="actor-ring" cx="0" cy="-7" r="10.5" />
</g>`;
      actor = svg.querySelector<SVGGElement>(".actor");
      routeLayer = svg.querySelector<SVGGElement>(".scene-route-layer");
      markerLayer = svg.querySelector<SVGGElement>(".scene-marker-layer");
      labelLayer = svg.querySelector<SVGGElement>(".scene-place-labels");
      previous = [];
      moveActor({ at: shift.start, state: "done", step: null, completed: 0 });
    },

    setOrder(shift, order) {
      if (!routeLayer || !markerLayer || !labelLayer) return;
      const spots = order.map((id) => markerSpot(shift, id));
      const route = [shift.start, ...spots].map(at).join(" ");

      // Markers on neighbouring places collide on screen even when their
      // spots are metres apart, so stack them rather than letting them
      // overlap into an unreadable pile.
      const taken: Point[] = [];
      const zones: Zone[] = [];
      const markers = order
        .map((id, index) => {
          const spot = spots[index] as Point;
          const screen = iso(spot);
          const reading = hazardReading(shift.hazards, id, 0);
          const shape = flagShapeFor(shift, id);
          const moved = previous[index] !== id;
          const hasFlag = shape !== null;
          let lift = MARKER_LIFT;
          for (let guard = 0; guard < 8; guard++) {
            const clash = taken.some(
              (p) => Math.abs(p.x - screen.x) < 8.5 && Math.abs(p.y - (screen.y - lift)) < 8.5,
            );
            if (!clash) break;
            lift += 8.5;
          }
          taken.push({ x: screen.x, y: screen.y - lift });
          const top = screen.y - lift;
          // The severity flag floats above and beside the disc, so a label's
          // clearance check needs the flag's reach; otherwise it's the disc's
          // own radius (4.4) that sets how far above `top` the marker reaches.
          zones.push({
            x: screen.x,
            top: hasFlag ? top - 8 : top - 4.6,
            bottom: screen.y + 1,
          });
          return `<g class="marker${moved ? " marker-changed" : ""}" data-severity="${reading.severity}">
  <line class="marker-stem" x1="${screen.x.toFixed(2)}" y1="${screen.y.toFixed(2)}" x2="${screen.x.toFixed(2)}" y2="${(top + 4).toFixed(2)}" />
  <ellipse class="marker-foot" cx="${screen.x.toFixed(2)}" cy="${screen.y.toFixed(2)}" rx="2.2" ry="1.2" />
  <circle class="marker-disc" cx="${screen.x.toFixed(2)}" cy="${top.toFixed(2)}" r="4.4" />
  <text class="marker-number" x="${screen.x.toFixed(2)}" y="${(top + 1.5).toFixed(2)}">${index + 1}</text>
  ${hasFlag ? `<g class="marker-flag">${flag(shape as FlagShape, screen.x + 5.4, top - 4.2)}</g>` : ""}
</g>`;
        })
        .join("");

      labelLayer.innerHTML = shift.places
        .map((place) => labelFor(place, zones))
        .filter((label) => label !== null)
        .join("");

      routeLayer.innerHTML = `<polyline class="scene-route" points="${route}" />
<g class="scene-start">
  <ellipse cx="${iso(shift.start).x.toFixed(2)}" cy="${iso(shift.start).y.toFixed(2)}" rx="3.4" ry="1.9" />
  <text x="${iso(shift.start).x.toFixed(2)}" y="${(iso(shift.start).y + 5.4).toFixed(2)}">${escape(shift.startLabel)}</text>
</g>`;
      markerLayer.innerHTML = markers;

      // Animate only the offset — overwriting `stroke-dasharray` to reveal the
      // line replaced the dash pattern with one long dash and never put it
      // back, so the route came out solid.
      const line = routeLayer.querySelector<SVGPolylineElement>(".scene-route");
      if (line) {
        line.style.strokeDashoffset = `${line.getTotalLength()}`;
        line.getBoundingClientRect();
        line.style.transition = "stroke-dashoffset var(--dur-3) var(--ease)";
        line.style.strokeDashoffset = "0";
      }
      previous = [...order];
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
        moveActor(frame);
        highlight(frame.step?.task.place);
        hooks.onFrame(t, frame);
        if (progress < 1) raf = globalThis.requestAnimationFrame(tick);
        else hooks.onEnd(frame);
      };
      raf = globalThis.requestAnimationFrame(tick);
    },

    stop() {
      globalThis.cancelAnimationFrame(raf);
      highlight(undefined);
    },
  };
}
