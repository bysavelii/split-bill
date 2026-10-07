import {
  addParticipant,
  findNameProblem,
  isParticipantInExpenses,
  removeParticipant,
  type Bill,
  type NameProblem,
  type Participant,
} from "../bill/bill";
import { createElement, createField, createMessageArea } from "./dom";
import type { BillActions, Section } from "./section";

const NAME_INPUT_ID = "participant-name";

function describeNameProblem(problem: NameProblem): string {
  switch (problem) {
    case "empty":
      return "Введите имя";
    case "duplicate":
      return "Участник с таким именем уже есть";
  }
}

export function createParticipantsSection(actions: BillActions): Section {
  const nameInput = createElement("input", {
    attributes: { id: NAME_INPUT_ID, type: "text", autocomplete: "off" },
  });
  const addButton = createElement("button", {
    text: "Добавить",
    attributes: { type: "submit" },
  });
  const message = createMessageArea();
  const list = createElement("ul", { className: "list" });
  const form = createElement("form", { className: "form" }, [
    createField("Имя", nameInput),
    addButton,
  ]);
  const element = createElement("section", {}, [
    createElement("h2", { text: "Участники" }),
    form,
    message,
    list,
  ]);

  form.addEventListener("submit", (event) => {
    event.preventDefault();
    submitName();
  });

  function submitName(): void {
    const bill = actions.getBill();
    const name = nameInput.value.trim();

    const problem = findNameProblem(bill, name);
    if (problem !== undefined) {
      message.textContent = describeNameProblem(problem);
      return;
    }

    const participant: Participant = { id: crypto.randomUUID(), name };
    nameInput.value = "";
    nameInput.focus();
    actions.changeBill(addParticipant(bill, participant));
  }

  function requestRemoval(participant: Participant): void {
    const bill = actions.getBill();
    if (isParticipantInExpenses(bill, participant.id)) {
      message.textContent = `Нельзя удалить ${participant.name}: есть траты с этим участником. Сначала удалите их`;
      return;
    }

    actions.changeBill(removeParticipant(bill, participant.id));
  }

  function createRow(participant: Participant): HTMLLIElement {
    const removeButton = createElement("button", {
      text: "Удалить",
      attributes: {
        type: "button",
        "aria-label": `Удалить участника ${participant.name}`,
      },
    });
    removeButton.addEventListener("click", () => {
      requestRemoval(participant);
    });

    return createElement("li", {}, [
      createElement("span", { text: participant.name }),
      removeButton,
    ]);
  }

  function render(bill: Bill): void {
    message.textContent = "";
    list.replaceChildren(...bill.participants.map(createRow));
  }

  return { element, render };
}
