import type { Fixture, Place } from "../lib/types";
import { box, disc, edge, panel, render, slab, type Part } from "./iso";

/**
 * One prop per fixture, and the game has exactly one camera: the isometric
 * scene. There is no separate plan view — a second, abstract rendering of the
 * same places asked the player to learn two languages for one world.
 *
 * Two rules keep props from collapsing back into grey boxes:
 *
 * 1. **Materials, not shapes.** Every part picks a material class — `t-wood`,
 *    `t-steel`, `t-enamel`, `t-glass`, `t-rubber`, `t-fabric` — and materials
 *    carry colour. A fridge is cold white behind glass, a sauna is warm
 *    timber, a rack is steel with red plates. If two fixtures come out the
 *    same colour, one of them has picked the wrong material.
 * 2. **Detail is what reads as real.** Handles, seams, control panels, stock
 *    on the shelves, plates on the bar, produce in the crates. A prop with
 *    four parts looks like a diagram; the same prop with a dozen looks like a
 *    thing. `fixtures.test.ts` holds a floor under this.
 *
 * Anything a prop *contains* has to sit in front of the thing containing it.
 * A solid carcass with its stock modelled inside is stock nobody can see.
 *
 * Parts are returned unordered — `render` sorts them by geometry. Never rely
 * on authoring order: that is exactly how legs end up painted on top of the
 * desk they hold up.
 */

/**
 * `count` offsets centred on zero, with the outermost two exactly `span`
 * apart. Getting this wrong is why table legs used to cluster under the
 * middle of the table instead of standing at its corners.
 */
function spread(count: number, span: number): number[] {
  if (count <= 1) return [0];
  return Array.from(
    { length: count },
    (_, i) => (i - (count - 1) / 2) * (span / (count - 1)),
  );
}

const CROPS = ["t-crop-a", "t-crop-b", "t-crop-c"] as const;
const crop = (i: number): string => CROPS[i % CROPS.length] as string;

type PropFn = (x: number, y: number, w: number, h: number) => Part[];

// ── Isometric prop helpers ────────────────────────────────────────────────

/**
 * A seat and a backrest. `back` says which side the backrest sits on, not
 * which way the sitter looks — inverting that put every chair's back against
 * the table it was pulled up to.
 */
function seat(x: number, y: number, size: number, back: 1 | -1): Part[] {
  return [
    box(x, y, size, size * 0.9, 1.5, "t-steel"),
    box(x, y, size * 0.9, size * 0.8, 0.5, "t-fabric", 1.5),
    panel(x, y + back * size * 0.46, size * 0.9, 2, 3.2, "t-fabric-flat"),
  ];
}

/** A shallow open crate with produce heaped in it. */
function crate(
  x: number,
  y: number,
  w: number,
  d: number,
  seed: number,
  base = 0,
): Part[] {
  return [
    box(x, y, w, d, 2.4, "t-wood", base),
    slab(x, y, w - 1.4, d - 1, "t-soil", base + 2.5),
    ...spread(4, w - 3).map((dx, i) => disc(x + dx, y, 1.5, crop(i + seed), base + 2.9)),
    ...spread(3, w - 4).map((dx, i) =>
      disc(x + dx, y - d * 0.22, 1.2, crop(i + seed + 1), base + 3.2),
    ),
  ];
}

// ── Isometric props ───────────────────────────────────────────────────────

