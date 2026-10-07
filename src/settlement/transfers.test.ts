import { describe, expect, it } from "vitest";
import type { Balance } from "./balances";
import { calculateTransfers } from "./transfers";

function createBalances(amounts: readonly number[]): Balance[] {
  return amounts.map((amount, index) => ({
    participantId: `p${String(index)}`,
    amount,
  }));
}

function applyTransfers(balances: readonly Balance[]): number[] {
  const transfers = calculateTransfers(balances);
  const remaining = new Map(
    balances.map((balance) => [balance.participantId, balance.amount]),
  );

  for (const transfer of transfers) {
    remaining.set(
      transfer.fromId,
      (remaining.get(transfer.fromId) ?? 0) + transfer.amount,
    );
    remaining.set(
      transfer.toId,
      (remaining.get(transfer.toId) ?? 0) - transfer.amount,
    );
  }

  return [...remaining.values()];
}

describe("calculateTransfers", () => {
  it("не создаёт переводов при нулевых балансах", () => {
    expect(calculateTransfers(createBalances([0, 0, 0]))).toEqual([]);
  });

  it("собирает переводы двух должников одному кредитору", () => {
    const transfers = calculateTransfers(
      createBalances([60_000, -30_000, -30_000]),
    );

    expect(transfers).toEqual([
      { fromId: "p1", toId: "p0", amount: 30_000 },
      { fromId: "p2", toId: "p0", amount: 30_000 },
    ]);
  });

  it("делит долг одного должника между кредиторами", () => {
    const transfers = calculateTransfers(createBalances([-100, 30, 70]));

    expect(transfers).toEqual([
      { fromId: "p0", toId: "p1", amount: 30 },
      { fromId: "p0", toId: "p2", amount: 70 },
    ]);
  });

  it.each([
    [[60_000, -30_000, -30_000]],
    [[-100, 30, 70]],
    [[500, -200, 100, -450, 50]],
    [[1, -1, 0, 3, -3]],
  ])("после применения переводов балансы %j обнуляются", (amounts) => {
    const balances = createBalances(amounts);

    const remaining = applyTransfers(balances);

    expect(remaining.every((amount) => amount === 0)).toBe(true);
  });
});
