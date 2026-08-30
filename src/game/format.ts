/** Simulated minutes read as a wall clock, so a shift feels like a morning. */
export function clockAt(startClock: number, minutes: number): string {
  const total = Math.round(startClock + minutes);
  const hours = Math.floor(total / 60) % 24;
  const mins = total % 60;
  return `${`${hours}`.padStart(2, "0")}:${`${mins}`.padStart(2, "0")}`;
}

export function minutes(value: number): string {
  const rounded = Math.round(value);
  return `${rounded} min`;
}

export function plural(count: number, one: string, many: string): string {
  return `${count} ${count === 1 ? one : many}`;
}
