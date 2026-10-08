import { describe, expect, it } from "vitest";
import {
  EMPTY_BILL,
  findNamesProblem,
  isTotalSpentWithinLimit,
  MAX_NAME_LENGTH,
  getParticipantName,
  type Bill,
} from "../bill/bill";
import { CURRENCIES, type Currency } from "../bill/currency";
import { encodeBase64Url } from "./base64-url";
import {
  BILL_CODE_VERSION,
  LEGACY_BILL_CODE_VERSION,
  MAX_BILL_CODE_LENGTH,
  decodeBill,
  encodeBill,
  type BillCodeError,
} from "./bill-code";

const ann = { id: "ann-uuid", name: "Ann" };
const ben = { id: "ben-uuid", name: "Ben" };
const clara = { id: "clara-uuid", name: "Clara" };

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

function codeFromText(version: number, jsonText: string): string {
  return `${String(version)}.${encodeBase64Url(jsonText)}`;
}

/** A code of the current version with an arbitrary payload. */
function codeFromJson(json: unknown): string {
  return codeFromText(BILL_CODE_VERSION, JSON.stringify(json));
}

/** A code of the version without a currency, built by hand: the app no longer writes such codes. */
function legacyCodeFromJson(json: unknown): string {
  return codeFromText(LEGACY_BILL_CODE_VERSION, JSON.stringify(json));
}

function readError(code: string): BillCodeError {
  const result = decodeBill(code);
  if (result.kind === "decoded")
    throw new Error("The bill should not have opened");

  return result.error;
}

function readDecoded(code: string): {
  bill: Bill;
  currency: Currency | undefined;
} {
  const result = decodeBill(code);
  if (result.kind === "failed") {
    throw new Error(`The bill did not open: ${result.error.kind}`);
  }

  return { bill: result.bill, currency: result.currency };
}

function readDecodedBill(code: string): Bill {
  return readDecoded(code).bill;
}

function expectRoundTrip(bill: Bill, currency: Currency = "USD"): void {
  const decoded = readDecoded(encodeBill(bill, currency));

  expect(describeWithoutIds(decoded.bill)).toEqual(describeWithoutIds(bill));
  expect(decoded.currency).toBe(currency);
}

describe("round trip of encodeBill and decodeBill", () => {
  it("empty bill", () => {
    expectRoundTrip(EMPTY_BILL);
  });

  it("participants and expenses with part of the recipients in a non-trivial order", () => {
    expectRoundTrip({
      participants: [ann, ben, clara],
      expenses: [
        {
          id: "taxi",
          payerId: ben.id,
          amount: 12_345,
          beneficiaryIds: [clara.id, ann.id],
        },
        {
          id: "dinner",
          payerId: ann.id,
          amount: 90_000,
          beneficiaryIds: [ann.id, ben.id, clara.id],
        },
        {
          id: "coffee",
          payerId: clara.id,
          amount: 1,
          beneficiaryIds: [clara.id],
        },
      ],
    });
  });

  it.each([
    "Άννα",
    "👩‍👩‍👧",
    "<b>Li</b>",
    'Zoë "Zo"',
    "Ben\\Dan",
    "A.B.",
    "#1",
    "100%",
    "Anna  Maria",
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
      participants: [ann],
      expenses: [
        {
          id: "huge",
          payerId: ann.id,
          amount: Number.MAX_SAFE_INTEGER,
          beneficiaryIds: [ann.id],
        },
      ],
    });
  });

  it.each([
    ["Greek", "ω"],
    ["emoji", "😀"],
  ])("name of the maximum length: %s", (_title, symbol) => {
    const name = symbol.repeat(MAX_NAME_LENGTH);

    expectRoundTrip({
      participants: [{ id: "long", name }],
      expenses: [],
    });
  });

  it.each(CURRENCIES)("keeps the currency %s", (currency) => {
    expectRoundTrip({ participants: [ann, ben], expenses: [] }, currency);
  });

  it("the code consists of the version and base64url characters", () => {
    const code = encodeBill({ participants: [ann, ben], expenses: [] }, "USD");

    expect(code).toMatch(/^2\.[A-Za-z0-9_-]*$/u);
  });

  it("does not change a frozen bill", () => {
    const expense = {
      id: "dinner",
      payerId: ann.id,
      amount: 100,
      beneficiaryIds: Object.freeze([ann.id, ben.id]),
    };
    const bill: Bill = Object.freeze({
      participants: Object.freeze([ann, ben]),
      expenses: Object.freeze([Object.freeze(expense)]),
    });

    expect(() => encodeBill(bill, "USD")).not.toThrow();
  });

  it("throws an error if an expense refers to an unknown participant", () => {
    const bill: Bill = {
      participants: [ann],
      expenses: [
        {
          id: "ghost",
          payerId: "nobody",
          amount: 100,
          beneficiaryIds: [ann.id],
        },
      ],
    };

    expect(() => encodeBill(bill, "USD")).toThrow(Error);
  });
});

