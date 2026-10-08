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
import { formatNumber } from "../i18n/format";
import type { Messages } from "../i18n/messages";
import type { Locale } from "../i18n/locales";
import { Avatar } from "./avatar";
import { createBillMessage } from "./bill-message";
import type { BillProps } from "./bill-props";
import { EmptyState } from "./empty-state";
import { Field, MessageArea } from "./field";
import { useLocale } from "./locale-context";
import { RemoveButton } from "./remove-button";

const NAME_INPUT_ID = "participant-name";

function describeNameProblem(
  problem: NameProblem,
  messages: Messages,
  locale: Locale,
): string {
  switch (problem) {
    case "empty":
      return messages.participants.nameEmpty;
    case "tooLong":
      return messages.participants.nameTooLong(
        formatNumber(MAX_NAME_LENGTH, locale),
      );
    case "duplicate":
      return messages.participants.nameDuplicate;
  }
}

export function ParticipantsSection(props: BillProps) {
  const { locale, messages } = useLocale();
  const [name, setName] = createSignal("");
  const [message, setMessage] = createBillMessage(() => props.bill);
  let nameInput: HTMLInputElement | undefined;

  function submitName(): void {
    const trimmedName = name().trim();

    const problem = findNameProblem(props.bill, trimmedName);
    if (problem !== undefined) {
      setMessage(describeNameProblem(problem, messages, locale));
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
      setMessage(messages.participants.cannotRemove(participant.name));
      return;
    }

    props.onBillChange(removeParticipant(props.bill, participant.id));
  }

  return (
    <section>
      <h2>{messages.participants.heading}</h2>
      <form
        class="inline-form"
        onSubmit={(event) => {
          event.preventDefault();
          submitName();
        }}
      >
        <Field label={messages.participants.nameLabel} inputId={NAME_INPUT_ID}>
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
          {messages.participants.addButton}
        </button>
      </form>
      <MessageArea text={message()} />
      <EmptyState
        icon="people"
        text={messages.participants.emptyHint}
        hidden={props.bill.participants.length > 0}
      />
      <ul class="chips">
        <For each={props.bill.participants}>
          {(participant) => (
            <li class="chip">
              <Avatar name={participant.name} />
              <span class="participant-name">{participant.name}</span>
              <RemoveButton
                ariaLabel={messages.participants.removeLabel(participant.name)}
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
