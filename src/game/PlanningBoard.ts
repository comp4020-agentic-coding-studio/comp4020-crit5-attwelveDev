import { constraintReading } from "../lib/constraintState";
import type { Place, Point, Shift } from "../lib/types";
import { planSymbol } from "./fixtures";

/**
 * The planning view: a floor plan. Diegetically the map the character would
 * plausibly be holding — a store directory, a gym's induction sheet, the fire
 * plan on the back of an office door — which is why it shows where everything
 * is and what the queues are doing, but never how long the plan you've built
 * will actually take.
 *
 * Rooms are drawn as footprints with architect's symbols in them, so a kitchen
 * reads as a kitchen before you've read a single label.
 */

const PIN_SPREAD = 9.5;

function pinPoints(shift: Shift): Map<string, Point> {
  const pins = new Map<string, Point>();
  for (const place of shift.places) {
    const here = shift.tasks.filter((task) => task.place === place.name);
    here.forEach((task, index) => {
      pins.set(task.id, {
        x: place.at.x + (index - (here.length - 1) / 2) * PIN_SPREAD,
        y: place.at.y + place.h / 2 - 4.2,
      });
    });
  }
  return pins;
}

function escape(text: string): string {
  return text.replace(/[&<>"]/g, (c) =>
    c === "&" ? "&amp;" : c === "<" ? "&lt;" : c === ">" ? "&gt;" : "&quot;",
  );
}

function marker(shape: string, x: number, y: number): string {
  if (shape === "up") return `<polygon points="${x},${y - 3} ${x + 2.8},${y + 2} ${x - 2.8},${y + 2}" />`;
  if (shape === "down") return `<polygon points="${x},${y + 3} ${x - 2.8},${y - 2} ${x + 2.8},${y - 2}" />`;
  return `<polygon points="${x},${y - 3} ${x + 3},${y} ${x},${y + 3} ${x - 3},${y}" />`;
}

function roomMarkup(place: Place, affected: boolean): string {
  const { x, y } = place.at;
  return `<g class="room${affected ? " is-affected" : ""}">
  <rect class="room-floor" x="${(x - place.w / 2).toFixed(2)}" y="${(y - place.h / 2).toFixed(2)}" width="${place.w}" height="${place.h}" rx="1.6" />
  <g class="room-fixture">${planSymbol(place)}</g>
  <text class="place-name" x="${x}" y="${(y - place.h / 2 - 2.1).toFixed(2)}">${escape(place.name)}</text>
</g>`;
}

export type BoardHandle = {
  render(shift: Shift, order: readonly string[]): void;
};

export function createPlanningBoard(svg: SVGSVGElement): BoardHandle {
  let previous: string[] = [];

  return {
    render(shift, order) {
      const pins = pinPoints(shift);
      const shape =
        shift.constraint.kind === "hours"
          ? "cutoff"
          : shift.constraint.growthRate > 0
            ? "up"
            : "down";

      // Several scenarios start somewhere that is also a task's location.
      // Drawing the start marker at the raw point buries it under a pin and
      // prints the name twice, so it steps to the edge of that room instead.
      const shared = shift.places.find(
        (place) =>
          Math.abs(place.at.x - shift.start.x) < place.w / 2 + 3 &&
          Math.abs(place.at.y - shift.start.y) < place.h / 2 + 3,
      );
      const anchor = shared
        ? { x: shared.at.x - shared.w / 2 - 5.5, y: shared.at.y }
        : shift.start;

      const route = [anchor, ...order.map((id) => pins.get(id) ?? anchor)]
        .map((p) => `${p.x.toFixed(2)},${p.y.toFixed(2)}`)
        .join(" ");

      const rooms = shift.places
        .map((place) =>
          roomMarkup(
            place,
            shift.tasks.some(
              (task) =>
                task.place === place.name &&
                shift.constraint.affectedTaskIds.includes(task.id),
            ),
          ),
        )
        .join("");

      const pinMarkup = order
        .map((id, index) => {
          const point = pins.get(id);
          if (!point) return "";
          const reading = constraintReading(shift.constraint, id, 0);
          const changed = previous[index] !== id;
          return `<g class="pin${changed ? " pin-changed" : ""}" data-severity="${reading.severity}">
  <circle class="pin-disc" cx="${point.x.toFixed(2)}" cy="${point.y.toFixed(2)}" r="4" />
  <text class="pin-number" x="${point.x.toFixed(2)}" y="${(point.y + 1.4).toFixed(2)}">${index + 1}</text>
  ${reading.severity === "none" ? "" : `<g class="pin-flag">${marker(shape, point.x + 5, point.y - 4)}</g>`}
</g>`;
        })
        .join("");

      svg.innerHTML = `<g class="board-floor">
  <rect x="-4" y="-6" width="108" height="112" rx="4" />
</g>
<g class="board-rooms">${rooms}</g>
<polyline class="board-route" points="${route}" />
<g class="board-start">
  <polygon points="${anchor.x},${anchor.y - 4.4} ${anchor.x + 4},${anchor.y + 2.6} ${anchor.x - 4},${anchor.y + 2.6}" />
  ${shared ? "" : `<text x="${anchor.x}" y="${anchor.y + 8.4}">${escape(shift.startLabel)}</text>`}
</g>
<g class="board-pins">${pinMarkup}</g>`;

      // Redraw the new route as a stroke that draws itself, so a reorder reads
      // as a change of plan rather than a flicker.
      const line = svg.querySelector<SVGPolylineElement>(".board-route");
      if (line) {
        const length = line.getTotalLength();
        line.style.strokeDasharray = `${length}`;
        line.style.strokeDashoffset = `${length}`;
        line.getBoundingClientRect();
        line.style.transition = "stroke-dashoffset var(--dur-3) var(--ease)";
        line.style.strokeDashoffset = "0";
      }

      previous = [...order];
    },
  };
}
