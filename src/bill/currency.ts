/**
 * The currencies a bill can be kept in, as ISO 4217 codes.
 *
 * Every supported currency has exactly 2 minor-unit digits (cents, kopecks), because amounts are
 * stored as integers of 1/100 of the main unit. A currency with another number of digits
 * must not be added without changing how amounts are stored.
 */
export const CURRENCIES = ["USD", "RUB"] as const;

export type Currency = (typeof CURRENCIES)[number];

export function isCurrency(value: unknown): value is Currency {
  return CURRENCIES.some((currency) => currency === value);
}
