import { describe, expect, it } from "vitest";
import type { Bill } from "../bill/bill";
import type { Currency } from "../bill/currency";
import { DICTIONARIES } from "../i18n/dictionaries";
import { formatMoney, type PluralForms } from "../i18n/format";
import type { Locale } from "../i18n/locales";
import type { AmountFormatter } from "./amount-formatter";
import {
  describeBalanceOutcome,
  describeTransferCount,
  formatTransferCount,
  listBreakdownNotes,
} from "./settlement-explanation";

const MINUS_SIGN = "\u2212";
const RU = DICTIONARIES.ru;
// dictionaries.test.ts guarantees that the Russian sets have all four forms.
const RUSSIAN_TRANSFER_FORMS = RU.plurals.transfers as Required<PluralForms>;
const RUSSIAN_PERSON_FORMS = RU.plurals.people as Required<PluralForms>;

interface ExplanationCase {
  readonly locale: Locale;
  readonly currency: Currency;
  readonly receives: string;
  readonly gives: string;
  readonly balanced: string;
  readonly usualTransfers: string;
  readonly groupedTransfers: string;
  readonly approximateTransfers: string;
  readonly transferCounts: readonly (readonly [number, string])[];
  readonly roundingNote: string;
}

const CASES: readonly ExplanationCase[] = [
  {
    locale: "ru",
    currency: "RUB",
    receives: RU.summary.receives("600,00 ₽"),
    gives: RU.summary.gives("300,00 ₽"),
    balanced: RU.summary.balanced,
    usualTransfers: RU.summary.reasonMinimal(
      `2 ${RUSSIAN_TRANSFER_FORMS.few}`,
      `3 ${RUSSIAN_PERSON_FORMS.few}`,
    ),
    groupedTransfers: RU.summary.reasonGroups(
      `2 ${RUSSIAN_TRANSFER_FORMS.few}`,
      "3",
      `4 ${RUSSIAN_PERSON_FORMS.few}`,
    ),
    approximateTransfers: RU.summary.reasonApproximate(
      `19 ${RUSSIAN_TRANSFER_FORMS.many}`,
      `20 ${RUSSIAN_PERSON_FORMS.many}`,
    ),
    transferCounts: [
      [1, `1 ${RUSSIAN_TRANSFER_FORMS.one}`],
      [2, `2 ${RUSSIAN_TRANSFER_FORMS.few}`],
      [5, `5 ${RUSSIAN_TRANSFER_FORMS.many}`],
    ],
    roundingNote: RU.roundingNote.RUB,
  },
  {
    locale: "en",
    currency: "USD",
    receives: "receives +$600.00",
    gives: `gives ${MINUS_SIGN}$300.00`,
    balanced: "even",
    usualTransfers:
      "2 transfers — it can't be fewer: 3 people give or receive money, and when they can't be split into groups that settle among themselves, you need one transfer fewer than there are people.",
    groupedTransfers:
      "2 transfers instead of the usual 3: 4 people give or receive money, but they split into groups that settle among themselves. It can't be fewer.",
    approximateTransfers:
      "19 transfers: 20 people give or receive money. In such a big group the transfers are picked in a simplified way — fewer might be possible.",
    transferCounts: [
      [1, "1 transfer"],
      [2, "2 transfers"],
      [5, "5 transfers"],
    ],
    roundingNote:
      "When an expense doesn't split evenly to the cent, those higher in the participant list get a share one cent larger.",
  },
];

const BILL_WITH_UNEVEN_SPLIT: Bill = {
  participants: [
    { id: "anna", name: "Anna" },
    { id: "boris", name: "Boris" },
  ],
  expenses: [
    {
      id: "coffee",
      payerId: "anna",
      amount: 101,
      beneficiaryIds: ["anna", "boris"],
    },
  ],
};

const BILL_WITH_EVEN_SPLIT: Bill = {
  participants: BILL_WITH_UNEVEN_SPLIT.participants,
  expenses: [
    {
      id: "coffee",
      payerId: "anna",
      amount: 100,
      beneficiaryIds: ["anna", "boris"],
    },
  ],
};

function normalize(text: string): string {
  return text.replace(/\s/gu, " ");
}

describe.each(CASES)("explanation in $locale and $currency", (explanation) => {
  const { locale, currency } = explanation;
  const messages = DICTIONARIES[locale];
  const localization = { locale, messages };
  const formatAmount: AmountFormatter = (amount) =>
    formatMoney(amount, currency, locale);

  describe("describeBalanceOutcome", () => {
    it("writes what the participant receives with a plus sign when they are owed", () => {
      const outcome = describeBalanceOutcome(
        60_000,
        formatAmount,
        localization,
      );

      expect(outcome.kind).toBe("receives");
      expect(normalize(outcome.text)).toBe(explanation.receives);
    });

    it("writes what the participant gives with a real minus and the absolute amount when they owe", () => {
      const outcome = describeBalanceOutcome(
        -30_000,
        formatAmount,
        localization,
      );

      expect(outcome.kind).toBe("gives");
      expect(outcome.text).toContain(MINUS_SIGN);
      expect(normalize(outcome.text)).toBe(explanation.gives);
    });

    it("says the participant is settled when the balance is zero", () => {
      expect(describeBalanceOutcome(0, formatAmount, localization)).toEqual({
        kind: "settled",
        text: explanation.balanced,
      });
    });
  });

  describe("describeTransferCount", () => {
    it("explains the usual number of transfers", () => {
      const text = describeTransferCount(
        { transferCount: 2, settlingCount: 3, isMinimal: true },
        localization,
      );

      expect(text).toBe(explanation.usualTransfers);
    });

    it("explains that there are fewer transfers than usual because of groups", () => {
      const text = describeTransferCount(
        { transferCount: 2, settlingCount: 4, isMinimal: true },
        localization,
      );

      expect(text).toBe(explanation.groupedTransfers);
    });

    it("honestly says the minimum is not guaranteed", () => {
      const text = describeTransferCount(
        { transferCount: 19, settlingCount: 20, isMinimal: false },
        localization,
      );

      expect(text).toBe(explanation.approximateTransfers);
    });
  });

  describe("formatTransferCount", () => {
    it.each(explanation.transferCounts)(
      "writes %i with the word in the right form: %j",
      (count, expected) => {
        expect(formatTransferCount(count, localization)).toBe(expected);
      },
    );
  });

  describe("listBreakdownNotes", () => {
    it("adds the rounding note naming the minor unit when an expense does not split evenly", () => {
      const notes = listBreakdownNotes(
        BILL_WITH_UNEVEN_SPLIT,
        currency,
        localization,
      );

      expect(notes).toEqual([
        messages.summary.shareNote,
        explanation.roundingNote,
      ]);
    });

    it("leaves only the share note when every expense splits evenly", () => {
      const notes = listBreakdownNotes(
        BILL_WITH_EVEN_SPLIT,
        currency,
        localization,
      );

      expect(notes).toEqual([messages.summary.shareNote]);
    });
  });
});
