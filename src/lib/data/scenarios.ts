import type {
  ConstraintKind,
  FloorKind,
  Place,
  Point,
  Task,
} from "../types";

/**
 * Content, not engine. Adding a seventh scenario is a new entry in this file
 * and nothing else — no change to generate.ts, route.ts, or the renderers.
 *
 * Two rules hold the look together, and both live here rather than in the
 * renderer:
 *
 * 1. Every scenario is laid out as a believable floor plan, not scattered
 *    points. Supermarket departments run round the perimeter with aisles down
 *    the middle; a kitchen's counters line the walls; a high street is two
 *    rows of shopfronts. Getting the plan right is most of what makes a place
 *    read as itself.
 * 2. Every place names a `fixture` — the thing that is actually there. A gym
 *    is treadmills, racks, mats and lockers; a kitchen is a stove, an oven and
 *    a sink. The fixture vocabulary is shared, so a deli counter and a bank
 *    counter are the same prop, but no two scenarios are furnished alike.
 */

export type Scenario = {
  readonly id: string;
  /** What the player is doing, e.g. "Getting Ready". */
  readonly title: string;
  /** Where, e.g. "Home". */
  readonly place: string;
  readonly weekday: boolean;
  readonly weekend: boolean;
  readonly start: Point;
  readonly startLabel: string;
  /** Minutes past midnight, for the displayed clock. */
  readonly startClock: number;
  /** Scales travel time, so a flat feels tighter than a town. */
  readonly travelScale: number;
  /** What the ground is made of. */
  readonly floor: FloorKind;
  readonly queueLabel: string;
  readonly hoursLabel: string;
  readonly hours: { readonly verb: string; readonly closedLabel: string };
  readonly places: readonly Place[];
  readonly tasks: readonly Task[];
  /** The x-coordinate that splits this scenario's floor plan into two zones. */
  readonly zoneSplitX: number;
  /** Plausible causal pairs, real task ids — generation picks at most one. */
  readonly precedencePool: readonly { readonly before: string; readonly after: string }[];
};

type TaskSeed = [
  id: string,
  label: string,
  place: string,
  baseTime: number,
  tags: readonly ConstraintKind[],
];

/** Tasks take their coordinates from their place, so the two can't drift. */
function furnish(places: readonly Place[], seeds: readonly TaskSeed[]): Task[] {
  return seeds.map(([id, label, place, baseTime, tags]) => {
    const home = places.find((candidate) => candidate.name === place);
    if (!home) throw new Error(`task ${id} names an unknown place: ${place}`);
    return { id, label, place, location: home.at, baseTime, tags };
  });
}

// ── Home ──────────────────────────────────────────────────────────────────
// A small flat: front door at the bottom, hallway spine, rooms off it.

const HOME_PLACES: readonly Place[] = [
  { name: "Bathroom", at: { x: 20, y: 24 }, w: 26, h: 22, fixture: "shower" },
  { name: "Bedroom", at: { x: 78, y: 24 }, w: 28, h: 22, fixture: "bed" },
  { name: "Kitchen", at: { x: 20, y: 58 }, w: 26, h: 22, fixture: "stove" },
  { name: "Living room", at: { x: 78, y: 58 }, w: 28, h: 22, fixture: "sofa" },
  { name: "Laundry", at: { x: 20, y: 86 }, w: 22, h: 16, fixture: "washer" },
  { name: "Hallway", at: { x: 56, y: 84 }, w: 16, h: 24, fixture: "wardrobe" },
];

const GETTING_READY: Scenario = {
  id: "getting-ready",
  floor: "wood",
  title: "Getting Ready",
  place: "Home",
  weekday: true,
  weekend: false,
  start: { x: 84, y: 94 },
  startLabel: "Front door",
  startClock: 7 * 60,
  travelScale: 0.55,
  queueLabel: "Bathroom queue",
  hoursLabel: "Hot water",
  hours: { verb: "runs out at", closedLabel: "Hot water gone" },
  places: HOME_PLACES,
  tasks: furnish(HOME_PLACES, [
    ["shower", "Shower", "Bathroom", 9, ["queue", "hours"]],
    ["brush-teeth", "Brush teeth", "Bathroom", 3, ["queue", "hours"]],
    ["get-dressed", "Get dressed", "Bedroom", 6, []],
    ["make-bed", "Make the bed", "Bedroom", 4, []],
    ["breakfast", "Eat breakfast", "Kitchen", 10, ["queue"]],
    ["coffee", "Make coffee", "Kitchen", 5, ["queue"]],
    ["pack-bag", "Pack your bag", "Living room", 5, []],
    ["find-keys", "Find your keys", "Living room", 4, []],
    ["iron-shirt", "Iron a shirt", "Laundry", 7, ["hours"]],
    ["shoes", "Put on shoes", "Hallway", 3, []],
  ]),
  zoneSplitX: 50,
  precedencePool: [{ before: "iron-shirt", after: "get-dressed" }],
};

