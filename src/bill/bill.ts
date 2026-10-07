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
 * Длина имени в кодовых точках Unicode, а не в знаках, которые видит человек: размер ссылки
 * ограничен жёстко, и составные знаки не должны его обходить (например, «👩‍👩‍👧» — 5 кодовых точек).
 */
export const MAX_NAME_LENGTH = 40;

/**
 * Предел суммы всех трат. При большей сумме балансы участников теряют точность
 * и расчёт переводов становится неверным.
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

/** Сумма всех трат счёта. */
export function calculateTotalSpent(bill: Bill): Kopecks {
  return bill.expenses.reduce((total, expense) => total + expense.amount, 0);
}

/** Укладывается ли сумма всех трат счёта в предел, при котором расчёт точен. */
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

/** Проверяет список имён по тем же правилам, что и `findNameProblem`, за линейное время. */
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

/** Участник платил сам или за него платили. */
export function isParticipantInExpenses(
  bill: Bill,
  id: ParticipantId,
): boolean {
  return bill.expenses.some(
    (expense) => expense.payerId === id || expense.beneficiaryIds.includes(id),
  );
}

function isNameTooLong(name: string): boolean {
  // Считаем кодовые точки, а не графемы: так длина имени в ссылке ограничена жёстко.
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
  if (participant === undefined) throw new Error(`Участник не найден: ${id}`);

  return participant.name;
}
