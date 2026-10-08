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
import { createAvatar } from "./avatar";
import { createElement } from "./dom";
import { createEmptyState } from "./empty-state";
import { createIcon } from "./icons";
import type { Section } from "./section";
import {
  ROUNDING_NOTE,
  SHARE_NOTE,
  describeBalanceOutcome,
  describeTransferCount,
  formatTransferCount,
} from "./settlement-explanation";

const NO_EXPENSES_TEXT =
  "Добавьте траты — здесь появится, кто кому сколько должен";
const NO_TRANSFERS_TEXT = "Все в расчёте — переводы не нужны";
const BREAKDOWN_TITLE = "Как посчитано";
const ROUTE_SEPARATOR = " → ";
const STATUS_CLASS = "summary-status";

const NO_EXPENSES_ANNOUNCEMENT = "Итог: трат пока нет";
const NO_TRANSFERS_ANNOUNCEMENT = "Итог: все в расчёте, переводы не нужны";

const BREAKDOWN_COLUMNS = ["Участник", "Заплатил", "Доля", "Итог"];

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
      content.replaceChildren(
        createEmptyState("receipt", NO_EXPENSES_TEXT, STATUS_CLASS),
      );
      announce(NO_EXPENSES_ANNOUNCEMENT);
      return;
    }

    const balances = calculateBalances(bill);
    const plan = calculateTransfers(balances);

    const transferNodes = createTransferNodes(bill, plan);
    const breakdown = createBreakdown(bill, balances, plan);
    content.replaceChildren(...transferNodes, breakdown);
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
    return [createEmptyState("check", NO_TRANSFERS_TEXT, STATUS_CLASS)];
  }

  const count = formatTransferCount(plan.transfers.length);
  const cards = plan.transfers.map((transfer) =>
    createTransferCard(bill, transfer),
  );

  return [
    createElement("p", {
      className: "transfers-count",
      text: `Чтобы рассчитаться, нужно ${count}`,
    }),
    createElement("ul", { className: "transfers" }, cards),
  ];
}

function createTransferCard(bill: Bill, transfer: Transfer): HTMLLIElement {
  const fromName = getParticipantName(bill, transfer.fromId);
  const toName = getParticipantName(bill, transfer.toId);
  const people = createElement("span", { className: "transfer-people" }, [
    createAvatar(fromName),
    createIcon("arrow"),
    createAvatar(toName),
  ]);
  const route = createElement("span", { className: "transfer-route" }, [
    createElement("span", { className: "transfer-from", text: fromName }),
    document.createTextNode(ROUTE_SEPARATOR),
    createElement("span", { className: "transfer-to", text: toName }),
  ]);
  const amount = createElement("span", {
    className: "amount transfer-amount",
    text: formatRubles(transfer.amount),
  });

  return createElement("li", { className: "transfer" }, [
    people,
    route,
    amount,
  ]);
}

function createBreakdown(
  bill: Bill,
  balances: readonly Balance[],
  plan: TransferPlan,
): HTMLDetailsElement {
  const totalSpent = formatRubles(calculateTotalSpent(bill));
  const notes = hasUnevenSplit(bill)
    ? [SHARE_NOTE, ROUNDING_NOTE]
    : [SHARE_NOTE];
  const noteNodes = notes.map((note) =>
    createElement("p", { className: "note", text: note }),
  );

  return createElement("details", { className: "breakdown" }, [
    createElement("summary", { text: BREAKDOWN_TITLE }),
    ...createReasonNodes(plan),
    createElement("p", { text: `Всего потрачено: ${totalSpent}` }),
    createBreakdownTable(bill, balances),
    ...noteNodes,
  ]);
}

function createReasonNodes(plan: TransferPlan): HTMLElement[] {
  if (plan.transfers.length === 0) return [];

  const reason = describeTransferCount({
    transferCount: plan.transfers.length,
    settlingCount: plan.settlingCount,
    isMinimal: plan.isMinimal,
  });

  return [createElement("p", { className: "transfers-reason", text: reason })];
}

function createBreakdownTable(
  bill: Bill,
  balances: readonly Balance[],
): HTMLDivElement {
  const headerCells = BREAKDOWN_COLUMNS.map((title) =>
    createElement("th", { text: title, attributes: { scope: "col" } }),
  );
  const head = createElement("thead", {}, [
    createElement("tr", {}, headerCells),
  ]);
  const rows = balances.map((balance) => createBreakdownRow(bill, balance));
  const table = createElement("table", {}, [
    head,
    createElement("tbody", {}, rows),
  ]);

  return createElement("div", { className: "table-scroll" }, [table]);
}

function createBreakdownRow(bill: Bill, balance: Balance): HTMLTableRowElement {
  const name = getParticipantName(bill, balance.participantId);
  const outcome = describeBalanceOutcome(balance.amount);

  return createElement("tr", {}, [
    createElement("th", { text: name, attributes: { scope: "row" } }),
    createElement("td", {
      className: "amount",
      text: formatRubles(balance.paid),
    }),
    createElement("td", {
      className: "amount",
      text: formatRubles(balance.share),
    }),
    createElement("td", {
      className: `outcome outcome-${outcome.kind}`,
      text: outcome.text,
    }),
  ]);
}
