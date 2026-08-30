# Plan

## Premise

**Today's Shift** is a one-a-day ordering puzzle. You get a day's worth of
tasks — a grocery run, a work day, cooking dinner — and one move: drag the
list into the order you want, then commit. The plan plays itself out in an
isometric replay you don't control, against a deadline computed from that
day's own best possible route. Finish every task before the clock runs out and
you made it; run past the deadline, or arrive somewhere after it's closed, and
the shift simply ends. There is no partial credit and no way to intervene once
you've committed — a wrong order is just wrong.

## Features

### The deterministic core — `src/lib/prng.ts`, `src/lib/seed.ts`

A mulberry32 PRNG seeded from the calendar date. Everyone playing on the same
local date gets the same shift, forever, with no backend. Weeks bucket on a
Monday so a whole week varies together without any day needing yesterday's
state — skipping a day never breaks the sequence.

**Done when:** `src/lib/seed.test.ts` and `prng.test.ts` pass — same date gives
the same seed regardless of time of day, adjacent days differ, and a week's
seven shift seeds are all distinct.

### Six scenarios of content — `src/lib/data/scenarios.ts`

Getting Ready, A Work Day, A Gym Session, A Grocery Run, Cooking Dinner,
Weekend Errands. Each is a pool of ten tasks with locations, base times, and
tags saying which constraints can touch them, plus a weekday/weekend flag.
Adding a seventh is an entry in this file and nothing else.

**Done when:** `src/lib/generate.test.ts` passes — every scenario has enough
tasks to sample from and at least three each of both constraint kinds; a
month of generated days reaches four or more distinct scenarios and never
draws a weekday scenario on a weekend.

### The route solver and the computed deadline — `src/lib/route.ts`

Brute-force every ordering (≤6 tasks, so ≤720), take the best, multiply by a
fixed ×1.2 margin. The deadline is derived from the day rather than authored,
so it's tight but always achievable. Generation then keeps nudging the
constraint until the day is *also* genuinely losable.

**Done when:** `src/lib/route.test.ts` passes — this is the spec's one game
rule under a focused automated test. Across 120 generated shifts, the best
possible order always meets the deadline and at least one order always misses
it, and the median day has ≥20% of its orderings failing.

### Constraints as pure functions — `src/lib/constraintState.ts`

One constraint per day: a queue that builds (go early) or clears (go late), or
a cutoff after which affected tasks are unreachable. Wait is a pure function of
`(constraint, task, simulated minute)` — no wall clock anywhere — so the
solver and the replay are guaranteed to agree.

**Done when:** `src/lib/constraintState.test.ts` passes, and `route.test.ts`
asserts every replayed step's wait equals `constraintWait` at that arrival.

### Drag-to-reorder — `src/game/TaskList.ts`

Pointer Events, not HTML5 drag-and-drop, which has no usable touch story.
Cards lift, siblings slide out of the way, the dropped card settles. Arrow
keys move a focused card as a keyboard equivalent.

**Done when:** manual browser pass at both marking viewports — mouse drag at
1920×1080 and touch drag at 390×844 — both reorder the list and renumber the
markers in the scene. *(Done 2026-08-30: verified in Chromium at both sizes.)*

### Each place looks like itself — `src/game/fixtures.ts`, `src/game/iso.ts`

Every place names a fixture from a shared vocabulary — counter, shelving,
fridge, stove, treadmill, rack, lockers, storefront and so on — drawn as an
isometric prop from the primitives in `iso.ts`. Layouts are believable plans
(perimeter
departments in the supermarket, counters along the kitchen walls, two rows of
shopfronts in town) rather than scattered points.

Props are authored vector, not sprite art. That is a deliberate call and the
alternative was researched first: no CC0 2D isometric interior art exists for
gyms, supermarkets or offices, and the CC0 isometric tilesets that do exist
are 2:1 dimetric, which cannot be mixed with true 30° geometry. Vector also
follows the light/dark palette, which baked-in sprite colours cannot.

