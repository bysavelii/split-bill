/** An amount in minor units, kopecks or cents: always an integer. */
export type Kopecks = number;

const MINOR_UNIT_DIGITS = 2;
export const MINOR_UNITS_PER_UNIT = 10 ** MINOR_UNIT_DIGITS;

const WHITESPACE = /\s/gu;
const AMOUNT_PATTERN = /^(\d+)(?:[.,](\d{1,2}))?$/u;

/** Parses an entered amount into minor units; `undefined` for zero and invalid input. */
export function parseAmount(text: string): Kopecks | undefined {
  const compactText = text.replace(WHITESPACE, "");
  const match = AMOUNT_PATTERN.exec(compactText);
  if (match === null) return undefined;

  const [, units = "", fraction = ""] = match;
  // Minor units are assembled as a string so as not to multiply a fractional number and lose precision.
  const minorUnitsText = units + fraction.padEnd(MINOR_UNIT_DIGITS, "0");
  const amount = Number(minorUnitsText);
  if (!Number.isSafeInteger(amount) || amount === 0) return undefined;

  return amount;
}
