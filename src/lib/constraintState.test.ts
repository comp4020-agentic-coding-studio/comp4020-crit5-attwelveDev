import { describe, expect, it } from "vitest";
import {
  constraintReading,
  constraintWait,
  worsensOverTime,
} from "./constraintState";
import type { HoursConstraint, QueueConstraint } from "./types";

const building: QueueConstraint = {
  kind: "queue",
  label: "Peak hour",
  affectedTaskIds: ["a", "b"],
  startWait: 1,
  growthRate: 0.25,
  cap: 12,
};

const clearing: QueueConstraint = {
  ...building,
  startWait: 12,
  growthRate: -0.25,
  cap: 12,
};

const hours: HoursConstraint = {
  kind: "hours",
  label: "Counters",
  verb: "close at",
  closedLabel: "Counters closed",
  affectedTaskIds: ["a", "b"],
  closeAt: 40,
};

describe("constraintWait", () => {
  it("leaves untouched tasks alone", () => {
    expect(constraintWait(building, "z", 30)).toBe(0);
    expect(constraintWait(hours, "z", 999)).toBe(0);
  });

  it("grows a building queue, and clamps it at the cap", () => {
    expect(constraintWait(building, "a", 0)).toBe(1);
    expect(constraintWait(building, "a", 20)).toBe(6);
    expect(constraintWait(building, "a", 500)).toBe(12);
  });

  it("clears a clearing queue, and never goes below zero", () => {
    expect(constraintWait(clearing, "a", 0)).toBe(12);
    expect(constraintWait(clearing, "a", 24)).toBe(6);
    expect(constraintWait(clearing, "a", 500)).toBe(0);
  });

  it("makes a closed task unreachable rather than merely slow", () => {
    expect(constraintWait(hours, "a", 39)).toBe(0);
    expect(constraintWait(hours, "a", 40)).toBe(Infinity);
  });

  it("depends only on its arguments — no clock, no state", () => {
    const first = constraintWait(building, "a", 17);
    constraintWait(building, "b", 400);
    expect(constraintWait(building, "a", 17)).toBe(first);
  });
});

describe("constraintReading", () => {
  it("bands a queue so the board can pair a shape with each colour", () => {
    expect(constraintReading(building, "a", 0).severity).toBe("clear");
    expect(constraintReading(building, "a", 12).severity).toBe("building");
    expect(constraintReading(building, "a", 40).severity).toBe("heavy");
  });

  it("warns before a cutoff, then reports it closed", () => {
    expect(constraintReading(hours, "a", 10).severity).toBe("clear");
    expect(constraintReading(hours, "a", 30).severity).toBe("heavy");
    const closed = constraintReading(hours, "a", 45);
    expect(closed.severity).toBe("closed");
    expect(closed.note).toBe("Counters closed");
  });

  it("says nothing about tasks the constraint doesn't touch", () => {
    expect(constraintReading(building, "z", 10).severity).toBe("none");
  });
});

describe("worsensOverTime", () => {
  it("separates 'go early' constraints from 'go late' ones", () => {
    expect(worsensOverTime(building)).toBe(true);
    expect(worsensOverTime(hours)).toBe(true);
    expect(worsensOverTime(clearing)).toBe(false);
  });
});
