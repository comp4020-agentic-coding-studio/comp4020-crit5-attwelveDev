import { dateKey } from "../lib/seed";
import { stats } from "../lib/stats";

function need<T extends Element>(selector: string): T {
  const found = document.querySelector<T>(selector);
  if (!found) throw new Error(`missing element: ${selector}`);
  return found;
}

export function mountStats(): void {
  const s = stats(dateKey(new Date()));

  need<HTMLElement>("#stat-played").textContent = `${s.played}`;
  need<HTMLElement>("#stat-winrate").textContent = `${Math.round(s.winRate * 100)}%`;
  need<HTMLElement>("#stat-current").textContent = `${s.currentStreak}`;
  need<HTMLElement>("#stat-max").textContent = `${s.maxStreak}`;
  need<HTMLElement>("#stat-madeit").textContent = `${s.madeIt}`;
  need<HTMLElement>("#stat-lost").textContent = `${s.ranOut + s.blocked}`;

  // Nothing played yet: the grid of zeroes reads like a broken page, so show
  // an explanation in its place instead.
  if (s.played === 0) {
    need<HTMLElement>("#stats-empty").hidden = false;
    need<HTMLElement>("#stat-grid").hidden = true;
  }
}
