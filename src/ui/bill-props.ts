import type { Bill } from "../bill/bill";
import type { Currency } from "../bill/currency";

/** What a section that only shows the bill needs. */
export interface BillViewProps {
  readonly bill: Bill;
  readonly currency: Currency;
}

/** What a section that edits the bill needs: the current bill and a way to replace it with a new value. */
export interface BillProps extends BillViewProps {
  readonly onBillChange: (bill: Bill) => void;
}
