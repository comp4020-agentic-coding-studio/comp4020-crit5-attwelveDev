import { constraintReading, worsensOverTime } from "../lib/constraintState";
import type { Severity } from "../lib/constraintState";
import type { Shift, Task } from "../lib/types";
import { clockAt, minutes } from "./format";

/**
 * Drag-to-reorder on Pointer Events rather than HTML5 drag-and-drop, which
 * has no usable touch story — and the phone is one of the two viewports this
 * gets looked at on.
 */

export type ReorderCallback = (order: string[], settled: boolean) => void;

const SETTLE_MS = 200;

/** Shape as well as colour: the state has to survive being read in greyscale. */
function badgeIcon(shape: "up" | "down" | "cutoff"): string {
  if (shape === "up") return `<polygon points="6,2 10.5,9.5 1.5,9.5" />`;
  if (shape === "down") return `<polygon points="6,10 1.5,2.5 10.5,2.5" />`;
  return `<polygon points="6,1.5 10.5,6 6,10.5 1.5,6" />`;
}

type Badge = { shape: "up" | "down" | "cutoff"; text: string; severity: Severity };

function badgeFor(shift: Shift, task: Task, at: number): Badge | null {
  const reading = constraintReading(shift.constraint, task.id, at);
  if (reading.severity === "none") return null;

  // The badge says what the constraint does to *this* task, not what it's
  // called — the header already names it, and a cold player needs the
  // consequence, not the noun.
  if (shift.constraint.kind === "hours") {
    return {
      shape: "cutoff",
      text: `by ${clockAt(shift.startClock, shift.constraint.closeAt)}`,
      severity: reading.severity,
    };
  }
  const worse = worsensOverTime(shift.constraint);
  return {
    shape: worse ? "up" : "down",
    text: worse ? "worse later" : "better later",
    severity: reading.severity,
  };
}