const PROP: Record<Fixture, PropFn> = {
  counter: (x, y, w, h) => {
    const d = h * 0.44;
    return [
      box(x, y, w - 4, d, 4.2, "t-enamel"),
      slab(x, y, w - 3, d + 0.8, "t-worktop", 4.3),
      ...spread(3, w - 6).map((dx) =>
        edge({ x: x + dx, y: y + d / 2 }, { x: x + dx, y: y + d / 2 }, "seam", 0.4, 3.8),
      ),
      ...spread(3, w - 6).map((dx) =>
        edge({ x: x + dx - 1.2, y: y + d / 2 }, { x: x + dx + 1.2, y: y + d / 2 }, "handle", 3.2, 3.2),
      ),
      // A display case, not a blank sheet of glass: a rail along the top and
      // mullions down it are what stop it reading as a floating panel.
      panel(x, y - d / 2, w - 7, 4.4, 2.6, "t-glass-flat"),
      ...spread(3, w - 7).map((dx) =>
        edge({ x: x + dx, y: y - d / 2 }, { x: x + dx, y: y - d / 2 }, "mullion", 4.4, 7),
      ),
      box(x, y - d / 2, w - 7, 0.5, 0.4, "t-steel", 7),
      ...spread(3, w - 12).map((dx, i) => disc(x + dx, y + 0.4, 1.5, crop(i), 4.4)),
      box(x + (w - 4) * 0.32, y + 0.4, 2.6, 2, 1.6, "t-dark", 4.4),
      panel(x + (w - 4) * 0.32, y + 1.4, 2.2, 5.4, 1.4, "t-screen"),
    ];
  },

  // An open gondola: a back panel, end posts and shelves. Modelled as a solid
  // carcass with the stock inside, the goods were sealed in and only surfaced
  // in whichever corner the sort happened to expose.
  shelving: (x, y, w, h) =>
    spread(2, h - 8).flatMap((dy, run) => {
      const uw = w - 5;
      const d = 4.2;
      const cy = y + dy;
      const decks = [0.7, 3.5, 6.3];
      return [
        panel(x, cy - d / 2, uw, 0, 8.8, "t-steel-flat"),
        ...[-1, 1].map((side) => box(x + (side * uw) / 2, cy, 1, d, 8.8, "t-steel")),
        ...decks.map((deck) => slab(x, cy, uw - 1, d, "t-steel-top", deck)),
        ...decks.slice(0, 2).flatMap((deck, row) =>
          spread(4, uw - 6).map((dx, i) =>
            box(x + dx, cy + 0.5, 2.4, 1.9, 2.2, crop(i + row + run), deck + 0.05),
          ),
        ),
        ...decks.map((deck) =>
          edge({ x: x - uw / 2, y: cy + d / 2 }, { x: x + uw / 2, y: cy + d / 2 }, "shelf", deck, deck),
        ),
      ];
    }),

  // Same fix: an open-fronted cabinet with a glass door, so the stock reads
  // through the glass instead of being sealed inside a solid block.
  fridge: (x, y, w, h) => {
    const d = h - 8;
    const cw = w - 6;
    const decks = [2.4, 5.2, 8];
    return [
      panel(x, y - d / 2, cw, 0, 11, "t-steel-flat"),
      ...[-1, 1].map((side) => box(x + (side * cw) / 2, y, 1, d, 11, "t-enamel")),
      box(x, y, cw, d, 0.9, "t-enamel"),
      box(x, y, cw, d, 1, "t-enamel", 10),
      ...decks.map((deck) => slab(x, y, cw - 2, d - 0.6, "t-cold-top", deck)),
      ...decks.slice(0, 2).flatMap((deck, row) =>
        spread(3, cw - 7).map((dx, i) =>
          box(x + dx, y + 0.4, 2.2, 1.8, 2.2, crop(i + row), deck + 0.05),
        ),
      ),
      panel(x, y + d / 2, cw - 1.4, 1, 9, "t-glass-flat"),
      edge({ x: x + cw * 0.3, y: y + d / 2 + 0.25 }, { x: x + cw * 0.3, y: y + d / 2 + 0.25 }, "handle", 3.5, 8),
      slab(x, y, cw, d, "t-cold-top", 11.1),
    ];
  },

  stove: (x, y, w, h) => {
    const s = Math.min(w - 5, h - 5);
    const d = s * 0.8;
    return [
      box(x, y, s, d, 4.6, "t-enamel"),
      slab(x, y, s - 0.6, d - 0.6, "t-hobtop", 4.7),
      ...spread(2, s * 0.5).flatMap((dx) =>
        spread(2, d * 0.5).flatMap((dy) => [
          disc(x + dx, y + dy, s * 0.12, "t-hob", 4.8),
          disc(x + dx, y + dy, s * 0.06, "t-hob-inner", 4.85),
        ]),
      ),
      box(x, y - d / 2 - 0.6, s, 1.4, 3.6, "t-steel", 4.6),
      ...spread(3, s * 0.55).map((dx) => disc(x + dx, y - d / 2 - 0.6, 0.55, "t-knob", 8.2)),
      panel(x, y + d / 2, s - 2, 0.6, 3, "t-glass-flat"),
      edge({ x: x - s / 2 + 1, y: y + d / 2 }, { x: x + s / 2 - 1, y: y + d / 2 }, "handle", 3.6, 3.6),
      box(x - s * 0.22, y + d * 0.12, 2.6, 2.6, 2.2, "t-steel", 4.9),
    ];
  },

  oven: (x, y, w, h) => {
    const d = h - 5;
    return [
      box(x, y, w - 5, d, 6.5, "t-dark"),
      panel(x, y + d / 2, w - 9, 1.4, 3.4, "t-glass-flat"),
      edge({ x: x - (w - 8) / 2, y: y + d / 2 }, { x: x + (w - 8) / 2, y: y + d / 2 }, "handle", 5.4, 5.4),
      ...spread(2, w - 12).map((dx) => disc(x + dx, y - d / 2 + 0.4, 0.5, "t-knob", 6.6)),
      slab(x, y, w - 6, d - 1, "t-steel-top", 6.6),
      disc(x + (w - 9) * 0.3, y + d / 2 - 0.2, 0.5, "t-lamp", 3),
      box(x, y - d / 2 + 0.5, w - 6, 0.8, 1.2, "t-steel", 6.6),
      panel(x, y + d / 2, w - 9, 5.2, 0.9, "t-screen-pad"),
      edge({ x: x - (w - 9) / 2, y: y + d / 2 }, { x: x + (w - 9) / 2, y: y + d / 2 }, "seam", 1.9, 1.9),
      edge({ x: x - (w - 5) / 2, y: y + d / 2 }, { x: x - (w - 5) / 2, y: y + d / 2 }, "seam", 1.4, 5.6),
    ];
  },

  sink: (x, y, w, h) => {
    const d = h - 6;
    return [
      box(x, y, w - 3, d, 4.4, "t-wood"),
      slab(x, y, w - 2.6, d + 0.4, "t-steel-top", 4.5),
      slab(x, y + 0.6, (w - 3) * 0.56, d * 0.5, "t-basin", 4.56),
      disc(x, y + 0.6, 0.55, "t-drain", 4.6),
      box(x, y - d * 0.34, 0.8, 0.8, 3.2, "t-steel", 4.5),
      edge({ x: x, y: y - d * 0.34 }, { x: x, y: y + d * 0.05 }, "spout", 7.7, 7.4),
      ...spread(3, d * 0.5).map((dy) =>
        edge({ x: x + (w - 3) * 0.3, y: y + dy }, { x: x + (w - 3) * 0.44, y: y + dy }, "seam", 4.5, 4.5),
      ),
      ...spread(2, w - 8).map((dx) =>
        edge({ x: x + dx, y: y + d / 2 }, { x: x + dx, y: y + d / 2 }, "seam", 0.4, 4),
      ),
    ];
  },

  table: (x, y, w, h) => {
    const tw = w - 7;
    const td = h - 7;
    return [
      ...spread(2, tw - 2).flatMap((dx) =>
        spread(2, td - 2).map((dy) => box(x + dx, y + dy, 1, 1, 4, "t-wood-dark")),
      ),
      box(x, y, tw, td, 0.9, "t-wood", 4),
      ...spread(2, tw - 3).flatMap((dx, i) => [
        ...seat(x + dx, y - td / 2 - 2.6, 3.6, -1),
        ...seat(x + dx, y + td / 2 + 2.6, 3.6, 1),
        disc(x + dx, y + (i === 0 ? -1.4 : 1.4), 1.4, "t-plate", 4.95),
      ]),
    ];
  },

  desk: (x, y, w, h) => {
    const dw = w - 7;
    const dd = h * 0.36;
    const dy0 = y - h * 0.1;
    return [
      ...spread(2, dw - 2).map((dx) => box(x + dx, dy0, 1.1, dd - 1, 4, "t-steel")),
      box(x, dy0, dw, dd, 0.9, "t-wood", 4),
      box(x - dw * 0.2, dy0 - dd * 0.2, 1.6, 1.6, 1.6, "t-dark", 4.9),
      panel(x - dw * 0.2, dy0 - dd * 0.2, dw * 0.34, 6.5, 4, "t-screen"),
      slab(x + dw * 0.05, dy0 + dd * 0.15, dw * 0.3, dd * 0.3, "t-dark-top", 4.95),
      disc(x + dw * 0.3, dy0 + dd * 0.1, 0.9, "t-mug", 4.95),
      ...seat(x, y + h * 0.22, 4.2, 1),
    ];
  },

  bed: (x, y, w, h) => {
    const bw = w - 8;
    const bd = h - 5;
    return [
      box(x, y, bw, bd, 2.6, "t-wood-dark"),
      slab(x, y + 0.8, bw - 1, bd - 1.6, "t-mattress", 2.7),
      box(x, y + bd * 0.14, bw - 1.6, bd * 0.62, 1.1, "t-fabric", 2.7),
      box(x, y - bd / 2 + 2.4, bw - 3, 2.4, 1.2, "t-enamel", 2.7),
      panel(x, y - bd / 2, bw, 2.6, 4.5, "t-wood-flat"),
      ...spread(2, bw - 4).map((dx) =>
        edge({ x: x + dx, y: y + bd / 2 }, { x: x + dx, y: y + bd / 2 }, "seam", 0.4, 2.2),
      ),
      ...spread(2, bw - 2).flatMap((dx) =>
        spread(2, bd - 2).map((dy) => box(x + dx, y + dy, 0.9, 0.9, 1.2, "t-wood-dark")),
      ),
      box(x, y + bd * 0.34, bw - 2.4, bd * 0.2, 0.6, "t-fabric-soft", 3.8),
      disc(x - bw * 0.2, y - bd / 2 + 2.4, 1.4, "t-enamel-top", 3.95),
    ];
  },

  sofa: (x, y, w, h) => {
    const sw = w - 7;
    const sd = h * 0.44;
    return [
      box(x, y, sw, sd, 2.4, "t-fabric"),
      ...spread(3, sw - 4).map((dx) => box(x + dx, y + sd * 0.1, (sw - 5) / 3.2, sd * 0.7, 0.7, "t-fabric-soft", 2.4)),
      box(x, y - sd * 0.34, sw, 1.6, 5.2, "t-fabric"),
      ...spread(2, sw).map((dx) => box(x + dx, y, 1.5, sd, 4.2, "t-fabric-soft")),
      ...spread(2, sw - 8).map((dx, i) => disc(x + dx, y + sd * 0.1, 1.3, crop(i + 1), 3.15)),
    ];
  },

  shower: (x, y, w, h) => {
    const s = Math.min(w - 6, h - 6);
    return [
      box(x, y, s, s, 1, "t-tile"),
      ...spread(3, s * 0.66).flatMap((dx) =>
        spread(3, s * 0.66).map((dy) =>
          edge({ x: x + dx - 1.1, y: y + dy }, { x: x + dx + 1.1, y: y + dy }, "grout", 1.05, 1.05),
        ),
      ),
      disc(x, y, 0.7, "t-drain", 1.06),
      box(x - s / 2, y, 0.5, s, 9, "t-glass", 1),
      box(x, y - s / 2, s, 0.5, 9, "t-glass", 1),
      box(x - s * 0.3, y - s * 0.3, 0.6, 0.6, 1.4, "t-steel", 8.4),
      disc(x - s * 0.3, y - s * 0.22, 1, "t-steel-top", 8.4),
    ];
  },

  washer: (x, y, w, h) => {
    const s = Math.min(w - 6, h - 6);
    const d = s * 0.8;
    return [
      box(x, y, s, d, 7, "t-enamel"),
      panel(x, y + d / 2, s * 0.52, 2, 3.4, "t-glass-flat"),
      panel(x, y + d / 2, s * 0.3, 2.6, 2.2, "t-dark-flat"),
      box(x, y - d * 0.1, s - 1.4, d * 0.7, 0.9, "t-steel", 7),
      ...spread(3, s * 0.5).map((dx) => disc(x + dx, y - d * 0.2, 0.45, "t-knob", 7.95)),
      box(x + s * 0.22, y - d * 0.1, 2, 1.6, 1.6, crop(1), 7.9),
    ];
  },

  wardrobe: (x, y, w, h) => {
    const d = h * 0.34;
    return [
      box(x, y, w - 5, d, 12, "t-wood"),
      edge({ x: x, y: y + d / 2 }, { x: x, y: y + d / 2 }, "seam", 0.6, 11.4),
      ...spread(2, 2.4).map((dx) =>
        edge({ x: x + dx, y: y + d / 2 }, { x: x + dx, y: y + d / 2 }, "handle", 6, 7.6),
      ),
      slab(x, y, w - 5.6, d - 0.6, "t-wood-top", 12.1),
      ...spread(3, w - 9).map((dx) =>
        edge({ x: x + dx, y: y + d / 2 }, { x: x + dx, y: y + d / 2 }, "grain", 1.5, 10.5),
      ),
      box(x, y, w - 4.2, d + 0.5, 0.9, "t-wood-dark"),
      box(x, y, w - 4.4, d + 0.6, 0.7, "t-wood-dark", 11.3),
      panel(x - (w - 5) * 0.24, y + d / 2, (w - 5) * 0.3, 3, 6, "t-glass-flat"),
    ];
  },

  printer: (x, y, w, h) => {
    const d = h - 6;
    return [
      box(x, y, w - 5, d, 5.2, "t-enamel"),
      slab(x, y, w - 7, d - 1.4, "t-dark-top", 5.3),
      slab(x, y + 0.4, w - 10, d - 3, "t-paper", 5.4),
      panel(x, y + d / 2, w - 8, 2.2, 1.4, "t-dark-flat"),
      box(x + (w - 5) * 0.22, y - d * 0.2, 2.6, 1.4, 0.5, "t-screen-pad", 5.3),
      ...spread(3, 2.4).map((dx) => disc(x + dx - (w - 5) * 0.16, y - d * 0.2, 0.4, "t-knob", 5.35)),
      edge({ x: x - (w - 8) / 2, y: y + d / 2 }, { x: x + (w - 8) / 2, y: y + d / 2 }, "seam", 3.6, 3.6),
    ];
  },

  treadmill: (x, y, w, h) =>
    spread(3, w - 8).flatMap((dx) => {
      const dw = w * 0.13;
      const dd = h - 8;
      return [
        box(x + dx, y + 1, dw, dd, 1.5, "t-dark"),
        slab(x + dx, y + 1.4, dw * 0.74, dd - 3, "t-rubber-top", 1.6),
        box(x + dx, y - dd / 2 + 1, dw, 0.9, 5.5, "t-steel", 1.5),
        panel(x + dx, y - dd / 2 + 1, dw * 0.8, 6, 2.4, "t-screen"),
        ...spread(2, dw).map((hx) => box(x + dx + hx, y - dd * 0.24, 0.5, dd * 0.34, 3.4, "t-steel", 1.5)),
      ];
    }),

  rack: (x, y, w, h) => {
    const back = y - h * 0.16;
    return [
      slab(x, y, w - 4, h - 4, "t-rubber-floor", 0.12),
      ...spread(2, w - 7).map((dx) => box(x + dx, back, 1.6, h * 0.18, 9, "t-steel")),
      ...spread(2, w - 7).flatMap((dx) => [
        edge({ x: x + dx, y: back + h * 0.1 }, { x: x + dx, y: back + h * 0.1 }, "notch", 5, 5),
        edge({ x: x + dx, y: back + h * 0.1 }, { x: x + dx, y: back + h * 0.1 }, "notch", 6.4, 6.4),
      ]),
      box(x, back, w - 5, 0.7, 0.7, "t-bar", 7),
      ...spread(2, w - 8).flatMap((dx) => [
        disc(x + dx, back, 2.4, "t-plate", 7.35),
        disc(x + dx, back, 1.1, "t-plate-hub", 7.4),
      ]),
      box(x, y + h * 0.22, w * 0.4, 2.6, 2.6, "t-steel"),
      slab(x, y + h * 0.22, w * 0.38, 2.2, "t-fabric-top", 2.7),
      ...spread(3, w * 0.3).map((dx) => disc(x + dx, y + h * 0.36, 1.1, "t-plate", 0.3)),
    ];
  },

  cables: (x, y, w, h) => {
    const back = y - h * 0.12;
    return [
      ...spread(2, w - 8).map((dx) => box(x + dx, back, 1.5, 1.5, 12, "t-steel")),
      box(x, back, w - 7, 1.2, 1, "t-bar", 11.4),
      ...spread(2, w - 8).map((dx) => disc(x + dx, back, 0.9, "t-plate-hub", 11.5)),
      box(x, back, w * 0.24, 2.4, 6.5, "t-rubber"),
      ...spread(4, 5).map((lift) =>
        edge({ x: x - w * 0.12, y: back + 1.2 }, { x: x + w * 0.12, y: back + 1.2 }, "seam", 1.4 + lift, 1.4 + lift),
      ),
      ...spread(2, w - 8).map((dx) =>
        edge({ x: x + dx, y: back + 0.8 }, { x: x + dx, y: back + 0.8 }, "cable", 11.2, 7.5),
      ),
      ...seat(x, y + h * 0.26, 4, 1),
      box(x, y + h * 0.06, w * 0.34, 1.2, 1.4, "t-steel"),
    ];
  },

  mat: (x, y, w, h) => [
    ...spread(2, h - 7).flatMap((dy, i) => [
      slab(x, y + dy, w - 7, h * 0.26, i === 0 ? "t-rubber-top" : "t-mat-alt", 0.3),
      ...spread(3, w - 11).map((dx) =>
        edge({ x: x + dx, y: y + dy - h * 0.1 }, { x: x + dx, y: y + dy + h * 0.1 }, "grout", 0.32, 0.32),
      ),
    ]),
    box(x - w * 0.2, y + h * 0.34, 4.4, 1.4, 1.4, "t-rubber"),
    ...spread(2, 4).map((dx) => disc(x + w * 0.18 + dx, y + h * 0.34, 1.2, "t-plate", 0.35)),
    box(x + w * 0.18, y + h * 0.34, 3, 0.5, 0.5, "t-bar", 0.9),
  ],

  fountain: (x, y, w, h) => {
    const s = Math.min(w, h) * 0.5;
    return [
      box(x, y, s, s * 0.8, 5.6, "t-steel"),
      slab(x, y, s - 0.6, s * 0.8 - 0.6, "t-steel-top", 5.7),
      disc(x, y + 0.4, s * 0.28, "t-basin", 5.72),
      disc(x, y + 0.4, 0.4, "t-drain", 5.75),
      box(x, y - s * 0.3, 0.7, 0.7, 1.8, "t-bar", 5.7),
      edge({ x: x, y: y - s * 0.3 }, { x: x, y: y + 0.2 }, "spout", 7.4, 7.1),
      disc(x - s * 0.24, y - s * 0.28, 0.4, "t-knob", 5.75),
      box(x, y, s + 1, s * 0.8 + 1, 0.7, "t-dark"),
      panel(x, y + s * 0.4, s * 0.6, 1.4, 3.4, "t-steel-flat"),
      box(x, y - s * 0.3, 0.5, 0.5, 2.4, "t-bar", 3.2),
      ...spread(2, s * 0.4).map((dx) =>
        edge({ x: x + dx, y: y + s * 0.4 }, { x: x + dx, y: y + s * 0.4 }, "seam", 1, 5.4),
      ),
    ];
  },

  sauna: (x, y, w, h) => {
    const sw = w - 4;
    const sd = h - 4;
    return [
      box(x, y, sw, sd, 11, "t-wood"),
      ...spread(6, sw - 2).map((dx) =>
        edge({ x: x + dx, y: y + sd / 2 }, { x: x + dx, y: y + sd / 2 }, "plank", 0.5, 10.5),
      ),
      ...spread(4, sd - 2).map((dy) =>
        edge({ x: x + sw / 2, y: y + dy }, { x: x + sw / 2, y: y + dy }, "plank", 0.5, 10.5),
      ),
      slab(x, y, sw + 1.4, sd + 1.4, "t-wood-dark-top", 11.1),
      panel(x - sw * 0.1, y + sd / 2, sw * 0.34, 0.6, 6.4, "t-door"),
      panel(x - sw * 0.1, y + sd / 2, sw * 0.2, 4.4, 2.2, "t-glass-flat"),
      edge({ x: x + sw * 0.04, y: y + sd / 2 + 0.25 }, { x: x + sw * 0.04, y: y + sd / 2 + 0.25 }, "handle", 3.4, 4.4),
      panel(x + sw * 0.22, y + sd / 2, sw * 0.22, 7.4, 1.4, "t-sign"),
    ];
  },

  lockers: (x, y, w, h) => {
    const d = h * 0.32;
    return [
      box(x, y, w - 4, d, 10.5, "t-locker"),
      ...spread(4, w - 6).flatMap((dx) => [
        edge({ x: x + dx, y: y + d / 2 }, { x: x + dx, y: y + d / 2 }, "seam", 0.5, 10),
        edge({ x: x + dx + 1.1, y: y + d / 2 }, { x: x + dx + 1.1, y: y + d / 2 }, "handle", 5.4, 6.2),
        ...spread(3, 1.6).map((lift) =>
          edge({ x: x + dx - 1, y: y + d / 2 }, { x: x + dx + 0.4, y: y + d / 2 }, "vent", 8.4 + lift, 8.4 + lift),
        ),
      ]),
      slab(x, y, w - 4.6, d - 0.6, "t-steel-top", 10.6),
      box(x, y + h * 0.3, w - 9, 1.8, 1.6, "t-wood-dark"),
      slab(x, y + h * 0.3, w - 9.4, 1.5, "t-wood-top", 1.7),
    ];
  },

  produce: (x, y, w, h) =>
    spread(3, h - 6).flatMap((dy, row) => crate(x, y + dy, w - 6, h * 0.2, row)),

  stall: (x, y, w, h) => {
    const sw = w - 5;
    const sd = h * 0.4;
    return [
      box(x, y, sw, sd, 3.4, "t-wood"),
      ...crate(x - sw * 0.24, y, sw * 0.4, sd * 0.8, 0, 3.5),
      ...crate(x + sw * 0.24, y, sw * 0.4, sd * 0.8, 2, 3.5),
      ...[-1, 1].map((side) => box(x + side * (sw / 2 + 1.3), y, 0.7, 0.7, 9, "t-steel")),
      ...spread(5, sw).map((dx, i) =>
        box(x + dx, y - 0.6, sw / 5.2, sd + 1.4, 0.9, i % 2 === 0 ? "t-awning" : "t-awning-alt", 8.4),
      ),
      edge({ x: x - sw / 2, y: y - 0.6 }, { x: x + sw / 2, y: y - 0.6 }, "sign", 8.3, 8.3),
    ];
  },

  storefront: (x, y, w, h) => {
    const bw = w - 4;
    const bd = h * 0.5;
    const front = y - h * 0.1 + bd / 2;
    return [
      box(x, y - h * 0.1, bw, bd, 13, "t-brick"),
      ...spread(4, 9).map((lift) =>
        edge({ x: x - bw / 2, y: front }, { x: x + bw / 2, y: front }, "course", 1.6 + lift, 1.6 + lift),
      ),
      panel(x - bw * 0.14, front, bw * 0.46, 1.2, 4.6, "t-glass-flat"),
      ...spread(2, bw * 0.3).map((dx) =>
        edge({ x: x - bw * 0.14 + dx, y: front }, { x: x - bw * 0.14 + dx, y: front }, "mullion", 1.2, 5.8),
      ),
      panel(x + bw * 0.26, front, bw * 0.18, 1.2, 5, "t-door"),
      disc(x + bw * 0.31, front, 0.4, "t-knob", 3.4),
      ...spread(5, bw).map((dx, i) =>
        box(x + dx, front + 1.1, bw / 5.2, 2.6, 0.8, i % 2 === 0 ? "t-awning" : "t-awning-alt", 6.4),
      ),
      panel(x, front, bw * 0.8, 7.8, 1.8, "t-sign"),
      slab(x, y - h * 0.1, bw + 1.2, bd + 1.2, "t-roof", 13.1),
      panel(x - bw * 0.2, front, bw * 0.26, 9.9, 2.2, "t-glass-flat"),
    ];
  },

  carwash: (x, y, w, h) => {
    const d = h - 8;
    return [
      slab(x, y, w - 4, h - 5, "t-wet", 0.12),
      ...spread(2, w - 7).map((dx) => box(x + dx, y, 2, d, 8.5, "t-steel")),
      box(x, y, w - 5, 1.4, 1.4, "t-bar", 8.4),
      ...spread(2, w - 12).map((dx) => box(x + dx, y, 1.6, d - 2, 6.4, "t-brush")),
      ...spread(2, w - 12).flatMap((dx) =>
        spread(4, 5).map((lift) =>
          edge({ x: x + dx - 0.8, y: y + (d - 2) / 2 }, { x: x + dx + 0.8, y: y + (d - 2) / 2 }, "bristle", 1.4 + lift, 1.4 + lift),
        ),
      ),
      box(x - (w - 7) / 2 - 1.4, y + d * 0.4, 2, 1.4, 3, "t-dark"),
      panel(x - (w - 7) / 2 - 1.4, y + d * 0.4 + 0.9, 1.4, 2.2, 1, "t-screen"),
    ];
  },

  planter: (x, y, w, h) => {
    const pw = w - 4;
    const pd = h * 0.4;
    return [
      box(x, y, pw, pd, 2.8, "t-terracotta"),
      slab(x, y, pw - 1, pd - 0.8, "t-soil", 2.9),
      ...spread(3, pw - 4).flatMap((dx, i) => [
        disc(x + dx, y, 2.1, "t-leaf", 3.1),
        disc(x + dx, y - pd * 0.16, 1.4, "t-leaf-light", 3.6),
        disc(x + dx, y + pd * 0.14, 0.8, crop(i), 3.4),
      ]),
      edge({ x: x - pw / 2, y: y + pd / 2 }, { x: x + pw / 2, y: y + pd / 2 }, "rim", 2.4, 2.4),
    ];
  },
};

export const FIXTURES = Object.keys(PROP) as Fixture[];

/** Unsorted parts — exported so the draw order can be tested directly. */
export function isoParts(place: Place): Part[] {
  return PROP[place.fixture](place.at.x, place.at.y, place.w, place.h);
}

export function isoProp(place: Place): string {
  return render(isoParts(place));
}
