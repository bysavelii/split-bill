import type { Bill, ParticipantId } from "../bill/bill";
import type { Kopecks } from "../bill/money";
import { splitAmount } from "./shares";

export interface Balance {
  readonly participantId: ParticipantId;
  /** Сколько участник заплатил из своих денег. */
  readonly paid: Kopecks;
  /** Сколько из всех трат пришлось на участника: сумма его долей. */
  readonly share: Kopecks;
  /** Больше нуля — участнику должны, меньше нуля — должен он. */
  readonly amount: Kopecks;
}

interface Totals {
  paid: Kopecks;
  share: Kopecks;
}

export function calculateBalances(bill: Bill): Balance[] {
  const totals = new Map<ParticipantId, Totals>();

  for (const expense of bill.expenses) {
    const payerTotals = getTotals(totals, expense.payerId);
    payerTotals.paid += expense.amount;

    const shares = splitAmount(expense.amount, expense.beneficiaryIds.length);
    for (const [index, beneficiaryId] of expense.beneficiaryIds.entries()) {
      const beneficiaryTotals = getTotals(totals, beneficiaryId);
      beneficiaryTotals.share += shares[index] ?? 0;
    }
  }

  return bill.participants.map((participant) => {
    const { paid, share } = getTotals(totals, participant.id);

    return { participantId: participant.id, paid, share, amount: paid - share };
  });
}

function getTotals(
  totals: Map<ParticipantId, Totals>,
  participantId: ParticipantId,
): Totals {
  const existing = totals.get(participantId);
  if (existing !== undefined) return existing;

  const created: Totals = { paid: 0, share: 0 };
  totals.set(participantId, created);
  return created;
}
