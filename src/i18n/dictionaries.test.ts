import { describe, expect, it } from "vitest";
import { CURRENCIES } from "../bill/currency";
import { DICTIONARIES } from "./dictionaries";
import { LOCALES, LOCALE_DEFINITIONS } from "./locales";

const LARGEST_COUNT_TO_CHECK = 1000;

function listPluralCategories(languageTag: string): Intl.LDMLPluralRule[] {
  const rules = new Intl.PluralRules(languageTag);
  const categories = new Set<Intl.LDMLPluralRule>();
  for (let count = 0; count <= LARGEST_COUNT_TO_CHECK; count += 1) {
    categories.add(rules.select(count));
  }

  return [...categories];
}

describe.each(LOCALES)("dictionary %s", (locale) => {
  const messages = DICTIONARIES[locale];
  const { languageTag } = LOCALE_DEFINITIONS[locale];

  describe.each(Object.entries(messages.plurals))(
    "plural set %s",
    (_, forms) => {
      it("has a form for every category the language uses for whole numbers", () => {
        const categories = listPluralCategories(languageTag);

        for (const category of categories) {
          expect(forms[category], `category ${category}`).toBeTruthy();
        }
      });

      it("has the form `other`", () => {
        expect(forms.other).not.toBe("");
      });
    },
  );

  it.each(CURRENCIES)("names the currency %s", (currency) => {
    expect(messages.currencyNames[currency]).not.toBe("");
  });

  it.each(CURRENCIES)("has a rounding note for the currency %s", (currency) => {
    expect(messages.roundingNote[currency]).not.toBe("");
  });
});
