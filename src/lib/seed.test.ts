import { describe, expect, it } from "vitest";
import {
  dateKey,
  dateSeed,
  isWeekend,
  shiftSeed,
  weekIndex,
  weekdayOffset,
  weekSeed,
} from "./seed";

// Local-time constructor throughout: the whole point is the *calendar* date a
// player sees, not UTC.
const at = (y: number, m: number, d: number) => new Date(y, m - 1, d, 12, 0, 0);

describe("dateKey", () => {
  it("pads to YYYY-MM-DD", () => {
    expect(dateKey(at(2026, 9, 2))).toBe("2026-09-02");
    expect(dateKey(at(2026, 12, 25))).toBe("2026-12-25");
  });

  it("ignores the time of day", () => {
    expect(dateKey(new Date(2026, 8, 2, 0, 0, 1))).toBe(
      dateKey(new Date(2026, 8, 2, 23, 59, 59)),
    );
  });
});

describe("dateSeed", () => {
  it("is stable for the same calendar date", () => {
    expect(dateSeed(at(2026, 9, 2))).toBe(dateSeed(new Date(2026, 8, 2, 3)));
  });

  it("differs across adjacent days", () => {
    expect(dateSeed(at(2026, 9, 2))).not.toBe(dateSeed(at(2026, 9, 3)));
  });
});

describe("week bucketing", () => {
  it("weekdayOffset runs Monday=0 to Sunday=6", () => {
    // 2026-08-31 is a Monday.
    expect(weekdayOffset(at(2026, 8, 31))).toBe(0);
    expect(weekdayOffset(at(2026, 9, 4))).toBe(4);
    expect(weekdayOffset(at(2026, 9, 5))).toBe(5);
    expect(weekdayOffset(at(2026, 9, 6))).toBe(6);
  });

  it("isWeekend covers exactly Saturday and Sunday", () => {
    expect(isWeekend(at(2026, 9, 4))).toBe(false);
    expect(isWeekend(at(2026, 9, 5))).toBe(true);
    expect(isWeekend(at(2026, 9, 6))).toBe(true);
    expect(isWeekend(at(2026, 9, 7))).toBe(false);
  });

  it("weekIndex holds constant Monday through Sunday, then advances", () => {
    const monday = weekIndex(at(2026, 8, 31));
    expect(weekIndex(at(2026, 9, 6))).toBe(monday);
    expect(weekIndex(at(2026, 9, 7))).toBe(monday + 1);
  });

  it("weekSeed is shared by every day of one week", () => {
    expect(weekSeed(at(2026, 9, 1))).toBe(weekSeed(at(2026, 9, 4)));
    expect(weekSeed(at(2026, 9, 1))).not.toBe(weekSeed(at(2026, 9, 8)));
  });
});

describe("shiftSeed", () => {
  it("is unique per day within a week", () => {
    const week = [31, 1, 2, 3, 4, 5, 6].map((day, index) =>
      shiftSeed(at(2026, index === 0 ? 8 : 9, day)),
    );
    expect(new Set(week).size).toBe(7);
  });

  it("differs for the same weekday in different weeks", () => {
    expect(shiftSeed(at(2026, 9, 1))).not.toBe(shiftSeed(at(2026, 9, 8)));
  });
});
