import { getViteConfig } from "astro/config";

export default getViteConfig({
  // Without these two settings Vitest loads the server build of Solid and a second copy of it
  // from the testing library, and nothing reacts in jsdom.
  resolve: { conditions: ["browser", "development"] },
  test: {
    server: { deps: { inline: [/solid-js/, /@solidjs\/testing-library/] } },
  },
});
