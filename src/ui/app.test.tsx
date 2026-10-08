// @vitest-environment jsdom
import { fireEvent, render } from "@solidjs/testing-library";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { MAX_NAME_LENGTH, type Bill } from "../bill/bill";
import { encodeBase64Url } from "../sharing/base64-url";
import type { Locale } from "../i18n/locales";
import { decodeBill, encodeBill } from "../sharing/bill-code";
import { App } from "./app";

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
  fireEvent.input(findInput("Имя"), { target: { value: name } });
  findButton("Добавить").click();
}

function addExpense(amount: string): void {
  fireEvent.input(findInput("Сколько, ₽"), { target: { value: amount } });
  findButton("Добавить трату").click();
}

function selectPayer(name: string): void {
  const select = root.querySelector("select");
  const option = [...(select?.options ?? [])].find(
    (candidate) => candidate.text === name,
  );
  if (select === null || option === undefined)
    throw new Error(`Payer ${name} not found`);
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

function readExpenses(sectionTitle = "Траты"): string[] {
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
    findSection("Участники").querySelector(".message")?.textContent ?? "",
  );
}

function readExpensesMessage(): string {
  return normalize(
    findSection("Траты").querySelector(".message")?.textContent ?? "",
  );
}

function readSummary(sectionTitle = "Итог"): string[] {
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

function readSummarySection(sectionTitle = "Итог"): HTMLElement {
  return findSection(sectionTitle);
}

function findAnnouncement(sectionTitle = "Итог"): HTMLElement {
  const announcement =
    readSummarySection(sectionTitle).querySelector<HTMLElement>("[aria-live]");
  if (announcement === null) throw new Error("Announcement area not found");
  return announcement;
}

function readAnnouncement(sectionTitle = "Итог"): string {
  return normalize(findAnnouncement(sectionTitle).textContent);
}

function readRemoveExpenseLabels(): string[] {
  const buttons = [
    ...findSection("Траты").querySelectorAll("button[aria-label]"),
  ];
  return buttons.map((button) => normalize(button.getAttribute("aria-label")));
}

function findRemoveExpenseButton(description: string): HTMLButtonElement {
  return findButton(`Удалить трату: ${description}`);
}

function readBreakdown(summaryTitle = "Итог"): string[] {
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
/** The first version of the format: Russian names, no currency. */
const LITERAL_CODE =
  "1.W1si0JDQvdGPIiwi0JHQvtGA0Y8iLCLQktC10YDQsCIsItCT0L7RiNCwIl0sW1swLDQ4MDAwMCxbMCwxLDIsM11dLFsxLDEyNTA1MCxbMCwxLDJdXSxbMiw2MDAwMCxbMiwzXV1dXQ";
/** The current version: Ann paid 123.45 for both, Bob paid 5.00 for himself; in dollars. */
const LITERAL_CODE_USD =
  "2.W1siQW5uIiwiQm9iIl0sW1swLDEyMzQ1LFswLDFdXSxbMSw1MDAsWzFdXV0sIlVTRCJd";
/** The same bill in rubles. */
const LITERAL_CODE_RUB =
  "2.W1siQW5uIiwiQm9iIl0sW1swLDEyMzQ1LFswLDFdXSxbMSw1MDAsWzFdXV0sIlJVQiJd";

const EMPTY_SUMMARY =
  "Добавьте траты — здесь появится, кто кому сколько должен";

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

    addParticipant("Аня");
    addParticipant("Боря");
    addParticipant("Вера");
    selectPayer("Аня");
    addExpense("900");

    expect(readSummary()).toEqual([
      "Боря → Аня: 300,00 ₽",
      "Вера → Аня: 300,00 ₽",
    ]);
    expect(readExpenses()).toEqual(["Аня — 900,00 ₽, за всех"]);

    findRemoveExpenseButton("Аня — 900,00 ₽, за всех").click();

    expect(readSummary()).toEqual([EMPTY_SUMMARY]);
  });

  it("says no transfers are needed when everyone is settled", () => {
    addParticipant("Аня");
    addExpense("100");

    expect(readSummary()).toEqual(["Все в расчёте — переводы не нужны"]);
  });

  it("lists the recipients of an expense separated by commas", () => {
    addParticipant("Аня");
    addParticipant("Боря");
    addParticipant("Вера");
    uncheckBeneficiary("Вера");
    addExpense("100");

    expect(readExpenses()).toEqual(["Аня — 100,00 ₽, за: Аня, Боря"]);
  });

  it("after adding an expense clears the amount, checks everyone and keeps the payer", () => {
    addParticipant("Аня");
    addParticipant("Боря");
    selectPayer("Боря");
    uncheckBeneficiary("Аня");
    addExpense("100");

    const select = root.querySelector("select");
    const checkboxes = [
      ...root.querySelectorAll<HTMLInputElement>("label.checkbox input"),
    ];
    expect(findInput("Сколько, ₽").value).toBe("");
    expect(checkboxes.map((checkbox) => checkbox.checked)).toEqual([
      true,
      true,
    ]);
    expect(select?.selectedOptions[0]?.text).toBe("Боря");
  });

  it("checks everyone again when the list of participants changes", () => {
    addParticipant("Аня");
    addParticipant("Боря");
    uncheckBeneficiary("Аня");

    addParticipant("Вера");

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
      (paragraph) => paragraph.textContent === "Сначала добавьте участников",
    );

    expect(form?.hidden).toBe(true);
    expect(notice?.hidden).toBe(false);

    addParticipant("Аня");

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
      "Делим счёт",
    );
    expect(root.querySelector(".page-subtitle")?.textContent).toBe(
      "Кто кому сколько должен — без таблиц и споров",
    );
  });

  it("shows zeros for an empty bill", () => {
    expect(readOverview()).toEqual([
      "0 участников",
      "0 трат",
      "потрачено 0,00 ₽",
    ]);
  });

  it("counts participants, expenses and the total spent", () => {
    addParticipants("Аня", "Боря", "Вера");
    addExpenseBy("Аня", "900");

    expect(readOverview()).toEqual([
      "3 участника",
      "1 трата",
      "потрачено 900,00 ₽",
    ]);
  });
});

