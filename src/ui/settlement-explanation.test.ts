import { describe, expect, it } from "vitest";
import type { Bill } from "../bill/bill";
import type { Currency } from "../bill/currency";
import { DICTIONARIES } from "../i18n/dictionaries";
import { formatMoney } from "../i18n/format";
import type { Locale } from "../i18n/locales";
import type { AmountFormatter } from "./amount-formatter";
import {
  describeBalanceOutcome,
  describeTransferCount,
  formatTransferCount,
  listBreakdownNotes,
} from "./settlement-explanation";

const MINUS_SIGN = "\u2212";

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
    receives: "получает +600,00 ₽",
    gives: `отдаёт ${MINUS_SIGN}300,00 ₽`,
    balanced: "в расчёте",
    usualTransfers:
      "2 перевода — меньше не получится: деньги отдают или получают 3 человека, а когда их нельзя разбить на группы, которые рассчитываются между собой, переводов нужно на один меньше, чем людей.",
    groupedTransfers:
      "2 перевода вместо обычных 3: деньги отдают или получают 4 человека, но они делятся на группы, которые рассчитываются между собой. Меньше не получится.",
    approximateTransfers:
      "19 переводов: деньги отдают или получают 20 человек. В такой большой компании переводы подобраны упрощённо — возможно, получится обойтись меньшим числом.",
    transferCounts: [
      [1, "1 перевод"],
      [2, "2 перевода"],
      [5, "5 переводов"],
    ],
    roundingNote:
      "Когда трата не делится поровну до копейки, у тех, кто выше в списке участников, доля на копейку больше.",
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
