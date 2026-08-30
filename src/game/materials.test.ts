import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import type { Fixture, Place } from "../lib/types";
import { FIXTURES, isoProp, planSymbol } from "./fixtures";

/**
 * Materials live in CSS but are named in TypeScript, and nothing type-checks
 * across that gap. A tone-only class works on a box — whose faces read
 * `--tone` — and leaves a disc or a slab with no fill at all, which is how
 * the produce in the crates shipped rendering solid black.
 *
 * So: read the real stylesheet, and check every class each primitive actually
 * emits against what that primitive needs.
 */
const CSS = readFileSync(resolve("src/styles/global.css"), "utf8");

/**
 * The declarations under `.name`, across all its rules — including grouped
 * selectors like `.seam, .plank, .grain { … }`. The trailing guard stops
 * `.t-wood` matching inside `.t-wood-dark`, and `[^{}]*` stops a selector
 * reaching across a neighbouring rule's braces.
 */
function rulesFor(name: string): string {
  const pattern = new RegExp(`\\.${name}(?![\\w-])[^{}]*\\{([^}]*)\\}`, "g");
  return [...CSS.matchAll(pattern)].map((m) => m[1] ?? "").join(";");
}

function declares(name: string, property: string): boolean {
  return new RegExp(`(^|[;\\s])${property}\\s*:`).test(rulesFor(name));
}

const sample = (fixture: Fixture): Place => ({
  name: fixture,
  at: { x: 50, y: 50 },
  w: 24,
  h: 18,
  fixture,
});

type Usage = { fixture: Fixture; cls: string };

/** Classes on `<g>` wrappers — these are extruded boxes and shade from --tone. */
const groups: Usage[] = [];
/** Classes on flat shapes — slabs, discs, panels. These need an outright fill. */
const flats: Usage[] = [];
/** Classes on drawn lines — seams, handles, grain. These need a stroke. */
const strokes: Usage[] = [];

for (const fixture of FIXTURES) {
  const svg = isoProp(sample(fixture));
  for (const [, cls] of svg.matchAll(/<g class="([^"]+)"/g)) {
    if (cls) groups.push({ fixture, cls });
  }
  for (const [, cls] of svg.matchAll(/<(?:polygon|ellipse) class="([^"]+)"/g)) {
    if (cls && !cls.startsWith("face-")) flats.push({ fixture, cls });
  }
  for (const [, cls] of svg.matchAll(/<line class="([^"]+)"/g)) {
    if (cls) strokes.push({ fixture, cls });
  }
}

describe("every material a prop names is actually defined", () => {
  it("finds material classes to check at all", () => {
    expect(groups.length).toBeGreaterThan(0);
    expect(flats.length).toBeGreaterThan(0);
    expect(strokes.length).toBeGreaterThan(0);
  });

  it("gives every extruded box a tone to shade its faces from", () => {
    for (const { fixture, cls } of groups) {
      expect(declares(cls, "--tone"), `${fixture}: .${cls} sets no --tone`).toBe(
        true,
      );
    }
  });

  it("gives every flat part a fill, so none of them render black", () => {
    for (const { fixture, cls } of flats) {
      expect(declares(cls, "fill"), `${fixture}: .${cls} sets no fill`).toBe(
        true,
      );
    }
  });

  it("gives every drawn line a stroke, so none of them vanish", () => {
    for (const { fixture, cls } of strokes) {
      expect(declares(cls, "stroke"), `${fixture}: .${cls} sets no stroke`).toBe(
        true,
      );
    }
  });
});

/**
 * The plan view has exactly the same trap, and fell into it: every `plan-*`
 * material a fixture named was undefined in CSS, so the whole floor plan
 * rendered in solid black.
 */
describe("every plan-view material is defined too", () => {
  const fills: Usage[] = [];
  const planStrokes: Usage[] = [];

  for (const fixture of FIXTURES) {
    const svg = planSymbol(sample(fixture));
    for (const [, cls] of svg.matchAll(/<(?:rect|circle|ellipse) class="([^"]+)"/g)) {
      if (cls) fills.push({ fixture, cls });
    }
    for (const [, cls] of svg.matchAll(/<(?:line|path) class="([^"]+)"/g)) {
      if (cls) planStrokes.push({ fixture, cls });
    }
  }

  it("finds plan classes to check", () => {
    expect(fills.length).toBeGreaterThan(0);
    expect(planStrokes.length).toBeGreaterThan(0);
  });

  it("gives every filled plan shape a fill", () => {
    for (const { fixture, cls } of fills) {
      expect(declares(cls, "fill"), `${fixture}: .${cls} sets no fill`).toBe(true);
    }
  });

  it("gives every plan line a stroke", () => {
    for (const { fixture, cls } of planStrokes) {
      expect(declares(cls, "stroke"), `${fixture}: .${cls} sets no stroke`).toBe(
        true,
      );
    }
  });
});

describe("materials distinguish the scenarios from each other", () => {
  it("uses more than a handful of distinct materials across the set", () => {
    const distinct = new Set([...groups, ...flats].map((u) => u.cls));
    expect(distinct.size).toBeGreaterThanOrEqual(20);
  });

  it("gives each fixture its own combination of materials", () => {
    const signatures = new Map<string, Fixture>();
    for (const fixture of FIXTURES) {
      const svg = isoProp(sample(fixture));
      const used = [...svg.matchAll(/class="(t-[^"]*)"/g)]
        .map((m) => m[1])
        .sort()
        .join("|");
      const clash = signatures.get(used);
      expect(
        clash,
        `${fixture} is made of exactly the same materials as ${clash}`,
      ).toBeUndefined();
      signatures.set(used, fixture);
    }
  });
});
