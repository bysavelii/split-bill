import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { LOCALES, type Locale } from "../i18n/locales";
import {
  buildPageMetadata,
  PREVIEW_IMAGE_HEIGHT,
  PREVIEW_IMAGE_WIDTH,
} from "./page-metadata";

const SITE_ROOT = new URL("https://split-bill.bysavelii.com/");
const PUBLIC_DIRECTORY = new URL("../../public/", import.meta.url);
/** A PNG starts with a signature, then the IHDR chunk: length, type, width, height. */
const PNG_SIGNATURE = Buffer.from([
  0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a,
]);
const PNG_WIDTH_OFFSET = 16;
const PNG_HEIGHT_OFFSET = 20;

function readPreviewImage(locale: Locale): Buffer {
  const { imageUrl } = buildPageMetadata({ locale, siteRoot: SITE_ROOT });
  const fileName = imageUrl.slice(SITE_ROOT.href.length);

  return readFileSync(new URL(fileName, PUBLIC_DIRECTORY));
}

describe("preview images", () => {
  it.each(LOCALES)(
    "has a PNG in public/ for the %s page, so a new language needs one",
    (locale) => {
      const image = readPreviewImage(locale);

      expect(image.subarray(0, PNG_SIGNATURE.length)).toEqual(PNG_SIGNATURE);
    },
  );

  it.each(LOCALES)("has the size the page tags promise for %s", (locale) => {
    const image = readPreviewImage(locale);

    expect(image.readUInt32BE(PNG_WIDTH_OFFSET)).toBe(PREVIEW_IMAGE_WIDTH);
    expect(image.readUInt32BE(PNG_HEIGHT_OFFSET)).toBe(PREVIEW_IMAGE_HEIGHT);
  });
});
