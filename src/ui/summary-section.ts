import type { Bill } from "../bill/bill";
import { calculateTotalSpent, getParticipantName } from "../bill/bill";
import { formatRubles } from "../bill/money";
import { calculateBalances, type Balance } from "../settlement/balances";
import { hasUnevenSplit } from "../settlement/shares";
import {
  calculateTransfers,
  type Transfer,
  type TransferPlan,
} from "../settlement/transfers";
import { createElement } from "./dom";
import type { Section } from "./section";
import {
  ROUNDING_NOTE,
  SHARE_NOTE,
  describeParticipantTotals,
  describeTransferCount,
} from "./settlement-explanation";

const NO_EXPENSES_TEXT =
  "Добавьте траты — здесь появится, кто кому сколько должен";
const NO_TRANSFERS_TEXT = "Все в расчёте — переводы не нужны";
const BREAKDOWN_TITLE = "Как посчитано";

export function createSummarySection(): Section {
  const content = createElement("div");
  const element = createElement(
    "section",
    { attributes: { "aria-live": "polite" } },
    [createElement("h2", { text: "Итог" }), content],
  );

  function render(bill: Bill): void {
    if (bill.expenses.length === 0) {
      content.replaceChildren(createElement("p", { text: NO_EXPENSES_TEXT }));
      return;
    }

    const balances = calculateBalances(bill);
    const plan = calculateTransfers(balances);

    const transferNodes = createTransferNodes(bill, plan);
    const breakdownNodes = createBreakdownNodes(bill, balances);
    content.replaceChildren(...transferNodes, ...breakdownNodes);
  }

  return { element, render };
}

function createTransferNodes(bill: Bill, plan: TransferPlan): HTMLElement[] {
  if (plan.transfers.length === 0) {
    return [createElement("p", { text: NO_TRANSFERS_TEXT })];
  }

  const rows = plan.transfers.map((transfer) =>
    createElement("li", { text: describeTransfer(bill, transfer) }),
  );
  const reason = describeTransferCount({
    transferCount: plan.transfers.length,
    settlingCount: plan.settlingCount,
    isMinimal: plan.isMinimal,
  });

  return [
    createElement("ul", { className: "list transfers" }, rows),
    createElement("p", { className: "transfers-reason", text: reason }),
  ];
}

function createBreakdownNodes(
  bill: Bill,
  balances: readonly Balance[],
): HTMLElement[] {
  const totalSpent = formatRubles(calculateTotalSpent(bill));
  const rows = balances.map((balance) => {
    const name = getParticipantName(bill, balance.participantId);

    return createElement("li", {
      text: describeParticipantTotals(name, balance),
    });
  });
  const notes = hasUnevenSplit(bill)
    ? [SHARE_NOTE, ROUNDING_NOTE]
    : [SHARE_NOTE];
  const noteNodes = notes.map((note) =>
    createElement("p", { className: "note", text: note }),
  );

  return [
    createElement("h3", { text: BREAKDOWN_TITLE }),
    createElement("p", { text: `Всего потрачено: ${totalSpent}` }),
    createElement("ul", { className: "list breakdown" }, rows),
    ...noteNodes,
  ];
}

function describeTransfer(bill: Bill, transfer: Transfer): string {
  const fromName = getParticipantName(bill, transfer.fromId);
  const toName = getParticipantName(bill, transfer.toId);

  return `${fromName} → ${toName}: ${formatRubles(transfer.amount)}`;
}
