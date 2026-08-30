import type { Fixture, Place } from "../lib/types";
import { box, disc, edge, slab } from "./iso";

/**
 * Every fixture is drawn twice, and the pair is the whole point of the game's
 * two views:
 *
 * - `plan` is an architect's floor-plan symbol — a stove is a square with four
 *   rings, a bed is a rectangle with a pillow band, treadmills are three
 *   parallel runs. Plan symbols are abstract by tradition, which is exactly
 *   the lo-fi register the rest of the game is in, and they read instantly.
 * - `prop` is the same object in the isometric scene, built only from the
 *   primitives in iso.ts so the light direction and shading never drift.
 *
 * Both are authored vector rather than sprite art, deliberately: the palette
 * is a set of CSS custom properties that swap wholesale between light and dark
 * themes, and baked-in colours can't follow that.
 */

// ── Plan-view helpers (board coordinates, centred on the place) ────────────

function rect(
  x: number,
  y: number,
  w: number,
  h: number,
  cls: string,
  rx = 0.8,
): string {
  return `<rect class="${cls}" x="${(x - w / 2).toFixed(2)}" y="${(y - h / 2).toFixed(2)}" width="${w.toFixed(2)}" height="${h.toFixed(2)}" rx="${rx}" />`;
}

function line(x1: number, y1: number, x2: number, y2: number): string {
  return `<line class="plan-line" x1="${x1.toFixed(2)}" y1="${y1.toFixed(2)}" x2="${x2.toFixed(2)}" y2="${y2.toFixed(2)}" />`;
}

function dot(cx: number, cy: number, r: number, cls = "plan-line"): string {
  return `<circle class="${cls}" cx="${cx.toFixed(2)}" cy="${cy.toFixed(2)}" r="${r.toFixed(2)}" />`;
}

/** `count` evenly spaced offsets across `span`, centred on zero. */
function spread(count: number, span: number): number[] {
  return Array.from(
    { length: count },
    (_, i) => (i - (count - 1) / 2) * (span / Math.max(count, 1)),
  );
}

type PlanFn = (x: number, y: number, w: number, h: number) => string;
type PropFn = (x: number, y: number, w: number, h: number) => string;

// ── Plan symbols ──────────────────────────────────────────────────────────

