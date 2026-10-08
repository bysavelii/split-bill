import { createMemo, For, Show } from "solid-js";
import {
  calculateTotalSpent,
  getParticipantName,
  type Bill,
} from "../bill/bill";
import { formatRubles } from "../bill/money";
import { calculateBalances, type Balance } from "../settlement/balances";
import { hasUnevenSplit } from "../settlement/shares";
import {
  calculateTransfers,
  type Transfer,
  type TransferPlan,
} from "../settlement/transfers";
import { Avatar } from "./avatar";
import type { BillViewProps } from "./bill-props";
import { EmptyState } from "./empty-state";
import { Icon } from "./icons";
import {
  ROUNDING_NOTE,
  SHARE_NOTE,
  describeBalanceOutcome,
  describeTransferCount,
  formatTransferCount,
} from "./settlement-explanation";

const NO_EXPENSES_TEXT =
  "Добавьте траты — здесь появится, кто кому сколько должен";
const NO_TRANSFERS_TEXT = "Все в расчёте — переводы не нужны";
const BREAKDOWN_TITLE = "Как посчитано";
const ROUTE_SEPARATOR = " → ";
const STATUS_CLASS = "summary-status";

const NO_EXPENSES_ANNOUNCEMENT = "Итог: трат пока нет";
const NO_TRANSFERS_ANNOUNCEMENT = "Итог: все в расчёте, переводы не нужны";

const BREAKDOWN_COLUMNS = ["Участник", "Заплатил", "Доля", "Итог"];

/** What the summary shows for a bill with expenses. */
interface Settlement {
  readonly bill: Bill;
  readonly balances: readonly Balance[];
  readonly plan: TransferPlan;
}

interface TransferCardProps {
  readonly bill: Bill;
  readonly transfer: Transfer;
}

interface SettlementProps {
  readonly settlement: Settlement;
}

interface BreakdownRowProps {
  readonly bill: Bill;
  readonly balance: Balance;
}

function settle(bill: Bill): Settlement | undefined {
  if (bill.expenses.length === 0) return undefined;

  const balances = calculateBalances(bill);
  const plan = calculateTransfers(balances);

  return { bill, balances, plan };
}

function describeAnnouncement(settlement: Settlement | undefined): string {
  if (settlement === undefined) return NO_EXPENSES_ANNOUNCEMENT;

  const transferCount = settlement.plan.transfers.length;
  if (transferCount === 0) return NO_TRANSFERS_ANNOUNCEMENT;

  return `Итог: ${formatTransferCount(transferCount)}`;
}

export function SummarySection(props: BillViewProps) {
  // Every write to the bill makes a new settlement, so the content below is created anew and
  // "Как посчитано" folds, as it did when the section was redrawn completely.
  const settlement = createMemo(() => settle(props.bill));
  // The screen reader announces only this short overview, not the whole section. The memo
  // starts with the text of the empty bill so that nothing is announced an extra time on load.
  // Changes after load (bill edits, navigating to another link through hashchange) are
  // announced, and the same text is not written again: the screen reader would read it again.
  const announcement = createMemo(() => describeAnnouncement(settlement()));

  return (
    <section>
      <h2>Итог</h2>
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
              text={NO_EXPENSES_TEXT}
              class={STATUS_CLASS}
            />
          }
        >
          {(currentSettlement) => (
            <SettlementContent settlement={currentSettlement} />
          )}
        </Show>
      </div>
    </section>
  );
}

function SettlementContent(props: SettlementProps) {
  const transfers = () => props.settlement.plan.transfers;
  const transferCountText = () => formatTransferCount(transfers().length);

  return (
    <>
      <Show
        when={transfers().length > 0}
        fallback={
          <EmptyState
            icon="check"
            text={NO_TRANSFERS_TEXT}
            class={STATUS_CLASS}
          />
        }
      >
        <p class="transfers-count">
          {`Чтобы рассчитаться, нужно ${transferCountText()}`}
        </p>
        <ul class="transfers">
          <For each={transfers()}>
            {(transfer) => (
              <TransferCard bill={props.settlement.bill} transfer={transfer} />
            )}
          </For>
        </ul>
      </Show>
      <Breakdown settlement={props.settlement} />
    </>
  );
}

function TransferCard(props: TransferCardProps) {
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
        {ROUTE_SEPARATOR}
        <span class="transfer-to">{toName()}</span>
      </span>
      <span class="amount transfer-amount">
        {formatRubles(props.transfer.amount)}
      </span>
    </li>
  );
}

function Breakdown(props: SettlementProps) {
  const bill = () => props.settlement.bill;
  const plan = () => props.settlement.plan;
  const totalSpentText = () =>
    `Всего потрачено: ${formatRubles(calculateTotalSpent(bill()))}`;
  const notes = () =>
    hasUnevenSplit(bill()) ? [SHARE_NOTE, ROUNDING_NOTE] : [SHARE_NOTE];
  const reasonText = () =>
    describeTransferCount({
      transferCount: plan().transfers.length,
      settlingCount: plan().settlingCount,
      isMinimal: plan().isMinimal,
    });

  return (
    <details class="breakdown">
      <summary>{BREAKDOWN_TITLE}</summary>
      <Show when={plan().transfers.length > 0}>
        <p class="transfers-reason">{reasonText()}</p>
      </Show>
      <p>{totalSpentText()}</p>
      <div class="table-scroll">
        <table>
          <thead>
            <tr>
              <For each={BREAKDOWN_COLUMNS}>
                {(title) => <th scope="col">{title}</th>}
              </For>
            </tr>
          </thead>
          <tbody>
            <For each={props.settlement.balances}>
              {(balance) => <BreakdownRow bill={bill()} balance={balance} />}
            </For>
          </tbody>
        </table>
      </div>
      <For each={notes()}>{(note) => <p class="note">{note}</p>}</For>
    </details>
  );
}

function BreakdownRow(props: BreakdownRowProps) {
  const outcome = () => describeBalanceOutcome(props.balance.amount);

  return (
    <tr>
      <th scope="row">
        {getParticipantName(props.bill, props.balance.participantId)}
      </th>
      <td class="amount">{formatRubles(props.balance.paid)}</td>
      <td class="amount">{formatRubles(props.balance.share)}</td>
      <td class={`outcome outcome-${outcome().kind}`}>{outcome().text}</td>
    </tr>
  );
}
