import { createEffect, createMemo, createSignal, For, on } from "solid-js";
import {
  addExpense,
  getParticipantName,
  isTotalSpentWithinLimit,
  removeExpense,
  type Bill,
  type Expense,
  type Participant,
  type ParticipantId,
} from "../bill/bill";
import { parseAmount } from "../bill/money";
import { readCurrencySymbol } from "../i18n/format";
import type { Messages } from "../i18n/messages";
import { useAmountFormatter, type AmountFormatter } from "./amount-formatter";
import { Avatar } from "./avatar";
import { createBillMessage } from "./bill-message";
import type { BillProps } from "./bill-props";
import { EmptyState } from "./empty-state";
import { Field, MessageArea } from "./field";
import { Icon } from "./icons";
import { useLocale } from "./locale-context";
import { RemoveButton } from "./remove-button";

const PAYER_SELECT_ID = "expense-payer";
const AMOUNT_INPUT_ID = "expense-amount";

/** Everyone is a beneficiary by default, so the form remembers only those who were unchecked. */
const NO_UNCHECKED_IDS: ReadonlySet<ParticipantId> = new Set();

type ExpenseProblem = "invalidAmount" | "noBeneficiaries";

type ExpenseReading =
  { readonly expense: Expense } | { readonly problem: ExpenseProblem };

interface ExpenseFormFacts {
  readonly amountText: string;
  readonly payerId: ParticipantId;
  readonly beneficiaryIds: readonly ParticipantId[];
}

interface BeneficiaryToggleProps {
  readonly participant: Participant;
  readonly isChecked: boolean;
  readonly onToggle: (isChecked: boolean) => void;
}

interface ExpenseRowProps {
  readonly bill: Bill;
  readonly expense: Expense;
  readonly formatAmount: AmountFormatter;
  readonly onRemove: () => void;
}

/** The chosen payer if still in the bill, otherwise the first participant. */
function pickPayerId(
  participants: readonly Participant[],
  chosenPayerId: ParticipantId | undefined,
): ParticipantId | undefined {
  const isChosenPayerPresent = participants.some(
    (participant) => participant.id === chosenPayerId,
  );
  if (isChosenPayerPresent) return chosenPayerId;

  return participants[0]?.id;
}

function withId(
  ids: ReadonlySet<ParticipantId>,
  id: ParticipantId,
): ReadonlySet<ParticipantId> {
  return new Set([...ids, id]);
}

function withoutId(
  ids: ReadonlySet<ParticipantId>,
  id: ParticipantId,
): ReadonlySet<ParticipantId> {
  return new Set([...ids].filter((candidate) => candidate !== id));
}

function describeExpenseProblem(
  problem: ExpenseProblem,
  messages: Messages,
): string {
  switch (problem) {
    case "invalidAmount":
      return messages.expenses.amountError;
    case "noBeneficiaries":
      return messages.expenses.noBeneficiariesError;
  }
}

function readExpense(facts: ExpenseFormFacts): ExpenseReading {
  const amount = parseAmount(facts.amountText);
  if (amount === undefined) return { problem: "invalidAmount" };

  if (facts.beneficiaryIds.length === 0) {
    return { problem: "noBeneficiaries" };
  }

  const expense: Expense = {
    id: crypto.randomUUID(),
    payerId: facts.payerId,
    amount,
    beneficiaryIds: facts.beneficiaryIds,
  };

  return { expense };
}

function describeBeneficiaries(
  bill: Bill,
  expense: Expense,
  messages: Messages,
): string {
  const isForEveryone =
    expense.beneficiaryIds.length === bill.participants.length;
  if (isForEveryone) return messages.expenses.forEveryone;

  const beneficiaryNames = expense.beneficiaryIds.map((id) =>
    getParticipantName(bill, id),
  );

  return messages.expenses.forBeneficiaries(beneficiaryNames);
}

function describeRemoval(
  bill: Bill,
  expense: Expense,
  formatAmount: AmountFormatter,
  messages: Messages,
): string {
  const payerName = getParticipantName(bill, expense.payerId);
  const amountText = formatAmount(expense.amount);
  const beneficiariesText = describeBeneficiaries(bill, expense, messages);

  return messages.expenses.removeLabel(
    payerName,
    amountText,
    beneficiariesText,
  );
}

function BeneficiaryToggle(props: BeneficiaryToggleProps) {
  return (
    <label class="checkbox chip-toggle">
      <input
        class="visually-hidden"
        type="checkbox"
        value={props.participant.id}
        checked={props.isChecked}
        onChange={(event) => {
          props.onToggle(event.currentTarget.checked);
        }}
      />
      <Avatar name={props.participant.name} />
      <span class="chip-name">{props.participant.name}</span>
      <Icon name="check" class="chip-check" />
    </label>
  );
}

function ExpenseRow(props: ExpenseRowProps) {
  const { messages } = useLocale();
  const payerName = () => getParticipantName(props.bill, props.expense.payerId);

  return (
    <li class="expense">
      <Avatar name={payerName()} />
      <span class="expense-text">
        <span class="expense-payer">{payerName()}</span>
        <span class="expense-beneficiaries">
          {describeBeneficiaries(props.bill, props.expense, messages)}
        </span>
      </span>
      <span class="amount expense-amount">
        {props.formatAmount(props.expense.amount)}
      </span>
      <RemoveButton
        ariaLabel={describeRemoval(
          props.bill,
          props.expense,
          props.formatAmount,
          messages,
        )}
        onClick={props.onRemove}
      />
    </li>
  );
}

