import { describe, expect, it } from "vitest";
import {
  EMPTY_BILL,
  findNamesProblem,
  isTotalSpentWithinLimit,
  MAX_NAME_LENGTH,
  getParticipantName,
  type Bill,
} from "../bill/bill";
import { encodeBase64Url } from "./base64-url";
import {
  BILL_CODE_VERSION,
  MAX_BILL_CODE_LENGTH,
  decodeBill,
  encodeBill,
  type BillCodeError,
} from "./bill-code";

const anna = { id: "anna-uuid", name: "Аня" };
const boris = { id: "boris-uuid", name: "Боря" };
const vera = { id: "vera-uuid", name: "Вера" };

/** A bill without identifiers: used to compare bills "up to id". */
function describeWithoutIds(bill: Bill): unknown {
  return {
    names: bill.participants.map((participant) => participant.name),
    expenses: bill.expenses.map((expense) => ({
      payer: getParticipantName(bill, expense.payerId),
      amount: expense.amount,
      beneficiaries: expense.beneficiaryIds.map((id) =>
        getParticipantName(bill, id),
      ),
    })),
  };
}

function codeFromText(jsonText: string): string {
  return `${String(BILL_CODE_VERSION)}.${encodeBase64Url(jsonText)}`;
}

function codeFromJson(json: unknown): string {
  return codeFromText(JSON.stringify(json));
}

function readError(code: string): BillCodeError {
  const result = decodeBill(code);
  if (result.kind === "decoded")
    throw new Error("The bill should not have opened");

  return result.error;
}

function readDecodedBill(code: string): Bill {
  const result = decodeBill(code);
  if (result.kind === "failed") {
    throw new Error(`The bill did not open: ${result.error.kind}`);
  }

  return result.bill;
}

function expectRoundTrip(bill: Bill): void {
  const decoded = readDecodedBill(encodeBill(bill));

  expect(describeWithoutIds(decoded)).toEqual(describeWithoutIds(bill));
}

describe("round trip of encodeBill and decodeBill", () => {
  it("empty bill", () => {
    expectRoundTrip(EMPTY_BILL);
  });

  it("participants and expenses with part of the recipients in a non-trivial order", () => {
    expectRoundTrip({
      participants: [anna, boris, vera],
      expenses: [
        {
          id: "taxi",
          payerId: boris.id,
          amount: 12_345,
          beneficiaryIds: [vera.id, anna.id],
        },
        {
          id: "dinner",
          payerId: anna.id,
          amount: 90_000,
          beneficiaryIds: [anna.id, boris.id, vera.id],
        },
        {
          id: "coffee",
          payerId: vera.id,
          amount: 1,
          beneficiaryIds: [vera.id],
        },
      ],
    });
  });

  it.each([
    "Аня",
    "👩‍👩‍👧",
    "<b>Ли</b>",
    'Лёша "Лёха"',
    "Борис\\Глеб",
    "А.Б.",
    "#1",
    "100%",
    "Анна  Мария",
  ])("name %j", (name) => {
    const participant = { id: "someone", name };
    expectRoundTrip({
      participants: [participant],
      expenses: [
        {
          id: "lunch",
          payerId: participant.id,
          amount: 100,
          beneficiaryIds: [participant.id],
        },
      ],
    });
  });

  it("the largest safe amount", () => {
    expectRoundTrip({
      participants: [anna],
      expenses: [
        {
          id: "huge",
          payerId: anna.id,
          amount: Number.MAX_SAFE_INTEGER,
          beneficiaryIds: [anna.id],
        },
      ],
    });
  });

  it.each([
    ["Cyrillic", "я"],
    ["emoji", "😀"],
  ])("name of the maximum length: %s", (_title, symbol) => {
    const name = symbol.repeat(MAX_NAME_LENGTH);

    expectRoundTrip({
      participants: [{ id: "long", name }],
      expenses: [],
    });
  });

  it("the code consists of the version and base64url characters", () => {
    const code = encodeBill({ participants: [anna, boris], expenses: [] });

    expect(code).toMatch(/^1\.[A-Za-z0-9_-]*$/u);
  });

  it("does not change a frozen bill", () => {
    const expense = {
      id: "dinner",
      payerId: anna.id,
      amount: 100,
      beneficiaryIds: Object.freeze([anna.id, boris.id]),
    };
    const bill: Bill = Object.freeze({
      participants: Object.freeze([anna, boris]),
      expenses: Object.freeze([Object.freeze(expense)]),
    });

    expect(() => encodeBill(bill)).not.toThrow();
  });

  it("throws an error if an expense refers to an unknown participant", () => {
    const bill: Bill = {
      participants: [anna],
      expenses: [
        {
          id: "ghost",
          payerId: "nobody",
          amount: 100,
          beneficiaryIds: [anna.id],
        },
      ],
    };

    expect(() => encodeBill(bill)).toThrow(Error);
  });
});

