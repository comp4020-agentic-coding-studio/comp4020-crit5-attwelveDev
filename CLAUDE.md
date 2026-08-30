# COMP4020 prototype

This is your starter repo for a COMP4020 prototype: a static site written in
HTML/CSS/TypeScript that builds to plain HTML/CSS/JS and deploys to GitHub
Pages. The **deployed site is what gets marked** --- not this repo, and not "it
works on my machine". It's marked live in Chrome against the deployed URL at two
viewports --- 1920×1080 (desktop) and 390×844 (phone) --- and both count in
full, so make that artefact good at both and use the checks below to know
whether it is.

What you're building this week — the spec — is published on the course website,
and this repo's name tells you which deliverable it is. Run the course plugin's
**start** skill at the start of each week: it pulls the right spec from the
course API, carries your harness forward from last week, and helps you turn the
spec's checkable lines into tests of your own. Read the spec before you build,
and see `spec/README.md` for how the checks in this repo relate to it.

## How to work in here

- Keep the dev server running (`pnpm dev`) so you see changes as you make them.
- Before you push, run `pnpm check`. It runs most of what CI runs --- build,
  lint, and the spec --- so you catch those in seconds instead of waiting for
  the pipeline. The links check, the evidence check, the secrets scan, and the
  deploy itself only run in CI; run `pnpm dlx linkinator ./dist --silent`
  locally against a fresh `pnpm build` for the links check without waiting for
  CI.
