import { describe, expect, it } from "vitest";
import {
  calculateTotalSpent,
  type Bill,
  type Expense,
  type Participant,
} from "../bill/bill";
import { calculateBalances } from "./balances";

const anna: Participant = { id: "anna", name: "Аня" };
const boris: Participant = { id: "boris", name: "Боря" };
const vera: Participant = { id: "vera", name: "Вера" };

function createBill(expenses: readonly Expense[]): Bill {
  return { participants: [anna, boris, vera], expenses };
}

function sumBalances(bill: Bill): number {
  return calculateBalances(bill).reduce(
    (total, balance) => total + balance.amount,
    0,
  );
}

describe("calculateBalances", () => {
  it("без трат даёт нулевые балансы в порядке участников", () => {
    expect(calculateBalances(createBill([]))).toEqual([
      { participantId: "anna", paid: 0, share: 0, amount: 0 },
      { participantId: "boris", paid: 0, share: 0, amount: 0 },
      { participantId: "vera", paid: 0, share: 0, amount: 0 },
    ]);
  });

  it("учитывает траты одного плательщика за всех", () => {
    const bill = createBill([
      {
        id: "1",
        payerId: "anna",
        amount: 90_000,
        beneficiaryIds: ["anna", "boris", "vera"],
      },
    ]);

    expect(calculateBalances(bill)).toEqual([
      { participantId: "anna", paid: 90_000, share: 30_000, amount: 60_000 },
      { participantId: "boris", paid: 0, share: 30_000, amount: -30_000 },
      { participantId: "vera", paid: 0, share: 30_000, amount: -30_000 },
    ]);
  });

  it("учитывает трату не на всех участников", () => {
    const bill = createBill([
      {
        id: "1",
        payerId: "boris",
        amount: 5_000,
        beneficiaryIds: ["anna", "boris"],
      },
    ]);

    expect(calculateBalances(bill)).toEqual([
      { participantId: "anna", paid: 0, share: 2_500, amount: -2_500 },
      { participantId: "boris", paid: 5_000, share: 2_500, amount: 2_500 },
      { participantId: "vera", paid: 0, share: 0, amount: 0 },
    ]);
  });

  it("отдаёт лишнюю копейку первому получателю", () => {
    const bill = createBill([
      {
        id: "1",
        payerId: "anna",
        amount: 10_000,
        beneficiaryIds: ["anna", "boris", "vera"],
      },
    ]);

    expect(calculateBalances(bill).map((balance) => balance.amount)).toEqual([
      6_666, -3_333, -3_333,
    ]);
  });

  it("даёт нулевую сумму балансов при любых тратах", () => {
    const bill = createBill([
      {
        id: "1",
        payerId: "anna",
        amount: 10_001,
        beneficiaryIds: ["anna", "boris", "vera"],
      },
      {
        id: "2",
        payerId: "vera",
        amount: 777,
        beneficiaryIds: ["boris", "vera"],
      },
      {
        id: "3",
        payerId: "boris",
        amount: 1,
        beneficiaryIds: ["anna", "vera"],
      },
    ]);

    expect(sumBalances(bill)).toBe(0);
  });

  describe("на счёте с несколькими тратами", () => {
    const bill = createBill([
      {
        id: "1",
        payerId: "anna",
        amount: 10_001,
        beneficiaryIds: ["anna", "boris", "vera"],
      },
      {
        id: "2",
        payerId: "anna",
        amount: 777,
        beneficiaryIds: ["boris", "vera"],
      },
      {
        id: "3",
        payerId: "boris",
        amount: 1,
        beneficiaryIds: ["anna", "vera"],
      },
    ]);

    it("сумма долей равна общей сумме трат", () => {
      const totalShare = calculateBalances(bill).reduce(
        (total, balance) => total + balance.share,
        0,
      );

      expect(totalShare).toBe(calculateTotalSpent(bill));
    });

    it("заплачено у плательщика равно сумме его трат", () => {
      const annaBalance = calculateBalances(bill)[0];

      expect(annaBalance?.paid).toBe(10_001 + 777);
    });

    it("итог каждого участника равен заплаченному минус доля", () => {
      for (const balance of calculateBalances(bill)) {
        expect(balance.amount).toBe(balance.paid - balance.share);
      }
    });
  });
});
