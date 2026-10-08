import type { Bill } from "../bill/bill";

/** What a section that only shows the bill needs. */
export interface BillViewProps {
  readonly bill: Bill;
}

/** What a section that edits the bill needs: the current bill and a way to replace it with a new value. */
export interface BillProps extends BillViewProps {
  readonly onBillChange: (bill: Bill) => void;
}
