// @vitest-environment jsdom
import { fireEvent, render } from "@solidjs/testing-library";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { EMPTY_BILL, MAX_NAME_LENGTH, type Bill } from "../bill/bill";
import { encodeBase64Url } from "../sharing/base64-url";
import { DICTIONARIES } from "../i18n/dictionaries";
import type { PluralForms } from "../i18n/format";
import { LOCALE_DEFINITIONS, type Locale } from "../i18n/locales";
import { decodeBill, encodeBill } from "../sharing/bill-code";
import { App } from "./app";

const RU = DICTIONARIES.ru;
// dictionaries.test.ts guarantees that the Russian sets have all four forms.
const RU_PARTICIPANTS = RU.plurals.participants as Required<PluralForms>;
const RU_EXPENSES = RU.plurals.expenses as Required<PluralForms>;
const RU_TRANSFERS = RU.plurals.transfers as Required<PluralForms>;
const RU_PEOPLE = RU.plurals.people as Required<PluralForms>;

let root: HTMLElement;
let unmountApp: () => void;

function normalize(text: string | null | undefined): string {
  return (text ?? "").replace(/\s/gu, " ").trim();
}

function findInput(labelText: string): HTMLInputElement {
  const label = [...root.querySelectorAll("label")].find(
    (candidate) => normalize(candidate.textContent) === labelText,
  );
  const input = label?.htmlFor
    ? root.querySelector<HTMLInputElement>(`#${label.htmlFor}`)
    : null;
  if (input === null) throw new Error(`Field "${labelText}" not found`);
  return input;
}

/** A button by its accessible name: `aria-label`, or the visible text if there is none. */
function findButton(name: string): HTMLButtonElement {
  const button = [...root.querySelectorAll("button")].find(
    (candidate) =>
      normalize(
        candidate.getAttribute("aria-label") ?? candidate.textContent,
      ) === name,
  );
  if (button === undefined) throw new Error(`Button "${name}" not found`);
  return button;
}

function addParticipant(name: string): void {
  fireEvent.input(findInput(RU.participants.nameLabel), {
    target: { value: name },
  });
  findButton(RU.participants.addButton).click();
}

function addExpense(amount: string): void {
  fireEvent.input(findInput(RU.expenses.amountLabel("₽")), {
    target: { value: amount },
  });
  findButton(RU.expenses.addButton).click();
}

/** The payer select of the expense form; the currency select in the header is a different one. */
function findPayerSelect(): HTMLSelectElement {
  const select = root.querySelector<HTMLSelectElement>(".form select");
  if (select === null) throw new Error("Payer select not found");

  return select;
}

/** The currency select in the header; the payer select of the expense form is a different one. */
function findCurrencySelect(): HTMLSelectElement {
  const select = root.querySelector<HTMLSelectElement>(".page-toolbar select");
  if (select === null) throw new Error("Currency select not found");

  return select;
}

function chooseCurrency(currency: string): void {
  fireEvent.change(findCurrencySelect(), { target: { value: currency } });
}

function installClipboard(writeText: (text: string) => Promise<void>): void {
  Object.defineProperty(navigator, "clipboard", {
    value: { writeText },
    configurable: true,
  });
}

function selectPayer(name: string): void {
  const select = findPayerSelect();
  const option = [...select.options].find(
    (candidate) => candidate.text === name,
  );
  if (option === undefined) throw new Error(`Payer ${name} not found`);
  fireEvent.change(select, { target: { value: option.value } });
}

function addParticipants(...names: string[]): void {
  for (const name of names) addParticipant(name);
}

function addExpenseBy(payer: string, amount: string): void {
  selectPayer(payer);
  addExpense(amount);
}

function uncheckBeneficiary(name: string): void {
  const label = [...root.querySelectorAll("label.chip-toggle")].find(
    (candidate) =>
      normalize(candidate.querySelector(".chip-name")?.textContent ?? null) ===
      name,
  );
  const checkbox = label?.querySelector("input");
  if (checkbox === null || checkbox === undefined)
    throw new Error(`Checkbox ${name} not found`);
  if (checkbox.checked) fireEvent.click(checkbox);
}

function readTexts(selector: string): string[] {
  return [...root.querySelectorAll(selector)].map((element) =>
    normalize(element.textContent),
  );
}

function findSection(title: string): HTMLElement {
  const section = [...root.querySelectorAll("section")].find(
    (candidate) => candidate.querySelector("h2")?.textContent === title,
  );
  if (section === undefined) throw new Error(`Section "${title}" not found`);
  return section;
}

function readParticipantNames(): string[] {
  return readTexts(".participant-name");
}

function readExpenses(sectionTitle = RU.expenses.heading): string[] {
  const rows = [...findSection(sectionTitle).querySelectorAll(".expense")];

  return rows.map((row) => {
    const payer = normalize(row.querySelector(".expense-payer")?.textContent);
    const amount = normalize(row.querySelector(".expense-amount")?.textContent);
    const beneficiaries = normalize(
      row.querySelector(".expense-beneficiaries")?.textContent,
    );

    return `${payer} — ${amount}, ${beneficiaries}`;
  });
}

function readParticipantsMessage(): string {
  return normalize(
    findSection(RU.participants.heading).querySelector(".message")
      ?.textContent ?? "",
  );
}

/** The error of a control or a group: the element its `aria-describedby` points to; empty while the control has none. */
function readFieldError(control: Element): string {
  const errorId = control.getAttribute("aria-describedby");
  if (errorId === null) return "";

  return normalize(root.querySelector(`#${errorId}`)?.textContent);
}

function findBeneficiariesFieldset(): HTMLFieldSetElement {
  const fieldset = root.querySelector("fieldset");
  if (fieldset === null) throw new Error("Fieldset not found");

  return fieldset;
}

function readBeneficiariesError(): string {
  return readFieldError(findBeneficiariesFieldset());
}

function findFirstBeneficiaryCheckbox(): HTMLInputElement {
  const checkbox = findBeneficiariesFieldset().querySelector("input");
  if (checkbox === null) throw new Error("Checkbox not found");

  return checkbox;
}

function findUndoButton(sectionTitle: string, name: string): HTMLButtonElement {
  const section = findSection(sectionTitle);
  const button = [...section.querySelectorAll(".undo button")].find(
    (candidate) => normalize(candidate.textContent) === name,
  );
  if (button === undefined) throw new Error(`Button "${name}" not found`);

  return button as HTMLButtonElement;
}

function isUndoBarShown(sectionTitle: string): boolean {
  const bar = findSection(sectionTitle).querySelector<HTMLElement>(".undo");

  return bar !== null && !bar.hidden;
}

function readUndoText(sectionTitle: string): string {
  return normalize(
    findSection(sectionTitle).querySelector(".undo p")?.textContent,
  );
}

function readSummary(sectionTitle = RU.summary.heading): string[] {
  const summary = readSummarySection(sectionTitle);
  const cards = [...summary.querySelectorAll(".transfer")];
  if (cards.length > 0) {
    return cards.map((card) => {
      const from = normalize(card.querySelector(".transfer-from")?.textContent);
      const to = normalize(card.querySelector(".transfer-to")?.textContent);
      const amount = normalize(
        card.querySelector(".transfer-amount")?.textContent,
      );

      return `${from} → ${to}: ${amount}`;
    });
  }

  return [normalize(summary.querySelector(".summary-status")?.textContent)];
}

function readSummarySection(sectionTitle = RU.summary.heading): HTMLElement {
  return findSection(sectionTitle);
}

function findAnnouncement(sectionTitle = RU.summary.heading): HTMLElement {
  const announcement =
    readSummarySection(sectionTitle).querySelector<HTMLElement>("[aria-live]");
  if (announcement === null) throw new Error("Announcement area not found");
  return announcement;
}

function readAnnouncement(sectionTitle = RU.summary.heading): string {
  return normalize(findAnnouncement(sectionTitle).textContent);
}

function readRemoveExpenseLabels(): string[] {
  const buttons = [
    ...findSection(RU.expenses.heading).querySelectorAll("button[aria-label]"),
  ];
  return buttons.map((button) => normalize(button.getAttribute("aria-label")));
}

function readBreakdown(summaryTitle = RU.summary.heading): string[] {
  const rows = readSummarySection(summaryTitle).querySelectorAll("tbody tr");

  return [...rows].map((row) =>
    [...row.querySelectorAll("th, td")]
      .map((cell) => normalize(cell.textContent))
      .join(" | "),
  );
}

function readReason(): string | undefined {
  const reason = readSummarySection().querySelector(".transfers-reason");
  return reason === null ? undefined : normalize(reason.textContent);
}

function readNotes(): string[] {
  const notes = readSummarySection().querySelectorAll(".note");
  return [...notes].map((note) => normalize(note.textContent));
}

function readParagraphs(): string[] {
  const paragraphs = readSummarySection().querySelectorAll("p");
  return [...paragraphs].map((paragraph) => normalize(paragraph.textContent));
}

const ENGLISH_SECTIONS = {
  participants: "Participants",
  expenses: "Expenses",
  summary: "Summary",
  share: "Share",
} as const;

// Literal codes, not produced by `encodeBill`: links already shared in the wild must keep opening,
// so these codes must stay the same whatever the app is built with.
/** The first version of the format: no currency. */
const LITERAL_CODE =
  "1.W1siQW5uIiwiQmVuIiwiQ2xhcmEiLCJEYW4iXSxbWzAsNDgwMDAwLFswLDEsMiwzXV0sWzEsMTI1MDUwLFswLDEsMl1dLFsyLDYwMDAwLFsyLDNdXV1d";
/** The current version: Ann paid 123.45 for both, Bob paid 5.00 for himself; in dollars. */
const LITERAL_CODE_USD =
  "2.W1siQW5uIiwiQm9iIl0sW1swLDEyMzQ1LFswLDFdXSxbMSw1MDAsWzFdXV0sIlVTRCJd";
/** The same bill in rubles. */
const LITERAL_CODE_RUB =
  "2.W1siQW5uIiwiQm9iIl0sW1swLDEyMzQ1LFswLDFdXSxbMSw1MDAsWzFdXV0sIlJVQiJd";

const SHARE_COPIED_RU = RU.share.copied;
const SHARE_COPY_MANUALLY_RU = RU.share.copyManually;
const SHARE_COPIED_EN =
  "Link copied. Send it to your group — they will see this bill";
const SHARE_COPY_MANUALLY_EN =
  "Couldn't copy automatically: copy the link from the field and send it to your group";

const EMPTY_SUMMARY = RU.summary.emptyHint;

/** Mounts the app again at the current address, removing the handlers of the previous one. */
function remountApp(locale: Locale = "ru"): void {
  unmountApp();
  document.body.innerHTML = '<main id="app"></main>';
  const app = document.getElementById("app");
  if (app === null) throw new Error("#app not found");
  root = app;
  unmountApp = render(() => <App locale={locale} />, {
    container: root,
  }).unmount;
}

