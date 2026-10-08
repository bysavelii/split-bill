import { calculateTotalSpent } from "../bill/bill";
import { formatRubles } from "../bill/money";
import type { BillViewProps } from "./bill-props";
import { formatCount, type PluralForms } from "./plural";

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

/** The header: the title, the subtitle and the bill overview in one line. */
export function PageHeader(props: BillViewProps) {
  const participantsText = () =>
    formatCount(props.bill.participants.length, PARTICIPANT_FORMS);
  const expensesText = () =>
    formatCount(props.bill.expenses.length, EXPENSE_FORMS);
  const totalSpentText = () =>
    `потрачено ${formatRubles(calculateTotalSpent(props.bill))}`;

  return (
    <header class="page-header">
      <h1>Делим счёт</h1>
      <p class="page-subtitle">{SUBTITLE_TEXT}</p>
      <p class="overview">
        <span class="overview-item">{participantsText()}</span>
        <span class="overview-item">{expensesText()}</span>
        <span class="overview-item">{totalSpentText()}</span>
      </p>
    </header>
  );
}
