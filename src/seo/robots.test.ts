import { describe, expect, it } from "vitest";
import { buildRobotsText } from "./robots";

describe("buildRobotsText", () => {
  it("allows every crawler and points to the sitemap", () => {
    const text = buildRobotsText(
      new URL("https://split-bill.bysavelii.com/sitemap-index.xml"),
    );

    expect(text).toBe(
      [
        "User-agent: *",
        "Allow: /",
        "Sitemap: https://split-bill.bysavelii.com/sitemap-index.xml",
        "",
      ].join("\n"),
    );
  });
});