describe("identifiers of a parsed bill", () => {
  const bill: Bill = {
    participants: [ann, ben],
    expenses: [
      {
        id: "first",
        payerId: ann.id,
        amount: 100,
        beneficiaryIds: [ann.id, ben.id],
      },
      {
        id: "second",
        payerId: ben.id,
        amount: 200,
        beneficiaryIds: [ben.id],
      },
    ],
  };

  it("are unique, and expenses refer to the parsed participants", () => {
    const decoded = readDecodedBill(encodeBill(bill, "USD"));

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
    const code = encodeBill(bill, "USD");

    expect(decodeBill(code)).toEqual(decodeBill(code));
  });
});

describe("format version", () => {
  it.each(["0", "3", "99"])("version %s is not supported", (version) => {
    const error = readError(`${version}.${encodeBase64Url('[[],[],"USD"]')}`);

    expect(error).toEqual({
      kind: "unsupportedVersion",
      version: Number(version),
    });
  });

  it("recognizes a version of another format without parsing the payload", () => {
    expect(readError("3.!!!").kind).toBe("unsupportedVersion");
  });
});

describe("literal codes", () => {
  // Literal codes, not produced by `encodeBill`: links already shared in the wild must keep opening,
  // so these strings must stay the same whatever the code is built with.
  const EXPECTED_BILL = {
    names: ["Ann", "Bob"],
    expenses: [
      { payer: "Ann", amount: 12_345, beneficiaries: ["Ann", "Bob"] },
      { payer: "Bob", amount: 500, beneficiaries: ["Bob"] },
    ],
  };
  const LITERAL_V1_CODE =
    "1.W1siQW5uIiwiQm9iIl0sW1swLDEyMzQ1LFswLDFdXSxbMSw1MDAsWzFdXV1d";
  const LITERAL_V2_USD_CODE =
    "2.W1siQW5uIiwiQm9iIl0sW1swLDEyMzQ1LFswLDFdXSxbMSw1MDAsWzFdXV0sIlVTRCJd";
  const LITERAL_V2_RUB_CODE =
    "2.W1siQW5uIiwiQm9iIl0sW1swLDEyMzQ1LFswLDFdXSxbMSw1MDAsWzFdXV0sIlJVQiJd";

  it("version 1 opens the bill without a currency", () => {
    const decoded = readDecoded(LITERAL_V1_CODE);

    expect(describeWithoutIds(decoded.bill)).toEqual(EXPECTED_BILL);
    expect(decoded.currency).toBeUndefined();
  });

  it.each([
    ["USD", LITERAL_V2_USD_CODE],
    ["RUB", LITERAL_V2_RUB_CODE],
  ])("version 2 opens the bill in %s", (currency, code) => {
    const decoded = readDecoded(code);

    expect(describeWithoutIds(decoded.bill)).toEqual(EXPECTED_BILL);
    expect(decoded.currency).toBe(currency);
  });
});

describe("corrupted codes", () => {
  const notJson = `1.${encodeBase64Url("not JSON")}`;
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
    const code = `3.${"A".repeat(MAX_BILL_CODE_LENGTH)}`;

    expect(readError(code).kind).toBe("malformed");
  });

  it("does not stop a code of exactly the limit length from reaching the version check", () => {
    const code = `3.${"A".repeat(MAX_BILL_CODE_LENGTH - 2)}`;

    expect(readError(code).kind).toBe("unsupportedVersion");
  });
});

