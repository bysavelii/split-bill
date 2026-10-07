import type { Bill, ParticipantId } from "../bill/bill";
import type { Kopecks } from "../bill/money";
import { splitAmount } from "./shares";

/** Больше нуля — участнику должны, меньше нуля — должен он. */
export interface Balance {
  readonly participantId: ParticipantId;
  readonly amount: Kopecks;
}

export function calculateBalances(bill: Bill): Balance[] {
  const changes = new Map<ParticipantId, Kopecks>();

  for (const expense of bill.expenses) {
    addChange(changes, expense.payerId, expense.amount);

    const shares = splitAmount(expense.amount, expense.beneficiaryIds.length);
    for (const [index, beneficiaryId] of expense.beneficiaryIds.entries()) {
      addChange(changes, beneficiaryId, -(shares[index] ?? 0));
    }
  }

  return bill.participants.map((participant) => ({
    participantId: participant.id,
    amount: changes.get(participant.id) ?? 0,
  }));
}

function addChange(
  changes: Map<ParticipantId, Kopecks>,
  participantId: ParticipantId,
  change: Kopecks,
): void {
  const current = changes.get(participantId) ?? 0;
  changes.set(participantId, current + change);
}
