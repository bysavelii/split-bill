import { describe, expect, it } from "vitest";
import { formatRubles, parseRubles } from "./money";

describe("parseRubles", () => {
  it.each([
    ["1500", 150_000],
    ["349,9", 34_990],
    ["349.90", 34_990],
    ["1 500", 150_000],
    ["1 500", 150_000],
    ["  12  ", 1_200],
  ])("accepts %j", (text, expected) => {
    expect(parseRubles(text)).toBe(expected);
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
    expect(parseRubles(text)).toBeUndefined();
  });

  it("converts kopecks without floating-point errors", () => {
    expect(parseRubles("0,1")).toBe(10);
    expect(parseRubles("0,07")).toBe(7);
    expect(parseRubles("1.15")).toBe(115);
  });
});

describe("formatRubles", () => {
  it("formats rubles with kopecks", () => {
    const withoutSpecialSpaces = formatRubles(123_450).replace(/\s/gu, " ");

    expect(withoutSpecialSpaces).toBe("1 234,50 ₽");
  });
});