describe("invalid bill of the version without a currency", () => {
  const validExpense = [0, 100, [0]];

  it.each([
    ["not an array", { names: [] }],
    ["number", 5],
    ["null", null],
    ["one element", [[]]],
    ["extra element", [["Ann"], [], []]],
    ["names are not an array", ["Ann", []]],
    ["expenses are not an array", [["Ann"], "expenses"]],
    ["name is not a string", [[1], []]],
    ["name longer than the limit", [["ω".repeat(MAX_NAME_LENGTH + 1)], []]],
    ["empty name made of spaces", [["  "], []]],
    ["names ignoring case", [["Άννα", "άννα"], []]],
    ["expense is not an array", [["Ann"], ["expense"]]],
    ["expense tuple of 2 elements", [["Ann"], [[0, 100]]]],
    ["expense tuple of 4 elements", [["Ann"], [[0, 100, [0], 1]]]],
    ["payer −1", [["Ann"], [[-1, 100, [0]]]]],
    ["payer 1.5", [["Ann"], [[1.5, 100, [0]]]]],
    ["payer as a string", [["Ann"], [["0", 100, [0]]]]],
    ["payer out of range", [["Ann"], [[1, 100, [0]]]]],
    ["amount 0", [["Ann"], [[0, 0, [0]]]]],
    ["amount −1", [["Ann"], [[0, -1, [0]]]]],
    ["amount 1.5", [["Ann"], [[0, 1.5, [0]]]]],
    ["amount as a string", [["Ann"], [[0, "100", [0]]]]],
    [
      "amount above the safe integer",
      [["Ann"], [[0, Number.MAX_SAFE_INTEGER + 1, [0]]]],
    ],
    ["recipients are not an array", [["Ann"], [[0, 100, 0]]]],
    ["empty recipients", [["Ann"], [[0, 100, []]]]],
    ["recipients with a repeat", [["Ann"], [[0, 100, [0, 0]]]]],
    ["recipient out of range", [["Ann"], [[0, 100, [0, 1]]]]],
    ["recipient is not a number", [["Ann"], [[0, 100, ["0"]]]]],
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
    expect(readError(legacyCodeFromJson(json)).kind).toBe("invalidBill");
  });

  it("amount 1e400 is invalidBill", () => {
    const code = codeFromText(
      LEGACY_BILL_CODE_VERSION,
      '[["Ann"],[[0,1e400,[0]]]]',
    );

    expect(readError(code).kind).toBe("invalidBill");
  });

  it("a bill without participants and expenses is a valid empty bill", () => {
    expect(readDecodedBill(legacyCodeFromJson([[], []]))).toEqual(EMPTY_BILL);
  });

  it("a bill with a currency in the payload is invalidBill", () => {
    expect(readError(legacyCodeFromJson([[], [], "USD"])).kind).toBe(
      "invalidBill",
    );
  });
});

describe("invalid bill of the current version", () => {
  it.each([
    ["missing currency", [["Ann"], []]],
    ["unknown currency", [["Ann"], [], "EUR"]],
    ["lowercase currency", [["Ann"], [], "usd"]],
    ["currency is a number", [["Ann"], [], 840]],
    ["currency is null", [["Ann"], [], null]],
    ["currency is a list", [["Ann"], [], ["USD"]]],
    ["tuple of 4 elements", [["Ann"], [], "USD", 0]],
    ["currency before the bill", ["USD", ["Ann"], []]],
    ["invalid expense with a valid currency", [["Ann"], [[0, 0, [0]]], "USD"]],
  ])("%s — invalidBill", (_title, json) => {
    expect(readError(codeFromJson(json)).kind).toBe("invalidBill");
  });

  it("a bill without participants and expenses is a valid empty bill", () => {
    expect(readDecoded(codeFromJson([[], [], "RUB"]))).toEqual({
      bill: EMPTY_BILL,
      currency: "RUB",
    });
  });
});

describe("parsing robustness", () => {
  it("does not throw on arbitrary strings", () => {
    const codes = [
      "",
      "1.",
      "1.[[",
      "2.",
      "2.[[",
      "\u0000",
      "1.😀",
      "2.😀",
      "..",
      "1.====",
      "-1.x",
    ];

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
  "αβγδεζηθικλμνξοπρστυφχψωΑΒΓ😀👩🎉🍕<>\"'\\/&%#?.=+ -_ñü漢字",
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

function createRandomCurrency(random: () => number): Currency {
  const index = Math.floor(random() * CURRENCIES.length);

  return CURRENCIES[index] ?? "USD";
}

describe("encoding properties on pseudo-random bills", () => {
  const ITERATIONS = 300;

  it("the round trip keeps the bill and the currency, and the code matches the pattern", () => {
    const random = createRandom(20_240_607);

    for (let iteration = 0; iteration < ITERATIONS; iteration += 1) {
      const bill = createRandomBill(random);
      const currency = createRandomCurrency(random);
      expectRoundTrip(bill, currency);
      expect(encodeBill(bill, currency)).toMatch(/^2\.[A-Za-z0-9_-]*$/u);
    }
  });

  it("mutations of a valid code do not throw and give a valid bill or an error", () => {
    const random = createRandom(777);
    const alphabet = Array.from("AZaz09-_.=+/ %ω😀");

    for (let iteration = 0; iteration < ITERATIONS; iteration += 1) {
      const code = encodeBill(
        createRandomBill(random),
        createRandomCurrency(random),
      );
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
