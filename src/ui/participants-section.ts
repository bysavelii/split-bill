import {
  addParticipant,
  findNameProblem,
  isParticipantInExpenses,
  MAX_NAME_LENGTH,
  removeParticipant,
  type Bill,
  type NameProblem,
  type Participant,
} from "../bill/bill";
import { createAvatar } from "./avatar";
import { createElement, createField, createMessageArea } from "./dom";
import { createEmptyState } from "./empty-state";
import { createRemoveButton } from "./remove-button";
import type { BillActions, Section } from "./section";

const NAME_INPUT_ID = "participant-name";
const NO_PARTICIPANTS_TEXT =
  "Добавьте всех, кто участвует, — хватит имени. Себя тоже";

function describeNameProblem(problem: NameProblem): string {
  switch (problem) {
    case "empty":
      return "Введите имя";
    case "tooLong":
      return `Имя длиннее ${String(MAX_NAME_LENGTH)} знаков — сократите его`;
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
    className: "button button-primary",
    attributes: { type: "submit" },
  });
  const message = createMessageArea();
  const emptyState = createEmptyState("people", NO_PARTICIPANTS_TEXT);
  const chips = createElement("ul", { className: "chips" });
  const form = createElement("form", { className: "inline-form" }, [
    createField("Имя", nameInput),
    addButton,
  ]);
  const element = createElement("section", {}, [
    createElement("h2", { text: "Участники" }),
    form,
    message,
    emptyState,
    chips,
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

  function createChip(participant: Participant): HTMLLIElement {
    const removeButton = createRemoveButton(
      `Удалить участника ${participant.name}`,
    );
    removeButton.addEventListener("click", () => {
      requestRemoval(participant);
    });

    return createElement("li", { className: "chip" }, [
      createAvatar(participant.name),
      createElement("span", {
        className: "participant-name",
        text: participant.name,
      }),
      removeButton,
    ]);
  }

  function render(bill: Bill): void {
    message.textContent = "";
    emptyState.hidden = bill.participants.length > 0;
    chips.replaceChildren(...bill.participants.map(createChip));
  }

  return { element, render };
}
