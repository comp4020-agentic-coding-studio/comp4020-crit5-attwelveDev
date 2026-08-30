import type { Point, Task } from "../types";

/**
 * Content, not engine. Adding a seventh scenario is a new entry in this file
 * and nothing else — no change to generate.ts, route.ts, or the renderer.
 * That's deliberate: variety is the lever that keeps Today's Shift feeling
 * different day to day, so it has to stay cheap to pull.
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
  readonly travelScale: number;
  readonly queueLabel: string;
  readonly hours: { readonly verb: string; readonly closedLabel: string };
  readonly hoursLabel: string;
  readonly tasks: readonly Task[];
};

const GETTING_READY: Scenario = {
  id: "getting-ready",
  title: "Getting Ready",
  place: "Home",
  weekday: true,
  weekend: false,
  start: { x: 50, y: 92 },
  startLabel: "Hallway",
  startClock: 7 * 60,
  travelScale: 0.5,
  queueLabel: "Bathroom queue",
  hoursLabel: "Hot water",
  hours: { verb: "runs out at", closedLabel: "Hot water gone" },
  tasks: [
    { id: "shower", label: "Shower", place: "Bathroom", location: { x: 18, y: 20 }, baseTime: 9, tags: ["queue", "hours"] },
    { id: "brush-teeth", label: "Brush teeth", place: "Bathroom", location: { x: 18, y: 20 }, baseTime: 3, tags: ["queue", "hours"] },
    { id: "get-dressed", label: "Get dressed", place: "Bedroom", location: { x: 72, y: 16 }, baseTime: 6, tags: [] },
    { id: "make-bed", label: "Make the bed", place: "Bedroom", location: { x: 72, y: 16 }, baseTime: 4, tags: [] },
    { id: "breakfast", label: "Eat breakfast", place: "Kitchen", location: { x: 20, y: 68 }, baseTime: 10, tags: ["queue"] },
    { id: "coffee", label: "Make coffee", place: "Kitchen", location: { x: 20, y: 68 }, baseTime: 5, tags: ["queue"] },
    { id: "pack-bag", label: "Pack your bag", place: "Living room", location: { x: 70, y: 64 }, baseTime: 5, tags: [] },
    { id: "find-keys", label: "Find your keys", place: "Living room", location: { x: 70, y: 64 }, baseTime: 4, tags: [] },
    { id: "iron-shirt", label: "Iron a shirt", place: "Laundry", location: { x: 90, y: 40 }, baseTime: 7, tags: ["hours"] },
    { id: "shoes", label: "Put on shoes", place: "Hallway", location: { x: 50, y: 92 }, baseTime: 3, tags: [] },
  ],
};

const WORK_DAY: Scenario = {
  id: "work-day",
  title: "A Work Day",
  place: "The Office",
  weekday: true,
  weekend: false,
  start: { x: 50, y: 94 },
  startLabel: "Reception",
  startClock: 9 * 60,
  travelScale: 1,
  queueLabel: "Morning rush",
  hoursLabel: "Your manager",
  hours: { verb: "leaves at", closedLabel: "Manager's gone" },
  tasks: [
    { id: "standup", label: "Run stand-up", place: "Meeting room", location: { x: 75, y: 24 }, baseTime: 12, tags: ["hours"] },
    { id: "inbox", label: "Clear the inbox", place: "Your desk", location: { x: 30, y: 54 }, baseTime: 10, tags: ["queue"] },
    { id: "print-reports", label: "Print the reports", place: "Printer bay", location: { x: 55, y: 42 }, baseTime: 6, tags: ["queue"] },
    { id: "coffee-round", label: "Do the coffee round", place: "Kitchenette", location: { x: 18, y: 20 }, baseTime: 7, tags: ["queue"] },
    { id: "expenses", label: "File expenses", place: "Your desk", location: { x: 30, y: 54 }, baseTime: 8, tags: ["hours"] },
    { id: "parcel", label: "Collect a parcel", place: "Reception", location: { x: 50, y: 94 }, baseTime: 4, tags: ["queue"] },
    { id: "one-on-one", label: "One-on-one", place: "Manager's office", location: { x: 85, y: 62 }, baseTime: 15, tags: ["hours"] },
    { id: "restock", label: "Restock supplies", place: "Store room", location: { x: 14, y: 84 }, baseTime: 5, tags: [] },
    { id: "book-travel", label: "Book travel", place: "Your desk", location: { x: 30, y: 54 }, baseTime: 6, tags: [] },
    { id: "timesheet", label: "Get the timesheet signed", place: "Manager's office", location: { x: 85, y: 62 }, baseTime: 3, tags: ["hours"] },
  ],
};

const GYM_SESSION: Scenario = {
  id: "gym-session",
  title: "A Gym Session",
  place: "The Gym",
  weekday: true,
  weekend: false,
  start: { x: 50, y: 94 },
  startLabel: "Front desk",
  startClock: 17 * 60 + 30,
  travelScale: 0.8,
  queueLabel: "Peak hour",
  hoursLabel: "Wet area",
  hours: { verb: "shuts at", closedLabel: "Wet area shut" },
  tasks: [
    { id: "warm-up", label: "Warm up", place: "Cardio deck", location: { x: 22, y: 22 }, baseTime: 10, tags: ["queue"] },
    { id: "squats", label: "Squat sets", place: "Free weights", location: { x: 72, y: 28 }, baseTime: 16, tags: ["queue"] },
    { id: "bench", label: "Bench sets", place: "Free weights", location: { x: 72, y: 28 }, baseTime: 14, tags: ["queue"] },
    { id: "cables", label: "Cable accessories", place: "Cable machines", location: { x: 78, y: 60 }, baseTime: 10, tags: ["queue"] },
    { id: "core", label: "Core circuit", place: "Mat area", location: { x: 26, y: 62 }, baseTime: 8, tags: [] },
    { id: "stretch", label: "Stretch out", place: "Mat area", location: { x: 26, y: 62 }, baseTime: 7, tags: [] },
    { id: "bottle", label: "Fill your bottle", place: "Water fountain", location: { x: 50, y: 48 }, baseTime: 2, tags: [] },
    { id: "shower", label: "Shower", place: "Locker room", location: { x: 14, y: 86 }, baseTime: 9, tags: ["hours"] },
    { id: "sauna", label: "Sit in the sauna", place: "Sauna", location: { x: 88, y: 86 }, baseTime: 12, tags: ["hours"] },
    { id: "weigh-in", label: "Weigh in", place: "Front desk", location: { x: 50, y: 94 }, baseTime: 3, tags: ["hours"] },
  ],
};

const GROCERY_RUN: Scenario = {
  id: "grocery-run",
  title: "A Grocery Run",
  place: "The Supermarket",
  weekday: true,
  weekend: true,
  start: { x: 50, y: 94 },
  startLabel: "Entrance",
  startClock: 17 * 60,
  travelScale: 0.9,
  queueLabel: "Counter queues",
  hoursLabel: "The counters",
  hours: { verb: "close at", closedLabel: "Counters closed" },
  tasks: [
    { id: "produce", label: "Pick up produce", place: "Produce", location: { x: 20, y: 22 }, baseTime: 7, tags: ["queue"] },
    { id: "bread", label: "Grab bread", place: "Bakery", location: { x: 48, y: 18 }, baseTime: 4, tags: ["hours"] },
    { id: "milk", label: "Get milk", place: "Dairy", location: { x: 78, y: 24 }, baseTime: 5, tags: [] },
    { id: "eggs", label: "Get eggs", place: "Dairy", location: { x: 78, y: 24 }, baseTime: 3, tags: [] },
    { id: "frozen", label: "Frozen aisle", place: "Frozen", location: { x: 82, y: 52 }, baseTime: 5, tags: [] },
    { id: "deli", label: "Order at the deli", place: "Deli counter", location: { x: 20, y: 52 }, baseTime: 8, tags: ["queue", "hours"] },
    { id: "rotisserie", label: "Grab a hot chicken", place: "Deli counter", location: { x: 20, y: 52 }, baseTime: 3, tags: ["hours"] },
    { id: "prescription", label: "Collect a prescription", place: "Pharmacy", location: { x: 84, y: 80 }, baseTime: 9, tags: ["queue", "hours"] },
    { id: "household", label: "Household aisle", place: "Household", location: { x: 48, y: 58 }, baseTime: 6, tags: [] },
    { id: "cleaning", label: "Cleaning supplies", place: "Household", location: { x: 48, y: 58 }, baseTime: 4, tags: [] },
  ],
};

const COOKING: Scenario = {
  id: "cooking",
  title: "Cooking Dinner",
  place: "The Kitchen",
  weekday: true,
  weekend: true,
  start: { x: 50, y: 94 },
  startLabel: "Kitchen door",
  startClock: 18 * 60,
  travelScale: 0.5,
  queueLabel: "Sharing the stove",
  hoursLabel: "Guests",
  hours: { verb: "arrive at", closedLabel: "Guests are here" },
  tasks: [
    { id: "prep-veg", label: "Prep the veg", place: "Chopping board", location: { x: 26, y: 30 }, baseTime: 9, tags: ["queue"] },
    { id: "marinate", label: "Marinate", place: "Chopping board", location: { x: 26, y: 30 }, baseTime: 5, tags: ["hours"] },
    { id: "pasta", label: "Boil the pasta", place: "Stove", location: { x: 60, y: 26 }, baseTime: 12, tags: ["queue"] },
    { id: "sauce", label: "Make the sauce", place: "Stove", location: { x: 60, y: 26 }, baseTime: 10, tags: ["queue"] },
    { id: "roast", label: "Roast a tray", place: "Oven", location: { x: 82, y: 44 }, baseTime: 15, tags: ["hours"] },
    { id: "bread", label: "Warm the bread", place: "Oven", location: { x: 82, y: 44 }, baseTime: 6, tags: ["hours"] },
    { id: "wash-up", label: "Wash up as you go", place: "Sink", location: { x: 20, y: 62 }, baseTime: 8, tags: ["queue"] },
    { id: "herbs", label: "Cut some herbs", place: "Balcony", location: { x: 14, y: 14 }, baseTime: 3, tags: ["hours"] },
    { id: "set-table", label: "Set the table", place: "Dining table", location: { x: 48, y: 88 }, baseTime: 5, tags: [] },
    { id: "spices", label: "Dig out the spices", place: "Pantry", location: { x: 86, y: 72 }, baseTime: 4, tags: [] },
  ],
};

const WEEKEND_ERRANDS: Scenario = {
  id: "weekend-errands",
  title: "Weekend Errands",
  place: "Town",
  weekday: false,
  weekend: true,
  start: { x: 50, y: 94 },
  startLabel: "Car park",
  startClock: 10 * 60,
  travelScale: 1.3,
  queueLabel: "Saturday crowds",
  hoursLabel: "The shops",
  hours: { verb: "close at", closedLabel: "Shops closed" },
  tasks: [
    { id: "post-parcel", label: "Post a parcel", place: "Post office", location: { x: 22, y: 24 }, baseTime: 8, tags: ["queue", "hours"] },
    { id: "hardware", label: "Hardware run", place: "Hardware store", location: { x: 76, y: 20 }, baseTime: 10, tags: ["hours"] },
    { id: "library", label: "Return the books", place: "Library", location: { x: 18, y: 58 }, baseTime: 5, tags: ["hours"] },
    { id: "market", label: "Buy veg at the market", place: "Farmers market", location: { x: 52, y: 40 }, baseTime: 9, tags: ["queue"] },
    { id: "bank", label: "Sort out the bank", place: "Bank", location: { x: 82, y: 58 }, baseTime: 7, tags: ["queue", "hours"] },
    { id: "coffee", label: "Sit down for coffee", place: "Café", location: { x: 46, y: 74 }, baseTime: 12, tags: ["queue"] },
    { id: "cake", label: "Pick up the cake", place: "Café", location: { x: 46, y: 74 }, baseTime: 3, tags: ["hours"] },
    { id: "dry-cleaning", label: "Collect dry cleaning", place: "Dry cleaner", location: { x: 86, y: 86 }, baseTime: 4, tags: ["hours"] },
    { id: "car-wash", label: "Wash the car", place: "Car wash", location: { x: 14, y: 88 }, baseTime: 11, tags: ["queue"] },
    { id: "browse", label: "Browse the stalls", place: "Farmers market", location: { x: 52, y: 40 }, baseTime: 6, tags: [] },
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
