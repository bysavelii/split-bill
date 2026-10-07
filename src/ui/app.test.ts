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
  const items = [...(summary?.querySelectorAll("li") ?? [])];
  if (items.length > 0) return items.map((item) => normalize(item.textContent));
  return [normalize(summary?.querySelector("p")?.textContent ?? "")];
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
