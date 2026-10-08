// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { MAX_NAME_LENGTH, type Bill } from "../bill/bill";
import { encodeBase64Url } from "../sharing/base64-url";
import { decodeBill, encodeBill } from "../sharing/bill-code";
import { mountApp } from "./app";

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
  if (input === null) throw new Error(`Не найдено поле «${labelText}»`);
  return input;
}

/** Кнопка по доступному имени: `aria-label`, а если его нет — видимый текст. */
function findButton(name: string): HTMLButtonElement {
  const button = [...root.querySelectorAll("button")].find(
    (candidate) =>
      normalize(
        candidate.getAttribute("aria-label") ?? candidate.textContent,
      ) === name,
  );
  if (button === undefined) throw new Error(`Не найдена кнопка «${name}»`);
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
    throw new Error(`Не найден флажок ${name}`);
  checkbox.checked = false;
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
  if (section === undefined) throw new Error(`Не найдена секция «${title}»`);
  return section;
}

function readParticipantNames(): string[] {
  return readTexts(".participant-name");
}

function readExpenses(): string[] {
  const rows = [...findSection("Траты").querySelectorAll(".expense")];

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

function readSummary(): string[] {
  const summary = readSummarySection();
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

function readSummarySection(): HTMLElement {
  return findSection("Итог");
}

function findAnnouncement(): HTMLElement {
  const announcement =
    readSummarySection().querySelector<HTMLElement>("[aria-live]");
  if (announcement === null) throw new Error("Не найдена область объявлений");
  return announcement;
}

function readAnnouncement(): string {
  return normalize(findAnnouncement().textContent);
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

function readBreakdown(): string[] {
  const rows = readSummarySection().querySelectorAll("tbody tr");

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

const EMPTY_SUMMARY =
  "Добавьте траты — здесь появится, кто кому сколько должен";

/** Монтирует приложение заново на текущем адресе, сняв обработчики прошлого. */
function remountApp(): void {
  unmountApp();
  document.body.innerHTML = '<main id="app"></main>';
  const app = document.getElementById("app");
  if (app === null) throw new Error("Не найден #app");
  root = app;
  unmountApp = mountApp(root);
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
    expect(readExpenses()).toEqual(["Аня — 900,00 ₽, за всех"]);

    findRemoveExpenseButton("Аня — 900,00 ₽, за всех").click();

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

    expect(readExpenses()).toEqual(["Аня — 100,00 ₽, за: Аня, Боря"]);
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

describe("шапка", () => {
  function readOverview(): string[] {
    return readTexts(".page-header .overview-item");
  }

  it("показывает название и подзаголовок", () => {
    expect(root.querySelector(".page-header h1")?.textContent).toBe(
      "Делим счёт",
    );
    expect(root.querySelector(".page-subtitle")?.textContent).toBe(
      "Кто кому сколько должен — без таблиц и споров",
    );
  });

  it("у пустого счёта показывает нули", () => {
    expect(readOverview()).toEqual([
      "0 участников",
      "0 трат",
      "потрачено 0,00 ₽",
    ]);
  });

  it("считает участников, траты и всего потраченного", () => {
    addParticipants("Аня", "Боря", "Вера");
    addExpenseBy("Аня", "900");

    expect(readOverview()).toEqual([
      "3 участника",
      "1 трата",
      "потрачено 900,00 ₽",
    ]);
  });
});

describe("кнопки удаления", () => {
  it("это значки без видимого текста, а имя им даёт aria-label", () => {
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

describe("аватары", () => {
  function readToneClasses(container: Element | null): string[] {
    const avatars = container?.querySelectorAll(".avatar") ?? [];

    return [...avatars].flatMap((avatar) =>
      [...avatar.classList].filter((name) => name.startsWith("avatar-tone-")),
    );
  }

  it("у одного человека везде один и тот же оттенок", () => {
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

describe("подсказки пустых состояний", () => {
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

  it("без участников зовёт добавить людей и показывает остальные подсказки", () => {
    expect(readHints()).toEqual([
      NO_PARTICIPANTS_HINT,
      "Сначала добавьте участников",
    ]);
  });

  it("с участниками без трат зовёт добавить первую трату", () => {
    addParticipant("Аня");

    expect(readHints()).toEqual([NO_EXPENSES_HINT]);
  });

  it("после первой траты подсказка про траты исчезает", () => {
    addParticipant("Аня");
    addExpense("100");

    expect(readHints()).toEqual([]);
  });

  it("у каждой подсказки есть значок, скрытый от диктора", () => {
    for (const hint of root.querySelectorAll(".empty-state")) {
      expect(hint.querySelector("svg")?.getAttribute("aria-hidden")).toBe(
        "true",
      );
    }
  });
});

describe("объяснение итога", () => {
  const ROUNDING_TEXT =
    "Когда трата не делится поровну до копейки, у тех, кто выше в списке участников, доля на копейку больше.";

  it("для одного платившего за всех показывает разбор", () => {
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

  it("различает «получает» и «отдаёт» классом, знаком и словом", () => {
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

  it("причину числа переводов прячет внутрь «Как посчитано»", () => {
    addParticipants("Аня", "Боря", "Вера");
    addExpenseBy("Аня", "900");

    const breakdown = readSummarySection().querySelector("details");

    expect(breakdown?.open).toBe(false);
    expect(breakdown?.querySelector(".transfers-reason")).not.toBeNull();
    expect(
      readSummarySection().querySelectorAll(".transfers-reason"),
    ).toHaveLength(1);
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
      "Аня | 500,00 ₽ | 500,00 ₽ | в расчёте",
      "Боря | 500,00 ₽ | 500,00 ₽ | в расчёте",
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
    expect(readBreakdown()).toEqual(["Аня | 500,00 ₽ | 500,00 ₽ | в расчёте"]);
  });

  it("участник без трат попадает в разбор строкой «в расчёте»", () => {
    addParticipants("Аня", "Боря", "Вера");
    uncheckBeneficiary("Вера");
    addExpenseBy("Аня", "100");

    expect(readBreakdown()).toEqual([
      "Аня | 100,00 ₽ | 50,00 ₽ | получает +50,00 ₽",
      "Боря | 0,00 ₽ | 50,00 ₽ | отдаёт −50,00 ₽",
      "Вера | 0,00 ₽ | 0,00 ₽ | в расчёте",
    ]);
  });

  it("очень большая сумма показывается без потери копеек", () => {
    addParticipants("Аня", "Боря");
    addExpenseBy("Аня", "1000000000");

    expect(readSummary()).toEqual(["Боря → Аня: 500 000 000,00 ₽"]);
  });

  it("без трат не показывает «Как посчитано»", () => {
    addParticipants("Аня", "Боря");

    expect(readSummarySection().querySelector("details")).toBeNull();
    expect(readSummary()).toEqual([EMPTY_SUMMARY]);
  });
});

describe("карточки переводов", () => {
  it("над карточками пишет, сколько переводов нужно", () => {
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

  it("когда все в расчёте, строки про число переводов нет", () => {
    addParticipant("Аня");
    addExpense("100");

    expect(readSummarySection().querySelector(".transfers-count")).toBeNull();
  });

  it("у участников карточки те же оттенки аватаров, что в чипах", () => {
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

  it("подсказка в итоге видна без трат и когда все в расчёте", () => {
    const summaryHint = (): string | undefined =>
      normalize(
        readSummarySection().querySelector(".empty-state")?.textContent,
      );

    expect(summaryHint()).toBe(EMPTY_SUMMARY);

    addParticipant("Аня");
    addExpense("100");

    expect(summaryHint()).toBe("Все в расчёте — переводы не нужны");
  });
});

describe("подписи кнопок удаления трат", () => {
  it("различают траты одного плательщика, и нажатие удаляет именно выбранную", () => {
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

describe("доступность итога", () => {
  /** Записи об изменениях области объявлений с момента вызова. */
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

  it("живая область одна: скрытая, вежливая и читается целиком", () => {
    const liveAreas = readSummarySection().querySelectorAll("[aria-live]");

    expect(readSummarySection().hasAttribute("aria-live")).toBe(false);
    expect(liveAreas).toHaveLength(1);
    expect(liveAreas[0]?.getAttribute("aria-live")).toBe("polite");
    expect(liveAreas[0]?.getAttribute("aria-atomic")).toBe("true");
    expect(liveAreas[0]?.classList.contains("visually-hidden")).toBe(true);
  });

  it("без трат сообщает, что трат пока нет", () => {
    expect(readAnnouncement()).toBe("Итог: трат пока нет");
  });

  it("объявляет число переводов, а не сами переводы и пояснения", () => {
    addParticipants("Аня", "Боря", "Вера");
    addExpenseBy("Аня", "900");

    expect(readAnnouncement()).toBe("Итог: 2 перевода");
  });

  it("при взаимных долгах объявляет один перевод", () => {
    addParticipants("Аня", "Боря");
    uncheckBeneficiary("Аня");
    addExpenseBy("Аня", "700");
    uncheckBeneficiary("Боря");
    addExpenseBy("Боря", "300");

    expect(readAnnouncement()).toBe("Итог: 1 перевод");
  });

  it("когда переводы не нужны, объявляет, что все в расчёте", () => {
    addParticipants("Аня");
    addExpenseBy("Аня", "500");

    expect(readAnnouncement()).toBe("Итог: все в расчёте, переводы не нужны");
  });

  it("после удаления последней траты снова объявляет, что трат нет", () => {
    addParticipants("Аня");
    addExpenseBy("Аня", "500");

    findRemoveExpenseButton("Аня — 500,00 ₽, за всех").click();

    expect(readAnnouncement()).toBe("Итог: трат пока нет");
  });

  it("не переписывает область, когда добавляют участников без трат", () => {
    addParticipants("Аня");
    const observer = observeAnnouncement();

    addParticipants("Боря", "Вера");

    expect(observer.takeRecords()).toEqual([]);
    observer.disconnect();
  });

  it("не переписывает область, когда число переводов не изменилось", () => {
    addParticipants("Аня", "Боря", "Вера");
    addExpenseBy("Аня", "900");
    const observer = observeAnnouncement();

    addExpenseBy("Аня", "300");

    expect(readSummary()).toHaveLength(2);
    expect(readAnnouncement()).toBe("Итог: 2 перевода");
    expect(observer.takeRecords()).toEqual([]);
    observer.disconnect();
  });

  it("не вкладывает живые области друг в друга", () => {
    addParticipants("Аня", "Боря", "Вера");
    addExpenseBy("Аня", "900");

    expect(root.querySelectorAll("[aria-live] [aria-live]")).toHaveLength(0);
  });
});

describe("ошибки ввода", () => {
  it("отклоняет пустое имя", () => {
    addParticipant("   ");

    expect(readParticipantsMessage()).toBe("Введите имя");
    expect(readParticipantNames()).toEqual([]);
  });

  it("отклоняет повтор имени", () => {
    addParticipant("Аня");
    addParticipant("аня");

    expect(readParticipantsMessage()).toBe("Участник с таким именем уже есть");
    expect(readParticipantNames()).toEqual(["Аня"]);
  });

  it("отклоняет слишком длинное имя", () => {
    addParticipant("я".repeat(MAX_NAME_LENGTH + 1));

    expect(readParticipantsMessage()).toBe(
      "Имя длиннее 40 знаков — сократите его",
    );
    expect(readParticipantNames()).toEqual([]);
  });

  it("отклоняет трату, после которой итог не поместится в расчёт", () => {
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

    findButton("Удалить участника Боря").click();

    expect(readParticipantsMessage()).toBe(
      "Нельзя удалить Боря: есть траты с этим участником. Сначала удалите их",
    );
    expect(readParticipantNames()).toEqual(["Аня", "Боря"]);
  });

  it("удаляет участника без трат", () => {
    addParticipant("Аня");

    findButton("Удалить участника Аня").click();

    expect(readParticipantNames()).toEqual([]);
  });

  it("сохраняет выбранного плательщика после добавления участника", () => {
    addParticipants("Аня", "Боря");
    selectPayer("Боря");

    addParticipant("Вера");

    expect(root.querySelector("select")?.selectedOptions[0]?.text).toBe("Боря");
  });

  it("после удаления выбранного плательщика выбирает оставшегося участника", () => {
    addParticipants("Аня", "Боря");
    selectPayer("Боря");

    findButton("Удалить участника Боря").click();
    addExpense("100");

    expect(root.querySelector("select")?.selectedOptions[0]?.text).toBe("Аня");
    expect(readExpenses()).toEqual(["Аня — 100,00 ₽, за всех"]);
  });

  it("после ошибки суммы и исправления добавляет трату и убирает сообщение", () => {
    addParticipant("Аня");
    addExpense("abc");
    expect(readExpensesMessage()).not.toBe("");

    addExpense("250");

    expect(readExpensesMessage()).toBe("");
    expect(readExpenses()).toEqual(["Аня — 250,00 ₽, за всех"]);
  });

  it("при превышении предела суммы оставляет введённое в форме", () => {
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

describe("экранирование", () => {
  it("показывает разметку в имени как обычный текст", () => {
    addParticipant("<b>Ли</b>");

    expect(readParticipantNames()).toEqual(["<b>Ли</b>"]);
    expect(root.querySelector("b")).toBeNull();
  });
});

describe("ссылка на счёт", () => {
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

  /** Буфер, ответ которого тест выдаёт сам, когда ему удобно. */
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
        rejectPending(new Error("Нет доступа"));
      };
    });
    const settled = pending.then(
      () => undefined,
      () => undefined,
    );

    return { writeText: () => pending, settled, resolve, reject };
  }

  describe("адрес", () => {
    it("пока ничего не менялось, не трогает адрес", () => {
      expect(location.hash).toBe("");
    });

    it("после добавления участника содержит код текущего счёта", () => {
      addParticipant("Аня");
      addParticipant("Боря");

      const expectedBill: Bill = { participants: [anna, boris], expenses: [] };
      expect(location.hash).toBe(`#${encodeBill(expectedBill)}`);
    });

    it("после добавления траты содержит код счёта с тратой", () => {
      addParticipant("Аня");
      addParticipant("Боря");
      selectPayer("Аня");
      addExpense("900");

      expect(location.hash).toBe(`#${encodeBill(billWithDinner)}`);
    });

    it("после удаления последнего участника записывает код пустого счёта", () => {
      addParticipant("Аня");
      findButton("Удалить участника Аня").click();

      expect(location.hash).toBe(
        `#${encodeBill({ participants: [], expenses: [] })}`,
      );
    });

    it("не добавляет записей в историю", () => {
      const lengthBefore = history.length;

      addParticipant("Аня");
      addParticipant("Боря");
      addExpense("100");

      expect(history.length).toBe(lengthBefore);
    });

    it("сохраняет путь и query", () => {
      openAddress("/split-bill/?from=chat");

      addParticipant("Аня");

      expect(location.pathname).toBe("/split-bill/");
      expect(location.search).toBe("?from=chat");
      expect(location.hash).not.toBe("");
    });
  });

  describe("открытие по ссылке", () => {
    it("новое приложение на том же адресе показывает тот же счёт", () => {
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

    it("после открытия новые участники не пересекаются с разобранными", () => {
      openCode(encodeBill(billWithDinner));

      addParticipant("Вера");
      selectPayer("Вера");
      addExpense("300");

      expect(readParticipantNames()).toEqual(["Аня", "Боря", "Вера"]);
      expect(readBreakdown()).toHaveLength(3);
    });

    it("открытие счёта само адрес не пишет", () => {
      const code = encodeBill(billWithDinner);
      const pageUrl = `/split-bill/?x=1#${code}`;

      openAddress(pageUrl);

      expect(location.pathname + location.search + location.hash).toBe(pageUrl);
    });

    it.each([
      ["#мусор", "мусор", MALFORMED_NOTICE],
      ["#1.!!!", "1.!!!", MALFORMED_NOTICE],
      ["счёт с повторяющимися именами", invalidBillCode(), MALFORMED_NOTICE],
      ["другая версия", `2.${encodeBase64Url("[[],[]]")}`, UNSUPPORTED_NOTICE],
    ])(
      "при ссылке «%s» показывает сообщение и пустой счёт",
      (_title, code, text) => {
        openCode(code);

        expect(readNotice()?.hidden).toBe(false);
        expect(readNotice()?.getAttribute("role")).toBe("alert");
        expect(readNoticeText()).toBe(text);
        expect(readParticipantNames()).toEqual([]);
        expect(readSummary()).toEqual([EMPTY_SUMMARY]);
      },
    );

    it("подделанная ссылка с огромным итогом не роняет страницу", () => {
      const forgedCode =
        "1.W1siYSIsImIiLCJjIl0sW1sxLDkwMDcxOTkyNTQ3NDA3NjksWzJdXSxbMCw5MDA3MTk5MjU0NzQwNDYxLFsxXV0sWzIsOTAwNzE5OTI1NDc0MDIxMCxbMV1dXV0";

      openCode(forgedCode);

      expect(readNoticeText()).toBe(MALFORMED_NOTICE);
      expect(readParticipantNames()).toEqual([]);
      expect(readSummary()).toEqual([EMPTY_SUMMARY]);

      changeAddressOnPage(encodeBill(billWithDinner));

      expect(readParticipantNames()).toEqual(["Аня", "Боря"]);
    });

    it("не меняет адрес, пока счёт не менялся", () => {
      openCode("1.!!!");

      expect(location.hash).toBe("#1.!!!");
    });

    it("после первого изменения заменяет адрес валидным кодом, формы работают", () => {
      openCode("1.!!!");

      addParticipant("Аня");

      const expectedBill: Bill = { participants: [anna], expenses: [] };
      expect(readParticipantNames()).toEqual(["Аня"]);
      expect(location.hash).toBe(`#${encodeBill(expectedBill)}`);
    });

    it("«Закрыть» прячет сообщение и ничего больше не меняет", () => {
      openCode("1.!!!");

      findButton("Закрыть сообщение").click();

      expect(readNotice()?.hidden).toBe(true);
      expect(location.hash).toBe("#1.!!!");
    });

    it("сообщение стоит между шапкой и секциями", () => {
      const children = [...root.children].map((child) => child.tagName);

      expect(children).toEqual(["HEADER", "DIV", "DIV"]);
      expect(root.children[1]).toBe(readNotice());
      expect(readNotice()?.hidden).toBe(true);
    });
  });

  describe("изменение адреса на открытой странице", () => {
    it("показывает счёт из нового валидного кода", () => {
      changeAddressOnPage(encodeBill(billWithDinner));

      expect(readParticipantNames()).toEqual(["Аня", "Боря"]);
      expect(readSummary()).toEqual(["Боря → Аня: 450,00 ₽"]);
    });

    it("обновляет сводку для диктора по новому счёту", () => {
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
      openCode(encodeBill(billWithDinner));
      expect(readAnnouncement()).toBe("Итог: 1 перевод");

      changeAddressOnPage(encodeBill({ participants: [anna], expenses: [] }));
      expect(readAnnouncement()).toBe("Итог: трат пока нет");

      changeAddressOnPage(encodeBill(lunch));
      expect(readAnnouncement()).toBe("Итог: 1 перевод");
    });

    it("при битом коде сводка для диктора сообщает, что трат нет", () => {
      openCode(encodeBill(billWithDinner));
      expect(readAnnouncement()).toBe("Итог: 1 перевод");

      changeAddressOnPage("1.!!!");

      expect(readAnnouncement()).toBe("Итог: трат пока нет");
    });

    it("при битом коде показывает сообщение и пустой счёт", () => {
      addParticipant("Аня");

      changeAddressOnPage("1.!!!");

      expect(readNoticeText()).toBe(MALFORMED_NOTICE);
      expect(readParticipantNames()).toEqual([]);
    });

    it("при валидном коде прячет прежнее сообщение", () => {
      openCode("1.!!!");

      changeAddressOnPage(encodeBill(billWithDinner));

      expect(readNotice()?.hidden).toBe(true);
    });

    it("при пустом фрагменте показывает пустой счёт", () => {
      openCode(encodeBill(billWithDinner));

      changeAddressOnPage("");

      expect(readParticipantNames()).toEqual([]);
    });

    it("не пишет адрес, а значит не вызывает цикла", () => {
      const code = encodeBill(billWithDinner);

      changeAddressOnPage(code);

      expect(location.hash).toBe(`#${code}`);
    });

    it("после снятия приложения перестаёт реагировать на адрес", () => {
      unmountApp();

      changeAddressOnPage(encodeBill(billWithDinner));

      expect(readParticipantNames()).toEqual([]);
    });
  });

  describe("«Поделиться»", () => {
    it("копирует ссылку текущего счёта и сообщает об этом", async () => {
      const writeText = vi.fn<(text: string) => Promise<void>>();
      writeText.mockResolvedValue(undefined);
      installClipboard(writeText);
      openAddress("/split-bill/");
      addParticipant("Аня");
      addParticipant("Боря");
      const code = encodeBill({ participants: [anna, boris], expenses: [] });

      findButton("Поделиться").click();

      await vi.waitFor(() => {
        expect(readShareMessage()).toBe("Ссылка скопирована");
      });
      expect(writeText).toHaveBeenCalledExactlyOnceWith(
        `${location.origin}/split-bill/#${code}`,
      );
      expect(isLinkFieldHidden()).toBe(true);
    });

    it("сообщение об успехе не стилизовано как ошибка", async () => {
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

    it("ответ буфера после изменения счёта не показывает «Ссылка скопирована»", async () => {
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

    it("отказ буфера после изменения счёта не показывает поле со старой ссылкой", async () => {
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

    it("без буфера показывает поле со ссылкой", () => {
      addParticipant("Аня");

      findButton("Поделиться").click();

      expect(readShareMessage()).toBe("Скопируйте ссылку из поля");
      expect(isLinkFieldHidden()).toBe(false);
      expect(readLinkField().readOnly).toBe(true);
      expect(readLinkField().value).toBe(location.href);
    });

    it("при отказе буфера показывает поле со ссылкой", async () => {
      const writeText = vi.fn<(text: string) => Promise<void>>();
      writeText.mockRejectedValue(new Error("Нет доступа"));
      installClipboard(writeText);
      addParticipant("Аня");

      findButton("Поделиться").click();

      await vi.waitFor(() => {
        expect(readShareMessage()).toBe("Скопируйте ссылку из поля");
      });
      expect(isLinkFieldHidden()).toBe(false);
      expect(readLinkField().value).toBe(location.href);
    });

    it("отказ буфера после успеха без изменения счёта не оставляет сообщение зелёным", async () => {
      const writeText = vi.fn<(text: string) => Promise<void>>();
      writeText.mockResolvedValueOnce(undefined);
      writeText.mockRejectedValueOnce(new Error("Нет доступа"));
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

    it("ссылка пустого счёта открывается как пустой счёт", () => {
      findButton("Поделиться").click();

      const link = new URL(readLinkField().value);
      const result = decodeBill(link.hash.slice(1));
      expect(result).toEqual({
        kind: "decoded",
        bill: { participants: [], expenses: [] },
      });
    });

    it("при следующей отрисовке сбрасывает сообщение и прячет поле", () => {
      findButton("Поделиться").click();

      addParticipant("Аня");

      expect(readShareMessage()).toBe("");
      expect(isLinkFieldHidden()).toBe(true);
    });
  });
});

function invalidBillCode(): string {
  return `1.${encodeBase64Url('[["Аня","аня"],[]]')}`;
}
