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
  /** Where the page of the language lives, relative to the site base: empty for the root page. */
  readonly pagePath: string;
  /** The currency of a new bill and of an old link without a currency. */
  readonly defaultCurrency: Currency;
  /** The value of the `og:locale` meta tag. */
  readonly openGraphLocale: string;
}

export const LOCALE_DEFINITIONS: Record<Locale, LocaleDefinition> = {
  en: {
    languageTag: "en-US",
    ownName: "English",
    pagePath: "",
    defaultCurrency: "USD",
    openGraphLocale: "en_US",
  },
  ru: {
    languageTag: "ru-RU",
    ownName: "Русский",
    pagePath: "ru/",
    defaultCurrency: "RUB",
    openGraphLocale: "ru_RU",
  },
};

const PATH_SEPARATOR = "/";

/**
 * The value of the `[...locale]` route parameter for the page of a language: `pagePath` without
 * the trailing slash, `undefined` for the root page. The route and the links share `pagePath`.
 */
export function buildRouteParameter(locale: Locale): string | undefined {
  const { pagePath } = LOCALE_DEFINITIONS[locale];
  if (pagePath === "") return undefined;

  return pagePath.endsWith(PATH_SEPARATOR) ? pagePath.slice(0, -1) : pagePath;
}
