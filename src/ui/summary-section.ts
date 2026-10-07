import type { Bill } from "../bill/bill";
import { getParticipantName } from "../bill/bill";
import { formatRubles } from "../bill/money";
import { calculateBalances } from "../settlement/balances";
import { calculateTransfers, type Transfer } from "../settlement/transfers";
import { createElement } from "./dom";
import type { Section } from "./section";

const NO_EXPENSES_TEXT =
  "Добавьте траты — здесь появится, кто кому сколько должен";
const NO_TRANSFERS_TEXT = "Все в расчёте — переводы не нужны";

export function createSummarySection(): Section {
  const content = createElement("div");
  const element = createElement(
    "section",
    { attributes: { "aria-live": "polite" } },
    [createElement("h2", { text: "Итог" }), content],
  );

  function describeTransfer(bill: Bill, transfer: Transfer): string {
    const fromName = getParticipantName(bill, transfer.fromId);
    const toName = getParticipantName(bill, transfer.toId);

    return `${fromName} → ${toName}: ${formatRubles(transfer.amount)}`;
  }

  function render(bill: Bill): void {
    if (bill.expenses.length === 0) {
      content.replaceChildren(createElement("p", { text: NO_EXPENSES_TEXT }));
      return;
    }

    const transfers = calculateTransfers(calculateBalances(bill));
    if (transfers.length === 0) {
      content.replaceChildren(createElement("p", { text: NO_TRANSFERS_TEXT }));
      return;
    }

    const rows = transfers.map((transfer) =>
      createElement("li", { text: describeTransfer(bill, transfer) }),
    );
    content.replaceChildren(createElement("ul", { className: "list" }, rows));
  }

  return { element, render };
}