describe("identifiers of a parsed bill", () => {
  const bill: Bill = {
    participants: [anna, boris],
    expenses: [
      {
        id: "first",
        payerId: anna.id,
        amount: 100,
        beneficiaryIds: [anna.id, boris.id],
      },
      {
        id: "second",
        payerId: boris.id,
        amount: 200,
        beneficiaryIds: [boris.id],
      },
    ],
  };

  it("are unique, and expenses refer to the parsed participants", () => {
    const decoded = readDecodedBill(encodeBill(bill));

    const participantIds = decoded.participants.map(({ id }) => id);
    const expenseIds = decoded.expenses.map(({ id }) => id);
    const referencedIds = decoded.expenses.flatMap((expense) => [
      expense.payerId,
      ...expense.beneficiaryIds,
    ]);
    expect(new Set([...participantIds, ...expenseIds]).size).toBe(4);
    expect(referencedIds.every((id) => participantIds.includes(id))).toBe(true);
  });

  it("are the same when one code is parsed again", () => {
    const code = encodeBill(bill);

    expect(decodeBill(code)).toEqual(decodeBill(code));
  });
});

describe("format version", () => {
  it.each(["0", "2", "99"])("version %s is not supported", (version) => {
    const error = readError(`${version}.${encodeBase64Url("[[],[]]")}`);

    expect(error).toEqual({
      kind: "unsupportedVersion",
      version: Number(version),
    });
  });

  it("recognizes a version of another format without parsing the payload", () => {
    expect(readError("2.!!!").kind).toBe("unsupportedVersion");
  });
});

describe("corrupted codes", () => {
  const notJson = `1.${encodeBase64Url("не JSON")}`;
  const invalidUtf8 = "1._w";

  it.each([
    ["empty string", ""],
    ["only the version", "1"],
    ["no payload after the dot", "1."],
    ["no version", ".x"],
    ["version with a letter", "v1.x"],
    ["foreign characters in the payload", "1.!!!"],
    ["percent encoding", "1.%D0"],
    ["extra dot in the payload", "1.W1tdLFtdXQ.x"],
    ["base64 that is not JSON", notJson],
    ["invalid UTF-8", invalidUtf8],
    ["link that is too long", `1.${"A".repeat(MAX_BILL_CODE_LENGTH)}`],
    ["huge version", `${"9".repeat(400)}.x`],
    ["version beyond the safe integers", "9007199254740993.x"],
  ])("%s — malformed", (_title, code) => {
    expect(readError(code).kind).toBe("malformed");
  });
});

describe("length limit", () => {
  it("is checked before the version", () => {
    const code = `2.${"A".repeat(MAX_BILL_CODE_LENGTH)}`;

    expect(readError(code).kind).toBe("malformed");
  });

  it("does not stop a code of exactly the limit length from reaching the version check", () => {
    const code = `2.${"A".repeat(MAX_BILL_CODE_LENGTH - 2)}`;

    expect(readError(code).kind).toBe("unsupportedVersion");
  });
});

