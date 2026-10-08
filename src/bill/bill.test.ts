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

describe("changing the bill", () => {
  it("addParticipant returns a new bill and leaves the original unchanged", () => {
    const original = freezeBill({ participants: [anna], expenses: [] });

    const changed = addParticipant(original, boris);

    expect(changed.participants).toEqual([anna, boris]);
    expect(original.participants).toEqual([anna]);
  });

  it("removeParticipant returns a new bill and leaves the original unchanged", () => {
    const original = freezeBill({ participants: [anna, boris], expenses: [] });

    const changed = removeParticipant(original, anna.id);

    expect(changed.participants).toEqual([boris]);
    expect(original.participants).toEqual([anna, boris]);
  });

  it("addExpense returns a new bill and leaves the original unchanged", () => {
    const original = freezeBill({ participants: [anna, boris], expenses: [] });

    const changed = addExpense(original, dinner);

    expect(changed.expenses).toEqual([dinner]);
    expect(original.expenses).toEqual([]);
  });

  it("removeExpense returns a new bill and leaves the original unchanged", () => {
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

  it("finds an empty name", () => {
    expect(findNameProblem(bill, "")).toBe("empty");
  });

  it("finds a name made of spaces", () => {
    expect(findNameProblem(bill, "   ")).toBe("empty");
  });

  it("finds a duplicate in another case and with spaces at the edges", () => {
    expect(findNameProblem(bill, " аНЯ ")).toBe("duplicate");
  });

  it("finds a name that is too long", () => {
    const name = "я".repeat(MAX_NAME_LENGTH + 1);

    expect(findNameProblem(bill, name)).toBe("tooLong");
  });

  it("accepts a name of the maximum length, spaces at the edges do not count", () => {
    const name = ` ${"я".repeat(MAX_NAME_LENGTH)} `;

    expect(findNameProblem(bill, name)).toBeUndefined();
  });

  it("counts an emoji as one character", () => {
    const name = "😀".repeat(MAX_NAME_LENGTH);

    expect(findNameProblem(bill, name)).toBeUndefined();
  });

  it("accepts a new name", () => {
    expect(findNameProblem(bill, "Боря")).toBeUndefined();
  });
});

describe("isParticipantInExpenses", () => {
  const bill: Bill = {
    participants: [anna, boris, vera],
    expenses: [{ ...dinner, beneficiaryIds: [boris.id] }],
  };

  it("counts the payer as taking part in the expenses", () => {
    expect(isParticipantInExpenses(bill, anna.id)).toBe(true);
  });

  it("counts the recipient as taking part in the expenses", () => {
    expect(isParticipantInExpenses(bill, boris.id)).toBe(true);
  });

  it("does not count an uninvolved participant as taking part in the expenses", () => {
    expect(isParticipantInExpenses(bill, vera.id)).toBe(false);
  });
});

describe("getParticipantName", () => {
  it("returns the participant name", () => {
    expect(
      getParticipantName({ participants: [anna], expenses: [] }, anna.id),
    ).toBe("Аня");
  });

  it("reports a missing participant", () => {
    expect(() => getParticipantName(EMPTY_BILL, "нет")).toThrow(
      "Participant not found",
    );
  });
});

describe("calculateTotalSpent", () => {
  it("is zero for an empty bill", () => {
    expect(calculateTotalSpent(EMPTY_BILL)).toBe(0);
  });

  it("adds up the amounts of all expenses", () => {
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

  it("accepts an empty bill", () => {
    expect(isTotalSpentWithinLimit(EMPTY_BILL)).toBe(true);
  });

  it("accepts a total exactly at the limit", () => {
    const bill = createBillSpending(MAX_TOTAL_SPENT - 1, 1);

    expect(isTotalSpentWithinLimit(bill)).toBe(true);
  });

  it("rejects a total above the limit even though each expense is within it", () => {
    const bill = createBillSpending(MAX_TOTAL_SPENT, 1);

    expect(isTotalSpentWithinLimit(bill)).toBe(false);
  });

  it("rejects a total above the limit made of several expenses", () => {
    const bill = createBillSpending(
      9_007_199_254_740_769,
      9_007_199_254_740_461,
      9_007_199_254_740_210,
    );

    expect(isTotalSpentWithinLimit(bill)).toBe(false);
  });
});

describe("findNamesProblem", () => {
  it("finds no problem in an empty list", () => {
    expect(findNamesProblem([])).toBeUndefined();
  });

  it("finds an empty name", () => {
    expect(findNamesProblem(["Аня", "   "])).toBe("empty");
  });

  it("finds a repeat ignoring case and spaces at the edges", () => {
    expect(findNamesProblem(["Аня", "Боря", " аНЯ "])).toBe("duplicate");
  });

  it("finds a name that is too long", () => {
    const names = ["Аня", "я".repeat(MAX_NAME_LENGTH + 1)];

    expect(findNamesProblem(names)).toBe("tooLong");
  });

  it("accepts a list of different names", () => {
    expect(findNamesProblem(["Аня", "Боря", "Вера"])).toBeUndefined();
  });
});
