import type { Bill, ParticipantId } from "../bill/bill";
import type { Kopecks } from "../bill/money";
import { splitAmount } from "./shares";

export interface Balance {
  readonly participantId: ParticipantId;
  /** How much the participant paid out of their own money. */
  readonly paid: Kopecks;
  /** How much of all the expenses fell on the participant: the sum of their shares. */
  readonly share: Kopecks;
  /** Above zero: the participant is owed; below zero: they owe. */
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
