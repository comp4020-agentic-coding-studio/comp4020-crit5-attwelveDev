import type { Point } from "../lib/types";

/**
 * A tiny isometric primitive kit. Everything in the playback scene is built
 * from these calls, which is what keeps the light direction, the face shading
 * and the stroke weight identical across every prop.
 *
 * True 30° isometric. Light comes from the top-left: top face lightest, the
 * +y face next, the +x face darkest. Never shade a face by hand.
 *
 * Each primitive returns a `Part` carrying its bounding box as well as its
 * markup, because *painter's order cannot be left to authoring order*. Legs
 * authored after a desktop paint over it; a splashback authored after a hob
 * floats in front of it. `sortParts` decides the order from the geometry.
 */

export const ISO_X = 0.7071;
export const ISO_Y = 0.4082;

export function iso(p: Point): Point {
  return { x: (p.x - p.y) * ISO_X, y: (p.x + p.y) * ISO_Y };
}

export type Part = {
  readonly xMin: number;
  readonly xMax: number;
  readonly yMin: number;
  readonly yMax: number;
  readonly zMin: number;
  readonly zMax: number;
  readonly svg: string;
};

const EPS = 1e-6;

/**
 * The standard isometric occlusion test: `b` hides `a` only if it is wholly
 * beyond it along one axis. Boxes that interpenetrate are separated by neither
 * test, and fall back to a stable key.
 */
export function inFront(b: Part, a: Part): boolean {
  return (
    b.xMin >= a.xMax - EPS || b.yMin >= a.yMax - EPS || b.zMin >= a.zMax - EPS
  );
}

function strictlyInFront(b: Part, a: Part): boolean {
  return inFront(b, a) && !inFront(a, b);
}

function key(p: Part): number {
  return p.xMin + p.xMax + p.yMin + p.yMax + (p.zMin + p.zMax) * 0.5;
}

/** Back-to-front draw order, derived from the geometry rather than trusted. */
export function sortParts(parts: readonly Part[]): Part[] {
  const n = parts.length;
  const after: number[][] = Array.from({ length: n }, () => []);
  const pending = new Array<number>(n).fill(0);

  for (let i = 0; i < n; i++) {
    for (let j = 0; j < n; j++) {
      if (i === j) continue;
      if (strictlyInFront(parts[j] as Part, parts[i] as Part)) {
        after[i]?.push(j);
        pending[j] = (pending[j] ?? 0) + 1;
      }
    }
  }

  const ready = [...parts.keys()].filter((i) => pending[i] === 0);
  const out: Part[] = [];
  const done = new Set<number>();

  while (ready.length > 0) {
    ready.sort((a, b) => key(parts[a] as Part) - key(parts[b] as Part));
    const i = ready.shift() as number;
    if (done.has(i)) continue;
    done.add(i);
    out.push(parts[i] as Part);
    for (const j of after[i] ?? []) {
      pending[j] = (pending[j] ?? 1) - 1;
      if (pending[j] === 0) ready.push(j);
    }
  }

  // Interpenetrating geometry can form a cycle; fall back to a stable key so a
  // prop still renders rather than losing parts.
  if (out.length < n) {
    const rest = [...parts.keys()]
      .filter((i) => !done.has(i))
      .sort((a, b) => key(parts[a] as Part) - key(parts[b] as Part));
    for (const i of rest) out.push(parts[i] as Part);
  }
  return out;
}

export function render(parts: readonly Part[]): string {
  return sortParts(parts)
    .map((part) => part.svg)
    .join("");
}

function pts(points: readonly Point[]): string {
  return points.map((p) => `${p.x.toFixed(2)},${p.y.toFixed(2)}`).join(" ");
}

function corners(cx: number, cy: number, w: number, d: number): Point[] {
  return [
    { x: cx - w / 2, y: cy - d / 2 },
    { x: cx + w / 2, y: cy - d / 2 },
    { x: cx + w / 2, y: cy + d / 2 },
    { x: cx - w / 2, y: cy + d / 2 },
  ].map(iso);
}

