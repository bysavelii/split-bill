import { describe, expect, it } from "vitest";
import { buildRobotsText } from "./robots";

describe("buildRobotsText", () => {
  it("allows every crawler and points to the sitemap", () => {
    const text = buildRobotsText(
      new URL("https://bysavelii.github.io/split-bill/sitemap-index.xml"),
    );

    expect(text).toBe(
      [
        "User-agent: *",
        "Allow: /",
        "Sitemap: https://bysavelii.github.io/split-bill/sitemap-index.xml",
        "",
      ].join("\n"),
    );
  });
});
