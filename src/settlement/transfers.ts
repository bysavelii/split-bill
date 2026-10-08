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
  /** The number of transfers is guaranteed to be the smallest (exact search). */
  readonly isMinimal: boolean;
  /** How many people give or receive money: the rest have a zero balance. */
  readonly settlingCount: number;
}

/**
 * Limit of the exact search for the minimum. Enumerating subsets doubles with each
 * person: with 16 participants it is about a million steps, the calculation is still instant.
 */
export const EXACT_SEARCH_LIMIT = 16;

/** The highest bit of the 32-bit number that `Math.clz32` works with. */
const MAX_BIT_INDEX = 31;

interface OpenPosition {
  readonly participantId: ParticipantId;
  remaining: Kopecks;
}

/**
 * The transfers needed are "participants with a non-zero balance" minus "the largest number
 * of groups with a zero sum": inside each group the money adds up with no remainder.
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

  throw new RangeError(`The sum of balances must be zero, got: ${String(sum)}`);
}

function settleByGroups(settling: readonly Balance[]): Transfer[] {
  const groups = findZeroSumGroups(settling);

  return groups.flatMap((group) => settleGreedily(group));
}

/**
 * Splits balances into the largest number of groups with a zero sum. The sum of balances
 * must be zero, the number of balances is at most `EXACT_SEARCH_LIMIT`.
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

/** The sum of balances for each subset: bit `i` of the mask is participant `i`. */
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
 * For each subset: the largest number of zero-sum subsets in the chain where
 * participants are added one by one. For all participants at once this is
 * the largest number of groups.
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
 * Whom to remove from the subset so that the remainder gives the most groups. On ties
 * the participant with the smaller index is taken.
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

/** Walks the chain of removals from all participants and cuts it at zero sums. */
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

  // A group is what is added between adjacent cuts; the last cut is the empty set.
  const nextCuts = [...cuts.slice(1), 0];
  return cuts.map((cut, index) => cut ^ readAt(nextCuts, index));
}

/** The index of the only set bit: for the number 2^k it is k. */
function bitIndex(singleBit: number): number {
  return MAX_BIT_INDEX - Math.clz32(singleBit);
}

function isInMask(mask: number, index: number): boolean {
  return (mask & (1 << index)) !== 0;
}

/** The index is always within the array; the default value is needed only for the types. */
function readAt(values: ArrayLike<number>, index: number): number {
  return values[index] ?? 0;
}

/** Debtors in turn settle their debts to creditors, in the order of balances. */
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

/** The order of transfers does not depend on grouping: by debtor, then by recipient. */
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