/** Changes the address of the open page the way following a link with another fragment does. */
function changeAddressOnPage(address: string): void {
  history.replaceState(null, "", address);
  window.dispatchEvent(new HashChangeEvent("hashchange"));
}

beforeEach(() => {
  history.replaceState(null, "", "/");
  Reflect.deleteProperty(navigator, "clipboard");
  unmountApp = () => undefined;
  remountApp();
});

afterEach(() => {
  unmountApp();
  Reflect.deleteProperty(navigator, "clipboard");
});

describe("the bill splitting scenario", () => {
  it("shows who transfers to whom and brings the hint back after an expense is removed", () => {
    expect(readSummary()).toEqual([EMPTY_SUMMARY]);

    addParticipant("Ann");
    addParticipant("Ben");
    addParticipant("Clara");
    selectPayer("Ann");
    addExpense("900");

    expect(readSummary()).toEqual([
      "Ben → Ann: 300,00 ₽",
      "Clara → Ann: 300,00 ₽",
    ]);
    expect(readExpenses()).toEqual([
      `Ann — 900,00 ₽, ${RU.expenses.forEveryone}`,
    ]);

    findButton(
      RU.expenses.removeLabel("Ann", "900,00 ₽", RU.expenses.forEveryone),
    ).click();

    expect(readSummary()).toEqual([EMPTY_SUMMARY]);
  });

  it("says no transfers are needed when everyone is settled", () => {
    addParticipant("Ann");
    addExpense("100");

    expect(readSummary()).toEqual([RU.summary.settledHint]);
  });

  it("lists the recipients of an expense separated by commas", () => {
    addParticipant("Ann");
    addParticipant("Ben");
    addParticipant("Clara");
    uncheckBeneficiary("Clara");
    addExpense("100");

    expect(readExpenses()).toEqual([
      `Ann — 100,00 ₽, ${RU.expenses.forBeneficiaries(["Ann", "Ben"])}`,
    ]);
  });

  it("after adding an expense clears the amount, checks everyone and keeps the payer", () => {
    addParticipant("Ann");
    addParticipant("Ben");
    selectPayer("Ben");
    uncheckBeneficiary("Ann");
    addExpense("100");

    const select = findPayerSelect();
    const checkboxes = [
      ...root.querySelectorAll<HTMLInputElement>("label.checkbox input"),
    ];
    expect(findInput(RU.expenses.amountLabel("₽")).value).toBe("");
    expect(checkboxes.map((checkbox) => checkbox.checked)).toEqual([
      true,
      true,
    ]);
    expect(select.selectedOptions[0]?.text).toBe("Ben");
  });

  it("checks everyone again when the list of participants changes", () => {
    addParticipant("Ann");
    addParticipant("Ben");
    uncheckBeneficiary("Ann");

    addParticipant("Clara");

    const checkboxes = [
      ...root.querySelectorAll<HTMLInputElement>("label.checkbox input"),
    ];
    expect(checkboxes.map((checkbox) => checkbox.checked)).toEqual([
      true,
      true,
      true,
    ]);
  });

  it("while there are no participants, shows a hint instead of the expense form", () => {
    const form = root.querySelectorAll("form")[1];
    const notice = [...root.querySelectorAll("p")].find(
      (paragraph) => paragraph.textContent === RU.expenses.noParticipantsHint,
    );

    expect(form?.hidden).toBe(true);
    expect(notice?.hidden).toBe(false);

    addParticipant("Ann");

    expect(form?.hidden).toBe(false);
    expect(notice?.hidden).toBe(true);
  });
});

describe("header", () => {
  function readOverview(): string[] {
    return readTexts(".page-header .overview-item");
  }

  it("shows the title and the subtitle", () => {
    expect(root.querySelector(".page-header h1")?.textContent).toBe(
      RU.header.title,
    );
    expect(root.querySelector(".page-subtitle")?.textContent).toBe(
      RU.header.subtitle,
    );
  });

  it("shows zeros for an empty bill", () => {
    expect(readOverview()).toEqual([
      `0 ${RU_PARTICIPANTS.many}`,
      `0 ${RU_EXPENSES.many}`,
      RU.header.spent("0,00 ₽"),
    ]);
  });

  it("counts participants, expenses and the total spent", () => {
    addParticipants("Ann", "Ben", "Clara");
    addExpenseBy("Ann", "900");

    expect(readOverview()).toEqual([
      `3 ${RU_PARTICIPANTS.few}`,
      `1 ${RU_EXPENSES.one}`,
      RU.header.spent("900,00 ₽"),
    ]);
  });
});

describe("delete buttons", () => {
  it("are icons without visible text, and aria-label gives them the name", () => {
    addParticipants("Ann", "Ben");
    addExpenseBy("Ann", "900");

    const buttons = [...root.querySelectorAll("button.icon-button")];

    expect(
      buttons.map((button) => normalize(button.getAttribute("aria-label"))),
    ).toEqual([
      RU.participants.removeLabel("Ann"),
      RU.participants.removeLabel("Ben"),
      RU.expenses.removeLabel("Ann", "900,00 ₽", RU.expenses.forEveryone),
    ]);
    for (const button of buttons) {
      expect(button.querySelector("svg")).not.toBeNull();
      expect(normalize(button.textContent)).toBe("");
    }
  });
});

describe("avatars", () => {
  function readToneClasses(container: Element | null): string[] {
    const avatars = container?.querySelectorAll(".avatar") ?? [];

    return [...avatars].flatMap((avatar) =>
      [...avatar.classList].filter((name) => name.startsWith("avatar-tone-")),
    );
  }

  it("one person has the same tone everywhere", () => {
    addParticipants("Ann", "Ben");
    selectPayer("Ben");
    addExpense("100");

    const participantChip = root.querySelectorAll(".chip")[1] ?? null;
    const expenseRow = root.querySelector(".expense");
    const beneficiaryChip = root.querySelectorAll(".chip-toggle")[1] ?? null;
    const tones = [participantChip, expenseRow, beneficiaryChip].map(
      readToneClasses,
    );

    expect(tones[0]).toHaveLength(1);
    expect(tones[1]).toEqual(tones[0]);
    expect(tones[2]).toEqual(tones[0]);
  });
});

describe("empty state hints", () => {
  function readHints(): string[] {
    const hints = [
      ...findSection(RU.participants.heading).querySelectorAll<HTMLElement>(
        ".empty-state",
      ),
      ...findSection(RU.expenses.heading).querySelectorAll<HTMLElement>(
        ".empty-state",
      ),
    ];

    return hints
      .filter((hint) => !hint.hidden)
      .map((hint) => normalize(hint.textContent));
  }

  const NO_PARTICIPANTS_HINT = RU.participants.emptyHint;
  const NO_EXPENSES_HINT = RU.expenses.emptyHint;

  it("without participants asks to add people and shows the other hints", () => {
    expect(readHints()).toEqual([
      NO_PARTICIPANTS_HINT,
      RU.expenses.noParticipantsHint,
    ]);
  });

  it("with participants and no expenses asks to add the first expense", () => {
    addParticipant("Ann");

    expect(readHints()).toEqual([NO_EXPENSES_HINT]);
  });

  it("the expenses hint disappears after the first expense", () => {
    addParticipant("Ann");
    addExpense("100");

    expect(readHints()).toEqual([]);
  });

  it("every hint has an icon hidden from the screen reader", () => {
    for (const hint of root.querySelectorAll(".empty-state")) {
      expect(hint.querySelector("svg")?.getAttribute("aria-hidden")).toBe(
        "true",
      );
    }
  });
});

