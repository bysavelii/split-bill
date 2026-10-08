import { describe, expect, it } from "vitest";
import { parseAmount } from "./money";

describe("parseAmount", () => {
  it.each([
    ["1500", 150_000],
    ["349,9", 34_990],
    ["349.90", 34_990],
    ["1 500", 150_000],
    ["1 500", 150_000],
    ["  12  ", 1_200],
  ])("accepts %j", (text, expected) => {
    expect(parseAmount(text)).toBe(expected);
  });

  it.each([
    "",
    "0",
    "0,00",
    "-5",
    "1,234",
    "abc",
    "1,",
    ",5",
    "1.2.3",
    "9".repeat(30),
  ])("rejects %j", (text) => {
    expect(parseAmount(text)).toBeUndefined();
  });

  it("converts to minor units without floating-point errors", () => {
    expect(parseAmount("0,1")).toBe(10);
    expect(parseAmount("0,07")).toBe(7);
    expect(parseAmount("1.15")).toBe(115);
  });
});
