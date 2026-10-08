import type { Bill } from "../bill/bill";
import type { Currency } from "../bill/currency";
import type { Kopecks } from "../bill/money";
import { formatCount, formatNumber } from "../i18n/format";
import { hasUnevenSplit } from "../settlement/shares";
import type { AmountFormatter } from "./amount-formatter";
import type { LocaleContextValue } from "./locale-context";

export type OutcomeKind = "receives" | "gives" | "settled";

export interface BalanceOutcome {
  readonly kind: OutcomeKind;
  readonly text: string;
}

export interface TransferCountFacts {
  readonly transferCount: number;
  /** How many people give or receive money. */
  readonly settlingCount: number;
  readonly isMinimal: boolean;
}

/** The number of transfers with the word in the right form: "1 transfer", "2 перевода", "5 переводов". */
export function formatTransferCount(
  count: number,
  localization: LocaleContextValue,
): string {
  return formatCount(
    count,
    localization.messages.plurals.transfers,
    localization.locale,
  );
}

/** One phrase about why there are exactly this many transfers. */
export function describeTransferCount(
  facts: TransferCountFacts,
  localization: LocaleContextValue,
): string {
  const { locale, messages } = localization;
  const transfers = formatTransferCount(facts.transferCount, localization);
  const settlers = formatCount(
    facts.settlingCount,
    messages.plurals.people,
    locale,
  );

  if (!facts.isMinimal) {
    return messages.summary.reasonApproximate(transfers, settlers);
  }

  const usualCount = facts.settlingCount - 1;
  if (facts.transferCount < usualCount) {
    const usualCountText = formatNumber(usualCount, locale);

    return messages.summary.reasonGroups(transfers, usualCountText, settlers);
  }

  return messages.summary.reasonMinimal(transfers, settlers);
}

/** What the participant ends up with: the interface picks the color and sign by `kind`. */
export function describeBalanceOutcome(
  amount: Kopecks,
  formatAmount: AmountFormatter,
  localization: LocaleContextValue,
): BalanceOutcome {
  const { messages } = localization;
  const absoluteAmount = formatAmount(Math.abs(amount));
  if (amount > 0) {
    return {
      kind: "receives",
      text: messages.summary.receives(absoluteAmount),
    };
  }
  if (amount < 0) {
    return { kind: "gives", text: messages.summary.gives(absoluteAmount) };
  }

  return { kind: "settled", text: messages.summary.balanced };
}

/** The notes under the table: the rounding note only matters when some expense does not split evenly. */
export function listBreakdownNotes(
  bill: Bill,
  currency: Currency,
  localization: LocaleContextValue,
): string[] {
  const { messages } = localization;
  const shareNote = messages.summary.shareNote;
  if (!hasUnevenSplit(bill)) return [shareNote];

  return [shareNote, messages.roundingNote[currency]];
}
