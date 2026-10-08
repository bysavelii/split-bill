import { getContainerRenderer } from "@astrojs/solid-js/container-renderer";
import { experimental_AstroContainer as AstroContainer } from "astro/container";
import { loadRenderers } from "astro:container";
import { JSDOM } from "jsdom";
import { beforeAll, describe, expect, it } from "vitest";
import { DICTIONARIES } from "../i18n/dictionaries";
import { LOCALES, type Locale } from "../i18n/locales";
import {
  PREVIEW_IMAGE_HEIGHT,
  PREVIEW_IMAGE_WIDTH,
} from "../seo/page-metadata";
import LocalePage from "./[...locale].astro";

const SITE = "https://bysavelii.github.io";
const ENGLISH_URL = `${SITE}/`;
const RUSSIAN_URL = `${SITE}/ru/`;

// The container does not know the base path: `import.meta.env.BASE_URL` is `/` there, so the
// addresses sit right under the site origin.
let container: AstroContainer;

beforeAll(async () => {
  const renderers = await loadRenderers([getContainerRenderer()]);
  container = await AstroContainer.create({
    renderers,
    astroConfig: { site: SITE },
  });
});

async function renderPage(locale: Locale): Promise<Document> {
  const html = await container.renderToString(LocalePage, {
    props: { locale },
  });

  return new JSDOM(html).window.document;
}

function readMeta(page: Document, selector: string): string | null {
  return page.querySelector(selector)?.getAttribute("content") ?? null;
}

function readLink(page: Document, selector: string): string | null {
  return page.querySelector(selector)?.getAttribute("href") ?? null;
}

describe.each(LOCALES)("the %s page", (locale) => {
  const messages = DICTIONARIES[locale];
  const pageUrl = locale === "en" ? ENGLISH_URL : RUSSIAN_URL;

  it("declares its language and title", async () => {
    const page = await renderPage(locale);

    expect(page.documentElement.lang).toBe(locale);
    expect(page.title).toBe(messages.seo.title);
  });

  it("describes itself and names its canonical address", async () => {
    const page = await renderPage(locale);

    expect(readMeta(page, 'meta[name="description"]')).toBe(
      messages.seo.description,
    );
    expect(readLink(page, 'link[rel="canonical"]')).toBe(pageUrl);
    expect(readMeta(page, 'meta[name="theme-color"]')).toBe("#0e7c66");
  });

  it("lists the pages of both languages and the default one", async () => {
    const page = await renderPage(locale);

    const alternates = [
      ...page.querySelectorAll('link[rel="alternate"][hreflang]'),
    ].map((link) => [link.getAttribute("hreflang"), link.getAttribute("href")]);

    expect(alternates).toEqual([
      ["en", ENGLISH_URL],
      ["ru", RUSSIAN_URL],
      ["x-default", ENGLISH_URL],
    ]);
  });

  it("carries the Open Graph tags with an absolute preview image", async () => {
    const page = await renderPage(locale);
    const imageUrl = `${SITE}/og-image-${locale}.png`;

    expect(readMeta(page, 'meta[property="og:type"]')).toBe("website");
    expect(readMeta(page, 'meta[property="og:site_name"]')).toBe(
      messages.header.title,
    );
    expect(readMeta(page, 'meta[property="og:title"]')).toBe(
      messages.seo.title,
    );
    expect(readMeta(page, 'meta[property="og:description"]')).toBe(
      messages.seo.description,
    );
    expect(readMeta(page, 'meta[property="og:url"]')).toBe(pageUrl);
    expect(readMeta(page, 'meta[property="og:image"]')).toBe(imageUrl);
    expect(readMeta(page, 'meta[property="og:image:width"]')).toBe(
      String(PREVIEW_IMAGE_WIDTH),
    );
    expect(readMeta(page, 'meta[property="og:image:height"]')).toBe(
      String(PREVIEW_IMAGE_HEIGHT),
    );
    expect(readMeta(page, 'meta[property="og:image:alt"]')).toBe(
      messages.seo.imageAlt,
    );
  });

  it("names its Open Graph locale and the alternate one", async () => {
    const page = await renderPage(locale);
    const expectedLocale = locale === "en" ? "en_US" : "ru_RU";
    const expectedAlternate = locale === "en" ? "ru_RU" : "en_US";

    expect(readMeta(page, 'meta[property="og:locale"]')).toBe(expectedLocale);
    expect(readMeta(page, 'meta[property="og:locale:alternate"]')).toBe(
      expectedAlternate,
    );
  });

  it("carries the Twitter card tags", async () => {
    const page = await renderPage(locale);

    expect(readMeta(page, 'meta[name="twitter:card"]')).toBe(
      "summary_large_image",
    );
    expect(readMeta(page, 'meta[name="twitter:title"]')).toBe(
      messages.seo.title,
    );
    expect(readMeta(page, 'meta[name="twitter:description"]')).toBe(
      messages.seo.description,
    );
    expect(readMeta(page, 'meta[name="twitter:image"]')).toBe(
      `${SITE}/og-image-${locale}.png`,
    );
    expect(readMeta(page, 'meta[name="twitter:image:alt"]')).toBe(
      messages.seo.imageAlt,
    );
  });

  it("describes the app as structured data", async () => {
    const page = await renderPage(locale);
    const script = page.querySelector('script[type="application/ld+json"]');

    const structuredData: unknown = JSON.parse(script?.textContent ?? "null");

    expect(structuredData).toMatchObject({
      "@context": "https://schema.org",
      "@type": "WebApplication",
      url: pageUrl,
      inLanguage: locale,
    });
  });

  it("has the heading, the subtitle and the steps without scripts", async () => {
    const page = await renderPage(locale);

    expect(page.querySelector("h1")?.textContent).toBe(messages.header.title);
    expect(page.querySelector(".page-subtitle")?.textContent).toBe(
      messages.header.subtitle,
    );
    expect(
      page.querySelector("main h2#how-it-works-heading")?.textContent,
    ).toBe(messages.howItWorks.heading);
    const steps = [...page.querySelectorAll(".how-it-works-steps li")].map(
      (step) => step.textContent,
    );
    expect(steps).toEqual(messages.howItWorks.steps);
  });
});
