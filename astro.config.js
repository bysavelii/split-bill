import { defineConfig } from "astro/config";

export default defineConfig({
  // The site is published at https://<owner>.github.io/split-bill/, so every asset URL needs
  // this prefix. There is no `site`: the owner name stays out of the code.
  base: "/split-bill/",
});
