import { describe, expect, it } from "vitest";
import {
  EMPTY_BILL,
  addExpense,
  addParticipant,
  findNameProblem,
  getParticipantName,
  isParticipantInExpenses,
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
