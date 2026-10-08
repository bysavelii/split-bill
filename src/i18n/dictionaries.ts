import { EN_MESSAGES } from "./en";
import type { Locale } from "./locales";
import type { Messages } from "./messages";
import { RU_MESSAGES } from "./ru";

export const DICTIONARIES: Record<Locale, Messages> = {
  en: EN_MESSAGES,
  ru: RU_MESSAGES,
};