describe("explanation of the summary", () => {
  const ROUNDING_TEXT = RU.roundingNote.RUB;

  it("shows the breakdown for one person who paid for everyone", () => {
    addParticipants("Ann", "Ben", "Clara");
    addExpenseBy("Ann", "900");

    expect(readParagraphs()).toContain(RU.summary.totalSpent("900,00 ₽"));
    expect(readBreakdown()).toEqual([
      `Ann | 900,00 ₽ | 300,00 ₽ | ${RU.summary.receives("600,00 ₽")}`,
      `Ben | 0,00 ₽ | 300,00 ₽ | ${RU.summary.gives("300,00 ₽")}`,
      `Clara | 0,00 ₽ | 300,00 ₽ | ${RU.summary.gives("300,00 ₽")}`,
    ]);
    expect(
      readSummarySection().querySelector("details > summary")?.textContent,
    ).toBe(RU.summary.breakdownTitle);
  });

  it('tells "receives" from "gives" by class, sign and word', () => {
    addParticipants("Ann", "Ben", "Clara");
    uncheckBeneficiary("Clara");
    addExpenseBy("Ann", "100");

    const outcomes = [...readSummarySection().querySelectorAll("td.outcome")];

    expect(outcomes.map((outcome) => outcome.className)).toEqual([
      "outcome outcome-receives",
      "outcome outcome-gives",
      "outcome outcome-settled",
    ]);
    expect(outcomes.map((outcome) => normalize(outcome.textContent))).toEqual([
      RU.summary.receives("50,00 ₽"),
      RU.summary.gives("50,00 ₽"),
      RU.summary.balanced,
    ]);
  });

  it('hides the reason for the number of transfers inside "How it is calculated"', () => {
    addParticipants("Ann", "Ben", "Clara");
    addExpenseBy("Ann", "900");

    const breakdown = readSummarySection().querySelector("details");

    expect(breakdown?.open).toBe(false);
    expect(breakdown?.querySelector(".transfers-reason")).not.toBeNull();
    expect(
      readSummarySection().querySelectorAll(".transfers-reason"),
    ).toHaveLength(1);
  });

  it("explains why there are exactly this many transfers", () => {
    addParticipants("Ann", "Ben", "Clara");
    addExpenseBy("Ann", "900");

    expect(readReason()).toBe(
      RU.summary.reasonMinimal(`2 ${RU_TRANSFERS.few}`, `3 ${RU_PEOPLE.few}`),
    );
  });

  it("100 rubles for three: two transfers of 33.33 ₽", () => {
    addParticipants("Ann", "Ben", "Clara");
    addExpenseBy("Ann", "100");

    expect(readSummary()).toEqual([
      "Ben → Ann: 33,33 ₽",
      "Clara → Ann: 33,33 ₽",
    ]);
  });

  it("mutual debts of 700 and 300 ₽: one transfer of 400 ₽", () => {
    addParticipants("Ann", "Ben");
    uncheckBeneficiary("Ann");
    addExpenseBy("Ann", "700");
    uncheckBeneficiary("Ben");
    addExpenseBy("Ben", "300");

    expect(readSummary()).toEqual(["Ben → Ann: 400,00 ₽"]);
  });

  it("with mutual debts shows the settled outcome and does not explain the number of transfers", () => {
    addParticipants("Ann", "Ben");
    uncheckBeneficiary("Ann");
    addExpenseBy("Ann", "500");
    uncheckBeneficiary("Ben");
    addExpenseBy("Ben", "500");

    expect(readSummary()).toEqual([RU.summary.settledHint]);
    expect(readReason()).toBeUndefined();
    expect(readBreakdown()).toEqual([
      `Ann | 500,00 ₽ | 500,00 ₽ | ${RU.summary.balanced}`,
      `Ben | 500,00 ₽ | 500,00 ₽ | ${RU.summary.balanced}`,
    ]);
  });

  it("explains that there are fewer transfers than usual when the group splits into subgroups", () => {
    addParticipants("Ann", "Ben", "Clara", "Eve");
    uncheckBeneficiary("Ann");
    uncheckBeneficiary("Clara");
    uncheckBeneficiary("Eve");
    addExpenseBy("Ann", "300");
    uncheckBeneficiary("Ann");
    uncheckBeneficiary("Ben");
    uncheckBeneficiary("Clara");
    addExpenseBy("Clara", "200");

    expect(readSummary()).toEqual([
      "Ben → Ann: 300,00 ₽",
      "Eve → Clara: 200,00 ₽",
    ]);
    expect(readReason()).toBe(
      RU.summary.reasonGroups(
        `2 ${RU_TRANSFERS.few}`,
        "3",
        `4 ${RU_PEOPLE.few}`,
      ),
    );
  });

  it("explains about kopecks when an expense does not divide evenly", () => {
    addParticipants("Ann", "Ben", "Clara");
    addExpenseBy("Ann", "100");

    expect(readNotes()).toContain(ROUNDING_TEXT);
  });

  it("does not explain about kopecks when all expenses divide evenly", () => {
    addParticipants("Ann", "Ben", "Clara");
    addExpenseBy("Ann", "900");

    expect(readNotes()).not.toContain(ROUNDING_TEXT);
    expect(readNotes()).toHaveLength(1);
  });

  it("one participant with an expense on themselves: settled, no transfers", () => {
    addParticipants("Ann");
    addExpenseBy("Ann", "500");

    expect(readSummary()).toEqual([RU.summary.settledHint]);
    expect(readBreakdown()).toEqual([
      `Ann | 500,00 ₽ | 500,00 ₽ | ${RU.summary.balanced}`,
    ]);
  });

  it("a participant without expenses gets into the breakdown with the settled outcome", () => {
    addParticipants("Ann", "Ben", "Clara");
    uncheckBeneficiary("Clara");
    addExpenseBy("Ann", "100");

    expect(readBreakdown()).toEqual([
      `Ann | 100,00 ₽ | 50,00 ₽ | ${RU.summary.receives("50,00 ₽")}`,
      `Ben | 0,00 ₽ | 50,00 ₽ | ${RU.summary.gives("50,00 ₽")}`,
      `Clara | 0,00 ₽ | 0,00 ₽ | ${RU.summary.balanced}`,
    ]);
  });

  it("a very large amount is shown without losing kopecks", () => {
    addParticipants("Ann", "Ben");
    addExpenseBy("Ann", "1000000000");

    expect(readSummary()).toEqual(["Ben → Ann: 500 000 000,00 ₽"]);
  });

  it('without expenses does not show "How it is calculated"', () => {
    addParticipants("Ann", "Ben");

    expect(readSummarySection().querySelector("details")).toBeNull();
    expect(readSummary()).toEqual([EMPTY_SUMMARY]);
  });
});

describe("transfer cards", () => {
  it("above the cards says how many transfers are needed", () => {
    addParticipants("Ann", "Ben", "Clara");
    addExpenseBy("Ann", "900");

    const count = readSummarySection().querySelector(".transfers-count");

    expect(normalize(count?.textContent)).toBe(
      RU.summary.transfersNeeded(`2 ${RU_TRANSFERS.few}`),
    );
    expect(count?.nextElementSibling?.classList.contains("transfers")).toBe(
      true,
    );
  });

  it("when everyone is settled, there is no line about the number of transfers", () => {
    addParticipant("Ann");
    addExpense("100");

    expect(readSummarySection().querySelector(".transfers-count")).toBeNull();
  });

  it("participants on the cards have the same avatar tones as in the chips", () => {
    addParticipants("Ann", "Ben");
    addExpenseBy("Ben", "100");

    const chipTones = [...root.querySelectorAll(".chip .avatar")].map(
      (avatar) => avatar.className,
    );
    const cardTones = [
      ...readSummarySection().querySelectorAll(".transfer-people .avatar"),
    ].map((avatar) => avatar.className);

    expect(readSummary()).toEqual(["Ann → Ben: 50,00 ₽"]);
    expect(cardTones).toEqual(chipTones);
  });

  it("the hint in the summary is visible without expenses and when everyone is settled", () => {
    const summaryHint = (): string =>
      normalize(
        readSummarySection().querySelector(".empty-state")?.textContent,
      );

    expect(summaryHint()).toBe(EMPTY_SUMMARY);

    addParticipant("Ann");
    addExpense("100");

    expect(summaryHint()).toBe(RU.summary.settledHint);
  });
});

describe("captions of the expense delete buttons", () => {
  it("tell apart expenses of one payer, and a click removes exactly the chosen one", () => {
    addParticipants("Ann", "Ben", "Clara");
    addExpenseBy("Ann", "900");
    addExpense("300");

    expect(readRemoveExpenseLabels()).toEqual([
      RU.expenses.removeLabel("Ann", "900,00 ₽", RU.expenses.forEveryone),
      RU.expenses.removeLabel("Ann", "300,00 ₽", RU.expenses.forEveryone),
    ]);

    findButton(
      RU.expenses.removeLabel("Ann", "300,00 ₽", RU.expenses.forEveryone),
    ).click();

    expect(readExpenses()).toEqual([
      `Ann — 900,00 ₽, ${RU.expenses.forEveryone}`,
    ]);
  });
});

describe("accessibility of the summary", () => {
  /** Records of changes to the announcement area since the call. */
  function observeAnnouncement(): MutationObserver {
    const observer = new MutationObserver(() => undefined);
    observer.observe(findAnnouncement(), {
      childList: true,
      characterData: true,
      subtree: true,
      attributes: true,
    });
    return observer;
  }

  it("there is one live area: hidden, polite and read as a whole", () => {
    const liveAreas = readSummarySection().querySelectorAll("[aria-live]");

    expect(readSummarySection().hasAttribute("aria-live")).toBe(false);
    expect(liveAreas).toHaveLength(1);
    expect(liveAreas[0]?.getAttribute("aria-live")).toBe("polite");
    expect(liveAreas[0]?.getAttribute("aria-atomic")).toBe("true");
    expect(liveAreas[0]?.classList.contains("visually-hidden")).toBe(true);
  });

  it("without expenses says there are no expenses yet", () => {
    expect(readAnnouncement()).toBe(RU.summary.announcementNoExpenses);
  });

  it("announces the number of transfers, not the transfers themselves and the explanations", () => {
    addParticipants("Ann", "Ben", "Clara");
    addExpenseBy("Ann", "900");

    expect(readAnnouncement()).toBe(
      RU.summary.announcement(`2 ${RU_TRANSFERS.few}`),
    );
  });

  it("announces one transfer for mutual debts", () => {
    addParticipants("Ann", "Ben");
    uncheckBeneficiary("Ann");
    addExpenseBy("Ann", "700");
    uncheckBeneficiary("Ben");
    addExpenseBy("Ben", "300");

    expect(readAnnouncement()).toBe(
      RU.summary.announcement(`1 ${RU_TRANSFERS.one}`),
    );
  });

  it("when no transfers are needed, announces that everyone is settled", () => {
    addParticipants("Ann");
    addExpenseBy("Ann", "500");

    expect(readAnnouncement()).toBe(RU.summary.announcementSettled);
  });

  it("after the last expense is removed announces again that there are no expenses", () => {
    addParticipants("Ann");
    addExpenseBy("Ann", "500");

    findButton(
      RU.expenses.removeLabel("Ann", "500,00 ₽", RU.expenses.forEveryone),
    ).click();

    expect(readAnnouncement()).toBe(RU.summary.announcementNoExpenses);
  });

  it("does not rewrite the area when participants are added without expenses", () => {
    addParticipants("Ann");
    const observer = observeAnnouncement();

    addParticipants("Ben", "Clara");

    expect(observer.takeRecords()).toEqual([]);
    observer.disconnect();
  });

  it("does not rewrite the area when the number of transfers did not change", () => {
    addParticipants("Ann", "Ben", "Clara");
    addExpenseBy("Ann", "900");
    const observer = observeAnnouncement();

    addExpenseBy("Ann", "300");

    expect(readSummary()).toHaveLength(2);
    expect(readAnnouncement()).toBe(
      RU.summary.announcement(`2 ${RU_TRANSFERS.few}`),
    );
    expect(observer.takeRecords()).toEqual([]);
    observer.disconnect();
  });

  it("does not nest live areas inside each other", () => {
    addParticipants("Ann", "Ben", "Clara");
    addExpenseBy("Ann", "900");

    expect(root.querySelectorAll("[aria-live] [aria-live]")).toHaveLength(0);
  });
});

