import { describe, expect, it } from "vitest";
import {
  describeBalanceOutcome,
  describeTransferCount,
  formatTransferCount,
} from "./settlement-explanation";

function normalize(text: string): string {
  return text.replace(/\s/gu, " ");
}

describe("describeBalanceOutcome", () => {
  it("пишет «получает» со знаком плюс, когда участнику должны", () => {
    const outcome = describeBalanceOutcome(60_000);

    expect(outcome.kind).toBe("receives");
    expect(normalize(outcome.text)).toBe("получает +600,00 ₽");
  });

  it("пишет «отдаёт» с настоящим минусом и суммой по модулю, когда должен он", () => {
    const outcome = describeBalanceOutcome(-30_000);

    expect(outcome.kind).toBe("gives");
    expect(normalize(outcome.text)).toBe("отдаёт \u2212300,00 ₽");
  });

  it("пишет «в расчёте», когда баланс нулевой", () => {
    expect(describeBalanceOutcome(0)).toEqual({
      kind: "settled",
      text: "в расчёте",
    });
  });
});

describe("describeTransferCount", () => {
  it("объясняет обычное число переводов", () => {
    const text = describeTransferCount({
      transferCount: 2,
      settlingCount: 3,
      isMinimal: true,
    });

    expect(text).toBe(
      "2 перевода — меньше не получится: деньги отдают или получают 3 человека, а когда их нельзя разбить на группы, которые рассчитываются между собой, переводов нужно на один меньше, чем людей.",
    );
  });

  it("объясняет, что переводов меньше обычного из-за групп", () => {
    const text = describeTransferCount({
      transferCount: 2,
      settlingCount: 4,
      isMinimal: true,
    });

    expect(text).toBe(
      "2 перевода вместо обычных 3: деньги отдают или получают 4 человека, но они делятся на группы, которые рассчитываются между собой. Меньше не получится.",
    );
  });

  it("честно говорит, что минимум не гарантирован", () => {
    const text = describeTransferCount({
      transferCount: 19,
      settlingCount: 20,
      isMinimal: false,
    });

    expect(text).toBe(
      "19 переводов: деньги отдают или получают 20 человек. В такой большой компании переводы подобраны упрощённо — возможно, получится обойтись меньшим числом.",
    );
  });
});

describe("formatTransferCount", () => {
  it.each([
    [1, "1 перевод"],
    [2, "2 перевода"],
    [5, "5 переводов"],
  ])("для %i пишет «%s»", (count, expected) => {
    expect(formatTransferCount(count)).toBe(expected);
  });
});
