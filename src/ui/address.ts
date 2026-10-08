/** The only place where the app reads and changes the page address. */
import { LOCALE_DEFINITIONS, type Locale } from "../i18n/locales";

const FRAGMENT_PREFIX_LENGTH = "#".length;

/** The bill code from the address fragment; `undefined` if there is no fragment. */
export function readBillCode(): string | undefined {
  const code = location.hash.slice(FRAGMENT_PREFIX_LENGTH);

  return code === "" ? undefined : code;
}

/** Replaces the fragment of the current history entry: path and query stay, "Back" does not step through edits. */
export function writeBillCode(code: string): void {
  history.replaceState(history.state, "", buildShareUrl(code));
}

export function buildShareUrl(code: string): string {
  const url = new URL(location.href);
  url.hash = code;

  return url.href;
}

/** The address of the page of a language; with a code it opens that bill there. */
export function buildLanguageUrl(
  locale: Locale,
  code: string | undefined,
): string {
  const pageUrl = `${import.meta.env.BASE_URL}${LOCALE_DEFINITIONS[locale].pagePath}`;
  if (code === undefined) return pageUrl;

  return `${pageUrl}#${code}`;
}