describe("input errors", () => {
  it("rejects an empty name", () => {
    addParticipant("   ");

    expect(readFieldError(findInput(RU.participants.nameLabel))).toBe(
      RU.participants.nameEmpty,
    );
    expect(readParticipantNames()).toEqual([]);
  });

  it("rejects a repeated name", () => {
    addParticipant("Ann");
    addParticipant("ann");

    expect(readFieldError(findInput(RU.participants.nameLabel))).toBe(
      RU.participants.nameDuplicate,
    );
    expect(readParticipantNames()).toEqual(["Ann"]);
  });

  it("rejects a name that is too long", () => {
    addParticipant("ω".repeat(MAX_NAME_LENGTH + 1));

    expect(readFieldError(findInput(RU.participants.nameLabel))).toBe(
      RU.participants.nameTooLong("40"),
    );
    expect(readParticipantNames()).toEqual([]);
  });

  it("rejects an expense after which the total will not fit the calculation", () => {
    addParticipant("Ann");
    addExpense("90071992547407,69");
    const expenses = readExpenses();
    const address = location.hash;

    addExpense("90071992547404,61");

    expect(readFieldError(findInput(RU.expenses.amountLabel("₽")))).toBe(
      RU.expenses.totalTooLargeError,
    );
    expect(readExpenses()).toEqual(expenses);
    expect(location.hash).toBe(address);
  });

  it.each(["", "0", "abc", "1,234"])("rejects the amount %j", (amount) => {
    addParticipant("Ann");
    addExpense(amount);

    expect(readFieldError(findInput(RU.expenses.amountLabel("₽")))).toBe(
      RU.expenses.amountError,
    );
    expect(readSummary()).toEqual([EMPTY_SUMMARY]);
  });

  it("rejects an expense without checked recipients", () => {
    addParticipant("Ann");
    uncheckBeneficiary("Ann");
    addExpense("100");

    expect(readBeneficiariesError()).toBe(RU.expenses.noBeneficiariesError);
    expect(readSummary()).toEqual([EMPTY_SUMMARY]);
  });

  it("does not remove a participant who is in the expenses", () => {
    addParticipant("Ann");
    addParticipant("Ben");
    addExpense("100");

    findButton(RU.participants.removeLabel("Ben")).click();

    expect(readParticipantsMessage()).toBe(RU.participants.cannotRemove("Ben"));
    expect(readParticipantNames()).toEqual(["Ann", "Ben"]);
  });

  it("removes a participant without expenses", () => {
    addParticipant("Ann");

    findButton(RU.participants.removeLabel("Ann")).click();

    expect(readParticipantNames()).toEqual([]);
  });

  it("keeps the chosen payer after a participant is added", () => {
    addParticipants("Ann", "Ben");
    selectPayer("Ben");

    addParticipant("Clara");

    expect(findPayerSelect().selectedOptions[0]?.text).toBe("Ben");
  });

  it("after the chosen payer is removed picks the remaining participant", () => {
    addParticipants("Ann", "Ben");
    selectPayer("Ben");

    findButton(RU.participants.removeLabel("Ben")).click();
    addExpense("100");

    expect(findPayerSelect().selectedOptions[0]?.text).toBe("Ann");
    expect(readExpenses()).toEqual([
      `Ann — 100,00 ₽, ${RU.expenses.forEveryone}`,
    ]);
  });

  it("after an amount error and a correction adds the expense and removes the message", () => {
    addParticipant("Ann");
    addExpense("abc");
    expect(readFieldError(findInput(RU.expenses.amountLabel("₽")))).not.toBe(
      "",
    );

    addExpense("250");

    expect(readFieldError(findInput(RU.expenses.amountLabel("₽")))).toBe("");
    expect(readExpenses()).toEqual([
      `Ann — 250,00 ₽, ${RU.expenses.forEveryone}`,
    ]);
  });

  it("when the amount limit is exceeded keeps what was entered in the form", () => {
    addParticipant("Ann");
    addExpense("90071992547407,69");
    uncheckBeneficiary("Ann");

    addExpense("90071992547404,61");

    expect(findInput(RU.expenses.amountLabel("₽")).value).toBe(
      "90071992547404,61",
    );
    expect(
      root.querySelector<HTMLInputElement>("label.checkbox input")?.checked,
    ).toBe(false);
  });
});

describe("selects", () => {
  it.each([
    ["the payer", RU.expenses.payerLabel, findPayerSelect],
    ["the currency", RU.currencyLabel, findCurrencySelect],
  ])(
    "%s select is native, sits in a select box with a hidden chevron and is tied to its label",
    (_, labelText, findSelect) => {
      const select = findSelect();
      const selectBox = select.closest(".select-box");
      const chevron = selectBox?.querySelector("svg");

      expect(select.tagName).toBe("SELECT");
      expect(chevron?.getAttribute("aria-hidden")).toBe("true");
      expect(chevron?.classList.contains("select-chevron")).toBe(true);
      expect(findInput(labelText)).toBe(select);
    },
  );
});

describe("errors at the fields", () => {
  const AMOUNT_LABEL = RU.expenses.amountLabel("₽");

  function expectLinkedError(control: Element): void {
    const errorId = control.getAttribute("aria-describedby") ?? "";
    const error = root.querySelector(`[id="${errorId}"]`);

    expect(errorId).not.toBe("");
    expect(error?.classList.contains("field-error")).toBe(true);
  }

  it("keeps an empty error element with a live area for every field", () => {
    addParticipant("Ann");

    const errors = [...root.querySelectorAll(".field-error")];

    expect(errors).toHaveLength(3);
    for (const error of errors) {
      expect(error.getAttribute("aria-live")).toBe("polite");
      expect(error.textContent).toBe("");
    }
    expect(findInput(AMOUNT_LABEL).hasAttribute("aria-invalid")).toBe(false);
    expect(findInput(AMOUNT_LABEL).hasAttribute("aria-describedby")).toBe(
      false,
    );
  });

  describe("amount", () => {
    it.each(["", "0", "abc", "1,234"])(
      "marks the invalid amount %j, links the error and focuses the field",
      (amount) => {
        addParticipant("Ann");
        addExpense(amount);

        const input = findInput(AMOUNT_LABEL);
        expect(input.getAttribute("aria-invalid")).toBe("true");
        expectLinkedError(input);
        expect(readFieldError(input)).toBe(RU.expenses.amountError);
        expect(document.activeElement).toBe(input);
      },
    );

    it("marks the total that is too large the same way", () => {
      addParticipant("Ann");
      addExpense("90071992547407,69");

      addExpense("90071992547404,61");

      const input = findInput(AMOUNT_LABEL);
      expect(input.getAttribute("aria-invalid")).toBe("true");
      expectLinkedError(input);
      expect(document.activeElement).toBe(input);
    });

    it("lets the error go with one typed character", () => {
      addParticipant("Ann");
      addExpense("abc");
      const input = findInput(AMOUNT_LABEL);

      fireEvent.input(input, { target: { value: "abcd" } });

      expect(input.hasAttribute("aria-invalid")).toBe(false);
      expect(input.hasAttribute("aria-describedby")).toBe(false);
      expect(root.querySelector("#expense-amount-error")?.textContent).toBe("");
    });

    it("lets the error go when the bill changes", () => {
      addParticipant("Ann");
      addExpense("abc");

      addParticipant("Ben");

      expect(findInput(AMOUNT_LABEL).hasAttribute("aria-invalid")).toBe(false);
    });
  });

  describe("for whom", () => {
    it("marks the group, links the error and focuses the first checkbox", () => {
      addParticipants("Ann", "Ben");
      uncheckBeneficiary("Ann");
      uncheckBeneficiary("Ben");
      addExpense("100");

      const fieldset = findBeneficiariesFieldset();
      expectLinkedError(fieldset);
      expect(readBeneficiariesError()).toBe(RU.expenses.noBeneficiariesError);
      expect(document.activeElement).toBe(findFirstBeneficiaryCheckbox());
      expect(findInput(AMOUNT_LABEL).hasAttribute("aria-invalid")).toBe(false);
    });

    it("lets the error go when a box is checked", () => {
      addParticipant("Ann");
      uncheckBeneficiary("Ann");
      addExpense("100");

      fireEvent.click(findFirstBeneficiaryCheckbox());

      expect(findBeneficiariesFieldset().hasAttribute("aria-describedby")).toBe(
        false,
      );
      expect(readBeneficiariesError()).toBe("");
    });
  });

  describe("name", () => {
    it.each([
      ["empty", "   ", RU.participants.nameEmpty],
      ["repeated", "Ann", RU.participants.nameDuplicate],
      [
        "too long",
        "ω".repeat(MAX_NAME_LENGTH + 1),
        RU.participants.nameTooLong("40"),
      ],
    ])(
      "marks the %s name, links the error and focuses the field",
      (_, name, text) => {
        addParticipant("Ann");
        addParticipant(name);

        const input = findInput(RU.participants.nameLabel);
        expect(input.getAttribute("aria-invalid")).toBe("true");
        expectLinkedError(input);
        expect(readFieldError(input)).toBe(text);
        expect(document.activeElement).toBe(input);
      },
    );

    it("lets the error go with one typed character", () => {
      addParticipant("   ");
      const input = findInput(RU.participants.nameLabel);

      fireEvent.input(input, { target: { value: "A" } });

      expect(input.hasAttribute("aria-invalid")).toBe(false);
      expect(input.hasAttribute("aria-describedby")).toBe(false);
    });

    it('keeps "can\'t remove" in the message area of the section', () => {
      addParticipant("Ann");
      addExpense("100");

      findButton(RU.participants.removeLabel("Ann")).click();

      expect(readParticipantsMessage()).toContain(
        RU.participants.cannotRemove("Ann"),
      );
      expect(
        findInput(RU.participants.nameLabel).hasAttribute("aria-invalid"),
      ).toBe(false);
    });
  });
});

describe("amount placeholder", () => {
  it("shows the format with a comma on the Russian page", () => {
    const placeholder = findInput(RU.expenses.amountLabel("₽")).placeholder;

    expect(placeholder).toBe(RU.expenses.amountPlaceholder);
    expect(placeholder).toContain("349,90");
  });

  it("shows the format with a point on the English page", () => {
    remountApp("en");

    expect(findInput("Amount, $").placeholder).toBe("1500 or 349.90");
  });
});

describe("focus after adding an expense", () => {
  it("lands on the amount field and keeps the payer", () => {
    addParticipants("Ann", "Ben");
    selectPayer("Ben");

    addExpense("100");

    expect(document.activeElement).toBe(
      findInput(RU.expenses.amountLabel("₽")),
    );
    expect(findPayerSelect().selectedOptions[0]?.text).toBe("Ben");
  });
});

