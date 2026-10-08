/** The interface languages. Plain data without framework imports: the Astro config reads this file too. */
import type { Currency } from "../bill/currency";

export const LOCALES = ["en", "ru"] as const;

export type Locale = (typeof LOCALES)[number];

export const DEFAULT_LOCALE: Locale = "en";

export interface LocaleDefinition {
  /** BCP 47 tag that `Intl` formats numbers and chooses plural forms by. */
  readonly languageTag: string;
  /** The name of the language in that language, as the language switch shows it. */
  readonly ownName: string;
  /** The currency of a new bill and of an old link without a currency. */
  readonly defaultCurrency: Currency;
  /** The value of the `og:locale` meta tag. */
  readonly openGraphLocale: string;
}

export const LOCALE_DEFINITIONS: Record<Locale, LocaleDefinition> = {
  en: {
    languageTag: "en-US",
    ownName: "English",
    defaultCurrency: "USD",
    openGraphLocale: "en_US",
  },
  ru: {
    languageTag: "ru-RU",
    ownName: "Русский",
    defaultCurrency: "RUB",
    openGraphLocale: "ru_RU",
  },
};
