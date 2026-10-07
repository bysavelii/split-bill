/**
 * Код счёта для ссылки, формат версии 1: `<версия>.<нагрузка>`, например `1.W1tdLFtdXQ`.
 *
 * Полезная нагрузка — JSON `[имена, траты]`, переведённый в UTF-8 и затем в base64url без `=`.
 * Трата записывается как `[индекс плательщика, копейки, индексы получателей]`:
 * участники переиндексируются по порядку, поэтому идентификаторы в ссылку не попадают.
 * Порядок участников, трат и получателей сохраняется, потому что от него зависит,
 * кому достаются лишние копейки.
 *
 * Версия стоит до точки и открытым текстом, а не внутри base64: ссылку другой версии
 * можно распознать, не разбирая нагрузку, формат которой мы не знаем. Точки нет в алфавите
 * base64url, так что разделитель однозначен.
 */
import {
  findNamesProblem,
  isTotalSpentWithinLimit,
  MAX_NAME_LENGTH,
  type Bill,
  type Expense,
  type NameProblem,
  type Participant,
  type ParticipantId,
} from "../bill/bill";
import { decodeBase64Url, encodeBase64Url } from "./base64-url";

export const BILL_CODE_VERSION = 1;
/**
 * Предел длины кода: защита от гигантских ссылок. Счёт, который не помещается в предел
 * (сотни участников или тысячи трат), осознанно не поддерживается: ссылка на него
 * откроется как повреждённая.
 */
export const MAX_BILL_CODE_LENGTH = 100_000;

const VERSION_SEPARATOR = ".";
const VERSION_PATTERN = /^\d+$/u;
const BILL_TUPLE_LENGTH = 2;
const EXPENSE_TUPLE_LENGTH = 3;

export type BillCodeError =
  | { readonly kind: "malformed"; readonly reason: string }
  | { readonly kind: "unsupportedVersion"; readonly version: number }
  | { readonly kind: "invalidBill"; readonly reason: string };

export type DecodeBillResult =
  | { readonly kind: "decoded"; readonly bill: Bill }
  | { readonly kind: "failed"; readonly error: BillCodeError };

type EncodedExpense = readonly [number, number, readonly number[]];
type EncodedBill = readonly [readonly string[], readonly EncodedExpense[]];

/** Сырая трата из JSON: типы её частей ещё не проверены. */
interface RawExpense {
  readonly payer: unknown;
  readonly amount: unknown;
  readonly beneficiaries: unknown;
}

interface RawBill {
  readonly names: readonly string[];
  readonly expenses: readonly RawExpense[];
}

/** Результат одного шага разбора: значение для следующего шага или ошибка. */
type Step<Value> =
  | { readonly kind: "passed"; readonly value: Value }
  | { readonly kind: "failed"; readonly error: BillCodeError };

type FailedStep = Extract<Step<never>, { readonly kind: "failed" }>;

export function encodeBill(bill: Bill): string {
  const indexById = new Map(
    bill.participants.map((participant, index) => [participant.id, index]),
  );
  const names = bill.participants.map((participant) => participant.name);
  const expenses = bill.expenses.map((expense) =>
    encodeExpense(expense, indexById),
  );

  const encodedBill: EncodedBill = [names, expenses];
  const payload = encodeBase64Url(JSON.stringify(encodedBill));

  return [String(BILL_CODE_VERSION), payload].join(VERSION_SEPARATOR);
}

export function decodeBill(code: string): DecodeBillResult {
  const encodedPayload = splitVersion(code);
  if (encodedPayload.kind === "failed") return encodedPayload;

  const json = parsePayload(encodedPayload.value);
  if (json.kind === "failed") return json;

  const rawBill = readRawBill(json.value);
  if (rawBill.kind === "failed") return rawBill;

  const bill = buildBill(rawBill.value);
  if (bill.kind === "failed") return bill;

  if (!isTotalSpentWithinLimit(bill.value)) {
    return invalidBill("Сумма всех трат слишком велика для расчёта");
  }

  return { kind: "decoded", bill: bill.value };
}

function encodeExpense(
  expense: Expense,
  indexById: ReadonlyMap<ParticipantId, number>,
): EncodedExpense {
  const payerIndex = findParticipantIndex(indexById, expense.payerId);
  const beneficiaryIndexes = expense.beneficiaryIds.map((id) =>
    findParticipantIndex(indexById, id),
  );

  return [payerIndex, expense.amount, beneficiaryIndexes];
}

function findParticipantIndex(
  indexById: ReadonlyMap<ParticipantId, number>,
  id: ParticipantId,
): number {
  const index = indexById.get(id);
  if (index === undefined) throw new Error(`Участник не найден: ${id}`);

  return index;
}

/** Проверяет длину и версию и возвращает нагрузку, не разбирая её. */
function splitVersion(code: string): Step<string> {
  if (code.length > MAX_BILL_CODE_LENGTH) {
    return malformed(`Ссылка длиннее ${String(MAX_BILL_CODE_LENGTH)} знаков`);
  }

  const separatorIndex = code.indexOf(VERSION_SEPARATOR);
  if (separatorIndex === -1) return malformed("В ссылке нет версии формата");

  const versionText = code.slice(0, separatorIndex);
  if (!VERSION_PATTERN.test(versionText)) {
    return malformed("Версия формата — не число");
  }

  const version = Number(versionText);
  if (!Number.isSafeInteger(version)) {
    return malformed("Версия формата слишком велика");
  }
  if (version !== BILL_CODE_VERSION) {
    return failed({ kind: "unsupportedVersion", version });
  }

  return passed(code.slice(separatorIndex + VERSION_SEPARATOR.length));
}

