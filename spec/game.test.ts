import { readdirSync, readFileSync } from "node:fs";
import { join, relative, resolve, sep } from "node:path";
import { JSDOM } from "jsdom";
import { describe, expect, it } from "vitest";

// This week's contract (crit 5, "A game"): the game teaches itself, with no
// instructions anywhere, on screen or off. That's testable against what
// actually shipped; whether a stranger reaches an ending inside five minutes
// isn't, and stays a crit judgement. Runs against the BUILT site, same as
// spec/invariants.test.ts — run `pnpm build` first.
const DIST = resolve("dist");

function files(dir: string = DIST): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    return entry.isDirectory() ? files(path) : [path];
  });
}

const pages = files()
  .map((path) => relative(DIST, path).split(sep).join("/"))
  .filter((name) => name.endsWith(".html"))
  .map((name) => ({
    name,
    doc: new JSDOM(readFileSync(join(DIST, name), "utf8")).window.document,
  }));

// No how-to-play modal, no instructions page, nothing standing in for either.
const NO_TUTORIAL_PATTERN = /how\s*to\s*play|instructions|tutorial/i;

describe("crit 5: no instructions anywhere", () => {
  for (const { name, doc } of pages) {
    it(`${name} names no how-to-play, instructions, or tutorial`, () => {
      expect(doc.body.textContent ?? "").not.toMatch(NO_TUTORIAL_PATTERN);
    });

    it(`${name} has no dialog or modal element standing in for a tutorial`, () => {
      expect(doc.querySelector("dialog, [role='dialog']")).toBeNull();
    });
  }
});

// TODO (yours to write once the game exists):
// - "it can be lost: a wrong move is possible, and play ends somewhere — a
//   win, a loss or a finish" — the spec asks for one rule under a focused
//   automated test. Pick the rule that's the clearest claim about your game
//   (e.g. "three misses ends the round") and test it directly against your
//   game logic, not the DOM.
// - "a stranger can pick it up and reach an ending inside five minutes" is a
//   crit judgement, not a test — your pod plays it cold.