describe("invalid bill", () => {
  const validExpense = [0, 100, [0]];

  it.each([
    ["not an array", { names: [] }],
    ["number", 5],
    ["null", null],
    ["one element", [[]]],
    ["extra element", [["Аня"], [], []]],
    ["names are not an array", ["Аня", []]],
    ["expenses are not an array", [["Аня"], "траты"]],
    ["name is not a string", [[1], []]],
    ["name longer than the limit", [["я".repeat(MAX_NAME_LENGTH + 1)], []]],
    ["empty name made of spaces", [["  "], []]],
    ["names ignoring case", [["Аня", "аня"], []]],
    ["expense is not an array", [["Аня"], ["трата"]]],
    ["expense tuple of 2 elements", [["Аня"], [[0, 100]]]],
    ["expense tuple of 4 elements", [["Аня"], [[0, 100, [0], 1]]]],
    ["payer −1", [["Аня"], [[-1, 100, [0]]]]],
    ["payer 1.5", [["Аня"], [[1.5, 100, [0]]]]],
    ["payer as a string", [["Аня"], [["0", 100, [0]]]]],
    ["payer out of range", [["Аня"], [[1, 100, [0]]]]],
    ["amount 0", [["Аня"], [[0, 0, [0]]]]],
    ["amount −1", [["Аня"], [[0, -1, [0]]]]],
    ["amount 1.5", [["Аня"], [[0, 1.5, [0]]]]],
    ["amount as a string", [["Аня"], [[0, "100", [0]]]]],
    [
      "amount above the safe integer",
      [["Аня"], [[0, Number.MAX_SAFE_INTEGER + 1, [0]]]],
    ],
    ["recipients are not an array", [["Аня"], [[0, 100, 0]]]],
    ["empty recipients", [["Аня"], [[0, 100, []]]]],
    ["recipients with a repeat", [["Аня"], [[0, 100, [0, 0]]]]],
    ["recipient out of range", [["Аня"], [[0, 100, [0, 1]]]]],
    ["recipient is not a number", [["Аня"], [[0, 100, ["0"]]]]],
    ["expense without participants", [[], [validExpense]]],
    [
      "total of expenses above the safe integer",
      [
        ["a", "b"],
        [
          [0, Number.MAX_SAFE_INTEGER, [0]],
          [1, 1, [1]],
        ],
      ],
    ],
    [
      "three amounts from a forged link",
      [
        ["a", "b", "c"],
        [
          [1, 9_007_199_254_740_769, [2]],
          [0, 9_007_199_254_740_461, [1]],
          [2, 9_007_199_254_740_210, [1]],
        ],
      ],
    ],
  ])("%s — invalidBill", (_title, json) => {
    expect(readError(codeFromJson(json)).kind).toBe("invalidBill");
  });

  it("amount 1e400 is invalidBill", () => {
    const code = codeFromText('[["Аня"],[[0,1e400,[0]]]]');

    expect(readError(code).kind).toBe("invalidBill");
  });

  it("a bill without participants and expenses is a valid empty bill", () => {
    expect(readDecodedBill(codeFromJson([[], []]))).toEqual(EMPTY_BILL);
  });
});

describe("parsing robustness", () => {
  it("does not throw on arbitrary strings", () => {
    const codes = ["", "1.", "1.[[", "\u0000", "1.😀", "..", "1.====", "-1.x"];

    for (const code of codes) {
      expect(() => decodeBill(code)).not.toThrow();
    }
  });
});

/** A simple PRNG (mulberry32) with a fixed seed: the test is reproducible without dependencies. */
function createRandom(seed: number): () => number {
  let state = seed;

  return () => {
    state = (state + 0x6d2b79f5) | 0;
    let mixed = Math.imul(state ^ (state >>> 15), 1 | state);
    mixed = (mixed + Math.imul(mixed ^ (mixed >>> 7), 61 | mixed)) ^ mixed;

    return ((mixed ^ (mixed >>> 14)) >>> 0) / 4_294_967_296;
  };
}

