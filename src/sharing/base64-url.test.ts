import { describe, expect, it } from "vitest";
import { decodeBase64Url, encodeBase64Url } from "./base64-url";

describe("encodeBase64Url and decodeBase64Url", () => {
  it.each([
    ["ASCII", "hello, world"],
    ["Greek", "Γεια σου, Άννα"],
    ["emoji", "👩‍👩‍👧"],
    ["empty string", ""],
  ])("returns the original text: %s", (_title, text) => {
    expect(decodeBase64Url(encodeBase64Url(text))).toBe(text);
  });

  it("does not use the characters +, / and =", () => {
    const text = "???>>>~~~ ωωω ÿÿÿ 👩‍👩‍👧 ".repeat(5);

    expect(encodeBase64Url(text)).toMatch(/^[A-Za-z0-9_-]*$/u);
  });

  it("encodes a long text without a stack overflow", () => {
    const text = "ω".repeat(300_000);

    expect(decodeBase64Url(encodeBase64Url(text))).toBe(text);
  });

  it("keeps the byte order mark at the start of the text", () => {
    const text = "﻿κείμενο";

    expect(decodeBase64Url(encodeBase64Url(text))).toBe(text);
  });

  it.each([
    ["foreign characters", "!!!"],
    ["impossible length 4k+1", "abcde"],
    ["invalid UTF-8", "_w"],
    ["the + character from ordinary base64", "ab+c"],
    ["the = character at the end", "YQ=="],
  ])("returns undefined: %s", (_title, code) => {
    expect(decodeBase64Url(code)).toBeUndefined();
  });
});
