import type { Bill } from "../bill/bill";
import type { Kopecks } from "../bill/money";

/** Делит сумму на равные доли; лишние копейки достаются первым по порядку. */
export function splitAmount(amount: Kopecks, count: number): Kopecks[] {
  if (!Number.isInteger(count) || count < 1) {
    throw new RangeError(
      `Число долей должно быть целым и не меньше 1, получено: ${String(count)}`,
    );
  }
  if (!Number.isInteger(amount) || amount <= 0) {
    throw new RangeError(
      `Сумма должна быть положительным целым числом копеек, получено: ${String(amount)}`,
    );
  }

  const baseShare = Math.floor(amount / count);
  const extraKopecks = amount - baseShare * count;

  return Array.from({ length: count }, (_, index) =>
    index < extraKopecks ? baseShare + 1 : baseShare,
  );
}

/** Есть трата, которая не делится поровну до копейки. */
export function hasUnevenSplit(bill: Bill): boolean {
  return bill.expenses.some(
    (expense) => expense.amount % expense.beneficiaryIds.length !== 0,
  );
}
