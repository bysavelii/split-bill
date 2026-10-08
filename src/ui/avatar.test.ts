// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import {
  AVATAR_TONE_COUNT,
  createAvatar,
  pickAvatarTone,
  readInitial,
} from "./avatar";

const TWENTY_NAMES = [
  "Аня",
  "Боря",
  "Вера",
  "Гоша",
  "Даша",
  "Егор",
  "Жанна",
  "Зоя",
  "Илья",
  "Катя",
  "Лена",
  "Миша",
  "Надя",
  "Олег",
  "Паша",
  "Рита",
  "Саша",
  "Тима",
  "Уля",
  "Фёдор",
];

describe("pickAvatarTone", () => {
  it("always returns the same tone for one name", () => {
    expect(pickAvatarTone("Аня")).toBe(pickAvatarTone("Аня"));
  });

  it("returns an integer within the palette", () => {
    for (const name of [...TWENTY_NAMES, "", "<b>", "👩‍👩‍👧"]) {
      const tone = pickAvatarTone(name);

      expect(Number.isInteger(tone)).toBe(true);
      expect(tone).toBeGreaterThanOrEqual(0);
      expect(tone).toBeLessThan(AVATAR_TONE_COUNT);
    }
  });

  it("different names in a group get different tones", () => {
    const tones = new Set(TWENTY_NAMES.map(pickAvatarTone));

    expect(tones.size).toBeGreaterThanOrEqual(4);
  });
});

describe("readInitial", () => {
  it.each([
    ["аня", "А"],
    ["  Боря", "Б"],
    ["👩‍👩‍👧 Ок", "👩‍👩‍👧"],
  ])('takes "%s" from "%s"', (name, expected) => {
    expect(readInitial(name)).toBe(expected);
  });

  it("returns an empty string for an empty name", () => {
    expect(readInitial("   ")).toBe("");
  });
});

describe("createAvatar", () => {
  it("is hidden from the screen reader, shows the first letter and carries the tone class", () => {
    const avatar = createAvatar("боря");

    const toneNumber = pickAvatarTone("боря") + 1;
    expect(avatar.getAttribute("aria-hidden")).toBe("true");
    expect(avatar.textContent).toBe("Б");
    expect(avatar.classList.contains("avatar")).toBe(true);
    expect(avatar.classList.contains(`avatar-tone-${String(toneNumber)}`)).toBe(
      true,
    );
  });
});
