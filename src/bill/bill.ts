import type { Kopecks } from "./money";

export type ParticipantId = string;

export interface Participant {
  readonly id: ParticipantId;
  readonly name: string;
}

export type ExpenseId = string;

export interface Expense {
  readonly id: ExpenseId;
  readonly payerId: ParticipantId;
  readonly amount: Kopecks;
  readonly beneficiaryIds: readonly ParticipantId[];
}

export interface Bill {
  readonly participants: readonly Participant[];
  readonly expenses: readonly Expense[];
}

export type NameProblem = "empty" | "tooLong" | "duplicate";

/**
 * Name length in Unicode code points, not in characters a person sees: the link size
 * is strictly limited, and composite characters must not bypass it (for example, "👩‍👩‍👧" — 5 code points).
 */
export const MAX_NAME_LENGTH = 40;

/**
 * Limit of the total of all expenses. Above it the participants' balances lose precision
 * and the transfer calculation becomes wrong.
 */
export const MAX_TOTAL_SPENT: Kopecks = Number.MAX_SAFE_INTEGER;

export const EMPTY_BILL: Bill = { participants: [], expenses: [] };

export function addParticipant(bill: Bill, participant: Participant): Bill {
  return { ...bill, participants: [...bill.participants, participant] };
}

export function removeParticipant(bill: Bill, id: ParticipantId): Bill {
  const participants = bill.participants.filter(
    (participant) => participant.id !== id,
  );
  return { ...bill, participants };
}

export function addExpense(bill: Bill, expense: Expense): Bill {
  return { ...bill, expenses: [...bill.expenses, expense] };
}

export function removeExpense(bill: Bill, id: ExpenseId): Bill {
  const expenses = bill.expenses.filter((expense) => expense.id !== id);
  return { ...bill, expenses };
}

/** Total of all expenses of the bill. */
export function calculateTotalSpent(bill: Bill): Kopecks {
  return bill.expenses.reduce((total, expense) => total + expense.amount, 0);
}

/** Whether the total of all expenses fits the limit at which the calculation is exact. */
export function isTotalSpentWithinLimit(bill: Bill): boolean {
  return calculateTotalSpent(bill) <= MAX_TOTAL_SPENT;
}

export function findNameProblem(
  bill: Bill,
  name: string,
): NameProblem | undefined {
  const normalizedName = normalizeName(name);
  if (normalizedName === "") return "empty";
  if (isNameTooLong(name)) return "tooLong";

  const isDuplicate = bill.participants.some(
    (participant) => normalizeName(participant.name) === normalizedName,
  );
  if (isDuplicate) return "duplicate";

  return undefined;
}

/** Checks a list of names by the same rules as `findNameProblem`, in linear time. */
export function findNamesProblem(
  names: readonly string[],
): NameProblem | undefined {
  const seenNames = new Set<string>();

  for (const name of names) {
    const normalizedName = normalizeName(name);
    if (normalizedName === "") return "empty";
    if (isNameTooLong(name)) return "tooLong";
    if (seenNames.has(normalizedName)) return "duplicate";

    seenNames.add(normalizedName);
  }

  return undefined;
}

/** The participant paid themselves or was paid for. */
export function isParticipantInExpenses(
  bill: Bill,
  id: ParticipantId,
): boolean {
  return bill.expenses.some(
    (expense) => expense.payerId === id || expense.beneficiaryIds.includes(id),
  );
}

function isNameTooLong(name: string): boolean {
  // Count code points, not graphemes: this way the name length in the link is strictly limited.
  const nameLength = Array.from(name.trim()).length;
  return nameLength > MAX_NAME_LENGTH;
}

function normalizeName(name: string): string {
  return name.trim().toLowerCase();
}

export function getParticipantName(bill: Bill, id: ParticipantId): string {
  const participant = bill.participants.find(
    (candidate) => candidate.id === id,
  );
  if (participant === undefined)
    throw new Error(`Participant not found: ${id}`);

  return participant.name;
}
