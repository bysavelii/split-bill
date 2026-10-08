import {
  addExpense,
  getParticipantName,
  isTotalSpentWithinLimit,
  removeExpense,
  type Bill,
  type Expense,
  type Participant,
} from "../bill/bill";
import { formatRubles, parseRubles } from "../bill/money";
import { createAvatar } from "./avatar";
import { createElement, createField, createMessageArea } from "./dom";
import { createEmptyState } from "./empty-state";
import { createIcon } from "./icons";
import { createRemoveButton } from "./remove-button";
import type { BillActions, Section } from "./section";

const NO_PARTICIPANTS_TEXT = "Сначала добавьте участников";
const NO_EXPENSES_TEXT =
  "Трат пока нет. Добавьте первую: кто платил, сколько и за кого";

const PAYER_SELECT_ID = "expense-payer";
const AMOUNT_INPUT_ID = "expense-amount";

const AMOUNT_ERROR = "Введите сумму больше нуля, например 1500 или 349,90";
const NO_BENEFICIARIES_ERROR = "Отметьте, за кого платили";
const TOTAL_TOO_LARGE_ERROR =
  "Слишком большая сумма: общий итог счёта не поместится в расчёт";

interface ExpenseForm {
  readonly form: HTMLFormElement;
  readonly payerSelect: HTMLSelectElement;
  readonly amountInput: HTMLInputElement;
  readonly beneficiaryChips: HTMLDivElement;
  readonly message: HTMLParagraphElement;
}

type ExpenseReading =
  { readonly expense: Expense } | { readonly error: string };

function createExpenseForm(): ExpenseForm {
  const payerSelect = createElement("select", {
    attributes: { id: PAYER_SELECT_ID },
  });
  const amountInput = createElement("input", {
    attributes: {
      id: AMOUNT_INPUT_ID,
      type: "text",
      inputmode: "decimal",
      autocomplete: "off",
    },
  });
  const beneficiaryChips = createElement("div", { className: "chips" });
  const beneficiaryGroup = createElement("fieldset", {}, [
    createElement("legend", { text: "За кого" }),
    beneficiaryChips,
  ]);
  const addButton = createElement("button", {
    text: "Добавить трату",
    className: "button button-primary",
    attributes: { type: "submit" },
  });
  const message = createMessageArea();
  const form = createElement("form", { className: "form" }, [
    createField("Кто платил", payerSelect),
    createField("Сколько, ₽", amountInput),
    beneficiaryGroup,
    addButton,
    message,
  ]);

  return {
    form,
    payerSelect,
    amountInput,
    beneficiaryChips,
    message,
  };
}

function getBeneficiaryCheckboxes(
  expenseForm: ExpenseForm,
): HTMLInputElement[] {
  return Array.from(expenseForm.beneficiaryChips.querySelectorAll("input"));
}

function checkAllBeneficiaries(expenseForm: ExpenseForm): void {
  for (const checkbox of getBeneficiaryCheckboxes(expenseForm)) {
    checkbox.checked = true;
  }
}

function readExpense(expenseForm: ExpenseForm): ExpenseReading {
  const amount = parseRubles(expenseForm.amountInput.value);
  if (amount === undefined) return { error: AMOUNT_ERROR };

  const checkedCheckboxes = getBeneficiaryCheckboxes(expenseForm).filter(
    (checkbox) => checkbox.checked,
  );
  if (checkedCheckboxes.length === 0) return { error: NO_BENEFICIARIES_ERROR };

  const expense: Expense = {
    id: crypto.randomUUID(),
    payerId: expenseForm.payerSelect.value,
    amount,
    beneficiaryIds: checkedCheckboxes.map((checkbox) => checkbox.value),
  };

  return { expense };
}

function resetExpenseForm(expenseForm: ExpenseForm): void {
  expenseForm.amountInput.value = "";
  checkAllBeneficiaries(expenseForm);
}

function renderPayerOptions(
  expenseForm: ExpenseForm,
  participants: readonly Participant[],
): void {
  const { payerSelect } = expenseForm;
  const previousPayerId = payerSelect.value;
  const options = participants.map((participant) =>
    createElement("option", {
      text: participant.name,
      attributes: { value: participant.id },
    }),
  );
  payerSelect.replaceChildren(...options);

  const isPreviousPayerPresent = participants.some(
    (participant) => participant.id === previousPayerId,
  );
  if (isPreviousPayerPresent) payerSelect.value = previousPayerId;
}

function createBeneficiaryCheckbox(participant: Participant): HTMLLabelElement {
  const checkbox = createElement("input", {
    className: "visually-hidden",
    attributes: { type: "checkbox", value: participant.id },
  });
  checkbox.checked = true;
  const checkIcon = createIcon("check");
  checkIcon.classList.add("chip-check");

  return createElement("label", { className: "checkbox chip-toggle" }, [
    checkbox,
    createAvatar(participant.name),
    createElement("span", { className: "chip-name", text: participant.name }),
    checkIcon,
  ]);
}

