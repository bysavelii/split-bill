import { describe, expect, it } from "vitest";
import type { Bill, Expense, Participant } from "../bill/bill";
import { calculateBalances, type Balance } from "./balances";
import {
  EXACT_SEARCH_LIMIT,
  calculateTransfers,
  type Transfer,
} from "./transfers";

function createBalances(amounts: readonly number[]): Balance[] {
  return amounts.map((amount, index) => ({
    participantId: `p${String(index)}`,
    paid: Math.max(amount, 0),
    share: Math.max(-amount, 0),
    amount,
  }));
}

function createPairs(pairCount: number): number[] {
  return Array.from({ length: pairCount }, (_, index) => [
    index + 1,
    -(index + 1),
  ]).flat();
}

function applyTransfers(
  balances: readonly Balance[],
  transfers: readonly Transfer[],
): number[] {
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

function expectSettled(balances: readonly Balance[]): void {
  const { transfers } = calculateTransfers(balances);

  const remaining = applyTransfers(balances, transfers);

  expect(remaining.every((amount) => amount === 0)).toBe(true);
  for (const transfer of transfers) {
    expect(Number.isInteger(transfer.amount)).toBe(true);
    expect(transfer.amount).toBeGreaterThan(0);
    expect(transfer.fromId).not.toBe(transfer.toId);
  }
}

const participants: Participant[] = [
  { id: "a", name: "А" },
  { id: "b", name: "Б" },
  { id: "c", name: "В" },
];

function planForBill(
  expenses: readonly Expense[],
  billParticipants: readonly Participant[] = participants,
) {
  const bill: Bill = { participants: billParticipants, expenses };
  const balances = calculateBalances(bill);
  return { balances, plan: calculateTransfers(balances) };
}

describe("calculateTransfers", () => {
  it("не создаёт переводов при нулевых балансах", () => {
    expect(calculateTransfers(createBalances([0, 0, 0]))).toEqual({
      transfers: [],
      isMinimal: true,
      settlingCount: 0,
    });
  });

  it("не создаёт переводов без балансов", () => {
    expect(calculateTransfers([])).toEqual({
      transfers: [],
      isMinimal: true,
      settlingCount: 0,
    });
  });

  it("собирает переводы двух должников одному кредитору", () => {
    const { transfers } = calculateTransfers(
      createBalances([60_000, -30_000, -30_000]),
    );

    expect(transfers).toEqual([
      { fromId: "p1", toId: "p0", amount: 30_000 },
      { fromId: "p2", toId: "p0", amount: 30_000 },
    ]);
  });

  it("делит долг одного должника между кредиторами", () => {
    const { transfers } = calculateTransfers(createBalances([-100, 30, 70]));

    expect(transfers).toEqual([
      { fromId: "p0", toId: "p1", amount: 30 },
      { fromId: "p0", toId: "p2", amount: 70 },
    ]);
  });

  it("находит меньше переводов, чем жадный проход", () => {
    const plan = calculateTransfers(createBalances([300, 200, -200, -300]));

    expect(plan).toEqual({
      transfers: [
        { fromId: "p2", toId: "p1", amount: 200 },
        { fromId: "p3", toId: "p0", amount: 300 },
      ],
      isMinimal: true,
      settlingCount: 4,
    });
  });

  it("разбивает на несколько групп и считает по группам", () => {
    const { transfers } = calculateTransfers(
      createBalances([100, -100, 50, -20, -30]),
    );

    expect(transfers).toEqual([
      { fromId: "p1", toId: "p0", amount: 100 },
      { fromId: "p3", toId: "p2", amount: 20 },
      { fromId: "p4", toId: "p2", amount: 30 },
    ]);
  });

  it.each([
    [[60_000, -30_000, -30_000]],
    [[-100, 30, 70]],
    [[500, -200, 100, -450, 50]],
    [[1, -1, 0, 3, -3]],
    [[300, 200, -200, -300]],
    [[100, -100, 50, -20, -30]],
  ])("после применения переводов балансы %j обнуляются", (amounts) => {
    expectSettled(createBalances(amounts));
  });

  it("не учитывает участников с нулевым балансом", () => {
    const { transfers, settlingCount } = calculateTransfers(
      createBalances([0, 5, 0, -5]),
    );

    expect(transfers).toEqual([{ fromId: "p3", toId: "p1", amount: 5 }]);
    expect(settlingCount).toBe(2);
  });

  it("на пределе точного поиска даёт перевод на каждую пару", () => {
    const balances = createBalances(createPairs(EXACT_SEARCH_LIMIT / 2));

    const plan = calculateTransfers(balances);

    expect(plan.transfers).toHaveLength(EXACT_SEARCH_LIMIT / 2);
    expect(plan.isMinimal).toBe(true);
    expectSettled(balances);
  });

  it("за пределом точного поиска обнуляет балансы, но минимум не гарантирует", () => {
    const amounts = [
      EXACT_SEARCH_LIMIT,
      ...Array<number>(EXACT_SEARCH_LIMIT).fill(-1),
    ];
    const balances = createBalances(amounts);

    const plan = calculateTransfers(balances);

    expect(plan.isMinimal).toBe(false);
    expect(plan.transfers.length).toBeLessThanOrEqual(amounts.length - 1);
    expectSettled(balances);
  });

  it("при повторном вызове даёт равный результат", () => {
    const balances = createBalances([300, 200, -200, -300, 0, 10, -10]);

    expect(calculateTransfers(balances)).toEqual(calculateTransfers(balances));
  });

  it("сортирует переводы по должнику, затем по получателю", () => {
    const { transfers } = calculateTransfers(
      createBalances([40, 60, -70, -30]),
    );

    expect(
      transfers.map((transfer) => [transfer.fromId, transfer.toId]),
    ).toEqual([
      ["p2", "p0"],
      ["p2", "p1"],
      ["p3", "p1"],
    ]);
  });

  it("не меняет входные данные", () => {
    const balances = createBalances([300, 200, -200, -300]);
    const snapshot = structuredClone(balances);
    for (const balance of balances) Object.freeze(balance);
    Object.freeze(balances);

    calculateTransfers(balances);

    expect(balances).toEqual(snapshot);
  });

  it.each([[[100, -90]], [[5]], [[1, 1]]])(
    "бросает RangeError, когда сумма балансов %j не нулевая",
    (amounts) => {
      expect(() => calculateTransfers(createBalances(amounts))).toThrow(
        RangeError,
      );
      expect(() => calculateTransfers(createBalances(amounts))).toThrow(
        "Сумма балансов должна быть нулевой",
      );
    },
  );
});

const PROPERTY_SEED = 20_240_607;
const PROPERTY_CASE_COUNT = 400;
const MIN_SETTLING_COUNT = 2;
const MAX_SETTLING_COUNT = 8;
/** Малый разброс балансов, чтобы группы с нулевой суммой встречались часто. */
const MAX_BALANCE_MAGNITUDE = 6;

/** Детерминированный генератор mulberry32: числа в [0, 1). */
function createRandom(seed: number): () => number {
  let state = seed;

  return () => {
    state = (state + 0x6d2b79f5) | 0;
    let mixed = Math.imul(state ^ (state >>> 15), 1 | state);
    mixed = (mixed + Math.imul(mixed ^ (mixed >>> 7), 61 | mixed)) ^ mixed;
    return ((mixed ^ (mixed >>> 14)) >>> 0) / 2 ** 32;
  };
}

function pickInteger(random: () => number, min: number, max: number): number {
  return min + Math.floor(random() * (max - min + 1));
}

function pickNonZeroBalance(random: () => number): number {
  const magnitude = pickInteger(random, 1, MAX_BALANCE_MAGNITUDE);
  return random() < 0.5 ? -magnitude : magnitude;
}

/** Набор ненулевых балансов с нулевой суммой: последний добирает остаток. */
function generateSettlingAmounts(random: () => number): number[] {
  for (;;) {
    const size = pickInteger(random, MIN_SETTLING_COUNT, MAX_SETTLING_COUNT);
    const amounts = Array.from({ length: size - 1 }, () =>
      pickNonZeroBalance(random),
    );
    const sum = amounts.reduce((total, amount) => total + amount, 0);

    if (sum !== 0 && Math.abs(sum) <= MAX_BALANCE_MAGNITUDE * 2) {
      return [...amounts, -sum];
    }
  }
}

/**
 * Эталон, независимый от реализации: наибольшее число групп с нулевой суммой,
 * на которые делится набор. Перебирает группу, в которую входит первый
 * участник, и рекурсивно делит остаток.
 */
function countMaxZeroSumGroups(amounts: readonly number[]): number {
  const [first, ...others] = amounts;
  if (first === undefined) return 0;

  let bestCount = 1;
  const choiceCount = 2 ** others.length;
  for (let choice = 1; choice < choiceCount - 1; choice += 1) {
    const withFirst = [first];
    const rest: number[] = [];
    others.forEach((amount, index) => {
      (((choice >> index) & 1) === 1 ? withFirst : rest).push(amount);
    });

    const groupSum = withFirst.reduce((total, amount) => total + amount, 0);
    if (groupSum === 0) {
      bestCount = Math.max(bestCount, 1 + countMaxZeroSumGroups(rest));
    }
  }

  return bestCount;
}

describe("минимальность числа переводов", () => {
  it("совпадает с «людей минус наибольшее число групп с нулевой суммой»", () => {
    const random = createRandom(PROPERTY_SEED);
    let multiGroupCaseCount = 0;

    for (let caseIndex = 0; caseIndex < PROPERTY_CASE_COUNT; caseIndex += 1) {
      const amounts = generateSettlingAmounts(random);
      const balances = createBalances(amounts);
      const groupCount = countMaxZeroSumGroups(amounts);

      const { transfers, settlingCount } = calculateTransfers(balances);

      expect(transfers).toHaveLength(amounts.length - groupCount);
      expect(settlingCount).toBe(amounts.length);
      expect(
        applyTransfers(balances, transfers).every((rest) => rest === 0),
      ).toBe(true);
      if (groupCount > 1) multiGroupCaseCount += 1;
    }

    expect(multiGroupCaseCount).toBeGreaterThan(0);
  });
});

describe("переводы по счёту", () => {
  const everyone = ["a", "b", "c"];

  it("один платил за всех: два перевода по трети", () => {
    const { plan } = planForBill([
      { id: "1", payerId: "a", amount: 90_000, beneficiaryIds: everyone },
    ]);

    expect(plan.transfers).toEqual([
      { fromId: "b", toId: "a", amount: 30_000 },
      { fromId: "c", toId: "a", amount: 30_000 },
    ]);
  });

  it("взаимные долги на равные суммы взаимно гасятся", () => {
    const { balances, plan } = planForBill(
      [
        { id: "1", payerId: "a", amount: 50_000, beneficiaryIds: ["b"] },
        { id: "2", payerId: "b", amount: 50_000, beneficiaryIds: ["a"] },
      ],
      participants.slice(0, 2),
    );

    expect(plan).toEqual({
      transfers: [],
      isMinimal: true,
      settlingCount: 0,
    });
    expect(balances.map((balance) => balance.amount)).toEqual([0, 0]);
  });

  it("взаимные долги на разные суммы дают один перевод на разницу", () => {
    const { plan } = planForBill(
      [
        { id: "1", payerId: "a", amount: 70_000, beneficiaryIds: ["b"] },
        { id: "2", payerId: "b", amount: 30_000, beneficiaryIds: ["a"] },
      ],
      participants.slice(0, 2),
    );

    expect(plan.transfers).toEqual([
      { fromId: "b", toId: "a", amount: 40_000 },
    ]);
  });

  it("100 рублей на троих: переводы по 33,33 и сходятся с балансом плательщика", () => {
    const { balances, plan } = planForBill([
      { id: "1", payerId: "a", amount: 10_000, beneficiaryIds: everyone },
    ]);

    expect(balances.map((balance) => balance.share)).toEqual([
      3_334, 3_333, 3_333,
    ]);
    expect(plan.transfers).toEqual([
      { fromId: "b", toId: "a", amount: 3_333 },
      { fromId: "c", toId: "a", amount: 3_333 },
    ]);
    const received = plan.transfers.reduce(
      (total, transfer) => total + transfer.amount,
      0,
    );
    expect(received).toBe(balances[0]?.amount);
  });

  it("0,01 рубля на двоих: перевод на копейку, если платил второй", () => {
    const { plan } = planForBill(
      [{ id: "1", payerId: "b", amount: 1, beneficiaryIds: ["a", "b"] }],
      participants.slice(0, 2),
    );

    expect(plan.transfers).toEqual([{ fromId: "a", toId: "b", amount: 1 }]);
  });

  it("0,01 рубля на двоих: все в расчёте, если платил первый", () => {
    const { plan } = planForBill(
      [{ id: "1", payerId: "a", amount: 1, beneficiaryIds: ["a", "b"] }],
      participants.slice(0, 2),
    );

    expect(plan.transfers).toEqual([]);
  });

  it("смешанный счёт с копейками обнуляется", () => {
    const { balances, plan } = planForBill([
      { id: "1", payerId: "a", amount: 10_001, beneficiaryIds: everyone },
      { id: "2", payerId: "c", amount: 777, beneficiaryIds: ["b", "c"] },
      { id: "3", payerId: "b", amount: 1, beneficiaryIds: ["a", "c"] },
    ]);

    const remaining = applyTransfers(balances, plan.transfers);

    expect(remaining.every((amount) => amount === 0)).toBe(true);
  });
});

describe("граничные случаи счёта", () => {
  it("один участник, платящий за себя: переводов нет", () => {
    const { balances, plan } = planForBill(
      [{ id: "1", payerId: "a", amount: 12_345, beneficiaryIds: ["a"] }],
      [{ id: "a", name: "А" }],
    );

    expect(balances.map((balance) => balance.amount)).toEqual([0]);
    expect(plan).toEqual({ transfers: [], isMinimal: true, settlingCount: 0 });
  });

  it("траты порядка миллиарда рублей считаются до копейки", () => {
    const billionRubles = 100_000_000_000;
    const { balances, plan } = planForBill([
      {
        id: "1",
        payerId: "a",
        amount: billionRubles + 1,
        beneficiaryIds: ["a", "b", "c"],
      },
    ]);

    const transferred = plan.transfers.reduce(
      (total, transfer) => total + transfer.amount,
      0,
    );
    const payerBalance = balances[0]?.amount ?? 0;

    expect(transferred).toBe(payerBalance);
    expect(plan.transfers).toHaveLength(2);
    expect(
      applyTransfers(balances, plan.transfers).every((amount) => amount === 0),
    ).toBe(true);
  });

  it("крупные балансы в точном поиске обнуляются", () => {
    const balances = createBalances([
      10_000_000_000_001, 5_000_000_000_000, -5_000_000_000_001,
      -10_000_000_000_000,
    ]);

    expect(calculateTransfers(balances).isMinimal).toBe(true);
    expectSettled(balances);
  });

  it("участник без трат остаётся с нулевым балансом и не участвует в переводах", () => {
    const { plan } = planForBill([
      { id: "1", payerId: "a", amount: 1_000, beneficiaryIds: ["a", "b"] },
    ]);

    expect(plan.settlingCount).toBe(2);
    expect(plan.transfers).toEqual([{ fromId: "b", toId: "a", amount: 500 }]);
  });
});