describe("undo of a removal", () => {
  const EXPENSE = `Ann — 900,00 ₽, ${RU.expenses.forEveryone}`;
  const EXPENSE_REMOVE_LABEL = RU.expenses.removeLabel(
    "Ann",
    "900,00 ₽",
    RU.expenses.forEveryone,
  );

  function addAnnAndBobWithExpense(): void {
    addParticipants("Ann", "Ben");
    addExpenseBy("Ann", "900");
  }

  it("is not offered before anything is removed", () => {
    addAnnAndBobWithExpense();

    expect(isUndoBarShown(RU.expenses.heading)).toBe(false);
    expect(isUndoBarShown(RU.participants.heading)).toBe(false);
  });

  describe("of an expense", () => {
    it("says what was removed and moves the focus to the button", () => {
      addAnnAndBobWithExpense();

      findButton(EXPENSE_REMOVE_LABEL).click();

      const button = findUndoButton(RU.expenses.heading, RU.undo.button);
      expect(isUndoBarShown(RU.expenses.heading)).toBe(true);
      expect(readUndoText(RU.expenses.heading)).toBe(
        RU.expenses.removed("Ann", "900,00 ₽", RU.expenses.forEveryone),
      );
      expect(document.activeElement).toBe(button);
      expect(button.getAttribute("aria-describedby")).toBe(
        findSection(RU.expenses.heading).querySelector(".undo p")?.id,
      );
      expect(readExpenses()).toEqual([]);
    });

    it("brings back the expense, the summary and the address and focuses the amount", () => {
      addAnnAndBobWithExpense();
      const summary = readSummary();
      const address = location.hash;
      findButton(EXPENSE_REMOVE_LABEL).click();

      findUndoButton(RU.expenses.heading, RU.undo.button).click();

      expect(readExpenses()).toEqual([EXPENSE]);
      expect(readSummary()).toEqual(summary);
      expect(location.hash).toBe(address);
      expect(document.activeElement).toBe(
        findInput(RU.expenses.amountLabel("₽")),
      );
      expect(isUndoBarShown(RU.expenses.heading)).toBe(false);
    });

    it("goes away at the next change of the bill", () => {
      addAnnAndBobWithExpense();
      findButton(EXPENSE_REMOVE_LABEL).click();

      addParticipant("Clara");

      expect(isUndoBarShown(RU.expenses.heading)).toBe(false);
    });

    it("goes away when the address changes", () => {
      addAnnAndBobWithExpense();
      findButton(EXPENSE_REMOVE_LABEL).click();
      const code = encodeBill(
        { participants: [{ id: "ann", name: "Ann" }], expenses: [] },
        "RUB",
      );

      changeAddressOnPage(`/#${code}`);

      expect(isUndoBarShown(RU.expenses.heading)).toBe(false);
    });

    it("stays when the currency changes and restores the bill in the chosen currency", () => {
      addAnnAndBobWithExpense();
      findButton(EXPENSE_REMOVE_LABEL).click();

      chooseCurrency("USD");

      expect(isUndoBarShown(RU.expenses.heading)).toBe(true);

      findUndoButton(RU.expenses.heading, RU.undo.button).click();

      expect(readExpenses()).toEqual([
        `Ann — 900,00 $, ${RU.expenses.forEveryone}`,
      ]);
    });
  });

  describe("of a participant", () => {
    it("says who was removed and moves the focus to the button", () => {
      addParticipants("Ann", "Ben");

      findButton(RU.participants.removeLabel("Ben")).click();

      expect(readUndoText(RU.participants.heading)).toBe(
        RU.participants.removed("Ben"),
      );
      expect(document.activeElement).toBe(
        findUndoButton(RU.participants.heading, RU.undo.button),
      );
      expect(readParticipantNames()).toEqual(["Ann"]);
    });

    it("brings back the participant and the address and focuses the name", () => {
      addParticipants("Ann", "Ben");
      const address = location.hash;
      findButton(RU.participants.removeLabel("Ben")).click();

      findUndoButton(RU.participants.heading, RU.undo.button).click();

      expect(readParticipantNames()).toEqual(["Ann", "Ben"]);
      expect(location.hash).toBe(address);
      expect(document.activeElement).toBe(findInput(RU.participants.nameLabel));
      expect(isUndoBarShown(RU.participants.heading)).toBe(false);
    });

    it("goes away at the next change of the bill", () => {
      addParticipants("Ann", "Ben");
      findButton(RU.participants.removeLabel("Ben")).click();

      addParticipant("Clara");

      expect(isUndoBarShown(RU.participants.heading)).toBe(false);
    });

    it("is not offered when the removal is refused", () => {
      addParticipant("Ann");
      addExpense("100");

      findButton(RU.participants.removeLabel("Ann")).click();

      expect(isUndoBarShown(RU.participants.heading)).toBe(false);
    });
  });
});

describe("escaping", () => {
  it("shows markup in a name as plain text", () => {
    addParticipant("<b>Li</b>");

    expect(readParticipantNames()).toEqual(["<b>Li</b>"]);
    expect(root.querySelector("b")).toBeNull();
  });
});

