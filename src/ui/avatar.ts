import { createElement } from "./dom";

/** That many tones are set by the `--color-avatar-1…` tokens in style.css: change them together. */
export const AVATAR_TONE_COUNT = 8;

const FNV_OFFSET_BASIS = 0x81_1c_9d_c5;
const FNV_PRIME = 0x01_00_01_93;
const graphemeSegmenter = new Intl.Segmenter("ru-RU", {
  granularity: "grapheme",
});

/** Tone number from 0 to `AVATAR_TONE_COUNT - 1`: the same name always gets the same one. */
export function pickAvatarTone(name: string): number {
  const codePoints = Array.from(name, (char) => char.codePointAt(0) ?? 0);
  const hash = codePoints.reduce(
    (current, codePoint) => Math.imul(current ^ codePoint, FNV_PRIME),
    FNV_OFFSET_BASIS,
  );

  return (hash >>> 0) % AVATAR_TONE_COUNT;
}

/** The first visible character of the name in upper case: a whole one, not half of a composite emoji. */
export function readInitial(name: string): string {
  const firstGrapheme = graphemeSegmenter.segment(name.trim()).containing(0);
  if (firstGrapheme === undefined) return "";

  return firstGrapheme.segment.toLocaleUpperCase("ru-RU");
}

/** A circle with the first letter of the name; the screen reader skips it because the name is read next to it. */
export function createAvatar(name: string): HTMLSpanElement {
  const toneClass = `avatar-tone-${String(pickAvatarTone(name) + 1)}`;

  return createElement("span", {
    text: readInitial(name),
    className: `avatar ${toneClass}`,
    attributes: { "aria-hidden": "true" },
  });
}