const PLAN: Record<Fixture, PlanFn> = {
  counter: (x, y, w, h) =>
    rect(x, y, w - 3, h * 0.42, "plan-solid") +
    line(x - (w - 3) / 2, y + h * 0.21 + 1.2, x + (w - 3) / 2, y + h * 0.21 + 1.2),

  shelving: (x, y, w, h) =>
    spread(3, h * 0.72)
      .map((dy) => rect(x, y + dy, w - 4, h * 0.14, "plan-solid", 0.4))
      .join(""),

  fridge: (x, y, w, h) =>
    rect(x, y, w - 4, h - 4, "plan-solid") +
    line(x, y - (h - 4) / 2, x, y + (h - 4) / 2) +
    dot(x - 1.4, y, 0.6) +
    dot(x + 1.4, y, 0.6),

  stove: (x, y, w, h) => {
    const s = Math.min(w, h) - 5;
    return (
      rect(x, y, s, s, "plan-solid") +
      spread(2, s * 0.62)
        .flatMap((dx) => spread(2, s * 0.62).map((dy) => dot(x + dx, y + dy, s * 0.13)))
        .join("")
    );
  },

  oven: (x, y, w, h) =>
    rect(x, y, w - 5, h - 5, "plan-solid") +
    rect(x, y, w - 9, h - 9, "plan-hollow", 0.5) +
    line(x - (w - 9) / 2, y, x + (w - 9) / 2, y),

  sink: (x, y, w, h) =>
    rect(x, y, w - 3, h - 5, "plan-solid") +
    `<ellipse class="plan-hollow" cx="${x}" cy="${y}" rx="${((w - 3) * 0.3).toFixed(2)}" ry="${((h - 5) * 0.3).toFixed(2)}" />` +
    dot(x, y - (h - 5) / 2 + 1.2, 0.7),

  table: (x, y, w, h) =>
    rect(x, y, w - 8, h - 7, "plan-solid", 1.6) +
    spread(3, w - 6)
      .flatMap((dx) => [
        rect(x + dx, y - (h - 7) / 2 - 2, 3, 2.2, "plan-line-fill", 0.5),
        rect(x + dx, y + (h - 7) / 2 + 2, 3, 2.2, "plan-line-fill", 0.5),
      ])
      .join(""),

  desk: (x, y, w, h) =>
    rect(x, y - h * 0.12, w - 6, h * 0.38, "plan-solid") +
    rect(x, y - h * 0.12, w * 0.24, h * 0.14, "plan-hollow", 0.4) +
    dot(x, y + h * 0.22, 2.1, "plan-line-fill"),

  bed: (x, y, w, h) =>
    rect(x, y, w - 8, h - 4, "plan-solid", 1.2) +
    rect(x, y - (h - 4) / 2 + 2.6, w - 10, 3.4, "plan-hollow", 0.8),

  sofa: (x, y, w, h) =>
    rect(x, y, w - 7, h * 0.5, "plan-solid", 1.4) +
    spread(3, w - 11)
      .map((dx) => line(x + dx, y - h * 0.2, x + dx, y + h * 0.2))
      .join(""),

  shower: (x, y, w, h) => {
    const s = Math.min(w, h) - 6;
    return (
      rect(x, y, s, s, "plan-solid", 0.6) +
      `<path class="plan-line" d="M ${(x - s / 2).toFixed(2)} ${(y + s / 2).toFixed(2)} A ${s} ${s} 0 0 0 ${(x + s / 2).toFixed(2)} ${(y - s / 2).toFixed(2)}" />` +
      dot(x, y, 0.9)
    );
  },

  washer: (x, y, w, h) => {
    const s = Math.min(w, h) - 6;
    return rect(x, y, s, s, "plan-solid") + dot(x, y, s * 0.28, "plan-hollow");
  },

  wardrobe: (x, y, w, h) =>
    rect(x, y, w - 5, h * 0.34, "plan-solid") +
    `<path class="plan-line" d="M ${(x - (w - 5) / 2).toFixed(2)} ${(y + h * 0.17).toFixed(2)} A ${(w - 5) / 1.4} ${(w - 5) / 1.4} 0 0 0 ${(x + (w - 5) / 2).toFixed(2)} ${(y + h * 0.17).toFixed(2)}" />`,

  printer: (x, y, w, h) =>
    rect(x, y, w - 4, h - 5, "plan-solid") +
    line(x - (w - 8) / 2, y + 0.8, x + (w - 8) / 2, y + 0.8) +
    line(x - (w - 8) / 2, y - 1.6, x + (w - 8) / 2, y - 1.6),

  treadmill: (x, y, w, h) =>
    spread(3, w - 8)
      .map(
        (dx) =>
          rect(x + dx, y, w * 0.16, h - 6, "plan-solid", 1.4) +
          rect(x + dx, y - (h - 6) / 2 + 1.6, w * 0.16, 1.8, "plan-line-fill", 0.6),
      )
      .join(""),

  rack: (x, y, w, h) =>
    rect(x, y, w - 6, h * 0.2, "plan-solid") +
    spread(2, w - 6).map((dx) => dot(x + dx, y, h * 0.2, "plan-line-fill")).join("") +
    spread(4, w - 12).map((dx) => line(x + dx, y - h * 0.2, x + dx, y + h * 0.2)).join(""),

  cables: (x, y, w, h) =>
    rect(x, y, w - 6, h * 0.22, "plan-solid") +
    spread(2, w - 8)
      .map((dx) => rect(x + dx, y, 2.4, h * 0.5, "plan-line-fill", 0.4))
      .join(""),

  mat: (x, y, w, h) =>
    spread(2, h - 6)
      .map((dy) => rect(x, y + dy, w - 6, h * 0.28, "plan-hollow", 1))
      .join(""),

  fountain: (x, y, w, h) =>
    dot(x, y, Math.min(w, h) * 0.34, "plan-solid") + dot(x, y, Math.min(w, h) * 0.14),

  sauna: (x, y, w, h) =>
    rect(x, y, w - 4, h - 4, "plan-solid") +
    spread(4, h - 8).map((dy) => line(x - (w - 8) / 2, y + dy, x + (w - 8) / 2, y + dy)).join(""),

  lockers: (x, y, w, h) =>
    rect(x, y, w - 4, h * 0.34, "plan-solid") +
    spread(5, w - 6).map((dx) => line(x + dx, y - h * 0.17, x + dx, y + h * 0.17)).join(""),

  produce: (x, y, w, h) =>
    spread(3, h - 6)
      .map((dy) => rect(x, y + dy, w - 6, h * 0.2, "plan-solid", 1.4))
      .join(""),

  stall: (x, y, w, h) =>
    rect(x, y, w - 4, h * 0.46, "plan-solid", 0.6) +
    spread(6, w - 4)
      .map((dx) => dot(x + dx, y + h * 0.3, 1.3, "plan-line-fill"))
      .join(""),

  storefront: (x, y, w, h) =>
    rect(x, y, w - 3, h - 4, "plan-hollow", 0.6) +
    rect(x, y + (h - 4) / 2, w - 3, 2.4, "plan-solid", 0.4) +
    rect(x, y + (h - 4) / 2, w * 0.26, 2.4, "plan-hollow", 0.4),

  carwash: (x, y, w, h) =>
    rect(x, y, w - 4, h - 6, "plan-hollow", 0.6) +
    spread(2, w - 8).map((dx) => rect(x + dx, y, 2.6, h - 6, "plan-solid", 0.4)).join(""),

  planter: (x, y, w, h) =>
    rect(x, y, w - 4, h * 0.4, "plan-solid", 0.6) +
    spread(3, w - 8).map((dx) => dot(x + dx, y, 1.6, "plan-line-fill")).join(""),
};

