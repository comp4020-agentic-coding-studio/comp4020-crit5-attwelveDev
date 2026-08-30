import { describe, expect, it } from "vitest";
import { mulberry32, pick, randInt, sample, shuffle } from "./prng";

describe("mulberry32", () => {
  it("is deterministic: same seed, same stream", () => {
    const a = mulberry32(12345);
    const b = mulberry32(12345);
    const runA = Array.from({ length: 20 }, () => a());
    const runB = Array.from({ length: 20 }, () => b());
    expect(runA).toEqual(runB);
  });

  it("gives different streams for different seeds", () => {
    const a = Array.from({ length: 10 }, mulberry32(1));
    const b = Array.from({ length: 10 }, mulberry32(2));
    expect(a).not.toEqual(b);
  });

  it("stays in [0, 1)", () => {
    const rng = mulberry32(99);
    for (let i = 0; i < 1000; i++) {
      const value = rng();
      expect(value).toBeGreaterThanOrEqual(0);
      expect(value).toBeLessThan(1);
    }
  });
});

describe("helpers", () => {
  it("randInt covers its bounds inclusively", () => {
    const rng = mulberry32(7);
    const seen = new Set<number>();
    for (let i = 0; i < 500; i++) seen.add(randInt(rng, 3, 6));
    expect([...seen].sort()).toEqual([3, 4, 5, 6]);
  });

  it("pick only ever returns a member", () => {
    const rng = mulberry32(11);
    const items = ["a", "b", "c"];
    for (let i = 0; i < 100; i++) expect(items).toContain(pick(rng, items));
  });

  it("shuffle permutes without mutating the input", () => {
    const items = [1, 2, 3, 4, 5, 6];
    const out = shuffle(mulberry32(3), items);
    expect(items).toEqual([1, 2, 3, 4, 5, 6]);
    expect([...out].sort()).toEqual(items);
  });

  it("sample returns distinct items of the requested count", () => {
    const items = ["a", "b", "c", "d", "e"];
    const out = sample(mulberry32(42), items, 3);
    expect(out).toHaveLength(3);
    expect(new Set(out).size).toBe(3);
  });
});
