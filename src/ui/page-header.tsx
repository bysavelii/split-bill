import { calculateTotalSpent } from "../bill/bill";
import { formatCount } from "../i18n/format";
import { useAmountFormatter } from "./amount-formatter";
import type { Currency } from "../bill/currency";
import type { BillViewProps } from "./bill-props";
import { CurrencySelect } from "./currency-select";
import { LanguageSwitch } from "./language-switch";
import { useLocale } from "./locale-context";

export interface PageHeaderProps extends BillViewProps {
  readonly onCurrencyChange: (currency: Currency) => void;
}

/** The header: the toolbar, the title, the subtitle and the bill overview in one line. */
export function PageHeader(props: PageHeaderProps) {
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
      <div class="page-toolbar">
        <LanguageSwitch bill={props.bill} currency={props.currency} />
        <CurrencySelect
          currency={props.currency}
          onCurrencyChange={props.onCurrencyChange}
        />
      </div>
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