function parsePayload(encodedPayload: string): Step<unknown> {
  const text = decodeBase64Url(encodedPayload);
  if (text === undefined) {
    return malformed("Нагрузка — не base64url с текстом в UTF-8");
  }

  try {
    const json: unknown = JSON.parse(text);
    return passed(json);
  } catch {
    return malformed("Нагрузка — не JSON");
  }
}

function readRawBill(json: unknown): Step<RawBill> {
  if (!isTuple(json, BILL_TUPLE_LENGTH)) {
    return invalidBill("Счёт должен состоять из списка имён и списка трат");
  }

  const [names, expenses] = json;
  if (!isStringList(names)) {
    return invalidBill("Имена участников должны быть списком строк");
  }
  if (!Array.isArray(expenses)) {
    return invalidBill("Траты должны быть списком");
  }

  const rawExpenses = mapSteps(expenses as readonly unknown[], readRawExpense);
  if (rawExpenses.kind === "failed") return rawExpenses;

  return passed({ names, expenses: rawExpenses.value });
}

function readRawExpense(value: unknown, index: number): Step<RawExpense> {
  if (!isTuple(value, EXPENSE_TUPLE_LENGTH)) {
    return invalidBill(
      `Трата ${String(index + 1)} должна состоять из плательщика, суммы и получателей`,
    );
  }

  const [payer, amount, beneficiaries] = value;

  return passed({ payer, amount, beneficiaries });
}

function buildBill(rawBill: RawBill): Step<Bill> {
  const namesProblem = findNamesProblem(rawBill.names);
  if (namesProblem !== undefined) {
    return invalidBill(describeNamesProblem(namesProblem));
  }

  const participants = rawBill.names.map((name, index): Participant => ({
    id: createParticipantId(index),
    name,
  }));
  const expenses = mapSteps(rawBill.expenses, (rawExpense, index) =>
    buildExpense(rawExpense, index, participants.length),
  );
  if (expenses.kind === "failed") return expenses;

  return passed({ participants, expenses: expenses.value });
}

function buildExpense(
  rawExpense: RawExpense,
  index: number,
  participantCount: number,
): Step<Expense> {
  const { payer, amount, beneficiaries } = rawExpense;
  const expenseNumber = index + 1;

  if (!isParticipantIndex(payer, participantCount)) {
    return invalidBill(
      `Плательщик траты ${String(expenseNumber)} — не участник из списка`,
    );
  }
  if (!isPositiveKopecks(amount)) {
    return invalidBill(
      `Сумма траты ${String(expenseNumber)} — не целое положительное число копеек`,
    );
  }

  const beneficiaryIndexes = readBeneficiaryIndexes(
    beneficiaries,
    participantCount,
    expenseNumber,
  );
  if (beneficiaryIndexes.kind === "failed") return beneficiaryIndexes;

  return passed({
    id: `e${String(index)}`,
    payerId: createParticipantId(payer),
    amount,
    beneficiaryIds: beneficiaryIndexes.value.map(createParticipantId),
  });
}

function readBeneficiaryIndexes(
  value: unknown,
  participantCount: number,
  expenseNumber: number,
): Step<readonly number[]> {
  if (!Array.isArray(value) || value.length === 0) {
    return invalidBill(`У траты ${String(expenseNumber)} нет получателей`);
  }

  const indexes = value as readonly unknown[];
  const isEveryIndexValid = indexes.every((candidate) =>
    isParticipantIndex(candidate, participantCount),
  );
  if (!isEveryIndexValid) {
    return invalidBill(
      `Получатель траты ${String(expenseNumber)} — не участник из списка`,
    );
  }

  const hasRepeats = new Set(indexes).size !== indexes.length;
  if (hasRepeats) {
    return invalidBill(`Получатели траты ${String(expenseNumber)} повторяются`);
  }

  return passed(indexes);
}

/** Применяет шаг к каждому элементу и останавливается на первой ошибке. */
function mapSteps<Input, Output>(
  inputs: readonly Input[],
  convert: (input: Input, index: number) => Step<Output>,
): Step<readonly Output[]> {
  const outputs: Output[] = [];

  for (const [index, input] of inputs.entries()) {
    const step = convert(input, index);
    if (step.kind === "failed") return step;

    outputs.push(step.value);
  }

  return passed(outputs);
}

function describeNamesProblem(problem: NameProblem): string {
  switch (problem) {
    case "empty":
      return "Имя участника пустое";
    case "tooLong":
      return `Имя участника длиннее ${String(MAX_NAME_LENGTH)} знаков`;
    case "duplicate":
      return "Имена участников повторяются";
  }
}

function createParticipantId(index: number): ParticipantId {
  return `p${String(index)}`;
}

function isTuple(value: unknown, length: number): value is readonly unknown[] {
  return Array.isArray(value) && value.length === length;
}

function isStringList(value: unknown): value is readonly string[] {
  if (!Array.isArray(value)) return false;

  return (value as readonly unknown[]).every(
    (candidate) => typeof candidate === "string",
  );
}

function isParticipantIndex(
  value: unknown,
  participantCount: number,
): value is number {
  return (
    typeof value === "number" &&
    Number.isInteger(value) &&
    value >= 0 &&
    value < participantCount
  );
}

function isPositiveKopecks(value: unknown): value is number {
  return typeof value === "number" && Number.isSafeInteger(value) && value > 0;
}

function passed<Value>(value: Value): Step<Value> {
  return { kind: "passed", value };
}

function failed(error: BillCodeError): FailedStep {
  return { kind: "failed", error };
}

function malformed(reason: string): FailedStep {
  return failed({ kind: "malformed", reason });
}

function invalidBill(reason: string): FailedStep {
  return failed({ kind: "invalidBill", reason });
}
