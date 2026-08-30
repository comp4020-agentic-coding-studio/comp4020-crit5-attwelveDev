import { describe, expect, it } from "vitest";
import { SCENARIOS } from "../lib/data/scenarios";
import type { Fixture, Place } from "../lib/types";
import { FIXTURES, isoParts, isoProp } from "./fixtures";
import { inFront, sortParts } from "./iso";

const sample = (fixture: Fixture): Place => ({
  name: fixture,
  at: { x: 50, y: 50 },
  w: 24,
  h: 18,
  fixture,
});

/** Every material class a prop may claim, so a typo can't quietly go grey. */
const MATERIALS = new Set([
  "t-wood", "t-wood-dark", "t-wood-top", "t-wood-flat", "t-wood-dark-top",
  "t-steel", "t-steel-top", "t-steel-flat", "t-enamel", "t-enamel-top", "t-dark", "t-dark-top", "t-dark-flat",
  "t-glass", "t-glass-flat", "t-rubber", "t-rubber-top", "t-rubber-floor",
  "t-fabric", "t-fabric-flat", "t-fabric-soft", "t-fabric-top", "t-locker",
  "t-tile", "t-brick", "t-terracotta", "t-cold-top", "t-screen", "t-screen-pad",
  "t-hob", "t-hob-inner", "t-hobtop", "t-knob", "t-lamp", "t-basin", "t-drain",
  "t-mattress", "t-paper", "t-plate", "t-plate-hub", "t-bar", "t-mug",
  "t-awning", "t-awning-alt", "t-sign", "t-door", "t-roof", "t-brush", "t-wet",
  "t-soil", "t-leaf", "t-leaf-light", "t-mat-alt", "t-worktop", "t-crop-a",
  "t-crop-b", "t-crop-c",
]);

describe("fixture coverage", () => {
  it("draws every fixture the scenarios actually use", () => {
    const used = new Set(
      SCENARIOS.flatMap((scenario) => scenario.places.map((place) => place.fixture)),
    );
    for (const fixture of used) {
      expect(FIXTURES, `${fixture} has no prop`).toContain(fixture);
    }
  });

  it("gives every fixture a prop", () => {
    for (const fixture of FIXTURES) {
      expect(isoParts(sample(fixture)).length, fixture).toBeGreaterThan(0);
    }
  });
});

/**
 * A prop with four boxes reads as a diagram; the same prop with a dozen reads
 * as a thing. This is the floor under "don't let it drift back into grey
 * PowerPoint shapes" — it is a crude measure of detail, but it is a real one.
 */
describe("props carry enough detail to read as objects", () => {
  for (const fixture of FIXTURES) {
    it(`${fixture} is built from at least eight parts`, () => {
      expect(isoParts(sample(fixture)).length).toBeGreaterThanOrEqual(8);
    });

    it(`${fixture} names only known materials`, () => {
      const svg = isoProp(sample(fixture));
      for (const [, cls] of svg.matchAll(/class="([^"]*)"/g)) {
        for (const name of (cls ?? "").split(/\s+/).filter((n) => n.startsWith("t-"))) {
          expect(MATERIALS, `${fixture} uses ${name}`).toContain(name);
        }
      }
    });

    it(`${fixture} carries colour rather than defaulting to bare geometry`, () => {
      expect(isoProp(sample(fixture))).toMatch(/class="[^"]*\bt-/);
    });
  }

});

describe("no two fixtures look the same", () => {
  it("draws a distinct prop for each", () => {
    const seen = new Map<string, Fixture>();
    for (const fixture of FIXTURES) {
      const svg = isoProp(sample(fixture));
      const clash = seen.get(svg);
      expect(clash, `${fixture} renders identically to ${clash}`).toBeUndefined();
      seen.set(svg, fixture);
    }
  });

});

/**
 * A part sealed inside another one can never be seen. Shelving and fridges
 * both shipped as solid carcasses with their stock modelled *inside* them, so
 * the goods clumped into whichever corner the sort happened to expose. If a
 * prop has contents, they have to sit in front of the thing that holds them.
 */
describe("nothing is buried inside another part", () => {
  const EPS = 1e-6;

  for (const fixture of FIXTURES) {
    it(`${fixture} has no part sealed inside another`, () => {
      const parts = isoParts(sample(fixture));
      for (const inner of parts) {
        for (const outer of parts) {
          if (inner === outer) continue;
          const sealed =
            inner.xMin > outer.xMin + EPS &&
            inner.xMax < outer.xMax - EPS &&
            inner.yMin > outer.yMin + EPS &&
            inner.yMax < outer.yMax - EPS &&
            inner.zMin > outer.zMin + EPS &&
            inner.zMax < outer.zMax - EPS;
          expect(sealed, `${fixture}: a part is entirely inside another`).toBe(
            false,
          );
        }
      }
    });
  }
});

/**
 * The regression that started all this: a desk whose legs were painted over
 * the desktop. Checked here against every fixture at every footprint the
 * scenarios actually give it, not just one sample.
 */
describe("every prop draws back to front", () => {
  const realPlaces = SCENARIOS.flatMap((scenario) => scenario.places);

  for (const place of realPlaces) {
    it(`${place.name} (${place.fixture}) has no part drawn in front of one that hides it`, () => {
      const ordered = sortParts(isoParts(place));
      for (let i = 0; i < ordered.length; i++) {
        for (let j = i + 1; j < ordered.length; j++) {
          const behind = ordered[i];
          const front = ordered[j];
          if (!behind || !front) continue;
          // If the later part is strictly *behind* the earlier one, it would
          // be painted over something it should be hidden by.
          const wrongWay = inFront(behind, front) && !inFront(front, behind);
          expect(wrongWay, `${place.fixture}: part ${j} should precede ${i}`).toBe(false);
        }
      }
    });
  }
});
