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

export type NameProblem = "empty" | "duplicate";

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

export function findNameProblem(
  bill: Bill,
  name: string,
): NameProblem | undefined {
  const normalizedName = normalizeName(name);
  if (normalizedName === "") return "empty";

  const isDuplicate = bill.participants.some(
    (participant) => normalizeName(participant.name) === normalizedName,
  );
  if (isDuplicate) return "duplicate";

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