describe("bill link", () => {
  const ann = { id: "ann", name: "Ann" };
  const ben = { id: "ben", name: "Ben" };
  const billWithDinner: Bill = {
    participants: [ann, ben],
    expenses: [
      {
        id: "dinner",
        payerId: ann.id,
        amount: 90_000,
        beneficiaryIds: [ann.id, ben.id],
      },
    ],
  };
  const MALFORMED_NOTICE = RU.linkNotice.malformed;
  const UNSUPPORTED_NOTICE = RU.linkNotice.unsupportedVersion;

  function openAddress(url: string): void {
    history.replaceState(null, "", url);
    remountApp();
  }

  function openCode(code: string): void {
    openAddress(`/#${code}`);
  }

  function readNotice(): HTMLElement | null {
    return root.querySelector<HTMLElement>(".notice");
  }

  function readNoticeText(): string {
    return normalize(readNotice()?.querySelector("p")?.textContent ?? "");
  }

  function readShareSection(): HTMLElement {
    return findSection(RU.share.heading);
  }

  function readShareMessage(): string {
    const message = readShareSection().querySelector(".message");
    return normalize(message?.textContent ?? "");
  }

  function readLinkField(): HTMLInputElement {
    return findInput(RU.share.linkLabel);
  }

  function isLinkFieldHidden(): boolean {
    return readLinkField().closest<HTMLElement>(".field")?.hidden === true;
  }

  /** A clipboard whose answer the test delivers itself, when it suits. */
  function createDeferredWrite(): {
    readonly writeText: (text: string) => Promise<void>;
    readonly settled: Promise<void>;
    readonly resolve: () => void;
    readonly reject: () => void;
  } {
    let resolve = (): void => undefined;
    let reject = (): void => undefined;
    const pending = new Promise<void>((resolvePending, rejectPending) => {
      resolve = resolvePending;
      reject = () => {
        rejectPending(new Error("Access denied"));
      };
    });
    const settled = pending.then(
      () => undefined,
      () => undefined,
    );

    return { writeText: () => pending, settled, resolve, reject };
  }

  describe("address", () => {
    it("does not touch the address while nothing has changed", () => {
      expect(location.hash).toBe("");
    });

    it("after a participant is added contains the code of the current bill", () => {
      addParticipant("Ann");
      addParticipant("Ben");

      const expectedBill: Bill = { participants: [ann, ben], expenses: [] };
      expect(location.hash).toBe(`#${encodeBill(expectedBill, "RUB")}`);
    });

    it("after an expense is added contains the code of the bill with the expense", () => {
      addParticipant("Ann");
      addParticipant("Ben");
      selectPayer("Ann");
      addExpense("900");

      expect(location.hash).toBe(`#${encodeBill(billWithDinner, "RUB")}`);
    });

    it("after the last participant is removed writes the code of an empty bill", () => {
      addParticipant("Ann");
      findButton(RU.participants.removeLabel("Ann")).click();

      expect(location.hash).toBe(
        `#${encodeBill({ participants: [], expenses: [] }, "RUB")}`,
      );
    });

    it("adds no entries to the history", () => {
      const lengthBefore = history.length;

      addParticipant("Ann");
      addParticipant("Ben");
      addExpense("100");

      expect(history.length).toBe(lengthBefore);
    });

    it("keeps the path and the query", () => {
      openAddress("/split-bill/?from=chat");

      addParticipant("Ann");

      expect(location.pathname).toBe("/split-bill/");
      expect(location.search).toBe("?from=chat");
      expect(location.hash).not.toBe("");
    });
  });

  describe("opening by a link", () => {
    it("a new app at the same address shows the same bill", () => {
      addParticipant("Ann");
      addParticipant("Ben");
      selectPayer("Ann");
      uncheckBeneficiary("Ben");
      addExpense("700");
      selectPayer("Ben");
      uncheckBeneficiary("Ann");
      uncheckBeneficiary("Ben");
      const participants = readParticipantNames();
      const expenses = readExpenses();
      const summary = readSummary();
      const breakdown = readBreakdown();
      const code = location.hash.slice(1);

      openCode(code);

      expect(readParticipantNames()).toEqual(participants);
      expect(readExpenses()).toEqual(expenses);
      expect(readSummary()).toEqual(summary);
      expect(readBreakdown()).toEqual(breakdown);
      expect(readNotice()?.hidden).toBe(true);
    });

    it("after opening, new participants do not clash with the parsed ones", () => {
      openCode(encodeBill(billWithDinner, "RUB"));

      addParticipant("Clara");
      selectPayer("Clara");
      addExpense("300");

      expect(readParticipantNames()).toEqual(["Ann", "Ben", "Clara"]);
      expect(readBreakdown()).toHaveLength(3);
    });

    it("opening a bill does not write the address itself", () => {
      const code = encodeBill(billWithDinner, "RUB");
      const pageUrl = `/split-bill/?x=1#${code}`;

      openAddress(pageUrl);

      expect(location.pathname + location.search + location.hash).toBe(pageUrl);
    });

    it.each([
      ["#垃圾", "垃圾", MALFORMED_NOTICE],
      ["#1.!!!", "1.!!!", MALFORMED_NOTICE],
      ["bill with repeated names", invalidBillCode(), MALFORMED_NOTICE],
      [
        "another version",
        `3.${encodeBase64Url("[[],[]]")}`,
        UNSUPPORTED_NOTICE,
      ],
    ])(
      'for the link "%s" shows the message and an empty bill',
      (_title, code, text) => {
        openCode(code);

        expect(readNotice()?.hidden).toBe(false);
        expect(readNotice()?.getAttribute("role")).toBe("alert");
        expect(readNoticeText()).toBe(text);
        expect(readParticipantNames()).toEqual([]);
        expect(readSummary()).toEqual([EMPTY_SUMMARY]);
      },
    );

    it("a forged link with a huge total does not crash the page", () => {
      const forgedCode =
        "1.W1siYSIsImIiLCJjIl0sW1sxLDkwMDcxOTkyNTQ3NDA3NjksWzJdXSxbMCw5MDA3MTk5MjU0NzQwNDYxLFsxXV0sWzIsOTAwNzE5OTI1NDc0MDIxMCxbMV1dXV0";

      openCode(forgedCode);

      expect(readNoticeText()).toBe(MALFORMED_NOTICE);
      expect(readParticipantNames()).toEqual([]);
      expect(readSummary()).toEqual([EMPTY_SUMMARY]);

      changeAddressOnPage(`/#${encodeBill(billWithDinner, "RUB")}`);

      expect(readParticipantNames()).toEqual(["Ann", "Ben"]);
    });

    it("does not change the address while the bill has not changed", () => {
      openCode("1.!!!");

      expect(location.hash).toBe("#1.!!!");
    });

    it("after the first change replaces the address with a valid code, the forms work", () => {
      openCode("1.!!!");

      addParticipant("Ann");

      const expectedBill: Bill = { participants: [ann], expenses: [] };
      expect(readParticipantNames()).toEqual(["Ann"]);
      expect(location.hash).toBe(`#${encodeBill(expectedBill, "RUB")}`);
    });

    it('"Close" hides the message and changes nothing else', () => {
      openCode("1.!!!");

      findButton(RU.linkNotice.closeLabel).click();

      expect(readNotice()?.hidden).toBe(true);
      expect(location.hash).toBe("#1.!!!");
    });

    it("divides the sections into the left and right columns", () => {
      const columns = [...(root.querySelector(".layout")?.children ?? [])];
      const readTitles = (column: Element | undefined): string[] =>
        [...(column?.querySelectorAll("h2") ?? [])].map(
          (title) => title.textContent,
        );

      expect(columns.map((column) => column.className)).toEqual([
        "layout-main",
        "layout-side",
      ]);
      expect(readTitles(columns[0])).toEqual([
        RU.participants.heading,
        RU.expenses.heading,
      ]);
      expect(readTitles(columns[1])).toEqual([
        RU.summary.heading,
        RU.share.heading,
      ]);
    });

    it("the message stands between the header and the sections", () => {
      const children = [...root.children].map((child) => child.tagName);

      expect(children).toEqual(["HEADER", "DIV", "DIV"]);
      expect(root.children[1]).toBe(readNotice());
      expect(readNotice()?.hidden).toBe(true);
    });
  });

  describe("address change on an open page", () => {
    it("shows the bill from a new valid code", () => {
      changeAddressOnPage(`/#${encodeBill(billWithDinner, "RUB")}`);

      expect(readParticipantNames()).toEqual(["Ann", "Ben"]);
      expect(readSummary()).toEqual(["Ben → Ann: 450,00 ₽"]);
    });

    it("updates the screen reader overview for the new bill", () => {
      const lunch: Bill = {
        participants: [ann, ben],
        expenses: [
          {
            id: "a",
            payerId: ann.id,
            amount: 70_000,
            beneficiaryIds: [ben.id],
          },
          {
            id: "b",
            payerId: ben.id,
            amount: 30_000,
            beneficiaryIds: [ann.id],
          },
        ],
      };
      openCode(encodeBill(billWithDinner, "RUB"));
      expect(readAnnouncement()).toBe(
        RU.summary.announcement(`1 ${RU_TRANSFERS.one}`),
      );

      changeAddressOnPage(
        `/#${encodeBill({ participants: [ann], expenses: [] }, "RUB")}`,
      );
      expect(readAnnouncement()).toBe(RU.summary.announcementNoExpenses);

      changeAddressOnPage(`/#${encodeBill(lunch, "RUB")}`);
      expect(readAnnouncement()).toBe(
        RU.summary.announcement(`1 ${RU_TRANSFERS.one}`),
      );
    });

    it("with a broken code the screen reader overview says there are no expenses", () => {
      openCode(encodeBill(billWithDinner, "RUB"));
      expect(readAnnouncement()).toBe(
        RU.summary.announcement(`1 ${RU_TRANSFERS.one}`),
      );

      changeAddressOnPage("/#1.!!!");

      expect(readAnnouncement()).toBe(RU.summary.announcementNoExpenses);
    });

    it("with a broken code shows the message and an empty bill", () => {
      addParticipant("Ann");

      changeAddressOnPage("/#1.!!!");

      expect(readNoticeText()).toBe(MALFORMED_NOTICE);
      expect(readParticipantNames()).toEqual([]);
    });

    it("with a valid code hides the previous message", () => {
      openCode("1.!!!");

      changeAddressOnPage(`/#${encodeBill(billWithDinner, "RUB")}`);

      expect(readNotice()?.hidden).toBe(true);
    });

    it("with an empty fragment shows an empty bill", () => {
      openCode(encodeBill(billWithDinner, "RUB"));

      changeAddressOnPage("/");

      expect(readParticipantNames()).toEqual([]);
    });

    it("does not write the address, so it causes no loop", () => {
      const code = encodeBill(billWithDinner, "RUB");

      changeAddressOnPage(`/#${code}`);

      expect(location.hash).toBe(`#${code}`);
    });

    it("after the app is removed stops reacting to the address", () => {
      unmountApp();

      changeAddressOnPage(`/#${encodeBill(billWithDinner, "RUB")}`);

      expect(readParticipantNames()).toEqual([]);
    });
  });

  describe('"Share" button', () => {
    it("copies the link of the current bill and says so", async () => {
      const writeText = vi.fn<(text: string) => Promise<void>>();
      writeText.mockResolvedValue(undefined);
      installClipboard(writeText);
      openAddress("/split-bill/");
      addParticipant("Ann");
      addParticipant("Ben");
      const code = encodeBill(
        { participants: [ann, ben], expenses: [] },
        "RUB",
      );

      findButton(RU.share.button).click();

      await vi.waitFor(() => {
        expect(readShareMessage()).toBe(SHARE_COPIED_RU);
      });
      expect(writeText).toHaveBeenCalledExactlyOnceWith(
        `${location.origin}/split-bill/#${code}`,
      );
      expect(isLinkFieldHidden()).toBe(true);
    });

    it("the success message is not styled as an error", async () => {
      const writeText = vi.fn<(text: string) => Promise<void>>();
      writeText.mockResolvedValue(undefined);
      installClipboard(writeText);
      addParticipant("Ann");

      findButton(RU.share.button).click();

      await vi.waitFor(() => {
        expect(readShareMessage()).toBe(SHARE_COPIED_RU);
      });
      const message = readShareSection().querySelector(".message");
      expect(message?.classList.contains("message-success")).toBe(true);

      addParticipant("Ben");

      expect(message?.classList.contains("message-success")).toBe(false);
    });

    it("the clipboard answer after the bill changed does not show the success message", async () => {
      const clipboard = createDeferredWrite();
      installClipboard(clipboard.writeText);
      addParticipant("Ann");
      findButton(RU.share.button).click();

      addParticipant("Ben");
      clipboard.resolve();
      await clipboard.settled;

      expect(readShareMessage()).toBe("");
      expect(isLinkFieldHidden()).toBe(true);
    });

    it("the clipboard refusal after the bill changed does not show the field with the old link", async () => {
      const clipboard = createDeferredWrite();
      installClipboard(clipboard.writeText);
      addParticipant("Ann");
      findButton(RU.share.button).click();

      addParticipant("Ben");
      clipboard.reject();
      await clipboard.settled;

      expect(readShareMessage()).toBe("");
      expect(isLinkFieldHidden()).toBe(true);
    });

    it("without a clipboard shows the field with the link", () => {
      addParticipant("Ann");

      findButton(RU.share.button).click();

      expect(readShareMessage()).toBe(SHARE_COPY_MANUALLY_RU);
      expect(isLinkFieldHidden()).toBe(false);
      expect(readLinkField().readOnly).toBe(true);
      expect(readLinkField().value).toBe(location.href);
    });

    it("when the clipboard refuses shows the field with the link", async () => {
      const writeText = vi.fn<(text: string) => Promise<void>>();
      writeText.mockRejectedValue(new Error("Access denied"));
      installClipboard(writeText);
      addParticipant("Ann");

      findButton(RU.share.button).click();

      await vi.waitFor(() => {
        expect(readShareMessage()).toBe(SHARE_COPY_MANUALLY_RU);
      });
      expect(isLinkFieldHidden()).toBe(false);
      expect(readLinkField().value).toBe(location.href);
    });

    it("a clipboard refusal after success without a bill change does not leave the message green", async () => {
      const writeText = vi.fn<(text: string) => Promise<void>>();
      writeText.mockResolvedValueOnce(undefined);
      writeText.mockRejectedValueOnce(new Error("Access denied"));
      installClipboard(writeText);
      addParticipant("Ann");
      findButton(RU.share.button).click();
      await vi.waitFor(() => {
        expect(readShareMessage()).toBe(SHARE_COPIED_RU);
      });

      findButton(RU.share.button).click();

      await vi.waitFor(() => {
        expect(readShareMessage()).toBe(SHARE_COPY_MANUALLY_RU);
      });
      const message = readShareSection().querySelector(".message");
      expect(message?.classList.contains("message-success")).toBe(false);
    });

    it("the link of an empty bill opens as an empty bill", () => {
      findButton(RU.share.button).click();

      const link = new URL(readLinkField().value);
      const result = decodeBill(link.hash.slice(1));
      expect(result).toEqual({
        kind: "decoded",
        bill: { participants: [], expenses: [] },
        currency: "RUB",
      });
    });

    it("puts a check mark before the success text and none while idle", async () => {
      const writeText = vi.fn<(text: string) => Promise<void>>();
      writeText.mockResolvedValue(undefined);
      installClipboard(writeText);
      addParticipant("Ann");
      const message = readShareSection().querySelector(".message");
      expect(message?.querySelector("svg")).toBeNull();
      expect(message?.textContent).toBe("");

      findButton(RU.share.button).click();

      await vi.waitFor(() => {
        expect(readShareMessage()).toBe(SHARE_COPIED_RU);
      });
      expect(message?.querySelector("svg")?.getAttribute("aria-hidden")).toBe(
        "true",
      );
    });

    it("shows no check mark with the fallback text", () => {
      addParticipant("Ann");

      findButton(RU.share.button).click();

      expect(readShareSection().querySelector(".message svg")).toBeNull();
    });

    it("on the next render resets the message and hides the field", () => {
      findButton(RU.share.button).click();

      addParticipant("Ann");

      expect(readShareMessage()).toBe("");
      expect(isLinkFieldHidden()).toBe(true);
    });
  });
});

describe("share links from the previous version", () => {
  it("opens a bill by a literal code at the published address", () => {
    history.replaceState(null, "", `/split-bill/#${LITERAL_CODE}`);

    remountApp();

    expect(readParticipantNames()).toEqual(["Ann", "Ben", "Clara", "Dan"]);
    expect(readExpenses()).toEqual([
      `Ann — 4 800,00 ₽, ${RU.expenses.forEveryone}`,
      `Ben — 1 250,50 ₽, ${RU.expenses.forBeneficiaries(["Ann", "Ben", "Clara"])}`,
      `Clara — 600,00 ₽, ${RU.expenses.forBeneficiaries(["Clara", "Dan"])}`,
    ]);
    expect(readSummary()).toEqual([
      "Ben → Ann: 366,33 ₽",
      "Clara → Ann: 1 316,83 ₽",
      "Dan → Ann: 1 500,00 ₽",
    ]);
    expect(readTexts(".page-header .overview-item")).toEqual([
      `4 ${RU_PARTICIPANTS.few}`,
      `3 ${RU_EXPENSES.few}`,
      RU.header.spent("6 650,50 ₽"),
    ]);
    expect(root.querySelector<HTMLElement>(".notice")?.hidden).toBe(true);
  });

  it("opens the same code on the English page with amounts in dollars", () => {
    history.replaceState(null, "", `/split-bill/#${LITERAL_CODE}`);

    remountApp("en");

    expect(readExpenses(ENGLISH_SECTIONS.expenses)).toEqual([
      "Ann — $4,800.00, for everyone",
      "Ben — $1,250.50, for: Ann, Ben, Clara",
      "Clara — $600.00, for: Clara, Dan",
    ]);
    expect(readSummary(ENGLISH_SECTIONS.summary)).toEqual([
      "Ben → Ann: $366.33",
      "Clara → Ann: $1,316.83",
      "Dan → Ann: $1,500.00",
    ]);
    expect(readTexts(".page-header .overview-item")).toEqual([
      "4 participants",
      "3 expenses",
      "spent $6,650.50",
    ]);
  });
});