function renderBeneficiaryCheckboxes(
  expenseForm: ExpenseForm,
  participants: readonly Participant[],
): void {
  const checkboxes = participants.map(createBeneficiaryCheckbox);
  expenseForm.beneficiaryChips.replaceChildren(...checkboxes);
}

function describeBeneficiaries(bill: Bill, expense: Expense): string {
  const isForEveryone =
    expense.beneficiaryIds.length === bill.participants.length;
  if (isForEveryone) return "за всех";

  const beneficiaryNames = expense.beneficiaryIds.map((id) =>
    getParticipantName(bill, id),
  );

  return `за: ${beneficiaryNames.join(", ")}`;
}

function describeExpense(bill: Bill, expense: Expense): string {
  const payerName = getParticipantName(bill, expense.payerId);
  const amountText = formatRubles(expense.amount);
  const beneficiariesText = describeBeneficiaries(bill, expense);

  return `${payerName} — ${amountText}, ${beneficiariesText}`;
}

function createExpenseRow(
  bill: Bill,
  expense: Expense,
  actions: BillActions,
): HTMLLIElement {
  const description = describeExpense(bill, expense);
  const removeButton = createRemoveButton(`Удалить трату: ${description}`);
  removeButton.addEventListener("click", () => {
    actions.changeBill(removeExpense(actions.getBill(), expense.id));
  });
  const payerName = getParticipantName(bill, expense.payerId);
  const text = createElement("span", { className: "expense-text" }, [
    createElement("span", { className: "expense-payer", text: payerName }),
    createElement("span", {
      className: "expense-beneficiaries",
      text: describeBeneficiaries(bill, expense),
    }),
  ]);

  return createElement("li", { className: "expense" }, [
    createAvatar(payerName),
    text,
    createElement("span", {
      className: "amount expense-amount",
      text: formatRubles(expense.amount),
    }),
    removeButton,
  ]);
}

function renderExpenseRows(
  list: HTMLUListElement,
  bill: Bill,
  actions: BillActions,
): void {
  const rows = bill.expenses.map((expense) =>
    createExpenseRow(bill, expense, actions),
  );
  list.replaceChildren(...rows);
}

function showMessage(expenseForm: ExpenseForm, text: string): void {
  expenseForm.message.textContent = text;
}

function clearMessage(expenseForm: ExpenseForm): void {
  expenseForm.message.textContent = "";
}

function showFormWhenParticipantsPresent(
  bill: Bill,
  expenseForm: ExpenseForm,
  noParticipantsNotice: HTMLElement,
): void {
  const hasParticipants = bill.participants.length > 0;
  noParticipantsNotice.hidden = hasParticipants;
  expenseForm.form.hidden = !hasParticipants;
}

function showHintWhenNoExpenses(bill: Bill, noExpensesHint: HTMLElement): void {
  const hasParticipants = bill.participants.length > 0;
  const hasExpenses = bill.expenses.length > 0;
  noExpensesHint.hidden = !hasParticipants || hasExpenses;
}

export function createExpensesSection(actions: BillActions): Section {
  const expenseForm = createExpenseForm();
  const noParticipantsNotice = createEmptyState("people", NO_PARTICIPANTS_TEXT);
  const noExpensesHint = createEmptyState("receipt", NO_EXPENSES_TEXT);
  const list = createElement("ul", { className: "expenses" });
  const element = createElement("section", {}, [
    createElement("h2", { text: "Траты" }),
    noParticipantsNotice,
    expenseForm.form,
    noExpensesHint,
    list,
  ]);

  // Списки неизменяемы, поэтому новая ссылка означает, что список участников поменялся.
  let renderedParticipants: readonly Participant[] | undefined;

  expenseForm.form.addEventListener("submit", (event) => {
    event.preventDefault();
    submitExpense();
  });

  function submitExpense(): void {
    const reading = readExpense(expenseForm);
    if ("error" in reading) {
      showMessage(expenseForm, reading.error);
      return;
    }

    const changedBill = addExpense(actions.getBill(), reading.expense);
    if (!isTotalSpentWithinLimit(changedBill)) {
      showMessage(expenseForm, TOTAL_TOO_LARGE_ERROR);
      return;
    }

    resetExpenseForm(expenseForm);
    actions.changeBill(changedBill);
  }

  function render(bill: Bill): void {
    clearMessage(expenseForm);
    showFormWhenParticipantsPresent(bill, expenseForm, noParticipantsNotice);
    showHintWhenNoExpenses(bill, noExpensesHint);

    const haveParticipantsChanged = bill.participants !== renderedParticipants;
    if (haveParticipantsChanged) {
      renderPayerOptions(expenseForm, bill.participants);
      renderBeneficiaryCheckboxes(expenseForm, bill.participants);
      renderedParticipants = bill.participants;
    }

    renderExpenseRows(list, bill, actions);
  }

  return { element, render };
}
