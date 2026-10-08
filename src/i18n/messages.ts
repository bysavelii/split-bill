import type { Currency } from "../bill/currency";
import type { PluralForms } from "./format";

/**
 * Every text of the interface. Plain texts are strings; a text with a number, a name or an amount
 * is a function of already formatted strings, so a language can put them anywhere in a phrase.
 */
export interface Messages {
  readonly header: {
    readonly title: string;
    readonly subtitle: string;
    /** "spent $0.00": the third item of the bill overview. */
    readonly spent: (amountText: string) => string;
  };
  readonly participants: {
    readonly heading: string;
    readonly nameLabel: string;
    readonly addButton: string;
    readonly emptyHint: string;
    readonly nameEmpty: string;
    readonly nameTooLong: (maxLengthText: string) => string;
    readonly nameDuplicate: string;
    readonly cannotRemove: (name: string) => string;
    readonly removeLabel: (name: string) => string;
  };
  readonly expenses: {
    readonly heading: string;
    readonly noParticipantsHint: string;
    readonly emptyHint: string;
    readonly payerLabel: string;
    readonly amountLabel: (currencySymbol: string) => string;
    readonly beneficiariesLegend: string;
    readonly addButton: string;
    readonly amountError: string;
    readonly noBeneficiariesError: string;
    readonly totalTooLargeError: string;
    readonly forEveryone: string;
    readonly forBeneficiaries: (names: readonly string[]) => string;
    readonly removeLabel: (
      payerName: string,
      amountText: string,
      beneficiariesText: string,
    ) => string;
  };
  readonly summary: {
    readonly heading: string;
    readonly emptyHint: string;
    readonly settledHint: string;
    readonly announcementNoExpenses: string;
    readonly announcementSettled: string;
    readonly announcement: (transfersText: string) => string;
    readonly transfersNeeded: (transfersText: string) => string;
    /** Between the names of the sender and the recipient of a transfer. */
    readonly routeSeparator: string;
    readonly breakdownTitle: string;
    readonly breakdownColumns: {
      readonly participant: string;
      readonly paid: string;
      readonly share: string;
      readonly outcome: string;
    };
    readonly totalSpent: (amountText: string) => string;
    readonly shareNote: string;
    /** The outcome of a participant who is owed money; the amount is written with a plus. */
    readonly receives: (amountText: string) => string;
    /** The outcome of a participant who owes money; the amount is written with a minus. */
    readonly gives: (amountText: string) => string;
    readonly balanced: string;
    readonly reasonApproximate: (
      transfersText: string,
      settlersText: string,
    ) => string;
    readonly reasonGroups: (
      transfersText: string,
      usualCountText: string,
      settlersText: string,
    ) => string;
    readonly reasonMinimal: (
      transfersText: string,
      settlersText: string,
    ) => string;
  };
  readonly share: {
    readonly heading: string;
    readonly note: string;
    readonly button: string;
    readonly linkLabel: string;
    readonly copied: string;
    readonly copyManually: string;
  };
  readonly linkNotice: {
    readonly malformed: string;
    readonly unsupportedVersion: string;
    readonly close: string;
    readonly closeLabel: string;
  };
  readonly plurals: {
    readonly participants: PluralForms;
    readonly expenses: PluralForms;
    readonly transfers: PluralForms;
    readonly people: PluralForms;
  };
  readonly currencyNames: Record<Currency, string>;
  /** Names the minor unit of the currency, so it differs per currency. */
  readonly roundingNote: Record<Currency, string>;
}
