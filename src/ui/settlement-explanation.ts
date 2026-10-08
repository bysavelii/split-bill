import { formatRubles } from "../bill/money";
import type { Balance } from "../settlement/balances";
import { formatCount, type PluralForms } from "./plural";

const TRANSFER_FORMS: PluralForms = {
  one: "перевод",
  few: "перевода",
  many: "переводов",
};
const PERSON_FORMS: PluralForms = {
  one: "человек",
  few: "человека",
  many: "человек",
};

const BALANCED_TEXT = "в расчёте";

export const SHARE_NOTE =
  "Доля — сколько из трат пришлось на человека. Кто заплатил больше своей доли, получает разницу, кто меньше — отдаёт.";
export const ROUNDING_NOTE =
  "Когда трата не делится поровну до копейки, у тех, кто выше в списке участников, доля на копейку больше.";

export interface TransferCountFacts {
  readonly transferCount: number;
  /** Сколько человек отдают или получают деньги. */
  readonly settlingCount: number;
  readonly isMinimal: boolean;
}

/** Строка разбора: сколько заплатил, какая доля и что в итоге. */
export function describeParticipantTotals(
  name: string,
  balance: Balance,
): string {
  const paid = formatRubles(balance.paid);
  const share = formatRubles(balance.share);
  const outcome = describeOutcome(balance.amount);

  return `${name}: заплачено ${paid}, доля ${share} — ${outcome}`;
}

/** Число переводов со словом в нужной форме: «1 перевод», «2 перевода», «5 переводов». */
export function formatTransferCount(count: number): string {
  return formatCount(count, TRANSFER_FORMS);
}

/** Одна фраза о том, почему переводов именно столько. */
export function describeTransferCount(facts: TransferCountFacts): string {
  const transfers = formatTransferCount(facts.transferCount);
  const settlers = formatCount(facts.settlingCount, PERSON_FORMS);

  if (!facts.isMinimal) {
    return `${transfers}: деньги отдают или получают ${settlers}. В такой большой компании переводы подобраны упрощённо — возможно, получится обойтись меньшим числом.`;
  }

  const usualCount = facts.settlingCount - 1;
  if (facts.transferCount < usualCount) {
    return `${transfers} вместо обычных ${String(usualCount)}: деньги отдают или получают ${settlers}, но они делятся на группы, которые рассчитываются между собой. Меньше не получится.`;
  }

  return `${transfers} — меньше не получится: деньги отдают или получают ${settlers}, а когда их нельзя разбить на группы, которые рассчитываются между собой, переводов нужно на один меньше, чем людей.`;
}

function describeOutcome(amount: number): string {
  if (amount > 0) return `получает ${formatRubles(amount)}`;
  if (amount < 0) return `отдаёт ${formatRubles(-amount)}`;

  return BALANCED_TEXT;
}
