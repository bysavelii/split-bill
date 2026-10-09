import { describe, expect, it } from "vitest";
import { DICTIONARIES } from "../i18n/dictionaries";
import { LOCALES } from "../i18n/locales";
import { buildPageMetadata, serializeStructuredData } from "./page-metadata";

const SITE_ROOT = new URL("https://split-bill.bysavelii.com/");
const ENGLISH_URL = SITE_ROOT.href;
const RUSSIAN_URL = "https://split-bill.bysavelii.com/ru/";
const MAX_TITLE_LENGTH = 60;
const MAX_DESCRIPTION_LENGTH = 160;

describe("buildPageMetadata", () => {
  it("puts the English page at the site root", () => {
    const metadata = buildPageMetadata({ locale: "en", siteRoot: SITE_ROOT });

    expect(metadata.canonicalUrl).toBe(ENGLISH_URL);
  });

  it("puts the Russian page under /ru/", () => {
    const metadata = buildPageMetadata({ locale: "ru", siteRoot: SITE_ROOT });

    expect(metadata.canonicalUrl).toBe(RUSSIAN_URL);
  });

  it.each(LOCALES)(
    "lists both languages and the default on the %s page",
    (locale) => {
      const metadata = buildPageMetadata({ locale, siteRoot: SITE_ROOT });

      expect(metadata.alternates).toEqual([
        { language: "en", url: ENGLISH_URL },
        { language: "ru", url: RUSSIAN_URL },
        { language: "x-default", url: ENGLISH_URL },
      ]);
    },
  );

  it("points each language to its own preview image", () => {
    const english = buildPageMetadata({ locale: "en", siteRoot: SITE_ROOT });
    const russian = buildPageMetadata({ locale: "ru", siteRoot: SITE_ROOT });

    expect(english.imageUrl).toBe(`${SITE_ROOT.href}og-image-en.png`);
    expect(russian.imageUrl).toBe(`${SITE_ROOT.href}og-image-ru.png`);
  });

  it("names the Open Graph locale of the page and of the other language", () => {
    const english = buildPageMetadata({ locale: "en", siteRoot: SITE_ROOT });
    const russian = buildPageMetadata({ locale: "ru", siteRoot: SITE_ROOT });

    expect(english.openGraphLocale).toBe("en_US");
    expect(english.alternateOpenGraphLocales).toEqual(["ru_RU"]);
    expect(russian.openGraphLocale).toBe("ru_RU");
    expect(russian.alternateOpenGraphLocales).toEqual(["en_US"]);
  });

  it.each(LOCALES)("takes the %s texts from the dictionary", (locale) => {
    const metadata = buildPageMetadata({ locale, siteRoot: SITE_ROOT });
    const { seo } = DICTIONARIES[locale];

    expect(metadata.title).toBe(seo.title);
    expect(metadata.description).toBe(seo.description);
    expect(metadata.imageAlt).toBe(seo.imageAlt);
  });

  it.each(LOCALES)(
    "keeps the %s texts short enough for search results",
    (locale) => {
      const { title, description } = buildPageMetadata({
        locale,
        siteRoot: SITE_ROOT,
      });

      expect(title.length).toBeLessThanOrEqual(MAX_TITLE_LENGTH);
      expect(description.length).toBeLessThanOrEqual(MAX_DESCRIPTION_LENGTH);
    },
  );

  it("describes the Russian page as a free web application in Russian", () => {
    const { structuredData } = buildPageMetadata({
      locale: "ru",
      siteRoot: SITE_ROOT,
    });

    expect(structuredData).toEqual({
      "@context": "https://schema.org",
      "@type": "WebApplication",
      name: DICTIONARIES.ru.header.title,
      description: DICTIONARIES.ru.seo.description,
      url: RUSSIAN_URL,
      inLanguage: "ru",
      applicationCategory: "FinanceApplication",
      operatingSystem: "Any",
      isAccessibleForFree: true,
    });
  });
});

describe("serializeStructuredData", () => {
  it("escapes the angle bracket and stays equal as JSON", () => {
    const { structuredData } = buildPageMetadata({
      locale: "en",
      siteRoot: SITE_ROOT,
    });
    const trickyData = {
      ...structuredData,
      description: "</script><script>alert(1)</script>",
    };

    const serialized = serializeStructuredData(trickyData);

    expect(serialized).not.toContain("<");
    expect(JSON.parse(serialized)).toEqual(trickyData);
  });
});
