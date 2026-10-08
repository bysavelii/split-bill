/**
 * The bill code for a link: `<version>.<payload>`, for example `2.W1tdLFtdLCJVU0QiXQ`.
 *
 * The payload is JSON converted to UTF-8 and then to base64url without `=`. Two versions are read:
 * - version 2, the current one, writes `[names, expenses, currency code]`, where the currency is
 *   an ISO 4217 code such as `"USD"`;
 * - version 1, written by older releases, is `[names, expenses]` without a currency: such a link
 *   still opens, and the page chooses the currency itself.
 *
 * An expense is written as `[payer index, minor units, recipient indexes]`:
 * participants are reindexed in order, so identifiers do not get into the link.
 * The order of participants, expenses and recipients is kept, because it decides
 * who gets the extra minor units.
 *
 * The version stands before the dot and in plain text, not inside base64: a link of another version
 * can be recognized without parsing the payload, whose format we do not know. The dot is not in the
 * base64url alphabet, so the separator is unambiguous.
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
import { isCurrency, type Currency } from "../bill/currency";
import { decodeBase64Url, encodeBase64Url } from "./base64-url";

export const BILL_CODE_VERSION = 2;
/** The version without a currency: links of it are still opened. */
export const LEGACY_BILL_CODE_VERSION = 1;
/**
 * Limit of the code length: protection against gigantic links. A bill that does not fit the limit
 * (hundreds of participants or thousands of expenses) is deliberately not supported: the link to it
 * will open as corrupted.
 */
export const MAX_BILL_CODE_LENGTH = 100_000;

const VERSION_SEPARATOR = ".";
const VERSION_PATTERN = /^\d+$/u;
const LEGACY_BILL_TUPLE_LENGTH = 2;
const BILL_TUPLE_LENGTH = 3;
const EXPENSE_TUPLE_LENGTH = 3;

export type BillCodeError =
  | { readonly kind: "malformed"; readonly reason: string }
  | { readonly kind: "unsupportedVersion"; readonly version: number }
  | { readonly kind: "invalidBill"; readonly reason: string };

export type DecodeBillResult =
  | {
      readonly kind: "decoded";
      readonly bill: Bill;
      /** `undefined` for a link of the version without a currency: the page chooses its own. */
      readonly currency: Currency | undefined;
    }
  | { readonly kind: "failed"; readonly error: BillCodeError };

type EncodedExpense = readonly [number, number, readonly number[]];
type EncodedBill = readonly [
  readonly string[],
  readonly EncodedExpense[],
  Currency,
];

/** The payload of a code with the reader of the format version it was written in. */
interface VersionedPayload {
  readonly readBill: BillReader;
  readonly encodedPayload: string;
}

/** A raw expense from JSON: the types of its parts are not checked yet. */
interface RawExpense {
  readonly payer: unknown;
  readonly amount: unknown;
  readonly beneficiaries: unknown;
}

interface RawBill {
  readonly names: readonly string[];
  readonly expenses: readonly RawExpense[];
  readonly currency: Currency | undefined;
}

/** The result of one parsing step: a value for the next step or an error. */
type Step<Value> =
  | { readonly kind: "passed"; readonly value: Value }
  | { readonly kind: "failed"; readonly error: BillCodeError };

type FailedStep = Extract<Step<never>, { readonly kind: "failed" }>;

/** Turns the parsed JSON of one format version into a raw bill. */
type BillReader = (json: unknown) => Step<RawBill>;

/** The single source of truth for the supported versions: a version missing here is not opened. */
const BILL_READERS: ReadonlyMap<number, BillReader> = new Map([
  [BILL_CODE_VERSION, readCurrentBill],
  [LEGACY_BILL_CODE_VERSION, readLegacyBill],
]);

export function encodeBill(bill: Bill, currency: Currency): string {
  const indexById = new Map(
    bill.participants.map((participant, index) => [participant.id, index]),
  );
  const names = bill.participants.map((participant) => participant.name);
  const expenses = bill.expenses.map((expense) =>
    encodeExpense(expense, indexById),
  );

  const encodedBill: EncodedBill = [names, expenses, currency];
  const payload = encodeBase64Url(JSON.stringify(encodedBill));

  return [String(BILL_CODE_VERSION), payload].join(VERSION_SEPARATOR);
}

export function decodeBill(code: string): DecodeBillResult {
  const versionedPayload = splitVersion(code);
  if (versionedPayload.kind === "failed") return versionedPayload;

  const { readBill, encodedPayload } = versionedPayload.value;
  const json = parsePayload(encodedPayload);
  if (json.kind === "failed") return json;

  const rawBill = readBill(json.value);
  if (rawBill.kind === "failed") return rawBill;

  const bill = buildBill(rawBill.value);
  if (bill.kind === "failed") return bill;

  if (!isTotalSpentWithinLimit(bill.value)) {
    return invalidBill(
      "The total of all expenses is too large for the calculation",
    );
  }

  return {
    kind: "decoded",
    bill: bill.value,
    currency: rawBill.value.currency,
  };
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
  if (index === undefined) throw new Error(`Participant not found: ${id}`);

  return index;
}

