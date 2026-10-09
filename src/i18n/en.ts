import type { Messages } from "./messages";
import { MINUS_SIGN } from "./typography";

export const EN_MESSAGES: Messages = {
  header: {
    title: "Split the bill",
    subtitle: "Who owes whom, without spreadsheets or arguments",
    spent: (amountText) => `spent ${amountText}`,
  },
  participants: {
    heading: "Participants",
    nameLabel: "Name",
    addButton: "Add",
    emptyHint: "Add everyone who is in — a name is enough. Yourself too",
    nameEmpty: "Enter a name",
    nameTooLong: (maxLengthText) =>
      `The name is longer than ${maxLengthText} characters — shorten it`,
    nameDuplicate: "A participant with this name already exists",
    cannotRemove: (name) =>
      `Can't remove ${name}: there are expenses with this participant. Remove them first`,
    removeLabel: (name) => `Remove participant ${name}`,
    removed: (name) => `Participant removed: ${name}`,
  },
  expenses: {
    heading: "Expenses",
    noParticipantsHint: "Add participants first",
    emptyHint:
      "No expenses yet. Add the first one: who paid, how much and for whom",
    payerLabel: "Who paid",
    amountLabel: (currencySymbol) => `Amount, ${currencySymbol}`,
    amountPlaceholder: "1500 or 349.90",
    beneficiariesLegend: "For whom",
    addButton: "Add expense",
    amountError: "Enter an amount above zero, for example 1500 or 349.90",
    noBeneficiariesError: "Choose who the payment was for",
    totalTooLargeError:
      "The amount is too large: the bill total would not fit into the calculation",
    forEveryone: "for everyone",
    forBeneficiaries: (names) => `for: ${names.join(", ")}`,
    removeLabel: (payerName, amountText, beneficiariesText) =>
      `Remove expense: ${payerName} — ${amountText}, ${beneficiariesText}`,
    removed: (payerName, amountText, beneficiariesText) =>
      `Expense removed: ${payerName} — ${amountText}, ${beneficiariesText}`,
  },
  undo: {
    button: "Undo",
  },
  summary: {
    heading: "Summary",
    emptyHint: "Add expenses — here you will see who owes whom",
    settledHint: "Everyone is even — no transfers needed",
    announcementNoExpenses: "Summary: no expenses yet",
    announcementSettled: "Summary: everyone is even, no transfers needed",
    announcement: (transfersText) => `Summary: ${transfersText}`,
    transfersNeeded: (transfersText) =>
      `To settle up, you need ${transfersText}`,
    routeSeparator: " → ",
    breakdownTitle: "How it is calculated",
    breakdownColumns: {
      participant: "Participant",
      paid: "Paid",
      share: "Share",
      outcome: "Result",
    },
    totalSpent: (amountText) => `Total spent: ${amountText}`,
    shareNote:
      "Share is how much of the expenses fell on a person. Whoever paid more than their share receives the difference; whoever paid less gives it.",
    receives: (amountText) => `receives +${amountText}`,
    gives: (amountText) => `gives ${MINUS_SIGN}${amountText}`,
    balanced: "even",
    reasonApproximate: (transfersText, settlersText) =>
      `${transfersText}: ${settlersText} give or receive money. In such a big group the transfers are picked in a simplified way — fewer might be possible.`,
    reasonGroups: (transfersText, usualCountText, settlersText) =>
      `${transfersText} instead of the usual ${usualCountText}: ${settlersText} give or receive money, but they split into groups that settle among themselves. It can't be fewer.`,
    reasonMinimal: (transfersText, settlersText) =>
      `${transfersText} — it can't be fewer: ${settlersText} give or receive money, and when they can't be split into groups that settle among themselves, you need one transfer fewer than there are people.`,
  },
  share: {
    heading: "Share",
    note: "The bill is kept in the link itself — no server, no sign-up. Anyone who opens it sees the same bill.",
    button: "Share",
    linkLabel: "Bill link",
    copied: "Link copied. Send it to your group — they will see this bill",
    copyManually:
      "Couldn't copy automatically: copy the link from the field and send it to your group",
  },
  linkNotice: {
    malformed:
      "Couldn't open the bill from this link: it is damaged or was copied incompletely. Ask to send it again, or start a new bill in the meantime.",
    unsupportedVersion:
      "This link was made by another version of the app, so it can't be opened here. Ask for a new link, or start a new bill in the meantime.",
    close: "Close",
    closeLabel: "Close message",
  },
  plurals: {
    participants: { one: "participant", other: "participants" },
    expenses: { one: "expense", other: "expenses" },
    transfers: { one: "transfer", other: "transfers" },
    people: { one: "person", other: "people" },
  },
  seo: {
    title: "Split the Bill — Who Owes Whom, Fewest Transfers",
    description:
      "Free bill splitter: add who paid what and for whom, and get the fewest transfers to settle up. No sign-up, and the whole bill fits in one shareable link.",
    imageAlt:
      "The Split the bill page with an example: participants, expenses and the transfers that settle everyone up",
  },
  howItWorks: {
    heading: "How it works",
    steps: [
      "Add everyone who is in — yourself too.",
      "Enter each expense: who paid, how much and for whom.",
      "See the fewest transfers that settle everyone up, and send the link to the group.",
    ],
  },
  footer: {
    madeBy: "Made by",
    authorSite: "https://bysavelii.com/",
  },
  currencyLabel: "Currency",
  currencyNames: {
    USD: "US dollar",
    RUB: "Russian ruble",
  },
  roundingNote: {
    USD: "When an expense doesn't split evenly to the cent, those higher in the participant list get a share one cent larger.",
    RUB: "When an expense doesn't split evenly to the kopeck, those higher in the participant list get a share one kopeck larger.",
  },
};
