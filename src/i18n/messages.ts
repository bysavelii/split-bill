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
    /** The text of the undo bar after a participant is removed. */
    readonly removed: (name: string) => string;
  };
  readonly expenses: {
    readonly heading: string;
    readonly noParticipantsHint: string;
    readonly emptyHint: string;
    readonly payerLabel: string;
    readonly amountLabel: (currencySymbol: string) => string;
    /** The format of an amount shown in the empty field. */
    readonly amountPlaceholder: string;
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
    /** The text of the undo bar after an expense is removed. */
    readonly removed: (
      payerName: string,
      amountText: string,
      beneficiariesText: string,
    ) => string;
  };
  readonly undo: {
    readonly button: string;
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
    /** Success: says what happened and what to do next. */
    readonly copied: string;
    /** The copy failed: says what to do by hand. */
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
  /** Texts for search engines and link previews; the page head uses them. */
  readonly seo: {
    /** The title of the page; search results cut it at about 60 characters. */
    readonly title: string;
    /** The snippet of the page; search results cut it at about 160 characters. */
    readonly description: string;
    /** The description of the preview image for those who cannot see it. */
    readonly imageAlt: string;
  };
  /** The static block under the app: it explains the page to those who read it without scripts. */
  readonly howItWorks: {
    readonly heading: string;
    readonly steps: readonly [string, string, string];
  };
  /** The accessible name of the currency select; the label is not shown. */
  readonly currencyLabel: string;
  readonly currencyNames: Record<Currency, string>;
  /** Names the minor unit of the currency, so it differs per currency. */
  readonly roundingNote: Record<Currency, string>;
}