const NAME_ALPHABET = Array.from(
  "абвгдеёжзийклмнопрстуфхцчшщъыьэюяАБВ😀👩🎉🍕<>\"'\\/&%#?.=+ -_ñü漢字",
);
const MAX_RANDOM_PARTICIPANTS = 8;
const MAX_RANDOM_EXPENSES = 10;
const MAX_RANDOM_AMOUNT = 10_000_000_00;

function createRandomBill(random: () => number): Bill {
  const pick = (limit: number): number => Math.floor(random() * limit);
  const participantCount = pick(MAX_RANDOM_PARTICIPANTS + 1);
  const participants = Array.from({ length: participantCount }, (_, index) => {
    const length = 1 + pick(MAX_NAME_LENGTH);
    const symbols = Array.from(
      { length },
      () => NAME_ALPHABET[pick(NAME_ALPHABET.length)],
    );
    // The number at the end makes the names distinct without exceeding the length limit.
    const suffix = String(index);
    const name = [
      ...symbols.slice(0, MAX_NAME_LENGTH - suffix.length),
      suffix,
    ].join("");

    return { id: `random-${String(index)}-${String(pick(1_000_000))}`, name };
  });
  if (participantCount === 0) return EMPTY_BILL;

  const expenseCount = pick(MAX_RANDOM_EXPENSES + 1);
  const expenses = Array.from({ length: expenseCount }, (_, index) => {
    const shuffled = participants
      .map((participant) => ({ participant, order: random() }))
      .sort((left, right) => left.order - right.order)
      .map(({ participant }) => participant);
    const recipientCount = 1 + pick(participantCount);

    return {
      id: `expense-${String(index)}`,
      payerId: participants[pick(participantCount)]?.id ?? "",
      amount: 1 + pick(MAX_RANDOM_AMOUNT),
      beneficiaryIds: shuffled.slice(0, recipientCount).map(({ id }) => id),
    };
  });

  return { participants, expenses };
}

describe("encoding properties on pseudo-random bills", () => {
  const ITERATIONS = 300;

  it("the round trip keeps the bill, and the code matches the pattern", () => {
    const random = createRandom(20_240_607);

    for (let iteration = 0; iteration < ITERATIONS; iteration += 1) {
      const bill = createRandomBill(random);
      expectRoundTrip(bill);
      expect(encodeBill(bill)).toMatch(/^1\.[A-Za-z0-9_-]*$/u);
    }
  });

  it("mutations of a valid code do not throw and give a valid bill or an error", () => {
    const random = createRandom(777);
    const alphabet = Array.from("AZaz09-_.=+/ %я😀");

    for (let iteration = 0; iteration < ITERATIONS; iteration += 1) {
      const code = encodeBill(createRandomBill(random));
      const position = Math.floor(random() * (code.length + 1));
      const replacement =
        alphabet[Math.floor(random() * alphabet.length)] ?? "";
      const isDeletion = random() < 0.5;
      const mutated = isDeletion
        ? code.slice(0, position) + code.slice(position + 1)
        : code.slice(0, position) + replacement + code.slice(position + 1);

      const result = decodeBill(mutated);
      if (result.kind === "failed") continue;

      expect(
        findNamesProblem(result.bill.participants.map(({ name }) => name)),
      ).toBeUndefined();
      expect(isTotalSpentWithinLimit(result.bill)).toBe(true);
      const ids = new Set(result.bill.participants.map(({ id }) => id));
      for (const expense of result.bill.expenses) {
        expect(ids.has(expense.payerId)).toBe(true);
        expect(expense.beneficiaryIds.length).toBeGreaterThan(0);
        expect(expense.beneficiaryIds.every((id) => ids.has(id))).toBe(true);
      }
    }
  });
});
