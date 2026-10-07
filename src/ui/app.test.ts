// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from "vitest";
import { mountApp } from "./app";

let root: HTMLElement;

function normalize(text: string | null): string {
  return (text ?? "").replace(/\s/gu, " ").trim();
}

function findInput(labelText: string): HTMLInputElement {
  const label = [...root.querySelectorAll("label")].find(
    (candidate) => normalize(candidate.textContent) === labelText,
  );
  const input = label?.htmlFor
    ? root.querySelector<HTMLInputElement>(`#${label.htmlFor}`)
    : null;
  if (input === null) throw new Error(`Не найдено поле «${labelText}»`);
  return input;
}

function findButton(text: string): HTMLButtonElement {
  const button = [...root.querySelectorAll("button")].find(
    (candidate) => normalize(candidate.textContent) === text,
  );
  if (button === undefined) throw new Error(`Не найдена кнопка «${text}»`);
  return button;
}

function findByLabel(ariaLabel: string): HTMLButtonElement {
  const button = root.querySelector<HTMLButtonElement>(
    `[aria-label="${ariaLabel}"]`,
  );
  if (button === null)
    throw new Error(`Не найден элемент с aria-label «${ariaLabel}»`);
  return button;
}

function addParticipant(name: string): void {
  findInput("Имя").value = name;
  findButton("Добавить").click();
}

function addExpense(amount: string): void {
  findInput("Сколько, ₽").value = amount;
  findButton("Добавить трату").click();
}

function selectPayer(name: string): void {
  const select = root.querySelector("select");
  const option = [...(select?.options ?? [])].find(
    (candidate) => candidate.text === name,
  );
  if (select === null || option === undefined)
    throw new Error(`Не найден плательщик ${name}`);
  select.value = option.value;
}

function uncheckBeneficiary(name: string): void {
  const label = [...root.querySelectorAll("label.checkbox")].find(
    (candidate) => normalize(candidate.textContent) === name,
  );
  const checkbox = label?.querySelector("input");
  if (checkbox === null || checkbox === undefined)
    throw new Error(`Не найден флажок ${name}`);
  checkbox.checked = false;
}

function readTexts(selector: string): string[] {
  return [...root.querySelectorAll(selector)].map((element) =>
    normalize(element.textContent),
  );
}

function readParticipantsMessage(): string {
  return normalize(
    root.querySelectorAll("section")[0]?.querySelector(".message")
      ?.textContent ?? "",
  );
}

function readExpensesMessage(): string {
  return normalize(
    root.querySelectorAll("section")[1]?.querySelector(".message")
      ?.textContent ?? "",
  );
}

function readSummary(): string[] {
  const summary = root.querySelectorAll("section")[2];
  const items = [...(summary?.querySelectorAll(".transfers li") ?? [])];
  if (items.length > 0) return items.map((item) => normalize(item.textContent));
  return [normalize(summary?.querySelector("p")?.textContent ?? "")];
}

function readSummarySection(): HTMLElement {
  const summary = root.querySelectorAll("section")[2];
  if (summary === undefined) throw new Error("Не найдена секция «Итог»");
  return summary;
}

