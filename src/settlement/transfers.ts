import type { ParticipantId } from "../bill/bill";
import type { Kopecks } from "../bill/money";
import type { Balance } from "./balances";

export interface Transfer {
  readonly fromId: ParticipantId;
  readonly toId: ParticipantId;
  readonly amount: Kopecks;
}

export interface TransferPlan {
  readonly transfers: readonly Transfer[];
  /** Число переводов гарантированно наименьшее (точный перебор). */
  readonly isMinimal: boolean;
  /** Сколько человек отдают или получают деньги: у остальных баланс нулевой. */
  readonly settlingCount: number;
}

/**
 * Предел точного поиска минимума. Перебор подмножеств удваивается на каждого
 * человека: при 16 участниках это около миллиона шагов, расчёт ещё мгновенный.
 */
export const EXACT_SEARCH_LIMIT = 16;

/** Старший бит 32-разрядного числа, с которым работает `Math.clz32`. */
const MAX_BIT_INDEX = 31;

interface OpenPosition {
  readonly participantId: ParticipantId;
  remaining: Kopecks;
}

/**
 * Переводов нужно «участники с ненулевым балансом» минус «наибольшее число
 * групп с нулевой суммой»: внутри каждой группы деньги сходятся без остатка.
 */
export function calculateTransfers(balances: readonly Balance[]): TransferPlan {
  assertZeroSum(balances);

  const settling = balances.filter((balance) => balance.amount !== 0);
  const isExactSearchAllowed = settling.length <= EXACT_SEARCH_LIMIT;
  const transfers = isExactSearchAllowed
    ? settleByGroups(settling)
    : settleGreedily(settling);

  return {
    transfers: sortTransfers(transfers, balances),
    isMinimal: isExactSearchAllowed,
    settlingCount: settling.length,
  };
}

function assertZeroSum(balances: readonly Balance[]): void {
  const sum = balances.reduce((total, balance) => total + balance.amount, 0);
  if (sum === 0) return;

  throw new RangeError(
    `Сумма балансов должна быть нулевой, получено: ${String(sum)}`,
  );
}

function settleByGroups(settling: readonly Balance[]): Transfer[] {
  const groups = findZeroSumGroups(settling);

  return groups.flatMap((group) => settleGreedily(group));
}

/**
 * Делит балансы на наибольшее число групп с нулевой суммой. Сумма балансов
 * должна быть нулевой, число балансов — не больше `EXACT_SEARCH_LIMIT`.
 */
function findZeroSumGroups(settling: readonly Balance[]): Balance[][] {
  const amounts = settling.map((balance) => balance.amount);
  const subsetSums = calculateSubsetSums(amounts);
  const groupCounts = countMaxGroups(subsetSums, amounts.length);
  const groupMasks = restoreGroupMasks(subsetSums, groupCounts, amounts.length);

  return groupMasks.map((groupMask) =>
    settling.filter((_, index) => isInMask(groupMask, index)),
  );
}

/** Сумма балансов для каждого подмножества: бит `i` маски — участник `i`. */
function calculateSubsetSums(amounts: readonly number[]): Float64Array {
  const subsetSums = new Float64Array(1 << amounts.length);

  for (let mask = 1; mask < subsetSums.length; mask += 1) {
    const lowestBit = mask & -mask;
    const lowestIndex = bitIndex(lowestBit);
    const rest = readAt(subsetSums, mask ^ lowestBit);
    subsetSums[mask] = rest + readAt(amounts, lowestIndex);
  }

  return subsetSums;
}

/**
 * Для каждого подмножества — наибольшее число подмножеств с нулевой суммой в
 * цепочке, где участники добавляются по одному. Для всех участников сразу это
 * и есть наибольшее число групп.
 */
