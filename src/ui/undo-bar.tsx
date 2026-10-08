import { createEffect, createMemo, createSignal, on } from "solid-js";
import type { Bill } from "../bill/bill";
import { useLocale } from "./locale-context";

/** A removal that can still be undone: what was removed and the bill on both sides of it. */
export interface Removal {
  readonly description: string;
  readonly billBefore: Bill;
  readonly billAfter: Bill;
}

export interface UndoBarProps {
  /** The `id` of the text of the bar; the "Undo" button refers to it through `aria-describedby`. Unique per page. */
  readonly id: string;
  readonly removal: Removal | undefined;
  readonly onUndo: (billBefore: Bill) => void;
}

/**
 * Remembers the last removal of a section and gives it back only while the bill is the one the removal produced.
 * Bills are never changed in place, so any other change of the bill (an edit, a restore, a new address) makes
 * the removal outdated whatever the order of effects.
 */
export function createRemovalMemory(
  getBill: () => Bill,
): [() => Removal | undefined, (removal: Removal) => void] {
  const [lastRemoval, setLastRemoval] = createSignal<Removal>();

  const undoableRemoval = createMemo(() => {
    const removal = lastRemoval();
    if (removal === undefined) return undefined;

    const isBillUnchanged = getBill() === removal.billAfter;
    return isBillUnchanged ? removal : undefined;
  });

  return [undoableRemoval, setLastRemoval];
}

/** Says what was removed and offers to bring it back; a new removal moves the focus to the button, because the removed row took the focus with it. */
export function UndoBar(props: UndoBarProps) {
  const { messages } = useLocale();
  let undoButton: HTMLButtonElement | undefined;

  createEffect(
    on(
      () => props.removal,
      (removal) => {
        if (removal === undefined) return;

        undoButton?.focus();
      },
      { defer: true },
    ),
  );

  return (
    <div class="undo" hidden={props.removal === undefined}>
      <p id={props.id}>{props.removal?.description}</p>
      <button
        ref={(element) => {
          undoButton = element;
        }}
        class="button button-secondary"
        type="button"
        aria-describedby={props.id}
        onClick={() => {
          if (props.removal === undefined) return;

          props.onUndo(props.removal.billBefore);
        }}
      >
        {messages.undo.button}
      </button>
    </div>
  );
}