function escape(text: string): string {
  return text.replace(/[&<>"]/g, (c) =>
    c === "&" ? "&amp;" : c === "<" ? "&lt;" : c === ">" ? "&gt;" : "&quot;",
  );
}

export type TaskListHandle = {
  render(shift: Shift, order: readonly string[]): void;
  setEnabled(enabled: boolean): void;
  /** Highlight the task currently being played out. */
  setActive(id: string | null): void;
};

export function createTaskList(
  list: HTMLOListElement,
  onChange: ReorderCallback,
): TaskListHandle {
  let shift: Shift | null = null;
  let order: string[] = [];
  let enabled = true;
  let dragging: {
    el: HTMLLIElement;
    id: string;
    from: number;
    to: number;
    startY: number;
    step: number;
    pointerId: number;
  } | null = null;

  function cards(): HTMLLIElement[] {
    return [...list.querySelectorAll<HTMLLIElement>("li.task")];
  }

  function draw(): void {
    if (!shift) return;
    const byId = new Map(shift.tasks.map((task) => [task.id, task]));
    list.innerHTML = order
      .map((id, index) => {
        const task = byId.get(id);
        if (!task) return "";
        const badge = badgeFor(shift as Shift, task, 0);
        return `<li class="task" data-id="${escape(id)}" tabindex="0" aria-label="${escape(task.label)}, ${index + 1} of ${order.length}">
  <span class="task-index" aria-hidden="true">${index + 1}</span>
  <span class="task-body">
    <span class="task-label">${escape(task.label)}</span>
    <span class="task-place">${escape(task.place)}</span>
  </span>
  ${
    badge
      ? `<span class="task-badge" data-severity="${badge.severity}"><svg viewBox="0 0 12 12" aria-hidden="true">${badgeIcon(badge.shape)}</svg>${escape(badge.text)}</span>`
      : ""
  }
  <span class="task-time">${minutes(task.baseTime)}</span>
  <span class="task-grip" aria-hidden="true"><span></span><span></span><span></span></span>
</li>`;
      })
      .join("");
  }

  function offsets(from: number, to: number, step: number): void {
    cards().forEach((card, index) => {
      if (index === from) return;
      const shifted =
        from < to && index > from && index <= to
          ? -step
          : from > to && index < from && index >= to
            ? step
            : 0;
      card.style.transform = shifted ? `translateY(${shifted}px)` : "";
    });
  }

  function clearOffsets(): void {
    for (const card of cards()) card.style.transform = "";
  }

  function onPointerDown(event: PointerEvent): void {
    if (!enabled || dragging || event.button !== 0) return;
    const el = (event.target as HTMLElement | null)?.closest<HTMLLIElement>(
      "li.task",
    );
    if (!el) return;

    const all = cards();
    const from = all.indexOf(el);
    const first = all[0];
    const second = all[1];
    const step =
      first && second
        ? second.getBoundingClientRect().top - first.getBoundingClientRect().top
        : el.getBoundingClientRect().height;

    dragging = {
      el,
      id: el.dataset.id ?? "",
      from,
      to: from,
      startY: event.clientY,
      step,
      pointerId: event.pointerId,
    };
    el.setPointerCapture(event.pointerId);
    el.classList.add("dragging");
    list.classList.add("is-dragging");
    event.preventDefault();
  }

  function onPointerMove(event: PointerEvent): void {
    if (!dragging || event.pointerId !== dragging.pointerId) return;
    const dy = event.clientY - dragging.startY;
    dragging.el.style.transform = `translateY(${dy}px)`;
    const to = Math.min(
      Math.max(dragging.from + Math.round(dy / dragging.step), 0),
      order.length - 1,
    );
    if (to !== dragging.to) {
      dragging.to = to;
      offsets(dragging.from, to, dragging.step);
      onChange(preview(dragging.from, to), false);
    }
  }

  function preview(from: number, to: number): string[] {
    const next = [...order];
    const [moved] = next.splice(from, 1);
    if (moved) next.splice(to, 0, moved);
    return next;
  }

  function onPointerUp(event: PointerEvent): void {
    if (!dragging || event.pointerId !== dragging.pointerId) return;
    const { el, from, to, step, id } = dragging;
    dragging = null;

    el.classList.remove("dragging");
    el.classList.add("settling");
    el.style.transform = `translateY(${(to - from) * step}px)`;

    globalThis.setTimeout(() => {
      list.classList.remove("is-dragging");
      order = preview(from, to);
      draw();
      clearOffsets();
      const landed = list.querySelector<HTMLLIElement>(`li[data-id="${id}"]`);
      landed?.classList.add("landed");
      landed?.addEventListener(
        "animationend",
        () => landed.classList.remove("landed"),
        { once: true },
      );
      onChange([...order], true);
    }, SETTLE_MS);
  }

  function onKeyDown(event: KeyboardEvent): void {
    if (!enabled) return;
    if (event.key !== "ArrowUp" && event.key !== "ArrowDown") return;
    const el = (event.target as HTMLElement | null)?.closest<HTMLLIElement>(
      "li.task",
    );
    if (!el) return;
    const from = cards().indexOf(el);
    const to = Math.min(
      Math.max(from + (event.key === "ArrowUp" ? -1 : 1), 0),
      order.length - 1,
    );
    if (to === from) return;
    event.preventDefault();
    const id = el.dataset.id ?? "";
    order = preview(from, to);
    draw();
    const moved = list.querySelector<HTMLLIElement>(`li[data-id="${id}"]`);
    moved?.focus();
    moved?.classList.add("landed");
    onChange([...order], true);
  }

  list.addEventListener("pointerdown", onPointerDown);
  list.addEventListener("pointermove", onPointerMove);
  list.addEventListener("pointerup", onPointerUp);
  list.addEventListener("pointercancel", onPointerUp);
  list.addEventListener("keydown", onKeyDown);

  return {
    render(next, nextOrder) {
      shift = next;
      order = [...nextOrder];
      draw();
    },
    setEnabled(next) {
      enabled = next;
      list.classList.toggle("is-locked", !next);
      for (const card of cards()) {
        if (next) card.setAttribute("tabindex", "0");
        else card.removeAttribute("tabindex");
      }
    },
    setActive(id) {
      for (const card of cards()) {
        card.classList.toggle("is-active", card.dataset.id === id);
        card.classList.toggle(
          "is-done",
          id !== null &&
            order.indexOf(card.dataset.id ?? "") < order.indexOf(id),
        );
      }
    },
  };
}
