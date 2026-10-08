import { For } from "solid-js";
import { CURRENCIES, isCurrency, type Currency } from "../bill/currency";
import { useLocale } from "./locale-context";
import { SelectBox } from "./select-box";

const CURRENCY_SELECT_ID = "bill-currency";

export interface CurrencySelectProps {
  readonly currency: Currency;
  readonly onCurrencyChange: (currency: Currency) => void;
}

/** Chooses the currency of the bill; the name of the control is read out but not shown. */
export function CurrencySelect(props: CurrencySelectProps) {
  const { messages } = useLocale();

  function changeCurrency(chosenValue: string): void {
    if (!isCurrency(chosenValue)) return;

    props.onCurrencyChange(chosenValue);
  }

  return (
    <div class="currency-select">
      <label class="visually-hidden" for={CURRENCY_SELECT_ID}>
        {messages.currencyLabel}
      </label>
      <SelectBox>
        <select
          id={CURRENCY_SELECT_ID}
          onChange={(event) => {
            changeCurrency(event.currentTarget.value);
          }}
        >
          <For each={CURRENCIES}>
            {(currency) => (
              <option value={currency} selected={currency === props.currency}>
                {messages.currencyNames[currency]}
              </option>
            )}
          </For>
        </select>
      </SelectBox>
    </div>
  );
}
