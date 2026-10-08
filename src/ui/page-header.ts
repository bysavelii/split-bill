import { calculateTotalSpent, type Bill } from "../bill/bill";
import { formatRubles } from "../bill/money";
import { createElement } from "./dom";
import { formatCount, type PluralForms } from "./plural";
import type { Section } from "./section";

const PARTICIPANT_FORMS: PluralForms = {
  one: "участник",
  few: "участника",
  many: "участников",
};
const EXPENSE_FORMS: PluralForms = {
  one: "трата",
  few: "траты",
  many: "трат",
};

const SUBTITLE_TEXT = "Кто кому сколько должен — без таблиц и споров";

function createOverviewItem(): HTMLSpanElement {
  return createElement("span", { className: "overview-item" });
}

/** Шапка: название, подзаголовок и сводка счёта в одну строку. */
export function createPageHeader(): Section {
  const participantsItem = createOverviewItem();
  const expensesItem = createOverviewItem();
  const totalItem = createOverviewItem();
  const overview = createElement("p", { className: "overview" }, [
    participantsItem,
    expensesItem,
    totalItem,
  ]);
  const element = createElement("header", { className: "page-header" }, [
    createElement("h1", { text: "Делим счёт" }),
    createElement("p", { className: "page-subtitle", text: SUBTITLE_TEXT }),
    overview,
  ]);

  function render(bill: Bill): void {
    const totalSpent = formatRubles(calculateTotalSpent(bill));

    participantsItem.textContent = formatCount(
      bill.participants.length,
      PARTICIPANT_FORMS,
    );
    expensesItem.textContent = formatCount(bill.expenses.length, EXPENSE_FORMS);
    totalItem.textContent = `потрачено ${totalSpent}`;
  }

  return { element, render };
}
