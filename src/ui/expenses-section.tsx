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
import { createBillMessage, NO_MESSAGE } from "./bill-message";
import type { BillProps } from "./bill-props";
import { EmptyState } from "./empty-state";
import { Field, FieldError, fieldErrorId } from "./field";
import { Icon } from "./icons";
import { useLocale } from "./locale-context";
import { RemoveButton } from "./remove-button";
import { SelectBox } from "./select-box";
import { createRemovalMemory, UndoBar } from "./undo-bar";

const PAYER_SELECT_ID = "expense-payer";
const AMOUNT_INPUT_ID = "expense-amount";
const BENEFICIARIES_FIELDSET_ID = "expense-beneficiaries";
const UNDO_TEXT_ID = "expenses-undo-text";

/** Everyone is a beneficiary by default, so the form remembers only those who were unchecked. */
const NO_UNCHECKED_IDS: ReadonlySet<ParticipantId> = new Set();

type ExpenseProblem = "invalidAmount" | "noBeneficiaries" | "totalTooLarge";

/** What a removed expense is called in a text: the three formatted parts a language puts in its own order. */
interface ExpenseDescription {
  readonly payerName: string;
  readonly amountText: string;
  readonly beneficiariesText: string;
}

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

function describeExpense(
  bill: Bill,
  expense: Expense,
  formatAmount: AmountFormatter,
  messages: Messages,
): ExpenseDescription {
  return {
    payerName: getParticipantName(bill, expense.payerId),
    amountText: formatAmount(expense.amount),
    beneficiariesText: describeBeneficiaries(bill, expense, messages),
  };
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
  const description = createMemo(() =>
    describeExpense(props.bill, props.expense, props.formatAmount, messages),
  );
  const removeLabel = () => {
    const { payerName, amountText, beneficiariesText } = description();

    return messages.expenses.removeLabel(
      payerName,
      amountText,
      beneficiariesText,
    );
  };

  return (
    <li class="expense">
      <Avatar name={description().payerName} />
      <span class="expense-text">
        <span class="expense-payer">{description().payerName}</span>
        <span class="expense-beneficiaries">
          {description().beneficiariesText}
        </span>
      </span>
      <span class="amount expense-amount">{description().amountText}</span>
      <RemoveButton ariaLabel={removeLabel()} onClick={props.onRemove} />
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
  const [amountError, setAmountError] = createBillMessage(() => props.bill);
  const [beneficiariesError, setBeneficiariesError] = createBillMessage(
    () => props.bill,
  );
  const [removal, rememberRemoval] = createRemovalMemory(() => props.bill);
  let amountInput: HTMLInputElement | undefined;
  let beneficiariesFieldset: HTMLFieldSetElement | undefined;

  const payerId = createMemo(() =>
    pickPayerId(participants(), chosenPayerId()),
  );
  const hasParticipants = () => participants().length > 0;
  const hasAmountError = () => amountError() !== NO_MESSAGE;
  const hasBeneficiariesError = () => beneficiariesError() !== NO_MESSAGE;
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
    setBeneficiariesError(NO_MESSAGE);
  }

  function showAmountError(text: string): void {
    setAmountError(text);
    amountInput?.focus();
  }

  function showBeneficiariesError(text: string): void {
    const firstCheckbox =
      beneficiariesFieldset?.querySelector<HTMLInputElement>("input");

    setBeneficiariesError(text);
    firstCheckbox?.focus();
  }

  function showExpenseProblem(problem: ExpenseProblem): void {
    switch (problem) {
      case "invalidAmount":
        showAmountError(messages.expenses.amountError);
        return;
      case "totalTooLarge":
        showAmountError(messages.expenses.totalTooLargeError);
        return;
      case "noBeneficiaries":
        showBeneficiariesError(messages.expenses.noBeneficiariesError);
        return;
    }
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
      showExpenseProblem(reading.problem);
      return;
    }

    const changedBill = addExpense(props.bill, reading.expense);
    if (!isTotalSpentWithinLimit(changedBill)) {
      showExpenseProblem("totalTooLarge");
      return;
    }

    setAmountText("");
    setUncheckedIds(NO_UNCHECKED_IDS);
    amountInput?.focus();
    props.onBillChange(changedBill);
  }

  function requestRemoval(expense: Expense): void {
    const billBefore = props.bill;
    const billAfter = removeExpense(billBefore, expense.id);
    const { payerName, amountText, beneficiariesText } = describeExpense(
      billBefore,
      expense,
      formatAmount,
      messages,
    );

    props.onBillChange(billAfter);
    rememberRemoval({
      description: messages.expenses.removed(
        payerName,
        amountText,
        beneficiariesText,
      ),
      billBefore,
      billAfter,
    });
  }

  function undoRemoval(billBefore: Bill): void {
    props.onBillChange(billBefore);
    amountInput?.focus();
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
          <SelectBox>
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
          </SelectBox>
        </Field>
        <Field label={amountLabel()} inputId={AMOUNT_INPUT_ID}>
          <input
            ref={(element) => {
              amountInput = element;
            }}
            id={AMOUNT_INPUT_ID}
            type="text"
            inputmode="decimal"
            autocomplete="off"
            placeholder={messages.expenses.amountPlaceholder}
            value={amountText()}
            aria-invalid={hasAmountError() ? "true" : undefined}
            aria-describedby={
              hasAmountError() ? fieldErrorId(AMOUNT_INPUT_ID) : undefined
            }
            onInput={(event) => {
              setAmountText(event.currentTarget.value);
              setAmountError(NO_MESSAGE);
            }}
          />
          <FieldError id={fieldErrorId(AMOUNT_INPUT_ID)} text={amountError()} />
        </Field>
        <fieldset
          ref={(element) => {
            beneficiariesFieldset = element;
          }}
          id={BENEFICIARIES_FIELDSET_ID}
          aria-describedby={
            hasBeneficiariesError()
              ? fieldErrorId(BENEFICIARIES_FIELDSET_ID)
              : undefined
          }
        >
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
          <FieldError
            id={fieldErrorId(BENEFICIARIES_FIELDSET_ID)}
            text={beneficiariesError()}
          />
        </fieldset>
        <button class="button button-primary" type="submit">
          {messages.expenses.addButton}
        </button>
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
                requestRemoval(expense);
              }}
            />
          )}
        </For>
      </ul>
      <UndoBar id={UNDO_TEXT_ID} removal={removal()} onUndo={undoRemoval} />
    </section>
  );
}
