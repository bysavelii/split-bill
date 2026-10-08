import type { Messages } from "./messages";
import { MINUS_SIGN } from "./typography";

export const RU_MESSAGES: Messages = {
  header: {
    title: "Делим счёт",
    subtitle: "Кто кому сколько должен — без таблиц и споров",
    spent: (amountText) => `потрачено ${amountText}`,
  },
  participants: {
    heading: "Участники",
    nameLabel: "Имя",
    addButton: "Добавить",
    emptyHint: "Добавьте всех, кто участвует, — хватит имени. Себя тоже",
    nameEmpty: "Введите имя",
    nameTooLong: (maxLengthText) =>
      `Имя длиннее ${maxLengthText} знаков — сократите его`,
    nameDuplicate: "Участник с таким именем уже есть",
    cannotRemove: (name) =>
      `Нельзя удалить ${name}: есть траты с этим участником. Сначала удалите их`,
    removeLabel: (name) => `Удалить участника ${name}`,
  },
  expenses: {
    heading: "Траты",
    noParticipantsHint: "Сначала добавьте участников",
    emptyHint: "Трат пока нет. Добавьте первую: кто платил, сколько и за кого",
    payerLabel: "Кто платил",
    amountLabel: (currencySymbol) => `Сколько, ${currencySymbol}`,
    beneficiariesLegend: "За кого",
    addButton: "Добавить трату",
    amountError: "Введите сумму больше нуля, например 1500 или 349,90",
    noBeneficiariesError: "Отметьте, за кого платили",
    totalTooLargeError:
      "Слишком большая сумма: общий итог счёта не поместится в расчёт",
    forEveryone: "за всех",
    forBeneficiaries: (names) => `за: ${names.join(", ")}`,
    removeLabel: (payerName, amountText, beneficiariesText) =>
      `Удалить трату: ${payerName} — ${amountText}, ${beneficiariesText}`,
  },
  summary: {
    heading: "Итог",
    emptyHint: "Добавьте траты — здесь появится, кто кому сколько должен",
    settledHint: "Все в расчёте — переводы не нужны",
    announcementNoExpenses: "Итог: трат пока нет",
    announcementSettled: "Итог: все в расчёте, переводы не нужны",
    announcement: (transfersText) => `Итог: ${transfersText}`,
    transfersNeeded: (transfersText) =>
      `Чтобы рассчитаться, нужно ${transfersText}`,
    routeSeparator: " → ",
    breakdownTitle: "Как посчитано",
    breakdownColumns: {
      participant: "Участник",
      paid: "Заплатил",
      share: "Доля",
      outcome: "Итог",
    },
    totalSpent: (amountText) => `Всего потрачено: ${amountText}`,
    shareNote:
      "Доля — сколько из трат пришлось на человека. Кто заплатил больше своей доли, получает разницу, кто меньше — отдаёт.",
    receives: (amountText) => `получает +${amountText}`,
    gives: (amountText) => `отдаёт ${MINUS_SIGN}${amountText}`,
    balanced: "в расчёте",
    reasonApproximate: (transfersText, settlersText) =>
      `${transfersText}: деньги отдают или получают ${settlersText}. В такой большой компании переводы подобраны упрощённо — возможно, получится обойтись меньшим числом.`,
    reasonGroups: (transfersText, usualCountText, settlersText) =>
      `${transfersText} вместо обычных ${usualCountText}: деньги отдают или получают ${settlersText}, но они делятся на группы, которые рассчитываются между собой. Меньше не получится.`,
    reasonMinimal: (transfersText, settlersText) =>
      `${transfersText} — меньше не получится: деньги отдают или получают ${settlersText}, а когда их нельзя разбить на группы, которые рассчитываются между собой, переводов нужно на один меньше, чем людей.`,
  },
  share: {
    heading: "Поделиться",
    note: "Счёт хранится в самой ссылке — без сервера и регистрации. Кто её откроет, увидит тот же счёт.",
    button: "Поделиться",
    linkLabel: "Ссылка на счёт",
    copied: "Ссылка скопирована",
    copyManually: "Скопируйте ссылку из поля",
  },
  linkNotice: {
    malformed:
      "Не получилось открыть счёт по ссылке: она повреждена или скопирована не целиком. Попросите прислать её ещё раз, а пока можно начать новый счёт.",
    unsupportedVersion:
      "Эта ссылка сделана в другой версии приложения, и открыть её здесь не получится. Попросите прислать новую ссылку, а пока можно начать новый счёт.",
    close: "Закрыть",
    closeLabel: "Закрыть сообщение",
  },
  plurals: {
    participants: {
      one: "участник",
      few: "участника",
      many: "участников",
      other: "участника",
    },
    expenses: {
      one: "трата",
      few: "траты",
      many: "трат",
      other: "траты",
    },
    transfers: {
      one: "перевод",
      few: "перевода",
      many: "переводов",
      other: "перевода",
    },
    people: {
      one: "человек",
      few: "человека",
      many: "человек",
      other: "человека",
    },
  },
  seo: {
    title: "Делим счёт — кто кому сколько должен",
    description:
      "Бесплатный калькулятор: внесите траты компании — приложение посчитает, кто кому сколько должен, и сведёт расчёты к минимуму переводов. Без регистрации.",
    imageAlt:
      "Страница «Делим счёт» с примером: участники, траты и переводы, после которых все в расчёте",
  },
  howItWorks: {
    heading: "Как это работает",
    steps: [
      "Добавьте всех, кто участвует, — и себя тоже.",
      "Вносите траты: кто платил, сколько и за кого.",
      "Получите минимум переводов, после которых все в расчёте, и отправьте ссылку компании.",
    ],
  },
  currencyLabel: "Валюта",
  currencyNames: {
    USD: "Доллар США",
    RUB: "Российский рубль",
  },
  roundingNote: {
    USD: "Когда трата не делится поровну до цента, у тех, кто выше в списке участников, доля на цент больше.",
    RUB: "Когда трата не делится поровну до копейки, у тех, кто выше в списке участников, доля на копейку больше.",
  },
};