/** Checks the length and the version and returns the payload without parsing it. */
function splitVersion(code: string): Step<VersionedPayload> {
  if (code.length > MAX_BILL_CODE_LENGTH) {
    return malformed(
      `The link is longer than ${String(MAX_BILL_CODE_LENGTH)} characters`,
    );
  }

  const separatorIndex = code.indexOf(VERSION_SEPARATOR);
  if (separatorIndex === -1) return malformed("The link has no format version");

  const versionText = code.slice(0, separatorIndex);
  if (!VERSION_PATTERN.test(versionText)) {
    return malformed("The format version is not a number");
  }

  const version = Number(versionText);
  if (!Number.isSafeInteger(version)) {
    return malformed("The format version is too large");
  }

  const readBill = BILL_READERS.get(version);
  if (readBill === undefined) {
    return failed({ kind: "unsupportedVersion", version });
  }

  const encodedPayload = code.slice(separatorIndex + VERSION_SEPARATOR.length);

  return passed({ readBill, encodedPayload });
}

function parsePayload(encodedPayload: string): Step<unknown> {
  const text = decodeBase64Url(encodedPayload);
  if (text === undefined) {
    return malformed("The payload is not base64url with UTF-8 text");
  }

  try {
    const json: unknown = JSON.parse(text);
    return passed(json);
  } catch {
    return malformed("The payload is not JSON");
  }
}

function readLegacyBill(json: unknown): Step<RawBill> {
  if (!isTuple(json, LEGACY_BILL_TUPLE_LENGTH)) {
    return invalidBill(
      "The bill must consist of a list of names and a list of expenses",
    );
  }

  const [names, expenses] = json;
  const namesAndExpenses = readNamesAndExpenses(names, expenses);
  if (namesAndExpenses.kind === "failed") return namesAndExpenses;

  return passed({ ...namesAndExpenses.value, currency: undefined });
}

function readCurrentBill(json: unknown): Step<RawBill> {
  if (!isTuple(json, BILL_TUPLE_LENGTH)) {
    return invalidBill(
      "The bill must consist of a list of names, a list of expenses and a currency",
    );
  }

  const [names, expenses, currencyCode] = json;
  const namesAndExpenses = readNamesAndExpenses(names, expenses);
  if (namesAndExpenses.kind === "failed") return namesAndExpenses;

  const currency = readCurrency(currencyCode);
  if (currency.kind === "failed") return currency;

  return passed({ ...namesAndExpenses.value, currency: currency.value });
}

/** The part shared by all versions: participant names and the list of expenses. */
function readNamesAndExpenses(
  names: unknown,
  expenses: unknown,
): Step<Omit<RawBill, "currency">> {
  if (!isStringList(names)) {
    return invalidBill("Participant names must be a list of strings");
  }
  if (!Array.isArray(expenses)) {
    return invalidBill("Expenses must be a list");
  }

  const rawExpenses = mapSteps(expenses as readonly unknown[], readRawExpense);
  if (rawExpenses.kind === "failed") return rawExpenses;

  return passed({ names, expenses: rawExpenses.value });
}

function readCurrency(value: unknown): Step<Currency> {
  if (!isCurrency(value)) {
    return invalidBill("The currency is not one of the supported ones");
  }

  return passed(value);
}

function readRawExpense(value: unknown, index: number): Step<RawExpense> {
  if (!isTuple(value, EXPENSE_TUPLE_LENGTH)) {
    return invalidBill(
      `Expense ${String(index + 1)} must consist of a payer, an amount and recipients`,
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
      `The payer of expense ${String(expenseNumber)} is not a participant from the list`,
    );
  }
  if (!isPositiveKopecks(amount)) {
    return invalidBill(
      `The amount of expense ${String(expenseNumber)} is not a positive integer number of minor units`,
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
    return invalidBill(`Expense ${String(expenseNumber)} has no recipients`);
  }

  const indexes = value as readonly unknown[];
  const isEveryIndexValid = indexes.every((candidate) =>
    isParticipantIndex(candidate, participantCount),
  );
  if (!isEveryIndexValid) {
    return invalidBill(
      `A recipient of expense ${String(expenseNumber)} is not a participant from the list`,
    );
  }

  const hasRepeats = new Set(indexes).size !== indexes.length;
  if (hasRepeats) {
    return invalidBill(`Recipients of expense ${String(expenseNumber)} repeat`);
  }

  return passed(indexes);
}

/** Applies a step to each element and stops at the first error. */
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
      return "A participant name is empty";
    case "tooLong":
      return `A participant name is longer than ${String(MAX_NAME_LENGTH)} characters`;
    case "duplicate":
      return "Participant names repeat";
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