- To see what the page actually looks like rather than what you assume it looks
  like, open it in a browser (the `agent-browser` CLI, documented on
  [the course site](https://comp.anu.edu.au/courses/comp4020-agentic-coding-studio/topics/backpressure/#agent-browser-the-rendered-page-as-ground-truth),
  works well for this). The rendered page is the truth; your mental model of it
  isn't.
- When a check fails, read its output before changing anything. Each check below
  names what it measures, and the failure message is the instruction: it tells
  you the file, the line, or the contract. Treat a red check as authoritative
  --- the page is wrong until the check is green, not until you decide it should
  be.
- Keep `PLAN.md` current. Before building a feature, write or update its
  entry in `PLAN.md` --- what it does, why, and what "done" looks like --- and
  name the check that will prove it: a `spec/*.test.ts` assertion, a
  co-located unit test, or (for things a test can't reach, like an animation
  or a layout at a marking viewport) an explicit manual browser pass. A
  feature with no corresponding check in `PLAN.md` isn't planned yet, it's
  just started. Update the plan as you build, not just before --- if reality
  disagrees with what's written, the file is wrong, not the code.
- Commit when the checks pass. Never commit a red state.

## The link-preview card

`public/card.png` (1200x630) is the image a shared link shows; the page head
(in `src/pages/index.astro`, or any page you add) points at it. Replace it and
the `description` meta, and copy the head block into any new page. The card URL
resolves against the page that names it, like any link --- `./card.png` is
wrong one directory down, and nothing in CI checks it, so look at the deployed
head when you add pages.

## The checks (your sensors)

CI runs these on every push once your repo is public. GitHub's checks UI shows
two jobs, `check` and `deploy` --- not one status per sensor below --- and
within `check` the steps run in sequence (`pnpm check` chains typecheck, build,
lint, and the spec with `&&`), so an early failure like a broken build stops the
later sensors from running for that push; fix it and push again to see the rest.
While the repo is private (all week, until you ship) the CI jobs stay skipped
--- `pnpm check` is the same roster on your machine, and it's the faster loop
anyway. They aren't hoops. Each is a different way of finding out something true
about the site that you can't reliably see by looking at it.

They also carry a mark at a crit: the sweep runs fifteen minutes after your
cutoff, and green checks there are worth half that week's shipped mark. Still
running counts as not green, so ship with time for CI to finish.

- **typecheck** --- `tsc --noEmit` runs first in `pnpm check`, so a type error
  stops the roster before the build even starts. The types are extra
  backpressure: a red here is the compiler telling you a claim in the code is
  false.
- **build** --- the site must build (`pnpm build`). A build failure means the
  deployed site is broken or stale, so nothing else matters until this is green.
- **deploy / online** --- the live GitHub Pages URL must load and return the
  page you expect. An asset that 404s on the deployed URL counts as broken even
  if it loads locally.
- **spec** --- `spec/invariants.test.ts` asserts what's true of any good
  website, whatever the week's brief asks; the tests you write for the week's
  own spec run alongside it (any `spec/*.test.ts`). A failure names the contract
  you haven't met yet.
- **lint** --- `stylelint` for CSS, `oxlint` for TypeScript. Flags code that's
  wrong, fragile, or non-idiomatic. Read the rule it names.
- **tests** --- any other tests you write, wherever you put them (co-located
  with your source is fine, not just `spec/`), must pass. Vitest picks up both
  this and the spec suite in one `vitest run`, the last step of `pnpm check`. A
  failing test is a claim about the site that's no longer true.
- **evidence** (`pnpm check:evidence`) --- checks your process evidence:
  `PROCESS.md`'s citations resolve to real commits, the current deliverable's
  exact reflection is in `reflections/` (worked out from this repo's name
  against the public course API), and your `CLAUDE.md` is present. Evidence
  gates the deploy --- `deploy` needs `check` to pass, so failing evidence
  blocks the deploy alongside everything else. See
  [Your process is part of the mark](#your-process-is-part-of-the-mark) below,
  and the course website's
  [assessment page](https://comp.anu.edu.au/courses/comp4020-agentic-coding-studio/topics/assessment/#what-you-submit)
  for what counts as evidence.
- **links** --- internal links must resolve. A broken link is a dead end you
  didn't mean to ship.
- **secrets** --- the repo is scanned for committed credentials. Never put a
  key, token, or password in a tracked file. If one leaks, rotate it. A local
  pre-commit hook (`.githooks/pre-commit`, installed by `pnpm install`) also
  blocks any commit containing something shaped like an API key --- by the time
  CI sees a key it's already pushed, so the hook is the sensor that matters.

Nothing here measures **accessibility** or **performance** --- wiring those
sensors (`axe-core`, Lighthouse, or whatever you choose) is your work, and later
in the course the spec will ask you to show how you tested both. When you do,
read a green performance result honestly: it's a lab estimate from one run on a
CI machine, not proof the site is fast for real users.

## The stack is swappable

Out of the box this is plain HTML/CSS/TypeScript on Vite, and every `.html` file
in the repo is a page: add pages, link them, and the build picks them up with no
config. That's a default, not a rule (unless the week's spec says otherwise).
You can swap in Astro or any other static generator, because nothing in CI names
a tool --- the whole contract is:

- `pnpm build` emits the complete site into `dist/`
- the `package.json` scripts (`check`, `check:evidence`, `build`) keep working
- whatever lands in `dist/` still passes the invariants in `spec/`

Two things bite in a swap. The deployed site lives under a path
(`…github.io/<repo>/`), so configure your generator's base path --- this
template's Vite config uses relative asset URLs to sidestep that, but most
generators (Astro included) need `base` set explicitly, and getting it wrong
looks fine locally while every asset 404s on the live URL. And commit the
updated `pnpm-lock.yaml`: CI installs with `--frozen-lockfile`.

This repo carries the Astro setup forward again this week (kept deliberately
across the audio instrument and this game) --- the base-path and lockfile
points above already apply. The prototype source underneath it is new: this
week's game doesn't reuse last week's audio engine, gesture tracking, or
instrument UI.

## Your process is part of the mark

The deployed page is only half of it. How you got there is marked too: your
commit history, your agent files, and the decisions visible across them. The
checks above can't see any of that, so a person reads it directly --- which
means building legibly is part of building well.

- **Commit as you go.** Small, frequent commits are the record of how the work
  came together, and that record is read, not just the final state. A trail that
  grew alongside the code is the strongest evidence of your process; a single
  dump the night before is the weakest.
- **Keep a process overview** (`PROCESS.md`). A short reading-guide, not an
  essay: what you built, the moments that mattered --- each pointing at a
  commit, a `CLAUDE.md` change, or a prompt and the commit it produced --- and
  where to look in the history. It points a marker at the evidence; it doesn't
  stand in for it, and claims the history doesn't back don't count. The
  `PROCESS.md` in this repo is a template showing the shape and the citation
  format (link text the commit hash or range, target the commit or compare URL);
  `pnpm check:evidence` verifies your citations resolve to real commits before
  you ship. Markers follow those citations and don't trawl the repo for evidence
  you didn't cite.
- **Write your reflection in `reflections/`** --- a short markdown file in this
  repo, named for the deliverable it answers, so the number in the filename is
  the number in this repo's name (`crit-1.md` in `comp4020-crit1-<you>`,
  `assignment-1.md` in `comp4020-ass1-<you>`); `reflections/README.md` has the
  full rule. `pnpm check:evidence` checks the exact current name against the
  course API, not merely the presence of any well-named file. It answers the two
  standing prompts: the breakthrough that moved the work forward, and what this
  work changed about the developer you want to be. It stays out of the deployed
  site. It's due at the cutoff, and if it isn't in the repo by then the week
  doesn't count as shipped, however good the prototype is.
- **This file is process evidence.** The harness you build to direct the agent,
  this `CLAUDE.md` and any `AGENTS.md`, is itself read as part of how you
  worked. Keep it honest and current (see below).

You don't need a name, a student number, or any identity file in the repo: we
know whose repo it is. Spend the effort on the work.

## Facts about this stack that are easy to get wrong

Things that have already cost time here. Add to this list rather than
rediscovering them.

- **Astro needs `base` set explicitly** (`astro.config.mjs`), and Astro 7's
  `astro dev` daemonises: the CLI returns immediately and the server keeps
  running. Use `astro dev status` / `logs` / `stop`. The dev URL includes the
  base path — the bare root 404s.

## Game design

This week's prototype is "Today's Shift" — a deterministic, date-seeded
task-ordering puzzle. Decisions here won't be re-derivable from the code
alone, so they're written down rather than left implicit:

- **One mechanic, two phases.** The only player action is dragging a task
  list into order and committing it. Planning is a top-down directory-board
  view (all tasks, locations, live constraint state visible — diegetically a
  map the character would plausibly carry, not omniscience). Playback is a
  non-interactive, snappy isometric replay of the committed order. No direct
  movement or camera control at any point, in either phase.
- **Deterministic by seed, not by server.** A mulberry32 PRNG seeded from the
  calendar date drives every day's scenario, task selection, and constraint
  parameters. Same date, same shift, everywhere, forever — no backend, no
  drift. Random Shift seeds independently (`Date.now()`) and never touches
  Today's Shift's recorded stats.
- **The deadline is computed, not authored.** Brute-force the optimal task
  ordering (feasible at ≤6 tasks), multiply by a fixed margin (×1.2). Tight
  but always achievable by construction — this is also the game's one
  formally tested rule (`src/lib/route.test.ts`: the optimal ordering always
  meets the deadline it produced).
- **Loss is clean, not partial.** Exceeding the deadline ends the shift. No
  partial credit, no "almost." A wrong order is just wrong.
- **First attempt is the score; everything after is practice.** Today's
  Shift's first attempt each day is what's recorded and shareable. Retries
  are encouraged (especially right after a loss) but are visibly labelled
  "practice — not counted," so a retry is never mistaken for the real score.
- **Premium execution of a deliberately simple art style.** Lo-fi/low-poly is
  an aesthetic choice, not a budget constraint: flat-shaded polygons and a
  restrained palette, but with a consistent stroke weight, considered
  typography, eased motion (nothing snaps into place with a raw jump-cut),
  and small satisfying feedback on every interaction (drag lift, commit
  confirmation, win/loss reveal). Craft shows in consistency and restraint,
  not in additional visual complexity.
- **Every place looks like the place it is.** A gym is treadmills, racks, mats
  and lockers; a kitchen is a stove, an oven and a sink; a supermarket is
  produce bins, a deli counter and freezer cabinets. Generic boxes with names
  floating over them are not acceptable — if you can swap two scenarios'
  artwork without noticing, the art has failed. This is enforced by data:
  every entry in `Scenario.places` names a `fixture` from the shared
  vocabulary in `types.ts`, and `game/fixtures.ts` draws it.
- **Layouts are believable floor plans, not scattered points.** Supermarket
  departments run round the perimeter with dry goods down the middle; kitchen
  counters line the walls; a high street is two rows of shopfronts. Getting
  the plan right is most of what makes a place read as itself, and it's free —
  it's just coordinates.
- **One camera, not two.** Planning and playback are the same isometric room.
  Planning adds numbered markers and a dashed route; playback swaps them for
  the character walking it. There was once a separate top-down floor-plan view
  for planning, and it was cut: a second, abstract rendering of the same world
  asked the player to learn two languages for one place and taught them
  nothing the numbered markers don't. Do not reintroduce it.
- **The target look is a cosy isometric pixel diorama** — the small furnished
  rooms that circulate as pixel art: a room you could point at and name every
  object in. Concretely, that means all of:
  - **A room shell.** A floor plus two back walls and a skirting where they
    meet. Furniture floating on a void reads as a diagram; the same furniture
    inside a shell reads as a place.
  - **Floors are a material, not a fill.** Every scenario picks a `FloorKind`
    and the ground is drawn with real geometry — staggered floorboards at
    home, a tile grid in the supermarket, nap in the office, paving in town.
    Drawn as lines rather than an SVG pattern on purpose: a screen-space
    pattern doesn't line up with the isometric grid, and a floor that
    disagrees with what's standing on it reads as a bug.
  - **Colour on everything.** The references have no grey filler — timber,
    enamel, glass, steel, fabric, brick, terracotta, produce. Untinted
    geometry is the failure state.
  - **Density.** Small objects are what sell it: stock on shelves, plates on
    the bar, produce in crates, a mug on the desk, foliage in the planter. If
    a prop looks bare, it needs more things in it, not bigger shapes.
  - **Markers are UI, scenery is not.** Numbered markers are drawn above every
    prop, the route below them on the floor. A shelf that hides the number
    telling you when to visit it is a bug.
- **One light source, declared once.** Isometric props are built only from the
  primitives in `game/iso.ts`, and a prop picks a material; the three faces
  derive from its `--tone` in CSS. Never shade a face by hand and never add a
  second light direction — that consistency is what makes flat polygons read
  as a deliberate style rather than as clip art.
- **Materials, not shapes.** Every part names a material — `t-wood`,
  `t-steel`, `t-enamel`, `t-glass`, `t-rubber`, `t-fabric`, `t-brick`,
  `t-locker`, `t-terracotta`, the crop colours — and materials carry colour.
  Untinted geometry is the failure mode this whole section exists to prevent:
  a fridge is cold white behind glass, a sauna is warm timber, a rack is steel
  with red plates. If two fixtures come out the same colour, one of them has
  picked the wrong material. `materials.test.ts` reads the real stylesheet and
  fails if a class a prop names sets no `--tone`, no `fill`, or no `stroke`
  — a tone-only class leaves a disc rendering solid black.
- **Detail is what separates a thing from a diagram.** Handles, seams, control
  fascias, stock on the shelves, plates on the bar, produce in the crates,
  mullions in the glass. Every prop is at least eight parts and
  `fixtures.test.ts` holds that floor, along with "no two fixtures render
  identically". Four flat boxes is a PowerPoint slide, and that is the bar
  this game has already failed once.
- **Model what a thing is, not what it looks like from here.** Three rules,
  each of which shipped broken first:
  - **Contents go in front of their container.** Shelving and fridges were
    solid carcasses with the stock modelled *inside*, so the goods clumped
    into whichever corner the sort happened to expose. Both are now open —
    back panel, end posts, shelves, stock in front of them, glass over the
    top. `fixtures.test.ts` fails on any part sealed inside another.
  - **Details sit on faces, never at centres.** A handle, seam or control
    screen placed at a solid's centre is inside it. Put it on the face
    (`y + d / 2`), or just clear of it. Four props had details buried this way.
  - **`seat(x, y, size, back)` takes the side the backrest is on**, not the
    direction the sitter faces. Inverting it put every chair's back against
    the table it was pulled up to.
- **Never trust authoring order.** `iso.ts` returns each primitive with its
  bounding box and `render` sorts by the standard isometric occlusion test
  (`b` hides `a` only if it is wholly beyond it along one axis). Authoring
  order shipped desk legs painted over the desktop they hold up, a cooker's
  splashback floating in front of its own hob, and a weight stack detached
  from its frame. `iso.test.ts` is those exact regressions, and
  `fixtures.test.ts` re-checks the ordering for every fixture at every
  footprint the scenarios give it. If the sort ever has to fall back — which
  it does only for genuinely interpenetrating geometry — fix the model, don't
  reorder the code.
- **Authored vector, not sprite art — and here's why.** The palette is a set
  of custom properties that swap wholesale between light and dark themes, and
  baked-in sprite colours can't follow that. It also survives both marking
  viewports without resampling. Free CC0 art was investigated properly before
  this was settled: Kenney's packs (all CC0) have no gym, office, supermarket
  or kitchen *interior* art in 2D at any projection; his Furniture Kit ships
  isometric renders but its angle is undocumented; the CC0 isometric tilesets
  that do exist (Screaming Brain, Kenney's Isometric Miniature series) are 2:1
  dimetric and so cannot be mixed with true 30° geometry. The one third-party
  asset worth taking is the display typeface.
- **The pixel face is a display face, and never carries a number.** Pixelify
  Sans (OFL, self-hosted in `public/fonts/` with its licence) sets the wordmark,
  headings, the verdict and the commit button. It does not set clocks, task
  numbers or map pins: at those sizes its 2, 3, 5 and 8 are indistinguishable,
  and it rendered a HUD clock reading `18:31` as `17:88`. Lo-fi is a look the
  game wears, not a tax it charges the player for reading.
- **Scenario variety is a content problem, not an engine problem.** New
  scenarios are new entries in `src/lib/data/scenarios.ts` (a task pool +
  weekday/weekend flag), never new engine code. Starting six: Getting Ready,
  Work Day, Gym Session, Grocery Run, Cooking (weekday pool, plus Grocery Run
  and Cooking again on weekends), and Weekend Errands (weekend-only) — this
  is the deliberate lever for keeping the puzzle feeling different day to day
  without touching `route.ts`, `generate.ts`, or the renderer.

## This file is yours

This CLAUDE.md is a starting point, not a fixed rulebook. As you learn what your
prototype needs --- a convention to hold the agent to, a sensor that keeps
catching you out, a fact about the stack the agent keeps getting wrong --- write
it down here. Growing this file is the work of harness engineering, and the gap
between this boilerplate and your own version is part of what your prototype
says about the developer you're becoming.
