import type { Bill } from "../bill/bill";
import type { Kopecks } from "../bill/money";

/** Splits an amount into equal shares; the extra kopecks go to the first ones in order. */
export function splitAmount(amount: Kopecks, count: number): Kopecks[] {
  if (!Number.isInteger(count) || count < 1) {
    throw new RangeError(
      `The number of shares must be an integer and at least 1, got: ${String(count)}`,
    );
  }
  if (!Number.isInteger(amount) || amount <= 0) {
    throw new RangeError(
      `The amount must be a positive integer number of kopecks, got: ${String(amount)}`,
    );
  }

  const baseShare = Math.floor(amount / count);
  const extraKopecks = amount - baseShare * count;

  return Array.from({ length: count }, (_, index) =>
    index < extraKopecks ? baseShare + 1 : baseShare,
  );
}

/** There is an expense that does not divide evenly to the kopeck. */
export function hasUnevenSplit(bill: Bill): boolean {
  return bill.expenses.some(
    (expense) => expense.amount % expense.beneficiaryIds.length !== 0,
  );
}
