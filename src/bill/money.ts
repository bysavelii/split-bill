/** Сумма в копейках: всегда целое число. */
export type Kopecks = number;

export const KOPECKS_PER_RUBLE = 100;

const MAX_KOPECK_DIGITS = 2;
const WHITESPACE = /\s/gu;
const RUBLES_PATTERN = /^(\d+)(?:[.,](\d{1,2}))?$/u;

const rublesFormat = new Intl.NumberFormat("ru-RU", {
  style: "currency",
  currency: "RUB",
  minimumFractionDigits: 2,
});

/** Разбирает введённые рубли в копейки; `undefined` для нуля и некорректного ввода. */
export function parseRubles(text: string): Kopecks | undefined {
  const compactText = text.replace(WHITESPACE, "");
  const match = RUBLES_PATTERN.exec(compactText);
  if (match === null) return undefined;

  const [, rubles = "", fraction = ""] = match;
  // Копейки собираются строкой, чтобы не умножать дробное число и не терять точность.
  const kopecksText = rubles + fraction.padEnd(MAX_KOPECK_DIGITS, "0");
  const amount = Number(kopecksText);
  if (!Number.isSafeInteger(amount) || amount === 0) return undefined;

  return amount;
}

export function formatRubles(amount: Kopecks): string {
  return rublesFormat.format(amount / KOPECKS_PER_RUBLE);
}
