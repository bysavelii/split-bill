import { createElement } from "./dom";

/** Столько оттенков задано в style.css токенами `--color-avatar-1…`: менять их надо вместе. */
export const AVATAR_TONE_COUNT = 8;

const FNV_OFFSET_BASIS = 0x81_1c_9d_c5;
const FNV_PRIME = 0x01_00_01_93;
const graphemeSegmenter = new Intl.Segmenter("ru-RU", {
  granularity: "grapheme",
});

/** Номер оттенка от 0 до `AVATAR_TONE_COUNT - 1`: у одного имени всегда один и тот же. */
export function pickAvatarTone(name: string): number {
  const codePoints = Array.from(name, (char) => char.codePointAt(0) ?? 0);
  const hash = codePoints.reduce(
    (current, codePoint) => Math.imul(current ^ codePoint, FNV_PRIME),
    FNV_OFFSET_BASIS,
  );

  return (hash >>> 0) % AVATAR_TONE_COUNT;
}

/** Первый видимый знак имени заглавным: целый, а не половинка составного эмодзи. */
export function readInitial(name: string): string {
  const firstGrapheme = graphemeSegmenter.segment(name.trim()).containing(0);
  if (firstGrapheme === undefined) return "";

  return firstGrapheme.segment.toLocaleUpperCase("ru-RU");
}

/** Кружок с первой буквой имени; диктор его пропускает, потому что имя читается рядом. */
export function createAvatar(name: string): HTMLSpanElement {
  const toneClass = `avatar-tone-${String(pickAvatarTone(name) + 1)}`;

  return createElement("span", {
    text: readInitial(name),
    className: `avatar ${toneClass}`,
    attributes: { "aria-hidden": "true" },
  });
}
