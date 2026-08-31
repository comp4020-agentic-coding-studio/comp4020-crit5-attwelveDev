import { hazardFor } from "../lib/constraintState";
import { generateRandom, generateToday } from "../lib/generate";
import { simulateOrder, type Run } from "../lib/route";
import {
  recordFirstAttempt,
  recordFor,
  stats,
  type Outcome,
} from "../lib/stats";
import type { Shift } from "../lib/types";
import { clockAt, minutes, plural } from "./format";
import { createScene, type Frame } from "./Scene";
import { createTaskList } from "./TaskList";

type Mode = "today" | "random";
type Phase = "planning" | "playback" | "result";

function need<T extends Element>(selector: string): T {
  const found = document.querySelector<T>(selector);
  if (!found) throw new Error(`missing element: ${selector}`);
  return found;
}

function periodOf(startClock: number): string {
  const hour = Math.floor(startClock / 60);
  return hour < 12 ? "morning" : hour < 17 ? "afternoon" : "evening";
}

/** One line per active hazard, plus one more if a precedence pair is active. */
function constraintLines(shift: Shift): string[] {
  const lines = shift.hazards.map((hazard) => {
    if (hazard.kind === "hours") {
      return `${hazard.label} ${hazard.verb} ${clockAt(shift.startClock, hazard.closeAt)}`;
    }
    return hazard.growthRate > 0
      ? `${hazard.label} — building through the ${periodOf(shift.startClock)}`
      : `${hazard.label} — ${minutes(hazard.startWait)} right now, clearing as the ${periodOf(shift.startClock)} goes on`;
  });
  if (shift.precedence) lines.push(shift.precedence.label);
  if (shift.zonePenaltyMinutes > 0) lines.push(`Crossing the coloured floor zones takes ${shift.zonePenaltyMinutes} min`);
  return lines;
}

function outcomeOf(shift: Shift, run: Run): Outcome {
  if (!run.feasible) return "blocked";
  return run.total <= shift.deadline ? "made-it" : "ran-out";
}

function squares(shift: Shift, run: Run): string {
  const marks = run.steps.map((step) => {
    if (!Number.isFinite(step.wait)) return "🟥";
    if (step.done > shift.deadline) return "🟥";
    return step.wait > 0 ? "🟨" : "🟩";
  });
  const missing = shift.tasks.length - marks.length;
  return marks.join("") + "⬜".repeat(Math.max(missing, 0));
}

