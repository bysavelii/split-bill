import { describe, expect, it } from "vitest";
import {
  EMPTY_BILL,
  addExpense,
  addParticipant,
  calculateTotalSpent,
  findNameProblem,
  findNamesProblem,
  getParticipantName,
  isParticipantInExpenses,
  isTotalSpentWithinLimit,
  MAX_NAME_LENGTH,
  MAX_TOTAL_SPENT,
  removeExpense,
  removeParticipant,
  type Bill,
  type Expense,
  type Participant,
} from "./bill";

const anna: Participant = { id: "anna", name: "Аня" };
const boris: Participant = { id: "boris", name: "Боря" };
const vera: Participant = { id: "vera", name: "Вера" };

const dinner: Expense = {
  id: "dinner",
  payerId: anna.id,
  amount: 90_000,
  beneficiaryIds: [anna.id, boris.id],
};

function freezeBill(bill: Bill): Bill {
  Object.freeze(bill.participants);
  Object.freeze(bill.expenses);
  return Object.freeze(bill);
}

describe("изменение счёта", () => {
  it("addParticipant возвращает новый счёт и не меняет исходный", () => {
    const original = freezeBill({ participants: [anna], expenses: [] });

    const changed = addParticipant(original, boris);

    expect(changed.participants).toEqual([anna, boris]);
    expect(original.participants).toEqual([anna]);
  });

  it("removeParticipant возвращает новый счёт и не меняет исходный", () => {
    const original = freezeBill({ participants: [anna, boris], expenses: [] });

    const changed = removeParticipant(original, anna.id);

    expect(changed.participants).toEqual([boris]);
    expect(original.participants).toEqual([anna, boris]);
  });

  it("addExpense возвращает новый счёт и не меняет исходный", () => {
    const original = freezeBill({ participants: [anna, boris], expenses: [] });

    const changed = addExpense(original, dinner);

    expect(changed.expenses).toEqual([dinner]);
    expect(original.expenses).toEqual([]);
  });

  it("removeExpense возвращает новый счёт и не меняет исходный", () => {
    const original = freezeBill({
      participants: [anna, boris],
      expenses: [dinner],
    });

    const changed = removeExpense(original, dinner.id);

    expect(changed.expenses).toEqual([]);
    expect(original.expenses).toEqual([dinner]);
  });
});

describe("findNameProblem", () => {
  const bill = addParticipant(EMPTY_BILL, anna);

  it("находит пустое имя", () => {
    expect(findNameProblem(bill, "")).toBe("empty");
  });

  it("находит имя из пробелов", () => {
    expect(findNameProblem(bill, "   ")).toBe("empty");
  });

  it("находит дубль в другом регистре и с пробелами по краям", () => {
    expect(findNameProblem(bill, " аНЯ ")).toBe("duplicate");
  });

  it("находит слишком длинное имя", () => {
    const name = "я".repeat(MAX_NAME_LENGTH + 1);

    expect(findNameProblem(bill, name)).toBe("tooLong");
  });

  it("пропускает имя предельной длины, пробелы по краям не считаются", () => {
    const name = ` ${"я".repeat(MAX_NAME_LENGTH)} `;

    expect(findNameProblem(bill, name)).toBeUndefined();
  });

  it("считает эмодзи одним знаком", () => {
    const name = "😀".repeat(MAX_NAME_LENGTH);

    expect(findNameProblem(bill, name)).toBeUndefined();
  });

  it("пропускает новое имя", () => {
    expect(findNameProblem(bill, "Боря")).toBeUndefined();
  });
});

describe("isParticipantInExpenses", () => {
  const bill: Bill = {
    participants: [anna, boris, vera],
    expenses: [{ ...dinner, beneficiaryIds: [boris.id] }],
  };

  it("считает плательщика участником трат", () => {
    expect(isParticipantInExpenses(bill, anna.id)).toBe(true);
  });

  it("считает получателя участником трат", () => {
    expect(isParticipantInExpenses(bill, boris.id)).toBe(true);
  });

  it("не считает непричастного участником трат", () => {
    expect(isParticipantInExpenses(bill, vera.id)).toBe(false);
  });
});

describe("getParticipantName", () => {
  it("возвращает имя участника", () => {
    expect(
      getParticipantName({ participants: [anna], expenses: [] }, anna.id),
    ).toBe("Аня");
  });

  it("сообщает об отсутствующем участнике", () => {
    expect(() => getParticipantName(EMPTY_BILL, "нет")).toThrow(
      "Участник не найден",
    );
  });
});

describe("calculateTotalSpent", () => {
  it("для пустого счёта равна нулю", () => {
    expect(calculateTotalSpent(EMPTY_BILL)).toBe(0);
  });

  it("складывает суммы всех трат", () => {
    const bill: Bill = {
      participants: [anna, boris],
      expenses: [
        dinner,
        { ...dinner, id: "taxi", payerId: boris.id, amount: 25_050 },
      ],
    };

    expect(calculateTotalSpent(bill)).toBe(115_050);
  });
});

describe("isTotalSpentWithinLimit", () => {
  function createBillSpending(...amounts: number[]): Bill {
    const expenses = amounts.map((amount, index) => ({
      ...dinner,
      id: `expense-${String(index)}`,
      amount,
    }));
    return { participants: [anna, boris], expenses };
  }

  it("принимает пустой счёт", () => {
    expect(isTotalSpentWithinLimit(EMPTY_BILL)).toBe(true);
  });

  it("принимает итог ровно на пределе", () => {
    const bill = createBillSpending(MAX_TOTAL_SPENT - 1, 1);

    expect(isTotalSpentWithinLimit(bill)).toBe(true);
  });

  it("отклоняет итог выше предела, хотя каждая трата в пределе", () => {
    const bill = createBillSpending(MAX_TOTAL_SPENT, 1);

    expect(isTotalSpentWithinLimit(bill)).toBe(false);
  });

  it("отклоняет итог выше предела из нескольких трат", () => {
    const bill = createBillSpending(
      9_007_199_254_740_769,
      9_007_199_254_740_461,
      9_007_199_254_740_210,
    );

    expect(isTotalSpentWithinLimit(bill)).toBe(false);
  });
});

describe("findNamesProblem", () => {
  it("для пустого списка проблем нет", () => {
    expect(findNamesProblem([])).toBeUndefined();
  });

  it("находит пустое имя", () => {
    expect(findNamesProblem(["Аня", "   "])).toBe("empty");
  });

  it("находит повтор без учёта регистра и пробелов по краям", () => {
    expect(findNamesProblem(["Аня", "Боря", " аНЯ "])).toBe("duplicate");
  });

  it("находит слишком длинное имя", () => {
    const names = ["Аня", "я".repeat(MAX_NAME_LENGTH + 1)];

    expect(findNamesProblem(names)).toBe("tooLong");
  });

  it("принимает список разных имён", () => {
    expect(findNamesProblem(["Аня", "Боря", "Вера"])).toBeUndefined();
  });
});
