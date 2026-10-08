import { calculateTotalSpent } from "../bill/bill";
import { formatCount } from "../i18n/format";
import { useAmountFormatter } from "./amount-formatter";
import type { BillViewProps } from "./bill-props";
import { useLocale } from "./locale-context";

/** The header: the title, the subtitle and the bill overview in one line. */
export function PageHeader(props: BillViewProps) {
  const { locale, messages } = useLocale();
  const formatAmount = useAmountFormatter(() => props.currency);

  const participantsText = () =>
    formatCount(
      props.bill.participants.length,
      messages.plurals.participants,
      locale,
    );
  const expensesText = () =>
    formatCount(props.bill.expenses.length, messages.plurals.expenses, locale);
  const totalSpentText = () =>
    messages.header.spent(formatAmount(calculateTotalSpent(props.bill)));

  return (
    <header class="page-header">
      <h1>{messages.header.title}</h1>
      <p class="page-subtitle">{messages.header.subtitle}</p>
      <p class="overview">
        <span class="overview-item">{participantsText()}</span>
        <span class="overview-item">{expensesText()}</span>
        <span class="overview-item">{totalSpentText()}</span>
      </p>
    </header>
  );
}