Props carry materials rather than shapes — wood, steel, enamel, glass, rubber,
fabric, brick, terracotta — so colour is what tells a gym from a kitchen. Draw
order is derived from the geometry, never from authoring order.

**Done when:**
- `src/game/iso.test.ts` passes — the occlusion test and the four ordering
  regressions that actually shipped (desk legs over the desktop, a splashback
  in front of its own hob, a screen under its stand, a worktop under its
  cabinet).
- `src/game/fixtures.test.ts` passes — every fixture is at least eight parts,
  no two render identically, and no prop has a part drawn in front of one that
  hides it, checked at every footprint the scenarios use.
- `src/game/materials.test.ts` passes — it reads `global.css` and fails if a
  material a prop names sets no `--tone`, `fill` or `stroke`. The black
  produce discs were this bug.
- `fixtures.test.ts` also fails on any part sealed inside another — the bug
  that had shelving and fridges hiding their own stock.
- Manual browser pass: a stranger can tell a gym from a kitchen from a
  supermarket with the labels covered, in both themes.
  *(Done 2026-08-30: checked in light and dark at 1440×900.)*

### One camera — `src/game/Scene.ts`

Planning and playback are the same isometric room, built as a diorama: a floor
with a real material, two back walls, a skirting. Planning overlays numbered
markers and a dashed route that redraws on every reorder; playback hides them
and walks the character through, driven by the simulated clock and a few
seconds long whatever the shift's simulated length.

There was a second, top-down floor-plan view for planning. It was cut: a
second abstract rendering of the same world asked the player to learn two
languages for one place, and the numbered markers already do the job of
mapping the task list onto the room.

Each place also carries a small name tag (visible in every phase, not just
planning) — subtle by design. It anchors on the prop's own position
(`place.at`), not on the place's declared `w`/`h` footprint: the footprint is
layout spacing between rooms, unrelated to how big the prop drawn inside it
actually is, and anchoring there first shipped tags that landed nowhere near
their own object (sometimes closer to a neighbour's). It's also positioned
defensively against the markers: checked against every marker's actual screen
reach and pushed clear, or omitted entirely rather than drawn overlapped, if a
room is too crowded to fit it cleanly.

**Done when:** manual browser pass — a full shift plays to a win and to a
loss, the active place highlights as the character reaches it, the replay
stops dead at the deadline or at a closed task, no marker is hidden behind a
prop, every place name sits over its own object rather than a neighbour's, and
every place name is either clear of every marker or not drawn at all — never
overlapped. Verified with a scripted DOM sweep (bounding-box overlap between
every `.place-label` and every marker part) across 40 random shifts, not by
eyeballing a handful of screenshots.
*(Done 2026-08-30.)*

### First attempt is the score — `src/lib/stats.ts`

Today's Shift records only the first attempt each day, at commit rather than
at the end of playback, so closing the tab mid-run isn't a way to dodge a
loss. Retries are encouraged and visibly labelled "practice — not counted".
Random Shift never touches the record at all. All storage access is wrapped —
a private window still plays, it just isn't tracked.

**Done when:** `src/lib/stats.ts` guards every read and write, and a manual
pass confirms a second run of the same day shows "practice — not counted"
while the first shows "recorded". *(Done 2026-08-30.)*

### No instructions anywhere

The game has to teach itself: the numbered cards, the route line that follows
your drags, the two clocks, and one plain sentence about the day's constraint.

**Done when:** `spec/game.test.ts` passes against the built site — no
how-to-play, instructions or tutorial text, and no dialog standing in for one.

## Still to do

- Playtest cold with people who haven't seen it, at both marking viewports,
  and make at least one change driven by what's observed rather than by
  re-reading the code.
- `PROCESS.md` and `reflections/crit-5.md` before `pnpm check:evidence` can
  pass.
