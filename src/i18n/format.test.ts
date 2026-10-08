import { describe, expect, it } from "vitest";
import { DICTIONARIES } from "./dictionaries";
import {
  formatCount,
  formatMoney,
  formatNumber,
  readCurrencySymbol,
  type PluralForms,
} from "./format";

// dictionaries.test.ts guarantees that the Russian sets have all four forms.
const RUSSIAN_TRANSFER_FORMS = DICTIONARIES.ru.plurals
  .transfers as Required<PluralForms>;
const RUSSIAN_PERSON_FORMS = DICTIONARIES.ru.plurals
  .people as Required<PluralForms>;
const ENGLISH_PARTICIPANT_FORMS: PluralForms = {
  one: "participant",
  other: "participants",
};
const ENGLISH_EXPENSE_FORMS: PluralForms = {
  one: "expense",
  other: "expenses",
};

function normalize(text: string): string {
  return text.replace(/\s/gu, " ");
}

describe("formatCount in Russian", () => {
  it.each([
    [1, "one"],
    [2, "few"],
    [5, "many"],
    [11, "many"],
    [21, "one"],
    [22, "few"],
    [25, "many"],
  ] as const)("inflects transfers for %i", (count, category) => {
    const expected = `${String(count)} ${RUSSIAN_TRANSFER_FORMS[category]}`;

    expect(formatCount(count, RUSSIAN_TRANSFER_FORMS, "ru")).toBe(expected);
  });

  it.each([
    [1, "one"],
    [2, "few"],
    [5, "many"],
    [11, "many"],
    [21, "one"],
    [22, "few"],
    [25, "many"],
  ] as const)("inflects people for %i", (count, category) => {
    const expected = `${String(count)} ${RUSSIAN_PERSON_FORMS[category]}`;

    expect(formatCount(count, RUSSIAN_PERSON_FORMS, "ru")).toBe(expected);
  });

  it("groups thousands with a space", () => {
    const text = formatCount(1000, RUSSIAN_TRANSFER_FORMS, "ru");
    const expected = `1 000 ${RUSSIAN_TRANSFER_FORMS.many}`;

    expect(normalize(text)).toBe(expected);
  });
});

describe("formatCount in English", () => {
  it.each([
    [0, "0 participants"],
    [1, "1 participant"],
    [2, "2 participants"],
    [21, "21 participants"],
  ])("inflects participants for %i", (count, expected) => {
    expect(formatCount(count, ENGLISH_PARTICIPANT_FORMS, "en")).toBe(expected);
  });

  it("writes zero expenses in the plural", () => {
    expect(formatCount(0, ENGLISH_EXPENSE_FORMS, "en")).toBe("0 expenses");
  });

  it("groups thousands with a comma", () => {
    expect(formatCount(1000, ENGLISH_EXPENSE_FORMS, "en")).toBe(
      "1,000 expenses",
    );
  });
});

describe("formatCount fallback", () => {
  it("uses the form `other` for a category the forms do not list", () => {
    const forms: PluralForms = { other: "items" };

    expect(formatCount(1, forms, "en")).toBe("1 items");
  });
});

describe("formatNumber", () => {
  it("groups thousands by the rules of the language", () => {
    expect(formatNumber(1000, "en")).toBe("1,000");
    expect(normalize(formatNumber(1000, "ru"))).toBe("1 000");
  });
});

describe("formatMoney", () => {
  it.each([
    ["en", "USD", "$1,250.50"],
    ["en", "RUB", "₽1,250.50"],
    ["ru", "USD", "1 250,50 $"],
    ["ru", "RUB", "1 250,50 ₽"],
  ] as const)(
    "writes 1250.50 in %s and %s as %j",
    (locale, currency, expected) => {
      const text = formatMoney(125_050, currency, locale);

      expect(normalize(text)).toBe(expected);
    },
  );

  it.each([
    ["en", "USD", "$0.00"],
    ["en", "RUB", "₽0.00"],
    ["ru", "USD", "0,00 $"],
    ["ru", "RUB", "0,00 ₽"],
  ] as const)(
    "writes zero in %s and %s as %j",
    (locale, currency, expected) => {
      const text = formatMoney(0, currency, locale);

      expect(normalize(text)).toBe(expected);
    },
  );

  it.each([
    ["en", "USD", "$1,000,000,000,000.00"],
    ["ru", "RUB", "1 000 000 000 000,00 ₽"],
  ] as const)(
    "writes a very large amount in %s and %s as %j",
    (locale, currency, expected) => {
      const hugeAmount = 100_000_000_000_000;

      const text = formatMoney(hugeAmount, currency, locale);

      expect(normalize(text)).toBe(expected);
    },
  );

  it("always writes two digits after the separator", () => {
    expect(formatMoney(100, "USD", "en")).toBe("$1.00");
    expect(formatMoney(5, "USD", "en")).toBe("$0.05");
  });
});

describe("readCurrencySymbol", () => {
  it.each([
    ["en", "USD", "$"],
    ["en", "RUB", "₽"],
    ["ru", "USD", "$"],
    ["ru", "RUB", "₽"],
  ] as const)("in %s the symbol of %s is %j", (locale, currency, expected) => {
    expect(readCurrencySymbol(currency, locale)).toBe(expected);
  });
});
