import { describe, expect, it } from "vitest";
import {
  constraintWait,
  hazardReading,
  precedenceViolated,
  worsensOverTime,
  zoneOf,
} from "./constraintState";
import type { HoursConstraint, PrecedenceConstraint, QueueConstraint } from "./types";

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
  affectedTaskIds: ["c", "d"],
  closeAt: 40,
};

const precedence: PrecedenceConstraint = {
  kind: "precedence",
  label: "Iron before you wear it",
  beforeId: "iron",
  afterId: "dress",
  blockedLabel: "Not ironed yet",
};

describe("constraintWait", () => {
  it("leaves untouched tasks alone", () => {
    expect(constraintWait([building], "z", 30)).toBe(0);
    expect(constraintWait([hours], "z", 999)).toBe(0);
  });

  it("looks up whichever hazard, of several, actually touches this task", () => {
    expect(constraintWait([building, hours], "a", 0)).toBe(1);
    expect(constraintWait([building, hours], "c", 41)).toBe(Infinity);
    expect(constraintWait([building, hours], "z", 0)).toBe(0);
  });

  it("grows a building queue, and clamps it at the cap", () => {
    expect(constraintWait([building], "a", 0)).toBe(1);
    expect(constraintWait([building], "a", 20)).toBe(6);
    expect(constraintWait([building], "a", 500)).toBe(12);
  });

  it("clears a clearing queue, and never goes below zero", () => {
    expect(constraintWait([clearing], "a", 0)).toBe(12);
    expect(constraintWait([clearing], "a", 24)).toBe(6);
    expect(constraintWait([clearing], "a", 500)).toBe(0);
  });

  it("makes a closed task unreachable rather than merely slow", () => {
    expect(constraintWait([hours], "c", 39)).toBe(0);
    expect(constraintWait([hours], "c", 40)).toBe(Infinity);
  });

  it("depends only on its arguments — no clock, no state", () => {
    const first = constraintWait([building], "a", 17);
    constraintWait([building], "b", 400);
    expect(constraintWait([building], "a", 17)).toBe(first);
  });
});

describe("precedenceViolated", () => {
  it("is false with no active precedence", () => {
    expect(precedenceViolated(null, ["dress", "iron"])).toBe(false);
  });

  it("is true only when afterId lands before beforeId", () => {
    expect(precedenceViolated(precedence, ["dress", "iron"])).toBe(true);
    expect(precedenceViolated(precedence, ["iron", "dress"])).toBe(false);
  });

  it("is false when either task is absent from this order", () => {
    expect(precedenceViolated(precedence, ["dress", "shower"])).toBe(false);
    expect(precedenceViolated(precedence, ["iron", "shower"])).toBe(false);
  });

  it("depends only on relative order, not position or gaps", () => {
    expect(precedenceViolated(precedence, ["x", "y", "dress", "z", "iron"])).toBe(
      true,
    );
    expect(precedenceViolated(precedence, ["iron", "x", "y", "dress"])).toBe(
      false,
    );
  });
});

describe("zoneOf", () => {
  it("splits cleanly either side of the seam", () => {
    expect(zoneOf(0, 50)).toBe("west");
    expect(zoneOf(49.9, 50)).toBe("west");
    expect(zoneOf(50, 50)).toBe("east");
    expect(zoneOf(100, 50)).toBe("east");
  });
});

describe("hazardReading", () => {
  it("bands a queue so the board can pair a shape with each colour", () => {
    expect(hazardReading([building], "a", 0).severity).toBe("clear");
    expect(hazardReading([building], "a", 12).severity).toBe("building");
    expect(hazardReading([building], "a", 40).severity).toBe("heavy");
  });

  it("warns before a cutoff, then reports it closed", () => {
    expect(hazardReading([hours], "c", 10).severity).toBe("clear");
    expect(hazardReading([hours], "c", 30).severity).toBe("heavy");
    const closed = hazardReading([hours], "c", 45);
    expect(closed.severity).toBe("closed");
    expect(closed.note).toBe("Counters closed");
  });

  it("says nothing about tasks no hazard touches", () => {
    expect(hazardReading([building], "z", 10).severity).toBe("none");
    expect(hazardReading([], "a", 10).severity).toBe("none");
  });

  it("reads whichever of several hazards actually touches the task", () => {
    expect(hazardReading([building, hours], "c", 45).severity).toBe("closed");
    expect(hazardReading([building, hours], "a", 0).severity).toBe("clear");
  });
});

describe("worsensOverTime", () => {
  it("separates 'go early' hazards from 'go late' ones", () => {
    expect(worsensOverTime(building)).toBe(true);
    expect(worsensOverTime(hours)).toBe(true);
    expect(worsensOverTime(clearing)).toBe(false);
  });
});
