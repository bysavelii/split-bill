import { describe, expect, it } from "vitest";
import { CURRENCIES, isCurrency } from "./currency";

const MINOR_UNIT_DIGITS = 2;

describe("isCurrency", () => {
  it.each(CURRENCIES)("accepts the supported currency %s", (currency) => {
    expect(isCurrency(currency)).toBe(true);
  });

  it.each([
    ["EUR"],
    ["usd"],
    ["rub"],
    [""],
    [1],
    [null],
    [undefined],
    [["USD"]],
  ])("rejects %j", (value) => {
    expect(isCurrency(value)).toBe(false);
  });
});

describe("CURRENCIES", () => {
  it.each(CURRENCIES)(
    "%s has two minor-unit digits, as the integer amounts assume",
    (currency) => {
      const { maximumFractionDigits } = new Intl.NumberFormat("en-US", {
        style: "currency",
        currency,
      }).resolvedOptions();

      expect(maximumFractionDigits).toBe(MINOR_UNIT_DIGITS);
    },
  );
});
