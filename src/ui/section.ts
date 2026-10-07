import type { Bill } from "../bill/bill";

/** Действия секций над счётом: чтение текущего и замена новым значением. */
export interface BillActions {
  readonly getBill: () => Bill;
  readonly changeBill: (bill: Bill) => void;
}

export interface Section {
  readonly element: HTMLElement;
  readonly render: (bill: Bill) => void;
}
