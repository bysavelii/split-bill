import {
  addExpense,
  getParticipantName,
  removeExpense,
  type Bill,
  type Expense,
  type Participant,
} from "../bill/bill";
import { formatRubles, parseRubles } from "../bill/money";
import { createElement, createField, createMessageArea } from "./dom";
import type { BillActions, Section } from "./section";

const PAYER_SELECT_ID = "expense-payer";
const AMOUNT_INPUT_ID = "expense-amount";

const AMOUNT_ERROR = "Введите сумму больше нуля, например 1500 или 349,90";
const NO_BENEFICIARIES_ERROR = "Отметьте, за кого платили";

export function createExpensesSection(actions: BillActions): Section {
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
  const beneficiaryLegend = createElement("legend", { text: "За кого" });
  const beneficiaryGroup = createElement("fieldset", {}, [beneficiaryLegend]);
  const addButton = createElement("button", {
    text: "Добавить трату",
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
  const noParticipantsNotice = createElement("p", {
    text: "Сначала добавьте участников",
  });
  const list = createElement("ul", { className: "list" });
  const element = createElement("section", {}, [
    createElement("h2", { text: "Траты" }),
    noParticipantsNotice,
    form,
    list,
  ]);

  // Списки неизменяемы, поэтому новая ссылка означает, что список участников поменялся.
  let renderedParticipants: readonly Participant[] | undefined;

  form.addEventListener("submit", (event) => {
    event.preventDefault();
    submitExpense();
  });

  function getBeneficiaryCheckboxes(): HTMLInputElement[] {
    return Array.from(beneficiaryGroup.querySelectorAll("input"));
  }

  function checkAllBeneficiaries(): void {
    for (const checkbox of getBeneficiaryCheckboxes()) checkbox.checked = true;
  }

  function submitExpense(): void {
    const amount = parseRubles(amountInput.value);
    if (amount === undefined) {
      message.textContent = AMOUNT_ERROR;
      return;
    }

    const checkedCheckboxes = getBeneficiaryCheckboxes().filter(
      (checkbox) => checkbox.checked,
    );
    if (checkedCheckboxes.length === 0) {
      message.textContent = NO_BENEFICIARIES_ERROR;
      return;
    }

    const expense: Expense = {
      id: crypto.randomUUID(),
      payerId: payerSelect.value,
      amount,
      beneficiaryIds: checkedCheckboxes.map((checkbox) => checkbox.value),
    };
    amountInput.value = "";
    checkAllBeneficiaries();
    actions.changeBill(addExpense(actions.getBill(), expense));
  }

  function createBeneficiaryCheckbox(
    participant: Participant,
  ): HTMLLabelElement {
    const checkbox = createElement("input", {
      attributes: { type: "checkbox", value: participant.id },
    });
    checkbox.checked = true;

    return createElement("label", { className: "checkbox" }, [
      checkbox,
      createElement("span", { text: participant.name }),
    ]);
  }

  function renderParticipantControls(
    participants: readonly Participant[],
  ): void {
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

    const checkboxes = participants.map(createBeneficiaryCheckbox);
    beneficiaryGroup.replaceChildren(beneficiaryLegend, ...checkboxes);
  }

  function describeExpense(bill: Bill, expense: Expense): string {
    const payerName = getParticipantName(bill, expense.payerId);
    const amountText = formatRubles(expense.amount);
    const isForEveryone =
      expense.beneficiaryIds.length === bill.participants.length;
    const beneficiariesText = isForEveryone
      ? "за всех"
      : `за: ${expense.beneficiaryIds.map((id) => getParticipantName(bill, id)).join(", ")}`;

    return `${payerName} — ${amountText}, ${beneficiariesText}`;
  }

  function createRow(bill: Bill, expense: Expense): HTMLLIElement {
    const removeButton = createElement("button", {
      text: "Удалить",
      attributes: { type: "button", "aria-label": "Удалить трату" },
    });
    removeButton.addEventListener("click", () => {
      actions.changeBill(removeExpense(actions.getBill(), expense.id));
    });

    return createElement("li", {}, [
      createElement("span", { text: describeExpense(bill, expense) }),
      removeButton,
    ]);
  }

  function render(bill: Bill): void {
    message.textContent = "";
    const hasParticipants = bill.participants.length > 0;
    noParticipantsNotice.hidden = hasParticipants;
    form.hidden = !hasParticipants;

    if (bill.participants !== renderedParticipants) {
      renderParticipantControls(bill.participants);
      renderedParticipants = bill.participants;
    }
    list.replaceChildren(
      ...bill.expenses.map((expense) => createRow(bill, expense)),
    );
  }

  return { element, render };
}
