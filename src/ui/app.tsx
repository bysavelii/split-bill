import { createSignal, onCleanup, onMount, untrack } from "solid-js";
import { EMPTY_BILL, type Bill } from "../bill/bill";
import type { Currency } from "../bill/currency";
import { DICTIONARIES } from "../i18n/dictionaries";
import { LOCALE_DEFINITIONS, type Locale } from "../i18n/locales";
import {
  decodeBill,
  encodeBill,
  type BillCodeError,
} from "../sharing/bill-code";
import { readBillCode, writeBillCode } from "./address";
import { ExpensesSection } from "./expenses-section";
import { describeBillCodeError, LinkNotice } from "./link-notice";
import { LocaleContext } from "./locale-context";
import { PageHeader } from "./page-header";
import { ParticipantsSection } from "./participants-section";
import { ShareSection } from "./share-section";
import { SummarySection } from "./summary-section";

interface NoticeState {
  readonly text: string;
  readonly isHidden: boolean;
}

const HIDDEN_NOTICE: NoticeState = { text: "", isHidden: true };

export interface AppProps {
  readonly locale: Locale;
}

export function App(props: AppProps) {
  // The language belongs to the page and does not change while the app lives, so it is read once.
  const locale = untrack(() => props.locale);
  const messages = DICTIONARIES[locale];
  const { defaultCurrency } = LOCALE_DEFINITIONS[locale];

  // Any write redraws the sections, even of the same bill: messages and the link field are cleared.
  const [bill, setBill] = createSignal<Bill>(EMPTY_BILL, { equals: false });
  const [currency, setCurrency] = createSignal<Currency>(defaultCurrency);
  const [notice, setNotice] = createSignal(HIDDEN_NOTICE);

  function changeBill(changedBill: Bill): void {
    setBill(changedBill);
    writeBillCode(encodeBill(changedBill, currency()));
  }

  function changeCurrency(changedCurrency: Currency): void {
    setCurrency(changedCurrency);
    writeBillCode(encodeBill(bill(), changedCurrency));
  }

  function showOpenedBill(openedBill: Bill, openedCurrency: Currency): void {
    setBill(openedBill);
    setCurrency(openedCurrency);
    setNotice(HIDDEN_NOTICE);
  }

  function showRejectedLink(error: BillCodeError): void {
    setBill(EMPTY_BILL);
    setCurrency(defaultCurrency);
    setNotice({
      text: describeBillCodeError(error, messages),
      isHidden: false,
    });
  }

  function hideNotice(): void {
    setNotice((current) => ({ ...current, isHidden: true }));
  }

  /** The address is not written here: it changes only when the user edits the bill or its currency. */
  function openBillFromAddress(): void {
    const code = readBillCode();
    if (code === undefined) {
      showOpenedBill(EMPTY_BILL, defaultCurrency);
      return;
    }

    const result = decodeBill(code);
    if (result.kind === "failed") {
      showRejectedLink(result.error);
      return;
    }

    // A link of the version without a currency has none: the page chooses its own.
    showOpenedBill(result.bill, result.currency ?? defaultCurrency);
  }

  // The address does not exist while the page is rendered on the server and while it is hydrated,
  // so it is read only after mounting.
  onMount(() => {
    openBillFromAddress();
    window.addEventListener("hashchange", openBillFromAddress);

    onCleanup(() => {
      window.removeEventListener("hashchange", openBillFromAddress);
    });
  });

  return (
    <LocaleContext.Provider value={{ locale, messages }}>
      <PageHeader
        bill={bill()}
        currency={currency()}
        onCurrencyChange={changeCurrency}
      />
      <LinkNotice
        text={notice().text}
        isHidden={notice().isHidden}
        onClose={hideNotice}
      />
      <div class="layout">
        <div class="layout-main">
          <ParticipantsSection
            bill={bill()}
            currency={currency()}
            onBillChange={changeBill}
          />
          <ExpensesSection
            bill={bill()}
            currency={currency()}
            onBillChange={changeBill}
          />
        </div>
        <div class="layout-side">
          <SummarySection bill={bill()} currency={currency()} />
          <ShareSection
            bill={bill()}
            currency={currency()}
            onBillChange={changeBill}
          />
        </div>
      </div>
    </LocaleContext.Provider>
  );
}
