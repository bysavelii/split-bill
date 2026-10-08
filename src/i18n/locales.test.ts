import { describe, expect, it } from "vitest";
import {
  buildRouteParameter,
  DEFAULT_LOCALE,
  LOCALE_DEFINITIONS,
  LOCALES,
} from "./locales";

describe("buildRouteParameter", () => {
  it("is absent for the page at the root", () => {
    expect(buildRouteParameter("en")).toBeUndefined();
  });

  it("is the folder of the page without the trailing slash", () => {
    expect(buildRouteParameter("ru")).toBe("ru");
  });

  it.each(LOCALES)(
    "leads to the same page as the page path of %s",
    (locale) => {
      const parameter = buildRouteParameter(locale);
      const routePath = parameter === undefined ? "" : `${parameter}/`;

      expect(routePath).toBe(LOCALE_DEFINITIONS[locale].pagePath);
    },
  );

  it("gives every language its own page", () => {
    const pagePaths = LOCALES.map(
      (locale) => LOCALE_DEFINITIONS[locale].pagePath,
    );

    expect(new Set(pagePaths).size).toBe(LOCALES.length);
  });

  it("puts only the default language at the root", () => {
    const rootLocales = LOCALES.filter(
      (locale) => LOCALE_DEFINITIONS[locale].pagePath === "",
    );

    expect(rootLocales).toEqual([DEFAULT_LOCALE]);
  });
});