function countMaxGroups(subsetSums: Float64Array, size: number): Int32Array {
  const groupCounts = new Int32Array(subsetSums.length);

  for (let mask = 1; mask < groupCounts.length; mask += 1) {
    const removedIndex = findBestRemoval(groupCounts, mask, size);
    const countWithout = readAt(groupCounts, mask ^ (1 << removedIndex));
    const isZeroSum = readAt(subsetSums, mask) === 0;
    groupCounts[mask] = countWithout + (isZeroSum ? 1 : 0);
  }

  return groupCounts;
}

/**
 * Кого убрать из подмножества, чтобы остаток дал больше всего групп. При равных
 * вариантах берётся участник с меньшим индексом.
 */
function findBestRemoval(
  groupCounts: Int32Array,
  mask: number,
  size: number,
): number {
  let bestIndex = -1;
  let bestCount = -1;

  for (let index = 0; index < size; index += 1) {
    if (!isInMask(mask, index)) continue;

    const count = readAt(groupCounts, mask ^ (1 << index));
    if (count > bestCount) {
      bestIndex = index;
      bestCount = count;
    }
  }

  return bestIndex;
}

/** Идёт по цепочке убираний от всех участников и режет её на нулевых суммах. */
function restoreGroupMasks(
  subsetSums: Float64Array,
  groupCounts: Int32Array,
  size: number,
): number[] {
  const cuts: number[] = [];
  let mask = (1 << size) - 1;

  while (mask !== 0) {
    if (readAt(subsetSums, mask) === 0) cuts.push(mask);

    mask ^= 1 << findBestRemoval(groupCounts, mask, size);
  }

  // Группа — то, что добавляется между соседними разрезами; последний разрез — пустое множество.
  const nextCuts = [...cuts.slice(1), 0];
  return cuts.map((cut, index) => cut ^ readAt(nextCuts, index));
}

/** Номер единственного установленного бита: у числа 2^k это k. */
function bitIndex(singleBit: number): number {
  return MAX_BIT_INDEX - Math.clz32(singleBit);
}

function isInMask(mask: number, index: number): boolean {
  return (mask & (1 << index)) !== 0;
}

/** Индекс всегда в пределах массива; значение по умолчанию нужно только типам. */
function readAt(values: ArrayLike<number>, index: number): number {
  return values[index] ?? 0;
}

/** Должники по очереди закрывают долги перед кредиторами, в порядке балансов. */
function settleGreedily(balances: readonly Balance[]): Transfer[] {
  const debtors = toOpenPositions(
    balances.filter((balance) => balance.amount < 0),
  );
  const creditors = toOpenPositions(
    balances.filter((balance) => balance.amount > 0),
  );
  const transfers: Transfer[] = [];

  let debtorIndex = 0;
  let creditorIndex = 0;

  for (;;) {
    const debtor = debtors[debtorIndex];
    const creditor = creditors[creditorIndex];
    if (debtor === undefined || creditor === undefined) return transfers;

    const amount = Math.min(debtor.remaining, creditor.remaining);
    transfers.push({
      fromId: debtor.participantId,
      toId: creditor.participantId,
      amount,
    });
    debtor.remaining -= amount;
    creditor.remaining -= amount;

    if (debtor.remaining === 0) debtorIndex += 1;
    if (creditor.remaining === 0) creditorIndex += 1;
  }
}

function toOpenPositions(balances: readonly Balance[]): OpenPosition[] {
  return balances.map((balance) => ({
    participantId: balance.participantId,
    remaining: Math.abs(balance.amount),
  }));
}

/** Порядок переводов не зависит от группировки: по должнику, затем по получателю. */
function sortTransfers(
  transfers: readonly Transfer[],
  balances: readonly Balance[],
): Transfer[] {
  const orderByParticipant = new Map(
    balances.map((balance, index) => [balance.participantId, index]),
  );
  const orderOf = (participantId: ParticipantId): number =>
    orderByParticipant.get(participantId) ?? 0;

  return [...transfers].sort(
    (first, second) =>
      orderOf(first.fromId) - orderOf(second.fromId) ||
      orderOf(first.toId) - orderOf(second.toId),
  );
}
