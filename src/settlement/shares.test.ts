import { describe, expect, it } from "vitest";
import type { Bill } from "../bill/bill";
import { hasUnevenSplit, splitAmount } from "./shares";

function sum(values: readonly number[]): number {
  return values.reduce((total, value) => total + value, 0);
}

describe("splitAmount", () => {
  it("делит поровну без остатка", () => {
    expect(splitAmount(900, 3)).toEqual([300, 300, 300]);
  });

  it("раздаёт остаток по копейке первым по порядку", () => {
    expect(splitAmount(100, 3)).toEqual([34, 33, 33]);
  });

  it("отдаёт единственную копейку первому", () => {
    expect(splitAmount(1, 2)).toEqual([1, 0]);
  });

  it.each([
    [10_000, 3],
    [1, 7],
    [12_345, 4],
    [99_999, 10],
  ])("сумма долей %i на %i равна сумме траты", (amount, count) => {
    expect(sum(splitAmount(amount, count))).toBe(amount);
  });

  it("не принимает число долей меньше единицы", () => {
    expect(() => splitAmount(100, 0)).toThrow(RangeError);
  });

  it.each([0, -5, 1.5, Number.NaN])("не принимает сумму %d", (amount) => {
    expect(() => splitAmount(amount, 2)).toThrow(RangeError);
  });
});

describe("hasUnevenSplit", () => {
  function createBill(amount: number): Bill {
    return {
      participants: [
        { id: "anna", name: "Аня" },
        { id: "boris", name: "Боря" },
        { id: "vera", name: "Вера" },
      ],
      expenses: [
        {
          id: "1",
          payerId: "anna",
          amount,
          beneficiaryIds: ["anna", "boris", "vera"],
        },
      ],
    };
  }

  it("без трат ложь", () => {
    expect(hasUnevenSplit({ participants: [], expenses: [] })).toBe(false);
  });

  it("ложь, когда трата делится поровну", () => {
    expect(hasUnevenSplit(createBill(90_000))).toBe(false);
  });

  it("истина, когда трата не делится поровну до копейки", () => {
    expect(hasUnevenSplit(createBill(10_000))).toBe(true);
  });
});
