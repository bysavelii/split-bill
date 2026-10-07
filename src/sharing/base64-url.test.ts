import { describe, expect, it } from "vitest";
import { decodeBase64Url, encodeBase64Url } from "./base64-url";

describe("encodeBase64Url и decodeBase64Url", () => {
  it.each([
    ["ASCII", "hello, world"],
    ["кириллица", "Привет, Аня и Боря"],
    ["эмодзи", "👩‍👩‍👧"],
    ["пустая строка", ""],
  ])("возвращает исходный текст: %s", (_title, text) => {
    expect(decodeBase64Url(encodeBase64Url(text))).toBe(text);
  });

  it("не использует знаки +, / и =", () => {
    const text = "???>>>~~~ яяя ÿÿÿ 👩‍👩‍👧 ".repeat(5);

    expect(encodeBase64Url(text)).toMatch(/^[A-Za-z0-9_-]*$/u);
  });

  it("кодирует длинный текст без переполнения стека", () => {
    const text = "я".repeat(300_000);

    expect(decodeBase64Url(encodeBase64Url(text))).toBe(text);
  });

  it("сохраняет метку порядка байтов в начале текста", () => {
    const text = "﻿текст";

    expect(decodeBase64Url(encodeBase64Url(text))).toBe(text);
  });

  it.each([
    ["чужие знаки", "!!!"],
    ["невозможная длина 4k+1", "abcde"],
    ["невалидный UTF-8", "_w"],
    ["знак + из обычного base64", "ab+c"],
    ["знак = в конце", "YQ=="],
  ])("возвращает undefined: %s", (_title, code) => {
    expect(decodeBase64Url(code)).toBeUndefined();
  });
});
