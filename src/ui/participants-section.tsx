import { createSignal, For } from "solid-js";
import {
  addParticipant,
  findNameProblem,
  isParticipantInExpenses,
  MAX_NAME_LENGTH,
  removeParticipant,
  type NameProblem,
  type Participant,
} from "../bill/bill";
import { Avatar } from "./avatar";
import { createBillMessage } from "./bill-message";
import type { BillProps } from "./bill-props";
import { EmptyState } from "./empty-state";
import { Field, MessageArea } from "./field";
import { RemoveButton } from "./remove-button";

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

export function ParticipantsSection(props: BillProps) {
  const [name, setName] = createSignal("");
  const [message, setMessage] = createBillMessage(() => props.bill);
  let nameInput: HTMLInputElement | undefined;

  function submitName(): void {
    const trimmedName = name().trim();

    const problem = findNameProblem(props.bill, trimmedName);
    if (problem !== undefined) {
      setMessage(describeNameProblem(problem));
      return;
    }

    const participant: Participant = {
      id: crypto.randomUUID(),
      name: trimmedName,
    };
    setName("");
    nameInput?.focus();
    props.onBillChange(addParticipant(props.bill, participant));
  }

  function requestRemoval(participant: Participant): void {
    if (isParticipantInExpenses(props.bill, participant.id)) {
      setMessage(
        `Нельзя удалить ${participant.name}: есть траты с этим участником. Сначала удалите их`,
      );
      return;
    }

    props.onBillChange(removeParticipant(props.bill, participant.id));
  }

  return (
    <section>
      <h2>Участники</h2>
      <form
        class="inline-form"
        onSubmit={(event) => {
          event.preventDefault();
          submitName();
        }}
      >
        <Field label="Имя" inputId={NAME_INPUT_ID}>
          <input
            ref={(element) => {
              nameInput = element;
            }}
            id={NAME_INPUT_ID}
            type="text"
            autocomplete="off"
            value={name()}
            onInput={(event) => {
              setName(event.currentTarget.value);
            }}
          />
        </Field>
        <button class="button button-primary" type="submit">
          Добавить
        </button>
      </form>
      <MessageArea text={message()} />
      <EmptyState
        icon="people"
        text={NO_PARTICIPANTS_TEXT}
        hidden={props.bill.participants.length > 0}
      />
      <ul class="chips">
        <For each={props.bill.participants}>
          {(participant) => (
            <li class="chip">
              <Avatar name={participant.name} />
              <span class="participant-name">{participant.name}</span>
              <RemoveButton
                ariaLabel={`Удалить участника ${participant.name}`}
                onClick={() => {
                  requestRemoval(participant);
                }}
              />
            </li>
          )}
        </For>
      </ul>
    </section>
  );
}
