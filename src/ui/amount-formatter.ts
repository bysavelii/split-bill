import type { Currency } from "../bill/currency";
import type { Kopecks } from "../bill/money";
import { formatMoney } from "../i18n/format";
import { useLocale } from "./locale-context";

/** Writes an amount in minor units as money of the bill currency in the language of the page. */
export type AmountFormatter = (amount: Kopecks) => string;

/** The currency is read at every call, because the bill currency can change while the page is open. */
export function useAmountFormatter(
  getCurrency: () => Currency,
): AmountFormatter {
  const { locale } = useLocale();

  return (amount) => formatMoney(amount, getCurrency(), locale);
}
