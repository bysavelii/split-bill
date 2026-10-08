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

const ann: Participant = { id: "ann", name: "Ann" };
const ben: Participant = { id: "ben", name: "Ben" };
const clara: Participant = { id: "clara", name: "Clara" };

const dinner: Expense = {
  id: "dinner",
  payerId: ann.id,
  amount: 90_000,
  beneficiaryIds: [ann.id, ben.id],
};

function freezeBill(bill: Bill): Bill {
  Object.freeze(bill.participants);
  Object.freeze(bill.expenses);
  return Object.freeze(bill);
}

describe("changing the bill", () => {
  it("addParticipant returns a new bill and leaves the original unchanged", () => {
    const original = freezeBill({ participants: [ann], expenses: [] });

    const changed = addParticipant(original, ben);

    expect(changed.participants).toEqual([ann, ben]);
    expect(original.participants).toEqual([ann]);
  });

  it("removeParticipant returns a new bill and leaves the original unchanged", () => {
    const original = freezeBill({ participants: [ann, ben], expenses: [] });

    const changed = removeParticipant(original, ann.id);

    expect(changed.participants).toEqual([ben]);
    expect(original.participants).toEqual([ann, ben]);
  });

  it("addExpense returns a new bill and leaves the original unchanged", () => {
    const original = freezeBill({ participants: [ann, ben], expenses: [] });

    const changed = addExpense(original, dinner);

    expect(changed.expenses).toEqual([dinner]);
    expect(original.expenses).toEqual([]);
  });

  it("removeExpense returns a new bill and leaves the original unchanged", () => {
    const original = freezeBill({
      participants: [ann, ben],
      expenses: [dinner],
    });

    const changed = removeExpense(original, dinner.id);

    expect(changed.expenses).toEqual([]);
    expect(original.expenses).toEqual([dinner]);
  });
});

describe("findNameProblem", () => {
  const bill = addParticipant(EMPTY_BILL, ann);

  it("finds an empty name", () => {
    expect(findNameProblem(bill, "")).toBe("empty");
  });

  it("finds a name made of spaces", () => {
    expect(findNameProblem(bill, "   ")).toBe("empty");
  });

  it("finds a duplicate in another case and with spaces at the edges", () => {
    expect(findNameProblem(bill, " aNN ")).toBe("duplicate");
  });

  it("finds a name that is too long", () => {
    const name = "ω".repeat(MAX_NAME_LENGTH + 1);

    expect(findNameProblem(bill, name)).toBe("tooLong");
  });

  it("accepts a name of the maximum length, spaces at the edges do not count", () => {
    const name = ` ${"ω".repeat(MAX_NAME_LENGTH)} `;

    expect(findNameProblem(bill, name)).toBeUndefined();
  });

  it("counts an emoji as one character", () => {
    const name = "😀".repeat(MAX_NAME_LENGTH);

    expect(findNameProblem(bill, name)).toBeUndefined();
  });

  it("accepts a new name", () => {
    expect(findNameProblem(bill, "Ben")).toBeUndefined();
  });
});

describe("isParticipantInExpenses", () => {
  const bill: Bill = {
    participants: [ann, ben, clara],
    expenses: [{ ...dinner, beneficiaryIds: [ben.id] }],
  };

  it("counts the payer as taking part in the expenses", () => {
    expect(isParticipantInExpenses(bill, ann.id)).toBe(true);
  });

  it("counts the recipient as taking part in the expenses", () => {
    expect(isParticipantInExpenses(bill, ben.id)).toBe(true);
  });

  it("does not count an uninvolved participant as taking part in the expenses", () => {
    expect(isParticipantInExpenses(bill, clara.id)).toBe(false);
  });
});

describe("getParticipantName", () => {
  it("returns the participant name", () => {
    expect(
      getParticipantName({ participants: [ann], expenses: [] }, ann.id),
    ).toBe("Ann");
  });

  it("reports a missing participant", () => {
    expect(() => getParticipantName(EMPTY_BILL, "missing")).toThrow(
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
      participants: [ann, ben],
      expenses: [
        dinner,
        { ...dinner, id: "taxi", payerId: ben.id, amount: 25_050 },
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
    return { participants: [ann, ben], expenses };
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
    expect(findNamesProblem(["Ann", "   "])).toBe("empty");
  });

  it("finds a repeat ignoring case and spaces at the edges", () => {
    expect(findNamesProblem(["Άννα", "Ben", " ΆΝΝΑ "])).toBe("duplicate");
  });

  it("finds a name that is too long", () => {
    const names = ["Ann", "ω".repeat(MAX_NAME_LENGTH + 1)];

    expect(findNamesProblem(names)).toBe("tooLong");
  });

  it("accepts a list of different names", () => {
    expect(findNamesProblem(["Ann", "Ben", "Clara"])).toBeUndefined();
  });
});