function readBreakdown(): string[] {
  const rows = readSummarySection().querySelectorAll(".breakdown li");
  return [...rows].map((row) => normalize(row.textContent));
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

const EMPTY_SUMMARY =
  "Добавьте траты — здесь появится, кто кому сколько должен";

beforeEach(() => {
  document.body.innerHTML = '<main id="app"></main>';
  const app = document.getElementById("app");
  if (app === null) throw new Error("Не найден #app");
  root = app;
  mountApp(root);
});

describe("сценарий деления счёта", () => {
  it("показывает, кто кому переводит, и возвращает подсказку после удаления траты", () => {
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
    expect(readTexts("section:nth-of-type(2) li span")).toEqual([
      "Аня — 900,00 ₽, за всех",
    ]);

    findByLabel("Удалить трату").click();

    expect(readSummary()).toEqual([EMPTY_SUMMARY]);
  });

  it("сообщает, что переводы не нужны, когда все в расчёте", () => {
    addParticipant("Аня");
    addExpense("100");

    expect(readSummary()).toEqual(["Все в расчёте — переводы не нужны"]);
  });

  it("перечисляет получателей траты через запятую", () => {
    addParticipant("Аня");
    addParticipant("Боря");
    addParticipant("Вера");
    uncheckBeneficiary("Вера");
    addExpense("100");

    expect(readTexts("section:nth-of-type(2) li span")).toEqual([
      "Аня — 100,00 ₽, за: Аня, Боря",
    ]);
  });

  it("после добавления траты очищает сумму, отмечает всех и оставляет плательщика", () => {
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

  it("при смене списка участников снова отмечает всех", () => {
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

  it("пока нет участников, показывает подсказку вместо формы траты", () => {
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

describe("объяснение итога", () => {
  const ROUNDING_TEXT =
    "Когда трата не делится поровну до копейки, у тех, кто выше в списке участников, доля на копейку больше.";

  function addParticipants(...names: string[]): void {
    for (const name of names) addParticipant(name);
  }

  function addExpenseBy(payer: string, amount: string): void {
    selectPayer(payer);
    addExpense(amount);
  }

  it("для одного платившего за всех показывает разбор", () => {
    addParticipants("Аня", "Боря", "Вера");
    addExpenseBy("Аня", "900");

    expect(readParagraphs()).toContain("Всего потрачено: 900,00 ₽");
    expect(readBreakdown()).toEqual([
      "Аня: заплачено 900,00 ₽, доля 300,00 ₽ — получает 600,00 ₽",
      "Боря: заплачено 0,00 ₽, доля 300,00 ₽ — отдаёт 300,00 ₽",
      "Вера: заплачено 0,00 ₽, доля 300,00 ₽ — отдаёт 300,00 ₽",
    ]);
    expect(readSummarySection().querySelector("h3")?.textContent).toBe(
      "Как посчитано",
    );
  });

  it("объясняет, почему переводов именно столько", () => {
    addParticipants("Аня", "Боря", "Вера");
    addExpenseBy("Аня", "900");

    expect(
      readReason()?.startsWith(
        "2 перевода — меньше не получится: деньги отдают или получают 3 человека, ",
      ),
    ).toBe(true);
  });

  it("100 рублей на троих: два перевода по 33,33 ₽", () => {
    addParticipants("Аня", "Боря", "Вера");
    addExpenseBy("Аня", "100");

    expect(readSummary()).toEqual([
      "Боря → Аня: 33,33 ₽",
      "Вера → Аня: 33,33 ₽",
    ]);
  });

  it("взаимные долги 700 и 300 ₽: один перевод на 400 ₽", () => {
    addParticipants("Аня", "Боря");
    uncheckBeneficiary("Аня");
    addExpenseBy("Аня", "700");
    uncheckBeneficiary("Боря");
    addExpenseBy("Боря", "300");

    expect(readSummary()).toEqual(["Боря → Аня: 400,00 ₽"]);
  });

  it("при взаимных долгах показывает «в расчёте» и не объясняет число переводов", () => {
    addParticipants("Аня", "Боря");
    uncheckBeneficiary("Аня");
    addExpenseBy("Аня", "500");
    uncheckBeneficiary("Боря");
    addExpenseBy("Боря", "500");

    expect(readSummary()).toEqual(["Все в расчёте — переводы не нужны"]);
    expect(readReason()).toBeUndefined();
    expect(readBreakdown()).toEqual([
      "Аня: заплачено 500,00 ₽, доля 500,00 ₽ — в расчёте",
      "Боря: заплачено 500,00 ₽, доля 500,00 ₽ — в расчёте",
    ]);
  });

  it("объясняет, что переводов меньше обычного, когда компания делится на группы", () => {
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

  it("поясняет про копейки, когда трата не делится поровну", () => {
    addParticipants("Аня", "Боря", "Вера");
    addExpenseBy("Аня", "100");

    expect(readNotes()).toContain(ROUNDING_TEXT);
  });

  it("не поясняет про копейки, когда все траты делятся поровну", () => {
    addParticipants("Аня", "Боря", "Вера");
    addExpenseBy("Аня", "900");

    expect(readNotes()).not.toContain(ROUNDING_TEXT);
    expect(readNotes()).toHaveLength(1);
  });

  it("один участник с тратой на себя: в расчёте, переводов нет", () => {
    addParticipants("Аня");
    addExpenseBy("Аня", "500");

    expect(readSummary()).toEqual(["Все в расчёте — переводы не нужны"]);
    expect(readBreakdown()).toEqual([
      "Аня: заплачено 500,00 ₽, доля 500,00 ₽ — в расчёте",
    ]);
  });

  it("участник без трат попадает в разбор строкой «в расчёте»", () => {
    addParticipants("Аня", "Боря", "Вера");
    uncheckBeneficiary("Вера");
    addExpenseBy("Аня", "100");

    expect(readBreakdown()).toEqual([
      "Аня: заплачено 100,00 ₽, доля 50,00 ₽ — получает 50,00 ₽",
      "Боря: заплачено 0,00 ₽, доля 50,00 ₽ — отдаёт 50,00 ₽",
      "Вера: заплачено 0,00 ₽, доля 0,00 ₽ — в расчёте",
    ]);
  });

  it("очень большая сумма показывается без потери копеек", () => {
    addParticipants("Аня", "Боря");
    addExpenseBy("Аня", "1000000000");

    expect(readSummary()).toEqual(["Боря → Аня: 500 000 000,00 ₽"]);
  });

  it("без трат не показывает «Как посчитано»", () => {
    addParticipants("Аня", "Боря");

    expect(readSummarySection().querySelector("h3")).toBeNull();
    expect(readSummarySection().querySelector(".breakdown")).toBeNull();
    expect(readSummary()).toEqual([EMPTY_SUMMARY]);
  });
});

describe("ошибки ввода", () => {
  it("отклоняет пустое имя", () => {
    addParticipant("   ");

    expect(readParticipantsMessage()).toBe("Введите имя");
    expect(readTexts("section:nth-of-type(1) li")).toEqual([]);
  });

  it("отклоняет повтор имени", () => {
    addParticipant("Аня");
    addParticipant("аня");

    expect(readParticipantsMessage()).toBe("Участник с таким именем уже есть");
    expect(readTexts("section:nth-of-type(1) li span")).toEqual(["Аня"]);
  });

  it.each(["", "0", "abc", "1,234"])("отклоняет сумму %j", (amount) => {
    addParticipant("Аня");
    addExpense(amount);

    expect(readExpensesMessage()).toBe(
      "Введите сумму больше нуля, например 1500 или 349,90",
    );
    expect(readSummary()).toEqual([EMPTY_SUMMARY]);
  });

  it("отклоняет трату без отмеченных получателей", () => {
    addParticipant("Аня");
    uncheckBeneficiary("Аня");
    addExpense("100");

    expect(readExpensesMessage()).toBe("Отметьте, за кого платили");
    expect(readSummary()).toEqual([EMPTY_SUMMARY]);
  });

  it("не удаляет участника, который есть в тратах", () => {
    addParticipant("Аня");
    addParticipant("Боря");
    addExpense("100");

    findByLabel("Удалить участника Боря").click();

    expect(readParticipantsMessage()).toBe(
      "Нельзя удалить Боря: есть траты с этим участником. Сначала удалите их",
    );
    expect(readTexts("section:nth-of-type(1) li span")).toEqual([
      "Аня",
      "Боря",
    ]);
  });

  it("удаляет участника без трат", () => {
    addParticipant("Аня");

    findByLabel("Удалить участника Аня").click();

    expect(readTexts("section:nth-of-type(1) li")).toEqual([]);
  });
});

describe("экранирование", () => {
  it("показывает разметку в имени как обычный текст", () => {
    addParticipant("<b>Ли</b>");

    expect(readTexts("section:nth-of-type(1) li span")).toEqual(["<b>Ли</b>"]);
    expect(root.querySelector("b")).toBeNull();
  });
});
