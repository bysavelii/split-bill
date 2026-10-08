import sitemap from "@astrojs/sitemap";
import solid from "@astrojs/solid-js";
import { defineConfig } from "astro/config";
import { DEFAULT_LOCALE, LOCALES } from "./src/i18n/locales.ts";

export default defineConfig({
  // The site is published at https://<owner>.github.io/split-bill/, so every asset URL needs
  // this prefix. `site` is the origin: canonical addresses, the sitemap and the absolute
  // addresses of link previews are built from it.
  site: "https://bysavelii.github.io",
  base: "/split-bill/",
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
