import { describe, expect, it } from "vitest";
import {
  calculateTotalSpent,
  type Bill,
  type Expense,
  type Participant,
} from "../bill/bill";
import { calculateBalances } from "./balances";

const ann: Participant = { id: "ann", name: "Ann" };
const ben: Participant = { id: "ben", name: "Ben" };
const clara: Participant = { id: "clara", name: "Clara" };

function createBill(expenses: readonly Expense[]): Bill {
  return { participants: [ann, ben, clara], expenses };
}

function sumBalances(bill: Bill): number {
  return calculateBalances(bill).reduce(
    (total, balance) => total + balance.amount,
    0,
  );
}

describe("calculateBalances", () => {
  it("gives zero balances in participant order without expenses", () => {
    expect(calculateBalances(createBill([]))).toEqual([
      { participantId: "ann", paid: 0, share: 0, amount: 0 },
      { participantId: "ben", paid: 0, share: 0, amount: 0 },
      { participantId: "clara", paid: 0, share: 0, amount: 0 },
    ]);
  });

  it("accounts for the expenses of one payer for everyone", () => {
    const bill = createBill([
      {
        id: "1",
        payerId: "ann",
        amount: 90_000,
        beneficiaryIds: ["ann", "ben", "clara"],
      },
    ]);

    expect(calculateBalances(bill)).toEqual([
      { participantId: "ann", paid: 90_000, share: 30_000, amount: 60_000 },
      { participantId: "ben", paid: 0, share: 30_000, amount: -30_000 },
      { participantId: "clara", paid: 0, share: 30_000, amount: -30_000 },
    ]);
  });

  it("accounts for an expense that is not for all participants", () => {
    const bill = createBill([
      {
        id: "1",
        payerId: "ben",
        amount: 5_000,
        beneficiaryIds: ["ann", "ben"],
      },
    ]);

    expect(calculateBalances(bill)).toEqual([
      { participantId: "ann", paid: 0, share: 2_500, amount: -2_500 },
      { participantId: "ben", paid: 5_000, share: 2_500, amount: 2_500 },
      { participantId: "clara", paid: 0, share: 0, amount: 0 },
    ]);
  });

  it("gives the extra kopeck to the first recipient", () => {
    const bill = createBill([
      {
        id: "1",
        payerId: "ann",
        amount: 10_000,
        beneficiaryIds: ["ann", "ben", "clara"],
      },
    ]);

    expect(calculateBalances(bill).map((balance) => balance.amount)).toEqual([
      6_666, -3_333, -3_333,
    ]);
  });

  it("gives a zero sum of balances for any expenses", () => {
    const bill = createBill([
      {
        id: "1",
        payerId: "ann",
        amount: 10_001,
        beneficiaryIds: ["ann", "ben", "clara"],
      },
      {
        id: "2",
        payerId: "clara",
        amount: 777,
        beneficiaryIds: ["ben", "clara"],
      },
      {
        id: "3",
        payerId: "ben",
        amount: 1,
        beneficiaryIds: ["ann", "clara"],
      },
    ]);

    expect(sumBalances(bill)).toBe(0);
  });

  describe("on a bill with several expenses", () => {
    const bill = createBill([
      {
        id: "1",
        payerId: "ann",
        amount: 10_001,
        beneficiaryIds: ["ann", "ben", "clara"],
      },
      {
        id: "2",
        payerId: "ann",
        amount: 777,
        beneficiaryIds: ["ben", "clara"],
      },
      {
        id: "3",
        payerId: "ben",
        amount: 1,
        beneficiaryIds: ["ann", "clara"],
      },
    ]);

    it("the sum of shares equals the total of expenses", () => {
      const totalShare = calculateBalances(bill).reduce(
        (total, balance) => total + balance.share,
        0,
      );

      expect(totalShare).toBe(calculateTotalSpent(bill));
    });

    it("the amount paid by a payer equals the sum of their expenses", () => {
      const annBalance = calculateBalances(bill)[0];

      expect(annBalance?.paid).toBe(10_001 + 777);
    });

    it("each participant's outcome equals paid minus share", () => {
      for (const balance of calculateBalances(bill)) {
        expect(balance.amount).toBe(balance.paid - balance.share);
      }
    });
  });
});
