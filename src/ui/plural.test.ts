import { describe, expect, it } from "vitest";
import { formatCount } from "./plural";

const TRANSFER_FORMS = { one: "перевод", few: "перевода", many: "переводов" };
const PERSON_FORMS = { one: "человек", few: "человека", many: "человек" };

describe("formatCount", () => {
  it.each([
    [1, "1 перевод"],
    [2, "2 перевода"],
    [5, "5 переводов"],
    [11, "11 переводов"],
    [21, "21 перевод"],
    [22, "22 перевода"],
    [25, "25 переводов"],
  ])("inflects transfers for %i", (count, expected) => {
    expect(formatCount(count, TRANSFER_FORMS)).toBe(expected);
  });

  it.each([
    [1, "1 человек"],
    [2, "2 человека"],
    [5, "5 человек"],
    [11, "11 человек"],
    [21, "21 человек"],
    [22, "22 человека"],
    [25, "25 человек"],
  ])("inflects people for %i", (count, expected) => {
    expect(formatCount(count, PERSON_FORMS)).toBe(expected);
  });
});
