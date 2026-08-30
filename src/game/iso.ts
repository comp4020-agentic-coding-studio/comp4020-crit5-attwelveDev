import type { Point } from "../lib/types";

/**
 * A tiny isometric primitive kit. Everything in the playback scene is built
 * from these three calls, which is what keeps the light direction, the face
 * shading and the stroke weight identical across every prop — the thing that
 * makes flat polygons read as one deliberate style rather than as clip art.
 *
 * True 30° isometric. Light comes from the top-left: top face lightest, the
 * +y face next, the +x face darkest. Never shade a face by hand.
 */

export const ISO_X = 0.7071;
export const ISO_Y = 0.4082;

export function iso(p: Point): Point {
  return { x: (p.x - p.y) * ISO_X, y: (p.x + p.y) * ISO_Y };
}

function pts(points: readonly Point[]): string {
  return points.map((p) => `${p.x.toFixed(2)},${p.y.toFixed(2)}`).join(" ");
}

/** The four ground corners of a footprint, projected, back-to-front. */
function corners(cx: number, cy: number, w: number, d: number): Point[] {
  return [
    { x: cx - w / 2, y: cy - d / 2 },
    { x: cx + w / 2, y: cy - d / 2 },
    { x: cx + w / 2, y: cy + d / 2 },
    { x: cx - w / 2, y: cy + d / 2 },
  ].map(iso);
}

const raise = (p: Point, by: number): Point => ({ x: p.x, y: p.y - by });

/** An extruded box standing on the ground plane (or on `base`). */
export function box(
  cx: number,
  cy: number,
  w: number,
  d: number,
  h: number,
  cls = "",
  base = 0,
): string {
  const [a, b, c, e] = corners(cx, cy, w, d) as [Point, Point, Point, Point];
  const lo = (p: Point) => raise(p, base);
  const hi = (p: Point) => raise(p, base + h);
  const group = cls ? ` class="${cls}"` : "";
  return `<g${group}>
<polygon class="face-right" points="${pts([hi(b), hi(c), lo(c), lo(b)])}" />
<polygon class="face-left" points="${pts([hi(c), hi(e), lo(e), lo(c)])}" />
<polygon class="face-top" points="${pts([hi(a), hi(b), hi(c), hi(e)])}" />
</g>`;
}

/** Just the top face — mats, rugs, floor markings. */
export function slab(
  cx: number,
  cy: number,
  w: number,
  d: number,
  cls: string,
  base = 0,
): string {
  const [a, b, c, e] = corners(cx, cy, w, d) as [Point, Point, Point, Point];
  return `<polygon class="${cls}" points="${pts([a, b, c, e].map((p) => raise(p, base)))}" />`;
}

/** A circle lying flat on a surface: hobs, drains, plates. */
export function disc(
  cx: number,
  cy: number,
  r: number,
  cls: string,
  base = 0,
): string {
  const c = raise(iso({ x: cx, y: cy }), base);
  return `<ellipse class="${cls}" cx="${c.x.toFixed(2)}" cy="${c.y.toFixed(2)}" rx="${(r * 1.05).toFixed(2)}" ry="${(r * 0.6).toFixed(2)}" />`;
}

/** A line drawn on a vertical face — seams, handles, shelf edges. */
export function edge(
  from: Point,
  to: Point,
  cls: string,
  lift = 0,
  liftTo = lift,
): string {
  const a = raise(iso(from), lift);
  const b = raise(iso(to), liftTo);
  return `<line class="${cls}" x1="${a.x.toFixed(2)}" y1="${a.y.toFixed(2)}" x2="${b.x.toFixed(2)}" y2="${b.y.toFixed(2)}" />`;
}

/** Depth order: things further from the camera are drawn first. */
export function depth(p: Point): number {
  return p.x + p.y;
}
