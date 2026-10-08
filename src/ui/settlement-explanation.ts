import { formatRubles, type Kopecks } from "../bill/money";
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
const PLUS_SIGN = "+";
/** Настоящий минус (U+2212), а не дефис: он той же ширины, что и плюс. */
const MINUS_SIGN = "\u2212";

export const SHARE_NOTE =
  "Доля — сколько из трат пришлось на человека. Кто заплатил больше своей доли, получает разницу, кто меньше — отдаёт.";
export const ROUNDING_NOTE =
  "Когда трата не делится поровну до копейки, у тех, кто выше в списке участников, доля на копейку больше.";

export type OutcomeKind = "receives" | "gives" | "settled";

export interface BalanceOutcome {
  readonly kind: OutcomeKind;
  readonly text: string;
}

export interface TransferCountFacts {
  readonly transferCount: number;
  /** Сколько человек отдают или получают деньги. */
  readonly settlingCount: number;
  readonly isMinimal: boolean;
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

/** Что получается у участника в итоге: цвет и знак в интерфейсе выбирают по `kind`. */
export function describeBalanceOutcome(amount: Kopecks): BalanceOutcome {
  const absoluteAmount = formatRubles(Math.abs(amount));
  if (amount > 0) {
    return { kind: "receives", text: `получает ${PLUS_SIGN}${absoluteAmount}` };
  }
  if (amount < 0) {
    return { kind: "gives", text: `отдаёт ${MINUS_SIGN}${absoluteAmount}` };
  }

  return { kind: "settled", text: BALANCED_TEXT };
}
