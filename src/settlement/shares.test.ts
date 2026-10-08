import { describe, expect, it } from "vitest";
import type { Bill } from "../bill/bill";
import { hasUnevenSplit, splitAmount } from "./shares";

function sum(values: readonly number[]): number {
  return values.reduce((total, value) => total + value, 0);
}

describe("splitAmount", () => {
  it("splits evenly with no remainder", () => {
    expect(splitAmount(900, 3)).toEqual([300, 300, 300]);
  });

  it("hands out the remainder one kopeck at a time to the first in order", () => {
    expect(splitAmount(100, 3)).toEqual([34, 33, 33]);
  });

  it("gives the only kopeck to the first one", () => {
    expect(splitAmount(1, 2)).toEqual([1, 0]);
  });

  it.each([
    [10_000, 3],
    [1, 7],
    [12_345, 4],
    [99_999, 10],
  ])(
    "the sum of shares of %i split %i ways equals the expense amount",
    (amount, count) => {
      expect(sum(splitAmount(amount, count))).toBe(amount);
    },
  );

  it("rejects a number of shares below one", () => {
    expect(() => splitAmount(100, 0)).toThrow(RangeError);
  });

  it.each([0, -5, 1.5, Number.NaN])("rejects the amount %d", (amount) => {
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

  it("false without expenses", () => {
    expect(hasUnevenSplit({ participants: [], expenses: [] })).toBe(false);
  });

  it("false when an expense divides evenly", () => {
    expect(hasUnevenSplit(createBill(90_000))).toBe(false);
  });

  it("true when an expense does not divide evenly to the kopeck", () => {
    expect(hasUnevenSplit(createBill(10_000))).toBe(true);
  });
});
