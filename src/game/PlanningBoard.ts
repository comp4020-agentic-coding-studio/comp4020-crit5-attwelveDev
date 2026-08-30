import { constraintReading } from "../lib/constraintState";
import type { Point, Shift, Task } from "../lib/types";

/**
 * The planning view: a top-down directory board. Diegetically the map the
 * character would plausibly be holding, not omniscience — which is why it
 * shows where things are and what the queues are doing, but never how long
 * the plan you've built will actually take.
 */

const PLACE_HEIGHT = 14;
const PIN_SPREAD = 11;

type Layout = {
  readonly places: readonly {
    name: string;
    centre: Point;
    width: number;
    affected: boolean;
  }[];
  readonly pins: ReadonlyMap<string, Point>;
};

function layout(shift: Shift): Layout {
  const groups = new Map<string, Task[]>();
  for (const task of shift.tasks) {
    const group = groups.get(task.place) ?? [];
    group.push(task);
    groups.set(task.place, group);
  }

  const pins = new Map<string, Point>();
  const places = [...groups].map(([name, tasks]) => {
    const first = tasks[0] as Task;
    tasks.forEach((task, index) => {
      pins.set(task.id, {
        x: first.location.x + (index - (tasks.length - 1) / 2) * PIN_SPREAD,
        y: first.location.y,
      });
    });
    return {
      name,
      centre: first.location,
      width: Math.max(24, tasks.length * PIN_SPREAD + 8),
      affected: tasks.some((task) =>
        shift.constraint.affectedTaskIds.includes(task.id),
      ),
    };
  });

  return { places, pins };
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

export type BoardHandle = {
  render(shift: Shift, order: readonly string[]): void;
};

export function createPlanningBoard(svg: SVGSVGElement): BoardHandle {
  let previous: string[] = [];

  return {
    render(shift, order) {
      const { places, pins } = layout(shift);
      const shape =
        shift.constraint.kind === "hours"
          ? "cutoff"
          : shift.constraint.growthRate > 0
            ? "up"
            : "down";

      const route = [
        shift.start,
        ...order.map((id) => pins.get(id) ?? shift.start),
      ]
        .map((p) => `${p.x},${p.y}`)
        .join(" ");

      const placeMarkup = places
        .map((place) => {
          const x = place.centre.x - place.width / 2;
          const y = place.centre.y - PLACE_HEIGHT / 2;
          return `<g class="place${place.affected ? " is-affected" : ""}">
  <rect class="place-shadow" x="${x + 1.4}" y="${y + 1.4}" width="${place.width}" height="${PLACE_HEIGHT}" rx="2.5" />
  <rect class="place-face" x="${x}" y="${y}" width="${place.width}" height="${PLACE_HEIGHT}" rx="2.5" />
  <text class="place-name" x="${place.centre.x}" y="${y + PLACE_HEIGHT + 5.2}">${escape(place.name)}</text>
</g>`;
        })
        .join("");

      const pinMarkup = order
        .map((id, index) => {
          const point = pins.get(id);
          if (!point) return "";
          const reading = constraintReading(shift.constraint, id, 0);
          const changed = previous[index] !== id;
          return `<g class="pin${changed ? " pin-changed" : ""}" data-severity="${reading.severity}">
  <circle class="pin-disc" cx="${point.x}" cy="${point.y}" r="4" />
  <text class="pin-number" x="${point.x}" y="${point.y + 1.4}">${index + 1}</text>
  ${reading.severity === "none" ? "" : `<g class="pin-flag">${marker(shape, point.x + 5, point.y - 4)}</g>`}
</g>`;
        })
        .join("");

      svg.innerHTML = `<g class="board-floor">
  <rect x="-4" y="-6" width="108" height="112" rx="6" />
</g>
<g class="board-places">${placeMarkup}</g>
<polyline class="board-route" points="${route}" />
<g class="board-start">
  <polygon points="${shift.start.x},${shift.start.y - 4.4} ${shift.start.x + 4},${shift.start.y + 2.6} ${shift.start.x - 4},${shift.start.y + 2.6}" />
  <text x="${shift.start.x}" y="${shift.start.y + 8.4}">${escape(shift.startLabel)}</text>
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
