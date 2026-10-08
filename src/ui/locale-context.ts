import { createContext, useContext } from "solid-js";
import type { Locale } from "../i18n/locales";
import type { Messages } from "../i18n/messages";

/** The language of the page and the texts written in it. */
export interface LocaleContextValue {
  readonly locale: Locale;
  readonly messages: Messages;
}

export const LocaleContext = createContext<LocaleContextValue>();

export function useLocale(): LocaleContextValue {
  const value = useContext(LocaleContext);
  if (value === undefined) {
    throw new Error(
      "useLocale was called outside LocaleContext.Provider: wrap the component in App or in the provider",
    );
  }

  return value;
}
