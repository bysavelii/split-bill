import { createMemo, For, Show } from "solid-js";
import type { Currency } from "../bill/currency";
import {
  calculateTotalSpent,
  getParticipantName,
  type Bill,
} from "../bill/bill";
import { calculateBalances, type Balance } from "../settlement/balances";
import {
  calculateTransfers,
  type Transfer,
  type TransferPlan,
} from "../settlement/transfers";
import { useAmountFormatter, type AmountFormatter } from "./amount-formatter";
import { Avatar } from "./avatar";
import type { BillViewProps } from "./bill-props";
import { EmptyState } from "./empty-state";
import { Icon } from "./icons";
import { useLocale, type LocaleContextValue } from "./locale-context";
import {
  describeBalanceOutcome,
  describeTransferCount,
  formatTransferCount,
  listBreakdownNotes,
} from "./settlement-explanation";

const STATUS_CLASS = "summary-status";

/** What the summary shows for a bill with expenses. */
interface Settlement {
  readonly bill: Bill;
  readonly balances: readonly Balance[];
  readonly plan: TransferPlan;
}

interface TransferCardProps {
  readonly bill: Bill;
  readonly transfer: Transfer;
  readonly formatAmount: AmountFormatter;
}

interface SettlementProps {
  readonly settlement: Settlement;
  readonly currency: Currency;
  readonly formatAmount: AmountFormatter;
}

interface BreakdownRowProps {
  readonly bill: Bill;
  readonly balance: Balance;
  readonly formatAmount: AmountFormatter;
}

function settle(bill: Bill): Settlement | undefined {
  if (bill.expenses.length === 0) return undefined;

  const balances = calculateBalances(bill);
  const plan = calculateTransfers(balances);

  return { bill, balances, plan };
}

function describeAnnouncement(
  settlement: Settlement | undefined,
  localization: LocaleContextValue,
): string {
  const { messages } = localization;
  if (settlement === undefined) return messages.summary.announcementNoExpenses;

  const transferCount = settlement.plan.transfers.length;
  if (transferCount === 0) return messages.summary.announcementSettled;

  return messages.summary.announcement(
    formatTransferCount(transferCount, localization),
  );
}

export function SummarySection(props: BillViewProps) {
  const localization = useLocale();
  const { messages } = localization;
  const formatAmount = useAmountFormatter(() => props.currency);
  // Every write to the bill makes a new settlement, so the content below is created anew and
  // "How it is calculated" folds, as it did when the section was redrawn completely.
  const settlement = createMemo(() => settle(props.bill));
  // The screen reader announces only this short overview, not the whole section. The memo
  // starts with the text of the empty bill so that nothing is announced an extra time on load.
  // Changes after load (bill edits, navigating to another link through hashchange) are
  // announced, and the same text is not written again: the screen reader would read it again.
  const announcement = createMemo(() =>
    describeAnnouncement(settlement(), localization),
  );

  return (
    <section>
      <h2>{messages.summary.heading}</h2>
      <div class="visually-hidden" aria-live="polite" aria-atomic="true">
        {announcement()}
      </div>
      <div>
        <Show
          when={settlement()}
          keyed
          fallback={
            <EmptyState
              icon="receipt"
              text={messages.summary.emptyHint}
              class={STATUS_CLASS}
            />
          }
        >
          {(currentSettlement) => (
            <SettlementContent
              settlement={currentSettlement}
              currency={props.currency}
              formatAmount={formatAmount}
            />
          )}
        </Show>
      </div>
    </section>
  );
}

function SettlementContent(props: SettlementProps) {
  const localization = useLocale();
  const { messages } = localization;
  const transfers = () => props.settlement.plan.transfers;
  const transferCountText = () =>
    formatTransferCount(transfers().length, localization);

  return (
    <>
      <Show
        when={transfers().length > 0}
        fallback={
          <EmptyState
            icon="check"
            text={messages.summary.settledHint}
            class={STATUS_CLASS}
          />
        }
      >
        <p class="transfers-count">
          {messages.summary.transfersNeeded(transferCountText())}
        </p>
        <ul class="transfers">
          <For each={transfers()}>
            {(transfer) => (
              <TransferCard
                bill={props.settlement.bill}
                transfer={transfer}
                formatAmount={props.formatAmount}
              />
            )}
          </For>
        </ul>
      </Show>
      <Breakdown
        settlement={props.settlement}
        currency={props.currency}
        formatAmount={props.formatAmount}
      />
    </>
  );
}

function TransferCard(props: TransferCardProps) {
  const { messages } = useLocale();
  const fromName = () => getParticipantName(props.bill, props.transfer.fromId);
  const toName = () => getParticipantName(props.bill, props.transfer.toId);

  return (
    <li class="transfer">
      <span class="transfer-people">
        <Avatar name={fromName()} />
        <Icon name="arrow" />
        <Avatar name={toName()} />
      </span>
      <span class="transfer-route">
        <span class="transfer-from">{fromName()}</span>
        {messages.summary.routeSeparator}
        <span class="transfer-to">{toName()}</span>
      </span>
      <span class="amount transfer-amount">
        {props.formatAmount(props.transfer.amount)}
      </span>
    </li>
  );
}

function Breakdown(props: SettlementProps) {
  const localization = useLocale();
  const { messages } = localization;
  const bill = () => props.settlement.bill;
  const plan = () => props.settlement.plan;
  const columns = () => [
    messages.summary.breakdownColumns.participant,
    messages.summary.breakdownColumns.paid,
    messages.summary.breakdownColumns.share,
    messages.summary.breakdownColumns.outcome,
  ];
  const totalSpentText = () =>
    messages.summary.totalSpent(
      props.formatAmount(calculateTotalSpent(bill())),
    );
  const notes = () => listBreakdownNotes(bill(), props.currency, localization);
  const reasonText = () =>
    describeTransferCount(
      {
        transferCount: plan().transfers.length,
        settlingCount: plan().settlingCount,
        isMinimal: plan().isMinimal,
      },
      localization,
    );

  return (
    <details class="breakdown">
      <summary>{messages.summary.breakdownTitle}</summary>
      <Show when={plan().transfers.length > 0}>
        <p class="transfers-reason">{reasonText()}</p>
      </Show>
      <p>{totalSpentText()}</p>
      <div class="table-scroll">
        <table>
          <thead>
            <tr>
              <For each={columns()}>
                {(title) => <th scope="col">{title}</th>}
              </For>
            </tr>
          </thead>
          <tbody>
            <For each={props.settlement.balances}>
              {(balance) => (
                <BreakdownRow
                  bill={bill()}
                  balance={balance}
                  formatAmount={props.formatAmount}
                />
              )}
            </For>
          </tbody>
        </table>
      </div>
      <For each={notes()}>{(note) => <p class="note">{note}</p>}</For>
    </details>
  );
}

function BreakdownRow(props: BreakdownRowProps) {
  const localization = useLocale();
  const outcome = () =>
    describeBalanceOutcome(
      props.balance.amount,
      props.formatAmount,
      localization,
    );

  return (
    <tr>
      <th scope="row">
        {getParticipantName(props.bill, props.balance.participantId)}
      </th>
      <td class="amount">{props.formatAmount(props.balance.paid)}</td>
      <td class="amount">{props.formatAmount(props.balance.share)}</td>
      <td class={`outcome outcome-${outcome().kind}`}>{outcome().text}</td>
    </tr>
  );
}
