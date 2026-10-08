// @vitest-environment jsdom
import { cleanup, render } from "@solidjs/testing-library";
import { afterEach, describe, expect, it } from "vitest";
import {
  AVATAR_TONE_COUNT,
  Avatar,
  pickAvatarTone,
  readInitial,
} from "./avatar";

afterEach(cleanup);

const TWENTY_NAMES = [
  "Ann",
  "Ben",
  "Clara",
  "Dan",
  "Eve",
  "Frank",
  "Grace",
  "Henry",
  "Ivy",
  "Jack",
  "Kate",
  "Leo",
  "Mia",
  "Noah",
  "Olivia",
  "Paul",
  "Quinn",
  "Rose",
  "Sam",
  "Tom",
];

describe("pickAvatarTone", () => {
  it("always returns the same tone for one name", () => {
    expect(pickAvatarTone("Ann")).toBe(pickAvatarTone("Ann"));
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
    ["άννα", "Ά"],
    ["  Ben", "B"],
    ["👩‍👩‍👧 Ok", "👩‍👩‍👧"],
  ])('from "%s" takes "%s"', (name, expected) => {
    expect(readInitial(name)).toBe(expected);
  });

  it("returns an empty string for an empty name", () => {
    expect(readInitial("   ")).toBe("");
  });
});

describe("Avatar", () => {
  it("is hidden from the screen reader, shows the first letter and carries the tone class", () => {
    const avatar = render(() => <Avatar name="ben" />).container
      .firstElementChild;
    if (avatar === null) throw new Error("Avatar not rendered");

    const toneNumber = pickAvatarTone("ben") + 1;
    expect(avatar.getAttribute("aria-hidden")).toBe("true");
    expect(avatar.textContent).toBe("B");
    expect(avatar.classList.contains("avatar")).toBe(true);
    expect(avatar.classList.contains(`avatar-tone-${String(toneNumber)}`)).toBe(
      true,
    );
  });
});