const raise = (p: Point, by: number): Point => ({ x: p.x, y: p.y - by });

function bounds(
  cx: number,
  cy: number,
  w: number,
  d: number,
  base: number,
  h: number,
  svg: string,
): Part {
  return {
    xMin: cx - w / 2,
    xMax: cx + w / 2,
    yMin: cy - d / 2,
    yMax: cy + d / 2,
    zMin: base,
    zMax: base + h,
    svg,
  };
}

/** An extruded box standing on the ground plane (or on `base`). */
export function box(
  cx: number,
  cy: number,
  w: number,
  d: number,
  h: number,
  cls = "",
  base = 0,
): Part {
  const [a, b, c, e] = corners(cx, cy, w, d) as [Point, Point, Point, Point];
  const lo = (p: Point) => raise(p, base);
  const hi = (p: Point) => raise(p, base + h);
  const group = cls ? ` class="${cls}"` : "";
  const svg = `<g${group}>
<polygon class="face-right" points="${pts([hi(b), hi(c), lo(c), lo(b)])}" />
<polygon class="face-left" points="${pts([hi(c), hi(e), lo(e), lo(c)])}" />
<polygon class="face-top" points="${pts([hi(a), hi(b), hi(c), hi(e)])}" />
</g>`;
  return bounds(cx, cy, w, d, base, h, svg);
}

/** Just the top face — mats, worktops, floor markings, rugs. */
export function slab(
  cx: number,
  cy: number,
  w: number,
  d: number,
  cls: string,
  base = 0,
): Part {
  const face = corners(cx, cy, w, d).map((p) => raise(p, base));
  return bounds(
    cx,
    cy,
    w,
    d,
    base,
    0,
    `<polygon class="${cls}" points="${pts(face)}" />`,
  );
}

/** A circle lying flat on a surface: hobs, drains, plates, produce. */
export function disc(
  cx: number,
  cy: number,
  r: number,
  cls: string,
  base = 0,
): Part {
  const c = raise(iso({ x: cx, y: cy }), base);
  return bounds(
    cx,
    cy,
    r * 2,
    r * 2,
    base,
    0,
    `<ellipse class="${cls}" cx="${c.x.toFixed(2)}" cy="${c.y.toFixed(2)}" rx="${(r * 1.05).toFixed(2)}" ry="${(r * 0.6).toFixed(2)}" />`,
  );
}

/** A line on a vertical face — seams, handles, shelf edges, grain. */
export function edge(
  from: Point,
  to: Point,
  cls: string,
  lift = 0,
  liftTo = lift,
): Part {
  const a = raise(iso(from), lift);
  const b = raise(iso(to), liftTo);
  return {
    xMin: Math.min(from.x, to.x),
    xMax: Math.max(from.x, to.x),
    yMin: Math.min(from.y, to.y),
    yMax: Math.max(from.y, to.y),
    zMin: Math.min(lift, liftTo),
    zMax: Math.max(lift, liftTo),
    svg: `<line class="${cls}" x1="${a.x.toFixed(2)}" y1="${a.y.toFixed(2)}" x2="${b.x.toFixed(2)}" y2="${b.y.toFixed(2)}" />`,
  };
}

/** A flat upright panel facing the camera — screens, signs, glass. */
export function panel(
  cx: number,
  cy: number,
  w: number,
  base: number,
  h: number,
  cls: string,
): Part {
  const left = raise(iso({ x: cx - w / 2, y: cy }), base);
  const right = raise(iso({ x: cx + w / 2, y: cy }), base);
  const svg = `<polygon class="${cls}" points="${pts([
    { x: left.x, y: left.y - h },
    { x: right.x, y: right.y - h },
    right,
    left,
  ])}" />`;
  return bounds(cx, cy, w, 0.3, base, h, svg);
}

/** Depth order between whole places, whose footprints never overlap. */
export function depth(p: Point): number {
  return p.x + p.y;
}
