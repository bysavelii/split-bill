import type { Currency } from "../bill/currency";
import { MINOR_UNITS_PER_UNIT, type Kopecks } from "../bill/money";
import { LOCALE_DEFINITIONS, type Locale } from "./locales";

/** Word forms by the plural categories of a language; `other` is the form for any category not listed. */
export type PluralForms = Readonly<
  Partial<Record<Intl.LDMLPluralRule, string>>
> & { readonly other: string };

const MONEY_FRACTION_DIGITS = 2;

/** A lookup that creates the `Intl` object of a language on first use, so a new language needs no entry here. */
function createLocaleLookup<Formatter>(
  createFormatter: (languageTag: string) => Formatter,
): (locale: Locale) => Formatter {
  const formatters = new Map<Locale, Formatter>();

  return (locale) => {
    const cachedFormatter = formatters.get(locale);
    if (cachedFormatter !== undefined) return cachedFormatter;

    const formatter = createFormatter(LOCALE_DEFINITIONS[locale].languageTag);
    formatters.set(locale, formatter);

    return formatter;
  };
}

const findNumberFormat = createLocaleLookup(
  (languageTag) => new Intl.NumberFormat(languageTag),
);
const findPluralRules = createLocaleLookup(
  (languageTag) => new Intl.PluralRules(languageTag),
);

const moneyFormats = new Map<string, Intl.NumberFormat>();

function findMoneyFormat(
  currency: Currency,
  locale: Locale,
): Intl.NumberFormat {
  const cacheKey = `${locale}/${currency}`;
  const cachedFormat = moneyFormats.get(cacheKey);
  if (cachedFormat !== undefined) return cachedFormat;

  const format = new Intl.NumberFormat(LOCALE_DEFINITIONS[locale].languageTag, {
    style: "currency",
    currency,
    currencyDisplay: "narrowSymbol",
    minimumFractionDigits: MONEY_FRACTION_DIGITS,
  });
  moneyFormats.set(cacheKey, format);

  return format;
}

/** A number with the digit grouping of the language: "1,000" or "1 000". */
export function formatNumber(value: number, locale: Locale): string {
  return findNumberFormat(locale).format(value);
}

/** A number with the word in the right form: "1 transfer", "2 transfers"; Russian needs the forms one, few and many. */
export function formatCount(
  count: number,
  forms: PluralForms,
  locale: Locale,
): string {
  const category = findPluralRules(locale).select(count);
  const form = forms[category] ?? forms.other;

  return `${formatNumber(count, locale)} ${form}`;
}

/** An amount in minor units as money: "$1,250.50", "1 250,50 ₽". */
export function formatMoney(
  amount: Kopecks,
  currency: Currency,
  locale: Locale,
): string {
  return findMoneyFormat(currency, locale).format(
    amount / MINOR_UNITS_PER_UNIT,
  );
}

/** The short sign of the currency in the language: "$", "₽". */
export function readCurrencySymbol(currency: Currency, locale: Locale): string {
  const parts = findMoneyFormat(currency, locale).formatToParts(0);
  const symbolPart = parts.find((part) => part.type === "currency");
  if (symbolPart === undefined) {
    throw new Error(`The format of ${currency} has no currency symbol`);
  }

  return symbolPart.value;
}
