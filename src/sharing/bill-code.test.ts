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

/** Счёт без идентификаторов: по нему сравнивают счета «с точностью до id». */
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
    throw new Error("Счёт не должен был открыться");

  return result.error;
}

function readDecodedBill(code: string): Bill {
  const result = decodeBill(code);
  if (result.kind === "failed") {
    throw new Error(`Счёт не открылся: ${result.error.kind}`);
  }

  return result.bill;
}

function expectRoundTrip(bill: Bill): void {
  const decoded = readDecodedBill(encodeBill(bill));

  expect(describeWithoutIds(decoded)).toEqual(describeWithoutIds(bill));
}

describe("круговой тест encodeBill и decodeBill", () => {
  it("пустой счёт", () => {
    expectRoundTrip(EMPTY_BILL);
  });

  it("участники и траты с частью получателей в нетривиальном порядке", () => {
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
  ])("имя %j", (name) => {
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

  it("наибольшая безопасная сумма", () => {
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
    ["кириллица", "я"],
    ["эмодзи", "😀"],
  ])("имя предельной длины: %s", (_title, symbol) => {
    const name = symbol.repeat(MAX_NAME_LENGTH);

    expectRoundTrip({
      participants: [{ id: "long", name }],
      expenses: [],
    });
  });

  it("код состоит из версии и знаков base64url", () => {
    const code = encodeBill({ participants: [anna, boris], expenses: [] });

    expect(code).toMatch(/^1\.[A-Za-z0-9_-]*$/u);
  });

  it("не меняет замороженный счёт", () => {
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

  it("бросает ошибку, если трата ссылается на неизвестного участника", () => {
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

describe("идентификаторы разобранного счёта", () => {
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

  it("уникальны, а траты ссылаются на разобранных участников", () => {
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

  it("при повторном разборе одного кода одинаковы", () => {
    const code = encodeBill(bill);

    expect(decodeBill(code)).toEqual(decodeBill(code));
  });
});

describe("версия формата", () => {
  it.each(["0", "2", "99"])("версия %s не поддерживается", (version) => {
    const error = readError(`${version}.${encodeBase64Url("[[],[]]")}`);

    expect(error).toEqual({
      kind: "unsupportedVersion",
      version: Number(version),
    });
  });

  it("версию другого формата узнаёт, не разбирая нагрузку", () => {
    expect(readError("2.!!!").kind).toBe("unsupportedVersion");
  });
});

describe("повреждённые коды", () => {
  const notJson = `1.${encodeBase64Url("не JSON")}`;
  const invalidUtf8 = "1._w";

  it.each([
    ["пустая строка", ""],
    ["только версия", "1"],
    ["нет нагрузки после точки", "1."],
    ["нет версии", ".x"],
    ["версия с буквой", "v1.x"],
    ["чужие знаки в нагрузке", "1.!!!"],
    ["процентное кодирование", "1.%D0"],
    ["лишняя точка в нагрузке", "1.W1tdLFtdXQ.x"],
    ["base64 не из JSON", notJson],
    ["невалидный UTF-8", invalidUtf8],
    ["слишком длинная ссылка", `1.${"A".repeat(MAX_BILL_CODE_LENGTH)}`],
    ["огромная версия", `${"9".repeat(400)}.x`],
    ["версия за пределом безопасных целых", "9007199254740993.x"],
  ])("%s — malformed", (_title, code) => {
    expect(readError(code).kind).toBe("malformed");
  });
});

describe("предел длины", () => {
  it("проверяется раньше версии", () => {
    const code = `2.${"A".repeat(MAX_BILL_CODE_LENGTH)}`;

    expect(readError(code).kind).toBe("malformed");
  });

  it("не мешает коду ровно предельной длины дойти до проверки версии", () => {
    const code = `2.${"A".repeat(MAX_BILL_CODE_LENGTH - 2)}`;

    expect(readError(code).kind).toBe("unsupportedVersion");
  });
});

describe("неверный счёт", () => {
  const validExpense = [0, 100, [0]];

  it.each([
    ["не массив", { names: [] }],
    ["число", 5],
    ["null", null],
    ["один элемент", [[]]],
    ["лишний элемент", [["Аня"], [], []]],
    ["имена не массив", ["Аня", []]],
    ["траты не массив", [["Аня"], "траты"]],
    ["имя не строка", [[1], []]],
    ["имя длиннее предела", [["я".repeat(MAX_NAME_LENGTH + 1)], []]],
    ["пустое имя из пробелов", [["  "], []]],
    ["имена без учёта регистра", [["Аня", "аня"], []]],
    ["трата не массив", [["Аня"], ["трата"]]],
    ["кортеж траты из 2 элементов", [["Аня"], [[0, 100]]]],
    ["кортеж траты из 4 элементов", [["Аня"], [[0, 100, [0], 1]]]],
    ["плательщик −1", [["Аня"], [[-1, 100, [0]]]]],
    ["плательщик 1.5", [["Аня"], [[1.5, 100, [0]]]]],
    ["плательщик строкой", [["Аня"], [["0", 100, [0]]]]],
    ["плательщик вне диапазона", [["Аня"], [[1, 100, [0]]]]],
    ["сумма 0", [["Аня"], [[0, 0, [0]]]]],
    ["сумма −1", [["Аня"], [[0, -1, [0]]]]],
    ["сумма 1.5", [["Аня"], [[0, 1.5, [0]]]]],
    ["сумма строкой", [["Аня"], [[0, "100", [0]]]]],
    [
      "сумма больше безопасного целого",
      [["Аня"], [[0, Number.MAX_SAFE_INTEGER + 1, [0]]]],
    ],
    ["получатели не массив", [["Аня"], [[0, 100, 0]]]],
    ["пустые получатели", [["Аня"], [[0, 100, []]]]],
    ["получатели с повтором", [["Аня"], [[0, 100, [0, 0]]]]],
    ["получатель вне диапазона", [["Аня"], [[0, 100, [0, 1]]]]],
    ["получатель не число", [["Аня"], [[0, 100, ["0"]]]]],
    ["трата без участников", [[], [validExpense]]],
    [
      "сумма трат больше безопасного целого",
      [
        ["a", "b"],
        [
          [0, Number.MAX_SAFE_INTEGER, [0]],
          [1, 1, [1]],
        ],
      ],
    ],
    [
      "три суммы из подделанной ссылки",
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

  it("сумма 1e400 — invalidBill", () => {
    const code = codeFromText('[["Аня"],[[0,1e400,[0]]]]');

    expect(readError(code).kind).toBe("invalidBill");
  });

  it("счёт без участников и трат — допустимый пустой счёт", () => {
    expect(readDecodedBill(codeFromJson([[], []]))).toEqual(EMPTY_BILL);
  });
});

describe("устойчивость разбора", () => {
  it("не бросает исключений на произвольных строках", () => {
    const codes = ["", "1.", "1.[[", "\u0000", "1.😀", "..", "1.====", "-1.x"];

    for (const code of codes) {
      expect(() => decodeBill(code)).not.toThrow();
    }
  });
});

/** Простой ГПСЧ (mulberry32) с фиксированным зерном: тест воспроизводим без зависимостей. */
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
    // Номер в конце делает имена различными, не выходя за предел длины.
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

describe("свойства кодирования на псевдослучайных счетах", () => {
  const ITERATIONS = 300;

  it("круговой тест сохраняет счёт, а код подходит под шаблон", () => {
    const random = createRandom(20_240_607);

    for (let iteration = 0; iteration < ITERATIONS; iteration += 1) {
      const bill = createRandomBill(random);
      expectRoundTrip(bill);
      expect(encodeBill(bill)).toMatch(/^1\.[A-Za-z0-9_-]*$/u);
    }
  });

  it("мутации валидного кода не бросают исключений и дают допустимый счёт или ошибку", () => {
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