export function ExpensesSection(props: BillProps) {
  const { locale, messages } = useLocale();
  const formatAmount = useAmountFormatter(() => props.currency);
  // The list of participants changes only when its reference changes, not on any write to the bill.
  const participants = createMemo(() => props.bill.participants);
  const [chosenPayerId, setChosenPayerId] = createSignal<ParticipantId>();
  const [amountText, setAmountText] = createSignal("");
  const [uncheckedIds, setUncheckedIds] = createSignal(NO_UNCHECKED_IDS);
  const [message, setMessage] = createBillMessage(() => props.bill);

  const payerId = createMemo(() =>
    pickPayerId(participants(), chosenPayerId()),
  );
  const hasParticipants = () => participants().length > 0;
  const hasExpenses = () => props.bill.expenses.length > 0;
  const amountLabel = () =>
    messages.expenses.amountLabel(readCurrencySymbol(props.currency, locale));
  const isExpensesHintHidden = () => !hasParticipants() || hasExpenses();

  // Rows of the list are reused for the same participants, so a changed list resets the checks explicitly.
  createEffect(
    on(
      participants,
      () => {
        setUncheckedIds(NO_UNCHECKED_IDS);
      },
      { defer: true },
    ),
  );

  function listBeneficiaryIds(): ParticipantId[] {
    const checkedParticipants = participants().filter(
      (participant) => !uncheckedIds().has(participant.id),
    );

    return checkedParticipants.map((participant) => participant.id);
  }

  function changeBeneficiaryCheck(id: ParticipantId, isChecked: boolean): void {
    const currentIds = uncheckedIds();
    const nextIds = isChecked
      ? withoutId(currentIds, id)
      : withId(currentIds, id);

    setUncheckedIds(nextIds);
  }

  function submitExpense(): void {
    const currentPayerId = payerId();
    // The form is hidden while there are no participants, so nobody can pay.
    if (currentPayerId === undefined) return;

    const reading = readExpense({
      amountText: amountText(),
      payerId: currentPayerId,
      beneficiaryIds: listBeneficiaryIds(),
    });
    if ("problem" in reading) {
      setMessage(describeExpenseProblem(reading.problem, messages));
      return;
    }

    const changedBill = addExpense(props.bill, reading.expense);
    if (!isTotalSpentWithinLimit(changedBill)) {
      setMessage(messages.expenses.totalTooLargeError);
      return;
    }

    setAmountText("");
    setUncheckedIds(NO_UNCHECKED_IDS);
    props.onBillChange(changedBill);
  }

  return (
    <section>
      <h2>{messages.expenses.heading}</h2>
      <EmptyState
        icon="people"
        text={messages.expenses.noParticipantsHint}
        hidden={hasParticipants()}
      />
      <form
        class="form"
        hidden={!hasParticipants()}
        onSubmit={(event) => {
          event.preventDefault();
          submitExpense();
        }}
      >
        <Field label={messages.expenses.payerLabel} inputId={PAYER_SELECT_ID}>
          <select
            id={PAYER_SELECT_ID}
            onChange={(event) => {
              setChosenPayerId(event.currentTarget.value);
            }}
          >
            <For each={participants()}>
              {(participant) => (
                <option
                  value={participant.id}
                  selected={participant.id === payerId()}
                >
                  {participant.name}
                </option>
              )}
            </For>
          </select>
        </Field>
        <Field label={amountLabel()} inputId={AMOUNT_INPUT_ID}>
          <input
            id={AMOUNT_INPUT_ID}
            type="text"
            inputmode="decimal"
            autocomplete="off"
            value={amountText()}
            onInput={(event) => {
              setAmountText(event.currentTarget.value);
            }}
          />
        </Field>
        <fieldset>
          <legend>{messages.expenses.beneficiariesLegend}</legend>
          <div class="chips">
            <For each={participants()}>
              {(participant) => (
                <BeneficiaryToggle
                  participant={participant}
                  isChecked={!uncheckedIds().has(participant.id)}
                  onToggle={(isChecked) => {
                    changeBeneficiaryCheck(participant.id, isChecked);
                  }}
                />
              )}
            </For>
          </div>
        </fieldset>
        <button class="button button-primary" type="submit">
          {messages.expenses.addButton}
        </button>
        <MessageArea text={message()} />
      </form>
      <EmptyState
        icon="receipt"
        text={messages.expenses.emptyHint}
        hidden={isExpensesHintHidden()}
      />
      <ul class="expenses">
        <For each={props.bill.expenses}>
          {(expense) => (
            <ExpenseRow
              bill={props.bill}
              expense={expense}
              formatAmount={formatAmount}
              onRemove={() => {
                props.onBillChange(removeExpense(props.bill, expense.id));
              }}
            />
          )}
        </For>
      </ul>
    </section>
  );
}
