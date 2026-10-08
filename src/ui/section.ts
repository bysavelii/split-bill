import type { Bill } from "../bill/bill";

/** Actions of the sections on the bill: reading the current one and replacing it with a new value. */
export interface BillActions {
  readonly getBill: () => Bill;
  readonly changeBill: (bill: Bill) => void;
}

export interface Section {
  readonly element: HTMLElement;
  readonly render: (bill: Bill) => void;
}