function addEnglishParticipant(name: string): void {
  fireEvent.input(findInput("Name"), { target: { value: name } });
  findButton("Add").click();
}

function addEnglishExpense(payer: string, amount: string): void {
  selectPayer(payer);
  fireEvent.input(findInput("Amount, $"), { target: { value: amount } });
  findButton("Add expense").click();
}

describe("English page", () => {
  const SECTIONS = ENGLISH_SECTIONS;

  function readEnglishOverview(): string[] {
    return readTexts(".page-header .overview-item");
  }

  beforeEach(() => {
    remountApp("en");
  });

  it("shows the title and the subtitle in English", () => {
    expect(root.querySelector(".page-header h1")?.textContent).toBe(
      "Split the bill",
    );
    expect(root.querySelector(".page-subtitle")?.textContent).toBe(
      "Who owes whom, without spreadsheets or arguments",
    );
  });

  it("shows zeros in dollars for an empty bill", () => {
    expect(readEnglishOverview().join(" · ")).toBe(
      "0 participants · 0 expenses · spent $0.00",
    );
  });

  it("titles the sections and the buttons in English", () => {
    const headings = readTexts("h2");

    expect(headings).toEqual([
      SECTIONS.participants,
      SECTIONS.expenses,
      SECTIONS.summary,
      SECTIONS.share,
    ]);
    expect(findButton("Add")).toBeDefined();
    expect(findButton("Share")).toBeDefined();
    expect(findInput("Bill link").readOnly).toBe(true);
  });

  it("shows friendly hints in English", () => {
    expect(readSummary(SECTIONS.summary)).toEqual([
      "Add expenses — here you will see who owes whom",
    ]);
    expect(
      findSection(SECTIONS.participants).querySelector(".empty-state")
        ?.textContent,
    ).toBe("Add everyone who is in — a name is enough. Yourself too");
  });

  it("splits a bill in dollars", () => {
    addEnglishParticipant("Ann");
    addEnglishParticipant("Bob");
    addEnglishParticipant("Cat");
    addEnglishExpense("Ann", "900");

    expect(readExpenses(SECTIONS.expenses)).toEqual([
      "Ann — $900.00, for everyone",
    ]);
    expect(readSummary(SECTIONS.summary)).toEqual([
      "Bob → Ann: $300.00",
      "Cat → Ann: $300.00",
    ]);
    expect(readBreakdown(SECTIONS.summary)).toEqual([
      "Ann | $900.00 | $300.00 | receives +$600.00",
      "Bob | $0.00 | $300.00 | gives \u2212$300.00",
      "Cat | $0.00 | $300.00 | gives \u2212$300.00",
    ]);
    expect(readEnglishOverview()).toEqual([
      "3 participants",
      "1 expense",
      "spent $900.00",
    ]);
    expect(readAnnouncement(ENGLISH_SECTIONS.summary)).toBe(
      "Summary: 2 transfers",
    );
  });

  it("lists the recipients of an expense and names the buttons in English", () => {
    addEnglishParticipant("Ann");
    addEnglishParticipant("Bob");
    uncheckBeneficiary("Bob");
    addEnglishExpense("Ann", "100");

    expect(readExpenses(SECTIONS.expenses)).toEqual([
      "Ann — $100.00, for: Ann",
    ]);
    expect(findButton("Remove expense: Ann — $100.00, for: Ann")).toBeDefined();
    expect(findButton("Remove participant Bob")).toBeDefined();
  });

  it("reports input problems in English", () => {
    addEnglishParticipant("Ann");
    addEnglishParticipant("Ann");
    const duplicateMessage = readFieldError(findInput("Name"));
    addEnglishExpense("Ann", "abc");
    const amountMessage = readFieldError(findInput("Amount, $"));

    expect(duplicateMessage).toBe(
      "A participant with this name already exists",
    );
    expect(amountMessage).toBe(
      "Enter an amount above zero, for example 1500 or 349.90",
    );
  });

  it("writes the code of the bill with dollars into the address", () => {
    addEnglishParticipant("Ann");

    const result = decodeBill(location.hash.slice(1));

    expect(result).toMatchObject({ kind: "decoded", currency: "USD" });
  });

  it("opens a link in dollars", () => {
    history.replaceState(null, "", `/#${LITERAL_CODE_USD}`);

    remountApp("en");

    expect(readExpenses(SECTIONS.expenses)).toEqual([
      "Ann — $123.45, for everyone",
      "Bob — $5.00, for: Bob",
    ]);
    expect(readSummary(SECTIONS.summary)).toEqual(["Bob → Ann: $61.72"]);
  });

  it("opens a link in rubles with the ruble sign and the label of the field", () => {
    history.replaceState(null, "", `/#${LITERAL_CODE_RUB}`);

    remountApp("en");

    expect(readExpenses(SECTIONS.expenses)).toEqual([
      "Ann — ₽123.45, for everyone",
      "Bob — ₽5.00, for: Bob",
    ]);
    expect(findInput("Amount, ₽")).toBeDefined();
  });

  describe("undo of an expense", () => {
    const EXPENSE_LABEL = "Remove expense: Ann — $900.00, for everyone";

    beforeEach(() => {
      addEnglishParticipant("Ann");
      addEnglishParticipant("Bob");
      addEnglishExpense("Ann", "900");
      findButton(EXPENSE_LABEL).click();
    });

    it("tells what was removed", () => {
      expect(readUndoText(SECTIONS.expenses)).toBe(
        "Expense removed: Ann — $900.00, for everyone",
      );
    });

    it("moves the focus to Undo", () => {
      expect(document.activeElement).toBe(
        findUndoButton(SECTIONS.expenses, "Undo"),
      );
    });

    it("brings the expense back", () => {
      findUndoButton(SECTIONS.expenses, "Undo").click();

      expect(readExpenses(SECTIONS.expenses)).toEqual([
        "Ann — $900.00, for everyone",
      ]);
    });

    it("goes away at the next change of the bill", () => {
      findButton("Remove participant Bob").click();

      expect(isUndoBarShown(SECTIONS.expenses)).toBe(false);
    });
  });

  it("tells which participant was removed in English", () => {
    addEnglishParticipant("Ann");

    findButton("Remove participant Ann").click();

    expect(readUndoText(SECTIONS.participants)).toBe(
      "Participant removed: Ann",
    );
  });

  it("says what to do after sharing, whether the link was copied or not", async () => {
    addEnglishParticipant("Ann");
    findButton("Share").click();
    const message = findSection(SECTIONS.share).querySelector(".message");
    expect(normalize(message?.textContent)).toBe(SHARE_COPY_MANUALLY_EN);

    const writeText = vi.fn<(text: string) => Promise<void>>();
    writeText.mockResolvedValue(undefined);
    installClipboard(writeText);
    findButton("Share").click();

    await vi.waitFor(() => {
      expect(normalize(message?.textContent)).toBe(SHARE_COPIED_EN);
    });
  });

  it("explains a broken link in English and falls back to dollars", () => {
    history.replaceState(null, "", "/#2.%%%");

    remountApp("en");

    expect(normalize(root.querySelector(".notice p")?.textContent)).toBe(
      "Couldn't open the bill from this link: it is damaged or was copied incompletely. Ask to send it again, or start a new bill in the meantime.",
    );
    expect(readEnglishOverview()[2]).toBe("spent $0.00");
  });
});

describe("currency of an opened bill on the Russian page", () => {
  function openUsdLink(): void {
    history.replaceState(null, "", `/#${LITERAL_CODE_USD}`);
    remountApp("ru");
  }

  it("shows the amounts of the link in dollars, not in rubles", () => {
    openUsdLink();

    expect(readExpenses()).toEqual([
      `Ann — 123,45 $, ${RU.expenses.forEveryone}`,
      `Bob — 5,00 $, ${RU.expenses.forBeneficiaries(["Bob"])}`,
    ]);
    expect(findInput(RU.expenses.amountLabel("$"))).toBeDefined();
  });

  it("keeps the currency of the link in the address after the bill is edited", () => {
    openUsdLink();

    addParticipant("Clara");

    const result = decodeBill(location.hash.slice(1));
    expect(result).toMatchObject({ kind: "decoded", currency: "USD" });
  });

  it.each([
    ["a broken fragment", "/#2.%%%"],
    ["an empty fragment", "/"],
  ])("returns to rubles when the address changes to %s", (_, address) => {
    openUsdLink();

    changeAddressOnPage(address);

    expect(readTexts(".page-header .overview-item")).toEqual([
      `0 ${RU_PARTICIPANTS.many}`,
      `0 ${RU_EXPENSES.many}`,
      RU.header.spent("0,00 ₽"),
    ]);
    expect(findInput(RU.expenses.amountLabel("₽"))).toBeDefined();
  });

  it("writes the currency of the link into the Share link", () => {
    openUsdLink();

    findButton(RU.share.button).click();

    const shareLink = new URL(findInput(RU.share.linkLabel).value);
    const result = decodeBill(shareLink.hash.slice(1));
    expect(result).toMatchObject({ kind: "decoded", currency: "USD" });
  });

  it("opens a link in rubles on the Russian page as before", () => {
    history.replaceState(null, "", `/#${LITERAL_CODE_RUB}`);

    remountApp("ru");

    expect(readExpenses()).toEqual([
      `Ann — 123,45 ₽, ${RU.expenses.forEveryone}`,
      `Bob — 5,00 ₽, ${RU.expenses.forBeneficiaries(["Bob"])}`,
    ]);
  });
});

