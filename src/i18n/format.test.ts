import { describe, expect, it } from "vitest";
import {
  formatCount,
  formatMoney,
  formatNumber,
  readCurrencySymbol,
  type PluralForms,
} from "./format";

const RUSSIAN_TRANSFER_FORMS: PluralForms = {
  one: "перевод",
  few: "перевода",
  many: "переводов",
  other: "перевода",
};
const RUSSIAN_PERSON_FORMS: PluralForms = {
  one: "человек",
  few: "человека",
  many: "человек",
  other: "человека",
};
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
    [1, "1 перевод"],
    [2, "2 перевода"],
    [5, "5 переводов"],
    [11, "11 переводов"],
    [21, "21 перевод"],
    [22, "22 перевода"],
    [25, "25 переводов"],
  ])("inflects transfers for %i", (count, expected) => {
    expect(formatCount(count, RUSSIAN_TRANSFER_FORMS, "ru")).toBe(expected);
  });

  it.each([
    [1, "1 человек"],
    [2, "2 человека"],
    [5, "5 человек"],
    [11, "11 человек"],
    [21, "21 человек"],
    [22, "22 человека"],
    [25, "25 человек"],
  ])("inflects people for %i", (count, expected) => {
    expect(formatCount(count, RUSSIAN_PERSON_FORMS, "ru")).toBe(expected);
  });

  it("groups thousands with a space", () => {
    const text = formatCount(1000, RUSSIAN_TRANSFER_FORMS, "ru");

    expect(normalize(text)).toBe("1 000 переводов");
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