// ── The Office ────────────────────────────────────────────────────────────
// Reception at the entrance, open-plan desks in the middle, closed rooms
// round the edge.

const OFFICE_PLACES: readonly Place[] = [
  { name: "Meeting room", at: { x: 24, y: 22 }, w: 30, h: 20, fixture: "table" },
  { name: "Manager's office", at: { x: 80, y: 24 }, w: 26, h: 20, fixture: "desk" },
  { name: "Your desk", at: { x: 32, y: 56 }, w: 28, h: 18, fixture: "desk" },
  { name: "Printer bay", at: { x: 62, y: 52 }, w: 16, h: 14, fixture: "printer" },
  { name: "Kitchenette", at: { x: 84, y: 58 }, w: 22, h: 18, fixture: "counter" },
  { name: "Store room", at: { x: 16, y: 84 }, w: 22, h: 16, fixture: "shelving" },
  { name: "Reception", at: { x: 56, y: 86 }, w: 30, h: 16, fixture: "counter" },
];

const WORK_DAY: Scenario = {
  id: "work-day",
  floor: "carpet",
  title: "A Work Day",
  place: "The Office",
  weekday: true,
  weekend: false,
  start: { x: 88, y: 94 },
  startLabel: "The lift",
  startClock: 9 * 60,
  travelScale: 1,
  queueLabel: "Morning rush",
  hoursLabel: "Your manager",
  hours: { verb: "leaves at", closedLabel: "Manager's gone" },
  places: OFFICE_PLACES,
  tasks: furnish(OFFICE_PLACES, [
    ["standup", "Run stand-up", "Meeting room", 12, ["hours"]],
    ["inbox", "Clear the inbox", "Your desk", 10, ["queue"]],
    ["print-reports", "Print the reports", "Printer bay", 6, ["queue"]],
    ["coffee-round", "Do the coffee round", "Kitchenette", 7, ["queue"]],
    ["expenses", "File expenses", "Your desk", 8, ["hours"]],
    ["parcel", "Collect a parcel", "Reception", 4, ["queue"]],
    ["one-on-one", "One-on-one", "Manager's office", 15, ["hours"]],
    ["restock", "Restock supplies", "Store room", 5, []],
    ["book-travel", "Book travel", "Your desk", 6, []],
    ["timesheet", "Get the timesheet signed", "Manager's office", 3, ["hours"]],
  ]),
  zoneSplitX: 50,
  precedencePool: [
    { before: "print-reports", after: "one-on-one" },
    { before: "restock", after: "coffee-round" },
  ],
};

// ── The Gym ───────────────────────────────────────────────────────────────
// Cardio and free weights at the far end, mats in the middle, wet areas by
// the entrance.

const GYM_PLACES: readonly Place[] = [
  { name: "Cardio deck", at: { x: 24, y: 20 }, w: 30, h: 20, fixture: "treadmill" },
  { name: "Free weights", at: { x: 76, y: 22 }, w: 30, h: 22, fixture: "rack" },
  { name: "Cable machines", at: { x: 84, y: 56 }, w: 22, h: 20, fixture: "cables" },
  { name: "Mat area", at: { x: 32, y: 54 }, w: 28, h: 20, fixture: "mat" },
  { name: "Water fountain", at: { x: 58, y: 62 }, w: 12, h: 10, fixture: "fountain" },
  { name: "Locker room", at: { x: 16, y: 82 }, w: 24, h: 18, fixture: "lockers" },
  { name: "Sauna", at: { x: 84, y: 86 }, w: 22, h: 16, fixture: "sauna" },
  { name: "Front desk", at: { x: 52, y: 88 }, w: 26, h: 14, fixture: "counter" },
];

