import type { ParticipantId } from "../bill/bill";
import type { Kopecks } from "../bill/money";
import type { Balance } from "./balances";

export interface Transfer {
  readonly fromId: ParticipantId;
  readonly toId: ParticipantId;
  readonly amount: Kopecks;
}

interface OpenPosition {
  readonly participantId: ParticipantId;
  remaining: Kopecks;
}

/** Жадный расчёт: должники по очереди закрывают долги перед кредиторами. */
export function calculateTransfers(balances: readonly Balance[]): Transfer[] {
  const debtors = toOpenPositions(
    balances.filter((balance) => balance.amount < 0),
  );
  const creditors = toOpenPositions(
    balances.filter((balance) => balance.amount > 0),
  );
  const transfers: Transfer[] = [];

  let debtorIndex = 0;
  let creditorIndex = 0;

  for (;;) {
    const debtor = debtors[debtorIndex];
    const creditor = creditors[creditorIndex];
    if (debtor === undefined || creditor === undefined) return transfers;

    const amount = Math.min(debtor.remaining, creditor.remaining);
    transfers.push({
      fromId: debtor.participantId,
      toId: creditor.participantId,
      amount,
    });
    debtor.remaining -= amount;
    creditor.remaining -= amount;

    if (debtor.remaining === 0) debtorIndex += 1;
    if (creditor.remaining === 0) creditorIndex += 1;
  }
}

function toOpenPositions(balances: readonly Balance[]): OpenPosition[] {
  return balances.map((balance) => ({
    participantId: balance.participantId,
    remaining: Math.abs(balance.amount),
  }));
}
