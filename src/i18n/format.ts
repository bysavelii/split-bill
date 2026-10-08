import type { Currency } from "../bill/currency";
import { MINOR_UNITS_PER_UNIT, type Kopecks } from "../bill/money";
import { LOCALE_DEFINITIONS, type Locale } from "./locales";

/** Word forms by the plural categories of a language; `other` is the form for any category not listed. */
export type PluralForms = Readonly<
  Partial<Record<Intl.LDMLPluralRule, string>>
> & { readonly other: string };

const MONEY_FRACTION_DIGITS = 2;

const numberFormats: Record<Locale, Intl.NumberFormat> = {
  en: new Intl.NumberFormat(LOCALE_DEFINITIONS.en.languageTag),
  ru: new Intl.NumberFormat(LOCALE_DEFINITIONS.ru.languageTag),
};

const pluralRules: Record<Locale, Intl.PluralRules> = {
  en: new Intl.PluralRules(LOCALE_DEFINITIONS.en.languageTag),
  ru: new Intl.PluralRules(LOCALE_DEFINITIONS.ru.languageTag),
};

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
  return numberFormats[locale].format(value);
}

/** A number with the word in the right form: "2 transfers", "2 перевода", "5 человек". */
export function formatCount(
  count: number,
  forms: PluralForms,
  locale: Locale,
): string {
  const category = pluralRules[locale].select(count);
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
