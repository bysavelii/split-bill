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
  formatTransferCount,
} from "./settlement-explanation";

const NO_EXPENSES_TEXT =
  "Добавьте траты — здесь появится, кто кому сколько должен";
const NO_TRANSFERS_TEXT = "Все в расчёте — переводы не нужны";
const BREAKDOWN_TITLE = "Как посчитано";

const NO_EXPENSES_ANNOUNCEMENT = "Итог: трат пока нет";
const NO_TRANSFERS_ANNOUNCEMENT = "Итог: все в расчёте, переводы не нужны";

export function createSummarySection(): Section {
  const content = createElement("div");
  // Диктор объявляет только эту короткую сводку, а не всю секцию. Область
  // создаётся с текстом пустого счёта, чтобы при загрузке ничего не объявлялось
  // лишний раз. Изменения после загрузки (правки счёта, переход по другой
  // ссылке через hashchange) объявляются.
  const announcement = createElement("div", {
    className: "visually-hidden",
    text: NO_EXPENSES_ANNOUNCEMENT,
    attributes: { "aria-live": "polite", "aria-atomic": "true" },
  });
  const element = createElement("section", {}, [
    createElement("h2", { text: "Итог" }),
    announcement,
    content,
  ]);

  function announce(text: string): void {
    // Повторная запись того же текста заставила бы диктор прочитать его снова.
    if (announcement.textContent === text) return;

    announcement.textContent = text;
  }

  function render(bill: Bill): void {
    if (bill.expenses.length === 0) {
      content.replaceChildren(createElement("p", { text: NO_EXPENSES_TEXT }));
      announce(NO_EXPENSES_ANNOUNCEMENT);
      return;
    }

    const balances = calculateBalances(bill);
    const plan = calculateTransfers(balances);

    const transferNodes = createTransferNodes(bill, plan);
    const breakdownNodes = createBreakdownNodes(bill, balances);
    content.replaceChildren(...transferNodes, ...breakdownNodes);
    announce(describeTransferTotal(plan));
  }

  return { element, render };
}

function describeTransferTotal(plan: TransferPlan): string {
  if (plan.transfers.length === 0) return NO_TRANSFERS_ANNOUNCEMENT;

  return `Итог: ${formatTransferCount(plan.transfers.length)}`;
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
