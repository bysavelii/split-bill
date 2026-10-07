import { describe, expect, it } from "vitest";
import type { Balance } from "../settlement/balances";
import {
  describeParticipantTotals,
  describeTransferCount,
} from "./settlement-explanation";

function normalize(text: string): string {
  return text.replace(/\s/gu, " ");
}

function createBalance(paid: number, share: number): Balance {
  return { participantId: "anna", paid, share, amount: paid - share };
}

describe("describeParticipantTotals", () => {
  it("пишет «получает», когда заплачено больше доли", () => {
    const text = describeParticipantTotals(
      "Аня",
      createBalance(90_000, 30_000),
    );

    expect(normalize(text)).toBe(
      "Аня: заплачено 900,00 ₽, доля 300,00 ₽ — получает 600,00 ₽",
    );
  });

  it("пишет «отдаёт» с суммой по модулю, когда заплачено меньше доли", () => {
    const text = describeParticipantTotals("Боря", createBalance(0, 30_000));

    expect(normalize(text)).toBe(
      "Боря: заплачено 0,00 ₽, доля 300,00 ₽ — отдаёт 300,00 ₽",
    );
  });

  it("пишет «в расчёте», когда заплачено ровно по доле", () => {
    const text = describeParticipantTotals("Вера", createBalance(5_000, 5_000));

    expect(normalize(text)).toBe(
      "Вера: заплачено 50,00 ₽, доля 50,00 ₽ — в расчёте",
    );
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
