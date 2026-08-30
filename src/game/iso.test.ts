import { describe, expect, it } from "vitest";
import { box, inFront, iso, panel, slab, sortParts, type Part } from "./iso";

const at = (parts: readonly Part[], part: Part): number => parts.indexOf(part);

describe("iso projection", () => {
  it("puts the world origin at the screen origin", () => {
    expect(iso({ x: 0, y: 0 })).toEqual({ x: 0, y: 0 });
  });

  it("sends +x to the right and +y to the left, both downward", () => {
    expect(iso({ x: 10, y: 0 }).x).toBeGreaterThan(0);
    expect(iso({ x: 0, y: 10 }).x).toBeLessThan(0);
    expect(iso({ x: 10, y: 0 }).y).toBeGreaterThan(0);
    expect(iso({ x: 0, y: 10 }).y).toBeGreaterThan(0);
  });
});

describe("inFront", () => {
  const here = box(0, 0, 10, 10, 5);

  it("sees a box further along +x as nearer the camera", () => {
    expect(inFront(box(20, 0, 4, 4, 4), here)).toBe(true);
    expect(inFront(box(-20, 0, 4, 4, 4), here)).toBe(false);
  });

  it("sees a box further along +y as nearer the camera", () => {
    expect(inFront(box(0, 20, 4, 4, 4), here)).toBe(true);
    expect(inFront(box(0, -20, 4, 4, 4), here)).toBe(false);
  });

  it("sees a box resting on top as nearer the camera", () => {
    expect(inFront(box(0, 0, 10, 10, 2, "", 5), here)).toBe(true);
  });

  it("separates neither way when two boxes interpenetrate", () => {
    const overlapping = box(2, 2, 10, 10, 5);
    expect(inFront(overlapping, here) && inFront(here, overlapping)).toBe(false);
  });
});

/**
 * These are the regressions. Every one of them shipped as a visible bug:
 * desk legs painted over the desktop they hold up, a cooker's splashback
 * floating in front of its own hob, a machine's weight stack detached from
 * its frame. All three came from trusting authoring order.
 */
describe("sortParts draws things behind before things in front", () => {
  it("puts a tabletop after the legs under it", () => {
    const legs = [
      box(-3, -3, 1, 1, 4),
      box(3, -3, 1, 1, 4),
      box(-3, 3, 1, 1, 4),
      box(3, 3, 1, 1, 4),
    ];
    const top = box(0, 0, 9, 9, 1, "", 4);
    // Authored top-first, which is the wrong order — the sort must fix it.
    const out = sortParts([top, ...legs]);
    for (const leg of legs) expect(at(out, leg)).toBeLessThan(at(out, top));
  });

  it("puts a chair in front of the desk it is pulled up to", () => {
    const desktop = box(0, 0, 14, 7, 1, "", 4);
    const chair = box(0, 8, 4, 4, 3);
    const out = sortParts([chair, desktop]);
    expect(at(out, desktop)).toBeLessThan(at(out, chair));
  });

  it("puts a splashback behind the appliance in front of it", () => {
    const splashback = box(0, -6, 12, 1.4, 4, "", 4);
    const body = box(0, 0, 12, 10, 5);
    const out = sortParts([splashback, body]);
    expect(at(out, splashback)).toBeLessThan(at(out, body));
  });

  it("puts a screen on its stand rather than under it", () => {
    const stand = box(0, 0, 2, 2, 1, "", 4);
    const screen = panel(0, 0, 6, 5, 4, "t-screen");
    const out = sortParts([screen, stand]);
    expect(at(out, stand)).toBeLessThan(at(out, screen));
  });

  it("keeps a worktop above the cabinet it sits on", () => {
    const cabinet = box(0, 0, 12, 6, 4);
    const worktop = slab(0, 0, 13, 7, "t-worktop", 4.1);
    const out = sortParts([worktop, cabinet]);
    expect(at(out, cabinet)).toBeLessThan(at(out, worktop));
  });

  it("loses nothing and duplicates nothing, even when parts interpenetrate", () => {
    const parts = [
      box(0, 0, 10, 10, 5),
      box(2, 2, 10, 10, 5),
      box(4, 4, 10, 10, 5),
      box(1, 1, 10, 10, 5),
    ];
    const out = sortParts(parts);
    expect(out).toHaveLength(parts.length);
    expect(new Set(out).size).toBe(parts.length);
  });

  it("is deterministic", () => {
    const parts = [box(5, 0, 3, 3, 2), box(0, 5, 3, 3, 2), box(0, 0, 9, 9, 1, "", 3)];
    expect(sortParts(parts)).toEqual(sortParts(parts));
  });
});