describe("currency", () => {
  function readAddressCurrency(): unknown {
    const result = decodeBill(location.hash.slice(1));

    return result.kind === "decoded" ? result.currency : result.error;
  }

  function readOptionTexts(select: HTMLSelectElement): string[] {
    return [...select.options].map((option) => option.text);
  }

  function readEnglishOverview(): string[] {
    return readTexts(".page-header .overview-item");
  }

  function openLinkField(): HTMLInputElement {
    findButton("Share").click();

    return findInput("Bill link");
  }

  describe("select", () => {
    it("is a native select named Currency and sits in the toolbar", () => {
      remountApp("en");

      const select = findCurrencySelect();
      const label = root.querySelector(`label[for="${select.id}"]`);

      expect(select).toBe(findInput("Currency"));
      expect(label?.classList.contains("visually-hidden")).toBe(true);
      expect(readOptionTexts(select)).toEqual(["US dollar", "Russian ruble"]);
    });

    it("has the Russian label on the Russian page", () => {
      const select = findCurrencySelect();

      expect(select).toBe(findInput(RU.currencyLabel));
      expect(readOptionTexts(select)).toEqual([
        RU.currencyNames.USD,
        RU.currencyNames.RUB,
      ]);
    });
  });

  describe("default", () => {
    it("is the dollar on the English page", () => {
      remountApp("en");

      expect(findCurrencySelect().value).toBe("USD");
      expect(findInput("Amount, $")).toBeDefined();
    });

    it("is the ruble on the Russian page", () => {
      expect(findCurrencySelect().value).toBe("RUB");
      expect(findInput(RU.expenses.amountLabel("₽"))).toBeDefined();
    });

    it("follows the currency of an opened link", () => {
      history.replaceState(null, "", `/#${LITERAL_CODE_RUB}`);

      remountApp("en");

      expect(findCurrencySelect().value).toBe("RUB");
    });

    it("follows the address when it changes on an open page", () => {
      remountApp("en");

      changeAddressOnPage(`/#${LITERAL_CODE_RUB}`);

      expect(findCurrencySelect().value).toBe("RUB");
    });
  });

  describe("choosing", () => {
    beforeEach(() => {
      remountApp("en");
      addEnglishParticipant("Ann");
      addEnglishParticipant("Bob");
      addEnglishExpense("Ann", "900");
    });

    it("changes all the amounts and the label of the amount field", () => {
      chooseCurrency("RUB");

      expect(readExpenses(ENGLISH_SECTIONS.expenses)).toEqual([
        "Ann — ₽900.00, for everyone",
      ]);
      expect(readEnglishOverview()).toEqual([
        "2 participants",
        "1 expense",
        "spent ₽900.00",
      ]);
      expect(readSummary(ENGLISH_SECTIONS.summary)).toEqual([
        "Bob → Ann: ₽450.00",
      ]);
      expect(findInput("Amount, ₽")).toBeDefined();
    });

    it("keeps the bill and its amounts as they were", () => {
      chooseCurrency("RUB");
      chooseCurrency("USD");

      expect(readParticipantNames()).toEqual(["Ann", "Bob"]);
      expect(readExpenses(ENGLISH_SECTIONS.expenses)).toEqual([
        "Ann — $900.00, for everyone",
      ]);
      expect(findInput("Amount, $")).toBeDefined();
    });

    it("writes the currency into the address together with the bill", () => {
      chooseCurrency("RUB");

      expect(readAddressCurrency()).toBe("RUB");
      expect(decodeBill(location.hash.slice(1))).toMatchObject({
        kind: "decoded",
        bill: { participants: [{ name: "Ann" }, { name: "Bob" }] },
      });
    });

    it("is kept by the address when the page is opened again", () => {
      chooseCurrency("RUB");

      remountApp("en");

      expect(findCurrencySelect().value).toBe("RUB");
      expect(readExpenses(ENGLISH_SECTIONS.expenses)).toEqual([
        "Ann — ₽900.00, for everyone",
      ]);
    });
  });

  describe("choosing on the Russian page", () => {
    it("changes the amounts and the label on the Russian page the same way", () => {
      addParticipant("Ann");
      addExpense("900");

      chooseCurrency("USD");

      expect(readExpenses()).toEqual([
        `Ann — 900,00 $, ${RU.expenses.forEveryone}`,
      ]);
      expect(findInput(RU.expenses.amountLabel("$"))).toBeDefined();
      expect(readAddressCurrency()).toBe("USD");
    });
  });

  describe("share", () => {
    beforeEach(() => {
      remountApp("en");
      addEnglishParticipant("Ann");
    });

    it("clears the link field because the old link has the old currency", () => {
      const linkField = openLinkField();
      expect(linkField.value).not.toBe("");

      chooseCurrency("RUB");

      expect(linkField.closest<HTMLElement>(".field")?.hidden).toBe(true);
      expect(linkField.value).toBe("");
    });

    it("clears the message about the copied link", async () => {
      const writeText = vi.fn<(text: string) => Promise<void>>();
      writeText.mockResolvedValue(undefined);
      installClipboard(writeText);
      findButton("Share").click();
      const message = findSection(ENGLISH_SECTIONS.share).querySelector(
        ".message",
      );
      await vi.waitFor(() => {
        expect(normalize(message?.textContent)).toBe(SHARE_COPIED_EN);
      });

      chooseCurrency("RUB");

      expect(normalize(message?.textContent)).toBe("");
    });

    it("gives a new link with the chosen currency", () => {
      openLinkField();
      chooseCurrency("RUB");

      const linkField = openLinkField();

      const code = new URL(linkField.value).hash.slice(1);
      expect(decodeBill(code)).toMatchObject({
        kind: "decoded",
        bill: { participants: [{ name: "Ann" }], expenses: [] },
        currency: "RUB",
      });
    });
  });

  describe("language link", () => {
    function readLanguageLinkHash(): string {
      const link = root.querySelector<HTMLAnchorElement>(".language-link");
      if (link === null) throw new Error("Language link not found");

      return new URL(link.getAttribute("href") ?? "", location.href).hash;
    }

    it("carries the chosen currency of an empty bill", () => {
      remountApp("en");

      chooseCurrency("RUB");

      expect(decodeBill(readLanguageLinkHash().slice(1))).toMatchObject({
        kind: "decoded",
        bill: EMPTY_BILL,
        currency: "RUB",
      });
    });

    it("loses the fragment again when the page currency is chosen back", () => {
      remountApp("en");
      chooseCurrency("RUB");

      chooseCurrency("USD");

      expect(readLanguageLinkHash()).toBe("");
    });
  });
});

describe("language switch", () => {
  function findLanguageLink(): HTMLAnchorElement {
    const link = root.querySelector<HTMLAnchorElement>(
      ".page-toolbar .language-link",
    );
    if (link === null) throw new Error("Language link not found");

    return link;
  }

  /** The address the link opens, as a browser resolves it on the page. */
  function readLanguageLinkAddress(): URL {
    return new URL(
      findLanguageLink().getAttribute("href") ?? "",
      location.href,
    );
  }

  /** Follows the link: the other page opens at the address of the link, the app starts there. */
  function followLanguageLink(locale: Locale): void {
    const address = readLanguageLinkAddress();
    history.replaceState(null, "", `${address.pathname}${address.hash}`);
    remountApp(locale);
  }

  describe("link", () => {
    it("leads from the English page to the Russian one and says so", () => {
      remountApp("en");

      const link = findLanguageLink();

      expect(link.textContent).toBe(LOCALE_DEFINITIONS.ru.ownName);
      expect(link.getAttribute("lang")).toBe("ru");
      expect(link.getAttribute("hreflang")).toBe("ru");
      expect(link.getAttribute("href")).toBe("/ru/");
    });

    it("leads from the Russian page to the English one and says so", () => {
      const link = findLanguageLink();

      expect(link.textContent).toBe("English");
      expect(link.getAttribute("lang")).toBe("en");
      expect(link.getAttribute("hreflang")).toBe("en");
      expect(link.getAttribute("href")).toBe("/");
    });

    it("has no fragment while the bill is untouched and in the currency of the page", () => {
      remountApp("en");

      expect(readLanguageLinkAddress().hash).toBe("");
    });

    it("carries the bill and its currency once a participant is added", () => {
      remountApp("en");

      addEnglishParticipant("Ann");

      const result = decodeBill(readLanguageLinkAddress().hash.slice(1));
      expect(result).toMatchObject({
        kind: "decoded",
        bill: { participants: [{ name: "Ann" }], expenses: [] },
        currency: "USD",
      });
    });

    it("carries the currency of an empty bill that is not the currency of the page", () => {
      history.replaceState(null, "", `/#${encodeBill(EMPTY_BILL, "RUB")}`);

      remountApp("en");

      const result = decodeBill(readLanguageLinkAddress().hash.slice(1));
      expect(result).toMatchObject({
        kind: "decoded",
        bill: EMPTY_BILL,
        currency: "RUB",
      });
    });

    it("loses the fragment again when the address returns to an empty bill", () => {
      remountApp("en");
      addEnglishParticipant("Ann");

      changeAddressOnPage("/");

      expect(readLanguageLinkAddress().hash).toBe("");
    });
  });

  describe("following the link", () => {
    it("keeps a bill in dollars built on the English page", () => {
      remountApp("en");
      addEnglishParticipant("Ann");
      addEnglishParticipant("Bob");
      addEnglishExpense("Ann", "900");

      followLanguageLink("ru");

      expect(readParticipantNames()).toEqual(["Ann", "Bob"]);
      expect(readExpenses()).toEqual([
        `Ann — 900,00 $, ${RU.expenses.forEveryone}`,
      ]);
      expect(findInput(RU.expenses.amountLabel("$"))).toBeDefined();
    });

    it("keeps a bill in rubles set up by a link on the English page", () => {
      history.replaceState(null, "", `/#${LITERAL_CODE_RUB}`);
      remountApp("en");
      addEnglishParticipant("Cat");

      followLanguageLink("ru");

      expect(readParticipantNames()).toEqual(["Ann", "Bob", "Cat"]);
      expect(readExpenses()).toEqual([
        `Ann — 123,45 ₽, ${RU.expenses.forBeneficiaries(["Ann", "Bob"])}`,
        `Bob — 5,00 ₽, ${RU.expenses.forBeneficiaries(["Bob"])}`,
      ]);
      expect(readTexts(".page-header .overview-item")).toEqual([
        `3 ${RU_PARTICIPANTS.few}`,
        `2 ${RU_EXPENSES.few}`,
        RU.header.spent("128,45 ₽"),
      ]);
    });

    it("keeps a bill in rubles when going back to the English page", () => {
      history.replaceState(null, "", `/#${LITERAL_CODE_RUB}`);
      remountApp("ru");

      followLanguageLink("en");

      expect(readExpenses(ENGLISH_SECTIONS.expenses)).toEqual([
        "Ann — ₽123.45, for everyone",
        "Bob — ₽5.00, for: Bob",
      ]);
    });

    it("opens an empty bill in the currency of the other page", () => {
      remountApp("en");

      followLanguageLink("ru");

      expect(readTexts(".page-header .overview-item")).toEqual([
        `0 ${RU_PARTICIPANTS.many}`,
        `0 ${RU_EXPENSES.many}`,
        RU.header.spent("0,00 ₽"),
      ]);
    });
  });
});

function invalidBillCode(): string {
  return `1.${encodeBase64Url('[["Ann","ann"],[]]')}`;
}
