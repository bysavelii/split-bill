import sitemap from "@astrojs/sitemap";
import solid from "@astrojs/solid-js";
import { defineConfig } from "astro/config";
import { DEFAULT_LOCALE, LOCALES } from "./src/i18n/locales.ts";

export default defineConfig({
  // The site lives at the root of its own domain. `site` is the origin: canonical addresses,
  // the sitemap and the absolute addresses of link previews are built from it.
  site: "https://split-bill.bysavelii.com",
  integrations: [
    solid(),
    sitemap({
      i18n: {
        defaultLocale: DEFAULT_LOCALE,
        locales: Object.fromEntries(LOCALES.map((locale) => [locale, locale])),
      },
    }),
  ],
});