const GYM_SESSION: Scenario = {
  id: "gym-session",
  floor: "rubber",
  title: "A Gym Session",
  place: "The Gym",
  weekday: true,
  weekend: false,
  start: { x: 52, y: 99 },
  startLabel: "Turnstile",
  startClock: 17 * 60 + 30,
  travelScale: 0.8,
  queueLabel: "Peak hour",
  hoursLabel: "Wet area",
  hours: { verb: "shuts at", closedLabel: "Wet area shut" },
  places: GYM_PLACES,
  tasks: furnish(GYM_PLACES, [
    ["warm-up", "Warm up", "Cardio deck", 10, ["queue"]],
    ["squats", "Squat sets", "Free weights", 16, ["queue"]],
    ["bench", "Bench sets", "Free weights", 14, ["queue"]],
    ["cables", "Cable accessories", "Cable machines", 10, ["queue"]],
    ["core", "Core circuit", "Mat area", 8, []],
    ["stretch", "Stretch out", "Mat area", 7, []],
    ["bottle", "Fill your bottle", "Water fountain", 2, []],
    ["shower", "Shower", "Locker room", 9, ["hours"]],
    ["sauna", "Sit in the sauna", "Sauna", 12, ["hours"]],
    ["weigh-in", "Weigh in", "Front desk", 3, ["hours"]],
  ]),
  zoneSplitX: 50,
  precedencePool: [
    { before: "warm-up", after: "squats" },
    { before: "warm-up", after: "bench" },
  ],
};

// ── The Supermarket ───────────────────────────────────────────────────────
// Fresh departments round the perimeter, dry goods down the middle — the way
// supermarkets are actually laid out, so the walk between them is real.

const SHOP_PLACES: readonly Place[] = [
  { name: "Produce", at: { x: 15, y: 30 }, w: 20, h: 30, fixture: "produce" },
  { name: "Bakery", at: { x: 37, y: 15 }, w: 22, h: 14, fixture: "counter" },
  { name: "Deli counter", at: { x: 63, y: 15 }, w: 24, h: 14, fixture: "counter" },
  { name: "Dairy", at: { x: 87, y: 32 }, w: 18, h: 28, fixture: "fridge" },
  { name: "Frozen", at: { x: 87, y: 64 }, w: 18, h: 24, fixture: "fridge" },
  { name: "Household", at: { x: 48, y: 50 }, w: 34, h: 14, fixture: "shelving" },
  { name: "Pharmacy", at: { x: 80, y: 90 }, w: 24, h: 14, fixture: "counter" },
];

const GROCERY_RUN: Scenario = {
  id: "grocery-run",
  floor: "tile",
  title: "A Grocery Run",
  place: "The Supermarket",
  weekday: true,
  weekend: true,
  start: { x: 18, y: 94 },
  startLabel: "Entrance",
  startClock: 17 * 60,
  travelScale: 0.9,
  queueLabel: "Counter queues",
  hoursLabel: "The counters",
  hours: { verb: "close at", closedLabel: "Counters closed" },
  places: SHOP_PLACES,
  tasks: furnish(SHOP_PLACES, [
    ["produce", "Pick up produce", "Produce", 7, ["queue"]],
    ["bread", "Grab bread", "Bakery", 4, ["hours"]],
    ["milk", "Get milk", "Dairy", 5, []],
    ["eggs", "Get eggs", "Dairy", 3, []],
    ["frozen", "Frozen aisle", "Frozen", 5, []],
    ["deli", "Order at the deli", "Deli counter", 8, ["queue", "hours"]],
    ["rotisserie", "Grab a hot chicken", "Deli counter", 3, ["hours"]],
    ["prescription", "Collect a prescription", "Pharmacy", 9, ["queue", "hours"]],
    ["household", "Household aisle", "Household", 6, []],
    ["cleaning", "Cleaning supplies", "Household", 4, []],
  ]),
  zoneSplitX: 50,
  precedencePool: [],
};

// ── The Kitchen ───────────────────────────────────────────────────────────
// Counters along the top wall, sink and pantry on the side walls, table out
// in the room.

const KITCHEN_PLACES: readonly Place[] = [
  { name: "Chopping board", at: { x: 26, y: 18 }, w: 22, h: 14, fixture: "counter" },
  { name: "Stove", at: { x: 50, y: 16 }, w: 20, h: 14, fixture: "stove" },
  { name: "Oven", at: { x: 70, y: 18 }, w: 18, h: 14, fixture: "oven" },
  { name: "Balcony", at: { x: 90, y: 13 }, w: 14, h: 14, fixture: "planter" },
  { name: "Sink", at: { x: 14, y: 46 }, w: 16, h: 20, fixture: "sink" },
  { name: "Pantry", at: { x: 88, y: 48 }, w: 16, h: 22, fixture: "shelving" },
  { name: "Dining table", at: { x: 50, y: 74 }, w: 30, h: 20, fixture: "table" },
];

