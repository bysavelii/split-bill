import { For } from "solid-js";
import { LOCALE_DEFINITIONS, LOCALES } from "../i18n/locales";
import { encodeBill } from "../sharing/bill-code";
import { buildLanguageUrl } from "./address";
import type { BillViewProps } from "./bill-props";
import { useLocale } from "./locale-context";

/** Links to the other languages; a link carries the current bill and its currency along. */
export function LanguageSwitch(props: BillViewProps) {
  const { locale } = useLocale();
  const { defaultCurrency } = LOCALE_DEFINITIONS[locale];
  const otherLocales = LOCALES.filter((candidate) => candidate !== locale);

  // The page of the other language opens an untouched bill in its own default currency anyway,
  // so a link without a fragment keeps the address short and the server-rendered link plain.
  const isUntouched = () =>
    props.bill.participants.length === 0 &&
    props.bill.expenses.length === 0 &&
    props.currency === defaultCurrency;
  const billCode = () =>
    isUntouched() ? undefined : encodeBill(props.bill, props.currency);

  return (
    <For each={otherLocales}>
      {(otherLocale) => (
        <a
          class="language-link"
          href={buildLanguageUrl(otherLocale, billCode())}
          lang={otherLocale}
          hreflang={otherLocale}
        >
          {LOCALE_DEFINITIONS[otherLocale].ownName}
        </a>
      )}
    </For>
  );
}
