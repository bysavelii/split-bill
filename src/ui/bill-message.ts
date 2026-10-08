import { createEffect, createSignal, on, type Signal } from "solid-js";
import type { Bill } from "../bill/bill";

const NO_MESSAGE = "";

/** A message of a section: any write to the bill clears it, as the old full redraw did. */
export function createBillMessage(getBill: () => Bill): Signal<string> {
  const [message, setMessage] = createSignal(NO_MESSAGE);

  createEffect(
    on(
      getBill,
      () => {
        setMessage(NO_MESSAGE);
      },
      { defer: true },
    ),
  );

  return [message, setMessage];
}
