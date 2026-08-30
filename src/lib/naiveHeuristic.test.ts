import { describe, expect, it } from "vitest";
import { precedenceViolated } from "./constraintState";
import { generateRandom, generateToday } from "./generate";
import { naiveOrder } from "./naiveHeuristic";
import type { Shift } from "./types";

const days = Array.from({ length: 60 }, (_, i) => new Date(2026, 8, 1 + i));
const randoms = Array.from({ length: 60 }, (_, i) => generateRandom(i * 6151 + 5));
const shifts: Shift[] = [...days.map(generateToday), ...randoms];

describe("naiveOrder", () => {
  it("is always a valid permutation of the day's tasks", () => {
    for (const shift of shifts) {
      const order = naiveOrder(shift);
      const ids = shift.tasks.map((t) => t.id);
      expect(order).toHaveLength(ids.length);
      expect(new Set(order)).toEqual(new Set(ids));
    }
  });

  it("always satisfies an active precedence pair", () => {
    for (const shift of shifts) {
      if (!shift.precedence) continue;
      const order = naiveOrder(shift);
      expect(precedenceViolated(shift.precedence, order)).toBe(false);
    }
  });
});