function escape(text: string): string {
  return text.replace(/[&<>"]/g, (c) =>
    c === "&" ? "&amp;" : c === "<" ? "&lt;" : c === ">" ? "&gt;" : "&quot;",
  );
}

export function mountGame(): void {
  const app = need<HTMLElement>("#app");
  const scene = createScene(need<SVGSVGElement>("#scene"));
  const resultPanel = need<HTMLElement>("#result");
  const hudClock = need<HTMLElement>("#hud-clock");
  const hudDeadline = need<HTMLElement>("#hud-deadline");
  const hudBar = need<HTMLElement>("#hud-bar");
  const hudAction = need<HTMLElement>("#hud-action");
  const commit = need<HTMLButtonElement>("#commit");

  let shift: Shift;
  let order: string[] = [];
  let mode: Mode = "today";
  let practice = false;

  const list = createTaskList(need<HTMLOListElement>("#tasks"), (next) => {
    order = next;
    scene.setOrder(shift, order);
  });

  function setPhase(phase: Phase): void {
    app.dataset.phase = phase;
  }

  function paintHeader(): void {
    need<HTMLElement>("#title").textContent = shift.title;
    need<HTMLElement>("#place").textContent = shift.place;
    need<HTMLElement>("#start-clock").textContent = clockAt(shift.startClock, 0);
    need<HTMLElement>("#deadline-clock").textContent = clockAt(
      shift.startClock,
      shift.deadline,
    );
    need<HTMLUListElement>("#constraints").innerHTML = constraintLines(shift)
      .map((line) => `<li>${escape(line)}</li>`)
      .join("");

    const eyebrow = need<HTMLElement>("#eyebrow");
    if (mode === "random") {
      eyebrow.textContent = "Random shift · never recorded";
    } else {
      const day = new Date().toLocaleDateString(undefined, { weekday: "long" });
      eyebrow.textContent = practice
        ? `${day} · already played — practice run`
        : `${day} · today's shift`;
    }

    const streak = need<HTMLElement>("#streak");
    const daily = shift.dateKey ? stats(shift.dateKey) : null;
    const tally = daily ? `made ${daily.madeIt} of ${daily.played}` : "";
    streak.textContent = !daily || daily.played === 0
      ? ""
      : daily.currentStreak > 0
        ? `${plural(daily.currentStreak, "day", "days")} on the trot · ${tally}`
        : tally;
  }

  function start(next: Shift, nextMode: Mode): void {
    scene.stop();
    shift = next;
    mode = nextMode;
    const played =
      nextMode === "today" && shift.dateKey !== null
        ? recordFor(shift.dateKey)
        : null;
    practice = played !== null;
    order = played ? [...played.order] : shift.tasks.map((task) => task.id);
    resultPanel.innerHTML = "";
    list.render(shift, order);
    scene.build(shift);
    paintHeader();

    if (played) {
      // Today's already been played: show what actually happened, not a
      // blank planning screen — "Run it again"/"Another shift" still work
      // from here exactly as they do after a fresh finish.
      const run = simulateOrder(shift, played.order);
      const stopAt = run.feasible
        ? run.total
        : (run.steps[run.steps.length - 1]?.arrive ?? 0);
      list.setEnabled(false);
      list.setActive(null);
      scene.snap(shift, run, stopAt);
      setPhase("result");
      renderResult(run, outcomeOf(shift, run), true);
      return;
    }

    list.setEnabled(true);
    list.setActive(null);
    scene.setOrder(shift, order);
    setPhase("planning");
  }

  function describe(frame: Frame): string {
    if (frame.state === "done") return "Shift over";
    // Precedence fails outright, before any travel: no step to point at, so
    // the message comes from the constraint itself — discovered by trying,
    // the same way a closed shop is.
    if (frame.state === "blocked" && !frame.step) {
      return shift.precedence?.blockedLabel ?? "Blocked";
    }
    if (!frame.step) return "";
    if (frame.state === "travel") return `Heading to ${frame.step.task.place}`;
    const hazard = hazardFor(shift.hazards, frame.step.task.id);
    if (frame.state === "wait") return `Waiting — ${hazard?.label ?? ""}`;
    if (frame.state === "blocked") {
      return hazard?.kind === "hours" ? hazard.closedLabel : "Blocked";
    }
    return frame.step.task.label;
  }

  function renderResult(run: Run, outcome: Outcome, recorded: boolean): void {
    const spare = shift.deadline - run.total;
    const verdict =
      outcome === "made-it"
        ? "Made it"
        : outcome === "ran-out"
          ? "Ran out of time"
          : "Didn't get there";
    const line =
      outcome === "made-it"
        ? `Finished ${clockAt(shift.startClock, run.total)} — ${minutes(spare)} to spare`
        : outcome === "ran-out"
          ? `The clock hit ${clockAt(shift.startClock, shift.deadline)} with ${plural(shift.tasks.length - run.steps.filter((s) => s.done <= shift.deadline).length, "task", "tasks")} still to go`
          : run.steps.length === 0
            ? (shift.precedence?.blockedLabel ?? "Blocked before it could start")
            : `${run.steps[run.steps.length - 1]?.task.label ?? "A task"} was already out of reach`;

    const breakdown = run.steps
      .map((step) => {
        const blocked = !Number.isFinite(step.wait);
        const late = !blocked && step.done > shift.deadline;
        const state = blocked ? "blocked" : late ? "late" : "ok";
        const hazard = blocked ? hazardFor(shift.hazards, step.task.id) : null;
        const cost = blocked
          ? hazard?.kind === "hours"
            ? hazard.closedLabel
            : "blocked"
          : `${minutes(step.arrive - step.leave)} there${step.wait > 0 ? ` · ${minutes(step.wait)} waiting` : ""} · ${minutes(step.task.baseTime)}`;
        return `<li class="task is-recap" data-state="${state}">
  <span class="task-index" aria-hidden="true">${blocked ? "×" : late ? "!" : "✓"}</span>
  <span class="task-body">
    <span class="task-label">${escape(step.task.label)}</span>
    <span class="task-place">${escape(cost)}</span>
  </span>
  <span class="task-time">${blocked ? "—" : clockAt(shift.startClock, step.done)}</span>
</li>`;
      })
      .join("");

    resultPanel.innerHTML = `<p class="verdict" data-outcome="${outcome}">${verdict}</p>
<p class="verdict-line">${escape(line)}</p>
<p class="verdict-note">${recorded ? `Recorded for ${escape(shift.dateKey ?? "")}` : "Practice — not counted"}</p>
<ol class="tasks tasks-recap">${breakdown}</ol>
<div class="actions">
  <button type="button" id="again" class="ghost">Run it again</button>
  <button type="button" id="another" class="ghost">Another shift</button>
  ${recorded ? `<button type="button" id="share" class="ghost">Share</button>` : ""}
</div>`;

    need<HTMLButtonElement>("#again").addEventListener("click", () => {
      practice = true;
      resultPanel.innerHTML = "";
      list.render(shift, order);
      list.setEnabled(true);
      list.setActive(null);
      scene.setOrder(shift, order);
      paintHeader();
      setPhase("planning");
    });

    need<HTMLButtonElement>("#another").addEventListener("click", () => {
      start(generateRandom(Math.floor(Math.random() * 2 ** 31)), "random");
    });

    const share = document.querySelector<HTMLButtonElement>("#share");
    share?.addEventListener("click", () => {
      const text = `Today's Shift ${shift.dateKey}\n${shift.title} · ${verdict.toLowerCase()} ${clockAt(shift.startClock, Number.isFinite(run.total) ? run.total : shift.deadline)}/${clockAt(shift.startClock, shift.deadline)}\n${squares(shift, run)}`;
      navigator.clipboard?.writeText(text).then(
        () => {
          share.textContent = "Copied";
        },
        () => {
          share.textContent = "Couldn't copy";
        },
      );
    });
  }

  commit.addEventListener("click", () => {
    if (app.dataset.phase !== "planning") return;
    const run = simulateOrder(shift, order);
    const outcome = outcomeOf(shift, run);
    const stopAt = run.feasible
      ? Math.min(run.total, shift.deadline)
      : (run.steps[run.steps.length - 1]?.arrive ?? 0);

    // Recorded at commit, not at the end of playback: closing the tab halfway
    // through a losing run must not be a way to dodge the result.
    const recorded =
      mode === "today" && !practice && shift.dateKey !== null
        ? recordFirstAttempt({
            date: shift.dateKey,
            scenarioId: shift.scenarioId,
            outcome,
            total: run.total,
            deadline: shift.deadline,
            order: [...order],
          })
        : false;

    list.setEnabled(false);
    setPhase("playback");
    hudDeadline.textContent = `of ${clockAt(shift.startClock, shift.deadline)}`;
    scene.play(shift, run, stopAt, {
      onFrame(t, frame) {
        hudClock.textContent = clockAt(shift.startClock, t);
        hudBar.style.width = `${Math.min((t / shift.deadline) * 100, 100)}%`;
        hudBar.dataset.state = t > shift.deadline * 0.85 ? "tight" : "fine";
        hudAction.textContent = describe(frame);
        list.setActive(frame.step?.task.id ?? null);
      },
      onEnd() {
        setPhase("result");
        renderResult(run, outcome, recorded);
      },
    });
  });

  const wanted = new URLSearchParams(globalThis.location.search).get("shift");
  if (wanted === "random") {
    start(generateRandom(Math.floor(Math.random() * 2 ** 31)), "random");
  } else {
    start(generateToday(new Date()), "today");
  }
}