describe("delete buttons", () => {
  it("are icons without visible text, and aria-label gives them the name", () => {
    addParticipants("Аня", "Боря");
    addExpenseBy("Аня", "900");

    const buttons = [...root.querySelectorAll("button.icon-button")];

    expect(
      buttons.map((button) => normalize(button.getAttribute("aria-label"))),
    ).toEqual([
      "Удалить участника Аня",
      "Удалить участника Боря",
      "Удалить трату: Аня — 900,00 ₽, за всех",
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
    addParticipants("Аня", "Боря");
    selectPayer("Боря");
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
      ...findSection("Участники").querySelectorAll<HTMLElement>(".empty-state"),
      ...findSection("Траты").querySelectorAll<HTMLElement>(".empty-state"),
    ];

    return hints
      .filter((hint) => !hint.hidden)
      .map((hint) => normalize(hint.textContent));
  }

  const NO_PARTICIPANTS_HINT =
    "Добавьте всех, кто участвует, — хватит имени. Себя тоже";
  const NO_EXPENSES_HINT =
    "Трат пока нет. Добавьте первую: кто платил, сколько и за кого";

  it("without participants asks to add people and shows the other hints", () => {
    expect(readHints()).toEqual([
      NO_PARTICIPANTS_HINT,
      "Сначала добавьте участников",
    ]);
  });

  it("with participants and no expenses asks to add the first expense", () => {
    addParticipant("Аня");

    expect(readHints()).toEqual([NO_EXPENSES_HINT]);
  });

  it("the expenses hint disappears after the first expense", () => {
    addParticipant("Аня");
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
  const ROUNDING_TEXT =
    "Когда трата не делится поровну до копейки, у тех, кто выше в списке участников, доля на копейку больше.";

  it("shows the breakdown for one person who paid for everyone", () => {
    addParticipants("Аня", "Боря", "Вера");
    addExpenseBy("Аня", "900");

    expect(readParagraphs()).toContain("Всего потрачено: 900,00 ₽");
    expect(readBreakdown()).toEqual([
      "Аня | 900,00 ₽ | 300,00 ₽ | получает +600,00 ₽",
      "Боря | 0,00 ₽ | 300,00 ₽ | отдаёт −300,00 ₽",
      "Вера | 0,00 ₽ | 300,00 ₽ | отдаёт −300,00 ₽",
    ]);
    expect(
      readSummarySection().querySelector("details > summary")?.textContent,
    ).toBe("Как посчитано");
  });

  it('tells "получает" from "отдаёт" by class, sign and word', () => {
    addParticipants("Аня", "Боря", "Вера");
    uncheckBeneficiary("Вера");
    addExpenseBy("Аня", "100");

    const outcomes = [...readSummarySection().querySelectorAll("td.outcome")];

    expect(outcomes.map((outcome) => outcome.className)).toEqual([
      "outcome outcome-receives",
      "outcome outcome-gives",
      "outcome outcome-settled",
    ]);
    expect(outcomes.map((outcome) => normalize(outcome.textContent))).toEqual([
      "получает +50,00 ₽",
      "отдаёт \u221250,00 ₽",
      "в расчёте",
    ]);
  });

  it('hides the reason for the number of transfers inside "Как посчитано"', () => {
    addParticipants("Аня", "Боря", "Вера");
    addExpenseBy("Аня", "900");

    const breakdown = readSummarySection().querySelector("details");

    expect(breakdown?.open).toBe(false);
    expect(breakdown?.querySelector(".transfers-reason")).not.toBeNull();
    expect(
      readSummarySection().querySelectorAll(".transfers-reason"),
    ).toHaveLength(1);
  });

  it("explains why there are exactly this many transfers", () => {
    addParticipants("Аня", "Боря", "Вера");
    addExpenseBy("Аня", "900");

    expect(
      readReason()?.startsWith(
        "2 перевода — меньше не получится: деньги отдают или получают 3 человека, ",
      ),
    ).toBe(true);
  });

  it("100 rubles for three: two transfers of 33.33 ₽", () => {
    addParticipants("Аня", "Боря", "Вера");
    addExpenseBy("Аня", "100");

    expect(readSummary()).toEqual([
      "Боря → Аня: 33,33 ₽",
      "Вера → Аня: 33,33 ₽",
    ]);
  });

  it("mutual debts of 700 and 300 ₽: one transfer of 400 ₽", () => {
    addParticipants("Аня", "Боря");
    uncheckBeneficiary("Аня");
    addExpenseBy("Аня", "700");
    uncheckBeneficiary("Боря");
    addExpenseBy("Боря", "300");

    expect(readSummary()).toEqual(["Боря → Аня: 400,00 ₽"]);
  });

  it('with mutual debts shows "в расчёте" and does not explain the number of transfers', () => {
    addParticipants("Аня", "Боря");
    uncheckBeneficiary("Аня");
    addExpenseBy("Аня", "500");
    uncheckBeneficiary("Боря");
    addExpenseBy("Боря", "500");

    expect(readSummary()).toEqual(["Все в расчёте — переводы не нужны"]);
    expect(readReason()).toBeUndefined();
    expect(readBreakdown()).toEqual([
      "Аня | 500,00 ₽ | 500,00 ₽ | в расчёте",
      "Боря | 500,00 ₽ | 500,00 ₽ | в расчёте",
    ]);
  });

  it("explains that there are fewer transfers than usual when the group splits into subgroups", () => {
    addParticipants("Аня", "Боря", "Вера", "Гена");
    uncheckBeneficiary("Аня");
    uncheckBeneficiary("Вера");
    uncheckBeneficiary("Гена");
    addExpenseBy("Аня", "300");
    uncheckBeneficiary("Аня");
    uncheckBeneficiary("Боря");
    uncheckBeneficiary("Вера");
    addExpenseBy("Вера", "200");

    expect(readSummary()).toEqual([
      "Боря → Аня: 300,00 ₽",
      "Гена → Вера: 200,00 ₽",
    ]);
    expect(
      readReason()?.startsWith(
        "2 перевода вместо обычных 3: деньги отдают или получают 4 человека",
      ),
    ).toBe(true);
  });

  it("explains about kopecks when an expense does not divide evenly", () => {
    addParticipants("Аня", "Боря", "Вера");
    addExpenseBy("Аня", "100");

    expect(readNotes()).toContain(ROUNDING_TEXT);
  });

  it("does not explain about kopecks when all expenses divide evenly", () => {
    addParticipants("Аня", "Боря", "Вера");
    addExpenseBy("Аня", "900");

    expect(readNotes()).not.toContain(ROUNDING_TEXT);
    expect(readNotes()).toHaveLength(1);
  });

  it("one participant with an expense on themselves: settled, no transfers", () => {
    addParticipants("Аня");
    addExpenseBy("Аня", "500");

    expect(readSummary()).toEqual(["Все в расчёте — переводы не нужны"]);
    expect(readBreakdown()).toEqual(["Аня | 500,00 ₽ | 500,00 ₽ | в расчёте"]);
  });

  it('a participant without expenses gets into the breakdown with the row "в расчёте"', () => {
    addParticipants("Аня", "Боря", "Вера");
    uncheckBeneficiary("Вера");
    addExpenseBy("Аня", "100");

    expect(readBreakdown()).toEqual([
      "Аня | 100,00 ₽ | 50,00 ₽ | получает +50,00 ₽",
      "Боря | 0,00 ₽ | 50,00 ₽ | отдаёт −50,00 ₽",
      "Вера | 0,00 ₽ | 0,00 ₽ | в расчёте",
    ]);
  });

  it("a very large amount is shown without losing kopecks", () => {
    addParticipants("Аня", "Боря");
    addExpenseBy("Аня", "1000000000");

    expect(readSummary()).toEqual(["Боря → Аня: 500 000 000,00 ₽"]);
  });

  it('without expenses does not show "Как посчитано"', () => {
    addParticipants("Аня", "Боря");

    expect(readSummarySection().querySelector("details")).toBeNull();
    expect(readSummary()).toEqual([EMPTY_SUMMARY]);
  });
});

describe("transfer cards", () => {
  it("above the cards says how many transfers are needed", () => {
    addParticipants("Аня", "Боря", "Вера");
    addExpenseBy("Аня", "900");

    const count = readSummarySection().querySelector(".transfers-count");

    expect(normalize(count?.textContent)).toBe(
      "Чтобы рассчитаться, нужно 2 перевода",
    );
    expect(count?.nextElementSibling?.classList.contains("transfers")).toBe(
      true,
    );
  });

  it("when everyone is settled, there is no line about the number of transfers", () => {
    addParticipant("Аня");
    addExpense("100");

    expect(readSummarySection().querySelector(".transfers-count")).toBeNull();
  });

  it("participants on the cards have the same avatar tones as in the chips", () => {
    addParticipants("Аня", "Боря");
    addExpenseBy("Боря", "100");

    const chipTones = [...root.querySelectorAll(".chip .avatar")].map(
      (avatar) => avatar.className,
    );
    const cardTones = [
      ...readSummarySection().querySelectorAll(".transfer-people .avatar"),
    ].map((avatar) => avatar.className);

    expect(readSummary()).toEqual(["Аня → Боря: 50,00 ₽"]);
    expect(cardTones).toEqual(chipTones);
  });

  it("the hint in the summary is visible without expenses and when everyone is settled", () => {
    const summaryHint = (): string =>
      normalize(
        readSummarySection().querySelector(".empty-state")?.textContent,
      );

    expect(summaryHint()).toBe(EMPTY_SUMMARY);

    addParticipant("Аня");
    addExpense("100");

    expect(summaryHint()).toBe("Все в расчёте — переводы не нужны");
  });
});

describe("captions of the expense delete buttons", () => {
  it("tell apart expenses of one payer, and a click removes exactly the chosen one", () => {
    addParticipants("Аня", "Боря", "Вера");
    addExpenseBy("Аня", "900");
    addExpense("300");

    expect(readRemoveExpenseLabels()).toEqual([
      "Удалить трату: Аня — 900,00 ₽, за всех",
      "Удалить трату: Аня — 300,00 ₽, за всех",
    ]);

    findRemoveExpenseButton("Аня — 300,00 ₽, за всех").click();

    expect(readExpenses()).toEqual(["Аня — 900,00 ₽, за всех"]);
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
    expect(readAnnouncement()).toBe("Итог: трат пока нет");
  });

  it("announces the number of transfers, not the transfers themselves and the explanations", () => {
    addParticipants("Аня", "Боря", "Вера");
    addExpenseBy("Аня", "900");

    expect(readAnnouncement()).toBe("Итог: 2 перевода");
  });

  it("announces one transfer for mutual debts", () => {
    addParticipants("Аня", "Боря");
    uncheckBeneficiary("Аня");
    addExpenseBy("Аня", "700");
    uncheckBeneficiary("Боря");
    addExpenseBy("Боря", "300");

    expect(readAnnouncement()).toBe("Итог: 1 перевод");
  });

  it("when no transfers are needed, announces that everyone is settled", () => {
    addParticipants("Аня");
    addExpenseBy("Аня", "500");

    expect(readAnnouncement()).toBe("Итог: все в расчёте, переводы не нужны");
  });

  it("after the last expense is removed announces again that there are no expenses", () => {
    addParticipants("Аня");
    addExpenseBy("Аня", "500");

    findRemoveExpenseButton("Аня — 500,00 ₽, за всех").click();

    expect(readAnnouncement()).toBe("Итог: трат пока нет");
  });

  it("does not rewrite the area when participants are added without expenses", () => {
    addParticipants("Аня");
    const observer = observeAnnouncement();

    addParticipants("Боря", "Вера");

    expect(observer.takeRecords()).toEqual([]);
    observer.disconnect();
  });

  it("does not rewrite the area when the number of transfers did not change", () => {
    addParticipants("Аня", "Боря", "Вера");
    addExpenseBy("Аня", "900");
    const observer = observeAnnouncement();

    addExpenseBy("Аня", "300");

    expect(readSummary()).toHaveLength(2);
    expect(readAnnouncement()).toBe("Итог: 2 перевода");
    expect(observer.takeRecords()).toEqual([]);
    observer.disconnect();
  });

  it("does not nest live areas inside each other", () => {
    addParticipants("Аня", "Боря", "Вера");
    addExpenseBy("Аня", "900");

    expect(root.querySelectorAll("[aria-live] [aria-live]")).toHaveLength(0);
  });
});

describe("input errors", () => {
  it("rejects an empty name", () => {
    addParticipant("   ");

    expect(readParticipantsMessage()).toBe("Введите имя");
    expect(readParticipantNames()).toEqual([]);
  });

  it("rejects a repeated name", () => {
    addParticipant("Аня");
    addParticipant("аня");

    expect(readParticipantsMessage()).toBe("Участник с таким именем уже есть");
    expect(readParticipantNames()).toEqual(["Аня"]);
  });

  it("rejects a name that is too long", () => {
    addParticipant("я".repeat(MAX_NAME_LENGTH + 1));

    expect(readParticipantsMessage()).toBe(
      "Имя длиннее 40 знаков — сократите его",
    );
    expect(readParticipantNames()).toEqual([]);
  });

  it("rejects an expense after which the total will not fit the calculation", () => {
    addParticipant("Аня");
    addExpense("90071992547407,69");
    const expenses = readExpenses();
    const address = location.hash;

    addExpense("90071992547404,61");

    expect(readExpensesMessage()).toBe(
      "Слишком большая сумма: общий итог счёта не поместится в расчёт",
    );
    expect(readExpenses()).toEqual(expenses);
    expect(location.hash).toBe(address);
  });

  it.each(["", "0", "abc", "1,234"])("rejects the amount %j", (amount) => {
    addParticipant("Аня");
    addExpense(amount);

    expect(readExpensesMessage()).toBe(
      "Введите сумму больше нуля, например 1500 или 349,90",
    );
    expect(readSummary()).toEqual([EMPTY_SUMMARY]);
  });

  it("rejects an expense without checked recipients", () => {
    addParticipant("Аня");
    uncheckBeneficiary("Аня");
    addExpense("100");

    expect(readExpensesMessage()).toBe("Отметьте, за кого платили");
    expect(readSummary()).toEqual([EMPTY_SUMMARY]);
  });

  it("does not remove a participant who is in the expenses", () => {
    addParticipant("Аня");
    addParticipant("Боря");
    addExpense("100");

    findButton("Удалить участника Боря").click();

    expect(readParticipantsMessage()).toBe(
      "Нельзя удалить Боря: есть траты с этим участником. Сначала удалите их",
    );
    expect(readParticipantNames()).toEqual(["Аня", "Боря"]);
  });

  it("removes a participant without expenses", () => {
    addParticipant("Аня");

    findButton("Удалить участника Аня").click();

    expect(readParticipantNames()).toEqual([]);
  });

  it("keeps the chosen payer after a participant is added", () => {
    addParticipants("Аня", "Боря");
    selectPayer("Боря");

    addParticipant("Вера");

    expect(root.querySelector("select")?.selectedOptions[0]?.text).toBe("Боря");
  });

  it("after the chosen payer is removed picks the remaining participant", () => {
    addParticipants("Аня", "Боря");
    selectPayer("Боря");

    findButton("Удалить участника Боря").click();
    addExpense("100");

    expect(root.querySelector("select")?.selectedOptions[0]?.text).toBe("Аня");
    expect(readExpenses()).toEqual(["Аня — 100,00 ₽, за всех"]);
  });

  it("after an amount error and a correction adds the expense and removes the message", () => {
    addParticipant("Аня");
    addExpense("abc");
    expect(readExpensesMessage()).not.toBe("");

    addExpense("250");

    expect(readExpensesMessage()).toBe("");
    expect(readExpenses()).toEqual(["Аня — 250,00 ₽, за всех"]);
  });

  it("when the amount limit is exceeded keeps what was entered in the form", () => {
    addParticipant("Аня");
    addExpense("90071992547407,69");
    uncheckBeneficiary("Аня");

    addExpense("90071992547404,61");

    expect(findInput("Сколько, ₽").value).toBe("90071992547404,61");
    expect(
      root.querySelector<HTMLInputElement>("label.checkbox input")?.checked,
    ).toBe(false);
  });
});

describe("escaping", () => {
  it("shows markup in a name as plain text", () => {
    addParticipant("<b>Ли</b>");

    expect(readParticipantNames()).toEqual(["<b>Ли</b>"]);
    expect(root.querySelector("b")).toBeNull();
  });
});

describe("bill link", () => {
  const anna = { id: "anna", name: "Аня" };
  const boris = { id: "boris", name: "Боря" };
  const billWithDinner: Bill = {
    participants: [anna, boris],
    expenses: [
      {
        id: "dinner",
        payerId: anna.id,
        amount: 90_000,
        beneficiaryIds: [anna.id, boris.id],
      },
    ],
  };
  const MALFORMED_NOTICE =
    "Не получилось открыть счёт по ссылке: она повреждена или скопирована не целиком. Попросите прислать её ещё раз, а пока можно начать новый счёт.";
  const UNSUPPORTED_NOTICE =
    "Эта ссылка сделана в другой версии приложения, и открыть её здесь не получится. Попросите прислать новую ссылку, а пока можно начать новый счёт.";

  function openAddress(url: string): void {
    history.replaceState(null, "", url);
    remountApp();
  }

  function openCode(code: string): void {
    openAddress(`/#${code}`);
  }

  function changeAddressOnPage(code: string): void {
    history.replaceState(null, "", `/#${code}`);
    window.dispatchEvent(new HashChangeEvent("hashchange"));
  }

  function readNotice(): HTMLElement | null {
    return root.querySelector<HTMLElement>(".notice");
  }

  function readNoticeText(): string {
    return normalize(readNotice()?.querySelector("p")?.textContent ?? "");
  }

  function readShareSection(): HTMLElement {
    return findSection("Поделиться");
  }

  function readShareMessage(): string {
    const message = readShareSection().querySelector(".message");
    return normalize(message?.textContent ?? "");
  }

  function readLinkField(): HTMLInputElement {
    return findInput("Ссылка на счёт");
  }

  function isLinkFieldHidden(): boolean {
    return readLinkField().closest<HTMLElement>(".field")?.hidden === true;
  }

  function installClipboard(writeText: (text: string) => Promise<void>): void {
    Object.defineProperty(navigator, "clipboard", {
      value: { writeText },
      configurable: true,
    });
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
      addParticipant("Аня");
      addParticipant("Боря");

      const expectedBill: Bill = { participants: [anna, boris], expenses: [] };
      expect(location.hash).toBe(`#${encodeBill(expectedBill, "RUB")}`);
    });

    it("after an expense is added contains the code of the bill with the expense", () => {
      addParticipant("Аня");
      addParticipant("Боря");
      selectPayer("Аня");
      addExpense("900");

      expect(location.hash).toBe(`#${encodeBill(billWithDinner, "RUB")}`);
    });

    it("after the last participant is removed writes the code of an empty bill", () => {
      addParticipant("Аня");
      findButton("Удалить участника Аня").click();

      expect(location.hash).toBe(
        `#${encodeBill({ participants: [], expenses: [] }, "RUB")}`,
      );
    });

    it("adds no entries to the history", () => {
      const lengthBefore = history.length;

      addParticipant("Аня");
      addParticipant("Боря");
      addExpense("100");

      expect(history.length).toBe(lengthBefore);
    });

    it("keeps the path and the query", () => {
      openAddress("/split-bill/?from=chat");

      addParticipant("Аня");

      expect(location.pathname).toBe("/split-bill/");
      expect(location.search).toBe("?from=chat");
      expect(location.hash).not.toBe("");
    });
  });

  describe("opening by a link", () => {
    it("a new app at the same address shows the same bill", () => {
      addParticipant("Аня");
      addParticipant("Боря");
      selectPayer("Аня");
      uncheckBeneficiary("Боря");
      addExpense("700");
      selectPayer("Боря");
      uncheckBeneficiary("Аня");
      uncheckBeneficiary("Боря");
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

      addParticipant("Вера");
      selectPayer("Вера");
      addExpense("300");

      expect(readParticipantNames()).toEqual(["Аня", "Боря", "Вера"]);
      expect(readBreakdown()).toHaveLength(3);
    });

    it("opening a bill does not write the address itself", () => {
      const code = encodeBill(billWithDinner, "RUB");
      const pageUrl = `/split-bill/?x=1#${code}`;

      openAddress(pageUrl);

      expect(location.pathname + location.search + location.hash).toBe(pageUrl);
    });

    it.each([
      ["#мусор", "мусор", MALFORMED_NOTICE],
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

      changeAddressOnPage(encodeBill(billWithDinner, "RUB"));

      expect(readParticipantNames()).toEqual(["Аня", "Боря"]);
    });

    it("does not change the address while the bill has not changed", () => {
      openCode("1.!!!");

      expect(location.hash).toBe("#1.!!!");
    });

    it("after the first change replaces the address with a valid code, the forms work", () => {
      openCode("1.!!!");

      addParticipant("Аня");

      const expectedBill: Bill = { participants: [anna], expenses: [] };
      expect(readParticipantNames()).toEqual(["Аня"]);
      expect(location.hash).toBe(`#${encodeBill(expectedBill, "RUB")}`);
    });

    it('"Закрыть" hides the message and changes nothing else', () => {
      openCode("1.!!!");

      findButton("Закрыть сообщение").click();

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
      expect(readTitles(columns[0])).toEqual(["Участники", "Траты"]);
      expect(readTitles(columns[1])).toEqual(["Итог", "Поделиться"]);
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
      changeAddressOnPage(encodeBill(billWithDinner, "RUB"));

      expect(readParticipantNames()).toEqual(["Аня", "Боря"]);
      expect(readSummary()).toEqual(["Боря → Аня: 450,00 ₽"]);
    });

    it("updates the screen reader overview for the new bill", () => {
      const lunch: Bill = {
        participants: [anna, boris],
        expenses: [
          {
            id: "a",
            payerId: anna.id,
            amount: 70_000,
            beneficiaryIds: [boris.id],
          },
          {
            id: "b",
            payerId: boris.id,
            amount: 30_000,
            beneficiaryIds: [anna.id],
          },
        ],
      };
      openCode(encodeBill(billWithDinner, "RUB"));
      expect(readAnnouncement()).toBe("Итог: 1 перевод");

      changeAddressOnPage(
        encodeBill({ participants: [anna], expenses: [] }, "RUB"),
      );
      expect(readAnnouncement()).toBe("Итог: трат пока нет");

      changeAddressOnPage(encodeBill(lunch, "RUB"));
      expect(readAnnouncement()).toBe("Итог: 1 перевод");
    });

    it("with a broken code the screen reader overview says there are no expenses", () => {
      openCode(encodeBill(billWithDinner, "RUB"));
      expect(readAnnouncement()).toBe("Итог: 1 перевод");

      changeAddressOnPage("1.!!!");

      expect(readAnnouncement()).toBe("Итог: трат пока нет");
    });

    it("with a broken code shows the message and an empty bill", () => {
      addParticipant("Аня");

      changeAddressOnPage("1.!!!");

      expect(readNoticeText()).toBe(MALFORMED_NOTICE);
      expect(readParticipantNames()).toEqual([]);
    });

    it("with a valid code hides the previous message", () => {
      openCode("1.!!!");

      changeAddressOnPage(encodeBill(billWithDinner, "RUB"));

      expect(readNotice()?.hidden).toBe(true);
    });

    it("with an empty fragment shows an empty bill", () => {
      openCode(encodeBill(billWithDinner, "RUB"));

      changeAddressOnPage("");

      expect(readParticipantNames()).toEqual([]);
    });

    it("does not write the address, so it causes no loop", () => {
      const code = encodeBill(billWithDinner, "RUB");

      changeAddressOnPage(code);

      expect(location.hash).toBe(`#${code}`);
    });

    it("after the app is removed stops reacting to the address", () => {
      unmountApp();

      changeAddressOnPage(encodeBill(billWithDinner, "RUB"));

      expect(readParticipantNames()).toEqual([]);
    });
  });

  describe('"Поделиться"', () => {
    it("copies the link of the current bill and says so", async () => {
      const writeText = vi.fn<(text: string) => Promise<void>>();
      writeText.mockResolvedValue(undefined);
      installClipboard(writeText);
      openAddress("/split-bill/");
      addParticipant("Аня");
      addParticipant("Боря");
      const code = encodeBill(
        { participants: [anna, boris], expenses: [] },
        "RUB",
      );

      findButton("Поделиться").click();

      await vi.waitFor(() => {
        expect(readShareMessage()).toBe("Ссылка скопирована");
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
      addParticipant("Аня");

      findButton("Поделиться").click();

      await vi.waitFor(() => {
        expect(readShareMessage()).toBe("Ссылка скопирована");
      });
      const message = readShareSection().querySelector(".message");
      expect(message?.classList.contains("message-success")).toBe(true);

      addParticipant("Боря");

      expect(message?.classList.contains("message-success")).toBe(false);
    });

    it('the clipboard answer after the bill changed does not show "Ссылка скопирована"', async () => {
      const clipboard = createDeferredWrite();
      installClipboard(clipboard.writeText);
      addParticipant("Аня");
      findButton("Поделиться").click();

      addParticipant("Боря");
      clipboard.resolve();
      await clipboard.settled;

      expect(readShareMessage()).toBe("");
      expect(isLinkFieldHidden()).toBe(true);
    });

    it("the clipboard refusal after the bill changed does not show the field with the old link", async () => {
      const clipboard = createDeferredWrite();
      installClipboard(clipboard.writeText);
      addParticipant("Аня");
      findButton("Поделиться").click();

      addParticipant("Боря");
      clipboard.reject();
      await clipboard.settled;

      expect(readShareMessage()).toBe("");
      expect(isLinkFieldHidden()).toBe(true);
    });

    it("without a clipboard shows the field with the link", () => {
      addParticipant("Аня");

      findButton("Поделиться").click();

      expect(readShareMessage()).toBe("Скопируйте ссылку из поля");
      expect(isLinkFieldHidden()).toBe(false);
      expect(readLinkField().readOnly).toBe(true);
      expect(readLinkField().value).toBe(location.href);
    });

    it("when the clipboard refuses shows the field with the link", async () => {
      const writeText = vi.fn<(text: string) => Promise<void>>();
      writeText.mockRejectedValue(new Error("Access denied"));
      installClipboard(writeText);
      addParticipant("Аня");

      findButton("Поделиться").click();

      await vi.waitFor(() => {
        expect(readShareMessage()).toBe("Скопируйте ссылку из поля");
      });
      expect(isLinkFieldHidden()).toBe(false);
      expect(readLinkField().value).toBe(location.href);
    });

    it("a clipboard refusal after success without a bill change does not leave the message green", async () => {
      const writeText = vi.fn<(text: string) => Promise<void>>();
      writeText.mockResolvedValueOnce(undefined);
      writeText.mockRejectedValueOnce(new Error("Access denied"));
      installClipboard(writeText);
      addParticipant("Аня");
      findButton("Поделиться").click();
      await vi.waitFor(() => {
        expect(readShareMessage()).toBe("Ссылка скопирована");
      });

      findButton("Поделиться").click();

      await vi.waitFor(() => {
        expect(readShareMessage()).toBe("Скопируйте ссылку из поля");
      });
      const message = readShareSection().querySelector(".message");
      expect(message?.classList.contains("message-success")).toBe(false);
    });

    it("the link of an empty bill opens as an empty bill", () => {
      findButton("Поделиться").click();

      const link = new URL(readLinkField().value);
      const result = decodeBill(link.hash.slice(1));
      expect(result).toEqual({
        kind: "decoded",
        bill: { participants: [], expenses: [] },
        currency: "RUB",
      });
    });

    it("on the next render resets the message and hides the field", () => {
      findButton("Поделиться").click();

      addParticipant("Аня");

      expect(readShareMessage()).toBe("");
      expect(isLinkFieldHidden()).toBe(true);
    });
  });
});

describe("share links from the previous version", () => {
  it("opens a bill by a literal code at the published address", () => {
    history.replaceState(null, "", `/split-bill/#${LITERAL_CODE}`);

    remountApp();

    expect(readParticipantNames()).toEqual(["Аня", "Боря", "Вера", "Гоша"]);
    expect(readExpenses()).toEqual([
      "Аня — 4 800,00 ₽, за всех",
      "Боря — 1 250,50 ₽, за: Аня, Боря, Вера",
      "Вера — 600,00 ₽, за: Вера, Гоша",
    ]);
    expect(readSummary()).toEqual([
      "Боря → Аня: 366,33 ₽",
      "Вера → Аня: 1 316,83 ₽",
      "Гоша → Аня: 1 500,00 ₽",
    ]);
    expect(readTexts(".page-header .overview-item")).toEqual([
      "4 участника",
      "3 траты",
      "потрачено 6 650,50 ₽",
    ]);
    expect(root.querySelector<HTMLElement>(".notice")?.hidden).toBe(true);
  });

  it("opens the same code on the English page with amounts in dollars", () => {
    history.replaceState(null, "", `/split-bill/#${LITERAL_CODE}`);

    remountApp("en");

    expect(readExpenses(ENGLISH_SECTIONS.expenses)).toEqual([
      "Аня — $4,800.00, for everyone",
      "Боря — $1,250.50, for: Аня, Боря, Вера",
      "Вера — $600.00, for: Вера, Гоша",
    ]);
    expect(readSummary(ENGLISH_SECTIONS.summary)).toEqual([
      "Боря → Аня: $366.33",
      "Вера → Аня: $1,316.83",
      "Гоша → Аня: $1,500.00",
    ]);
    expect(readTexts(".page-header .overview-item")).toEqual([
      "4 participants",
      "3 expenses",
      "spent $6,650.50",
    ]);
  });
});

describe("English page", () => {
  const SECTIONS = ENGLISH_SECTIONS;

  function addEnglishParticipant(name: string): void {
    fireEvent.input(findInput("Name"), { target: { value: name } });
    findButton("Add").click();
  }

  function addEnglishExpense(payer: string, amount: string): void {
    selectPayer(payer);
    fireEvent.input(findInput("Amount, $"), { target: { value: amount } });
    findButton("Add expense").click();
  }

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
    const duplicateMessage = normalize(
      findSection(SECTIONS.participants).querySelector(".message")?.textContent,
    );
    addEnglishExpense("Ann", "abc");
    const amountMessage = normalize(
      findSection(SECTIONS.expenses).querySelector(".message")?.textContent,
    );

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

  function changeAddressOnPage(address: string): void {
    history.replaceState(null, "", address);
    window.dispatchEvent(new HashChangeEvent("hashchange"));
  }

  it("shows the amounts of the link in dollars, not in rubles", () => {
    openUsdLink();

    expect(readExpenses()).toEqual([
      "Ann — 123,45 $, за всех",
      "Bob — 5,00 $, за: Bob",
    ]);
    expect(findInput("Сколько, $")).toBeDefined();
  });

  it("keeps the currency of the link in the address after the bill is edited", () => {
    openUsdLink();

    addParticipant("Вера");

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
      "0 участников",
      "0 трат",
      "потрачено 0,00 ₽",
    ]);
    expect(findInput("Сколько, ₽")).toBeDefined();
  });

  it("writes the currency of the link into the Share link", () => {
    openUsdLink();

    findButton("Поделиться").click();

    const shareLink = new URL(findInput("Ссылка на счёт").value);
    const result = decodeBill(shareLink.hash.slice(1));
    expect(result).toMatchObject({ kind: "decoded", currency: "USD" });
  });

  it("opens a link in rubles on the Russian page as before", () => {
    history.replaceState(null, "", `/#${LITERAL_CODE_RUB}`);

    remountApp("ru");

    expect(readExpenses()).toEqual([
      "Ann — 123,45 ₽, за всех",
      "Bob — 5,00 ₽, за: Bob",
    ]);
  });
});

function invalidBillCode(): string {
  return `1.${encodeBase64Url('[["Аня","аня"],[]]')}`;
}