const COOKING: Scenario = {
  id: "cooking",
  floor: "tile",
  title: "Cooking Dinner",
  place: "The Kitchen",
  weekday: true,
  weekend: true,
  start: { x: 16, y: 92 },
  startLabel: "Kitchen door",
  startClock: 18 * 60,
  travelScale: 0.55,
  queueLabel: "Sharing the stove",
  hoursLabel: "Guests",
  hours: { verb: "arrive at", closedLabel: "Guests are here" },
  places: KITCHEN_PLACES,
  tasks: furnish(KITCHEN_PLACES, [
    ["prep-veg", "Prep the veg", "Chopping board", 9, ["queue"]],
    ["marinate", "Marinate", "Chopping board", 5, ["hours"]],
    ["pasta", "Boil the pasta", "Stove", 12, ["queue"]],
    ["sauce", "Make the sauce", "Stove", 10, ["queue"]],
    ["roast", "Roast a tray", "Oven", 15, ["hours"]],
    ["bread", "Warm the bread", "Oven", 6, ["hours"]],
    ["wash-up", "Wash up as you go", "Sink", 8, ["queue"]],
    ["herbs", "Cut some herbs", "Balcony", 3, ["hours"]],
    ["set-table", "Set the table", "Dining table", 5, []],
    ["spices", "Dig out the spices", "Pantry", 4, []],
  ]),
  zoneSplitX: 40,
  precedencePool: [
    { before: "prep-veg", after: "sauce" },
    { before: "marinate", after: "roast" },
  ],
};

// ── Town ──────────────────────────────────────────────────────────────────
// Two rows of shopfronts either side of a street, car park at the near end.

const TOWN_PLACES: readonly Place[] = [
  { name: "Post office", at: { x: 14, y: 26 }, w: 22, h: 20, fixture: "storefront" },
  { name: "Bank", at: { x: 38, y: 26 }, w: 22, h: 20, fixture: "storefront" },
  { name: "Library", at: { x: 62, y: 26 }, w: 22, h: 20, fixture: "storefront" },
  { name: "Hardware store", at: { x: 86, y: 26 }, w: 22, h: 20, fixture: "storefront" },
  { name: "Café", at: { x: 26, y: 58 }, w: 24, h: 18, fixture: "storefront" },
  { name: "Farmers market", at: { x: 56, y: 58 }, w: 28, h: 18, fixture: "stall" },
  { name: "Dry cleaner", at: { x: 86, y: 58 }, w: 22, h: 18, fixture: "storefront" },
  { name: "Car wash", at: { x: 16, y: 84 }, w: 24, h: 16, fixture: "carwash" },
];

const WEEKEND_ERRANDS: Scenario = {
  id: "weekend-errands",
  floor: "paving",
  title: "Weekend Errands",
  place: "Town",
  weekday: false,
  weekend: true,
  start: { x: 60, y: 92 },
  startLabel: "Car park",
  startClock: 10 * 60,
  travelScale: 1.3,
  queueLabel: "Saturday crowds",
  hoursLabel: "The shops",
  hours: { verb: "close at", closedLabel: "Shops closed" },
  places: TOWN_PLACES,
  tasks: furnish(TOWN_PLACES, [
    ["post-parcel", "Post a parcel", "Post office", 8, ["queue", "hours"]],
    ["hardware", "Hardware run", "Hardware store", 10, ["hours"]],
    ["library", "Return the books", "Library", 5, ["hours"]],
    ["market", "Buy veg at the market", "Farmers market", 9, ["queue"]],
    ["bank", "Sort out the bank", "Bank", 7, ["queue", "hours"]],
    ["coffee", "Sit down for coffee", "Café", 12, ["queue"]],
    ["cake", "Pick up the cake", "Café", 3, ["hours"]],
    ["dry-cleaning", "Collect dry cleaning", "Dry cleaner", 4, ["hours"]],
    ["car-wash", "Wash the car", "Car wash", 11, ["queue"]],
    ["browse", "Browse the stalls", "Farmers market", 6, []],
  ]),
  zoneSplitX: 50,
  precedencePool: [
    { before: "bank", after: "cake" },
    { before: "hardware", after: "car-wash" },
  ],
};

export const SCENARIOS: readonly Scenario[] = [
  GETTING_READY,
  WORK_DAY,
  GYM_SESSION,
  GROCERY_RUN,
  COOKING,
  WEEKEND_ERRANDS,
];

export function scenarioPool(weekend: boolean): readonly Scenario[] {
  return SCENARIOS.filter((s) => (weekend ? s.weekend : s.weekday));
}
