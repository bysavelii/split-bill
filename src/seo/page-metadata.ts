/** What the head of a page tells search engines and link previews. Pure: the page only prints it. */
import { DICTIONARIES } from "../i18n/dictionaries";
import {
  DEFAULT_LOCALE,
  LOCALE_DEFINITIONS,
  LOCALES,
  type Locale,
} from "../i18n/locales";

export const PREVIEW_IMAGE_WIDTH = 1200;
export const PREVIEW_IMAGE_HEIGHT = 630;
/** The `hreflang` value of the page for visitors whose language the site does not have. */
export const DEFAULT_ALTERNATE_LANGUAGE = "x-default";

export interface PageAlternate {
  /** A language code or `x-default`. */
  readonly language: string;
  readonly url: string;
}

export interface StructuredData {
  readonly "@context": string;
  readonly "@type": string;
  readonly name: string;
  readonly description: string;
  readonly url: string;
  readonly inLanguage: Locale;
  readonly applicationCategory: string;
  readonly operatingSystem: string;
  readonly isAccessibleForFree: boolean;
}

export interface PageMetadata {
  readonly title: string;
  readonly description: string;
  readonly siteName: string;
  readonly canonicalUrl: string;
  readonly alternates: readonly PageAlternate[];
  readonly imageUrl: string;
  readonly imageAlt: string;
  readonly openGraphLocale: string;
  readonly alternateOpenGraphLocales: readonly string[];
  readonly structuredData: StructuredData;
}

export interface PageMetadataInput {
  readonly locale: Locale;
  /** The site address with the base path and a trailing slash. */
  readonly siteRoot: URL;
}

export function buildPageMetadata(input: PageMetadataInput): PageMetadata {
  const { locale, siteRoot } = input;
  const { seo, header } = DICTIONARIES[locale];
  const canonicalUrl = buildPageUrl(locale, siteRoot);
  const otherLocales = LOCALES.filter((candidate) => candidate !== locale);

  return {
    title: seo.title,
    description: seo.description,
    siteName: header.title,
    canonicalUrl,
    alternates: buildAlternates(siteRoot),
    imageUrl: new URL(buildPreviewImageFileName(locale), siteRoot).href,
    imageAlt: seo.imageAlt,
    openGraphLocale: LOCALE_DEFINITIONS[locale].openGraphLocale,
    alternateOpenGraphLocales: otherLocales.map(
      (otherLocale) => LOCALE_DEFINITIONS[otherLocale].openGraphLocale,
    ),
    structuredData: {
      "@context": "https://schema.org",
      "@type": "WebApplication",
      name: header.title,
      description: seo.description,
      url: canonicalUrl,
      inLanguage: locale,
      applicationCategory: "FinanceApplication",
      operatingSystem: "Any",
      isAccessibleForFree: true,
    },
  };
}

/**
 * JSON for a `<script type="application/ld+json">`: a `<` is escaped, so a text with
 * `</script>` cannot close the tag early.
 */
export function serializeStructuredData(data: StructuredData): string {
  return JSON.stringify(data).replaceAll("<", "\\u003c");
}

/** The files in `public/`, one per language. */
function buildPreviewImageFileName(locale: Locale): string {
  return `og-image-${locale}.png`;
}

function buildPageUrl(locale: Locale, siteRoot: URL): string {
  return new URL(LOCALE_DEFINITIONS[locale].pagePath, siteRoot).href;
}

function buildAlternates(siteRoot: URL): PageAlternate[] {
  const languageAlternates = LOCALES.map((locale) => ({
    language: locale,
    url: buildPageUrl(locale, siteRoot),
  }));
  const defaultAlternate = {
    language: DEFAULT_ALTERNATE_LANGUAGE,
    url: buildPageUrl(DEFAULT_LOCALE, siteRoot),
  };

  return [...languageAlternates, defaultAlternate];
}