// ── Isometric props ───────────────────────────────────────────────────────

const PROP: Record<Fixture, PropFn> = {
  counter: (x, y, w, h) =>
    box(x, y, w - 4, h * 0.44, 4.5, "solid") +
    slab(x, y, w - 3, h * 0.5, "face-top top-light", 4.5),

  shelving: (x, y, w, h) =>
    spread(2, h - 6)
      .map(
        (dy) =>
          box(x, y + dy, w - 5, h * 0.16, 9, "solid") +
          edge(
            { x: x - (w - 5) / 2, y: y + dy + h * 0.08 },
            { x: x + (w - 5) / 2, y: y + dy + h * 0.08 },
            "seam",
            3.2,
          ) +
          edge(
            { x: x - (w - 5) / 2, y: y + dy + h * 0.08 },
            { x: x + (w - 5) / 2, y: y + dy + h * 0.08 },
            "seam",
            6.2,
          ),
      )
      .join(""),

  fridge: (x, y, w, h) =>
    box(x, y, w - 5, h - 6, 11, "solid") +
    edge({ x: x + (w - 5) / 2, y: y - (h - 6) / 2 }, { x: x + (w - 5) / 2, y: y + (h - 6) / 2 }, "seam", 4.5, 4.5) +
    edge({ x: x + (w - 5) / 2, y: y + 1.5 }, { x: x + (w - 5) / 2, y: y + 4 }, "handle", 6.5, 6.5),

  stove: (x, y, w, h) => {
    const s = Math.min(w - 5, h - 5);
    return (
      box(x, y, s, s * 0.8, 5, "solid") +
      box(x, y - s * 0.5, s, 1.6, 8, "solid") +
      spread(2, s * 0.5)
        .flatMap((dx) => spread(2, s * 0.4).map((dy) => disc(x + dx, y + dy, s * 0.11, "hob", 5)))
        .join("")
    );
  },

  oven: (x, y, w, h) =>
    box(x, y, w - 5, h - 5, 6.5, "solid") +
    edge({ x: x + (w - 5) / 2, y: y - (h - 5) / 3 }, { x: x + (w - 5) / 2, y: y + (h - 5) / 3 }, "window", 2, 2) +
    edge({ x: x + (w - 5) / 2, y: y - (h - 5) / 3 }, { x: x + (w - 5) / 2, y: y + (h - 5) / 3 }, "handle", 4.8, 4.8),

  sink: (x, y, w, h) =>
    box(x, y, w - 3, h - 6, 4.5, "solid") +
    slab(x, y, (w - 3) * 0.6, (h - 6) * 0.6, "basin", 4.6) +
    box(x, y - (h - 6) * 0.32, 0.9, 0.9, 3.6, "tap", 4.5),

  table: (x, y, w, h) =>
    spread(2, w - 9)
      .flatMap((dx) => spread(2, h - 9).map((dy) => box(x + dx, y + dy, 1, 1, 4, "leg")))
      .join("") +
    box(x, y, w - 7, h - 7, 0.9, "solid", 4),

  desk: (x, y, w, h) =>
    box(x, y - h * 0.1, w - 7, h * 0.36, 0.9, "solid", 4) +
    spread(2, w - 9)
      .map((dx) => box(x + dx, y - h * 0.1, 0.9, h * 0.3, 4, "leg"))
      .join("") +
    box(x, y - h * 0.2, w * 0.3, 0.8, 4, "screen", 4.9) +
    box(x, y + h * 0.2, 4, 4, 3.4, "leg"),

  bed: (x, y, w, h) =>
    box(x, y, w - 8, h - 5, 3.4, "solid") +
    slab(x, y + 1.4, w - 9, h - 8, "face-top top-light", 3.5) +
    box(x, y - (h - 5) / 2 + 2.4, w - 11, 2.6, 1.6, "pillow", 3.4),

  sofa: (x, y, w, h) =>
    box(x, y, w - 7, h * 0.44, 2.6, "solid") +
    box(x, y - h * 0.2, w - 7, 1.8, 5.5, "solid") +
    spread(2, w - 7).map((dx) => box(x + dx, y, 1.6, h * 0.44, 4.4, "solid")).join(""),

  shower: (x, y, w, h) => {
    const s = Math.min(w - 6, h - 6);
    return (
      box(x, y, s, s, 1, "tray") +
      box(x - s / 2, y, 0.6, s, 9, "glass", 1) +
      box(x, y - s / 2, s, 0.6, 9, "glass", 1) +
      disc(x - s * 0.2, y - s * 0.2, 1.1, "hob", 9)
    );
  },

  washer: (x, y, w, h) => {
    const s = Math.min(w - 6, h - 6);
    return (
      box(x, y, s, s * 0.8, 7, "solid") +
      disc(x + s / 2, y, s * 0.2, "porthole", 3.6)
    );
  },

  wardrobe: (x, y, w, h) =>
    box(x, y, w - 5, h * 0.34, 12, "solid") +
    edge({ x: x, y: y + h * 0.17 }, { x: x, y: y + h * 0.17 }, "seam", 1.5, 10.5) +
    edge({ x: x - 1.6, y: y + h * 0.17 }, { x: x - 1.6, y: y + h * 0.17 }, "handle", 6, 7.4),

  printer: (x, y, w, h) =>
    box(x, y, w - 5, h - 6, 5.5, "solid") +
    slab(x, y, w - 7, h - 8, "face-top top-light", 5.6) +
    edge({ x: x + (w - 5) / 2, y: y - (h - 6) / 3 }, { x: x + (w - 5) / 2, y: y + (h - 6) / 3 }, "seam", 2.4, 2.4),

  treadmill: (x, y, w, h) =>
    spread(3, w - 8)
      .map(
        (dx) =>
          box(x + dx, y + 1, w * 0.13, h - 8, 1.6, "solid") +
          slab(x + dx, y + 1.6, w * 0.1, h - 11, "belt", 1.7) +
          box(x + dx, y - (h - 8) / 2 + 1, w * 0.13, 0.8, 6, "solid", 1.6),
      )
      .join(""),

  rack: (x, y, w, h) =>
    spread(2, w - 7)
      .map((dx) => box(x + dx, y, 1.6, h * 0.2, 9, "solid"))
      .join("") +
    box(x, y, w - 6, 0.9, 0.9, "bar", 7) +
    spread(2, w - 7)
      .flatMap((dx) => [
        disc(x + dx, y, 2.6, "plate", 7.5),
        box(x + dx, y + h * 0.24, 4, 2.4, 1.6, "solid"),
      ])
      .join(""),

  cables: (x, y, w, h) =>
    spread(2, w - 8)
      .map((dx) => box(x + dx, y - h * 0.1, 1.5, 1.5, 12, "solid"))
      .join("") +
    box(x, y - h * 0.1, w - 7, 1.2, 1.1, "bar", 11.5) +
    box(x, y - h * 0.1, w * 0.26, 2.6, 6, "stack") +
    box(x, y + h * 0.24, w * 0.34, 3, 2, "solid"),

  mat: (x, y, w, h) =>
    spread(2, h - 7)
      .map((dy) => slab(x, y + dy, w - 7, h * 0.26, "mat-pad", 0.35))
      .join(""),

  fountain: (x, y, w, h) => {
    const s = Math.min(w, h) * 0.5;
    return box(x, y, s, s, 6, "solid") + disc(x, y, s * 0.32, "basin", 6.1);
  },

  sauna: (x, y, w, h) =>
    box(x, y, w - 4, h - 4, 12, "timber") +
    spread(5, w - 6)
      .map((dx) =>
        edge({ x: x + dx, y: y + (h - 4) / 2 }, { x: x + dx, y: y + (h - 4) / 2 }, "seam", 0.5, 11.5),
      )
      .join("") +
    box(x + (w - 4) / 2 - 0.2, y, 0.5, (h - 4) * 0.4, 8, "door"),

  lockers: (x, y, w, h) =>
    box(x, y, w - 4, h * 0.32, 11, "solid") +
    spread(4, w - 6)
      .map((dx) =>
        edge({ x: x + dx, y: y + h * 0.16 }, { x: x + dx, y: y + h * 0.16 }, "seam", 0.5, 10.5),
      )
      .join(""),

  produce: (x, y, w, h) =>
    spread(3, h - 7)
      .map(
        (dy) =>
          box(x, y + dy, w - 6, h * 0.18, 2.6, "crate") +
          slab(x, y + dy, w - 8, h * 0.13, "produce-heap", 2.8),
      )
      .join(""),

  stall: (x, y, w, h) =>
    box(x, y, w - 5, h * 0.4, 3.6, "solid") +
    slab(x, y, w - 5, h * 0.4, "produce-heap", 3.7) +
    spread(2, w - 6).map((dx) => box(x + dx, y, 0.8, 0.8, 9, "leg")).join("") +
    box(x, y - 0.6, w - 4, h * 0.5, 1.1, "awning", 8.5),

  storefront: (x, y, w, h) =>
    box(x, y - h * 0.1, w - 4, h * 0.5, 14, "solid") +
    box(x, y + h * 0.16, w - 5, 1.2, 1.1, "awning", 7.5) +
    edge({ x: x - (w - 4) / 2, y: y + h * 0.14 }, { x: x + (w - 4) / 2, y: y + h * 0.14 }, "sign", 9.4, 9.4) +
    box(x + w * 0.24, y + h * 0.14, w * 0.16, 0.4, 5.5, "door"),

  carwash: (x, y, w, h) =>
    spread(2, w - 7)
      .map((dx) => box(x + dx, y, 2.2, h - 8, 9, "solid"))
      .join("") +
    box(x, y, w - 5, 1.6, 1.6, "bar", 8.5) +
    spread(2, w - 11).map((dx) => box(x + dx, y, 1.4, h - 10, 6, "brush")).join(""),

  planter: (x, y, w, h) =>
    box(x, y, w - 4, h * 0.4, 2.6, "crate") +
    spread(3, w - 7)
      .map((dx) => disc(x + dx, y, 2, "foliage", 3.2))
      .join(""),
};

export function planSymbol(place: Place): string {
  return PLAN[place.fixture](place.at.x, place.at.y, place.w, place.h);
}

export function isoProp(place: Place): string {
  return PROP[place.fixture](place.at.x, place.at.y, place.w, place.h);
}
